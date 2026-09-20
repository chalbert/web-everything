import { describe, it, expect } from 'vitest';

import { CADENCE, initialCadence, nextCadence } from '../host-sampler.mjs';
import {
  UNATTRIBUTED, diskRate, parseDf, parseEtime, parseIostat, parseLsofCwd, parsePsWide, parseSwapAndPressure, parseTherm, parseVmStat, pickTop, selectAndAttribute,
} from '../host-sampler-extras.mjs';

const familyOf = (c) => (c.includes('vitest') ? 'vitest' : 'other');
const redact = (c) => c;

describe('parsePsWide / parseEtime', () => {
  it('parses ppid and elapsed time; skips lines that do not match', () => {
    const rows = parsePsWide(['  100     1  95.0 900000 01-03:54:35 node /w/lane-3/x.js --serve', ' 200 100 0.5 1000 05:09 npm exec vitest', 'garbage', ''].join('\n'));
    expect(rows).toEqual([
      { pid: 100, ppid: 1, pcpu: 95, rssKb: 900000, etimeS: 100475, command: 'node /w/lane-3/x.js --serve' },
      { pid: 200, ppid: 100, pcpu: 0.5, rssKb: 1000, etimeS: 309, command: 'npm exec vitest' },
    ]);
    expect(parseEtime('12:03:04')).toBe(43384);
    expect(parseEtime('nope')).toBeNull();
  });
});

describe('selectAndAttribute — never guesses', () => {
  const lanes = [
    { pool: 'we', lane: 'lane-3', path: '/w/.lanes/we/lane-3' },
    { pool: 'we', lane: 'lane-54', path: '/w/.lanes/we/lane-54' },
  ];
  const agents = [{ pid: 10, name: 'fix-7', sessionId: 'sess-7', cwd: '/w/.lanes/we/lane-54/scripts' }];
  const rows = [
    { pid: 10, ppid: 1, pcpu: 2, rssKb: 100, etimeS: 5, command: 'claude' },
    { pid: 11, ppid: 10, pcpu: 80, rssKb: 100, etimeS: 5, command: 'bash -c x' },
    { pid: 12, ppid: 11, pcpu: 70, rssKb: 100, etimeS: 5, command: 'node (vitest)' }, // 2 hops below the agent
    { pid: 20, ppid: 1, pcpu: 60, rssKb: 100, etimeS: 5, command: 'node /w/.lanes/we/lane-3/node_modules/.bin/eleventy --serve' }, // argv → lane, no session
    { pid: 30, ppid: 1, pcpu: 50, rssKb: 100, etimeS: 5, command: 'node /somewhere/else.js' }, // cwd → lane
    { pid: 40, ppid: 1, pcpu: 40, rssKb: 100, etimeS: 5, command: 'mystery' }, // nothing
    { pid: 41, ppid: 41, pcpu: 30, rssKb: 100, etimeS: 5, command: 'self-parent cycle' }, // ppid cycle must terminate
    { pid: 50, ppid: 1, pcpu: 0.1, rssKb: 100, etimeS: 5, command: 'idle' }, // below the floor
  ];
  const out = selectAndAttribute({ rows, agents, lanes, cwds: { 30: '/w/.lanes/we/lane-3/tests' }, familyOf, redact });
  const by = (pid) => out.find((p) => p.pid === pid);

  it('orders by cpu and drops processes below the floor', () => {
    expect(out.map((p) => p.pid)).toEqual([11, 12, 20, 30, 40, 41, 10]);
    expect(pickTop(rows, 3).map((r) => r.pid)).toEqual([11, 12, 20]);
  });

  it('maps a process tree to its session by ancestry (self, child, grandchild)', () => {
    for (const pid of [10, 11, 12]) expect(by(pid)).toMatchObject({ session: 'fix-7', sessionId: 'sess-7' });
    expect(by(20).session).toBe(UNATTRIBUTED);
  });

  it('maps to a lane by cwd, then argv, then the session cwd — and says which', () => {
    expect(by(30)).toMatchObject({ lane: 'we/lane-3', laneSource: 'cwd' });
    expect(by(20)).toMatchObject({ lane: 'we/lane-3', laneSource: 'argv' });
    expect(by(12)).toMatchObject({ lane: 'we/lane-54', laneSource: 'session-cwd' });
  });

  it('leaves the rest in the literal `unattributed` bucket, and survives a parent cycle', () => {
    expect(by(40)).toMatchObject({ session: UNATTRIBUTED, lane: UNATTRIBUTED, sessionId: null, laneSource: null });
    expect(by(41).session).toBe(UNATTRIBUTED);
  });

  it('lane-5 evidence never attributes to lane-54', () => {
    const r = selectAndAttribute({ rows: [{ pid: 1, ppid: 0, pcpu: 9, rssKb: 1, etimeS: 1, command: 'node /w/.lanes/we/lane-5/x.js' }], lanes, familyOf, redact });
    expect(r[0].lane).toBe(UNATTRIBUTED);
  });
});

