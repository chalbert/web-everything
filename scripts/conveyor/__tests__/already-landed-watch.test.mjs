import { describe, it, expect, vi } from 'vitest';
import {
  buildAlreadyLandedComment, planAlreadyLandedCloses, runAlreadyLandedWatch, AGENT_NAME,
} from '../already-landed-watch.mjs';

// A `checkStaleness` stub that never touches git — every `runAlreadyLandedWatch` test below injects one
// (mirrors `reconcile-fix-dispatch.test.mjs`'s own `FRESH` stub for the SAME #3439/#3474 staleness guard).
const FRESH = () => ({ fresh: true, behind: 0 });

describe('buildAlreadyLandedComment', () => {
  it('names the carrier PR when attribution was confirmed', () => {
    const body = buildAlreadyLandedComment({ carrierPr: 2759 });
    expect(body).toContain('#2759');
    expect(body).toContain(AGENT_NAME);
  });

  it('states the containment fact without inventing a carrier when attribution is unconfirmed', () => {
    const body = buildAlreadyLandedComment({ carrierPr: null });
    expect(body).not.toMatch(/#null/);
    expect(body).toContain('could not be attributed with confidence');
  });
});

describe('planAlreadyLandedCloses', () => {
  it('narrows a reconcile plan to its `already-landed` refusals and derives the item number from the lane ref', () => {
    const plan = {
      refusals: [
        { kind: 'already-landed', prNumber: 2752, carrierPr: 2759, headRefName: 'lane/4034-critical-work-gate' },
        { kind: 'cap-exhausted', prNumber: 900 },
      ],
      dispatch: [],
    };
    const out = planAlreadyLandedCloses(plan);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ prNumber: 2752, carrierPr: 2759, itemNum: '4034' });
    expect(out[0].comment).toContain('#2759');
  });

  it('leaves itemNum null for a lane ref that names no item, or none at all', () => {
    const plan = { refusals: [{ kind: 'already-landed', prNumber: 1, carrierPr: null, headRefName: 'lane/some-slug' }] };
    const out = planAlreadyLandedCloses(plan);
    expect(out[0].itemNum).toBeNull();
    expect(planAlreadyLandedCloses({ refusals: [{ kind: 'already-landed', prNumber: 2 }] })[0].itemNum).toBeNull();
  });

  it('returns [] with no already-landed refusals, or a malformed plan', () => {
    expect(planAlreadyLandedCloses({ refusals: [{ kind: 'cap-exhausted', prNumber: 1 }] })).toEqual([]);
    expect(planAlreadyLandedCloses({})).toEqual([]);
    expect(planAlreadyLandedCloses(null)).toEqual([]);
  });
});

