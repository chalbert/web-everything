/**
 * @file dispatch-lane-prepare-wiring.test.mjs — #3641: a `prepare` dispatch runs the PREPARE-SCOPE WRAPPER.
 *
 * WHAT THIS FILE PROVES, and why each clause is here rather than "the wrapper is importable":
 *
 *   1. **THE OLD PATH IS NEVER TAKEN, BY DEFAULT.** The load-bearing assertion, and the same shape the `build`
 *      wiring's own test used (`./dispatch-lane-build-wiring.test.mjs`): with NO provider injected and NO env
 *      var set, a `prepare` dispatch through `createDispatchSinks` must reach the detached wrapper and must not
 *      reach `defaultClaudeProvider`/`spawnAgent` at all. A test that only asserted the wrapper COULD be called
 *      would still pass if the old path were the one actually running.
 *   2. **ONLY `prepare` MOVES.** Every other unwired launch kind still spawns its own agent from its own brief.
 *   3. **RESTART-SURVIVAL** — the acceptance criterion #3641 was filed with (`we:backlog/3641-*.md` "Done when"
 *      clause 2). The wrapper's arc blocks for tens of minutes; the dispatch path is a synchronous
 *      `execFileSync` inside the resident runner's own tick. So the spawn must be DETACHED (`detached: true`,
 *      `unref`'d, stdio to a durable file), the sink must return a durable handle in milliseconds, and the
 *      liveness read that guards against double-dispatch must answer from the KERNEL.
 *
 * NOTHING HERE SPAWNS A PROCESS. `node:child_process` is mocked at the module boundary, so even the tests that
 * deliberately take the REAL, uninjected default path never start anything.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const spawned = [];
const execFileSyncCalls = [];

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal();
  const mocked = {
    ...actual,
    spawn: vi.fn((bin, argv, opts) => {
      spawned.push({ bin, argv, opts });
      return { pid: 4242, unref: vi.fn() };
    }),
    execFileSync: vi.fn((bin, argv, opts) => {
      execFileSyncCalls.push({ bin, argv, opts });
      return 'backgrounded · 1ae0905c · prepare-agent\n';
    }),
  };
  return { ...mocked, default: mocked };
});
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal();
  const mocked = { ...actual, openSync: vi.fn(() => 99), mkdirSync: vi.fn() };
  return { ...mocked, default: mocked };
});

import {
  createDispatchObservers,
  createDispatchSinks,
  defaultSpawnDetached,
  deliveryDispatchLogPath,
  detachedHandlePid,
  isDispatchHandleLive,
  stampLiveness,
} from '../dispatch-lane-io.mjs';
import { DISPATCH_EFFECT, LIVENESS_SOURCES } from '../dispatch-lane.mjs';
import { PREPARE_SCOPE_RUN_SCRIPT, prepareScopeDetachedProvider } from '../dispatch-providers/prepare.mjs';
import { parsePrepareScopeRunArgv, runPrepareScopeCli } from '../prepare-scope-run.mjs';

/** A non-lane-shaped root (mirrors `./dispatch-lane.test.mjs`'s own `PRIMARY`) — `createDispatchSinks`'s
 *  default `root` is the REAL `REPO_ROOT`, and this whole suite must run correctly from an actual lane
 *  checkout (whose directory is named `lane-<N>`), which `assertNotALaneCheckout` would otherwise refuse. */
const PRIMARY = '/primary/webeverything';

/** The effect payload `dispatch-lane.mjs`'s `dispatch` step emits for a PREPARE, trimmed to what a provider
 *  reads. Note the two prepare-specific facts: the session slug grammar is `prepare-<num>` (never
 *  `conveyor-<num>`), and the lane scope is the item's OWN backlog file — not its `scope:` frontmatter, which
 *  is precisely what this dispatch exists to write. */
const preparePayload = (over = {}) => ({
  num: '3641',
  launchKind: 'prepare',
  lane: 2,
  sessionSlug: 'prepare-3641',
  scope: 'we:backlog/3641-build-and-wire-a-mechanical-harness-for-prepare-scope-dispat.md',
  prompt: '# a filled brief\n',
  expectedWithinMinutes: 30,
  ...over,
});

/** A `spawnDetached` stub that records the argv + options and answers with a fake child. */
function recordingSpawnDetached(pid = 7331) {
  const calls = [];
  const fn = (argv, opts) => {
    calls.push({ argv, opts });
    return { pid, unref() { calls.at(-1).unrefd = true; } };
  };
  return { fn, calls };
}

beforeEach(() => { spawned.length = 0; execFileSyncCalls.length = 0; });

