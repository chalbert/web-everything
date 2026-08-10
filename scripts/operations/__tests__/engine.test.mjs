/**
 * @file engine.test.mjs — `advance` over all four step kinds, and the refusals (#3032).
 *
 * THE LOAD-BEARING TEST IN HERE is `the engine's import graph reaches nothing that can act`. Every other
 * claim in this slice — "a judge step declares and does not spawn", "an effect step declares and does not
 * write", "the engine is unit-testable without a process or the network" — rests on the engine having no
 * way to do those things. A behavioural test can only show it did not act THIS time; the static graph check
 * shows it CANNOT, and it fails the moment someone adds `import { spawn } from 'node:child_process'`.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

import { advance, advanceWhileRunning, isComplete, projectReads, runStatus, startRun } from '../engine.mjs';
import { createRegistry, op } from '../registry.mjs';
import { compute, confirm, effect, judge } from '../step-kinds.mjs';
import { newRunRecord } from '../run-record.mjs';
import { FIXTURE_JUDGE_ANSWER, FIXTURE_OP, fixtureRegistry } from '../__fixtures__/fixture-operation.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SPECIFIER_RE = /\bfrom\s+['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)|^\s*import\s+['"]([^'"]+)['"]/gm;

/** Every module reachable from `entry` by static or dynamic import, plus every non-relative specifier. */
function importGraph(entry) {
  const files = new Set();
  const external = new Set();
  const queue = [entry];
  while (queue.length) {
    const file = queue.pop();
    if (files.has(file)) continue;
    files.add(file);
    const src = readFileSync(file, 'utf8');
    for (const match of src.matchAll(SPECIFIER_RE)) {
      const spec = match[1] ?? match[2] ?? match[3];
      if (!spec) continue;
      if (spec.startsWith('.')) queue.push(resolve(dirname(file), spec));
      else external.add(spec);
    }
  }
  return { files: [...files].sort(), external: [...external].sort() };
}

describe('the engine performs no io — structurally, not by habit', () => {
  it('the engine\'s import graph reaches nothing that can act', () => {
    const { files, external } = importGraph(resolve(HERE, '..', 'engine.mjs'));
    // The whole pure core: the engine, the declaration, the vocabulary, the record.
    expect(files.map((f) => f.split('/').pop())).toEqual(['engine.mjs', 'registry.mjs', 'run-record.mjs', 'step-kinds.mjs']);
    // No `node:fs`, no `node:child_process`, no `node:http`, no anything.
    expect(external).toEqual([]);
  });

  it('the step vocabulary and the record core are leaves too', () => {
    expect(importGraph(resolve(HERE, '..', 'step-kinds.mjs')).external).toEqual([]);
    expect(importGraph(resolve(HERE, '..', 'run-record.mjs')).external).toEqual([]);
  });

  it('the effect EXECUTOR imports no fs or child_process either — its store and sinks are injected', () => {
    const { external } = importGraph(resolve(HERE, '..', 'effect-executor.mjs'));
    expect(external).toEqual([]);
  });
});

describe('startRun', () => {
  const registry = fixtureRegistry();

  it('produces a record at cursor 0 with the declared shape', () => {
    const run = startRun({ op: FIXTURE_OP, id: 'run-1', input: { pr: 42 }, registry });
    expect(run).toMatchObject({ v: 1, id: 'run-1', op: FIXTURE_OP, cursor: 0, findings: {}, verdict: null, effects: [], pending: null });
    expect(run.input).toEqual({ pr: 42, note: '' }); // the optional field's declared default
  });

  it('refuses an unknown operation', () => {
    expect(() => startRun({ op: 'nope', id: 'run-1', registry })).toThrow(/no operation named "nope"/);
  });

  it('refuses input the declaration does not accept', () => {
    expect(() => startRun({ op: FIXTURE_OP, id: 'run-1', input: {}, registry })).toThrow(/missing required input field `pr`/);
    expect(() => startRun({ op: FIXTURE_OP, id: 'run-1', input: { pr: 42, x: 1 }, registry })).toThrow(/unknown input field `x`/);
    expect(() => startRun({ op: FIXTURE_OP, id: 'run-1', input: { pr: '42' }, registry })).toThrow(/must be a number, got string/);
  });

  it('refuses an unusable run id', () => {
    expect(() => startRun({ op: FIXTURE_OP, id: '../escape', input: { pr: 1 }, registry })).toThrow(/invalid run id/);
  });
});