describe('runAlreadyLandedWatch', () => {
  const fakePlan = {
    refusals: [{ kind: 'already-landed', prNumber: 2752, carrierPr: 2759, headRefName: 'lane/4034-critical-work-gate' }],
  };

  it('dry-run (default): reports what it WOULD do, calls neither postComment, closePr nor resolveItem', () => {
    const postComment = vi.fn();
    const closePr = vi.fn();
    const resolveItem = vi.fn();
    const out = runAlreadyLandedWatch({ readPlan: () => fakePlan, postComment, closePr, resolveItem, checkStaleness: FRESH });
    expect(out.planned).toHaveLength(1);
    expect(out.applied).toEqual([]);
    expect(postComment).not.toHaveBeenCalled();
    expect(closePr).not.toHaveBeenCalled();
    expect(resolveItem).not.toHaveBeenCalled();
  });

  it('--apply: comments, closes, and resolves the item the PR\'s own lane ref names', () => {
    const postComment = vi.fn(() => true);
    const closePr = vi.fn(() => true);
    const resolveItem = vi.fn(() => ({ flipped: true, alreadyResolved: false }));
    const out = runAlreadyLandedWatch({
      readPlan: () => fakePlan, apply: true, postComment, closePr, resolveItem, cwd: '/repo', checkStaleness: FRESH,
    });
    expect(postComment).toHaveBeenCalledWith(2752, expect.stringContaining('#2759'), { repo: null });
    expect(closePr).toHaveBeenCalledWith(2752, { repo: null });
    expect(resolveItem).toHaveBeenCalledWith('/repo', '4034', { sync: true, publish: true });
    expect(out.applied).toEqual([{ prNumber: 2752, commented: true, closed: true, itemNum: '4034', resolved: { flipped: true, alreadyResolved: false } }]);
  });

  it('--apply skips resolveItem when the PR\'s lane ref names no item, without failing the whole action', () => {
    const noItemPlan = { refusals: [{ kind: 'already-landed', prNumber: 1, carrierPr: null, headRefName: 'lane/some-slug' }] };
    const resolveItem = vi.fn();
    const out = runAlreadyLandedWatch({
      readPlan: () => noItemPlan, apply: true, postComment: () => true, closePr: () => true, resolveItem, checkStaleness: FRESH,
    });
    expect(resolveItem).not.toHaveBeenCalled();
    expect(out.applied[0].itemNum).toBeNull();
    expect(out.applied[0].resolved).toBeNull();
  });

  it('--apply never resolves the card when the PR failed to close — the still-open PR keeps its card open (PR #2769 review)', () => {
    const resolveItem = vi.fn(() => ({ flipped: true, alreadyResolved: false }));
    const out = runAlreadyLandedWatch({
      readPlan: () => fakePlan, apply: true, postComment: () => true, closePr: () => false, resolveItem, checkStaleness: FRESH,
    });
    expect(resolveItem).not.toHaveBeenCalled();
    // …and no comment either: the PR is planned again next tick, so commenting now would repeat every run.
    expect(out.applied).toEqual([{ prNumber: 2752, commented: false, closed: false, itemNum: '4034', resolved: null }]);
  });

  it('--apply degrades a throwing resolveItem to a reported failure rather than throwing out of the whole pass', () => {
    const resolveItem = vi.fn(() => { throw new Error('backlog.mjs resolve failed: illegal from-status'); });
    const out = runAlreadyLandedWatch({
      readPlan: () => fakePlan, apply: true, postComment: () => true, closePr: () => true, resolveItem, checkStaleness: FRESH,
    });
    expect(out.applied[0].resolved).toMatchObject({ flipped: false, alreadyResolved: false });
    expect(out.applied[0].resolved.reason).toMatch(/illegal from-status/);
  });

  it('nothing to do: planned and applied both empty, no calls made', () => {
    const postComment = vi.fn();
    const out = runAlreadyLandedWatch({ readPlan: () => ({ refusals: [] }), apply: true, postComment, checkStaleness: FRESH });
    expect(out).toEqual({ planned: [], applied: [] });
    expect(postComment).not.toHaveBeenCalled();
  });

  // #4268 — HIGH: this watch reads main PURELY LOCALLY (via `reconcile-pass.mjs`'s already-landed containment
  // check) and is invoked as its own standalone CLI/watch, never through `reconcile-fix-dispatch.mjs`'s own
  // staleness-guarded path. A stale local `origin/main` can find a PR "already landed" against a main that has
  // since moved on; `--apply` would then close a still-needed PR and resolve its card. These assert the SAME
  // #3439/#3474 dispatch-chokepoint guard now runs here too, refusing before `readPlan` is ever trusted.
  it('#4268 refuses to run at all from a stale local main — never even reads reconcile-pass\'s plan', () => {
    let readPlanCalls = 0;
    expect(() => runAlreadyLandedWatch({
      root: '/repo',
      readPlan: () => { readPlanCalls += 1; return fakePlan; },
      checkStaleness: () => ({ action: 'warn', behind: 3 }),
    })).toThrow(/behind origin\/main/);
    expect(readPlanCalls).toBe(0);
  });

  it('#4268 the stale-main refusal blocks even a bare dry-run report, not only --apply — a stale read must never be trusted at all', () => {
    expect(() => runAlreadyLandedWatch({
      root: '/repo',
      apply: false,
      readPlan: () => fakePlan,
      checkStaleness: () => ({ action: 'warn', reason: 'diverged', behind: 3, ahead: 2 }),
    })).toThrow(/behind origin\/main/);
  });

  it('#4268 a FRESH local main still proceeds into the ordinary plan/apply path', () => {
    const closePr = vi.fn(() => true);
    const out = runAlreadyLandedWatch({
      root: '/repo', apply: true, readPlan: () => fakePlan, postComment: () => true, closePr,
      resolveItem: () => ({ flipped: true, alreadyResolved: false }), checkStaleness: FRESH,
    });
    expect(closePr).toHaveBeenCalledWith(2752, { repo: null });
    expect(out.applied).toHaveLength(1);
  });
});
