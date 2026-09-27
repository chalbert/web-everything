/** @file #xconv1 (chalbert/web-everything#2766/#2767 unblock) — the mechanical executor for a
 *  `kind:'convert-advisory'` dispatch entry: post the converted advisory note, run ONE tool-free targeted-check
 *  judge seat, apply advisory:accepted|changes, clear review:awaiting-advisory. No `gh`, no real judge spawn —
 *  every effect injected. */
import { describe, expect, it, vi } from 'vitest';
import {
  TARGETED_CHECK_SHAPE, buildTargetedCheckMandate, buildTargetedCheckInput, runTargetedCheck,
  planConvertAdvisoryEffects, dispatchConvertAdvisory,
} from '../convert-advisory-dispatch.mjs';
import {
  buildReviewedShaMarker, hasConvertedAdvisoryNote, renderConvertedAdvisoryNote,
} from '../../lib/review-escalation.mjs';

const HEAD = 'abbe08beacae462f98d6caf654d3ce7867c92801';
const acceptComment = {
  body: `✅ review — accepted\n\n## Human review verdict — chalbert/web-everything#2766\n\n**Verdict:** ✅ pass\n\n${buildReviewedShaMarker(HEAD)}`,
  createdAt: '2026-09-26T21:47:43Z',
};
const escalation = {
  kind: 'test-gaming',
  reasonText: 'test-gaming suspected — CI-green may be manufactured by tampering with tests: tests-removed: '
    + 'scripts/operations/__tests__/review-loop-cli.test.mjs (net 2 test case(s) removed)',
};
const d = { prNumber: 2766, headSha: HEAD, reviewedSha: HEAD, acceptComment, escalation, kind: 'convert-advisory' };

function provider({ readPrState } = {}) {
  const calls = { readPrState: [], postComment: [], setLabels: [] };
  return {
    calls,
    readPrState: (repo, num) => { calls.readPrState.push({ repo, num }); return readPrState ? readPrState(repo, num) : { comments: [], labels: [] }; },
    postComment: (repo, num, body) => { calls.postComment.push({ repo, num, body }); },
    setLabels: (repo, num, spec) => { calls.setLabels.push({ repo, num, spec }); },
  };
}

describe('buildTargetedCheckMandate / buildTargetedCheckInput', () => {
  it('the mandate states the escalation question and is explicit this is NOT a full re-review', () => {
    const mandate = buildTargetedCheckMandate(escalation);
    expect(mandate).toMatch(/test case/i);
    expect(mandate).toMatch(/NOT re-reviewing the whole diff/i);
  });
  it('the input carries the escalation reason and the prior verdict, never a fresh diff fetch', () => {
    const input = buildTargetedCheckInput({ acceptComment, escalation });
    expect(input).toContain(escalation.reasonText);
    expect(input).toContain(acceptComment.body);
  });
});

describe('runTargetedCheck', () => {
  it('calls the injected judge with the forced shape and the escalation-scoped mandate/input, and narrows the verdict', async () => {
    const fakeJudge = vi.fn(async (opts) => {
      expect(opts.shape).toBe(TARGETED_CHECK_SHAPE);
      expect(opts.mandate).toContain('test case');
      expect(opts.input).toContain(escalation.reasonText);
      return { value: { verdict: 'accept', note: 'legitimate removal — replaced by equivalent coverage' } };
    });
    const answer = await runTargetedCheck({ acceptComment, escalation, runId: 'x', judge: fakeJudge });
    expect(fakeJudge).toHaveBeenCalledTimes(1);
    expect(answer).toEqual({ verdict: 'accept', note: 'legitimate removal — replaced by equivalent coverage' });
  });
  it('narrows a malformed/missing verdict to `accept` (never let a malformed fake read as `changes`) and a missing note to empty string', async () => {
    const fakeJudge = vi.fn(async () => ({ value: {} }));
    expect(await runTargetedCheck({ acceptComment, escalation, judge: fakeJudge })).toEqual({ verdict: 'accept', note: '' });
  });
  it('a real `changes` verdict passes through unchanged', async () => {
    const fakeJudge = vi.fn(async () => ({ value: { verdict: 'changes', note: 'tests were weakened, not replaced' } }));
    expect(await runTargetedCheck({ acceptComment, escalation, judge: fakeJudge })).toEqual({ verdict: 'changes', note: 'tests were weakened, not replaced' });
  });
});

