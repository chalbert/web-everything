/**
 * @file gap-sweep-status.test.mjs — the `gap-sweep-status` operation (#xkp1mv8).
 *
 * THE PROPERTY UNDER TEST is the same three-valuedness `verify` and `mutation-check` are tested for: `ok`,
 * `violations`, and `unrun` are three different facts, and a crash (a bad `--baseline` path, a killed spawn)
 * must never read as `violations` — the CLI's own invariant gate never ran, so nothing about the sweep's data
 * was actually asserted.
 *
 * No `node` spawn anywhere in this file: `classifyGapSweepResult` and `gapSweepStatusArgv` are pure, and the
 * declaration's `run` effect is driven end to end through a stub sink. `./gap-sweep-status-integration.test.mjs`
 * is the sibling that drives the real CLI, proving this mapping matches what it actually prints.
 */
import { describe, it, expect } from 'vitest';

import { advanceWhileRunning, startRun } from '../engine.mjs';
import { applyPendingEffects } from '../effect-executor.mjs';
import { createRegistry } from '../registry.mjs';
import { createMemoryRunStore } from '../run-store.mjs';
import {
  assessRun, shapeRunFinding, gapSweepStatusOperation, GAP_SWEEP_STATUS_OP, GAP_SWEEP_STATUS_EFFECT,
  GAP_SWEEP_MODES, GAP_SWEEP_OUTCOMES,
} from '../gap-sweep-status.mjs';
import {
  gapSweepStatusArgv, classifyGapSweepResult, GAP_SWEEP_STATUS_CLI,
  baselinePathContained, createGapSweepRunner,
} from '../gap-sweep-status-io.mjs';

const finding = (over = {}) => shapeRunFinding({ mode: 'status', outcome: 'ok', report: '…', ...over });

describe('shapeRunFinding', () => {
  it('refuses a result with no recognised outcome', () => {
    expect(() => shapeRunFinding({ mode: 'status', outcome: 'green' })).toThrow(/must be one of/);
  });

  it('refuses a non-object result', () => {
    expect(() => shapeRunFinding(null)).toThrow(/must return a result object/);
  });

  it('defaults `noop` to null — "not applicable", never "no"', () => {
    expect(shapeRunFinding({ mode: 'status', outcome: 'ok' }).noop).toBeNull();
    expect(shapeRunFinding({ mode: 'diff', outcome: 'ok', noop: false }).noop).toBe(false);
    expect(shapeRunFinding({ mode: 'diff', outcome: 'ok', noop: true }).noop).toBe(true);
  });
});

describe('assessRun', () => {
  it('ok: no blocking findings, and mode-specific facts are absent', () => {
    const v = assessRun(finding({ mode: 'status', outcome: 'ok' }));
    expect(v.ok).toBe(true);
    expect(v.blocking).toEqual([]);
    expect(v).not.toHaveProperty('snapshotPath');
    expect(v).not.toHaveProperty('noop');
  });

  it('violations: NOT ok, and every violation is reported as blocking', () => {
    const v = assessRun(finding({ mode: 'status', outcome: 'violations', violations: ['dup id', 'missing kind'] }));
    expect(v.ok).toBe(false);
    expect(v.blocking).toEqual([
      { why: 'invariant-violation', detail: 'dup id' },
      { why: 'invariant-violation', detail: 'missing kind' },
    ]);
  });

  it('unrun: NOT ok, blocking names why it did not run — never folded into violations', () => {
    const v = assessRun(finding({ mode: 'diff', outcome: 'unrun', reason: 'exit 1: ENOENT' }));
    expect(v.ok).toBe(false);
    expect(v.outcome).toBe('unrun');
    expect(v.blocking).toEqual([{ why: 'did-not-run', detail: 'exit 1: ENOENT' }]);
  });

  it('carries `snapshotPath` only for `snapshot` mode', () => {
    const v = assessRun(finding({ mode: 'snapshot', outcome: 'ok', snapshotPath: 'reports/x.json' }));
    expect(v.snapshotPath).toBe('reports/x.json');
  });

  it('carries `noop` only for `diff` mode, and only when the runner reported one', () => {
    expect(assessRun(finding({ mode: 'diff', outcome: 'ok', noop: true })).noop).toBe(true);
    expect(assessRun(finding({ mode: 'diff', outcome: 'unrun', reason: 'x' }))).not.toHaveProperty('noop');
    expect(assessRun(finding({ mode: 'status', outcome: 'ok' }))).not.toHaveProperty('noop');
  });
});