describe('system collectors parse real-shaped output', () => {
  it('vm_stat → bytes, compressor and paging counters', () => {
    const t = ['Mach Virtual Memory Statistics: (page size of 16384 bytes)', 'Pages free:                                   240109.', 'Pages active:                                1269900.', 'Pages inactive:                              1253426.', 'Pages speculative:                             11000.', 'Pages purgeable:                                5000.', 'Pages wired down:                             400000.', 'Pages occupied by compressor:                1100000.', 'Pageins:                                   9000000.', 'Pageouts:                                    1500.', 'Swapins:                                        0.', 'Swapouts:                                       7.'].join('\n');
    const v = parseVmStat(t);
    expect(v).toMatchObject({ pageSize: 16384, freeBytes: 240109 * 16384, compressedBytes: 1100000 * 16384, pageins: 9000000, pageouts: 1500, swapouts: 7 });
    expect(v.availableBytes).toBe((240109 + 1253426 + 11000 + 5000) * 16384);
  });

  it('swap usage and pressure level', () => {
    expect(parseSwapAndPressure('total = 2048.00M  used = 512.50M  free = 1535.50M  (encrypted)\n2\n')).toEqual({ swapUsedBytes: 512.5 * 1024 ** 2, swapTotalBytes: 2048 * 1024 ** 2, pressureLevel: 2 });
    expect(parseSwapAndPressure('total = 0.00M  used = 0.00M  free = 0.00M  (encrypted)\n1\n')).toMatchObject({ swapUsedBytes: 0, pressureLevel: 1 });
    expect(parseSwapAndPressure('')).toMatchObject({ pressureLevel: 1 });
  });

  it('iostat cumulative counters and the rate between two readings (never negative)', () => {
    const a = parseIostat('              disk0\n    KB/t xfrs   MB \n    5.74 1000 100.00 \n');
    const b = parseIostat('    KB/t xfrs   MB \n    5.74 1600 220.00 \n');
    expect(a).toEqual({ xfrs: 1000, megabytes: 100 });
    expect(diskRate(a, b, 60)).toEqual({ bytesPerS: Math.round((120 * 1024 * 1024) / 60), xfrsPerS: 10 });
    expect(diskRate(b, a, 60)).toBeNull(); // counter reset
    expect(diskRate(null, b, 60)).toBeNull();
  });

  it('pmset thermal, df and lsof', () => {
    expect(parseTherm('Note: No thermal warning level has been recorded\nNote: No performance warning level has been recorded\n')).toEqual({ cpuSpeedLimitPct: 100, schedulerLimitPct: 100, warned: false });
    expect(parseTherm('CPU_Scheduler_Limit = 100\nCPU_Speed_Limit = 72\nCPU_Available_CPUs = 12\nThermal warning level: 1 (warning level)')).toMatchObject({ cpuSpeedLimitPct: 72, warned: true });
    expect(parseDf('Filesystem 1024-blocks Used Available Capacity iused ifree %iused Mounted on\n/dev/disk3s1s1 971350180 12338632 109552068 11% 458732 1095520680 0% /')).toEqual({ freeBytes: 109552068 * 1024, usedPct: 11 });
    expect(parseLsofCwd('p100\nfcwd\nn/w/.lanes/we/lane-3\np200\nfcwd\nn/tmp\n')).toEqual({ 100: '/w/.lanes/we/lane-3', 200: '/tmp' });
  });
});

