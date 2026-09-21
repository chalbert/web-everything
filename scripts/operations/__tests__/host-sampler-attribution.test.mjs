import { describe, it, expect } from 'vitest';

import { admissionDetail, attributeProcesses, diffWorkers, holderTable, sessionPidMap, summarizeWorkers } from '../host-sampler-attribution.mjs';
import { PROBE_COMMANDS, assessQuality, cpuTicksDelta, heartbeatGap, makeChildMeter, measureHostCpu } from '../host-sampler-selfcheck.mjs';
import { HEAVY_CLASSES } from '../host-sampler-classes.mjs';

const NOW = Date.parse('2026-09-21T12:00:00.000Z');
const row = (pid, ppid, pcpu, rssKb, command, etimeS = 100) => ({ pid, ppid, pcpu, rssKb, command, etimeS });
const LANES = [
  { pool: 'web-everything', lane: 'lane-3', path: '/w/.lanes/web-everything/lane-3' },
  { pool: 'web-everything', lane: 'lane-30', path: '/w/.lanes/web-everything/lane-30' },
];

/**
 *   1  launchd
 *   100 node heavy-admission.mjs run -- npm run test:unit        (holds slot 0; owner lane-3)   [cwd lane-3]
 *   101   npm run test:unit                                       vitest class
 *   102     node (vitest)                                         vitest class
 *   103     node (vitest)
 *   110 node scripts/check-standards.mjs                          NOT under a holder (typed directly)  [cwd lane-30]
 *   120 claude bg-spare ...   (roster: build-1, cwd lane-3)
 *   121   git status                                              under the worker, no cwd of its own
 *   130 fseventsd
 *   140 node scripts/foo.mjs --dir=/w/.lanes/web-everything/lane-30/x     (argv names lane-30)
 */
const ROWS = [
  row(1, 0, 0, 10, '/sbin/launchd'),
  row(100, 1, 1, 30_000, 'node scripts/readiness/heavy-admission.mjs run -- npm run test:unit', 900),
  row(101, 100, 0.5, 10_000, 'npm run test:unit'),
  row(102, 101, 300, 700_000, 'node (vitest)'),
  row(103, 101, 200, 600_000, 'node (vitest)'),
  row(110, 1, 90, 500_000, 'node scripts/check-standards.mjs'),
  row(120, 1, 2, 300_000, 'claude bg-spare --bg-spare /tmp/x.claim.sock'),
  row(121, 120, 40, 20_000, 'git status'),
  row(130, 1, 100, 10_000, '/System/Library/Frameworks/CoreServices.framework/Versions/A/Frameworks/FSEvents.framework/Versions/A/Support/fseventsd'),
  row(140, 1, 3, 50_000, 'node scripts/foo.mjs --dir=/w/.lanes/web-everything/lane-30/x'),
];
const CWDS = { 100: '/w/.lanes/web-everything/lane-3/scripts', 110: '/w/.lanes/web-everything/lane-30' };
const ADMISSION = {
  cap: 2, heldCount: 1, freeCount: 1,
  held: [{ slot: 0, owner: '/w/.lanes/web-everything/lane-3', pid: 100, heartbeatAt: new Date(NOW - 875_000).toISOString(), meta: null }],
  waiting: [{ owner: '/w/.lanes/web-everything/lane-30', pid: 999, requestedAt: new Date(NOW - 42_000).toISOString() }],
  staleWaiting: [
    { owner: '/w/.lanes/web-everything/lane-27', pid: null, requestedAt: '2026-09-04T15:04:58.681Z' },
    { owner: '/w/.lanes/frontierui/lane-1', pid: 4242, requestedAt: '2026-09-14T15:04:58.681Z' },
  ],
};
const AGENTS = [{ sessionId: 's-build', name: 'build-1', kind: 'background', state: 'working', pid: 120, cwd: '/w/.lanes/web-everything/lane-3', startedAt: NOW - 60_000 }];

