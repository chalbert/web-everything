/**
 * @file run-crosses-processes.test.mjs — #3032's acceptance, end to end (#3032, under epic #3029).
 *
 * THE WHOLE POINT OF THE RUN RECORD is that the state lives on the record rather than in the caller, so a
 * run suspended on one surface can be finished on another. A test that suspends and then resumes the same
 * in-memory object does not test that property — it tests a function call. So the resume here happens in a
 * **real second `node` process** that is handed nothing but a run id and a directory, and rehydrates
 * everything else off disk.
 *
 * The flow is the card's acceptance, in one pass:
 *   1. the parent runs the fixture's `compute` and `judge` steps and suspends at its `confirm`;
 *   2. a CHILD process rehydrates, resumes with the operator's decision, and applies the effects — with the
 *      second one rigged to fail, so the act is left genuinely half-done;
 *   3. a SECOND CHILD replays and finishes it, re-applying nothing that already landed.
 *
 * WHAT IS AND IS NOT SPAWNED. The card asks that the engine be unit-testable "without spawning a process or
 * touching the network", and the other four test files honour that literally — no spawn, no socket. The
 * constraint is about not needing a MODEL or a REMOTE, and this file needs neither: the judge step is
 * resumed with a canned answer and the effect sinks append to a local file. The `node` processes are the
 * subject under test, not a dependency of it. `we:scripts/__tests__/gate-entrypoint-integration.test.mjs`
 * is the local precedent for a test whose real child processes ARE the property being proved.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, it, expect } from 'vitest';

import { advanceWhileRunning, runStatus, startRun } from '../engine.mjs';
import { createFileRunStore } from '../run-store.mjs';
import { FIXTURE_JUDGE_ANSWER, FIXTURE_OP, fixtureRegistry } from '../__fixtures__/fixture-operation.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const RESUME_SCRIPT = resolve(HERE, '..', '__fixtures__', 'resume-run.mjs');
const RUN_ID = 'run-crossproc';

let dir;
let log;
const registry = fixtureRegistry();

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'we-op-xproc-'));
  log = join(dir, 'effects.log');
});
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

/** Run the resume helper in a FRESH process. Returns its parsed stdout. */
function resumeInChild({ resume = null, failTypes = '' } = {}) {
  const args = [RESUME_SCRIPT, RUN_ID];
  if (resume !== null) args.push(JSON.stringify(resume));
  const stdout = execFileSync(process.execPath, args, {
    encoding: 'utf8',
    // stderr is CAPTURED, not inherited: a refusal test expects the child to die, and its stack belongs in
    // the assertion (Node folds a failed child's stderr into the thrown error's message), not in the run log.
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, OPERATION_RUNS_DIR: dir, FIXTURE_EFFECT_LOG: log, FIXTURE_FAIL_TYPES: failTypes },
  });
  return JSON.parse(stdout);
}

/** The effect log, one entry per effect that a sink actually applied. */
function appliedEffects() {
  if (!existsSync(log)) return [];
  return readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

/** Parent side: run the fixture up to its `confirm` and leave the record on disk. */
function suspendAtConfirm() {
  const store = createFileRunStore(dir);
  let run = startRun({ op: FIXTURE_OP, id: RUN_ID, input: { pr: 1234 }, registry });
  run = advanceWhileRunning(run, { registry });                                        // compute → judge suspend
  expect(runStatus(run, { registry })).toBe('awaiting-judge');
  run = advanceWhileRunning(run, { registry, resume: { value: FIXTURE_JUDGE_ANSWER } }); // canned answer — no spawn
  expect(runStatus(run, { registry })).toBe('awaiting-confirm');
  store.write(run);
  return run;
}

describe('a run started here is finished in a process that never saw it', () => {
  it('suspends at confirm, half-applies in one child, and is completed idempotently by the next', () => {
    suspendAtConfirm();

    // ── CHILD 1: rehydrate from disk, resume the human stop, and get the label swap rigged to fail. ──────
    const first = resumeInChild({ resume: { value: 'accept' }, failTypes: 'label.swap' });
    expect(first.status).toBe('awaiting-effect');
    expect(first.verdict).toEqual(FIXTURE_JUDGE_ANSWER); // it read the verdict the PARENT recorded
    expect(first.effects.map((e) => [e.type, e.status])).toEqual([
      ['comment.post', 'applied'],
      ['label.swap', 'failed'],
    ]);
    // The act is genuinely half-done: the durable comment landed, the label the drain acts on did not.
    expect(appliedEffects().map((e) => e.type)).toEqual(['comment.post']);

    // ── CHILD 2: a third process replays. The half that landed must NOT land twice. ───────────────────────
    const second = resumeInChild();
    expect(second.status).toBe('complete');
    expect(second.cursor).toBe(4);
    expect(second.effects.map((e) => e.status)).toEqual(['applied', 'applied']);

    const applied = appliedEffects();
    expect(applied.map((e) => e.type)).toEqual(['comment.post', 'label.swap']); // exactly one of each
    expect(applied.filter((e) => e.type === 'comment.post')).toHaveLength(1);
    expect(applied[1].payload).toEqual({ pr: 1234, label: 'review:accepted' });
    // Both effects carry the same (run, step, ordinal) keys the parent minted.
    expect(applied.map((e) => e.key)).toEqual([`${RUN_ID}#3#0`, `${RUN_ID}#3#1`]);

    // ── And the record on disk agrees with what the child reported. ──────────────────────────────────────
    const onDisk = createFileRunStore(dir).read(RUN_ID);
    expect(runStatus(onDisk, { registry })).toBe('complete');
    expect(onDisk.findings.humanOk).toBe('accept');
    expect(onDisk.verdict).toEqual(FIXTURE_JUDGE_ANSWER);
  });

  it('replaying a COMPLETED run is a no-op — no effect is applied a fourth time', () => {
    suspendAtConfirm();
    resumeInChild({ resume: { value: 'accept' } });
    expect(appliedEffects()).toHaveLength(2);

    const again = resumeInChild();
    expect(again.status).toBe('complete');
    expect(appliedEffects()).toHaveLength(2);
  });

  it('the operator\'s other decision travels across the process boundary just as well', () => {
    suspendAtConfirm();
    const done = resumeInChild({ resume: { value: 'changes' } });
    expect(done.status).toBe('complete');
    expect(appliedEffects().map((e) => e.payload.label ?? e.payload.body)).toEqual(['verdict: accept', 'review:changes']);
  });
});

describe('the process boundary fails closed too', () => {
  it('a child refuses a corrupt record rather than starting the run over', () => {
    suspendAtConfirm();
    writeFileSync(join(dir, `${RUN_ID}.json`), '{"v":1,"id":"run-crossproc","cur');
    expect(() => resumeInChild({ resume: { value: 'accept' } })).toThrow(/refusing to read run run-crossproc/);
    expect(appliedEffects()).toEqual([]);
  });

  it('a child refuses a run id that is not on disk', () => {
    expect(() => resumeInChild({ resume: { value: 'accept' } })).toThrow();
  });

  it('a child refuses a decision outside the confirm step\'s declared options', () => {
    suspendAtConfirm();
    expect(() => resumeInChild({ resume: { value: 'maybe' } })).toThrow(/accepts only "accept" \| "changes"/);
    expect(appliedEffects()).toEqual([]);
  });
});
