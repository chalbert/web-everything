/** @file #xconv1 (chalbert/web-everything#2766/#2767 unblock) — the mechanical executor for a
 *  `kind:'convert-advisory'` dispatch entry: post the converted advisory note, run ONE tool-free targeted-check
 *  judge seat, apply advisory:accepted|changes, clear review:awaiting-advisory. No `gh`, no real judge spawn,
 *  no real `git` — every effect injected (#xconv1-evidence adds `fetchEvidence` to that list: every test below
 *  fakes it so the suite never shells a real `git diff`/`git fetch`, even though the module's own DEFAULT is
 *  real IO — the same posture `provider`/`runJudge` already have). */
import { describe, expect, it, vi } from 'vitest';
import {
  TARGETED_CHECK_SHAPE, buildTargetedCheckMandate, buildTargetedCheckInput, runTargetedCheck,
  planConvertAdvisoryEffects, dispatchConvertAdvisory, fetchTestGamingDiffEvidence, resolveTargetedCheckEvidence,
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

/** A fake `fetchEvidence` that stands in for a real `git diff` — every `dispatchConvertAdvisory` test below
 *  passes one explicitly so the suite is hermetic (#xconv1-evidence: the module's own default shells real
 *  `git`, exactly like `provider`'s own default shells real `gh`). */
const FAKE_DIFF = '--- a/scripts/operations/__tests__/review-loop-cli.test.mjs\n'
  + "+++ b/scripts/operations/__tests__/review-loop-cli.test.mjs\n-it('old case', () => {});\n+it('new case', () => {});\n";
function fakeAvailableEvidence() {
  return vi.fn(async () => ({ text: FAKE_DIFF, scored: true }));
}
function fakeUnavailableEvidence() {
  return vi.fn(async () => ({ text: '', scored: false, reason: 'ref-unresolved' }));
}

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
  it('the mandate requires `inconclusive` when no diff evidence is given — never a `changes` guess (#xconv1-evidence)', () => {
    const mandate = buildTargetedCheckMandate(escalation);
    expect(mandate).toMatch(/inconclusive/i);
    expect(mandate).not.toMatch(/that is a `changes`\s*\n?answer/i);
  });
  it('the input carries the escalation reason and the prior verdict, with no evidence section when none is given', () => {
    const input = buildTargetedCheckInput({ acceptComment, escalation });
    expect(input).toContain(escalation.reasonText);
    expect(input).toContain(acceptComment.body);
  });
  it('the input embeds the real diff text when evidence is supplied (#xconv1-evidence)', () => {
    const input = buildTargetedCheckInput({ acceptComment, escalation, evidence: FAKE_DIFF });
    expect(input).toContain(FAKE_DIFF);
    expect(input).toContain('Net diff of the file(s)');
  });
  it('a test-gaming escalation with NO evidence states plainly that none could be fetched and inconclusive is owed', () => {
    const input = buildTargetedCheckInput({ acceptComment, escalation });
    expect(input).toMatch(/no diff could be fetched/i);
    expect(input).toMatch(/inconclusive/i);
  });
});