describe('gapSweepStatusArgv', () => {
  it('status: no flags', () => {
    expect(gapSweepStatusArgv({ mode: 'status' }, { cliPath: '/cli.mjs' })).toEqual(['/cli.mjs']);
  });
  it('snapshot: `--snapshot`', () => {
    expect(gapSweepStatusArgv({ mode: 'snapshot' }, { cliPath: '/cli.mjs' })).toEqual(['/cli.mjs', '--snapshot']);
  });
  it('diff: `--baseline=<path>`, one argv element, never shell-interpolated', () => {
    expect(gapSweepStatusArgv({ mode: 'diff', baseline: 'a b/x.json' }, { cliPath: '/cli.mjs' }))
      .toEqual(['/cli.mjs', '--baseline=a b/x.json']);
  });
  it('defaults to the real CLI path when none is given', () => {
    expect(gapSweepStatusArgv({ mode: 'status' })[0]).toBe(GAP_SWEEP_STATUS_CLI);
  });
});

describe('baselinePathContained', () => {
  const ROOT = '/repo/reports/gap-sweep-snapshots';

  it('accepts a plain filename inside the root', () => {
    expect(baselinePathContained('2026-06-20.json', { root: ROOT })).toBe(true);
  });
  it('accepts an already-rooted path', () => {
    expect(baselinePathContained('/repo/reports/gap-sweep-snapshots/x.json', { root: ROOT })).toBe(true);
  });
  it('refuses a `../` traversal that escapes the root', () => {
    expect(baselinePathContained('../../etc/passwd', { root: ROOT })).toBe(false);
  });
  it('refuses an absolute path outside the root', () => {
    expect(baselinePathContained('/etc/passwd', { root: ROOT })).toBe(false);
  });
  it('refuses a sibling directory whose name merely starts with the root string', () => {
    // e.g. "/repo/reports/gap-sweep-snapshots-evil/x.json" — a naive startsWith(root) would wrongly accept this.
    expect(baselinePathContained('../gap-sweep-snapshots-evil/x.json', { root: ROOT })).toBe(false);
  });
});

describe('createGapSweepRunner — baseline containment (security, #3412 review finding)', () => {
  it('refuses a `diff` baseline that escapes the snapshot root, without spawning', () => {
    const spawn = () => { throw new Error('must not spawn for an escaping baseline'); };
    const runner = createGapSweepRunner({ spawn, baselineRoot: '/repo/reports/gap-sweep-snapshots' });
    const result = runner({ mode: 'diff', baseline: '../../etc/passwd' });
    expect(result.outcome).toBe('unrun');
    expect(result.reason).toMatch(/escapes .*\(security\)/);
  });

  it('does not gate `status`/`snapshot`, which never take a baseline', () => {
    const spawn = () => ({ status: 0, stdout: '✓ invariants ok\n', stderr: '' });
    const runner = createGapSweepRunner({ spawn, baselineRoot: '/repo/reports/gap-sweep-snapshots' });
    expect(runner({ mode: 'status' }).outcome).toBe('ok');
    expect(runner({ mode: 'snapshot' }).outcome).toBe('ok');
  });
});