describe('declared reads are the actual boundary', () => {
  it('a step fn sees ONLY what it declared', () => {
    let seen = null;
    const registry = createRegistry();
    registry.register(op('reads', {
      input: { pr: 'number', secret: 'string' },
      a: compute({ fn: () => 'a-result' }),
      b: compute({ reads: ['input.pr', 'findings.a'], fn: (view) => { seen = view; return 1; } }),
    }));
    let run = startRun({ op: 'reads', id: 'run-reads', input: { pr: 7, secret: 'shh' }, registry });
    run = advanceWhileRunning(run, { registry });
    expect(seen).toEqual({ input: { pr: 7 }, findings: { a: 'a-result' } });
    expect(seen.input.secret).toBeUndefined();
  });

  it('the view is frozen, so a step cannot smuggle state back through it', () => {
    const run = { ...newRunRecord({ id: 'r', op: 'x', input: { pr: 1 } }), findings: { a: { deep: 1 } } };
    const view = projectReads(run, ['input.pr', 'findings.a', 'verdict']);
    expect(Object.isFrozen(view)).toBe(true);
    expect(Object.isFrozen(view.input)).toBe(true);
    expect(() => { view.input.pr = 2; }).toThrow();
    expect(view.verdict).toBeNull();
  });

  it('a finding is copied, never aliased — mutating the returned object cannot reach the record', () => {
    const registry = createRegistry();
    const mutable = { n: 1 };
    registry.register(op('alias', { a: compute({ fn: () => mutable }) }));
    const run = advance(startRun({ op: 'alias', id: 'run-alias', registry }), { registry });
    mutable.n = 99;
    expect(run.findings.a).toEqual({ n: 1 });
  });
});

describe('advance over the four kinds', () => {
  const registry = fixtureRegistry();
  const start = () => startRun({ op: FIXTURE_OP, id: 'run-four', input: { pr: 99 }, registry });

  it('compute runs the pure fn and moves the cursor', () => {
    const run = advance(start(), { registry });
    expect(run.cursor).toBe(1);
    expect(run.findings.diff).toContain('pr-99');
    expect(run.pending).toBeNull();
  });

  it('judge SUSPENDS with a request for the #3028 helper and spawns nothing', () => {
    const run = advanceWhileRunning(start(), { registry });
    expect(runStatus(run, { registry })).toBe('awaiting-judge');
    expect(run.cursor).toBe(1); // the cursor does NOT move past a suspended step
    expect(run.pending.request).toMatchObject({ mandate: expect.any(String), input: expect.stringContaining('pr-99'), runId: 'run-four', lens: 'panel' });
    expect(run.pending.request.shape.properties.verdict.enum).toEqual(['accept', 'changes']);
    expect(run.findings.panel).toBeUndefined(); // nothing was judged — only declared
  });

  it('resuming the judge step records the answer and sets the declared verdict', () => {
    let run = advanceWhileRunning(start(), { registry });
    run = advance(run, { registry, resume: { value: FIXTURE_JUDGE_ANSWER } });
    expect(run.findings.panel).toEqual(FIXTURE_JUDGE_ANSWER);
    expect(run.verdict).toEqual(FIXTURE_JUDGE_ANSWER); // verdictFrom: 'panel'
    expect(run.cursor).toBe(2);
  });

  it('confirm SUSPENDS recording what is asked and of whom', () => {
    let run = advanceWhileRunning(start(), { registry });
    run = advanceWhileRunning(run, { registry, resume: { value: FIXTURE_JUDGE_ANSWER } });
    expect(runStatus(run, { registry })).toBe('awaiting-confirm');
    expect(run.pending).toMatchObject({ kind: 'confirm', step: 'humanOk', of: 'operator', options: ['accept', 'changes'] });
    expect(run.pending.asks).toBe('The panel returned "accept". Accept it?');
  });

  it('confirm REFUSES a decision outside its declared options', () => {
    let run = advanceWhileRunning(start(), { registry });
    run = advanceWhileRunning(run, { registry, resume: { value: FIXTURE_JUDGE_ANSWER } });
    expect(() => advance(run, { registry, resume: { value: 'maybe' } }))
      .toThrow(/accepts only "accept" \| "changes" — refusing "maybe"/);
  });

  it('effect DECLARES its effects, applies none, and stays suspended', () => {
    let run = advanceWhileRunning(start(), { registry });
    run = advanceWhileRunning(run, { registry, resume: { value: FIXTURE_JUDGE_ANSWER } });
    run = advanceWhileRunning(run, { registry, resume: { value: 'accept' } });
    expect(runStatus(run, { registry })).toBe('awaiting-effect');
    expect(run.effects.map((e) => [e.key, e.type, e.status])).toEqual([
      ['run-four#3#0', 'comment.post', 'declared'],
      ['run-four#3#1', 'label.swap', 'declared'],
    ]);
    expect(run.effects[1].idempotent).toBe(true);
    expect(run.effects[0].idempotent).toBe(false);
  });

  it('re-declaring the same effect step does not duplicate its entries', () => {
    let run = advanceWhileRunning(start(), { registry });
    run = advanceWhileRunning(run, { registry, resume: { value: FIXTURE_JUDGE_ANSWER } });
    run = advanceWhileRunning(run, { registry, resume: { value: 'accept' } });
    const again = advance({ ...run, pending: null }, { registry });
    expect(again.effects).toHaveLength(2);
  });

  it('an effect step declaring NOTHING resolves in the same call rather than suspending forever', () => {
    const r = createRegistry();
    r.register(op('nothing', { a: effect({ effects: () => [] }) }));
    const run = advance(startRun({ op: 'nothing', id: 'run-none', registry: r }), { registry: r });
    expect(runStatus(run, { registry: r })).toBe('complete');
  });
});

