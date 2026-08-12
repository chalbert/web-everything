/**
 * @file review-pr.test.mjs — the `review-pr` declaration and its derived command line (#3035).
 *
 * THE TWO TESTS THE ITEM EXISTS FOR are the two invariants, and neither is asserted by inspection:
 *
 *   1. **THE NET BASIS.** The `read` step's finding hands `buildPanelMandate` the NET changed-file list and
 *      never `gh`'s three-dot stat — proven by driving a run whose stub reader returns DELIBERATELY DIFFERENT
 *      lists for the two, and asserting which one reaches the juror's mandate. An `exec-contract` miss REFUSES
 *      rather than falling back, which is the skill rule (#2952) as machinery.
 *   2. **THE GATE-SELF REFUSAL.** A `review:human` PR driven all the way to a `confirm` answer of `accept` is
 *      REFUSED by `decideSetLabel` in the pure core, declares NO effects, and therefore cannot reach
 *      `review:accepted` through this caller any more than through the hand-written one.
 *
 * Plus the replay property the card names: a `record` step whose second effect fails does not re-post the
 * comment on replay.
 *
 * NOTHING HERE SPAWNS A PROCESS OR TOUCHES `gh`: the reader is a stub, the judge is a canned answer, the sinks
 * are recorders, and the store is in memory.
 */

import { describe, it, expect } from 'vitest';

import { advance, advanceWhileRunning, runStatus, startRun } from '../engine.mjs';
import { applyPendingEffects } from '../effect-executor.mjs';
import { createRegistry } from '../registry.mjs';
import { createMemoryRunStore } from '../run-store.mjs';
import {
  driveRun, parseOperationArgv, buildCliSpec, assertSafeJudgeRequest, runOperationCli, judgeOutcome,
} from '../cli-adapter.mjs';
import {
  CONFIRM_ACTORS,
  PANEL_LENSES,
  REVIEW_EFFECTS,
  REVIEW_PR_CHANNEL,
  REVIEW_PR_OP,
  renderJudgeInput,
  renderVerdictWriteUp,
  reviewPrOperation,
  shapeReadFinding,
  REVIEW_JUROR_TOOLS,
} from '../review-pr.mjs';
import { buildJudgeArgv, deriveSessionId } from '../../lib/judge-spawn.mjs';

/** The NET file list, and a DIFFERENT `gh` file list, so "which one reached the juror" is decidable. */
const NET_PATHS = ['scripts/operations/review-pr.mjs', 'skills-src/review/SKILL.md'];
const GH_ONLY_PATH = 'a-sibling-lane-file-that-already-landed.md';

/** A stub `readPr`. `labels` decides gate-self; `netReason` forces an unscored basis. */
function stubReader({ labels = ['review:pending'], netScored = true, netReason = undefined } = {}) {
  return ({ pr, repo }) => ({
    detail: {
      pr, repo, title: 'a parked PR', url: `https://example.invalid/${pr}`,
      labels,
      humanRequired: labels.includes('review:human'),
      reviewClass: labels.includes('review:human') ? 'human' : 'pending',
      disposition: { mode: 'converge', autoLand: false },
      escalationReason: ['gate-self'],
      advisoryComment: null,
      humanComment: null,
      // `gh`'s own list — deliberately DISJOINT from the net list.
      diffStat: [...NET_PATHS, GH_ONLY_PATH].map((p) => ({ path: p, additions: 1, deletions: 0 })),
    },
    headRefName: 'lane/thing',
    body: 'the PR description',
    net: netScored
      ? { paths: NET_PATHS, base: 'abc123', rev: 'def456', scored: true }
      : { paths: [], base: null, rev: null, scored: false, reason: netReason },
    diff: netScored ? { text: '--- a/x\n+++ b/x\n+one line\n', scored: true } : { text: '', scored: false, reason: netReason },
  });
}

/** A registry holding one freshly-built declaration over a stub reader. */
function registryFor(readerOptions) {
  const declaration = reviewPrOperation({ readPr: stubReader(readerOptions) });
  const registry = createRegistry();
  registry.register(declaration);
  return { declaration, registry };
}