describe('attributeProcesses — lane and heavy-admission holder attribution over a fake process table', () => {
  const a = attributeProcesses({ rows: ROWS, lanes: LANES, cwds: CWDS, sessionByPid: sessionPidMap(AGENTS), admission: ADMISSION, nowMs: NOW });

  it('joins each process to a lane by cwd, then by an ancestor\'s cwd, then by argv, then by the session\'s cwd', () => {
    expect(Object.keys(a.perLane).sort()).toEqual(['web-everything/lane-3', 'web-everything/lane-30']);
    // lane-3: holder wrapper 100 (cwd) + 101, 102, 103 (ancestor) + worker 120 (session cwd) + its git child 121 (ancestor of 120)
    expect(a.perLane['web-everything/lane-3'].count).toBe(6);
    expect(a.perLane['web-everything/lane-3'].cpuPct).toBe(1 + 0.5 + 300 + 200 + 2 + 40);
    // lane-30: check-standards 110 (cwd) + foo.mjs 140 (argv)
    expect(a.perLane['web-everything/lane-30'].count).toBe(2);
    expect(a.perLane['web-everything/lane-30'].byClass['check-standards'].cpuPct).toBe(90);
    expect(a.laneSources).toMatchObject({ cwd: 2, argv: 1, 'session-cwd': 1, ancestor: 4 });
  });

  it('a process with no lane evidence is `unlaned`, never guessed onto a lane', () => {
    expect(a.unlaned.count).toBe(2); // launchd + fseventsd
    expect(a.unlaned.cpuPct).toBe(100);
    expect(a.laneShare).toBeCloseTo(1 - 100 / a.totals.cpuPct, 3);
  });

  it('joins descendants of a held slot\'s pid to that HOLDER, and the holder carries its hold time', () => {
    expect(a.holders).toHaveLength(1);
    const h = a.holders[0];
    expect(h).toMatchObject({ id: 'slot-0:lane-3', slot: 0, pid: 100, alive: true, unslotted: false, heldForS: 875, count: 4, cpuPct: 501.5 });
    expect(h.byClass.vitest).toMatchObject({ count: 3, cpuPct: 500.5 });
  });

  it('heavy work outside every holder is UNADMITTED (check:standards typed directly), reported apart', () => {
    expect(a.unadmittedHeavy.count).toBe(1);
    expect(a.unadmittedHeavy.cpuPct).toBe(90);
    expect(a.unadmittedHeavy.byClass['check-standards'].count).toBe(1);
  });

  it('a heavy command is ONE root however many processes it spawns (npm wrapper between two vitests does not split it)', () => {
    expect(a.heavyRoots.count).toBe(2); // the vitest tree under 101 + the standalone check-standards
    expect(a.heavyRoots.byClass).toEqual({ 'check-standards': 1, vitest: 1 });
    for (const c of Object.keys(a.heavyRoots.byClass)) expect(HEAVY_CLASSES).toContain(c);
  });

  it('a run is ADMITTED when the slot\'s pid is INSIDE its tree (a shell that runs verify-lane.mjs, which holds its own slot), not only above it', () => {
    const rows = [row(300, 1, 0, 1000, '/bin/bash -c eval node scripts/verify-lane.mjs check'), row(301, 300, 50, 50_000, 'node scripts/verify-lane.mjs check'), row(302, 301, 250, 500_000, 'node (vitest)'), row(310, 1, 90, 400_000, 'node scripts/check-standards.mjs')];
    const adm = { cap: 2, held: [{ slot: 1, owner: '/w/.lanes/web-everything/lane-3', pid: 301, heartbeatAt: new Date(NOW - 10_000).toISOString() }], waiting: [], staleWaiting: [] };
    const r = attributeProcesses({ rows, lanes: LANES, admission: adm, nowMs: NOW });
    expect(r.unadmittedHeavy.count).toBe(1); // only the standalone check-standards; the shell above the holder is part of an admitted run
    expect(r.unadmittedHeavy.byClass).toHaveProperty('check-standards');
    expect(r.heavyRoots.count).toBe(2);
    expect(r.holders[0]).toMatchObject({ id: 'slot-1:lane-3', pid: 301, count: 2 });
  });

  it('a `heavy-admission.mjs run` wrapper with NO slot is an unslotted holder; a wrapper that is waiting is not a holder', () => {
    const rows = [...ROWS, row(200, 1, 1, 1000, 'node scripts/readiness/heavy-admission.mjs run -- npm run check:standards'), row(999, 1, 0, 1000, 'node scripts/readiness/heavy-admission.mjs run -- npm test')];
    const t = holderTable({ admission: ADMISSION, rows, nowMs: NOW });
    expect(t.get(200)).toMatchObject({ unslotted: true, id: 'unslotted:200' });
    expect(t.has(999)).toBe(false);
  });

  it('a `run` wrapper NESTED under a slot holder (verify-lane re-entering the wrapper) is part of that admitted run, not a second unslotted holder', () => {
    const rows = [row(300, 1, 0, 1000, 'node scripts/verify-lane.mjs check', 90), row(301, 300, 1, 30_000, 'node scripts/readiness/heavy-admission.mjs run -- npm run test:unit'), row(302, 301, 0.5, 10_000, 'npm run test:unit'), row(303, 302, 250, 600_000, 'node (vitest)')];
    const adm = { cap: 2, held: [{ slot: 0, owner: '/w/.lanes/web-everything/lane-3', pid: 300, heartbeatAt: new Date(NOW - 80_000).toISOString() }], waiting: [], staleWaiting: [] };
    expect([...holderTable({ admission: adm, rows, nowMs: NOW }).values()].map((h) => h.id)).toEqual(['slot-0:lane-3']);
    const r = attributeProcesses({ rows, lanes: LANES, admission: adm, nowMs: NOW });
    expect(r.holders).toHaveLength(1);
    expect(r.holders[0]).toMatchObject({ id: 'slot-0:lane-3', count: 4, cpuPct: 251.5 }); // the vitest CPU is charged to the slot that admitted it
  });

  it('a held slot whose owner process is gone still yields a record (alive:false)', () => {
    const r = attributeProcesses({ rows: ROWS.filter((x) => x.pid !== 100), lanes: LANES, cwds: CWDS, admission: ADMISSION, nowMs: NOW });
    expect(r.holders.find((h) => h.id === 'slot-0:lane-3')).toMatchObject({ alive: false, count: 0 });
  });

  it('survives a parent cycle and an empty table', () => {
    const cyc = attributeProcesses({ rows: [row(5, 6, 1, 1, 'node a'), row(6, 5, 1, 1, 'node b')], nowMs: NOW });
    expect(cyc.totals.count).toBe(2);
    expect(attributeProcesses({ rows: [], nowMs: NOW }).laneShare).toBeNull();
  });
});

