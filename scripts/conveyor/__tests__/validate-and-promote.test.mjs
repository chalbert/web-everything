/**
 * @file scripts/conveyor/__tests__/validate-and-promote.test.mjs
 * @description The suite for {@link ../validate-and-promote.mjs} (epic #3383), in four parts:
 *
 *   1. THE PURE DECISION TABLE — `decideDeps`, `classifyValidation`, `decidePromotion`, `decideCleanup`,
 *      `outputTail` — plain objects in, verdicts out, no clone and no driver anywhere.
 *   2. THE TWO CLI CONTRACTS THIS OPERATION DEPENDS ON, asserted rather than trusted: the argv it builds for
 *      `driver-watchdog.mjs record-good` and for `run.mjs restart-runner`. Both are OTHER files' contracts;
 *      a test is the only thing that notices when one of them moves.
 *   3. THE TWO PATHS THAT MATTER — validation passes ⇒ `record-good` is called with the OUTGOING sha and
 *      `restart-runner` is called; validation fails ⇒ NEITHER is called and the failure is reported by name.
 *   4. PURITY, as a STATIC IMPORT-GRAPH FACT (`we:scripts/operations/__tests__/import-graph.mjs`) — this file
 *      decides whether a commit can be trusted, so the bug class it judges must not be in its own scope.
 *
 * NOTHING IS STARTED. No runner, no supervisor, no `npm`, no `git clone`, no `claude`, no real reset. Every
 * process and filesystem boundary is injected.
 */
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';

import { importGraph } from '../../operations/__tests__/import-graph.mjs';
import {
  DRIVER_SURFACE, REQUIRED_CHECKS, OUTPUT_TAIL_LINES, PROBE_FILENAME, DISPATCH_PROBE_SRC,
  outputTail, decideDeps, classifyValidation, decidePromotion, decideCleanup,
  recordGoodArgv, restartRunnerArgv,
  createScratchCheckout, ensureDeps, runCheck, runValidation, promoteDriver, validateAndPromote,
  promoteLogPath, CONTROL_REPO_ROOT, main,
} from '../validate-and-promote.mjs';

const OUTGOING = 'aaaabbbbccccddddeeeeffff0000111122223333';
const TARGET = '99998888777766665555444433332222111100aa';
const DRIVER = '/tmp/fake-driver';

/** Every required check, passing. Tests below perturb exactly one row so a verdict change is attributable. */
const greenChecks = (over = []) => {
  const rows = REQUIRED_CHECKS.map((name) => ({ name, ok: true, status: 0, detail: 'passed', output: '' }));
  for (const o of over) {
    const i = rows.findIndex((r) => r.name === o.name);
    if (i >= 0) rows[i] = { ...rows[i], ...o };
  }
  return rows;
};

const okVerdict = () => classifyValidation(greenChecks());
const cleanDriver = (sha = OUTGOING) => ({ sha, dirty: false });

// ── (1) the pure decision table ─────────────────────────────────────────────────────────────────────────────

describe('outputTail — the last non-blank lines, so a failure report is never a wall of padding', () => {
  it('keeps only the trailing N non-empty lines', () => {
    const text = ['a', '', 'b', '   ', 'c', 'd'].join('\n');
    expect(outputTail(text, 2)).toBe('c\nd');
  });

  it('is empty, never a throw, for empty or nullish output', () => {
    expect(outputTail('')).toBe('');
    expect(outputTail(null)).toBe('');
    expect(outputTail(undefined)).toBe('');
  });

  it('defaults to OUTPUT_TAIL_LINES', () => {
    const text = Array.from({ length: 100 }, (_, i) => `line-${i}`).join('\n');
    expect(outputTail(text).split('\n')).toHaveLength(OUTPUT_TAIL_LINES);
  });
});

describe('decideDeps — borrow node_modules only when the lockfiles are byte-identical', () => {
  it('links when the two lockfiles match exactly', () => {
    expect(decideDeps({ sourceLock: '{"x":1}', candidateLock: '{"x":1}' }).mode).toBe('link');
  });

  it('installs when the candidate\'s lockfile differs — a borrowed tree would not describe it', () => {
    const d = decideDeps({ sourceLock: '{"x":1}', candidateLock: '{"x":2}' });
    expect(d.mode).toBe('install');
    expect(d.reason).toMatch(/differs/);
  });

  it('installs when either lockfile is UNREADABLE — "could not compare" must not read as "the same"', () => {
    expect(decideDeps({ sourceLock: null, candidateLock: '{"x":1}' }).mode).toBe('install');
    expect(decideDeps({ sourceLock: '{"x":1}', candidateLock: null }).mode).toBe('install');
    expect(decideDeps({}).mode).toBe('install');
  });
});

