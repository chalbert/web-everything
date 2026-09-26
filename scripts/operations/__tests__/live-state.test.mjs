/**
 * @file scripts/operations/__tests__/live-state.test.mjs
 * @description Card xvz55jf (epic #3931) — pure per-section assess unit tests plus a declaration-shape test
 *   for `liveStateOperation`. No IO: every input is a plain fixture object, mirroring `daemon-status.test.mjs`/
 *   `heavy-queue.test.mjs`'s own pure-core suites.
 */
import { describe, it, expect } from 'vitest';
import {
  worstStatus, assessDaemonsSection, assessHealthSection, assessTestQueueSection, assessLanesSection,
  assessDrainSection, assessGithubAuthSection, assessMachineLoadSection, assessLiveState,
  liveStateOperation, LIVE_STATE_OP, QUEUE_GREEN_MAX_MINUTES, LANE_FREE_RED_MAX, LANE_FREE_YELLOW_MAX,
  DRAIN_STALE_YELLOW_MS, DRAIN_STALE_RED_MS, LOAD_YELLOW_RATIO, LOAD_RED_RATIO,
} from '../live-state.mjs';

describe('worstStatus', () => {
  it('is green for an empty list', () => expect(worstStatus([])).toBe('green'));
  it('never lets green win over yellow or red', () => {
    expect(worstStatus(['green', 'yellow'])).toBe('yellow');
    expect(worstStatus(['green', 'yellow', 'red'])).toBe('red');
    expect(worstStatus(['red', 'green'])).toBe('red');
  });
});

describe('assessDaemonsSection — reads daemon-status\'s OWN summary fields, never re-classifies a daemon', () => {
  it('red when anyRefusing, whatever else is also true', () => {
    const out = assessDaemonsSection({
      daemons: [], anyRefusing: true, refusingDaemons: ['com.we.fix-dispatch-daemon'],
      anyDown: true, downDaemons: ['x'], anyStalled: false, staleDaemons: [], anyRecentAlerts: false, alertingDaemons: [],
    });
    expect(out.status).toBe('red');
    expect(out.reason).toContain('fix-dispatch-daemon');
  });

  it('yellow when nothing refuses but something is down/stalled/alerting', () => {
    const out = assessDaemonsSection({
      daemons: [{}], anyRefusing: false, refusingDaemons: [],
      anyDown: false, downDaemons: [], anyStalled: true, staleDaemons: ['com.we.lease-reaper'], anyRecentAlerts: false, alertingDaemons: [],
    });
    expect(out.status).toBe('yellow');
    expect(out.reason).toContain('lease-reaper');
  });

  it('green when every daemon is alive and clean', () => {
    const out = assessDaemonsSection({
      daemons: [{}, {}], anyRefusing: false, refusingDaemons: [], anyDown: false, downDaemons: [],
      anyStalled: false, staleDaemons: [], anyRecentAlerts: false, alertingDaemons: [],
    });
    expect(out.status).toBe('green');
    expect(out.reason).toContain('2 daemon(s)');
  });
});

describe('assessHealthSection', () => {
  const now = Date.parse('2026-09-26T12:00:00.000Z');

  it('yellow when the health watch has never ticked', () => {
    const out = assessHealthSection({ running: false, lastTick: null, episodes: [] }, { now });
    expect(out.status).toBe('yellow');
    expect(out.reason).toMatch(/never completed a tick/);
  });

  it('red when any open episode is high severity', () => {
    const out = assessHealthSection({
      running: true, lastTick: { completedAt: now - 60_000 },
      episodes: [{ smell: 'daemon-down', subject: 'x', severity: 'high' }],
    }, { now });
    expect(out.status).toBe('red');
    expect(out.reason).toContain('daemon-down/x');
  });

  it('yellow when the tick itself is stale, even with no open episodes', () => {
    const out = assessHealthSection({ running: true, lastTick: { completedAt: now - 3_600_000 }, episodes: [] }, { now, staleAfterMs: 900_000 });
    expect(out.status).toBe('yellow');
    expect(out.reason).toMatch(/stale/);
  });

  it('yellow (not red) for an open episode that is not high severity', () => {
    const out = assessHealthSection({
      running: true, lastTick: { completedAt: now - 60_000 },
      episodes: [{ smell: 'x', subject: 'y', severity: 'medium' }],
    }, { now, staleAfterMs: 900_000 });
    expect(out.status).toBe('yellow');
  });

  it('green when ticking fresh with no open episodes', () => {
    const out = assessHealthSection({ running: true, lastTick: { completedAt: now - 60_000 }, episodes: [] }, { now, staleAfterMs: 900_000 });
    expect(out.status).toBe('green');
  });
});

