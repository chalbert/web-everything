/**
 * @file skills-src/conveyor/__tests__/supervisor-launcher.test.mjs
 * @description Unit proof of #3874's manifest-driven launcher. Every test supplies its OWN fixture manifest
 *   and fake effects — never the real (empty by design, see daemon-manifest.mjs's own header) DAEMON_MANIFEST
 *   and never a real subprocess (see supervisor.mjs's own __tests__ for the real-spawn proof this launcher
 *   reuses unmodified).
 */
import { describe, it, expect, vi } from 'vitest';
import {
  planLaunchTargets, defaultLaunchNames, resolveScriptPath, entryLogPath, launchEntry, launchAll,
  DEFAULT_LOG_ROOT,
} from '../supervisor-launcher.mjs';

const fixtureManifest = {
  'branch-drift': { script: 'scripts/conveyor/branch-drift.mjs', args: ['sweep'], intervalMs: 120_000 },
  'ci-queue-watch': { script: 'scripts/conveyor/ci-queue-watch.mjs', args: ['sweep'], intervalMs: 60_000 },
  'no-args-entry': { script: 'scripts/conveyor/x.mjs', intervalMs: 1000 },
};

function fakeResolveEntry(name, manifest) {
  const entry = manifest[name];
  if (!entry) throw new Error(`"${name}" is not in the daemon manifest — pass-daemon never takes a raw script path.`);
  return entry;
}

describe('planLaunchTargets — pure resolution over an injected manifest', () => {
  it('resolves every valid name into a launch target', () => {
    const { targets, failures } = planLaunchTargets(['branch-drift', 'ci-queue-watch'], {
      manifest: fixtureManifest, resolveEntry: fakeResolveEntry,
    });
    expect(failures).toEqual([]);
    expect(targets).toEqual([
      { name: 'branch-drift', script: 'scripts/conveyor/branch-drift.mjs', args: ['sweep'] },
      { name: 'ci-queue-watch', script: 'scripts/conveyor/ci-queue-watch.mjs', args: ['sweep'] },
    ]);
  });

  it('defaults a missing args field to an empty array', () => {
    const { targets } = planLaunchTargets(['no-args-entry'], { manifest: fixtureManifest, resolveEntry: fakeResolveEntry });
    expect(targets).toEqual([{ name: 'no-args-entry', script: 'scripts/conveyor/x.mjs', args: [] }]);
  });

  it('isolates one unresolvable name — the rest still resolve, never aborted by the bad one', () => {
    const { targets, failures } = planLaunchTargets(['branch-drift', 'totally-made-up', 'ci-queue-watch'], {
      manifest: fixtureManifest, resolveEntry: fakeResolveEntry,
    });
    expect(targets.map((t) => t.name)).toEqual(['branch-drift', 'ci-queue-watch']);
    expect(failures).toEqual([{ name: 'totally-made-up', error: expect.stringMatching(/is not in the daemon manifest/) }]);
  });

  it('an empty/absent names list resolves nothing and fails on nothing', () => {
    expect(planLaunchTargets([], { manifest: fixtureManifest, resolveEntry: fakeResolveEntry })).toEqual({ targets: [], failures: [] });
    expect(planLaunchTargets(undefined, { manifest: fixtureManifest, resolveEntry: fakeResolveEntry })).toEqual({ targets: [], failures: [] });
  });

  it('defaults resolveEntry/manifest to the real ones when not injected — the real (empty) manifest refuses every name', () => {
    const { targets, failures } = planLaunchTargets(['anything']);
    expect(targets).toEqual([]);
    expect(failures).toEqual([{ name: 'anything', error: expect.stringMatching(/No entries are registered yet/) }]);
  });
});

describe('defaultLaunchNames — every currently-registered name, sorted', () => {
  it('returns every fixture name sorted, regardless of declaration order', () => {
    expect(defaultLaunchNames(fixtureManifest)).toEqual(['branch-drift', 'ci-queue-watch', 'no-args-entry']);
  });

  it('is empty for an empty manifest', () => {
    expect(defaultLaunchNames({})).toEqual([]);
  });

  it('defaults to the real DAEMON_MANIFEST when none is supplied — today that is empty (see that file\'s own header)', () => {
    expect(defaultLaunchNames()).toEqual([]);
  });
});

describe('resolveScriptPath / entryLogPath — pure path joins', () => {
  it('joins a repo-relative script against the given root', () => {
    expect(resolveScriptPath('scripts/conveyor/branch-drift.mjs', { root: '/repo' })).toBe('/repo/scripts/conveyor/branch-drift.mjs');
  });

  it('gives each entry name its own JSONL path under the given log root', () => {
    expect(entryLogPath('branch-drift', { logRoot: '/locks/supervisor-launcher' })).toBe('/locks/supervisor-launcher/branch-drift.jsonl');
  });

  it('defaults the log root to DEFAULT_LOG_ROOT', () => {
    expect(entryLogPath('x')).toBe(`${DEFAULT_LOG_ROOT}/x.jsonl`);
  });
});