describe('classifyValidation — every required check must be PRESENT and passing', () => {
  it('validates when all five pass', () => {
    const v = classifyValidation(greenChecks());
    expect(v.validated).toBe(true);
    expect(v.ran).toEqual([...REQUIRED_CHECKS]);
    expect(v.failed).toEqual([]);
  });

  it('fails, naming the check and its exit status, when one fails', () => {
    const v = classifyValidation(greenChecks([{ name: 'standards', ok: false, status: 1, detail: 'exited 1', output: '3 errors' }]));
    expect(v.validated).toBe(false);
    expect(v.reason).toContain('`standards` check failed');
    expect(v.reason).toContain('exit 1');
    expect(v.failed).toEqual([{ name: 'standards', status: 1, detail: 'exited 1', output: '3 errors' }]);
  });

  it('names the FIRST failure and counts the rest, so the report has one headline cause', () => {
    const v = classifyValidation(greenChecks([
      { name: 'tests', ok: false, status: 1, detail: 'exited 1' },
      { name: 'dispatch-probe', ok: false, status: 1, detail: 'exited 1' },
    ]));
    expect(v.reason).toContain('`tests` check failed');
    expect(v.reason).toContain('+1 more: dispatch-probe');
  });

  it('a check that never RAN is a failure, not a pass — the point of REQUIRED_CHECKS', () => {
    const v = classifyValidation(greenChecks().filter((c) => c.name !== 'dispatch-probe'));
    expect(v.validated).toBe(false);
    expect(v.missing).toEqual(['dispatch-probe']);
    expect(v.reason).toContain('never ran');
  });

  it('an empty run is NOT validated', () => {
    expect(classifyValidation([]).validated).toBe(false);
    expect(classifyValidation(null).validated).toBe(false);
  });

  it('the dispatch probe is one of the required checks — a green suite alone is not enough', () => {
    expect(REQUIRED_CHECKS).toContain('dispatch-probe');
  });
});

describe('decidePromotion — and WHICH sha record-good names', () => {
  it('promotes, and records the OUTGOING commit (never the validated target) as last-known-good', () => {
    const d = decidePromotion({ verdict: okVerdict(), target: TARGET, driver: cleanDriver() });
    expect(d.promote).toBe(true);
    expect(d.targetSha).toBe(TARGET);
    // THE load-bearing assertion of this whole file: recording the TARGET would make HEAD === lastKnownGood
    // after the reset, which `driver-watchdog.mjs#decideRollback` refuses to roll back from — forever.
    expect(d.recordSha).toBe(OUTGOING);
    expect(d.recordSha).not.toBe(TARGET);
  });

  it('refuses when the candidate was not validated, and says the driver is untouched', () => {
    const v = classifyValidation(greenChecks([{ name: 'tests', ok: false, status: 1, detail: 'exited 1' }]));
    const d = decidePromotion({ verdict: v, target: TARGET, driver: cleanDriver() });
    expect(d.promote).toBe(false);
    expect(d.guard).toBe('validation-failed');
    expect(d.recordSha).toBeNull();
    expect(d.reason).toMatch(/marker is untouched/);
  });

  it('refuses a DIRTY driver checkout — the reset would destroy whatever is uncommitted there', () => {
    const d = decidePromotion({ verdict: okVerdict(), target: TARGET, driver: { sha: OUTGOING, dirty: true } });
    expect(d.guard).toBe('dirty-driver-checkout');
    expect(d.promote).toBe(false);
  });

  it('refuses an UNREADABLE tree state — a reset that cannot be proven non-destructive is not attempted', () => {
    expect(decidePromotion({ verdict: okVerdict(), target: TARGET, driver: { sha: OUTGOING, dirty: null } }).guard).toBe('unknown-tree');
  });

  it('refuses an unreadable driver HEAD — that head IS the fallback about to be recorded', () => {
    const d = decidePromotion({ verdict: okVerdict(), target: TARGET, driver: { sha: null, dirty: false } });
    expect(d.guard).toBe('unknown-driver-head');
    expect(d.reason).toMatch(/fallback/);
  });

  it('refuses a target that is not a commit id', () => {
    expect(decidePromotion({ verdict: okVerdict(), target: 'not-a-sha', driver: cleanDriver() }).guard).toBe('unknown-target');
  });

  it('is a NO-OP when the driver is already at the target — never records HEAD as its own fallback', () => {
    const d = decidePromotion({ verdict: okVerdict(), target: TARGET, driver: cleanDriver(TARGET) });
    expect(d.promote).toBe(false);
    expect(d.guard).toBe('already-at-target');
    expect(d.recordSha).toBeNull();
  });

  it('treats an abbreviated head as the same commit (either side may be the short form)', () => {
    expect(decidePromotion({ verdict: okVerdict(), target: TARGET, driver: cleanDriver(TARGET.slice(0, 12)) }).guard).toBe('already-at-target');
  });
});