describe('assessTestQueueSection — reuses heavy-queue\'s OWN maxWaitMinutes budget for the red line', () => {
  it('green under the green bar', () => {
    const out = assessTestQueueSection({ projectedWaitMinutesForNewJob: QUEUE_GREEN_MAX_MINUTES - 1, freeCount: 2 });
    expect(out.status).toBe('green');
  });
  it('yellow over the green bar but inside the admission budget', () => {
    const out = assessTestQueueSection({ projectedWaitMinutesForNewJob: QUEUE_GREEN_MAX_MINUTES + 5, queueAdmission: { maxWaitMinutes: 45 } });
    expect(out.status).toBe('yellow');
  });
  it('red once projected wait exceeds the live queueAdmission.maxWaitMinutes budget', () => {
    const out = assessTestQueueSection({ projectedWaitMinutesForNewJob: 50, queueAdmission: { maxWaitMinutes: 45 } });
    expect(out.status).toBe('red');
    expect(out.reason).toContain('45m');
  });
  it('falls back to the yellow-fallback red line when no live queueAdmission budget was read', () => {
    const out = assessTestQueueSection({ projectedWaitMinutesForNewJob: 100 });
    expect(out.status).toBe('red');
  });
});

describe('assessLanesSection', () => {
  it('green when every pool is comfortably free', () => {
    const out = assessLanesSection([{ repoKey: 'we', free: 50, leased: 10, dirty: 5, total: 65 }]);
    expect(out.status).toBe('green');
  });
  it(`yellow when a pool's free count is at or below ${LANE_FREE_YELLOW_MAX}`, () => {
    const out = assessLanesSection([{ repoKey: 'frontierui', free: LANE_FREE_YELLOW_MAX, leased: 0, dirty: 0, total: LANE_FREE_YELLOW_MAX }]);
    expect(out.status).toBe('yellow');
  });
  it(`red when a pool has ${LANE_FREE_RED_MAX} free lanes`, () => {
    const out = assessLanesSection([{ repoKey: 'plateau-app', free: LANE_FREE_RED_MAX, leased: 3, dirty: 1, total: 4 }]);
    expect(out.status).toBe('red');
    expect(out.reason).toContain('plateau-app');
  });
  it('yellow (not a crash) when a pool could not be read', () => {
    const out = assessLanesSection([{ repoKey: 'we', free: 50, leased: 0, dirty: 0, total: 50 }, { repoKey: 'frontierui', error: 'ENOENT' }]);
    expect(out.status).toBe('yellow');
    expect(out.reason).toContain('frontierui');
  });
});

describe('assessDrainSection', () => {
  const now = Date.parse('2026-09-26T12:00:00.000Z');

  it('red when the drain has never recorded a pass', () => {
    expect(assessDrainSection({ lastPass: null }, { now }).status).toBe('red');
  });
  it('red when the last pass exited non-zero', () => {
    const out = assessDrainSection({ lastPass: { at: new Date(now - 60_000).toISOString(), exit: 1 } }, { now });
    expect(out.status).toBe('red');
  });
  it(`red once the last pass is older than ${DRAIN_STALE_RED_MS / 60000}m`, () => {
    const out = assessDrainSection({ lastPass: { at: new Date(now - DRAIN_STALE_RED_MS - 1000).toISOString(), exit: 0 } }, { now });
    expect(out.status).toBe('red');
  });
  it(`yellow between ${DRAIN_STALE_YELLOW_MS / 60000}m and the red line`, () => {
    const out = assessDrainSection({ lastPass: { at: new Date(now - DRAIN_STALE_YELLOW_MS - 1000).toISOString(), exit: 0 } }, { now });
    expect(out.status).toBe('yellow');
  });
  it('yellow when fresh but the pass itself recorded failures', () => {
    const out = assessDrainSection({ lastPass: { at: new Date(now - 60_000).toISOString(), exit: 0, failed: 1 } }, { now });
    expect(out.status).toBe('yellow');
  });
  it('green when fresh, exit 0, no failures', () => {
    const out = assessDrainSection({ lastPass: { at: new Date(now - 60_000).toISOString(), exit: 0, considered: 2, merged: 1 } }, { now });
    expect(out.status).toBe('green');
    expect(out.reason).toContain('merged 1');
  });
  it('yellow (not a throw) when the history file itself could not be read', () => {
    expect(assessDrainSection({ error: 'ENOENT' }, { now }).status).toBe('yellow');
  });
});

