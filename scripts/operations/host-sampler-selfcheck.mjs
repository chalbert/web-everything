/**
 * @file scripts/operations/host-sampler-selfcheck.mjs
 * @description TRUE HOST CPU + THE SAMPLER'S OWN SELF-CHECKS (epic #3383, capacity refinement 2026-09-21).
 *
 * 1. TRUE HOST CPU. Until now the only CPU figure was a SUM of per-process `%cpu` (a decayed per-process average that
 *    over- and under-counts and misses kernel time). The reservation question needs the whole machine's
 *    user / system / idle split. The cheapest reliable source is Node's own `os.cpus()`: it returns the kernel's
 *    cumulative per-core tick counters (user, nice, sys, idle, irq) from `host_processor_info`, with NO subprocess.
 *    A delta between two readings is exact for the whole window between them. `top -l 1` was rejected (its first
 *    sample is not a delta and `-l 2` costs a second of wall clock and a spawn per sample); `host_statistics` needs a
 *    native addon. The window is the gap since the PREVIOUS SAMPLE (30 s normally), so the figure is already a
 *    30 s average, not an instant. On the first sample (no prior reading) a 250 ms re-read stands in.
 * 2. SELF-CHECKS. Each sample records its own duration and CPU cost ({@link makeChildMeter} times every child the
 *    sampler spawns; the child CPU is bounded above by their wall time), a heartbeat gap counter
 *    ({@link heartbeatGap}) and a data-quality flag ({@link assessQuality}: `partial` when a probe failed).
 * 3. THE PROBE ALLOW-LIST. {@link PROBE_COMMANDS} is every executable the sampler may spawn; a test pins that none
 *    of them is a heavy command (`vitest`, `playwright`, `npm`, `git`, `check-standards`, `verify-lane`).
 *
 * PURE except {@link readCpuTicks} and {@link makeChildMeter}, the IO edge (both take injected functions).
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { cpus } from 'node:os';

/** The record schema version the refined sampler writes on every record (`attributes.schema`). 1 = the original. */
export const SCHEMA_VERSION = 2;

/** Every executable the sampler spawns. None of them is a heavy process; a test enforces it. */
export const PROBE_COMMANDS = Object.freeze(['ps', 'vm_stat', 'sysctl', 'iostat', 'pmset', 'df', 'lsof', 'node', 'claude']);

/** A cumulative-tick reading older than this is not diffed; a short re-read replaces it. */
export const CPU_WINDOW_MAX_GAP_MS = 10 * 60_000;
export const CPU_SHORT_WINDOW_MS = 250;

const r1 = (v) => Math.round(v * 10) / 10;

/** IO. One reading of every core's cumulative tick counters. */
export const readCpuTicks = () => cpus().map((c) => ({ user: c.times.user, nice: c.times.nice, sys: c.times.sys, idle: c.times.idle, irq: c.times.irq }));

/**
 * PURE. Whole-machine CPU split from two cumulative readings. `null` when the readings do not describe a positive
 * window (counter reset, same reading, different core count).
 * @param {Array<{user:number,nice:number,sys:number,idle:number,irq:number}>} prev
 * @param {Array<{user:number,nice:number,sys:number,idle:number,irq:number}>} cur
 */
export function cpuTicksDelta(prev, cur) {
  if (!Array.isArray(prev) || !Array.isArray(cur) || !prev.length || prev.length !== cur.length) return null;
  const sum = { user: 0, nice: 0, sys: 0, idle: 0, irq: 0 };
  let coreBusyMax = 0; let coresOver90 = 0;
  for (let i = 0; i < cur.length; i++) {
    const d = {};
    for (const k of Object.keys(sum)) { d[k] = cur[i][k] - prev[i][k]; if (!(d[k] >= 0)) return null; sum[k] += d[k]; }
    const tot = d.user + d.nice + d.sys + d.idle + d.irq;
    if (tot > 0) {
      const busy = (100 * (tot - d.idle)) / tot;
      coreBusyMax = Math.max(coreBusyMax, busy);
      if (busy > 90) coresOver90 += 1;
    }
  }
  const total = sum.user + sum.nice + sum.sys + sum.idle + sum.irq;
  if (!(total > 0)) return null;
  const pct = (v) => r1((100 * v) / total);
  const idlePct = pct(sum.idle);
  return {
    userPct: pct(sum.user), sysPct: pct(sum.sys), nicePct: pct(sum.nice), idlePct, busyPct: r1(100 - idlePct),
    coreBusyMax: r1(coreBusyMax), coresOver90, cores: cur.length,
  };
}

/**
 * IO-light. Measure the host CPU for one sample. Uses the previous sample's stored reading when it is recent (the
 * whole inter-sample window), otherwise a {@link CPU_SHORT_WINDOW_MS} re-read.
 * @param {{prev:{atMs:number,ticks:object[]}|null, nowMs:number, readTicks?:()=>object[], sleepMs?:(ms:number)=>void}} o
 * @returns {{cpu:object|null, ticks:{atMs:number,ticks:object[]}}}
 */