describe('decideCleanup — keep the throwaway clone exactly when someone might need to look at it', () => {
  it('removes it on a pass', () => {
    expect(decideCleanup({ validated: true }).remove).toBe(true);
  });

  it('KEEPS it on a failure, so the failing check can be reproduced in the tree it failed in', () => {
    const c = decideCleanup({ validated: false });
    expect(c.remove).toBe(false);
    expect(c.reason).toMatch(/FAILED/);
  });

  it('--keep wins over a pass', () => {
    expect(decideCleanup({ validated: true, keep: true }).remove).toBe(false);
  });
});

// ── (2) the two CLI contracts this operation depends on ─────────────────────────────────────────────────────

describe('the argv shapes — asserted, because both belong to OTHER files', () => {
  it('record-good matches driver-watchdog.mjs\'s own CLI: verb, --checkout, --sha, --note, --json', () => {
    expect(recordGoodArgv({ watchdogCli: '/repo/scripts/conveyor/driver-watchdog.mjs', driver: DRIVER, sha: OUTGOING, note: 'why' }))
      .toEqual([
        '/repo/scripts/conveyor/driver-watchdog.mjs',
        'record-good',
        `--checkout=${DRIVER}`,
        `--sha=${OUTGOING}`,
        '--note=why',
        '--json',
      ]);
  });

  it('restart-runner matches run.mjs\'s declared-operation CLI: verb, --checkout, --supervisor — and NO --force', () => {
    const argv = restartRunnerArgv({ runnerCli: '/repo/scripts/operations/run.mjs', driver: DRIVER });
    expect(argv).toEqual([
      '/repo/scripts/operations/run.mjs',
      'restart-runner',
      `--checkout=${DRIVER}`,
      `--supervisor=${join(DRIVER, 'skills-src', 'conveyor', 'supervisor.mjs')}`,
    ]);
    expect(argv).not.toContain('--force');
  });

  it('the watchdog\'s record-good really does accept every flag this file passes it', async () => {
    // Read through the watchdog's OWN usage text rather than restating the contract here — if its CLI moves,
    // this fails instead of this file quietly building argv nothing understands.
    const wd = await import('../driver-watchdog.mjs');
    const parsed = wd.parseFlags(recordGoodArgv({ watchdogCli: 'x', driver: DRIVER, sha: OUTGOING, note: 'n' }).slice(2));
    expect(parsed.flags).toEqual({ checkout: DRIVER, sha: OUTGOING, note: 'n', json: true });
  });
});

// ── (3) the success and failure paths ───────────────────────────────────────────────────────────────────────

/** A recording promoter stub plus the calls it saw, so a test can assert what DID and DID NOT happen. */
const spyPromote = () => {
  const calls = [];
  const fn = (args) => { calls.push(args); return { recorded: true, recordSha: args.recordSha, reset: true, restarted: true, targetSha: args.targetSha, steps: [], error: null }; };
  return { fn, calls };
};

/** A `validate` stub that returns whichever check rows it is given, with no clone anywhere. */
const stubValidation = (checks) => ({ sha, dir }) => ({ sha, dir, checks });

const baseRun = (over = {}) => ({
  driver: DRIVER,
  sha: TARGET,
  source: '/repo',
  scratchRoot: '/tmp/scratch',
  resolveSha: () => TARGET,
  readDriverHead: () => cleanDriver(),
  cleanup: () => true,
  appendLog: () => {},
  notify: () => {},
  now: () => 1_757_700_000_000,
  ...over,
});

