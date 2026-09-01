/**
 * @file review-loop-cli.test.mjs — #3072's remaining slice, exercised end to end with no `gh`, no juror
 * subprocess and no real learnings-pool file: a stub `readPr`, a canned judge, recording sinks, an in-memory
 * run store and an injected `appendLearning`.
 *
 * THE THREE PROPERTIES THIS FILE EXISTS TO PIN (#3434, 2026-09-01, reverses property 1's old shape — it used
 * to say "queues, never auto-accepts"; the operator's live-fire finding, two real PRs sitting queued for no
 * reason, is what prompted the reversal):
 *   1. A clean (or already-agreeing) verdict on a non-gate-self PR ACCEPTS MECHANICALLY — the effects apply,
 *      the run completes, and nothing is queued for a human (the old queue-and-notify path is now dead for
 *      this tier; the learnings-pool filing machinery it used stays for `review:human`'s own, unchanged, park).
 *   2. A verdict carrying findings BOUNCES unattended (`changes`, effects applied, run completes) — the round
 *      the operator's automated fix-loop already expects.
 *   3. A gate-self (`review:human`) PR is UNCHANGED: the policy declines (wrong actor), the run parks exactly
 *      as it does for the ordinary human CLI, and no accept — mechanical or manual — happens without one.
 */

import { describe, it, expect } from 'vitest';

import { createRegistry } from '../registry.mjs';
import { createMemoryRunStore } from '../run-store.mjs';
import { judgeOutcome } from '../cli-adapter.mjs';
import { REVIEW_EFFECTS, reviewPrOperation } from '../review-pr.mjs';
import { runReviewLoopOnce } from '../review-loop-cli.mjs';

const NET_PATHS = ['scripts/operations/review-pr.mjs'];

/** The same stub-reader shape `review-pr.test.mjs` uses, trimmed to what this file needs. */
function stubReader({ labels = ['review:pending'] } = {}) {
  return ({ pr, repo }) => ({
    state: 'OPEN',
    clearerId: undefined,
    createdAt: '',
    detail: {
      pr, repo, title: 'a parked PR', url: `https://example.invalid/${pr}`,
      labels,
      humanRequired: labels.includes('review:human'),
      reviewClass: labels.includes('review:human') ? 'human' : 'pending',
      disposition: { mode: 'converge', autoLand: false },
      escalationReason: ['gate-self'],
      advisoryComment: null,
      humanComment: null,
      diffStat: NET_PATHS.map((p) => ({ path: p, additions: 1, deletions: 0 })),
    },
    headRefName: 'lane/thing',
    body: 'the PR description',
    net: { paths: NET_PATHS, base: 'abc123', rev: 'def456', scored: true },
    diff: { text: '--- a/x\n+++ b/x\n+one line\n', scored: true },
  });
}

function registryFor(readerOptions) {
  const declaration = reviewPrOperation({ readPr: stubReader(readerOptions) });
  const registry = createRegistry();
  registry.register(declaration);
  return { declaration, registry };
}

/** Recording sinks for every declared effect — no gh, no ledger, no disk. */
function recordingSinks(seen) {
  return Object.fromEntries(
    Object.values(REVIEW_EFFECTS).map((t) => [t, async (payload) => { seen.push({ type: t, payload }); return { ok: true }; }]),
  );
}

const CLEAN_ANSWER = { summary: 'nothing blocking', findings: [] };
const BLOCKING_ANSWER = {
  summary: 'one blocker',
  findings: [{ summary: 'the guard is inverted', file: NET_PATHS[0], disposition: 'blocker' }],
};

const cannedJudge = (answer) => () => async () => judgeOutcome(answer, {});

const BASE_ARGV = ['--pr=1234', '--repo=chalbert/web-everything'];