describe('launchEntry — wires one target through injected (never real) spawn/log/loop effects', () => {
  it('builds the spawnChild effect with the resolved runnerPath + the entry\'s own args', async () => {
    const makeSpawnChild = vi.fn(() => async () => ({ code: 0, signal: null, ranMs: 10 }));
    const makeLog = vi.fn(() => () => {});
    const runLoop = vi.fn(async ({ spawnChild }) => {
      const result = await spawnChild();
      return { restarts: 1, stoppedReason: 'signal', lastResult: result };
    });
    const out = await launchEntry(
      { name: 'branch-drift', script: 'scripts/conveyor/branch-drift.mjs', args: ['sweep'] },
      { root: '/repo', logRoot: '/locks', makeSpawnChild, makeLog, runLoop, shouldStop: () => true },
    );
    expect(makeSpawnChild).toHaveBeenCalledWith(expect.objectContaining({
      runnerPath: '/repo/scripts/conveyor/branch-drift.mjs', extraArgs: ['sweep'],
    }));
    expect(makeLog).toHaveBeenCalledWith('/locks/branch-drift.jsonl');
    expect(out).toEqual({ restarts: 1, stoppedReason: 'signal', lastResult: { code: 0, signal: null, ranMs: 10 } });
  });

  it('forwards onChild(name, child) so a multi-entry caller can track live children by name', async () => {
    const seen = [];
    const fakeChild = { pid: 4242 };
    const makeSpawnChild = vi.fn(({ onChild }) => {
      onChild(fakeChild);
      return async () => ({ code: 0, signal: null, ranMs: 5 });
    });
    const runLoop = vi.fn(async ({ spawnChild }) => { await spawnChild(); return { restarts: 1, stoppedReason: 'signal' }; });
    await launchEntry(
      { name: 'ci-queue-watch', script: 'scripts/conveyor/ci-queue-watch.mjs', args: [] },
      { makeSpawnChild, makeLog: () => () => {}, runLoop, onChild: (name, child) => seen.push({ name, child }), shouldStop: () => true },
    );
    expect(seen).toEqual([{ name: 'ci-queue-watch', child: fakeChild }]);
  });

  it('every logged entry carries its own name, never bleeding into a sibling entry\'s log', async () => {
    const entries = [];
    const makeLog = () => (entry) => entries.push(entry);
    const runLoop = vi.fn(async ({ log }) => { log({ event: 'spawn', attempt: 1 }); return { restarts: 1, stoppedReason: 'signal' }; });
    await launchEntry(
      { name: 'branch-drift', script: 'x.mjs', args: [] },
      { makeSpawnChild: () => async () => ({ code: 0 }), makeLog, runLoop, shouldStop: () => true },
    );
    expect(entries).toEqual([{ name: 'branch-drift', event: 'spawn', attempt: 1 }]);
  });

  it('passes shouldStop and sleep straight through to runLoop, unmodified', async () => {
    const shouldStop = () => true;
    const sleep = async () => {};
    const runLoop = vi.fn(async (o) => { expect(o.shouldStop).toBe(shouldStop); expect(o.sleep).toBe(sleep); return { restarts: 0, stoppedReason: 'signal' }; });
    await launchEntry(
      { name: 'x', script: 'x.mjs', args: [] },
      { makeSpawnChild: () => async () => ({ code: 0 }), makeLog: () => () => {}, runLoop, shouldStop, sleep },
    );
    expect(runLoop).toHaveBeenCalledTimes(1);
  });
});

describe('launchAll — resolves + launches every target concurrently, isolating failures', () => {
  it('launches one entry per resolvable name and reports failures via onFailure without launching them', async () => {
    const launchedNames = [];
    const runLoop = vi.fn(async ({ spawnChild }) => { await spawnChild(); return { restarts: 1, stoppedReason: 'signal' }; });
    const makeSpawnChild = ({ runnerPath }) => { launchedNames.push(runnerPath); return async () => ({ code: 0 }); };
    const failures = [];
    const { launched, running } = launchAll(['branch-drift', 'totally-made-up', 'ci-queue-watch'], {
      manifest: fixtureManifest, resolveEntry: fakeResolveEntry,
      root: '/repo', makeSpawnChild, makeLog: () => () => {}, runLoop, shouldStop: () => true,
      onFailure: (f) => failures.push(f),
    });
    expect(launched.map((t) => t.name)).toEqual(['branch-drift', 'ci-queue-watch']);
    expect(failures).toEqual([{ name: 'totally-made-up', error: expect.stringMatching(/is not in the daemon manifest/) }]);
    expect(running).toHaveLength(2);
    await Promise.all(running);
    expect(launchedNames).toEqual(['/repo/scripts/conveyor/branch-drift.mjs', '/repo/scripts/conveyor/ci-queue-watch.mjs']);
  });

  it('with no names given, launches every entry currently in the manifest (default order = sorted keys)', async () => {
    const order = [];
    const runLoop = vi.fn(async ({ spawnChild }) => { await spawnChild(); return { restarts: 1, stoppedReason: 'signal' }; });
    const { launched, running } = launchAll(undefined, {
      manifest: fixtureManifest, resolveEntry: fakeResolveEntry,
      makeSpawnChild: () => async () => ({ code: 0 }),
      makeLog: () => () => {}, runLoop, shouldStop: () => true,
      onChild: () => {},
    });
    order.push(...launched.map((t) => t.name));
    await Promise.all(running);
    expect(order).toEqual(['branch-drift', 'ci-queue-watch', 'no-args-entry']);
  });

  it('an empty manifest with no --only launches nothing and fails on nothing', () => {
    const { launched, failures, running } = launchAll(undefined, {
      manifest: {}, resolveEntry: fakeResolveEntry,
      makeSpawnChild: () => async () => ({ code: 0 }), makeLog: () => () => {},
    });
    expect(launched).toEqual([]);
    expect(failures).toEqual([]);
    expect(running).toEqual([]);
  });
});