describe('THE SUCCESS PATH — validation passes ⇒ record-good with the outgoing sha, then restart-runner', () => {
  it('promotes, records the OUTGOING sha, and reports `promoted`', () => {
    const promote = spyPromote();
    const r = validateAndPromote(baseRun({ validate: stubValidation(greenChecks()), promote: promote.fn }));

    expect(r.verdict.validated).toBe(true);
    expect(r.action).toBe('promoted');
    expect(promote.calls).toHaveLength(1);
    expect(promote.calls[0].targetSha).toBe(TARGET);
    expect(promote.calls[0].recordSha).toBe(OUTGOING);
    expect(promote.calls[0].note).toContain(TARGET.slice(0, 12));
  });

  it('removes the throwaway clone on a pass, and reports where it was', () => {
    const removed = [];
    const r = validateAndPromote(baseRun({
      validate: stubValidation(greenChecks()), promote: spyPromote().fn,
      cleanup: (dir) => { removed.push(dir); return true; },
    }));
    expect(removed).toEqual([r.scratch.dir]);
    expect(r.scratch.removed).toBe(true);
  });

  it('writes the outcome into the DRIVER\'s own promote log — a commit change must not live only in a return value', () => {
    const lines = [];
    validateAndPromote(baseRun({
      validate: stubValidation(greenChecks()), promote: spyPromote().fn,
      appendLog: (path, line) => lines.push([path, line]),
    }));
    expect(lines.every(([p]) => p === promoteLogPath(DRIVER))).toBe(true);
    expect(lines.map(([, l]) => l).join('\n')).toContain('[promoted]');
  });

  it('--dry-run validates and decides but promotes NOTHING', () => {
    const promote = spyPromote();
    const r = validateAndPromote(baseRun({ validate: stubValidation(greenChecks()), promote: promote.fn, dryRun: true }));
    expect(r.decision.promote).toBe(true);
    expect(r.action).toBe('dry-run');
    expect(promote.calls).toEqual([]);
  });

  it('a driver already at the target is a NO-OP — not a promotion, and not a failure', () => {
    const promote = spyPromote();
    const r = validateAndPromote(baseRun({
      validate: stubValidation(greenChecks()), promote: promote.fn, readDriverHead: () => cleanDriver(TARGET),
    }));
    expect(r.action).toBe('no-op');
    expect(promote.calls).toEqual([]);
  });

  it('reports `promoted-not-restarted` — never plain `promoted` — when restart-runner refused', () => {
    const r = validateAndPromote(baseRun({
      validate: stubValidation(greenChecks()),
      promote: (a) => ({ recorded: true, recordSha: a.recordSha, reset: true, restarted: false, targetSha: a.targetSha, steps: [], error: 'restart-runner exited 1' }),
    }));
    expect(r.action).toBe('promoted-not-restarted');
  });
});

describe('THE FAILURE PATH — validation fails ⇒ NOTHING is recorded and NOTHING is restarted', () => {
  const failing = greenChecks([{ name: 'dispatch-probe', ok: false, status: 1, detail: 'exited 1', output: 'dispatch-probe: STUCK CLOSED — ... produced 0 launch(es), expected 2' }]);

  it('calls neither record-good nor restart-runner', () => {
    const promote = spyPromote();
    const r = validateAndPromote(baseRun({ validate: stubValidation(failing), promote: promote.fn }));
    expect(r.verdict.validated).toBe(false);
    expect(r.action).toBe('validation-failed');
    expect(promote.calls).toEqual([]);
    expect(r.promotion).toBeNull();
  });

  it('reports WHICH check failed, why, and the tail of its output', () => {
    const r = validateAndPromote(baseRun({ validate: stubValidation(failing), promote: spyPromote().fn }));
    expect(r.verdict.reason).toContain('`dispatch-probe` check failed');
    expect(r.verdict.failed[0].output).toContain('STUCK CLOSED');
    expect(r.decision.guard).toBe('validation-failed');
  });

  it('KEEPS the throwaway clone for inspection and says so', () => {
    const removed = [];
    const r = validateAndPromote(baseRun({
      validate: stubValidation(failing), promote: spyPromote().fn, cleanup: (d) => { removed.push(d); return true; },
    }));
    expect(removed).toEqual([]);
    expect(r.scratch.kept).toBe(true);
    expect(r.scratch.dir).toContain(TARGET.slice(0, 12));
  });

  it('a sha that does not resolve refuses before any clone, driver read or promotion', () => {
    const promote = spyPromote();
    let validated = false;
    const r = validateAndPromote(baseRun({
      resolveSha: () => null,
      validate: () => { validated = true; return { checks: [] }; },
      promote: promote.fn,
    }));
    expect(validated).toBe(false);
    expect(promote.calls).toEqual([]);
    expect(r.decision.guard).toBe('unknown-target');
  });

  it('with NO driver named it reads no checkout, logs nothing, notifies nobody, and reports `validated`', () => {
    const logged = [];
    const notified = [];
    let headRead = false;
    const r = validateAndPromote(baseRun({
      driver: null,
      validate: stubValidation(greenChecks()),
      promote: spyPromote().fn,
      readDriverHead: () => { headRead = true; return cleanDriver(); },
      appendLog: (...a) => logged.push(a),
      notify: (...a) => notified.push(a),
    }));
    expect(headRead).toBe(false);
    expect(logged).toEqual([]);
    expect(notified).toEqual([]);
    expect(r.driver).toBeNull();
    expect(r.decision.guard).toBe('validate-only');
    expect(r.action).toBe('validated');
  });

  it('a dirty driver checkout stops the promotion even though the candidate validated', () => {
    const promote = spyPromote();
    const r = validateAndPromote(baseRun({
      validate: stubValidation(greenChecks()), promote: promote.fn, readDriverHead: () => ({ sha: OUTGOING, dirty: true }),
    }));
    expect(r.verdict.validated).toBe(true);
    expect(r.action).toBe('refused');
    expect(promote.calls).toEqual([]);
  });
});

