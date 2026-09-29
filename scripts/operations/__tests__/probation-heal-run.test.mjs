/**
 * agy-launcher-probation — the launch half: the env switch, the provider, the router branch, and the whole heal
 * arc of `probation-heal-run.mjs` over a fake `io` (no git, no gh, no model).
 */
import { describe, expect, it, vi } from 'vitest';
import {
  PROBATION_BUILD_RUN_SCRIPT, PROBATION_HEAL_RUN_SCRIPT, probationLaunchDecision, probationLaunchFromEnv,
  probationWorkerDetachedProvider,
} from '../dispatch-providers/probation-worker.mjs';
import { routeDispatchProvider } from '../dispatch-lane-io.mjs';
import { parseArgs, runProbationHeal } from '../probation-heal-run.mjs';

const agyClaude = { id: 'antigravity-claude', provider: 'antigravity', model: 'claude-sonnet-4-6', executor: 'antigravity', launcher: 'scripts/gemini-direct-task.mjs', checker: null, taskType: 'ci-heal' };
const agyGemini = { ...agyClaude, id: 'antigravity-gemini', model: 'gemini-3.8-flash-high', checker: 'codex' };
const docFixWorker = { id: 'codex', provider: 'codex', model: 'gpt-6-astra', executor: 'codex', launcher: 'scripts/codex-direct-task.mjs', checker: null, taskType: 'doc-fix' };

describe('probationLaunchFromEnv', () => {
  it('unset → on in production, off under the test runner; an explicit value wins; a typo throws', () => {
    expect(probationLaunchFromEnv({})).toBe('on');
    expect(probationLaunchFromEnv({ VITEST: 'true' })).toBe('off');
    expect(probationLaunchFromEnv({ VITEST: 'true', WE_PROBATION_LAUNCH: 'on' })).toBe('on');
    expect(probationLaunchFromEnv({ WE_PROBATION_LAUNCH: ' OFF ' })).toBe('off');
    expect(() => probationLaunchFromEnv({ WE_PROBATION_LAUNCH: 'yes' })).toThrow(/must be `on` or `off`/);
  });
});

describe('probationLaunchDecision', () => {
  const req = { launchKind: 'ci-heal', repo: 'we', probationWorker: agyClaude };
  it('launches a WE ci-heal with a worker when on', () => expect(probationLaunchDecision(req, 'on').launch).toBe(true));
  it('never without a worker, for another kind, another repo, or when off', () => {
    expect(probationLaunchDecision({ ...req, probationWorker: null }, 'on').launch).toBe(false);
    // A `ci-heal`-taskType worker offered under a `build` request is recorded, never launched (#4291) — `build`
    // launches a `doc-fix` worker only.
    expect(probationLaunchDecision({ ...req, launchKind: 'build' }, 'on').launch).toBe(false);
    expect(probationLaunchDecision({ ...req, repo: 'frontierui' }, 'on').launch).toBe(false);
    expect(probationLaunchDecision(req, 'off').launch).toBe(false);
  });

  // #4291 — the doc-fix build launcher: `build` + a `doc-fix` worker launches; `build` + any other taskType
  // (or `ci-heal` + a `doc-fix` worker) does not.
  const buildReq = { launchKind: 'build', repo: 'we', probationWorker: docFixWorker };
  it('launches a WE doc-fix build with a doc-fix worker when on', () => expect(probationLaunchDecision(buildReq, 'on').launch).toBe(true));
  it('never for the wrong taskType, another repo, or when off', () => {
    expect(probationLaunchDecision({ ...buildReq, probationWorker: agyClaude }, 'on').launch).toBe(false);
    expect(probationLaunchDecision({ launchKind: 'ci-heal', repo: 'we', probationWorker: docFixWorker }, 'on').launch).toBe(false);
    expect(probationLaunchDecision({ ...buildReq, repo: 'frontierui' }, 'on').launch).toBe(false);
    expect(probationLaunchDecision(buildReq, 'off').launch).toBe(false);
  });
  it('an unregistered kind is recorded but never launched', () => {
    expect(probationLaunchDecision({ launchKind: 'fix', repo: 'we', probationWorker: docFixWorker }, 'on').launch).toBe(false);
  });
});

