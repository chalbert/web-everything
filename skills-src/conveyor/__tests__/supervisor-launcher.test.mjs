/**
 * @file skills-src/conveyor/__tests__/supervisor-launcher.test.mjs
 * @description Unit proof of #3874's manifest-driven launcher. Every test supplies its OWN fixture manifest
 *   and fake effects, never a real subprocess (see supervisor.mjs's own __tests__ for the real-spawn proof
 *   this launcher reuses unmodified). The handful of tests that DO exercise the real, shared DAEMON_MANIFEST
 *   (proving the "no injection needed" default path) assert against its own CURRENT state
 *   (`Object.keys(DAEMON_MANIFEST)`), never a value hardcoded at write time — that manifest is a live,
 *   mutable export another PR (#3873) populates independently of this one, and a hardcoded literal here
 *   reddened the moment #3873 landed (live-caught in review, PR #2472).
 */
import { describe, it, expect, vi } from 'vitest';
import {
  planLaunchTargets, defaultLaunchNames, resolveScriptPath, entryLogPath, launchEntry, launchAll,
  DEFAULT_LOG_ROOT,
} from '../supervisor-launcher.mjs';
import { DAEMON_MANIFEST } from '../daemon-manifest.mjs';

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

  // Live-caught in review (PR #2472): this used to hardcode "the real DAEMON_MANIFEST is empty" — true when
  // this file was first written, but #3873 landed 15 real entries onto that SAME shared, mutable export
  // before this PR merged, which reddened the hardcoded literal. Fixed to assert against the manifest's own
  // CURRENT real state (`Object.keys(DAEMON_MANIFEST)`) rather than a value pinned at write time — the fix
  // the review itself prescribed for this whole class of cross-file shared-default test.
  it('defaults resolveEntry/manifest to the real ones when not injected — a name that is not for real registered still refuses', () => {
    const { targets, failures } = planLaunchTargets(['totally-not-a-real-entry-name']);
    expect(targets).toEqual([]);
    expect(failures).toEqual([{ name: 'totally-not-a-real-entry-name', error: expect.stringMatching(/is not in the daemon manifest/) }]);
  });

  it('every REAL currently-registered manifest name resolves with no defaults injected', () => {
    const realNames = Object.keys(DAEMON_MANIFEST);
    if (realNames.length === 0) return; // still true only before #3873 lands; skip rather than assert either shape
    const { targets, failures } = planLaunchTargets(realNames);
    expect(failures).toEqual([]);
    expect(targets.map((t) => t.name).sort()).toEqual([...realNames].sort());
  });
});

describe('defaultLaunchNames — every currently-registered name, sorted', () => {
  it('returns every fixture name sorted, regardless of declaration order', () => {
    expect(defaultLaunchNames(fixtureManifest)).toEqual(['branch-drift', 'ci-queue-watch', 'no-args-entry']);
  });

  it('is empty for an empty manifest', () => {
    expect(defaultLaunchNames({})).toEqual([]);
  });

  // Live-caught in review (PR #2472): same class of fix as planLaunchTargets' own test above — assert
  // against DAEMON_MANIFEST's own current real keys, never a value hardcoded at write time.
  it('defaults to the real DAEMON_MANIFEST when none is supplied', () => {
    expect(defaultLaunchNames()).toEqual(Object.keys(DAEMON_MANIFEST).sort());
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