/** A canned juror answer — one blocking finding, or none. */
const CLEAN_ANSWER = { summary: 'nothing blocking', findings: [] };
const BLOCKING_ANSWER = {
  summary: 'one blocker',
  findings: [{ summary: 'the guard is inverted', file: NET_PATHS[0], disposition: 'blocker' }],
};

/** Drive a run to its `confirm` suspend with a canned juror answer. */
function atConfirm({ registry, input, answer = CLEAN_ANSWER, id = 'run-rp' }) {
  let run = advanceWhileRunning(startRun({ op: REVIEW_PR_OP, id, input, registry }), { registry });
  expect(runStatus(run, { registry })).toBe('awaiting-judge');
  const request = run.pending.request;
  run = advanceWhileRunning(run, { registry, resume: { value: answer } });
  expect(runStatus(run, { registry })).toBe('awaiting-confirm');
  return { run, request };
}

const BASE_INPUT = { pr: 1234, repo: 'chalbert/web-everything' };

// ── PROPERTY 1: THE DIFF ARRIVES ON THE NET BASIS ─────────────────────────────────────────────────────────
describe('the net basis', () => {
  it('yields NET paths as ground truth and keeps `gh`\'s stat separate and unused by the juror', () => {
    const { registry } = registryFor({});
    const { run, request } = atConfirm({ registry, input: BASE_INPUT });

    const read = run.findings.read;
    expect(read.netChangedFiles).toEqual(NET_PATHS);
    // `gh`'s list is carried, is DIFFERENT, and is named apart.
    expect(read.ghDiffStat.map((f) => f.path)).toContain(GH_ONLY_PATH);
    expect(read.netChangedFiles).not.toContain(GH_ONLY_PATH);

    // THE ASSERTION THAT MATTERS: the mandate states the NET set as GROUND TRUTH and never names the gh-only file.
    expect(request.mandate).toContain(`the NET changed-file set of this PR vs CURRENT main is exactly: ${NET_PATHS.join(', ')}`);
    expect(request.mandate).not.toContain(GH_ONLY_PATH);
    // …and neither does the material the juror is handed.
    expect(request.input).toContain(NET_PATHS[0]);
    expect(request.input).not.toContain(GH_ONLY_PATH);
  });

  it('REFUSES an `exec-contract` miss instead of falling back to the three-dot diff', () => {
    const { registry } = registryFor({ netScored: false, netReason: 'exec-contract' });
    expect(() => advanceWhileRunning(startRun({ op: REVIEW_PR_OP, id: 'run-exec', input: BASE_INPUT, registry }), { registry }))
      .toThrow(/exec-contract/);
  });

  it('DEGRADES (and says so) on a `ref-unresolved` miss, which is genuinely unfixable from here', () => {
    const { registry } = registryFor({ netScored: false, netReason: 'ref-unresolved' });
    const { run } = atConfirm({ registry, input: BASE_INPUT, id: 'run-ref' });
    expect(run.findings.read.degraded).toBe(true);
    expect(run.findings.read.degradedReason).toBe('ref-unresolved');
  });

  it('`shapeReadFinding` never lets `gh`\'s stat masquerade as the net list', () => {
    const shaped = shapeReadFinding(stubReader({})({ pr: 1, repo: 'o/n' }), { pr: 1, repo: 'o/n' });
    expect(shaped.netChangedFiles).toEqual(NET_PATHS);
    expect(renderJudgeInput(shaped)).not.toContain(GH_ONLY_PATH);
  });
});