// ── the promotion sequence itself, with every process boundary injected ─────────────────────────────────────

/** A git stub whose per-subcommand answers a test can steer; records every invocation. */
const gitStub = (answers = {}) => {
  const calls = [];
  const fn = (args, cwd) => {
    calls.push({ args, cwd });
    const key = args.slice(0, 2).join(' ');
    const hit = answers[key] ?? answers[args[0]] ?? { ok: true, stdout: '', stderr: '' };
    return typeof hit === 'function' ? hit(args, cwd) : hit;
  };
  return { fn, calls };
};

/** A spawn stub: `answers` maps a marker substring in the argv to an exit status. */
const runStub = (answers = {}) => {
  const calls = [];
  const fn = (cmd, args, opts) => {
    calls.push({ cmd, args, opts });
    const key = Object.keys(answers).find((k) => args.some((a) => String(a).includes(k)));
    return { status: key ? answers[key] : 0, stdout: '', stderr: '', signal: null };
  };
  return { fn, calls };
};

describe('promoteDriver — record-good FIRST, then fetch/verify, then reset, then restart-runner', () => {
  it('runs all four steps in order and reports restarted', () => {
    const git = gitStub();
    const run = runStub();
    const out = promoteDriver({ driver: DRIVER, targetSha: TARGET, recordSha: OUTGOING, git: git.fn, run: run.fn });

    expect(out.recorded).toBe(true);
    expect(out.reset).toBe(true);
    expect(out.restarted).toBe(true);
    expect(out.steps.map((s) => s.step)).toEqual(['record-good', 'fetch', 'verify-target', 'reset', 'restart-runner']);
    // record-good is the FIRST subprocess, and it names the outgoing sha while it is still the driver's HEAD.
    expect(run.calls[0].args).toContain('record-good');
    expect(run.calls[0].args).toContain(`--sha=${OUTGOING}`);
    expect(run.calls[1].args).toContain('restart-runner');
    expect(git.calls.map((c) => c.args[0])).toEqual(['fetch', 'rev-parse', 'reset']);
  });

  it('a failed record-good aborts BEFORE any git touches the driver', () => {
    const git = gitStub();
    const run = runStub({ 'record-good': 1 });
    const out = promoteDriver({ driver: DRIVER, targetSha: TARGET, recordSha: OUTGOING, git: git.fn, run: run.fn });

    expect(out.recorded).toBe(false);
    expect(out.reset).toBe(false);
    expect(out.restarted).toBe(false);
    expect(git.calls).toEqual([]);
    expect(run.calls).toHaveLength(1);
    expect(out.error).toMatch(/NOTHING was promoted/);
  });

  it('an unreachable target aborts before the reset — no half-moved checkout', () => {
    const git = gitStub({ 'rev-parse --verify': { ok: false, stdout: '', stderr: 'bad object' } });
    const run = runStub();
    const out = promoteDriver({ driver: DRIVER, targetSha: TARGET, recordSha: OUTGOING, git: git.fn, run: run.fn });

    expect(out.recorded).toBe(true);
    expect(out.reset).toBe(false);
    expect(git.calls.some((c) => c.args[0] === 'reset')).toBe(false);
    expect(run.calls.some((c) => c.args.includes('restart-runner'))).toBe(false);
    expect(out.error).toMatch(/does not have commit/);
  });

  it('a failed reset never reaches restart-runner — the driver keeps running its old code', () => {
    const git = gitStub({ reset: { ok: false, stdout: '', stderr: 'permission denied' } });
    const run = runStub();
    const out = promoteDriver({ driver: DRIVER, targetSha: TARGET, recordSha: OUTGOING, git: git.fn, run: run.fn });

    expect(out.reset).toBe(false);
    expect(run.calls.some((c) => c.args.includes('restart-runner'))).toBe(false);
    expect(out.error).toMatch(/still running it/);
  });

  it('a refused restart-runner is reported as an error, not swallowed as a success', () => {
    const out = promoteDriver({
      driver: DRIVER, targetSha: TARGET, recordSha: OUTGOING,
      git: gitStub().fn, run: runStub({ 'restart-runner': 1 }).fn,
    });
    expect(out.reset).toBe(true);
    expect(out.restarted).toBe(false);
    expect(out.error).toMatch(/OLD process is still resident/);
  });
});