describe('planConvertAdvisoryEffects (pure)', () => {
  it('an `accept` targeted check plans advisory:accepted, drops any stale advisory:changes and review:awaiting-advisory', () => {
    const plan = planConvertAdvisoryEffects({
      prNumber: 2766, repo: 'chalbert/web-everything', headSha: HEAD, acceptComment, escalation,
      targetedCheckAnswer: { verdict: 'accept', note: 'ok' },
      currentLabels: [{ name: 'review:human' }, { name: 'review:awaiting-advisory' }, { name: 'advisory:changes' }],
    });
    expect(plan.addLabel).toBe('advisory:accepted');
    expect(plan.removeLabels.sort()).toEqual(['advisory:changes', 'review:awaiting-advisory'].sort());
    expect(plan.body).toContain('**Advisory outcome:** `accept`');
  });
  it('a `changes` targeted check plans advisory:changes', () => {
    const plan = planConvertAdvisoryEffects({
      prNumber: 2766, repo: 'chalbert/web-everything', headSha: HEAD, acceptComment, escalation,
      targetedCheckAnswer: { verdict: 'changes', note: 'weakened' },
      currentLabels: [{ name: 'review:human' }],
    });
    expect(plan.addLabel).toBe('advisory:changes');
    expect(plan.removeLabels).toEqual([]);
  });
  it('review:awaiting-advisory is left alone when already absent (never a spurious remove call)', () => {
    const plan = planConvertAdvisoryEffects({
      prNumber: 2766, repo: 'chalbert/web-everything', headSha: HEAD, acceptComment, escalation,
      targetedCheckAnswer: { verdict: 'accept', note: 'ok' }, currentLabels: [{ name: 'review:human' }],
    });
    expect(plan.removeLabels).toEqual([]);
  });
});

describe('dispatchConvertAdvisory (IO shell, injected)', () => {
  it('THE LIVE #2766/#2767 SHAPE: posts the converted note, applies advisory:accepted, clears review:awaiting-advisory', async () => {
    const p = provider({ readPrState: () => ({ comments: [acceptComment], labels: [{ name: 'review:human' }, { name: 'review:awaiting-advisory' }] }) });
    const fakeJudge = vi.fn(async () => ({ verdict: 'accept', note: 'legitimate removal' }));
    const result = await dispatchConvertAdvisory(d, { repo: 'chalbert/web-everything', provider: p, runJudge: fakeJudge });
    expect(result.posted).toBe(true);
    expect(p.calls.postComment).toHaveLength(1);
    expect(p.calls.postComment[0].body).toContain('CONVERTED');
    expect(p.calls.setLabels).toHaveLength(1);
    expect(p.calls.setLabels[0].spec).toEqual({ add: 'advisory:accepted', remove: ['review:awaiting-advisory'] });
    expect(fakeJudge).toHaveBeenCalledTimes(1);
  });

  it('IDEMPOTENT: a head that already carries the converted note is a no-op — no post, no label write, no judge call', async () => {
    const already = renderConvertedAdvisoryNote({
      repo: 'chalbert/web-everything', pr: 2766, headSha: HEAD, acceptComment, escalation,
      targetedCheckAnswer: { verdict: 'accept', note: 'ok' },
    });
    expect(hasConvertedAdvisoryNote([{ body: already, author: { login: 'web-everything' } }], HEAD)).toBe(true);
    const p = provider({ readPrState: () => ({ comments: [{ body: already, author: { login: 'web-everything' } }], labels: [] }) });
    const fakeJudge = vi.fn();
    const result = await dispatchConvertAdvisory(d, { repo: 'chalbert/web-everything', provider: p, runJudge: fakeJudge });
    expect(result.skipped).toBe('already-converted');
    expect(p.calls.postComment).toHaveLength(0);
    expect(p.calls.setLabels).toHaveLength(0);
    expect(fakeJudge).not.toHaveBeenCalled();
  });

  it('dryRun computes the exact plan with no gh write and no real judge spawn (an injected fake stands in)', async () => {
    const p = provider();
    const fakeJudge = vi.fn(async () => ({ verdict: 'accept', note: 'legitimate removal' }));
    const result = await dispatchConvertAdvisory(d, {
      repo: 'chalbert/web-everything', provider: p, runJudge: fakeJudge, dryRun: true,
      comments: [acceptComment], labels: [{ name: 'review:human' }, { name: 'review:awaiting-advisory' }],
    });
    expect(result.dryRun).toBe(true);
    expect(result.body).toContain('CONVERTED');
    expect(result.addLabel).toBe('advisory:accepted');
    expect(result.removeLabels).toEqual(['review:awaiting-advisory']);
    expect(p.calls.postComment).toHaveLength(0);
    expect(p.calls.setLabels).toHaveLength(0);
    expect(p.calls.readPrState).toHaveLength(0); // comments/labels were handed in — no fresh fetch
  });

  it('a `changes` targeted check applies advisory:changes instead', async () => {
    const p = provider({ readPrState: () => ({ comments: [acceptComment], labels: [{ name: 'review:human' }] }) });
    const fakeJudge = vi.fn(async () => ({ verdict: 'changes', note: 'tests were weakened, not replaced' }));
    const result = await dispatchConvertAdvisory(d, { repo: 'chalbert/web-everything', provider: p, runJudge: fakeJudge });
    expect(p.calls.setLabels[0].spec).toEqual({ add: 'advisory:changes', remove: [] });
    expect(result.body).toContain('tests were weakened, not replaced');
  });

  it('with no shared read handed in, fetches fresh PR state exactly once', async () => {
    const p = provider({ readPrState: () => ({ comments: [acceptComment], labels: [] }) });
    const fakeJudge = vi.fn(async () => ({ verdict: 'accept', note: 'ok' }));
    await dispatchConvertAdvisory(d, { repo: 'chalbert/web-everything', provider: p, runJudge: fakeJudge });
    expect(p.calls.readPrState).toHaveLength(1);
  });
});