describe('#3641 — the prepare dispatch is MECHANICAL by default', () => {
  it('a DEFAULT prepare dispatch runs the prepare-scope wrapper and NEVER spawns an agent', async () => {
    // NO `provider` injected and NO env var set — this is the REAL, uninjected default path, which is the only
    // thing that proves the wiring rather than the wrapper's existence. `node:child_process` is mocked at the
    // module boundary above, so the "real" path still starts nothing.
    const sinks = createDispatchSinks({ root: PRIMARY });

    const result = await sinks[DISPATCH_EFFECT](preparePayload());

    // 1. THE WRAPPER RAN — as its own process, pointed at the real entry script.
    expect(spawned.map((s) => s.argv[0])).toEqual([PREPARE_SCOPE_RUN_SCRIPT]);
    expect(spawned[0].argv).toEqual(expect.arrayContaining(['--num=3641', '--lane=2', '--session=prepare-3641']));
    expect(spawned[0].opts.detached).toBe(true);
    // 2. THE OLD PATH WAS NEVER TAKEN. This is the assertion the whole file exists for: before this wiring,
    //    this same call shelled `claude --bg` with the 242-line prepare-scope brief.
    expect(execFileSyncCalls).toEqual([]);
    // 3. The sink's contract is unchanged: an in-flight marker carrying a durable handle and a deadline.
    expect(result.handle).toBe('pid:4242');
    expect(result.expectedBy).toEqual(expect.any(String));
  });

  it('`WE_PREPARE_DISPATCH_MODE=agent` restores the pre-#3641 `claude --bg` spawn with the old brief', async () => {
    vi.stubEnv('WE_PREPARE_DISPATCH_MODE', 'agent');
    try {
      const sinks = createDispatchSinks({ root: PRIMARY });
      const result = await sinks[DISPATCH_EFFECT](preparePayload());
      expect(spawned).toEqual([]);
      expect(execFileSyncCalls).toHaveLength(1);
      expect(execFileSyncCalls[0].bin).toBe('claude');
      expect(result.handle).toBe('1ae0905c');
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('a typo\'d mode THROWS rather than silently picking a path', () => {
    vi.stubEnv('WE_PREPARE_DISPATCH_MODE', 'mechnical');
    try {
      expect(() => createDispatchSinks()).toThrow(/must be/);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe('#3641 — the prepare provider starts the wrapper, in its own process', () => {
  it('spawns `prepare-scope-run.mjs` with the launch the dispatch step emitted', () => {
    const { fn: spawnDetached, calls } = recordingSpawnDetached(9002);
    const handle = prepareScopeDetachedProvider(preparePayload(), { spawnDetached });

    expect(calls).toHaveLength(1);
    expect(calls[0].argv[0]).toBe(PREPARE_SCOPE_RUN_SCRIPT);
    expect(calls[0].argv).toEqual([
      PREPARE_SCOPE_RUN_SCRIPT,
      '--num=3641',
      '--lane=2',
      '--session=prepare-3641',
      '--scope=we:backlog/3641-build-and-wire-a-mechanical-harness-for-prepare-scope-dispat.md',
    ]);
    expect(handle).toBe('pid:9002');
  });

  it('passes NO `--attempt`: only a fresh `build` dispatch mints a retry-attempt letter', () => {
    const { fn: spawnDetached, calls } = recordingSpawnDetached();
    prepareScopeDetachedProvider(preparePayload(), { spawnDetached });
    expect(calls[0].argv.some((a) => a.startsWith('--attempt'))).toBe(false);
  });

  it('refuses a mechanical prepare with no item / lane / session BEFORE any process exists', () => {
    const { fn: spawnDetached, calls } = recordingSpawnDetached();
    for (const missing of [{ num: null }, { lane: '' }, { sessionSlug: '' }]) {
      expect(() => prepareScopeDetachedProvider({ ...preparePayload(), ...missing }, { spawnDetached }))
        .toThrow(/refusing a mechanical prepare dispatch/);
    }
    // NOTHING was spawned, so nothing is ambiguous — the `notApplied` shape, never an indeterminate in-flight.
    expect(calls).toEqual([]);
  });

  it('refuses INDETERMINATELY when node reports no pid — never a handle known to be wrong', () => {
    expect(() => prepareScopeDetachedProvider(preparePayload(), { spawnDetached: () => ({}) }))
      .toThrow(/reported no pid/);
  });
});

describe('#3641 — restart survival', () => {
  it('spawns DETACHED, unref\'d, with stdio to a durable log — never a block inside the caller', () => {
    const recorded = [];
    const child = { pid: 777, unref() { recorded.push('unref'); } };
    const handle = prepareScopeDetachedProvider(preparePayload(), {
      spawnDetached: (argv, opts) => { recorded.push(opts); return child; },
    });
    expect(handle).toBe('pid:777');
    expect(recorded[0].logPath).toBe(deliveryDispatchLogPath('prepare-3641'));
  });

  it('the DEFAULT detached spawner really passes `detached: true` and file-backed stdio', () => {
    const child = defaultSpawnDetached([PREPARE_SCOPE_RUN_SCRIPT], { cwd: '/repo', logPath: '/tmp/x/y.log' });
    expect(child.pid).toBe(4242);
    const [call] = spawned;
    expect(call.argv[0]).toBe(PREPARE_SCOPE_RUN_SCRIPT);
    expect(call.opts.detached).toBe(true);
    // stdin ignored, stdout AND stderr onto the same real fd — a detached child whose pipe nobody drains
    // blocks once that pipe fills.
    expect(call.opts.stdio).toEqual(['ignore', 99, 99]);
  });

  it('a RESTARTED runner still sees an in-flight PREPARE as alive — the double-dispatch guard holds', () => {
    // The liveness question is asked of the KERNEL, not of a `claude agents` listing the wrapper was never in
    // and not of the dispatching process, which a restart may have taken with it.
    expect(detachedHandlePid('pid:7331')).toBe(7331);
    expect(isDispatchHandleLive('pid:7331', [], { isPidAlive: (p) => p === 7331 })).toBe(true);

    const stamped = stampLiveness(
      { runs: [{ runId: 'r1', handle: 'pid:7331', startedAt: '2026-09-12T10:00:00Z' }], unreadable: 0 },
      {
        listAgents: () => { throw new Error('`claude agents` must not be shelled for a pid in-flight set'); },
        isPidAlive: () => true,
      },
    );
    expect(stamped.runs[0].live).toBe(true);
    expect(stamped.livenessSource).toBe('wrapper-pid');
    expect(LIVENESS_SOURCES).toContain('wrapper-pid');
  });

  it('the observer reports a live detached prepare as `running` without shelling `claude`', async () => {
    const observers = createDispatchObservers({
      listAgents: () => { throw new Error('the observer must not shell `claude` for a pid handle'); },
      listPrs: () => [],
      isPidAlive: () => true,
    });
    const entry = {
      handle: 'pid:7331',
      startedAt: new Date().toISOString(),
      payload: { num: '3641', sessionSlug: 'prepare-3641' },
    };
    await expect(observers[DISPATCH_EFFECT](entry, { handle: 'pid:7331' }))
      .resolves.toEqual({ status: 'running', result: null });
  });

  it('an EXITED detached prepare past the grace is `unresolved`, naming its log — never `succeeded`', async () => {
    const observers = createDispatchObservers({
      listAgents: () => { throw new Error('the observer must not shell `claude` for a pid handle'); },
      listPrs: () => [],
      isPidAlive: () => false,
      now: () => new Date('2026-09-12T12:00:00Z'),
    });
    const out = await observers[DISPATCH_EFFECT]({
      handle: 'pid:7331',
      startedAt: '2026-09-12T10:00:00Z',
      payload: { num: '3641', sessionSlug: 'prepare-3641' },
    }, { handle: 'pid:7331' });
    expect(out.status).toBe('unresolved');
    expect(out.error).toContain(deliveryDispatchLogPath('prepare-3641'));
  });
});

describe('#3641 — the per-dispatch process', () => {
  it('parses the launch the provider hands it, and refuses a missing one by name', () => {
    expect(parsePrepareScopeRunArgv(['--num=3641', '--lane=2', '--session=prepare-3641', '--scope=we:backlog/x.md']))
      .toEqual({ item: '3641', lane: '2', scope: 'we:backlog/x.md', sessionSlug: 'prepare-3641' });
    expect(() => parsePrepareScopeRunArgv(['--num=3641'])).toThrow(/--lane=.*--session=/);
  });

  it('the launch it is handed is exactly the shape `prepareScope` takes — no field invented at the seam', async () => {
    const { fn: spawnDetached, calls } = recordingSpawnDetached();
    prepareScopeDetachedProvider(preparePayload(), { spawnDetached });
    let seen = null;
    await runPrepareScopeCli(calls[0].argv.slice(1), {
      write: () => {}, writeErr: () => {},
      prepare: async (launch) => { seen = launch; return { item: launch.item, result: 'ok' }; },
    });
    expect(seen).toEqual({
      item: '3641',
      lane: '2',
      scope: 'we:backlog/3641-build-and-wire-a-mechanical-harness-for-prepare-scope-dispat.md',
      sessionSlug: 'prepare-3641',
    });
  });

  it('exits 0 on every outcome `prepareScope` REASONS about, 1 only when it throws', async () => {
    const argv = ['--num=3641', '--lane=2', '--session=prepare-3641'];
    const quiet = { write: () => {}, writeErr: () => {} };

    // `could-not-predict` is a real, released, reported outcome — the mechanism worked.
    await expect(runPrepareScopeCli(argv, {
      ...quiet, prepare: async () => ({ item: '3641', result: 'could-not-predict (spec too vague)' }),
    })).resolves.toMatchObject({ code: 0 });
    await expect(runPrepareScopeCli(argv, {
      ...quiet, prepare: async () => ({ item: '3641', result: 'gate-red' }),
    })).resolves.toMatchObject({ code: 0 });
    // A wrapper-side throw (acquire refused, the one-file guardrail refused) is the only non-zero exit.
    await expect(runPrepareScopeCli(argv, {
      ...quiet, prepare: async () => { throw new Error('lane refused'); },
    })).resolves.toMatchObject({ code: 1, result: null });
  });
});
