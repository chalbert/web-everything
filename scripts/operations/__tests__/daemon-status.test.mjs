/**
 * @file scripts/operations/__tests__/daemon-status.test.mjs
 * @description #4067 — pure `assessDaemonEntry`/`assessDaemonStatus` unit tests (the classification logic
 *   that decides `down` / `alive` / `alive-and-stalled` / `alive-and-refusing`), plus a declaration-shape
 *   test for `daemonStatusOperation`. No IO: every raw daemon record is a plain fixture object.
 */
import { describe, it, expect } from 'vitest';
import { assessDaemonEntry, assessDaemonStatus, daemonStatusOperation, DAEMON_STATUS_OP } from '../daemon-status.mjs';

const OBSERVED_AT = '2026-09-25T13:10:00.000Z';
const FRESH_HEARTBEAT = '2026-09-25T13:09:30.000Z'; // 30s ago
const STALE_HEARTBEAT = '2026-09-25T12:50:00.000Z'; // 20 min ago

describe('assessDaemonEntry', () => {
  it('a plist that could not be read is unreadable, never crashes the row', () => {
    const out = assessDaemonEntry({ name: 'x', readable: false, running: false }, { observedAt: OBSERVED_AT });
    expect(out.state).toBe('unreadable');
    expect(out.refusing).toBe(false);
  });

  it('no launchd pid is down', () => {
    const out = assessDaemonEntry({ name: 'x', readable: true, running: false }, { observedAt: OBSERVED_AT });
    expect(out.state).toBe('down');
    expect(out.refusing).toBe(false);
  });

  it('running with a fresh heartbeat and a clean tick is alive', () => {
    const raw = {
      name: 'fix-dispatch', readable: true, running: true, leaseKey: '<x>',
      lease: { present: true, entry: { heartbeatAt: FRESH_HEARTBEAT } },
      tick: { found: true, attempted: 3, succeeded: 3, refused: 0 },
    };
    const out = assessDaemonEntry(raw, { observedAt: OBSERVED_AT });
    expect(out.state).toBe('alive');
    expect(out.refusing).toBe(false);
    expect(out.attempted).toBe(3);
    expect(out.succeeded).toBe(3);
  });

  it('THE HEADLINE CASE: running, fresh heartbeat, attempted something and succeeded at none of it → alive-and-refusing', () => {
    const raw = {
      name: 'fix-dispatch', readable: true, running: true, leaseKey: '<x>',
      lease: { present: true, entry: { heartbeatAt: FRESH_HEARTBEAT } },
      tick: { found: true, attempted: 6, succeeded: 0, refused: 6 },
    };
    const out = assessDaemonEntry(raw, { observedAt: OBSERVED_AT });
    expect(out.state).toBe('alive-and-refusing');
    expect(out.refusing).toBe(true);
    expect(out.headline).toMatch(/refused all 6 of 6/);
  });

  it('running but the heartbeat is older than the stale window is alive-and-stalled, not refusing', () => {
    const raw = {
      name: 'fix-dispatch', readable: true, running: true, leaseKey: '<x>',
      lease: { present: true, entry: { heartbeatAt: STALE_HEARTBEAT } },
      tick: { found: true, attempted: 6, succeeded: 0, refused: 6 },
    };
    const out = assessDaemonEntry(raw, { observedAt: OBSERVED_AT });
    expect(out.state).toBe('alive-and-stalled');
    expect(out.refusing).toBe(false); // stale takes priority — an unknown-freshness result is not "refusing everything"
  });

  it('a lease-bearing daemon with NO readable lease entry fails closed to stalled, never to idle', () => {
    const raw = {
      name: 'fix-dispatch', readable: true, running: true, leaseKey: '<x>',
      lease: { present: false, entry: null }, tick: { found: false },
    };
    const out = assessDaemonEntry(raw, { observedAt: OBSERVED_AT });
    expect(out.state).toBe('alive-and-stalled');
  });

  it('a tick that threw is alive-and-stalled with the thrown error surfaced, not miscounted as a refusal', () => {
    const raw = {
      name: 'review', readable: true, running: true, leaseKey: '<x>',
      lease: { present: true, entry: { heartbeatAt: FRESH_HEARTBEAT } },
      tick: { found: true, tickFailed: true, error: 'boom' },
    };
    const out = assessDaemonEntry(raw, { observedAt: OBSERVED_AT });
    expect(out.state).toBe('alive-and-stalled');
    expect(out.refusing).toBe(false);
    expect(out.headline).toMatch(/boom/);
  });

  it('a daemon with no lease (the drain daemon) is judged on its own tick timestamp instead', () => {
    const fresh = {
      name: 'drain', readable: true, running: true, leaseKey: null, lease: null,
      tick: { found: true, at: FRESH_HEARTBEAT, attempted: 2, succeeded: 1, refused: 1 },
    };
    expect(assessDaemonEntry(fresh, { observedAt: OBSERVED_AT }).state).toBe('alive');
    const stale = { ...fresh, tick: { ...fresh.tick, at: STALE_HEARTBEAT } };
    expect(assessDaemonEntry(stale, { observedAt: OBSERVED_AT }).state).toBe('alive-and-stalled');
  });

  // #4077 — live-caught 2026-09-25 11:39 ET: the drain's `lastPass.at` is a pass START and goes 20+ min stale
  // during a long merging pass; its log's own newer stamp (`tick.lastActivityAt`) must keep it `alive`.
  it('a leaseless daemon whose lastPass.at is stale but whose log shows newer activity is NOT stalled', () => {
    const raw = {
      name: 'drain', readable: true, running: true, leaseKey: null, lease: null,
      tick: { found: true, at: STALE_HEARTBEAT, lastActivityAt: FRESH_HEARTBEAT, attempted: 3, succeeded: 2, refused: 0 },
    };
    expect(assessDaemonEntry(raw, { observedAt: OBSERVED_AT }).state).toBe('alive');
    const bothStale = { ...raw, tick: { ...raw.tick, lastActivityAt: STALE_HEARTBEAT } };
    expect(assessDaemonEntry(bothStale, { observedAt: OBSERVED_AT }).state).toBe('alive-and-stalled');
  });

  it('a daemon with no dispatch/refusal concept (no lease, no tick timestamp) is plain alive, never flagged stale on nothing', () => {
    const raw = { name: 'ci-queue-watch-we', readable: true, running: true, leaseKey: null, lease: null, tick: { found: false, raw: 'some line' } };
    const out = assessDaemonEntry(raw, { observedAt: OBSERVED_AT });
    expect(out.state).toBe('alive');
    expect(out.refusing).toBe(false);
    expect(out.attempted).toBeNull();
  });

  it('attempted-but-partial success (some refused, some succeeded) is NOT "refusing everything"', () => {
    const raw = {
      name: 'review', readable: true, running: true, leaseKey: '<x>',
      lease: { present: true, entry: { heartbeatAt: FRESH_HEARTBEAT } },
      tick: { found: true, attempted: 4, succeeded: 2, refused: 2 },
    };
    const out = assessDaemonEntry(raw, { observedAt: OBSERVED_AT });
    expect(out.state).toBe('alive');
    expect(out.refusing).toBe(false);
  });

  it('lastTickAt prefers the lease heartbeat over a tick timestamp, and labels its source', () => {
    const raw = {
      name: 'x', readable: true, running: true, leaseKey: '<x>',
      lease: { present: true, entry: { heartbeatAt: FRESH_HEARTBEAT } },
      tick: { found: true, at: STALE_HEARTBEAT, attempted: 1, succeeded: 1, refused: 0 },
    };
    const out = assessDaemonEntry(raw, { observedAt: OBSERVED_AT });
    expect(out.lastTickAt).toBe(FRESH_HEARTBEAT);
    expect(out.lastTickAtSource).toBe('lease-heartbeat');
  });

  it('THE "LOOKS FINE, DOING NOTHING USEFUL" CASE: an otherwise-alive daemon with a recent rebuild alert '
    + 'still headlines it — a clean tick never hides that its clone is held off main', () => {
    const raw = {
      name: 'fix-dispatch', readable: true, running: true, leaseKey: '<x>',
      lease: { present: true, entry: { heartbeatAt: FRESH_HEARTBEAT } },
      tick: { found: true, attempted: 3, succeeded: 3, refused: 0 },
      recentAlerts: { available: true, alerts: [{ at: '2026-09-25T13:09:00.000Z', kind: 'clone-held-stale', detail: null }] },
    };
    const out = assessDaemonEntry(raw, { observedAt: OBSERVED_AT });
    expect(out.state).toBe('alive'); // the tick itself is clean — alerting is orthogonal to the state enum
    expect(out.hasRecentAlerts).toBe(true);
    expect(out.recentAlertKinds).toEqual(['clone-held-stale']);
    expect(out.headline).toMatch(/recent rebuild alert: clone-held-stale/);
  });

  it('a down daemon with no recent alerts has no alert suffix and an empty kind list', () => {
    const out = assessDaemonEntry({ name: 'x', readable: true, running: false }, { observedAt: OBSERVED_AT });
    expect(out.hasRecentAlerts).toBe(false);
    expect(out.recentAlertKinds).toEqual([]);
    expect(out.headline).not.toMatch(/rebuild alert/);
  });

  it('with multiple alerts, the headline names the MOST RECENT (last) one', () => {
    const raw = {
      name: 'x', readable: true, running: true, leaseKey: '<x>',
      lease: { present: true, entry: { heartbeatAt: FRESH_HEARTBEAT } },
      tick: { found: true, attempted: 1, succeeded: 1, refused: 0 },
      recentAlerts: { available: true, alerts: [{ kind: 'smoke-rejected' }, { kind: 'clone-held-stale' }] },
    };
    const out = assessDaemonEntry(raw, { observedAt: OBSERVED_AT });
    expect(out.recentAlertKinds).toEqual(['smoke-rejected', 'clone-held-stale']);
    expect(out.headline).toMatch(/recent rebuild alert: clone-held-stale$/);
  });
});