// A `judge` step declares the juror call and the CALLER makes it, so the cost of the spawn exists only out
// there — the resume is the one seam it can travel back through. See `withTelemetry` in the engine.
describe('a judge resume carries what the spawn cost', () => {
  const registry = fixtureRegistry();
  const atJudge = () => advanceWhileRunning(
    startRun({ op: FIXTURE_OP, id: 'run-tel', input: { pr: 7 }, registry }), { registry },
  );
  const SPEND = { costUsd: 0.02, wallMs: 1500, sessionId: 'abc', junk: 'dropped', usage: { input_tokens: 10 } };

  it('records a row on the run, whitelisted, stamped with the step and the declared request', () => {
    const run = advance(atJudge(), { registry, resume: { value: FIXTURE_JUDGE_ANSWER, telemetry: SPEND } });
    expect(run.telemetry).toHaveLength(1);
    expect(run.telemetry[0]).toEqual({
      step: 'panel', stepIndex: 1, costUsd: 0.02, wallMs: 1500, sessionId: 'abc',
      // From the SUSPENDED REQUEST, not from the caller's report — the row is attributable either way.
      lens: 'panel', model: 'sonnet', effort: 'medium',
      usage: { input_tokens: 10 },
    });
    // The answer itself is untouched: a declaration must not be able to compute over what it cost.
    expect(run.findings.panel).toEqual(FIXTURE_JUDGE_ANSWER);
  });

  it('is optional — a resume without it records nothing and changes nothing', () => {
    const run = advance(atJudge(), { registry, resume: { value: FIXTURE_JUDGE_ANSWER } });
    expect(run.telemetry).toEqual([]);
  });

  it('REFUSES telemetry on a confirm resume — a person answering a question spawns no juror', () => {
    let run = advance(atJudge(), { registry, resume: { value: FIXTURE_JUDGE_ANSWER } });
    run = advanceWhileRunning(run, { registry });
    expect(runStatus(run, { registry })).toBe('awaiting-confirm');
    expect(() => advance(run, { registry, resume: { value: 'accept', telemetry: SPEND } }))
      .toThrow(/a `confirm` resume carries no juror telemetry/);
  });

  it('a record that predates the field still advances — absent is not corrupt', () => {
    const { telemetry, ...legacy } = atJudge();
    expect(telemetry).toEqual([]);
    const run = advance(legacy, { registry, resume: { value: FIXTURE_JUDGE_ANSWER, telemetry: SPEND } });
    expect(run.telemetry).toHaveLength(1);
  });
});

