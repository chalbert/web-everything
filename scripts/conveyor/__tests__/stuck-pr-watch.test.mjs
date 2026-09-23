/**
 * @file scripts/conveyor/__tests__/stuck-pr-watch.test.mjs
 * @description The stuck-PR watch's IO shell (epic #3383): the discovery argv, the lazy per-candidate timeline
 *   fetch, and — the property the PROOF requirement most cares about — that `--dry-run` NEVER calls the
 *   dispatcher or the comment provider, while a real sweep dispatches + comments on exactly the PRs the
 *   concurrency cap allows.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  defaultListOpenPrs, defaultListTimelineEvents, defaultCountLiveInspections, watchStuckPrs, PR_LIST_JSON_FIELDS,
} from '../stuck-pr-watch.mjs';
import { STUCK_DISPATCH_MARKER } from '../stuck-pr-watch-core.mjs';

const PENDING = { name: 'review:pending' };
const CHANGES = { name: 'review:changes' };

/** A minimal open PR fixture in the `fix` stage, stuck (no activity for 2h, threshold 45m). */
function stuckFixPr(overrides = {}) {
  return {
    number: 42, headRefName: 'lane/42-x', headRefOid: 'deadbeef', labels: [CHANGES], mergeable: 'MERGEABLE',
    isDraft: false, comments: [], ...overrides,
  };
}

describe('defaultListOpenPrs', () => {
  it('asks for every field the pure core needs, in one call', () => {
    const exec = vi.fn(() => '[]');
    defaultListOpenPrs({ exec, repo: 'chalbert/web-everything' });
    expect(exec).toHaveBeenCalledWith('gh', [
      'pr', 'list', '--state', 'open', '--limit', '200', '--json', PR_LIST_JSON_FIELDS,
      '--repo', 'chalbert/web-everything',
    ], expect.any(Object));
  });
  it('omits --repo when none is given', () => {
    const exec = vi.fn(() => '[]');
    defaultListOpenPrs({ exec });
    expect(exec.mock.calls[0][1]).not.toContain('--repo');
  });
});

describe('defaultListTimelineEvents', () => {
  it('queries the paginated issues timeline, projecting only the three progress event types', () => {
    const exec = vi.fn(() => 'T1\tlabeled\nT2\tcommented\n');
    const events = defaultListTimelineEvents({ number: 42, repo: 'chalbert/web-everything', exec });
    expect(exec.mock.calls[0][0]).toBe('gh');
    const argv = exec.mock.calls[0][1];
    expect(argv).toContain('repos/chalbert/web-everything/issues/42/timeline');
    expect(argv.join(' ')).toContain('labeled');
    expect(argv.join(' ')).toContain('commented');
    expect(argv.join(' ')).toContain('committed');
    expect(events).toEqual([{ createdAt: 'T1', event: 'labeled' }, { createdAt: 'T2', event: 'commented' }]);
  });
});

describe('defaultCountLiveInspections', () => {
  it('counts only inspect-* sessions, degrading to 0 on a read failure', () => {
    const listAgents = () => [{ name: 'inspect-1' }, { name: 'inspect-pa-2' }, { name: 'review-9' }, { name: 'fix-3' }];
    expect(defaultCountLiveInspections({ listAgents })).toBe(2);
    expect(defaultCountLiveInspections({ listAgents: () => { throw new Error('nope'); } })).toBe(0);
  });
});