describe('classifyGapSweepResult', () => {
  const OK_TEXT = '\ngap sweep — status (corpus v2, lastSwept 2026-06-20)\n\n✓ invariants ok\n';
  const VIOLATIONS_TEXT = '\n✗ gap-sweep invariant violations (2):\n  - duplicate capability id: x\n  - capability y missing kind\n';

  it('ok on a clean exit carrying the success marker', () => {
    const r = classifyGapSweepResult({ mode: 'status', status: 0, stdout: OK_TEXT });
    expect(r).toEqual({ mode: 'status', outcome: 'ok', report: OK_TEXT });
  });

  // The real CLI's `validate()` writes the violation block via `console.error` — STDERR — and on that path
  // prints nothing else at all (it exits before any mode branch runs). So the fixture below matches reality.
  it('violations: parsed regardless of exit code, and independent of mode', () => {
    for (const mode of GAP_SWEEP_MODES) {
      const r = classifyGapSweepResult({ mode, status: 1, stdout: '', stderr: VIOLATIONS_TEXT });
      expect(r.outcome).toBe('violations');
      expect(r.violations).toEqual(['duplicate capability id: x', 'capability y missing kind']);
    }
  });

  /**
   * ★ THE FALSE-POSITIVE THIS SPLIT CLOSES. `printStatus`/`diff` echo real data (a gap's `id`, `gapNote`,
   * `coverage`) onto STDOUT, and a real run's stderr is genuinely empty on that path — so this must stay
   * `ok`. A version of this function that matched the violations regex against `stdout` too (or against the
   * concatenation of both streams) would read a status report's own DATA as the CLI's own error block, the
   * moment that data happened to contain matching text. Only stderr may ever produce `violations`.
   */
  it('ok, even when stdout DATA happens to contain text shaped like the violations block', () => {
    const trap = `${OK_TEXT}\n✗ gap-sweep invariant violations (1):\n  - this is just a gap's gapNote text, not a real error\n`;
    const r = classifyGapSweepResult({ mode: 'status', status: 0, stdout: trap, stderr: '' });
    expect(r.outcome).toBe('ok');
  });

  it('unrun: non-zero exit with NO parseable violations block is a crash, never `violations`', () => {
    const crash = 'Error: ENOENT: no such file or directory, open \'nope.json\'\n    at readFileSync…';
    const r = classifyGapSweepResult({ mode: 'diff', status: 1, stdout: '', stderr: crash });
    expect(r.outcome).toBe('unrun');
    expect(r.reason).toMatch(/exit 1/);
  });

  it('unrun: exit 0 with no "invariants ok" marker is not silently `ok`', () => {
    const r = classifyGapSweepResult({ mode: 'status', status: 0, stdout: 'nothing recognisable\n' });
    expect(r.outcome).toBe('unrun');
  });

  it('unrun: a runner error never reads as `ok` or `violations`', () => {
    const r = classifyGapSweepResult({ mode: 'status', error: new Error('spawn ENOENT') });
    expect(r.outcome).toBe('unrun');
    expect(r.reason).toMatch(/runner error/);
  });

  it('unrun: a killed process is not a failure anybody observed', () => {
    const r = classifyGapSweepResult({ mode: 'status', signal: 'SIGTERM' });
    expect(r.outcome).toBe('unrun');
    expect(r.reason).toMatch(/killed by SIGTERM/);
  });

  it('snapshot mode extracts the written path', () => {
    const text = `snapshot written: reports/gap-sweep-snapshots/2026-06-20.json\n\n${OK_TEXT}`;
    const r = classifyGapSweepResult({ mode: 'snapshot', status: 0, stdout: text });
    expect(r.snapshotPath).toBe('reports/gap-sweep-snapshots/2026-06-20.json');
  });

  it('diff mode reports noop true/false from the CLI\'s own marker', () => {
    const noop = classifyGapSweepResult({ mode: 'diff', status: 0, stdout: `✓ no-op delta — idempotent\n${OK_TEXT}` });
    expect(noop.noop).toBe(true);
    const changed = classifyGapSweepResult({ mode: 'diff', status: 0, stdout: `→ changes detected\n${OK_TEXT}` });
    expect(changed.noop).toBe(false);
  });
});