describe('advance is idempotent and never mutates', () => {
  const registry = fixtureRegistry();

  it('returns the record unchanged when suspended with nothing to resume it with', () => {
    const run = advanceWhileRunning(startRun({ op: FIXTURE_OP, id: 'run-idem', input: { pr: 1 }, registry }), { registry });
    expect(advance(run, { registry })).toBe(run);
  });

  it('returns the record unchanged once complete', () => {
    const r = createRegistry();
    r.register(op('one', { a: compute({ fn: () => 1 }) }));
    const done = advance(startRun({ op: 'one', id: 'run-done', registry: r }), { registry: r });
    expect(isComplete(done, { registry: r })).toBe(true);
    expect(advance(done, { registry: r })).toBe(done);
  });

  it('does not mutate the record it was given', () => {
    const run = startRun({ op: FIXTURE_OP, id: 'run-immutable', input: { pr: 1 }, registry });
    const snapshot = JSON.stringify(run);
    advance(run, { registry });
    expect(JSON.stringify(run)).toBe(snapshot);
  });
});

describe('the engine fails closed', () => {
  const registry = fixtureRegistry();

  it('refuses a record that is not a valid run record', () => {
    expect(() => advance({}, { registry })).toThrow(/run record passed to advance is invalid/);
    expect(() => advance({ ...newRunRecord({ id: 'r', op: 'x' }), v: 99 }, { registry })).toThrow(/unsupported run record version 99/);
    expect(() => advance({ ...newRunRecord({ id: 'r', op: 'x' }), cursor: -1 }, { registry })).toThrow(/`cursor` must be a non-negative integer/);
  });

  it('refuses a run naming an operation the registry does not have', () => {
    expect(() => advance(newRunRecord({ id: 'r', op: 'ghost' }), { registry })).toThrow(/no operation named "ghost"/);
  });

  it('refuses a cursor past the end of the declaration', () => {
    const run = { ...startRun({ op: FIXTURE_OP, id: 'run-past', input: { pr: 1 }, registry }), cursor: 9 };
    expect(() => advance(run, { registry })).toThrow(/declares only 4 step\(s\) — the declaration changed under a live run/);
  });

  it('refuses to resume a run whose declaration changed underneath it', () => {
    const suspended = advanceWhileRunning(startRun({ op: FIXTURE_OP, id: 'run-drift', input: { pr: 1 }, registry }), { registry });
    const drifted = createRegistry();
    drifted.register(op(FIXTURE_OP, { input: { pr: 'number' }, somethingElse: compute({ fn: () => 1 }) }));
    expect(() => advance(suspended, { registry: drifted, resume: { value: 1 } }))
      .toThrow(/suspended at step 1 \(`panel`\) but `fixture-review` now has no step there/);
  });

  it('refuses a resume addressed to the wrong step', () => {
    const suspended = advanceWhileRunning(startRun({ op: FIXTURE_OP, id: 'run-wrong', input: { pr: 1 }, registry }), { registry });
    expect(() => advance(suspended, { registry, resume: { step: 'humanOk', value: 1 } }))
      .toThrow(/refusing a resume addressed to `humanOk` — run run-wrong is suspended at `panel`/);
  });

  it('refuses a resume for a run that is not waiting on anything', () => {
    const run = startRun({ op: FIXTURE_OP, id: 'run-nowait', input: { pr: 1 }, registry });
    expect(() => advance(run, { registry, resume: { value: 1 } })).toThrow(/is not suspended — refusing a resume/);
  });

  it('refuses a resume that carries no value', () => {
    const suspended = advanceWhileRunning(startRun({ op: FIXTURE_OP, id: 'run-novalue', input: { pr: 1 }, registry }), { registry });
    expect(() => advance(suspended, { registry, resume: {} })).toThrow(/must carry a `value`/);
  });

  it('refuses to hand-wave an effect step past with a resume value', () => {
    let run = advanceWhileRunning(startRun({ op: FIXTURE_OP, id: 'run-handwave', input: { pr: 1 }, registry }), { registry });
    run = advanceWhileRunning(run, { registry, resume: { value: FIXTURE_JUDGE_ANSWER } });
    run = advanceWhileRunning(run, { registry, resume: { value: 'accept' } });
    expect(() => advance(run, { registry, resume: { value: 'done' } }))
      .toThrow(/resolved by applying its effects through the executor, never by a resume value/);
  });

  it('refuses an unknown step kind even if one somehow reached a declaration', () => {
    // `op()` cannot produce this — the refusal exists so a hand-built declaration cannot make the engine
    // improvise its way through a kind it does not know.
    const forged = Object.freeze({
      name: 'forged', input: {}, verdictFrom: null,
      steps: Object.freeze([Object.freeze({ name: 'a', index: 0, step: Object.freeze({ kind: 'notify', reads: [] }) })]),
      stepNames: Object.freeze(['a']),
    });
    const r = { get: () => forged, has: () => true, names: () => ['forged'] };
    expect(() => advance(newRunRecord({ id: 'run-forged', op: 'forged' }), { registry: r }))
      .toThrow(/unknown step kind "notify" — the vocabulary is closed/);
  });

  it('refuses a judge step whose request is not shaped for the helper', () => {
    const r = createRegistry();
    r.register(op('badjudge', { a: judge({ request: () => ({ mandate: 'm', input: '', shape: {} }) }) }));
    expect(() => advance(startRun({ op: 'badjudge', id: 'run-bj', registry: r }), { registry: r }))
      .toThrow(/must return a non-empty string `input` to judge/);
  });

  it('refuses an effect step that does not return an array', () => {
    const r = createRegistry();
    r.register(op('badeffect', { a: effect({ effects: () => ({ type: 'x' }) }) }));
    expect(() => advance(startRun({ op: 'badeffect', id: 'run-be', registry: r }), { registry: r }))
      .toThrow(/must return an ARRAY of declared effects/);
  });

  it('refuses a declared effect with no type', () => {
    const r = createRegistry();
    r.register(op('notype', { a: effect({ effects: () => [{ payload: 1 }] }) }));
    expect(() => advance(startRun({ op: 'notype', id: 'run-nt', registry: r }), { registry: r }))
      .toThrow(/declared effect #0 with no `type`/);
  });

  it('refuses a confirm step whose question came out empty', () => {
    const r = createRegistry();
    r.register(op('noask', { a: confirm({ asks: () => '  ', of: 'operator' }) }));
    expect(() => advance(startRun({ op: 'noask', id: 'run-na', registry: r }), { registry: r }))
      .toThrow(/produced an empty question/);
  });

  // #3035 — WHO is asked can depend on the run. `review-pr` needs `human` on a gate-self PR and `agent`
  // otherwise, which is a property of the PR the `read` step observed, not of the declaration.
  it('evaluates a FUNCTION `of` over the same projected view as `asks`', () => {
    const r = createRegistry();
    r.register(op('whoasks', {
      input: { gateSelf: 'boolean' },
      a: confirm({ reads: ['input.gateSelf'], asks: 'clear it?', of: (v) => (v.input.gateSelf ? 'human' : 'agent') }),
    }));
    const human = advance(startRun({ op: 'whoasks', id: 'run-wh', input: { gateSelf: true }, registry: r }), { registry: r });
    expect(human.pending.of).toBe('human');
    const agent = advance(startRun({ op: 'whoasks', id: 'run-wa', input: { gateSelf: false }, registry: r }), { registry: r });
    expect(agent.pending.of).toBe('agent');
  });

  it('refuses a confirm step whose `of` came out empty — never records a decision owed by ""', () => {
    const r = createRegistry();
    r.register(op('noof', { a: confirm({ asks: 'clear it?', of: () => '  ' }) }));
    expect(() => advance(startRun({ op: 'noof', id: 'run-no', registry: r }), { registry: r }))
      .toThrow(/produced an empty `of`/);
  });

  it('refuses to loop forever', () => {
    const r = createRegistry();
    const body = { input: {} };
    for (let i = 0; i < 5; i += 1) body[`s${i}`] = compute({ fn: () => i });
    r.register(op('many', body));
    expect(() => advanceWhileRunning(startRun({ op: 'many', id: 'run-many', registry: r }), { registry: r, maxSteps: 2 }))
      .toThrow(/did not settle within 2 steps/);
  });
});