describe('admissionDetail — waiting and stale markers', () => {
  it('reports how long each waiter has waited and FLAGS every stale marker with its age, deleting nothing', () => {
    const d = admissionDetail({ admission: ADMISSION, nowMs: NOW });
    expect(d.waiting).toEqual([{ owner: 'lane-30', pid: 999, waitedS: 42 }]);
    expect(d.stale.map((s) => [s.owner, s.pool, s.requestedAt.slice(0, 10)])).toEqual([['lane-27', 'web-everything', '2026-09-04'], ['lane-1', 'frontierui', '2026-09-14']]);
    expect(d.oldestStaleAgeS).toBe(Math.round((NOW - Date.parse('2026-09-04T15:04:58.681Z')) / 1000));
  });
  it('no admission facts is empty, not an error', () => {
    expect(admissionDetail({ admission: null, nowMs: NOW })).toEqual({ waiting: [], stale: [], oldestStaleAgeS: 0 });
  });
});

describe('summarizeWorkers + diffWorkers — worker lifecycle', () => {
  const agents = [
    { sessionId: 'b1', name: 'build-1', kind: 'background', state: 'working', pid: 120, startedAt: NOW - 30_000 },
    { sessionId: 'r1', name: 'review-9', kind: 'background', state: 'working', pid: 300, startedAt: NOW - 20_000 },
    { sessionId: 'i1', name: 'webeverything-4', kind: 'interactive', pid: 400 },
    { sessionId: 'd1', name: 'prepare-5', kind: 'background', state: 'working', pid: 555 }, // pid not in ps: dead, not live
    { sessionId: 'n1', name: 'fix-2', kind: 'background', state: 'working' }, // no pid: unknown, counted apart
  ];
  const rows = [
    row(120, 1, 2, 300_000, 'claude bg-spare --bg-spare /tmp/x.claim.sock'), row(121, 120, 40, 20_000, 'git status'), row(122, 120, 300, 700_000, 'node (vitest)'),
    row(300, 1, 1, 200_000, 'claude bg-spare --bg-spare /tmp/y.claim.sock'), row(400, 1, 1, 100_000, 'claude'),
  ];
  const w = summarizeWorkers({ agents, rows });

  it('counts LIVE sessions by kind from THIS sample\'s ps only, and splits a worker\'s own cost from the heavy commands it spawned', () => {
    expect(w.total).toBe(3);
    expect(w.byKind.build).toEqual({ count: 1, cpuPct: 42, memBytes: 320_000 * 1024, heavyCpuPct: 300, heavyMemBytes: 700_000 * 1024 });
    expect(w.byKind.review.count).toBe(1);
    expect(w.byKind.interactive.count).toBe(1);
    expect(w.byKind.prepare.count).toBe(0);
    expect(w.rosterWorkingNoPid).toBe(1);
  });

  it('is edge-triggered: the first sample is a baseline (no events), a new worker is a START at its recorded start, a vanished one a FINISH', () => {
    const first = diffWorkers({ prev: undefined, live: w.live, nowMs: NOW, prevMs: null });
    expect(first.events).toEqual([]);
    expect(Object.keys(first.next).sort()).toEqual(['b1', 'i1', 'r1']);
    const later = NOW + 30_000;
    const live2 = [...w.live.filter((x) => x.sessionId !== 'r1'), { sessionId: 'n2', name: 'build-7', kind: 'build', pid: 700, startedAt: later - 5_000 }];
    const step = diffWorkers({ prev: first.next, live: live2, nowMs: later, prevMs: NOW });
    expect(step.events).toEqual([
      { event: 'start', kind: 'build', name: 'build-7', sessionId: 'n2', at: new Date(later - 5_000).toISOString(), discovered: false },
      { event: 'finish', kind: 'review', name: 'review-9', sessionId: 'r1', at: new Date(later).toISOString(), discovered: false },
    ]);
    expect(diffWorkers({ prev: step.next, live: live2, nowMs: later + 30_000, prevMs: later }).events).toEqual([]);
  });

  it('a worker the roster only NOW attached a pid to, started hours ago, is `discovered`, not a dispatch start', () => {
    const old = { sessionId: 'old', name: 'prepare-1', kind: 'prepare', pid: 9, startedAt: NOW - 5 * 3_600_000 };
    const e = diffWorkers({ prev: {}, live: [old], nowMs: NOW, prevMs: NOW - 30_000 }).events;
    expect(e).toHaveLength(1);
    expect(e[0]).toMatchObject({ event: 'start', discovered: true, at: new Date(NOW).toISOString() });
  });
});