// ── PROPERTY 2: THE GATE-SELF REFUSAL LIVES IN THE PURE CORE ──────────────────────────────────────────────
describe('the gate-self invariant', () => {
  it('reduces a `review:human` PR to `needs-human` however clean the findings are', () => {
    const { registry } = registryFor({ labels: ['review:human'] });
    const { run } = atConfirm({ registry, input: BASE_INPUT, answer: CLEAN_ANSWER, id: 'run-gs1' });
    expect(run.verdict.humanRequired).toBe(true);
    expect(run.verdict.verdict).toBe('needs-human');
    expect(run.verdict.findings).toEqual([]);
  });

  it('records the decision as owed by a HUMAN on a gate-self PR and by an AGENT otherwise', () => {
    const gateSelf = registryFor({ labels: ['review:human'] });
    expect(atConfirm({ registry: gateSelf.registry, input: BASE_INPUT, id: 'run-gs2' }).run.pending.of)
      .toBe(CONFIRM_ACTORS.HUMAN);

    const ordinary = registryFor({ labels: ['review:pending'] });
    expect(atConfirm({ registry: ordinary.registry, input: BASE_INPUT, id: 'run-gs3' }).run.pending.of)
      .toBe(CONFIRM_ACTORS.AGENT);
  });

  it('REFUSES to declare any effect when the operator answers `accept` on a gate-self PR', () => {
    const { registry } = registryFor({ labels: ['review:human'] });
    const { run } = atConfirm({ registry, input: BASE_INPUT, id: 'run-gs4' });

    // The operator tries to accept it anyway — the exact thing INVARIANT 2 exists to stop.
    const answered = advance(run, { registry, resume: { value: 'accept' } });
    expect(answered.findings.confirm).toBe('accept');

    let thrown = null;
    try { advance(answered, { registry }); } catch (e) { thrown = e; }
    expect(thrown).toBeTruthy();
    expect(String(thrown.message)).toMatch(/gate-self: review:human is human-ceremony-only/);
    expect(String(thrown.message)).toMatch(/decideSetLabel/);
    // NOTHING was declared, so there is nothing to apply and nothing half-done.
    expect(answered.effects).toEqual([]);
  });

  it('still allows a `changes` bounce on a gate-self PR — a bounce lands nothing', () => {
    const { registry } = registryFor({ labels: ['review:human'] });
    const { run } = atConfirm({ registry, input: BASE_INPUT, answer: BLOCKING_ANSWER, id: 'run-gs5' });
    const answered = advance(run, { registry, resume: { value: 'changes' } });
    const declared = advance(answered, { registry });
    const types = declared.effects.map((e) => e.type);
    expect(types).toEqual([REVIEW_EFFECTS.WRITE_UP, REVIEW_EFFECTS.LABEL, REVIEW_EFFECTS.LEDGER, REVIEW_EFFECTS.NOTICE]);
    const label = declared.effects.find((e) => e.type === REVIEW_EFFECTS.LABEL);
    expect(label.payload.to).toBe('changes');
    // A bounce never removes the human gate.
    expect(label.payload.removeLabels).not.toContain('review:human');
  });
});