describe('watchStuckPrs — the whole sweep, every IO point injected', () => {
  const now = new Date('2026-09-23T19:00:00Z').getTime();
  const oldActivity = () => [{ createdAt: '2026-09-23T17:00:00Z', event: 'commented' }]; // 2h ago > 45m threshold

  it('--dry-run NEVER calls the dispatcher or the comment provider (the PROOF requirement)', () => {
    const dispatch = vi.fn();
    const provider = { postComment: vi.fn(), currentRepo: vi.fn(() => 'chalbert/web-everything') };
    const result = watchStuckPrs({
      repo: 'chalbert/web-everything', dryRun: true, now,
      listPrs: () => [stuckFixPr()],
      listTimelineEvents: oldActivity,
      readAgents: () => [], enrich: (a) => a,
      countLiveInspections: () => 0,
      dispatch, provider,
    });
    expect(dispatch).not.toHaveBeenCalled();
    expect(provider.postComment).not.toHaveBeenCalled();
    expect(provider.currentRepo).not.toHaveBeenCalled();
    expect(result.stuck).toBe(1);
    const row = result.results.find((r) => r.num === 42);
    expect(row.verdict).toBe('stuck');
    expect(row.wouldDispatch).toBe(true);
  });

  it('a real sweep dispatches and posts the marker comment for a genuinely stuck PR', () => {
    const dispatch = vi.fn(() => ({ sessionSlug: 'fix-42-inspect', agentId: 'abc123' })); // return shape only — slug not asserted here
    const postComment = vi.fn();
    const provider = { postComment, currentRepo: vi.fn(() => 'chalbert/web-everything') };
    const result = watchStuckPrs({
      repo: 'chalbert/web-everything', dryRun: false, now,
      listPrs: () => [stuckFixPr()],
      listTimelineEvents: oldActivity,
      readAgents: () => [], enrich: (a) => a,
      countLiveInspections: () => 0,
      dispatch, provider,
    });
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(postComment).toHaveBeenCalledTimes(1);
    const [repoArg, prArg, body] = postComment.mock.calls[0];
    expect(repoArg).toBe('chalbert/web-everything');
    expect(prArg).toBe(42);
    expect(body.startsWith(STUCK_DISPATCH_MARKER)).toBe(true);
    expect(result.dispatchedCount).toBe(1);
  });

  it('never dispatches twice for the same episode — the marker comment already covers it', () => {
    const dispatch = vi.fn();
    const provider = { postComment: vi.fn(), currentRepo: vi.fn() };
    const pr = stuckFixPr({
      comments: [{ body: `${STUCK_DISPATCH_MARKER}\n\nepisode: 2026-09-23T17:00:00Z\n\n…` }],
    });
    const result = watchStuckPrs({
      repo: 'chalbert/web-everything', dryRun: false, now,
      listPrs: () => [pr], listTimelineEvents: oldActivity,
      readAgents: () => [], enrich: (a) => a, countLiveInspections: () => 0, dispatch, provider,
    });
    expect(dispatch).not.toHaveBeenCalled();
    expect(result.results.find((r) => r.num === 42).verdict).toBe('already-dispatched-this-episode');
  });

  it('a NEW episode (fresh activity, then stuck again) dispatches again', () => {
    const dispatch = vi.fn(() => ({ sessionSlug: 'inspect-42', agentId: null }));
    const provider = { postComment: vi.fn(), currentRepo: vi.fn(() => 'chalbert/web-everything') };
    const pr = stuckFixPr({
      comments: [{ body: `${STUCK_DISPATCH_MARKER}\n\nepisode: 2026-09-01T00:00:00Z\n\n…` }], // an OLD, different episode
    });
    const result = watchStuckPrs({
      repo: 'chalbert/web-everything', dryRun: false, now,
      listPrs: () => [pr], listTimelineEvents: oldActivity, // latest activity is 2026-09-23T17:00:00Z — a NEW episode
      readAgents: () => [], enrich: (a) => a, countLiveInspections: () => 0, dispatch, provider,
    });
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(result.dispatchedCount).toBe(1);
  });

  it('respects the concurrency cap end-to-end — a full cap dispatches nothing', () => {
    const dispatch = vi.fn();
    const provider = { postComment: vi.fn(), currentRepo: vi.fn() };
    const result = watchStuckPrs({
      repo: 'chalbert/web-everything', dryRun: false, now,
      listPrs: () => [stuckFixPr()],
      listTimelineEvents: oldActivity,
      readAgents: () => [], enrich: (a) => a,
      countLiveInspections: () => 2, // already at the default cap of 2
      dispatch, provider,
    });
    expect(dispatch).not.toHaveBeenCalled();
    expect(result.results.find((r) => r.num === 42).deferredReason).toBe('concurrency-cap');
  });

  it('excludes review:human, draft, and stood-down PRs before ever fetching a timeline', () => {
    const listTimelineEvents = vi.fn(oldActivity);
    const result = watchStuckPrs({
      repo: 'chalbert/web-everything', dryRun: true, now,
      listPrs: () => [stuckFixPr({ number: 1, labels: [{ name: 'review:human' }] }), stuckFixPr({ number: 2, isDraft: true })],
      listTimelineEvents,
      readAgents: () => [], enrich: (a) => a, countLiveInspections: () => 0,
    });
    expect(listTimelineEvents).not.toHaveBeenCalled();
    expect(result.results).toEqual([{ num: 1, verdict: 'excluded' }, { num: 2, verdict: 'excluded' }]);
  });

  it('a failed agents read fails CLOSED — the whole sweep skips rather than guessing nothing is live', () => {
    const dispatch = vi.fn();
    const result = watchStuckPrs({
      repo: 'chalbert/web-everything', dryRun: false, now,
      listPrs: () => [stuckFixPr()],
      listTimelineEvents: oldActivity,
      readAgents: () => { throw new Error('claude agents failed'); },
      enrich: (a) => a, countLiveInspections: () => 0, dispatch,
    });
    expect(dispatch).not.toHaveBeenCalled();
    expect(result.results).toEqual([]);
  });

  it('refuses an unknown --repo', () => {
    expect(() => watchStuckPrs({ repo: 'someone/else', listPrs: () => [] })).toThrow(/is not a constellation repo/);
  });
});