describe('assessGithubAuthSection', () => {
  it('red when no status was ever recorded', () => expect(assessGithubAuthSection(null).status).toBe('red'));
  it('green when applied', () => expect(assessGithubAuthSection({ applied: true, checkedAt: 'x' }).status).toBe('green'));
  it('red on insufficient-access', () => expect(assessGithubAuthSection({ applied: false, reason: 'insufficient-access' }).status).toBe('red'));
  it('yellow on a transient reason', () => expect(assessGithubAuthSection({ applied: false, reason: 'mint-failed' }).status).toBe('yellow'));
});

describe('assessMachineLoadSection', () => {
  it(`green at or below ${LOAD_YELLOW_RATIO}x cores`, () => expect(assessMachineLoadSection({ loadavg: [4], cores: 4 }).status).toBe('green'));
  it(`yellow between ${LOAD_YELLOW_RATIO}x and ${LOAD_RED_RATIO}x`, () => expect(assessMachineLoadSection({ loadavg: [6], cores: 4 }).status).toBe('yellow'));
  it(`red above ${LOAD_RED_RATIO}x cores`, () => expect(assessMachineLoadSection({ loadavg: [10], cores: 4 }).status).toBe('red'));
});

describe('assessLiveState — overall is the worst of every section', () => {
  const now = '2026-09-26T12:00:00.000Z';
  const nowMs = Date.parse(now);

  it('composes all seven sections and picks the worst as overall', () => {
    const read = {
      observedAt: now,
      daemonStatus: { daemons: [], anyRefusing: false, refusingDaemons: [], anyDown: false, downDaemons: [], anyStalled: false, staleDaemons: [], anyRecentAlerts: false, alertingDaemons: [] },
      heavyQueue: { projectedWaitMinutesForNewJob: 2, freeCount: 3 },
      health: { running: true, lastTick: { completedAt: nowMs - 60_000 }, episodes: [] },
      lanePools: [{ repoKey: 'we', free: 50, leased: 0, dirty: 0, total: 50 }],
      drain: { lastPass: { at: new Date(nowMs - 60_000).toISOString(), exit: 0, considered: 1, merged: 1 } },
      githubAuth: { applied: true, checkedAt: now },
      machineLoad: { loadavg: [1], cores: 8 },
    };
    const out = assessLiveState(read);
    expect(out.overall).toBe('green');
    expect(Object.keys(out.sections)).toEqual(['daemons', 'health', 'testQueue', 'lanes', 'drain', 'githubAuth', 'machineLoad']);

    // One red section (auth never applied) drags the overall down, whatever the rest looks like.
    const withRedAuth = { ...read, githubAuth: null };
    expect(assessLiveState(withRedAuth).overall).toBe('red');
  });

  it('throws on an unreadable snapshot rather than silently reporting green', () => {
    expect(() => assessLiveState(null)).toThrow();
  });
});

describe('liveStateOperation — declaration shape', () => {
  it('refuses to build without an injected collect reader', () => {
    expect(() => liveStateOperation({})).toThrow(/collect reader/);
  });

  it('builds a read-only, verdict-from-assess declaration named "live-state"', () => {
    const collect = () => ({
      observedAt: '2026-09-26T12:00:00.000Z',
      daemonStatus: { daemons: [], anyRefusing: false, refusingDaemons: [], anyDown: false, downDaemons: [], anyStalled: false, staleDaemons: [], anyRecentAlerts: false, alertingDaemons: [] },
      heavyQueue: { projectedWaitMinutesForNewJob: 0, freeCount: 1 },
      health: { running: false, lastTick: null, episodes: [] },
      lanePools: [],
      drain: { lastPass: null },
      githubAuth: null,
      machineLoad: { loadavg: [0], cores: 1 },
    });
    const declaration = liveStateOperation({ collect });
    expect(declaration.name).toBe(LIVE_STATE_OP);
    expect(declaration.verdictFrom).toBe('assess');
    expect(declaration.steps.map((s) => s.name)).toEqual(['read', 'assess']);
  });
});