describe('runReviewLoopOnce — the loop field (converged/in-progress/exhausted/escalated) survives --json on EVERY stop', () => {
  it('on a mechanically-accepted stop, --json carries run.verdict.loop unmodified, no queue fields at all — #3434', async () => {
    const { declaration, registry } = registryFor({});
    const store = createMemoryRunStore();
    const out = await runReviewLoopOnce({
      declaration, registry, argv: [...BASE_ARGV, '--json'], store, sinks: recordingSinks([]),
      makeJudge: cannedJudge(CLEAN_ANSWER), mintRunId: () => 'r-json-accept',
      appendLearning: () => { throw new Error('must not be called — nothing to file when accept lands mechanically'); },
    });
    expect(out.code).toBe(0);
    const payload = JSON.parse(out.lines[0]);
    expect(payload.verdict.loop).toEqual({ outcome: 'converged', round: 1, cap: 5, why: 'accepted at round 1' });
    expect(payload).not.toHaveProperty('queued');
    expect(payload).not.toHaveProperty('resumeCommand');
    expect(payload).not.toHaveProperty('filedTo');
  });

  it('on a bounced (changes) stop, --json carries the loop via the ordinary renderOutcome path', async () => {
    const { declaration, registry } = registryFor({});
    const store = createMemoryRunStore();
    const out = await runReviewLoopOnce({
      declaration, registry, argv: [...BASE_ARGV, '--json'], store, sinks: recordingSinks([]),
      makeJudge: cannedJudge(BLOCKING_ANSWER), mintRunId: () => 'r-json-bounce',
    });
    const payload = JSON.parse(out.lines[0]);
    expect(payload.verdict.loop).toEqual({ outcome: 'in-progress', round: 1, cap: 5, why: 'round 1 of 5 returned `changes`' });
  });
});

describe('runReviewLoopOnce — property 1: a clean verdict on review:pending ACCEPTS MECHANICALLY (#3434)', () => {
  it('applies the effects, completes the run, and never files a learnings-pool notice', async () => {
    const { declaration, registry } = registryFor({});
    const store = createMemoryRunStore();
    const seen = [];
    const out = await runReviewLoopOnce({
      declaration, registry, argv: BASE_ARGV, store, sinks: recordingSinks(seen),
      makeJudge: cannedJudge(CLEAN_ANSWER), mintRunId: () => 'r-clean',
      appendLearning: () => { throw new Error('must not be called — nothing to file when accept lands mechanically'); },
    });

    expect(out.code).toBe(0);
    expect(out.stopped).toBe('complete');
    expect(out.run.findings.confirm).toBe('accept');
    // The SAME effect application a bounce gets — a label swap lands, this time to accepted, not parked.
    expect(seen.map((s) => s.type)).toContain(REVIEW_EFFECTS.LABEL);
    expect(out.lines.join('\n')).not.toMatch(/QUEUED for a human/);
  });

  it('names the round-cap outcome in its text output, same shape a bounce gets', async () => {
    const { declaration, registry } = registryFor({});
    const store = createMemoryRunStore();
    const out = await runReviewLoopOnce({
      declaration, registry, argv: BASE_ARGV, store, sinks: recordingSinks([]),
      makeJudge: cannedJudge(CLEAN_ANSWER), mintRunId: () => 'r-clean-loop-line',
      appendLearning: () => { throw new Error('must not be called'); },
    });
    expect(out.lines.join('\n')).toMatch(/review loop: converged — accepted at round 1/);
  });
});

describe('runReviewLoopOnce — property 2: findings BOUNCE unattended, and the run completes', () => {
  it('auto-answers `changes`, applies the effects, and never touches the learnings pool', async () => {
    const { declaration, registry } = registryFor({});
    const store = createMemoryRunStore();
    const seen = [];
    let filedCount = 0;
    const out = await runReviewLoopOnce({
      declaration, registry, argv: BASE_ARGV, store, sinks: recordingSinks(seen),
      makeJudge: cannedJudge(BLOCKING_ANSWER), mintRunId: () => 'r-bounce',
      appendLearning: () => { filedCount += 1; return { record: {}, path: '' }; },
    });
    expect(out.stopped).toBe('complete');
    expect(out.code).toBe(0);
    expect(out.run.findings.confirm).toBe('changes');
    expect(seen.map((s) => s.type)).toContain(REVIEW_EFFECTS.LABEL);
    expect(filedCount).toBe(0);
  });

  it('names the round-cap outcome in its text output', async () => {
    const { declaration, registry } = registryFor({});
    const store = createMemoryRunStore();
    const out = await runReviewLoopOnce({
      declaration, registry, argv: BASE_ARGV, store, sinks: recordingSinks([]),
      makeJudge: cannedJudge(BLOCKING_ANSWER), mintRunId: () => 'r-loop-line',
    });
    expect(out.lines.join('\n')).toMatch(/review loop: in-progress — round 1 of 5/);
  });
});