// ── the validation pass, with every boundary injected ───────────────────────────────────────────────────────

describe('runValidation — the five checks, in order, stopping at the first failure', () => {
  const okGit = () => gitStub({ 'rev-parse': { ok: true, stdout: `${TARGET}\n`, stderr: '' } });

  it('runs all five and reports each one', () => {
    const written = [];
    const out = runValidation({
      source: '/repo', sha: TARGET, dir: '/tmp/scratch/x',
      git: okGit().fn, run: runStub().fn, linkFn: () => {}, readLock: () => '{"same":1}',
      writeProbe: (p, s) => written.push([p, s]),
    });
    expect(out.checks.map((c) => c.name)).toEqual([...REQUIRED_CHECKS]);
    expect(classifyValidation(out.checks).validated).toBe(true);
    expect(written[0][0]).toBe(join('/tmp/scratch/x', PROBE_FILENAME));
    expect(written[0][1]).toBe(DISPATCH_PROBE_SRC);
  });

  it('narrows the suite to the DRIVER SURFACE by default, and drops the narrowing under --full', () => {
    const run = runStub();
    runValidation({ source: '/repo', sha: TARGET, dir: '/tmp/s', git: okGit().fn, run: run.fn, linkFn: () => {}, readLock: () => 'same', writeProbe: () => {} });
    const narrowed = run.calls.find((c) => c.args.includes('test:unit'));
    expect(narrowed.args).toEqual(['run', 'test:unit', '--', ...DRIVER_SURFACE]);

    const run2 = runStub();
    runValidation({ source: '/repo', sha: TARGET, dir: '/tmp/s', full: true, git: okGit().fn, run: run2.fn, linkFn: () => {}, readLock: () => 'same', writeProbe: () => {} });
    expect(run2.calls.find((c) => c.args.includes('test:unit')).args).toEqual(['run', 'test:unit']);
  });

  it('stops at the first failure — a bad clone never costs a suite run', () => {
    const run = runStub();
    const out = runValidation({
      source: '/repo', sha: TARGET, dir: '/tmp/s',
      git: gitStub({ clone: { ok: false, stdout: '', stderr: 'fatal: destination exists' } }).fn,
      run: run.fn, linkFn: () => {}, readLock: () => 'same', writeProbe: () => {},
    });
    expect(out.checks.map((c) => c.name)).toEqual(['checkout']);
    expect(run.calls).toEqual([]);
    expect(classifyValidation(out.checks).validated).toBe(false);
  });

  it('a failing dispatch probe fails the whole validation even with a green suite', () => {
    const out = runValidation({
      source: '/repo', sha: TARGET, dir: '/tmp/s', git: okGit().fn,
      run: runStub({ [PROBE_FILENAME]: 1 }).fn, linkFn: () => {}, readLock: () => 'same', writeProbe: () => {},
    });
    const v = classifyValidation(out.checks);
    expect(v.validated).toBe(false);
    expect(v.reason).toContain('`dispatch-probe`');
  });
});