describe('probationWorkerDetachedProvider', () => {
  it('spawns the run script with the worker, returns pid:<n>, and reports the executor', () => {
    const spawned = [];
    const reportExecutor = vi.fn();
    const handle = probationWorkerDetachedProvider(
      { launchKind: 'ci-heal', pr: 2811, sessionSlug: 'ci-heal-2811', reason: 'behind', num: '4075', lane: 9, scope: ['we:a.mjs'], probationWorker: agyClaude, reportExecutor, cwd: '/scratch' },
      { spawnDetached: (argv, o) => { spawned.push({ argv, o }); return { pid: 777 }; }, logPathFor: () => '/dev/null' },
    );
    expect(handle).toBe('pid:777');
    expect(reportExecutor).toHaveBeenCalledWith('antigravity');
    const { argv, o } = spawned[0];
    expect(argv[0]).toBe(PROBATION_HEAL_RUN_SCRIPT);
    expect(argv).toEqual(expect.arrayContaining(['--pr=2811', '--session=ci-heal-2811', '--reason=behind', '--num=4075', '--lane=9', '--scope=we:a.mjs']));
    expect(JSON.parse(argv.find((a) => a.startsWith('--worker=')).slice(9))).toEqual(agyClaude);
    expect(o.cwd).toBe('/scratch');
  });
  it('refuses before any process with no PR, no slug or no worker', () => {
    const spawnDetached = vi.fn();
    for (const bad of [{ sessionSlug: 's', probationWorker: agyClaude }, { pr: 1, probationWorker: agyClaude }, { pr: 1, sessionSlug: 's' }]) {
      expect(() => probationWorkerDetachedProvider(bad, { spawnDetached })).toThrow();
    }
    expect(spawnDetached).not.toHaveBeenCalled();
  });

  // #4291 — the `build` kind is ITEM-keyed (`--num=`), never PR-keyed, and starts the doc-fix build run script.
  it('a `build` launch spawns the doc-fix run script, keyed to the item, with an optional attempt tag', () => {
    const spawned = [];
    const reportExecutor = vi.fn();
    const handle = probationWorkerDetachedProvider(
      { launchKind: 'build', num: '4291', sessionSlug: 'probation-4291', attemptTag: 'b', lane: 22, scope: ['we:a.mjs'], probationWorker: docFixWorker, reportExecutor, cwd: '/scratch' },
      { spawnDetached: (argv, o) => { spawned.push({ argv, o }); return { pid: 555 }; }, logPathFor: () => '/dev/null' },
    );
    expect(handle).toBe('pid:555');
    expect(reportExecutor).toHaveBeenCalledWith('codex');
    const { argv, o } = spawned[0];
    expect(argv[0]).toBe(PROBATION_BUILD_RUN_SCRIPT);
    expect(argv).toEqual(expect.arrayContaining(['--num=4291', '--session=probation-4291', '--attempt=b', '--lane=22', '--scope=we:a.mjs']));
    expect(argv.some((a) => a.startsWith('--pr=') || a.startsWith('--reason='))).toBe(false);
    expect(JSON.parse(argv.find((a) => a.startsWith('--worker=')).slice(9))).toEqual(docFixWorker);
    expect(o.cwd).toBe('/scratch');
  });
  it('a `build` launch refuses before any process with no item number', () => {
    const spawnDetached = vi.fn();
    expect(() => probationWorkerDetachedProvider(
      { launchKind: 'build', sessionSlug: 'probation-4291', probationWorker: docFixWorker },
      { spawnDetached },
    )).toThrow(/no item number/);
    expect(spawnDetached).not.toHaveBeenCalled();
  });
  // #4291 plan review round 2 — closes the coverage gap the standards-conformance/claim-accuracy lenses named:
  // a THIRD registered kind must refuse explicitly, never silently fall through to the PR-keyed `ci-heal` argv
  // shape (the provider itself, not only `probationLaunchDecision`, must reject an unknown kind).
  it('an unrecognised kind refuses before any process — never silently falls through to the ci-heal (PR-keyed) argv shape', () => {
    const spawnDetached = vi.fn();
    expect(() => probationWorkerDetachedProvider(
      { launchKind: 'fix', sessionSlug: 'probation-4291', probationWorker: docFixWorker },
      { spawnDetached },
    )).toThrow(/no argv shape for it/);
    expect(spawnDetached).not.toHaveBeenCalled();
  });
});