describe('assessDaemonStatus', () => {
  it('rolls per-daemon states up into anyRefusing/anyDown/anyStalled summaries', () => {
    const read = {
      observedAt: OBSERVED_AT,
      daemons: [
        { name: 'a', readable: true, running: false },
        {
          name: 'b', readable: true, running: true, leaseKey: '<b>',
          lease: { present: true, entry: { heartbeatAt: FRESH_HEARTBEAT } },
          tick: { found: true, attempted: 1, succeeded: 0, refused: 1 },
        },
        {
          name: 'c', readable: true, running: true, leaseKey: '<c>',
          lease: { present: true, entry: { heartbeatAt: STALE_HEARTBEAT } },
          tick: { found: false },
        },
      ],
    };
    const out = assessDaemonStatus(read);
    expect(out.anyRefusing).toBe(true);
    expect(out.refusingDaemons).toEqual(['b']);
    expect(out.anyDown).toBe(true);
    expect(out.downDaemons).toEqual(['a']);
    expect(out.anyStalled).toBe(true);
    expect(out.staleDaemons).toEqual(['c']);
    expect(out.anyRecentAlerts).toBe(false);
    expect(out.alertingDaemons).toEqual([]);
  });

  it('rolls hasRecentAlerts up into anyRecentAlerts/alertingDaemons', () => {
    const read = {
      observedAt: OBSERVED_AT,
      daemons: [
        {
          name: 'a', readable: true, running: true, leaseKey: '<a>',
          lease: { present: true, entry: { heartbeatAt: FRESH_HEARTBEAT } },
          tick: { found: true, attempted: 1, succeeded: 1, refused: 0 },
          recentAlerts: { available: true, alerts: [{ kind: 'clone-held-stale' }] },
        },
        { name: 'b', readable: true, running: false },
      ],
    };
    const out = assessDaemonStatus(read);
    expect(out.anyRecentAlerts).toBe(true);
    expect(out.alertingDaemons).toEqual(['a']);
  });

  it('refuses an unreadable snapshot rather than silently reporting zero daemons', () => {
    expect(() => assessDaemonStatus({ observedAt: OBSERVED_AT })).toThrow(TypeError);
    expect(() => assessDaemonStatus(null)).toThrow(TypeError);
  });
});

describe('daemonStatusOperation', () => {
  it('declares a read → assess pipeline over the injected collector', () => {
    const collect = () => ({ observedAt: OBSERVED_AT, daemons: [] });
    const declaration = daemonStatusOperation({ collect });
    expect(declaration.name).toBe(DAEMON_STATUS_OP);
    expect(declaration.verdictFrom).toBe('assess');
    expect(declaration.steps.map((s) => s.name)).toEqual(['read', 'assess']);
  });

  it('refuses to build without an injected collect function', () => {
    expect(() => daemonStatusOperation({})).toThrow(TypeError);
  });
});
