/**
 * @file scripts/conveyor/__tests__/health-watch-section.test.mjs
 * @description Unit proof for the health-watch state-root bug: `operator-queue.mjs --with-health` (and every
 *   other reader of the health store — the `live-state` operation, `health-watch.mjs`'s own tick/section
 *   commands) read "HEALTH — the health watch has never completed a tick" even while the real daemon, pinned
 *   via its launchd plist's `CONVEYOR_STATE_ROOT`, had been ticking every few minutes all along — because
 *   `healthDir()`'s OWN unset-env fallback was this file's SCRIPT-LOCATION checkout root, a different default
 *   than `we:scripts/lib/daemon-last-good.mjs#daemonConveyorStateRoot` (the shared #4052 helper
 *   `run-scorecard-store.mjs` already falls back to). These pin
 *   `healthDir` to that SAME shared helper, so it defaults to the identical physical directory regardless of
 *   which checkout invokes it, with no `CONVEYOR_STATE_ROOT` required.
 */
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';

import { healthDir } from '../health-watch-section.mjs';
import { daemonConveyorStateRoot } from '../../lib/daemon-last-good.mjs';

describe('healthDir — the one state-root resolver every reader of the health store shares (#4052)', () => {
  it('an explicit stateRoot always wins, whatever the env', () => {
    expect(healthDir('/explicit/root', { CONVEYOR_STATE_ROOT: '/pinned' })).toBe(join('/explicit/root', '.conveyor', 'health'));
    expect(healthDir('/explicit/root', {})).toBe(join('/explicit/root', '.conveyor', 'health'));
  });

  it('CONVEYOR_STATE_ROOT, when set, pins the health dir under it — same as every other #4052 file', () => {
    const env = { CONVEYOR_STATE_ROOT: '/Users/op/workspace/webeverything' };
    expect(healthDir(undefined, env)).toBe(join('/Users/op/workspace/webeverything', '.conveyor', 'health'));
  });

  it('THE BUG: with no explicit stateRoot and no CONVEYOR_STATE_ROOT (an operator shell that never exported '
    + 'it — the reported symptom), healthDir resolves to daemonConveyorStateRoot()\'s default, never a '
    + 'checkout-relative path — so a reader run from ANY clone (the operator\'s primary checkout, a lane, '
    + 'wev-review-daemon, wev-health-watch itself) lands on the SAME physical directory the daemon\'s own '
    + 'launchd-pinned CONVEYOR_STATE_ROOT writes to', () => {
    const env = {}; // no CONVEYOR_STATE_ROOT, no WE_DAEMON_STATE_DIR — the real operator shell's shape
    const dir = healthDir(undefined, env);
    expect(dir).toBe(join(daemonConveyorStateRoot(env), '.conveyor', 'health'));
    // Not this module's own script-location repo root, and not cwd — a fixed, checkout-independent default.
    expect(dir).not.toMatch(/webeverything\/\.conveyor\/health$/);
    expect(dir.endsWith(join('.claude', 'daemon-self-sync-state', 'conveyor-state', '.conveyor', 'health'))).toBe(true);
  });

  it('WE_DAEMON_STATE_DIR moves the SAME default that daemonConveyorStateRoot moves — healthDir tracks it, '
    + 'never hand-rolling its own separate default', () => {
    const env = { WE_DAEMON_STATE_DIR: '/tmp/alt-daemon-state' };
    expect(healthDir(undefined, env)).toBe(join('/tmp/alt-daemon-state', 'conveyor-state', '.conveyor', 'health'));
  });
});