describe('routeDispatchProvider — the probation branch', () => {
  const req = { launchKind: 'ci-heal', repo: 'we', probationWorker: agyClaude, pr: 1, sessionSlug: 's' };
  it('on + a worker → the probation provider, not claude', () => {
    const agent = vi.fn(() => 'claude-handle');
    const probation = vi.fn(() => 'pid:1');
    expect(routeDispatchProvider(req, { agent, probation, probationLaunch: 'on', scriptExists: () => true })).toBe('pid:1');
    expect(agent).not.toHaveBeenCalled();
  });
  it('off (the direct-call default) → claude, exactly as before', () => {
    const agent = vi.fn(() => 'claude-handle');
    const probation = vi.fn();
    expect(routeDispatchProvider(req, { agent, probation })).toBe('claude-handle');
    expect(probation).not.toHaveBeenCalled();
  });
  it('a missing run script is refused before any process', () => {
    expect(() => routeDispatchProvider(req, { agent: vi.fn(), probation: vi.fn(), probationLaunch: 'on', scriptExists: () => false })).toThrow(/not in this checkout/);
  });
});

/** A fake io: a rebased lane whose gate result, worker diff and checker answer the test chooses.
 *  x55dojc — `resetHookSurface`/`snapshotHookSurface` default to a clean, never-tampered lane; pass
 *  `hookResetClean: false` (refused before any worker) or `hookTampered: true` (changed while the worker ran)
 *  to exercise those refusal paths without a real fs/git dependency. */
function fakeIo({
  gate = [false, true], rebaseOk = true, moved = true, numstat = '2\t1\tscripts/a.mjs', checker = 'APPROVE',
  pushOk = true, state = 'OPEN', hookResetClean = true, hookTampered = false, tamperRestoreClean = true,
} = {}) {
  const calls = [];
  const gates = [...gate];
  let head = 'examined';
  const cleanSnapshot = { configHash: 'clean', files: {} };
  const tamperedSnapshot = { configHash: 'clean', files: { 'pre-commit': 'planted' } };
  const io = {
    log: () => {},
    completion: (c) => calls.push(['completion', c.status, c.outcome]),
    prHead: () => ({ state, headRefOid: 'examined', headRefName: 'lane/x' }),
    acquireLane: () => '/lanes/9',
    resetHookSurface: (d, baseline) => { calls.push(baseline ? ['reset-hooks', d, baseline] : ['reset-hooks', d]); return { clean: baseline ? tamperRestoreClean : hookResetClean, leftover: hookResetClean ? [] : ['pre-commit'], snapshot: cleanSnapshot }; },
    snapshotHookSurface: (d) => { calls.push(['snapshot-hooks', d]); return hookTampered ? tamperedSnapshot : cleanSnapshot; },
    rebaseOntoMain: () => { if (rebaseOk && moved) head = 'rebased'; return rebaseOk; },
    headSha: () => head,
    runGate: () => ({ pass: gates.length ? gates.shift() : true, output: 'gate out' }),
    failingChecks: () => 'test\tfail',
    failedLogTail: () => '',
    writeTaskFile: (_d, name, text) => { calls.push(['task', name, text.length > 0]); return `/lanes/9/.git/${name}`; },
    runWorker: (argv) => { calls.push(['worker', argv[0], argv.find((a) => a.startsWith('--model='))]); return { ok: true, out: '' }; },
    runChecker: (argv) => { calls.push(['checker', argv[1]]); return checker; },
    untracked: () => ['node_modules'],
    diffNumstat: (_d, _base, preexisting) => { calls.push(['numstat', preexisting]); return numstat; },
    diffText: () => 'diff --git a/scripts/a.mjs',
    discardChanges: () => calls.push(['discard']),
    commit: (_d, paths, msg) => calls.push(['commit', paths, msg.split('\n')[0]]),
    push: (_d, ref, lease) => { calls.push(['push', ref, lease]); return pushOk; },
    markHealed: (m) => calls.push(['mark', m.reason]),
    escalate: (e) => calls.push(['escalate', e.reason]),
    appendScorecard: (r) => calls.push(['scorecard', r.launchOutcome, r.executor, r.outcome, r.verifiedBy]),
  };
  return { io, calls };
}
const args = (worker = agyClaude, reason = 'red-ci') => parseArgs(['--pr=2811', '--session=ci-heal-2811', `--reason=${reason}`, `--worker=${JSON.stringify(worker)}`, '--lane=9']);