// ── THE DECLARED EFFECTS: ORDER, IDEMPOTENCY, AND REPLAY ──────────────────────────────────────────────────
describe('the record step', () => {
  it('declares the four effects in the safe order, with the classification each was given', () => {
    const { registry } = registryFor({});
    const { run } = atConfirm({ registry, input: BASE_INPUT, id: 'run-eff' });
    const declared = advance(advance(run, { registry, resume: { value: 'accept' } }), { registry });

    expect(declared.effects.map((e) => [e.index, e.type, e.idempotent])).toEqual([
      [0, REVIEW_EFFECTS.WRITE_UP, true],   // local, deterministic bytes → safe to redo
      [1, REVIEW_EFFECTS.LABEL, false],     // posts a durable comment → never replayed on a guess
      [2, REVIEW_EFFECTS.LEDGER, false],    // #3007 Phase 1 writes in SHADOW; the flag stays fail-closed
      [3, REVIEW_EFFECTS.NOTICE, true],     // reports only → a duplicate line is the whole cost
    ]);
    // The remote write is never first, and the ledger row never precedes the label it vouches for.
    expect(declared.effects[1].payload.addLabel).toBe('review:accepted');
  });

  it('`abstain` declares ZERO effects and completes the run without writing anything', () => {
    const { registry } = registryFor({});
    const { run } = atConfirm({ registry, input: BASE_INPUT, id: 'run-abs' });
    const done = advanceWhileRunning(run, { registry, resume: { value: 'abstain' } });
    expect(done.effects).toEqual([]);
    expect(runStatus(done, { registry })).toBe('complete');
  });

  it('a replayed `record` step posts NO duplicate comment', async () => {
    const { registry } = registryFor({});
    const { run } = atConfirm({ registry, input: BASE_INPUT, id: 'run-replay' });
    const declared = advance(advance(run, { registry, resume: { value: 'accept' } }), { registry });

    const store = createMemoryRunStore();
    store.write(declared);
    const calls = [];
    const sinkFor = (type, behaviour = () => ({ ok: true })) => async (payload, ctx) => {
      calls.push({ type, key: ctx.key });
      return behaviour(payload, ctx);
    };
    // The LEDGER row fails the first time — AFTER the comment+label effect landed. That is #2964's half-done
    // state, and the replay must finish the act rather than restart it.
    let ledgerAttempts = 0;
    const sinks = {
      [REVIEW_EFFECTS.WRITE_UP]: sinkFor(REVIEW_EFFECTS.WRITE_UP),
      [REVIEW_EFFECTS.LABEL]: sinkFor(REVIEW_EFFECTS.LABEL),
      [REVIEW_EFFECTS.LEDGER]: sinkFor(REVIEW_EFFECTS.LEDGER, () => {
        ledgerAttempts += 1;
        if (ledgerAttempts === 1) throw Object.assign(new Error('ledger unavailable'), { notApplied: true });
        return { ok: true };
      }),
      [REVIEW_EFFECTS.NOTICE]: sinkFor(REVIEW_EFFECTS.NOTICE),
    };

    const first = await applyPendingEffects(declared, { sinks, store });
    expect(first.error).toBeTruthy();
    expect(first.applied).toEqual(['run-replay#4#0', 'run-replay#4#1']);

    const second = await applyPendingEffects(first.run, { sinks, store });
    expect(second.error).toBeNull();
    // THE ASSERTION: the label/comment sink ran exactly ONCE across both passes.
    expect(calls.filter((c) => c.type === REVIEW_EFFECTS.LABEL)).toHaveLength(1);
    expect(calls.filter((c) => c.type === REVIEW_EFFECTS.WRITE_UP)).toHaveLength(1);
    expect(second.skipped).toEqual(['run-replay#4#0', 'run-replay#4#1']);
  });

  it('REFUSES to replay the label effect when its outcome is unknown', async () => {
    const { registry } = registryFor({});
    const { run } = atConfirm({ registry, input: BASE_INPUT, id: 'run-indet' });
    const declared = advance(advance(run, { registry, resume: { value: 'accept' } }), { registry });
    const store = createMemoryRunStore();
    store.write(declared);
    const sinks = {
      [REVIEW_EFFECTS.WRITE_UP]: async () => ({ ok: true }),
      // A plain throw = INDETERMINATE: the single home may already have posted the comment.
      [REVIEW_EFFECTS.LABEL]: async () => { throw new Error('gh timed out'); },
      [REVIEW_EFFECTS.LEDGER]: async () => ({ ok: true }),
      [REVIEW_EFFECTS.NOTICE]: async () => ({ ok: true }),
    };
    const first = await applyPendingEffects(declared, { sinks, store });
    expect(first.error).toBeTruthy();
    await expect(applyPendingEffects(first.run, { sinks, store })).rejects.toThrow(/outcome is UNKNOWN/);
  });
});