describe('host CPU: kernel tick deltas', () => {
  const t = (user, sys, idle, nice = 0, irq = 0) => ({ user, nice, sys, idle, irq });
  it('user, system, idle and busy percent of the whole machine from two cumulative readings', () => {
    const prev = [t(1000, 500, 8000), t(1000, 500, 8000)];
    const cur = [t(1300, 600, 8100), t(1100, 500, 8400)]; // core0: +300u +100s +100i = 500; core1: +100u +0s +400i = 500
    const d = cpuTicksDelta(prev, cur);
    expect(d).toMatchObject({ userPct: 40, sysPct: 10, idlePct: 50, busyPct: 50, cores: 2, coresOver90: 0 });
    expect(d.coreBusyMax).toBe(80);
  });
  it('a counter reset, a core-count change or an empty window is null, never a wrong number', () => {
    expect(cpuTicksDelta([t(10, 10, 10)], [t(5, 10, 10)])).toBeNull();
    expect(cpuTicksDelta([t(1, 1, 1)], [t(1, 1, 1), t(1, 1, 1)])).toBeNull();
    expect(cpuTicksDelta([t(1, 1, 1)], [t(1, 1, 1)])).toBeNull();
    expect(cpuTicksDelta(null, [])).toBeNull();
  });
  it('uses the whole inter-sample window when the previous reading is recent, a short re-read otherwise', () => {
    let reads = 0; const slept = [];
    const readTicks = () => [t(1000 + 300 * reads, 100 * reads, 8000 + 100 * reads++)];
    const first = measureHostCpu({ prev: null, nowMs: 5000, readTicks, sleepMs: (ms) => slept.push(ms) });
    expect(first.cpu.source).toBe('short-window');
    expect(slept).toEqual([250]);
    const second = measureHostCpu({ prev: first.ticks, nowMs: first.ticks.atMs + 30_000, readTicks, sleepMs: (ms) => slept.push(ms) });
    expect(second.cpu).toMatchObject({ source: 'interval-delta', windowS: 30 });
    expect(slept).toEqual([250]); // no second sleep
    const stale = measureHostCpu({ prev: first.ticks, nowMs: first.ticks.atMs + 3_600_000, readTicks, sleepMs: (ms) => slept.push(ms) });
    expect(stale.cpu.source).toBe('short-window');
  });
});