describe('runProbationHeal — the arc', () => {
  it('red gate → the worker repairs → gate green → commit, push against the examined head, mark, healed, one launch row', async () => {
    const { io, calls } = fakeIo();
    const r = await runProbationHeal(args(), io);
    expect(r).toMatchObject({ outcome: 'healed', executor: 'antigravity' });
    expect(calls.find((c) => c[0] === 'worker')).toEqual(['worker', expect.stringMatching(/scripts\/gemini-direct-task\.mjs$/), '--model=claude-sonnet-4-6']);
    expect(calls.find((c) => c[0] === 'commit')).toEqual(['commit', ['scripts/a.mjs'], expect.stringContaining('on probation (antigravity/claude-sonnet-4-6')]);
    expect(calls.find((c) => c[0] === 'push')).toEqual(['push', 'lane/x', 'examined']);
    expect(calls.filter((c) => c[0] === 'scorecard')).toEqual([['scorecard', 'healed', 'antigravity', null, null]]);
    expect(calls.at(0)).toEqual(['completion', 'started', null]);
    // the untracked files that were there BEFORE the worker ran are handed to the diff, so they never join the heal.
    expect(calls.find((c) => c[0] === 'numstat')).toEqual(['numstat', ['node_modules']]);
  });

  it('a pre-existing untracked path the LAUNCHER intent-added never joins the heal commit or its size (live-caught)', async () => {
    // gemini-direct-task.mjs intent-adds EVERY untracked file for its own diff capture, so the numstat can list a
    // path (here a `node_modules` symlink) that was in the lane before the worker ran. It must not be committed.
    const { io, calls } = fakeIo({ numstat: '1\t0\tnode_modules\n2\t1\tscripts/a.mjs' });
    const r = await runProbationHeal(args(), io);
    expect(r.outcome).toBe('healed');
    expect(calls.find((c) => c[0] === 'commit')[1]).toEqual(['scripts/a.mjs']);
    expect(calls.find((c) => c[0] === 'scorecard')).toBeTruthy();
  });

  it('a clean rebase that turns the gate green is pushed with NO model run and NO launch row', async () => {
    const { io, calls } = fakeIo({ gate: [true] });
    const r = await runProbationHeal(args(agyClaude, 'behind'), io);
    expect(r).toMatchObject({ outcome: 'no-change', executor: 'mechanical' });
    expect(calls.some((c) => c[0] === 'worker')).toBe(false);
    expect(calls.some((c) => c[0] === 'push')).toBe(true);
    expect(calls.some((c) => c[0] === 'scorecard')).toBe(false);
  });

  it('a rebase conflict escalates without spending a model', async () => {
    const { io, calls } = fakeIo({ rebaseOk: false });
    expect((await runProbationHeal(args(), io)).outcome).toBe('escalated-conflict');
    expect(calls.some((c) => c[0] === 'escalate')).toBe(true);
    expect(calls.some((c) => c[0] === 'worker')).toBe(false);
  });

  it('a heal bigger than the ci-heal envelope is discarded, never pushed', async () => {
    const { io, calls } = fakeIo({ numstat: '100\t60\tscripts/a.mjs' });
    const r = await runProbationHeal(args(), io);
    expect(r.outcome).toBe('gate-red');
    expect(r.detail).toMatch(/changed 160 lines/);
    expect(calls.some((c) => c[0] === 'discard')).toBe(true);
    expect(calls.some((c) => c[0] === 'push')).toBe(false);
  });

  it('a gate still red after the repair is not pushed', async () => {
    const { io, calls } = fakeIo({ gate: [false, false] });
    expect((await runProbationHeal(args(), io)).outcome).toBe('gate-red');
    expect(calls.some((c) => c[0] === 'push')).toBe(false);
  });

  it('agy-Gemini: pushed only on the Codex checker\'s APPROVE', async () => {
    const approved = fakeIo();
    expect((await runProbationHeal(args(agyGemini), approved.io)).outcome).toBe('healed');
    expect(approved.calls.find((c) => c[0] === 'checker')).toEqual(['checker', '--review']);
    const rejected = fakeIo({ checker: 'REJECT\nit deletes a test' });
    const r = await runProbationHeal(args(agyGemini), rejected.io);
    expect(r.outcome).toBe('gate-red');
    expect(r.detail).toMatch(/did not approve: reject/);
    expect(rejected.calls.some((c) => c[0] === 'push')).toBe(false);
  });

  it('a push refused by the lease (the head moved) is blocked-on-infra, not healed', async () => {
    const { io } = fakeIo({ pushOk: false });
    expect((await runProbationHeal(args(), io)).outcome).toBe('blocked-on-infra');
  });

  it('a closed PR is not-applicable', async () => {
    const { io, calls } = fakeIo({ state: 'MERGED' });
    expect((await runProbationHeal(args(), io)).outcome).toBe('not-applicable');
    expect(calls.some((c) => c[0] === 'worker')).toBe(false);
  });

  // x55dojc — hardening against a worker planting a git hook.
  it('refuses before any rebase/worker when the lane\'s git-hook baseline cannot be cleaned', async () => {
    const { io, calls } = fakeIo({ hookResetClean: false });
    const r = await runProbationHeal(args(), io);
    expect(r).toMatchObject({ outcome: 'escalated-needs-human', executor: 'none' });
    expect(r.detail).toMatch(/clean git-hook baseline/);
    expect(calls.some((c) => c[0] === 'worker')).toBe(false);
    expect(calls.filter((c) => c[0] === 'reset-hooks')).toEqual([['reset-hooks', '/lanes/9']]);
    expect(calls.find((c) => c[0] === 'escalate')[1]).toMatch(/git-hook surface/);
  });

  it('a worker that changes the lane\'s git-hook surface is refused, discarded, and never committed/pushed', async () => {
    const { io, calls } = fakeIo({ hookTampered: true });
    const r = await runProbationHeal(args(), io);
    expect(r).toMatchObject({ outcome: 'escalated-needs-human', executor: 'antigravity' });
    expect(r.detail).toMatch(/\.git\/hooks\/ changed/);
    expect(calls.some((c) => c[0] === 'commit')).toBe(false);
    expect(calls.some((c) => c[0] === 'push')).toBe(false);
    expect(calls.some((c) => c[0] === 'discard')).toBe(true);
    expect(calls.filter((c) => c[0] === 'reset-hooks').length).toBeGreaterThanOrEqual(2); // baseline + post-tamper cleanup
    // #4291 advisory finding (security) — the cleanup restores the PRE-worker config, before `discard` runs git.
    const cleanupAt = calls.findIndex((c) => c[0] === 'reset-hooks' && c[2]);
    expect(calls[cleanupAt][2]).toEqual({ configHash: 'clean', files: {} });
    expect(cleanupAt).toBeLessThan(calls.findIndex((c) => c[0] === 'discard'));
    const failed = fakeIo({ hookTampered: true, tamperRestoreClean: false });
    const r2 = await runProbationHeal(args(), failed.io);
    expect(r2.detail).toMatch(/NOT discarded; quarantine it/);
    expect(failed.calls.some((c) => c[0] === 'discard' || c[0] === 'commit' || c[0] === 'push')).toBe(false);
    expect(calls.find((c) => c[0] === 'escalate')[1]).toMatch(/git-hook surface changed during the worker/);
    expect(calls.find((c) => c[0] === 'scorecard')).toEqual(['scorecard', 'escalated-needs-human', 'antigravity', null, null]);
  });
});