// ── THE DERIVED COMMAND LINE ──────────────────────────────────────────────────────────────────────────────
describe('the derived command line', () => {
  const { declaration, registry } = registryFor({});

  it('derives its flags and usage from the declaration, not from a hand-written parser', () => {
    const spec = buildCliSpec(declaration);
    expect(spec.fields.map((f) => f.name).sort()).toEqual(['actor', 'lens', 'pr', 'repo']);
    expect(spec.usage).toContain('--pr=<number>');
    // THE LENSES ARE NAMED, NOT TYPED. `[--lens=<string>]` told the operator nothing they could act on while
    // the four valid values sat in the declaration unread — asserted against `PANEL_LENSES` itself so a fifth
    // lens shows up in `--help` the moment it is declared, with no second list to remember.
    expect(spec.usage).toContain(`[--lens=${PANEL_LENSES.join('|')}, default correctness]`);
    expect(spec.usage).not.toContain('--lens=<string>');
    expect(spec.usage).toContain('read(compute) → judge(judge) → reduce(compute) → confirm(confirm) → record(effect)');
  });

  it('refuses an unknown flag and a missing required one', () => {
    expect(parseOperationArgv(declaration, ['--pr=1', '--repo=o/n', '--force']).errors.join(' ')).toMatch(/unknown flag --force/);
    expect(parseOperationArgv(declaration, ['--pr=1']).errors.join(' ')).toMatch(/missing required input field `repo`/);
  });

  it('REFUSES an --answer that is not attached to a suspended run — the stop point, as arithmetic', () => {
    expect(parseOperationArgv(declaration, ['--pr=1', '--repo=o/n', '--answer=accept']).errors.join(' '))
      .toMatch(/--answer requires --resume/);
  });

  it('stops at the confirm suspend on the first invocation and records on the second', async () => {
    const store = createMemoryRunStore();
    const applied = [];
    const sinks = Object.fromEntries(Object.values(REVIEW_EFFECTS).map((t) => [t, async () => { applied.push(t); return { ok: true }; }]));
    const judge = async () => CLEAN_ANSWER;

    const first = await runOperationCli({
      declaration, registry, store, sinks, judge,
      argv: ['--pr=1234', '--repo=chalbert/web-everything'],
      newRunId: () => 'run-cli',
    });
    expect(first.stopped).toBe('confirm');
    expect(first.code).toBe(0);
    expect(applied).toEqual([]);            // NOTHING was written at the stop point.
    expect(first.lines.join('\n')).toContain('awaiting a decision from: agent');

    const second = await runOperationCli({
      declaration, registry, store, sinks, judge,
      argv: ['--resume=run-cli', '--answer=accept'],
      newRunId: () => 'unused',
    });
    expect(second.stopped).toBe('complete');
    expect(applied).toEqual(Object.values(REVIEW_EFFECTS));
  });

  it('refuses an --answer outside the declared option set', async () => {
    const store = createMemoryRunStore();
    const judge = async () => CLEAN_ANSWER;
    const sinks = Object.fromEntries(Object.values(REVIEW_EFFECTS).map((t) => [t, async () => ({ ok: true })]));
    await runOperationCli({
      declaration, registry, store, sinks, judge,
      argv: ['--pr=1234', '--repo=chalbert/web-everything'], newRunId: () => 'run-opt',
    });
    await expect(runOperationCli({
      declaration, registry, store, sinks, judge,
      argv: ['--resume=run-opt', '--answer=merge-it'], newRunId: () => 'x',
    })).rejects.toThrow(/accepts only/);
  });
});

// ── WHAT THE FIRST LIVE RUN (PR #1146) EXPOSED ────────────────────────────────────────────────────────────
// Four defects, none of which a stub-driven suite could have caught by inspection, all four now pinned.