describe('the declaration', () => {
  it('exposes the three modes and requires no `checkout` — the CLI reports on its own repo only', () => {
    const decl = gapSweepStatusOperation();
    expect(decl.name).toBe(GAP_SWEEP_STATUS_OP);
    expect(Object.keys(decl.input)).toEqual(['mode', 'baseline']);
    expect(decl.input.mode.default).toBe('status');
    expect(decl.input.mode.enum).toEqual([...GAP_SWEEP_MODES]);
    expect(decl.input.baseline.required).toBe(false);
  });

  /**
   * THE ONE STEP IS AN EFFECT, NOT A COMPUTE — same load-bearing assertion `mutation-check.test.mjs` makes
   * for its own probe, and for the same reason: `mode: 'snapshot'` writes a file, so a `compute`
   * classification would put it on `./http-adapter.mjs`'s GET-only surface. Pinning the kind here is what
   * stops a later "simplification" from quietly reopening that.
   */
  it('declares its run as an EFFECT, so it is never served on the read-only GET surface', () => {
    const decl = gapSweepStatusOperation();
    const kinds = Object.fromEntries(decl.steps.map((s) => [s.name, s.step.kind]));
    expect(kinds.run).toBe('effect');
    expect(kinds.assess).toBe('compute');
  });

  it('drives end to end through the engine for a real-shaped `ok` result', async () => {
    const registry = createRegistry();
    registry.register(gapSweepStatusOperation());
    const sinks = { [GAP_SWEEP_STATUS_EFFECT]: async () => ({ mode: 'status', outcome: 'ok', report: '…' }) };
    let run = advanceWhileRunning(startRun({
      op: GAP_SWEEP_STATUS_OP, id: 'run-gs', input: {}, registry,
    }), { registry });
    ({ run } = await applyPendingEffects(run, { registry, sinks, store: createMemoryRunStore() }));
    run = advanceWhileRunning(run, { registry });
    expect(run.verdict.ok).toBe(true);
    expect(run.verdict.outcome).toBe('ok');
  });

  it('drives end to end for a `violations` result — NOT ok, blocking is populated', async () => {
    const registry = createRegistry();
    registry.register(gapSweepStatusOperation());
    const sinks = {
      [GAP_SWEEP_STATUS_EFFECT]: async () => ({ mode: 'status', outcome: 'violations', violations: ['bad'] }),
    };
    let run = advanceWhileRunning(startRun({
      op: GAP_SWEEP_STATUS_OP, id: 'run-gs2', input: {}, registry,
    }), { registry });
    ({ run } = await applyPendingEffects(run, { registry, sinks, store: createMemoryRunStore() }));
    run = advanceWhileRunning(run, { registry });
    expect(run.verdict.ok).toBe(false);
    expect(run.verdict.blocking).toEqual([{ why: 'invariant-violation', detail: 'bad' }]);
  });

  /**
   * The refusal lives in the effect's OWN `effects` builder, which runs before any sink is reached — so it
   * throws synchronously out of `advanceWhileRunning`, the same place a malformed declaration input throws
   * anywhere else in this engine. Asserted as a throw, not as a "no verdict" run state: no sink is ever
   * invoked, so there is nothing for `applyPendingEffects` to apply or fail.
   */
  it('mode: diff with no baseline refuses BEFORE any sink could be reached', () => {
    const registry = createRegistry();
    registry.register(gapSweepStatusOperation());
    expect(() => advanceWhileRunning(startRun({
      op: GAP_SWEEP_STATUS_OP, id: 'run-gs3', input: { mode: 'diff' }, registry,
    }), { registry })).toThrow(/requires a non-empty `baseline`/);
  });

  it('a failed run effect yields NO verdict — it does not fall through to one', async () => {
    const registry = createRegistry();
    registry.register(gapSweepStatusOperation());
    const sinks = { [GAP_SWEEP_STATUS_EFFECT]: async () => { throw new Error('run blew up'); } };
    let run = advanceWhileRunning(startRun({
      op: GAP_SWEEP_STATUS_OP, id: 'run-gs4', input: {}, registry,
    }), { registry });
    ({ run } = await applyPendingEffects(run, { registry, sinks, store: createMemoryRunStore() }));
    const after = advanceWhileRunning(run, { registry });
    expect(after.verdict ?? null).toBeNull();
  });
});

/** Every outcome this module claims to be exhaustive over, sanity-checked in one place. */
it('GAP_SWEEP_OUTCOMES is exactly the three outcomes used above', () => {
  expect(GAP_SWEEP_OUTCOMES).toEqual(['ok', 'violations', 'unrun']);
});