describe('adaptive burst cadence (injected clock)', () => {
  const calm = { load1: 4, cores: 12, spawnMs: 41, spinMs: 0 };
  const hotLoad = { load1: 20, cores: 12, spawnMs: 41, spinMs: 0 };
  const min = 60_000;
  const T0 = Date.parse('2026-09-20T10:00:00.000Z');

  it('stays at 30 s while calm', () => {
    const r = nextCadence(initialCadence(), calm, T0);
    expect(r).toMatchObject({ intervalSec: 30, hot: false });
    expect(r.state.mode).toBe('normal');
  });

  it('switches to 5 s when load1 exceeds the cores, or either probe exceeds its bound', () => {
    expect(nextCadence(initialCadence(), hotLoad, T0)).toMatchObject({ intervalSec: 5, hot: true });
    expect(nextCadence(initialCadence(), { ...calm, spawnMs: CADENCE.spawnBoundMs + 1 }, T0).intervalSec).toBe(5);
    expect(nextCadence(initialCadence(), { ...calm, spinMs: CADENCE.spinBoundMs + 1 }, T0).intervalSec).toBe(5);
    expect(nextCadence(initialCadence(), { ...calm, spawnMs: CADENCE.spawnBoundMs }, T0).intervalSec).toBe(30); // at the bound is fine
  });

  it('returns to 30 s only after 5 continuous calm minutes; a hot blip resets the calm clock', () => {
    let s = nextCadence(initialCadence(), hotLoad, T0).state;
    s = nextCadence(s, calm, T0 + 1 * min).state; // calm starts
    expect(nextCadence(s, calm, T0 + 5 * min).intervalSec).toBe(5); // 4 min calm: still burst
    const blip = nextCadence(s, hotLoad, T0 + 5 * min);
    expect(blip.state.calmSinceMs).toBeNull();
    const done = nextCadence(s, calm, T0 + 6 * min); // 5 min since calm began at +1
    expect(done).toMatchObject({ intervalSec: 30 });
    expect(done.state.mode).toBe('normal');
  });

  it('caps burst duration at 20 min, then a 10 min cooldown blocks re-entry', () => {
    let s = nextCadence(initialCadence(), hotLoad, T0).state;
    const end = nextCadence(s, hotLoad, T0 + CADENCE.burstMaxMs);
    expect(end.state.mode).toBe('normal');
    expect(end.intervalSec).toBe(30);
    expect(nextCadence(end.state, hotLoad, T0 + CADENCE.burstMaxMs + 5 * min).state.mode).toBe('normal'); // cooling down
    expect(nextCadence(end.state, hotLoad, T0 + CADENCE.burstMaxMs + CADENCE.cooldownMs).state.mode).toBe('burst');
  });

  it('caps burst samples per UTC day and resets at the day boundary', () => {
    let s = { ...initialCadence(), day: '2026-09-20', burstToday: CADENCE.burstDailyCap };
    const r = nextCadence(s, hotLoad, T0);
    expect(r.state.mode).toBe('normal');
    expect(r.capped).toBe(true);
    const next = nextCadence(r.state, hotLoad, Date.parse('2026-09-21T00:00:10.000Z'));
    expect(next.state.mode).toBe('burst');
    expect(next.state.burstToday).toBe(0);
  });
});