describe('createScratchCheckout — validate the sha that was asked for, or nothing', () => {
  it('refuses when the clone landed on a DIFFERENT commit', () => {
    const row = createScratchCheckout({
      source: '/repo', sha: TARGET, dir: '/tmp/s',
      git: gitStub({ 'rev-parse': { ok: true, stdout: `${OUTGOING}\n`, stderr: '' } }).fn,
    });
    expect(row.ok).toBe(false);
    expect(row.detail).toMatch(/refusing to validate the wrong code/);
  });

  it('accepts an abbreviated request that HEAD extends', () => {
    const row = createScratchCheckout({
      source: '/repo', sha: TARGET.slice(0, 12), dir: '/tmp/s',
      git: gitStub({ 'rev-parse': { ok: true, stdout: `${TARGET}\n`, stderr: '' } }).fn,
    });
    expect(row.ok).toBe(true);
    expect(row.sha).toBe(TARGET);
  });

  it('reports a failed checkout rather than throwing', () => {
    const row = createScratchCheckout({
      source: '/repo', sha: TARGET, dir: '/tmp/s',
      git: gitStub({ checkout: { ok: false, stdout: '', stderr: 'error: pathspec' } }).fn,
    });
    expect(row.ok).toBe(false);
    expect(row.detail).toMatch(/could not check out/);
  });

  it('re-points the clone\'s `origin/main` at the SOURCE\'s upstream main, not at its local branch', () => {
    // Found by the FIRST LIVE RUN of this operation. `git clone <local path>` maps the source's refs/heads/*
    // onto the clone's refs/remotes/origin/*, so `origin/main` became the LANE branch and `check:standards`
    // reported two "this backlog file is on main with a non-numeric id" errors that were pure artefact of the
    // clone, not a property of the candidate. The refspec below is the fix, pinned here so it cannot regress.
    const git = gitStub({ 'rev-parse': { ok: true, stdout: `${TARGET}\n`, stderr: '' } });
    createScratchCheckout({ source: '/repo', sha: TARGET, dir: '/tmp/s', git: git.fn });
    const fetch = git.calls.find((c) => c.args[0] === 'fetch');
    expect(fetch.args).toContain('+refs/remotes/origin/*:refs/remotes/origin/*');
    expect(fetch.cwd).toBe('/tmp/s');
  });
});

describe('ensureDeps — the route taken is reported, because the two are not the same evidence', () => {
  it('links on matching lockfiles and says so', () => {
    const linked = [];
    const row = ensureDeps({ source: '/repo', dir: '/tmp/s', readLock: () => 'same', link: (a, b) => linked.push([a, b]), run: runStub().fn });
    expect(row.mode).toBe('link');
    expect(linked).toEqual([[join('/repo', 'node_modules'), join('/tmp/s', 'node_modules')]]);
  });

  it('installs on differing lockfiles', () => {
    const run = runStub();
    const row = ensureDeps({ source: '/repo', dir: '/tmp/s', readLock: (p) => (p.startsWith('/repo') ? 'a' : 'b'), link: () => {}, run: run.fn });
    expect(row.mode).toBe('install');
    expect(run.calls[0].args).toEqual(['ci', '--silent']);
  });

  it('falls back to a real install when the symlink itself fails — the slow path is always correct', () => {
    const run = runStub();
    const row = ensureDeps({ source: '/repo', dir: '/tmp/s', readLock: () => 'same', link: () => { throw new Error('EEXIST'); }, run: run.fn });
    expect(row.mode).toBe('install');
    expect(run.calls[0].args).toEqual(['ci', '--silent']);
  });
});

describe('runCheck — a subprocess result becomes a uniform check row', () => {
  it('captures stdout AND stderr on failure (vitest uses one, the gate uses the other)', () => {
    const row = runCheck({ name: 'tests', cmd: 'npm', args: ['x'], cwd: '/tmp', run: () => ({ status: 1, stdout: 'out-line', stderr: 'err-line', signal: null }) });
    expect(row.ok).toBe(false);
    expect(row.output).toContain('out-line');
    expect(row.output).toContain('err-line');
  });

  it('reports a timeout as a named failure, not an exception', () => {
    const row = runCheck({
      name: 'tests', cmd: 'npm', args: ['x'], cwd: '/tmp', timeoutMs: 60_000,
      run: () => ({ status: null, stdout: '', stderr: '', signal: 'SIGTERM' }),
    });
    expect(row.ok).toBe(false);
    expect(row.detail).toMatch(/timed out/);
  });

  it('carries no output at all when the check passed', () => {
    const row = runCheck({ name: 'standards', cmd: 'npm', args: ['x'], cwd: '/tmp', run: () => ({ status: 0, stdout: 'lots', stderr: '', signal: null }) });
    expect(row).toMatchObject({ ok: true, status: 0, detail: 'passed', output: '' });
  });
});

// ── the CLI ─────────────────────────────────────────────────────────────────────────────────────────────────