describe('runReviewLoopOnce — property 3: a gate-self PR is UNCHANGED', () => {
  it('parks exactly as the human CLI would — declines (wrong actor), files nothing, no accept anywhere', async () => {
    const { declaration, registry } = registryFor({ labels: ['review:human'] });
    const store = createMemoryRunStore();
    let filedCount = 0;
    const out = await runReviewLoopOnce({
      declaration, registry, argv: BASE_ARGV, store, sinks: recordingSinks([]),
      makeJudge: cannedJudge(CLEAN_ANSWER), mintRunId: () => 'r-human',
      appendLearning: () => { filedCount += 1; return { record: {}, path: '' }; },
    });
    expect(out.stopped).toBe('confirm');
    expect(out.run.pending.of).toBe('human');
    expect(out.lines.join('\n')).not.toMatch(/QUEUED/);
    expect(filedCount).toBe(0);
  });
});

describe('runReviewLoopOnce — an explicit --resume --answer still works, exactly like the human CLI', () => {
  it('a human resuming a PARKED review:human run with --answer=changes records it — parking itself is UNCHANGED by #3434', async () => {
    // Uses `changes`, not `accept`: clearing a gate-self PR's own accept has a SEPARATE independence guard
    // (unrelated to #3434, untouched by it) that this synthetic stub reader does not satisfy — out of scope
    // here. The property this test exists to pin is narrower and still holds: `review:human` still parks
    // (wrong actor) exactly as before, and the general `--resume=<id> --answer=<x>` mechanism still works.
    const { declaration, registry } = registryFor({ labels: ['review:human'] });
    const store = createMemoryRunStore();
    const seen = [];
    // BLOCKING_ANSWER (real findings), not CLEAN_ANSWER: `record`'s own reasonless-bounce guard refuses a
    // `changes` answer with zero findings behind it (see review-pr.mjs), which is orthogonal to this test's
    // actual property (that review:human still parks and a resume still clears it) — a zero-finding verdict
    // would trip that unrelated guard on resume regardless of #3434.
    const opened = await runReviewLoopOnce({
      declaration, registry, argv: BASE_ARGV, store, sinks: recordingSinks(seen),
      makeJudge: cannedJudge(BLOCKING_ANSWER), mintRunId: () => 'r-explicit',
    });
    expect(opened.stopped).toBe('confirm'); // parked — wrong actor (human-addressed), unchanged by #3434

    const resumed = await runReviewLoopOnce({
      declaration, registry, argv: ['--resume=r-explicit', '--answer=changes'], store, sinks: recordingSinks(seen),
      makeJudge: cannedJudge(BLOCKING_ANSWER), mintRunId: () => 'unused',
    });
    expect(resumed.stopped).toBe('complete');
    expect(resumed.run.findings.confirm).toBe('changes');
    expect(seen.map((s) => s.type)).toContain(REVIEW_EFFECTS.LABEL);
  });
});

describe('runReviewLoopOnce — parse refusals still work, same as the human CLI', () => {
  it('refuses an unknown flag before starting a run', async () => {
    const { declaration, registry } = registryFor({});
    const store = createMemoryRunStore();
    const out = await runReviewLoopOnce({
      declaration, registry, argv: ['--bogus=1'], store, sinks: {}, makeJudge: () => async () => { throw new Error('never'); }, mintRunId: () => 'unused',
    });
    expect(out.code).toBe(2);
    expect(out.stopped).toBe('refused');
    expect(out.lines.join('\n')).toMatch(/unknown flag --bogus/);
  });

  it('prints --help without starting a run', async () => {
    const { declaration, registry } = registryFor({});
    const store = createMemoryRunStore();
    const out = await runReviewLoopOnce({
      declaration, registry, argv: ['--help'], store, sinks: {}, makeJudge: () => async () => { throw new Error('never'); }, mintRunId: () => 'unused',
    });
    expect(out.code).toBe(0);
    expect(out.stopped).toBe('help');
  });
});
