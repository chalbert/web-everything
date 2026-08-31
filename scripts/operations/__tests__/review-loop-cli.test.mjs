/**
 * @file review-loop-cli.test.mjs — #3072's remaining slice, exercised end to end with no `gh`, no juror
 * subprocess and no real learnings-pool file: a stub `readPr`, a canned judge, recording sinks, an in-memory
 * run store and an injected `appendLearning`.
 *
 * THE THREE PROPERTIES THIS FILE EXISTS TO PIN:
 *   1. A clean (or already-agreeing) verdict on a non-gate-self PR QUEUES — it never records `accepted`
 *      unattended, and it FILES the notification so a human finds out.
 *   2. A verdict carrying findings BOUNCES unattended (`changes`, effects applied, run completes) — the round
 *      the operator's automated fix-loop already expects.
 *   3. A gate-self (`review:human`) PR is UNCHANGED: the policy declines (wrong actor), the run parks exactly
 *      as it does for the ordinary human CLI, and nothing is queued (queuing is an ACCEPT-only concept).
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
  it('on a queued-accept stop, --json still carries run.verdict.loop unmodified, plus the queue fields', async () => {
    const { declaration, registry } = registryFor({});
    const store = createMemoryRunStore();
    const out = await runReviewLoopOnce({
      declaration, registry, argv: [...BASE_ARGV, '--json'], store, sinks: recordingSinks([]),
      makeJudge: cannedJudge(CLEAN_ANSWER), mintRunId: () => 'r-json-queued',
      appendLearning: () => ({ record: {}, path: '/fake/path.jsonl' }),
    });
    expect(out.code).toBe(0);
    const payload = JSON.parse(out.lines[0]);
    expect(payload.verdict.loop).toEqual({ outcome: 'converged', round: 1, cap: 5, why: 'accepted at round 1' });
    expect(payload.queued).toBe('accept-needs-human');
    expect(payload.resumeCommand).toContain('--answer=accept');
    expect(payload.filedTo).toBe('/fake/path.jsonl');
  });

  it('on a queued-accept stop where filing failed, --json still carries the loop AND the filingError', async () => {
    const { declaration, registry } = registryFor({});
    const store = createMemoryRunStore();
    const out = await runReviewLoopOnce({
      declaration, registry, argv: [...BASE_ARGV, '--json'], store, sinks: recordingSinks([]),
      makeJudge: cannedJudge(CLEAN_ANSWER), mintRunId: () => 'r-json-queued-fail',
      appendLearning: () => { throw new Error('disk full'); },
    });
    expect(out.code).toBe(1);
    const payload = JSON.parse(out.lines[0]);
    expect(payload.verdict.loop.outcome).toBe('converged');
    expect(payload.filingError).toBe('disk full');
    expect(payload.filedTo).toBeNull();
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

describe('runReviewLoopOnce — property 1: a clean verdict QUEUES, never auto-accepts', () => {
  it('files the learnings-pool notice and reports QUEUED, without ever answering accept', async () => {
    const { declaration, registry } = registryFor({});
    const store = createMemoryRunStore();
    const seen = [];
    const filed = [];
    const out = await runReviewLoopOnce({
      declaration, registry, argv: BASE_ARGV, store, sinks: recordingSinks(seen),
      makeJudge: cannedJudge(CLEAN_ANSWER), mintRunId: () => 'r-clean',
      appendLearning: (entry, opts) => { filed.push({ entry, opts }); return { record: entry, path: '/fake/pool/file.jsonl' }; },
    });

    expect(out.code).toBe(0);
    expect(out.stopped).toBe('confirm');
    expect(out.lines.join('\n')).toMatch(/QUEUED for a human/);
    expect(out.lines.join('\n')).toMatch(/--answer=accept/);
    // NOTHING was applied — no comment, no label swap, no ledger row. The run stayed suspended.
    expect(seen).toHaveLength(0);
    expect(out.run.findings.confirm).toBeUndefined();

    // The filed entry itself — the notification a human actually reads.
    expect(filed).toHaveLength(1);
    expect(filed[0].entry.kind).toBe('friction');
    expect(filed[0].entry.summary).toContain('chalbert/web-everything#1234');
    expect(filed[0].entry.suggestion).toContain('--answer=accept');
  });

  it('reports the filing failure loudly rather than silently losing the notice', async () => {
    const { declaration, registry } = registryFor({});
    const store = createMemoryRunStore();
    const out = await runReviewLoopOnce({
      declaration, registry, argv: BASE_ARGV, store, sinks: recordingSinks([]),
      makeJudge: cannedJudge(CLEAN_ANSWER), mintRunId: () => 'r-filing-fails',
      appendLearning: () => { throw new Error('pool file is not writable'); },
    });
    expect(out.code).toBe(1);
    expect(out.lines.join('\n')).toMatch(/FAILED to file the learnings-pool notice/);
    expect(out.lines.join('\n')).toMatch(/pool file is not writable/);
    // Still queued, not lost: the resume command is still printed so a human can act anyway.
    expect(out.lines.join('\n')).toMatch(/--answer=accept/);
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
  it('a human resuming with --answer=accept on a first-round run records it (unattended path never runs twice)', async () => {
    const { declaration, registry } = registryFor({});
    const store = createMemoryRunStore();
    const seen = [];
    const opened = await runReviewLoopOnce({
      declaration, registry, argv: BASE_ARGV, store, sinks: recordingSinks(seen),
      makeJudge: cannedJudge(CLEAN_ANSWER), mintRunId: () => 'r-explicit',
      appendLearning: () => ({ record: {}, path: '' }),
    });
    expect(opened.stopped).toBe('confirm'); // queued, unattended

    // A HUMAN now clears it by hand, on their own time — exactly the resume command the queue printed.
    const resumed = await runReviewLoopOnce({
      declaration, registry, argv: ['--resume=r-explicit', '--answer=accept'], store, sinks: recordingSinks(seen),
      makeJudge: cannedJudge(CLEAN_ANSWER), mintRunId: () => 'unused',
    });
    expect(resumed.stopped).toBe('complete');
    expect(resumed.run.findings.confirm).toBe('accept');
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