describe('the juror\'s cost survives the run (the adapter used to drop it)', () => {
  /** A judge that reports what a real `judgeSpawn` reports, through the adapter's own envelope. */
  const meteredJudge = async () => judgeOutcome(CLEAN_ANSWER, {
    costUsd: 0.0421, durationMs: 8123, wallMs: 8400, numTurns: 1, stopReason: 'end_turn',
    sessionId: '11111111-2222-3333-4444-555555555555', loadedContextTokens: 51234,
    usage: { input_tokens: 900, output_tokens: 120, cache_read_input_tokens: 50214, junk: 'dropped' },
    argv: ['-p', '--append-system-prompt', 'THE WHOLE MANDATE'],
  });

  const driveToConfirm = async (judge, store = createMemoryRunStore()) => {
    const { declaration, registry } = registryFor({});
    const sinks = Object.fromEntries(Object.values(REVIEW_EFFECTS).map((t) => [t, async () => ({ ok: true })]));
    const out = await runOperationCli({
      declaration, registry, store, sinks, judge,
      argv: ['--pr=1234', '--repo=chalbert/web-everything'], newRunId: () => 'run-tel',
    });
    return { out, store, declaration, registry, sinks };
  };

  it('lands the metered fields on the run record, attributed to the step that spawned it', async () => {
    const { out } = await driveToConfirm(meteredJudge);
    expect(out.run.telemetry).toHaveLength(1);
    const row = out.run.telemetry[0];
    expect(row).toMatchObject({
      step: 'judge', stepIndex: 1, costUsd: 0.0421, wallMs: 8400, durationMs: 8123,
      sessionId: '11111111-2222-3333-4444-555555555555', loadedContextTokens: 51234,
    });
    // The lens/model/effort come from the REQUEST the engine suspended with, not from the caller's report.
    expect(row.lens).toBe('correctness');
    expect(row.model).toBe('sonnet');
    expect(row.effort).toBe('high');
    // The counters are carried; the non-numeric noise in `usage` is not.
    expect(row.usage).toEqual({ input_tokens: 900, output_tokens: 120, cache_read_input_tokens: 50214 });
    // AND NOT THE MATERIAL: `argv` embeds the whole mandate and must never reach a record that is printed.
    expect(JSON.stringify(out.run)).not.toContain('THE WHOLE MANDATE');
  });

  it('reports the cost AT THE CONFIRM STOP — before the operator decides whether to spend more', async () => {
    const { out } = await driveToConfirm(meteredJudge);
    const text = out.lines.join('\n');
    expect(text).toContain('judge spend: $0.0421 over 1 juror(s)');
    expect(text).toContain('judge (correctness): $0.0421 · 8.4s');
    expect(text).toContain('session 11111111-2222-3333-4444-555555555555');
  });

  it('survives the resume into the completed run, and into --json with a pre-summed total', async () => {
    const { store, declaration, registry, sinks } = await driveToConfirm(meteredJudge);
    const second = await runOperationCli({
      declaration, registry, store, sinks, judge: meteredJudge,
      argv: ['--resume=run-tel', '--answer=accept', '--json'], newRunId: () => 'x',
    });
    expect(second.stopped).toBe('complete');
    const payload = JSON.parse(second.lines.join('\n'));
    expect(payload.spend).toEqual({ jurors: 1, costUsd: 0.0421, wallMs: 8400, durationMs: 8123 });
    expect(payload.telemetry[0].costUsd).toBe(0.0421);
  });

  it('a judge that returns a bare answer still works, and simply records no spend', async () => {
    const { out } = await driveToConfirm(async () => CLEAN_ANSWER);
    expect(out.run.telemetry).toEqual([]);
    expect(out.lines.join('\n')).not.toContain('judge spend');
  });

  it('keeps the cost OUT of the juror\'s finding — a declaration must not compute over what it cost', async () => {
    const { out } = await driveToConfirm(meteredJudge);
    expect(out.run.findings.judge).toEqual(CLEAN_ANSWER);
    expect(out.run.verdict.findings).toEqual([]);
  });
});