describe('main — the two verbs, and the read-only promise of `validate`', () => {
  const capture = () => { const out = []; return { sink: (s) => out.push(s), text: () => out.join('') }; };

  it('`validate` is handed a promoter that THROWS, so its read-only promise does not rest on one flag', () => {
    let seen = null;
    const o = capture();
    main(['validate', `--sha=${TARGET}`], { run: (args) => { seen = args; return { verdict: { validated: true }, decision: {}, validation: { checks: [] } }; }, stdout: o.sink, stderr: o.sink });
    expect(seen.dryRun).toBe(true);
    expect(() => seen.promote()).toThrow(/never promotes/);
  });

  it('`validate` leaves --driver NULL, so the read-only verb reads no checkout at all', () => {
    let seen = null;
    const o = capture();
    main(['validate', `--sha=${TARGET}`], { run: (args) => { seen = args; return { verdict: { validated: true }, decision: {}, validation: { checks: [] } }; }, stdout: o.sink, stderr: o.sink });
    expect(seen.driver).toBeNull();
  });

  it('`promote` passes no promoter override, so the real sequence runs', () => {
    let seen = null;
    const o = capture();
    main(['promote', `--sha=${TARGET}`, `--driver=${CONTROL_REPO_ROOT}`], {
      run: (args) => { seen = args; return { action: 'promoted', verdict: { validated: true }, decision: {}, validation: { checks: [] } }; },
      stdout: o.sink, stderr: o.sink,
    });
    expect(seen.promote).toBeUndefined();
    expect(seen.dryRun).toBe(false);
  });

  it('exits 2 when the candidate was not validated', () => {
    const o = capture();
    const code = main(['validate', `--sha=${TARGET}`], {
      run: () => ({ action: 'validation-failed', verdict: { validated: false, reason: 'NOT VALIDATED — the `tests` check failed', failed: [] }, decision: { reason: 'x' }, validation: { checks: [] } }),
      stdout: o.sink, stderr: o.sink,
    });
    expect(code).toBe(2);
    expect(o.text()).toContain('validation-failed');
  });

  it('exits 1 on a missing --sha and on an unknown verb, without running anything', () => {
    const o = capture();
    let ran = false;
    expect(main(['validate'], { run: () => { ran = true; }, stdout: o.sink, stderr: o.sink })).toBe(1);
    expect(main(['nonsense', `--sha=${TARGET}`], { run: () => { ran = true; }, stdout: o.sink, stderr: o.sink })).toBe(1);
    expect(ran).toBe(false);
  });

  it('--help prints usage and exits 0', () => {
    const o = capture();
    expect(main(['--help'], { run: () => { throw new Error('must not run'); }, stdout: o.sink, stderr: o.sink })).toBe(0);
    expect(o.text()).toContain('validate-and-promote');
  });
});

// ── (4) purity ──────────────────────────────────────────────────────────────────────────────────────────────

const ENTRY = join(CONTROL_REPO_ROOT, 'scripts', 'conveyor', 'validate-and-promote.mjs');
const WATCHDOG_ENTRY = join(CONTROL_REPO_ROOT, 'scripts', 'conveyor', 'driver-watchdog.mjs');

describe('PURITY — the thing deciding whether a commit can be trusted must not import the code it judges', () => {
  it('reaches EXACTLY the watchdog\'s own graph plus itself — nothing more', () => {
    // `toEqual`, not `not.toContain`: the point is that nobody can widen this file's dependency surface
    // without a test saying so. Adding a module is fine; adding one silently is not.
    const mine = importGraph(ENTRY).files.map((f) => f.split('/').pop()).sort();
    const watchdog = importGraph(WATCHDOG_ENTRY).files.map((f) => f.split('/').pop());
    expect(mine).toEqual([...new Set([...watchdog, 'validate-and-promote.mjs'])].sort());
  });

  it('reaches NONE of the driver\'s planning modules — they are subprocesses, never imports', () => {
    const names = importGraph(ENTRY).files.map((f) => f.split('/').pop());
    for (const forbidden of ['tick-core.mjs', 'dispatch-plan.mjs', 'dispatch-lane.mjs', 'registry.mjs', 'engine.mjs', 'reconcile-core.mjs', 'runner.mjs']) {
      expect(names).not.toContain(forbidden);
    }
  });

  it('pulls in no package dependency — only this repo\'s own modules and `node:` builtins', () => {
    expect(importGraph(ENTRY).external.filter((s) => !s.startsWith('node:'))).toEqual([]);
  });

  it('the dispatch probe reaches the candidate\'s planner as GENERATED source, not as an import of ours', () => {
    // The probe text mentions `dispatch-plan.mjs`, but only as a string constant executed in the throwaway
    // clone — which is exactly why the graph above stays clean. Both halves of that claim asserted together.
    expect(DISPATCH_PROBE_SRC).toContain('./scripts/readiness/dispatch-plan.mjs');
    expect(importGraph(ENTRY).files.map((f) => f.split('/').pop())).not.toContain('dispatch-plan.mjs');
  });

  it('the probe asserts BOTH directions — stuck closed and stuck open', () => {
    expect(DISPATCH_PROBE_SRC).toContain('STUCK CLOSED');
    expect(DISPATCH_PROBE_SRC).toContain('STUCK OPEN');
    expect(DISPATCH_PROBE_SRC).toContain('dispatchPaused: true');
  });
});
