/**
 * agy-launcher-probation — the launch half: the env switch, the provider, the router branch, and the whole heal
 * arc of `probation-heal-run.mjs` over a fake `io` (no git, no gh, no model).
 */
import { describe, expect, it, vi } from 'vitest';
import {
  PROBATION_HEAL_RUN_SCRIPT, probationLaunchDecision, probationLaunchFromEnv, probationWorkerDetachedProvider,
} from '../dispatch-providers/probation-worker.mjs';
import { routeDispatchProvider } from '../dispatch-lane-io.mjs';
import { parseArgs, runProbationHeal } from '../probation-heal-run.mjs';

const agyClaude = { id: 'antigravity-claude', provider: 'antigravity', model: 'claude-sonnet-4-6', executor: 'antigravity', launcher: 'scripts/gemini-direct-task.mjs', checker: null, taskType: 'ci-heal' };
const agyGemini = { ...agyClaude, id: 'antigravity-gemini', model: 'gemini-3.8-flash-high', checker: 'codex' };

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
    expect(probationLaunchDecision({ ...req, launchKind: 'build' }, 'on').launch).toBe(false);
    expect(probationLaunchDecision({ ...req, repo: 'frontierui' }, 'on').launch).toBe(false);
    expect(probationLaunchDecision(req, 'off').launch).toBe(false);
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

/** A fake io: a rebased lane whose gate result, worker diff and checker answer the test chooses. */
function fakeIo({ gate = [false, true], rebaseOk = true, moved = true, numstat = '2\t1\tscripts/a.mjs', checker = 'APPROVE', pushOk = true, state = 'OPEN' } = {}) {
  const calls = [];
  const gates = [...gate];
  let head = 'examined';
  const io = {
    log: () => {},
    completion: (c) => calls.push(['completion', c.status, c.outcome]),
    prHead: () => ({ state, headRefOid: 'examined', headRefName: 'lane/x' }),
    acquireLane: () => '/lanes/9',
    rebaseOntoMain: () => { if (rebaseOk && moved) head = 'rebased'; return rebaseOk; },
    headSha: () => head,
    runGate: () => ({ pass: gates.length ? gates.shift() : true, output: 'gate out' }),
    failingChecks: () => 'test\tfail',
    failedLogTail: () => '',
    writeTaskFile: (_d, name, text) => { calls.push(['task', name, text.length > 0]); return `/lanes/9/.git/${name}`; },
    runWorker: (argv) => { calls.push(['worker', argv[0], argv.find((a) => a.startsWith('--model='))]); return { ok: true, out: '' }; },
    runChecker: (argv) => { calls.push(['checker', argv[1]]); return checker; },
    diffNumstat: () => numstat,
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
});