describe('the durable comment states ONE provenance (#2898)', () => {
  it('tells the single home the surface, so its attribution matches the operation\'s own footer', () => {
    const { registry } = registryFor({});
    const { run } = atConfirm({ registry, input: BASE_INPUT, id: 'run-chan' });
    const declared = advance(advance(run, { registry, resume: { value: 'accept' } }), { registry });
    const label = declared.effects.find((e) => e.type === REVIEW_EFFECTS.LABEL);
    expect(label.payload.channel).toBe(REVIEW_PR_CHANNEL);
    expect(REVIEW_PR_CHANNEL).toContain('review-pr');
    // The write-up's footer and the channel must name the same thing — they sit in ONE comment.
    const writeUp = declared.effects.find((e) => e.type === REVIEW_EFFECTS.WRITE_UP);
    expect(writeUp.payload.body).toContain(`Recorded through the declared \`${REVIEW_PR_OP}\` operation (#3035)`);
    expect(writeUp.payload.body).not.toContain('review console');
  });
});

describe('the write-up does not over-promise on a single-lens run', () => {
  const writeUp = (lens = 'correctness') => {
    const { registry } = registryFor({});
    const { run } = atConfirm({ registry, input: { ...BASE_INPUT, lens }, id: `run-wu-${lens}` });
    return renderVerdictWriteUp({
      read: run.findings.read, verdict: run.verdict, answer: 'accept', actor: 'op', lens,
    });
  };

  it('lists ONLY the lens that judged — never a mandatory lens as `(no verdict)` beside a pass', () => {
    const body = writeUp('correctness');
    expect(body).toContain('| correctness | mandatory | accept |');
    for (const other of PANEL_LENSES.filter((l) => l !== 'correctness')) {
      expect(body).not.toContain(`| ${other} |`);
    }
    expect(body).not.toContain('(no verdict)');
  });

  it('says in words that it was a single-lens run, and which lenses did not run', () => {
    const body = writeUp('security');
    expect(body).toContain('a SINGLE-LENS run');
    expect(body).toContain('did NOT run and are not reported as unjudged');
    expect(body).toContain('correctness');
  });
});

describe('the net basis is pinned to a commit, not a moving ref', () => {
  const SHA = 'd7ad4774849fe32af2a317510a43b7ca1375e6b3';

  it('records the resolved SHA and keeps the ref it came from', () => {
    const finding = shapeReadFinding({
      detail: { pr: 1, repo: 'o/n', labels: [] },
      net: { paths: ['a.mjs'], base: 'abc', rev: 'origin/lane/3058-seed-encoding', revSha: SHA, scored: true },
      diff: { text: 'x', scored: true },
    }, { pr: 1, repo: 'o/n' });
    expect(finding.netBasis.rev).toBe(SHA);
    expect(finding.netBasis.revRef).toBe('origin/lane/3058-seed-encoding');
  });

  it('renders the commit in the comment — the ref appears only as provenance', () => {
    const read = shapeReadFinding({
      detail: { pr: 1, repo: 'o/n', labels: [] },
      net: { paths: ['a.mjs'], base: 'abc', rev: 'origin/lane/3058-seed-encoding', revSha: SHA, scored: true },
      diff: { text: 'x', scored: true },
    }, { pr: 1, repo: 'o/n' });
    const body = renderVerdictWriteUp({
      read, verdict: { verdict: 'accept', findings: [], lens: 'correctness' }, answer: 'accept', actor: 'op', lens: 'correctness',
    });
    expect(body).toContain(`Net basis: \`abc..${SHA}\` (rev \`origin/lane/3058-seed-encoding\` at review time)`);
  });

  it('says UNPINNED rather than quietly recording the mutable ref when it will not resolve', () => {
    const read = shapeReadFinding({
      detail: { pr: 1, repo: 'o/n', labels: [] },
      net: { paths: ['a.mjs'], base: 'abc', rev: 'origin/lane/gone', revSha: null, scored: true },
      diff: { text: 'x', scored: true },
    }, { pr: 1, repo: 'o/n' });
    expect(read.netBasis.rev).toBe(null);
    const body = renderVerdictWriteUp({
      read, verdict: { verdict: 'accept', findings: [], lens: 'correctness' }, answer: 'accept', actor: 'op', lens: 'correctness',
    });
    expect(body).toContain('⚠️ UNPINNED');
    expect(body).toContain('origin/lane/gone');
  });
});