export function measureHostCpu({ prev, nowMs, readTicks = readCpuTicks, sleepMs = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms) }) {
  const cur = readTicks();
  if (prev && Array.isArray(prev.ticks) && nowMs > prev.atMs && nowMs - prev.atMs <= CPU_WINDOW_MAX_GAP_MS) {
    const d = cpuTicksDelta(prev.ticks, cur);
    if (d) return { cpu: { ...d, windowS: Math.round((nowMs - prev.atMs) / 100) / 10, source: 'interval-delta' }, ticks: { atMs: nowMs, ticks: cur } };
  }
  sleepMs(CPU_SHORT_WINDOW_MS);
  const cur2 = readTicks();
  const d = cpuTicksDelta(cur, cur2);
  return { cpu: d ? { ...d, windowS: CPU_SHORT_WINDOW_MS / 1000, source: 'short-window' } : null, ticks: { atMs: nowMs + CPU_SHORT_WINDOW_MS, ticks: cur2 } };
}

// ── SELF-CHECKS ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * IO edge. Wraps the child-spawning functions the sampler hands to its collectors so every call is timed and every
 * failure recorded. `wallMs` is an UPPER BOUND on the children's CPU (a child cannot burn more CPU than wall time
 * on the one core it ran on for a sequential call); the true figure is verified separately with `/usr/bin/time -l`.
 * @param {{exec?:typeof execFileSync, spawn?:typeof spawnSync, now?:()=>number}} [o]
 */
export function makeChildMeter({ exec = execFileSync, spawn = spawnSync, now = () => Number(process.hrtime.bigint()) / 1e6 } = {}) {
  let calls = 0; let wallMs = 0;
  const failed = [];
  const timed = (cmd, fn) => { const t0 = now(); calls += 1; try { return fn(); } finally { wallMs += now() - t0; } };
  return {
    // A non-zero exit that still printed output (`lsof -p` with one vanished pid exits 1) returned DATA: not a failed probe.
    exec: (cmd, args, opts) => timed(cmd, () => { try { return exec(cmd, args, opts); } catch (e) { if (typeof e?.stdout === 'string' && e.stdout.length) return e.stdout; failed.push(String(cmd)); throw e; } }),
    spawnSync: (cmd, args, opts) => timed(cmd, () => spawn(cmd, args, opts)),
    summary: () => ({ calls, wallMs: Math.round(wallMs * 10) / 10, failed: [...new Set(failed)] }),
  };
}

/**
 * PURE. Heartbeat: how long since the previous sample, and whether that is a missed beat. A gap over
 * `missFactor` x the larger of the expected and the previous cadence counts as missed (a slept laptop, a hung
 * sampler, a killed loop).
 * @param {{prevAtMs:number|null, nowMs:number, expectedS:number, prevExpectedS?:number|null, missedTotal?:number, missFactor?:number}} o
 */
export function heartbeatGap({ prevAtMs, nowMs, expectedS, prevExpectedS = null, missedTotal = 0, missFactor = 2.5 }) {
  if (!Number.isFinite(prevAtMs) || prevAtMs == null || nowMs < prevAtMs) return { gapS: null, expectedS, missed: false, missedTotal };
  const gapS = Math.round((nowMs - prevAtMs) / 100) / 10;
  const bound = missFactor * Math.max(expectedS, prevExpectedS ?? 0);
  const missed = gapS > bound;
  return { gapS, expectedS, missed, missedTotal: missedTotal + (missed ? 1 : 0) };
}

/**
 * PURE. Data quality of one sample: `partial` when any probe failed. Only probes that were EXPECTED count (the
 * guard tier drops `extras` on purpose, and a dry test injects what it needs).
 * @param {{psRows:object[], hostCpu:object|null, extras?:object|null, expectExtras?:boolean, admission?:object|null,
 *   agents?:object|null, expectAgents?:boolean, childFailed?:string[]}} o
 * @returns {{quality:'ok'|'partial', failed:string[]}}
 */
export function assessQuality({ psRows, hostCpu, extras = null, expectExtras = false, admission = null, agents = null, expectAgents = false, childFailed = [] }) {
  const failed = new Set();
  if (!Array.isArray(psRows) || psRows.length === 0) failed.add('ps');
  if (!hostCpu) failed.add('host-cpu');
  if (expectExtras && (!extras || !extras.mem)) failed.add('vm_stat');
  if (expectExtras && extras && !extras.swap) failed.add('sysctl');
  if (!admission) failed.add('admission');
  if (expectAgents && !agents) failed.add('sessions');
  for (const c of childFailed) failed.add(String(c).replace(/^.*\//, ''));
  return { quality: failed.size ? 'partial' : 'ok', failed: [...failed].sort() };
}