describe('fetchTestGamingDiffEvidence / resolveTargetedCheckEvidence', () => {
  it('fetchTestGamingDiffEvidence: scored:false with no paths, no rev, or no exec — never a throw', () => {
    expect(fetchTestGamingDiffEvidence({ rev: HEAD, paths: [] })).toEqual({ text: '', scored: false, reason: 'no-paths' });
    expect(fetchTestGamingDiffEvidence({ rev: null, paths: ['a.test.mjs'] })).toEqual({ text: '', scored: false, reason: 'no-paths' });
  });
  it('fetchTestGamingDiffEvidence: an injected exec that resolves the basis returns the scoped diff text', () => {
    const calls = [];
    const exec = (cmd, args) => {
      calls.push(args.join(' '));
      if (args[0] === 'fetch') return '';
      if (args[0] === 'merge-base') return 'deadbeef';
      if (args[0] === 'diff') return FAKE_DIFF;
      return '';
    };
    const result = fetchTestGamingDiffEvidence({ exec, rev: HEAD, paths: ['scripts/operations/__tests__/review-loop-cli.test.mjs'] });
    expect(result).toEqual({ text: FAKE_DIFF, scored: true, base: 'deadbeef', rev: `origin/${HEAD}` });
    expect(calls.some((c) => c.includes('review-loop-cli.test.mjs'))).toBe(true);
  });
  it('fetchTestGamingDiffEvidence: an unresolvable basis (no candidate resolves) reports scored:false', () => {
    const exec = (cmd, args) => {
      if (args[0] === 'fetch') return '';
      throw new Error('fatal: bad revision');
    };
    expect(fetchTestGamingDiffEvidence({ exec, rev: HEAD, paths: ['x.test.mjs'] }).scored).toBe(false);
  });

  it('resolveTargetedCheckEvidence: not required for a non-test-gaming escalation', async () => {
    const fetchEvidence = vi.fn();
    const result = await resolveTargetedCheckEvidence({
      escalation: { kind: 'manifest-tamper', reasonText: 'manifest baseline mismatch: x' }, headSha: HEAD, fetchEvidence,
    });
    expect(result).toEqual({ required: false, available: false, text: '' });
    expect(fetchEvidence).not.toHaveBeenCalled();
  });
  it('resolveTargetedCheckEvidence: required + available when the fetch returns real diff text', async () => {
    const result = await resolveTargetedCheckEvidence({ escalation, headSha: HEAD, fetchEvidence: fakeAvailableEvidence() });
    expect(result.required).toBe(true);
    expect(result.available).toBe(true);
    expect(result.text).toBe(FAKE_DIFF);
  });
  it('resolveTargetedCheckEvidence: required + NOT available when the fetch cannot produce evidence', async () => {
    const result = await resolveTargetedCheckEvidence({ escalation, headSha: HEAD, fetchEvidence: fakeUnavailableEvidence() });
    expect(result.required).toBe(true);
    expect(result.available).toBe(false);
    expect(result.note).toMatch(/no diff evidence/i);
  });
  it('resolveTargetedCheckEvidence: required + NOT available when no path can be parsed from the reason at all', async () => {
    const fetchEvidence = vi.fn();
    const result = await resolveTargetedCheckEvidence({
      escalation: { kind: 'test-gaming', reasonText: 'test-gaming suspected — no recognizable finding here' },
      headSha: HEAD, fetchEvidence,
    });
    expect(result.required).toBe(true);
    expect(result.available).toBe(false);
    expect(result.note).toMatch(/no test file path/i);
    expect(fetchEvidence).not.toHaveBeenCalled();
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
  it('a real `inconclusive` verdict passes through unchanged, NEVER collapsed into `accept` (#xconv1-evidence — the bug this fix closes)', async () => {
    const fakeJudge = vi.fn(async () => ({ value: { verdict: 'inconclusive', note: 'no diff evidence was given' } }));
    expect(await runTargetedCheck({ acceptComment, escalation, judge: fakeJudge })).toEqual({ verdict: 'inconclusive', note: 'no diff evidence was given' });
  });
  it('passes the evidence through to buildTargetedCheckInput', async () => {
    const fakeJudge = vi.fn(async (opts) => {
      expect(opts.input).toContain(FAKE_DIFF);
      return { value: { verdict: 'accept', note: 'ok' } };
    });
    await runTargetedCheck({ acceptComment, escalation, evidence: FAKE_DIFF, judge: fakeJudge });
    expect(fakeJudge).toHaveBeenCalledTimes(1);
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
  it('an `inconclusive` targeted check plans NO advisory label at all (#xconv1-evidence — never a manufactured advisory:changes)', () => {
    const plan = planConvertAdvisoryEffects({
      prNumber: 2766, repo: 'chalbert/web-everything', headSha: HEAD, acceptComment, escalation,
      targetedCheckAnswer: { verdict: 'inconclusive', note: 'no diff evidence was available' },
      currentLabels: [{ name: 'review:human' }, { name: 'review:awaiting-advisory' }],
    });
    expect(plan.addLabel).toBeNull();
    expect(plan.body).toContain('**Advisory outcome:** `inconclusive`');
    expect(plan.body).not.toContain('advisory:changes` is applied');
    expect(plan.body).not.toContain('advisory:accepted` is applied');
  });
});

describe('dispatchConvertAdvisory (IO shell, injected)', () => {
  it('THE LIVE #2766/#2767 SHAPE, WITH REAL DIFF EVIDENCE: posts the converted note, applies advisory:accepted, clears review:awaiting-advisory', async () => {
    const p = provider({ readPrState: () => ({ comments: [acceptComment], labels: [{ name: 'review:human' }, { name: 'review:awaiting-advisory' }] }) });
    const fakeJudge = vi.fn(async (opts) => {
      expect(opts.evidence).toBe(FAKE_DIFF); // the judge actually receives the diff this time (#xconv1-evidence)
      return { verdict: 'accept', note: 'legitimate removal' };
    });
    const result = await dispatchConvertAdvisory(d, {
      repo: 'chalbert/web-everything', provider: p, runJudge: fakeJudge, fetchEvidence: fakeAvailableEvidence(),
    });
    expect(result.posted).toBe(true);
    expect(p.calls.postComment).toHaveLength(1);
    expect(p.calls.postComment[0].body).toContain('CONVERTED');
    expect(p.calls.setLabels).toHaveLength(1);
    expect(p.calls.setLabels[0].spec).toEqual({ add: 'advisory:accepted', remove: ['review:awaiting-advisory'] });
    expect(fakeJudge).toHaveBeenCalledTimes(1);
  });

  it('NO DIFF EVIDENCE AVAILABLE: answers `inconclusive` deterministically, NEVER calls the judge, and applies no advisory label (#xconv1-evidence — the #2766/#2767 root cause this closes)', async () => {
    const p = provider({ readPrState: () => ({ comments: [acceptComment], labels: [{ name: 'review:human' }] }) });
    const fakeJudge = vi.fn();
    const result = await dispatchConvertAdvisory(d, {
      repo: 'chalbert/web-everything', provider: p, runJudge: fakeJudge, fetchEvidence: fakeUnavailableEvidence(),
    });
    expect(fakeJudge).not.toHaveBeenCalled();
    expect(result.targetedCheckAnswer.verdict).toBe('inconclusive');
    expect(result.addLabel).toBeNull();
    expect(p.calls.setLabels).toHaveLength(0); // no add, and review:awaiting-advisory was never present here
    expect(result.body).toContain('**Advisory outcome:** `inconclusive`');
  });

  it('IDEMPOTENT: a head that already carries the converted note is a no-op — no post, no label write, no judge call, no evidence fetch', async () => {
    const already = renderConvertedAdvisoryNote({
      repo: 'chalbert/web-everything', pr: 2766, headSha: HEAD, acceptComment, escalation,
      targetedCheckAnswer: { verdict: 'accept', note: 'ok' },
    });
    expect(hasConvertedAdvisoryNote([{ body: already, author: { login: 'web-everything' } }], HEAD)).toBe(true);
    const p = provider({ readPrState: () => ({ comments: [{ body: already, author: { login: 'web-everything' } }], labels: [] }) });
    const fakeJudge = vi.fn();
    const fetchEvidence = vi.fn();
    const result = await dispatchConvertAdvisory(d, { repo: 'chalbert/web-everything', provider: p, runJudge: fakeJudge, fetchEvidence });
    expect(result.skipped).toBe('already-converted');
    expect(p.calls.postComment).toHaveLength(0);
    expect(p.calls.setLabels).toHaveLength(0);
    expect(fakeJudge).not.toHaveBeenCalled();
    expect(fetchEvidence).not.toHaveBeenCalled();
  });

  it('`force` bypasses the idempotency check — #xconv1-evidence\'s own "not by hand" repair path for a note that was produced with no evidence', async () => {
    const already = renderConvertedAdvisoryNote({
      repo: 'chalbert/web-everything', pr: 2766, headSha: HEAD, acceptComment, escalation,
      targetedCheckAnswer: { verdict: 'changes', note: 'no diff evidence to confirm the removed tests were legitimate' },
    });
    const p = provider({ readPrState: () => ({ comments: [{ body: already, author: { login: 'web-everything' } }], labels: [{ name: 'advisory:changes' }] }) });
    const fakeJudge = vi.fn(async () => ({ verdict: 'accept', note: 'confirmed legitimate — replaced by equivalent coverage' }));
    const result = await dispatchConvertAdvisory(d, {
      repo: 'chalbert/web-everything', provider: p, runJudge: fakeJudge, fetchEvidence: fakeAvailableEvidence(), force: true,
    });
    expect(result.skipped).toBeUndefined();
    expect(result.posted).toBe(true);
    expect(fakeJudge).toHaveBeenCalledTimes(1);
    expect(p.calls.setLabels[0].spec).toEqual({ add: 'advisory:accepted', remove: ['advisory:changes'] });
  });

  it('dryRun computes the exact plan with no gh write, no real judge spawn, and no real evidence fetch (all injected fakes)', async () => {
    const p = provider();
    const fakeJudge = vi.fn(async () => ({ verdict: 'accept', note: 'legitimate removal' }));
    const result = await dispatchConvertAdvisory(d, {
      repo: 'chalbert/web-everything', provider: p, runJudge: fakeJudge, fetchEvidence: fakeAvailableEvidence(), dryRun: true,
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
    const result = await dispatchConvertAdvisory(d, {
      repo: 'chalbert/web-everything', provider: p, runJudge: fakeJudge, fetchEvidence: fakeAvailableEvidence(),
    });
    expect(p.calls.setLabels[0].spec).toEqual({ add: 'advisory:changes', remove: [] });
    expect(result.body).toContain('tests were weakened, not replaced');
  });

  it('with no shared read handed in, fetches fresh PR state exactly once', async () => {
    const p = provider({ readPrState: () => ({ comments: [acceptComment], labels: [] }) });
    const fakeJudge = vi.fn(async () => ({ verdict: 'accept', note: 'ok' }));
    await dispatchConvertAdvisory(d, {
      repo: 'chalbert/web-everything', provider: p, runJudge: fakeJudge, fetchEvidence: fakeAvailableEvidence(),
    });
    expect(p.calls.readPrState).toHaveLength(1);
  });
});