// ── THE #3028 ARGV FOOTGUN ────────────────────────────────────────────────────────────────────────────────
describe('the judge request is never built from unvalidated input', () => {
  it('pins model/effort/budget as declaration literals — no input field reaches a juror flag', () => {
    const { registry } = registryFor({});
    const { request } = atConfirm({ registry, input: { ...BASE_INPUT, actor: '--bare' }, id: 'run-fg' });
    expect(request.model).toBe('sonnet');
    expect(request.effort).toBe('high');
    expect(String(request.model).startsWith('-')).toBe(false);
    // The one input field that DOES reach the request lands in prose, never in a flag position.
    expect(request.lens).toBe('correctness');
  });

  // TWO REFUSALS, AND THE OUTER ONE IS NEW. The declared `enum` (see the `--help` test above) now refuses an
  // unknown lens in `validateInput`, so a bad `--lens` never produces a run record at all. The inner refusal —
  // `buildPanelMandate` throwing when the `judge` step builds its request — is still the one that binds a
  // caller who assembles a record by hand, so BOTH are pinned: dropping either would leave one path open.
  it('an unknown lens dies at the schema, before a run record exists', () => {
    const { registry } = registryFor({});
    expect(() => startRun({ op: REVIEW_PR_OP, id: 'run-lens', input: { ...BASE_INPUT, lens: '--bare' }, registry }))
      .toThrow(/must be one of correctness\|security\|simplicity\|standards-conformance/);
  });

  it('…and an unknown lens smuggled past the schema still dies in `buildPanelMandate`, before argv', () => {
    const { registry } = registryFor({});
    // A record built by hand, bypassing `startRun`'s validation exactly as a rogue caller would.
    const started = { ...startRun({ op: REVIEW_PR_OP, id: 'run-lens2', input: BASE_INPUT, registry }), input: { ...BASE_INPUT, lens: '--bare' } };
    expect(() => advanceWhileRunning(started, { registry })).toThrow(/unknown lens/);
  });

  it('the adapter refuses a flag-shaped option value outright', () => {
    expect(() => assertSafeJudgeRequest({ mandate: 'x', input: 'y', shape: {}, model: '--bare' }))
      .toThrow(/shaped like a flag/);
    expect(() => assertSafeJudgeRequest({ mandate: 'x', input: 'y', shape: {}, effort: 'ludicrous' }))
      .toThrow(/effort/);
  });
});

// #3072 — THE JUROR CAN ACT. A tool-free juror reading a diff found none of the defects the hand-run reviews
// found this week: a `gh` flag bypass proven by firing the command, a guard hole reproduced on the parent
// commit, four decorative tests found by mutating source. The tools ARE the finding mechanism, so the review
// operation grants them — and the isolation `--tools ""` used to provide is replaced structurally, by the
// spawn's lane cwd and its derived session id, neither of which depends on the juror cooperating.
describe('#3072 the review juror is tool-bearing', () => {
  it('the judge request carries an explicit tool allow-list', () => {
    const { request: req } = atConfirm({ ...registryFor(), input: BASE_INPUT });
    expect(req.allowedTools).toEqual([...REVIEW_JUROR_TOOLS]);
    expect(REVIEW_JUROR_TOOLS).toContain('Bash');
  });

  it('a flag-shaped tool name is refused at the adapter boundary', () => {
    // Same hazard as a flag-shaped `model`, one field over: the name reaches argv as a bare token.
    for (const bad of [['--bare'], ['-x'], [''], 'Bash', []]) {
      expect(() => assertSafeJudgeRequest({ allowedTools: bad }), JSON.stringify(bad)).toThrow();
    }
  });

  it('omitting the list still yields a tool-free juror, so every other caller is unchanged', () => {
    expect(() => assertSafeJudgeRequest({})).not.toThrow();
    const argv = buildJudgeArgv({ mandate: 'm', shape: { type: 'object' }, sessionId: deriveSessionId('t') });
    expect(argv).toContain('--tools');
    expect(argv).not.toContain('--allowedTools');
  });
});