describe('self-checks', () => {
  it('heartbeat: an on-time sample is not a miss; a long gap is counted once and accumulates', () => {
    expect(heartbeatGap({ prevAtMs: 1_000_000, nowMs: 1_030_000, expectedS: 30 })).toMatchObject({ gapS: 30, missed: false, missedTotal: 0 });
    expect(heartbeatGap({ prevAtMs: 1_000_000, nowMs: 1_400_000, expectedS: 30, missedTotal: 2 })).toMatchObject({ gapS: 400, missed: true, missedTotal: 3 });
    // burst (5 s) -> normal (30 s): the previous cadence sets the bound too
    expect(heartbeatGap({ prevAtMs: 1_000_000, nowMs: 1_070_000, expectedS: 5, prevExpectedS: 30 }).missed).toBe(false);
    expect(heartbeatGap({ prevAtMs: null, nowMs: 1, expectedS: 30 })).toMatchObject({ gapS: null, missed: false });
  });

  it('quality is `partial` when a probe failed and names which; `ok` otherwise', () => {
    const ok = { psRows: [{}], hostCpu: {}, extras: { mem: {}, swap: {} }, expectExtras: true, admission: {} };
    expect(assessQuality(ok)).toEqual({ quality: 'ok', failed: [] });
    expect(assessQuality({ ...ok, psRows: [], hostCpu: null, extras: { mem: null, swap: {} }, admission: null, childFailed: ['/usr/bin/lsof'] })).toEqual({ quality: 'partial', failed: ['admission', 'host-cpu', 'lsof', 'ps', 'vm_stat'] });
    expect(assessQuality({ ...ok, extras: null, expectExtras: false })).toEqual({ quality: 'ok', failed: [] }); // a tier that drops extras on purpose is not a failure
  });

  it('the child meter times every child, records failures, and treats non-zero-exit-WITH-output (lsof) as data', () => {
    let t = 0;
    const m = makeChildMeter({
      now: () => (t += 10),
      exec: (cmd) => {
        if (cmd === 'lsof') { const e = new Error('exit 1'); e.stdout = 'p1\nn/x\n'; throw e; }
        if (cmd === 'boom') throw new Error('nope');
        return 'out';
      },
      spawn: () => ({ status: 0 }),
    });
    expect(m.exec('ps', [])).toBe('out');
    expect(m.exec('lsof', [])).toBe('p1\nn/x\n');
    expect(() => m.exec('boom', [])).toThrow('nope');
    m.spawnSync('node', ['-e', '0']);
    expect(m.summary()).toEqual({ calls: 4, wallMs: 40, failed: ['boom'] });
  });

  it('NO probe may spawn a heavy process: the allow-list holds none of them', () => {
    for (const heavy of ['vitest', 'playwright', 'npm', 'npx', 'git', 'check-standards', 'verify-lane', 'eleventy', 'vite', 'container', 'docker', 'top']) expect(PROBE_COMMANDS).not.toContain(heavy);
    expect(PROBE_COMMANDS).toEqual(expect.arrayContaining(['ps', 'lsof', 'sysctl']));
  });
});
