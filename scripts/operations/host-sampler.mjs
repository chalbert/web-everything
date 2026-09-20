#!/usr/bin/env node
/**
 * @file scripts/operations/host-sampler.mjs
 * @description INDEPENDENT HOST-LOAD SAMPLER (epic #3383). Answers "what limit should the concurrent lane /
 * session / heavy-command caps be?" from DATA. The runner writes host metrics only on its own ticks, so a
 * burst between ticks (load 48 at 08:48, 22 at 10:17 on 2026-09-20) was never captured, and load1 did not
 * track lane count. This process samples on its own clock and appends the SAME `metric` records
 * (`telemetry.mjs#newMetric`, same `resource` bag, same `<day>.jsonl` file) so `telemetry-cli` and every
 * existing reader see them. It invents no second format; new metric NAMES were added to the closed
 * `METRIC_NAMES` vocabulary and every record carries `attributes.source = 'host-sampler'` + a shared
 * `attributes.sample` id.
 *
 * PURE CORE + THIN IO SHELL (same split as `host-process-sample.mjs`): {@link classifyFamily},
 * {@link summarizeFamilies}, {@link summarizeSessions}, {@link reconcileLanes}, {@link spinOvershoot},
 * {@link measureSpawn}, {@link buildSample}, {@link sampleToMetrics} take injected facts and touch no
 * clock/disk/process. {@link collectRaw} and {@link runOnce} are the IO edge.
 *
 * GENEROUS COLLECTION (operator amendment 2026-09-20): the top 30 processes per sample (pid, ppid, family, redacted
 * command head, cpu%, rss, elapsed) attributed to a `claude agents` session by ancestry and to a lane by cwd
 * (`unattributed` is a valid bucket, never a guess) via `host-sampler-extras.mjs`; memory pressure / swap /
 * compressor, disk free and IO, CPU throttling; heavy-admission holders. ADAPTIVE BURST: {@link nextCadence} samples
 * every 5 s while the host is hot, back to 30 s after 5 calm minutes, capped in duration and count. RETENTION and
 * the free-space guard live in `host-sampler-retention.mjs` (history is never deleted or truncated).
 *
 * ONE `ps` per sample. Lease state is read straight from each lane's `.git/.lane-lease` (never
 * `lane-pool status`, which runs git in every lane: measured 18 s of CPU on the busy host). Sessions come
 * from `claude agents --json` (~0.5 s CPU), so they are refreshed at most every `sessionsEverySec` seconds
 * and the last summary is reused in between (its age travels as `attributes.ageS`).
 *
 * PROBES (a direct saturation signal, no inference from load average):
 *   host.probe.spawn_ms           wall ms to spawn and reap `node -e 0`
 *   host.probe.spin_overshoot_ms  how far a fixed 50 ms busy-wait's wall clock overshot (an off-CPU stall)
 *
 * CLI:  host-sampler.mjs once [--json] [--dry-run] [--quiet] [--burst] [--fresh-sessions] [--sessions-every=300]
 *       host-sampler.mjs loop [--interval=30] [--max-samples=N] [--dry-run]   (adaptive cadence; the launchd job)
 *       host-sampler.mjs rollover [--all] [--dry-run]                          (gzip finished days + write rollups)
 * Never kills anything, never touches a limit, never writes outside its own state dir + the telemetry dir.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { freemem, loadavg, cpus, totalmem } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { redactCommandLine } from './command-redact.mjs';
import { BURST_TOP_PROCESSES, TOP_PROCESSES, diskRate, parsePsWide, pickTop, readCwds, readExtras, selectAndAttribute } from './host-sampler-extras.mjs';
import { GUARD_TIERS, freeBytesOf, guardTier, maybeEscalate, runRollover } from './host-sampler-retention.mjs';
import {
  TELEMETRY_ROOT, createFileTelemetryStore, dayKey, newMetric, resourceAttributes, serializeTelemetryEvent, telemetryDir, telemetryEnabled,
} from './telemetry-store.mjs';
import { classifySession, VERDICTS } from '../conveyor/session-verdicts.mjs';
import { DEFAULT_LEASE_TTL_MINUTES, LEASE_FILENAME, isLeaseStale } from '../lib/lane-lease.mjs';
import { defaultPoolRoot } from '../lib/lane-pool-paths.mjs';
import { admissionLockRoot, admissionStatus, resolveCap } from '../readiness/heavy-admission.mjs';

export const SOURCE = 'host-sampler';
/** This checkout's root — the input `defaultPoolRoot` / `admissionLockRoot` need (never `TELEMETRY_ROOT`, which is
 *  the workspace dir and would derive the pool from its parent). */
const CHECKOUT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DEFAULT_INTERVAL_SEC = 30;
export const DEFAULT_SESSIONS_EVERY_SEC = 300;
/** df + pmset are near-static, so they are refreshed this often in normal mode and skipped in burst mode. */
export const SLOW_EVERY_SEC = 120;
export const ROLLOVER_CHECK_EVERY_SEC = 1800;
/** The busy-wait length of the spin probe, ms. */
export const SPIN_MS = 50;

// ── FAMILY CLASSIFICATION ───────────────────────────────────────────────────────────────────────────────

/**
 * THE CLOSED FAMILY LIST. `dev-server` is the operator's own long-running servers and is NEVER agent load
 * ({@link AGENT_LOAD_FAMILIES} excludes it). `claude-infra` is an addition to the requested list: 30+ pooled
 * `claude bg-spare` / `bg-pty-host` / `daemon` processes sit idle on this host and would otherwise inflate
 * `claude-session` (real sessions) by an order of magnitude.
 */
export const FAMILIES = Object.freeze([
  'vitest', 'playwright', 'chrome', 'dev-server', 'codex', 'claude-print', 'claude-session', 'claude-infra',
  'git', 'npm', 'node-other', 'other',
]);

/** Families that are load THIS SYSTEM's agents generate (or that the heavy-command semaphore governs). */
export const AGENT_LOAD_FAMILIES = Object.freeze(['vitest', 'playwright', 'chrome', 'codex', 'claude-print', 'claude-session', 'git', 'npm', 'node-other']);
/** The heavy-process definition used by the report's bucket (b). */
export const HEAVY_FAMILIES = Object.freeze(['vitest', 'playwright']);

const baseName = (p) => String(p).replace(/^.*\//, '');

/**
 * PURE. Map one `ps` command line to exactly one {@link FAMILIES} entry. Rules run in a fixed order and use
 * `head` (the text before the first ` -x` flag: the executable plus its subcommand/script words) so an
 * argument such as `--user-data-dir=.../Google/Chrome` can never make an unrelated process look like Chrome.
 * `claude -p` / `--print` is a one-shot dispatched agent, any other `claude` is a session, and the pooled
 * `bg-spare`/`bg-pty-host`/`daemon` processes are `claude-infra`.
 * @param {*} command
 * @returns {string}
 */
export function classifyFamily(command) {
  const c = String(command ?? '');
  const head = c.split(/ --?[A-Za-z]/)[0];
  const exe = baseName(head.split(' ')[0]);

  if (exe === 'claude' || exe === 'claude.exe' || /\/claude-code\/(bin\/claude\.exe|cli\.js)/.test(head)) {
    if (/\b(bg-spare|bg-pty-host)\b|(^| )daemon( |$)/.test(c)) return 'claude-infra';
    if (/(^| )(-p|--print)( |$)/.test(c)) return 'claude-print';
    return 'claude-session';
  }
  if (exe === 'codex' || /(^|\/)codex(-[\w-]+)?(\.mjs)?( |$)/.test(head) || /@openai\/codex/.test(head)) return 'codex';
  // A word in the argv of an unrelated tool (`grep vitest`, `tail chrome.log`) must not classify it: the heavier
  // families require a node/npm launcher or an install path, not just the word.
  const launcher = exe === 'node' || exe === 'nodejs' || exe === 'npm' || exe === 'npx' || exe === 'pnpm' || exe === 'yarn';
  // The operator's own servers — before vitest/node so `eleventy --serve` is never counted as agent load.
  if (launcher && /\beleventy\b/.test(c) && /--(serve|watch)\b/.test(c)) return 'dev-server';
  if (/(^|[/ ])vite( |$)/.test(head) && !/\bvite (build|preview|optimize)\b/.test(head) && (launcher || /node_modules\/\.bin\/vite/.test(head))) return 'dev-server';
  if (/\bwrangler dev\b/.test(head) || (exe === 'npm' && /^npm (run )?(start|dev|serve)( |$)/.test(head))) return 'dev-server';
  if (/ms-playwright/.test(head) || exe === 'playwright' || (launcher && /\bplaywright\b/.test(head))) return 'playwright';
  if (head.startsWith('/') && (/Google Chrome|Chromium|chrome-headless-shell/.test(head) || /\/(chrome|chromium)( |$)/.test(head))) return 'chrome';
  if (/\bvitest\b/.test(head) && (launcher || /\/node_modules\/(\.bin\/)?vitest/.test(head))) return 'vitest';
  if (exe === 'git' || exe.startsWith('git-')) return 'git';
  if (exe === 'npm' || exe === 'npx' || exe === 'pnpm' || exe === 'yarn') return 'npm';
  if (exe === 'node' || exe === 'nodejs') return 'node-other';
  return 'other';
}

/**
 * PURE. Sum CPU%, RSS and process COUNT per family over parsed `ps` rows. Every family key is present (zeros
 * included) so a reader never has to distinguish "absent" from "none running".
 * @param {Array<{pcpu?:number, rssKb?:number, command?:string}>} rows
 * @returns {Record<string,{cpuPct:number,memBytes:number,count:number}>}
 */
export function summarizeFamilies(rows) {
  const out = {};
  for (const f of FAMILIES) out[f] = { cpuPct: 0, memBytes: 0, count: 0 };
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!r || typeof r !== 'object') continue;
    const b = out[classifyFamily(r.command)];
    b.cpuPct += Number.isFinite(r.pcpu) ? r.pcpu : 0;
    b.memBytes += Number.isFinite(r.rssKb) ? r.rssKb * 1024 : 0;
    b.count += 1;
  }
  for (const f of FAMILIES) out[f].cpuPct = Math.round(out[f].cpuPct * 10) / 10;
  return out;
}

// ── SESSIONS ────────────────────────────────────────────────────────────────────────────────────────────

/**
 * PURE. Classify every `claude agents --json` row with the `session-verdicts` classifier and count verdicts.
 * `live` counts sessions whose pid is provably alive; a row with no liveness fact is `unknownLiveness`
 * (never guessed live).
 * @param {{agents?:object[], facts?:Record<string,object>, now:number}} o
 */
export function summarizeSessions({ agents = [], facts = {}, now } = {}) {
  const verdicts = Object.fromEntries(VERDICTS.map((v) => [v, 0]));
  let live = 0;
  let unknownLiveness = 0;
  for (const a of Array.isArray(agents) ? agents : []) {
    const f = (a && facts && facts[a.sessionId]) || {};
    const v = classifySession(a, f, { now }).verdict;
    verdicts[v] = (verdicts[v] || 0) + 1;
    if (f.pidAlive === true) live += 1;
    else if (f.pidAlive == null) unknownLiveness += 1;
  }
  return { total: Array.isArray(agents) ? agents.length : 0, live, unknownLiveness, verdicts };
}

// ── LEASES ──────────────────────────────────────────────────────────────────────────────────────────────

const pathInside = (cwd, lanePath) => typeof cwd === 'string' && (cwd === lanePath || cwd.startsWith(`${lanePath}/`));
const commandTouches = (command, lanePath) => command.includes(`${lanePath}/`) || command.includes(`${lanePath} `) || command.endsWith(lanePath);

/**
 * PURE. Reconcile lane leases with live processes. A lane is:
 *   free         no marker, or a marker past its own TTL (reclaimable — never concurrency)
 *   leased       unexpired marker AND live evidence: its pid is in the `ps` pid set, OR a live agent session's
 *                cwd is inside the lane, OR some live process's command line references the lane path
 *   stale-lease  unexpired marker but NO live process evidence (a crashed or finished holder). Reported apart.
 * The marker's pid is the short-lived `lane-pool acquire` CLI, so pid alone under-reports; the cwd and
 * command-line evidence covers the working session. Caveat: a foreground interactive session that is
 * momentarily running nothing and is not a listed background agent reads as stale-lease.
 * @param {{lanes:Array<{pool:string,lane:string,path:string,lease:object|null}>, nowMs:number,
 *   psPids:Set<number>|number[], psCommands:string[], agentCwds:string[]}} o
 */
export function reconcileLanes({ lanes, nowMs, psPids = new Set(), psCommands = [], agentCwds = [] }) {
  const pids = psPids instanceof Set ? psPids : new Set(psPids);
  const perPool = {};
  const staleLeaseLanes = [];
  const totals = { total: 0, leased: 0, staleLeases: 0, expired: 0, free: 0 };
  for (const l of Array.isArray(lanes) ? lanes : []) {
    const pool = (perPool[l.pool] ||= { total: 0, leased: 0, staleLeases: 0 });
    pool.total += 1;
    totals.total += 1;
    const lease = l.lease;
    const ttlMs = Number.isFinite(lease?.ttlMinutes) ? lease.ttlMinutes * 60_000 : DEFAULT_LEASE_TTL_MINUTES * 60_000;
    if (!lease || isLeaseStale(lease, nowMs, ttlMs)) {
      if (lease) totals.expired += 1;
      totals.free += 1;
      continue;
    }
    const backed = (Number.isInteger(lease.pid) && pids.has(lease.pid))
      || agentCwds.some((cwd) => pathInside(cwd, l.path))
      || psCommands.some((cmd) => commandTouches(cmd, l.path));
    if (backed) { totals.leased += 1; pool.leased += 1; } else { totals.staleLeases += 1; pool.staleLeases += 1; staleLeaseLanes.push(`${l.pool}/${l.lane}`); }
  }
  return { ...totals, perPool, staleLeaseLanes };
}

// ── PROBES (injected clock: unit-testable without a real machine) ───────────────────────────────────────

/**
 * PURE (clock injected). Busy-wait until `spinMs` of the injected clock has elapsed and return how far the
 * final reading overshot the deadline. On an idle core this is ~0-1 ms; a descheduled process (contended host)
 * sees a large jump between two consecutive clock reads.
 * @param {{now:()=>number, spinMs?:number}} o  `now` in ms (fractional allowed)
 * @returns {number} overshoot ms, >= 0, rounded to 0.01
 */
export function spinOvershoot({ now, spinMs = SPIN_MS }) {
  const start = now();
  let t = start;
  while (t - start < spinMs) t = now();
  return Math.round(Math.max(0, t - start - spinMs) * 100) / 100;
}

/**
 * PURE (clock and spawner injected). Wall ms to spawn and reap one child. `run()` must block until it exits.
 * @param {{now:()=>number, run:()=>void}} o
 */
export function measureSpawn({ now, run }) {
  const t0 = now();
  run();
  return Math.round((now() - t0) * 100) / 100;
}

// ── CADENCE (adaptive burst) ────────────────────────────────────────────────────────────────────────────

/**
 * Normal cadence 30 s. While the host is HOT (load1 above the core count, or either probe over its bound) sample
 * every 5 s; return to 30 s after `calmMs` of continuous calm. Bounded on three axes so a saturated host cannot be
 * hammered by its own sampler: a burst lasts at most `burstMaxMs`, then a `cooldownMs` refractory period follows;
 * at most `burstDailyCap` burst samples per UTC day; and a burst sample records only {@link BURST_TOP_PROCESSES}
 * processes and skips the slow collectors (roster refresh, df, pmset).
 * Probe bounds sit well above the idle range measured on this host (spawn ~41 ms, spin overshoot ~0 ms).
 */
export const CADENCE = Object.freeze({
  normalSec: 30, burstSec: 5, calmMs: 300_000, burstMaxMs: 20 * 60_000, cooldownMs: 10 * 60_000,
  burstDailyCap: 2000, spawnBoundMs: 250, spinBoundMs: 25,
});

export const initialCadence = () => ({ mode: 'normal', burstStartedMs: null, calmSinceMs: null, cooldownUntilMs: 0, day: null, burstToday: 0 });

/**
 * PURE (clock injected). Advance the cadence state machine with one observation.
 * @param {ReturnType<typeof initialCadence>} state
 * @param {{load1:number, cores:number, spawnMs?:number|null, spinMs?:number|null}} obs
 * @returns {{state:object, intervalSec:number, hot:boolean, capped:boolean}}
 */
export function nextCadence(state, obs, nowMs, cfg = CADENCE) {
  // utc-day-slice-ok: the daily burst budget resets on the same UTC day boundary the telemetry day files use
  const day = new Date(nowMs).toISOString().slice(0, 10);
  const s = { ...state };
  if (s.day !== day) { s.day = day; s.burstToday = 0; }
  const hot = (obs.load1 > obs.cores) || (Number.isFinite(obs.spawnMs) && obs.spawnMs > cfg.spawnBoundMs) || (Number.isFinite(obs.spinMs) && obs.spinMs > cfg.spinBoundMs);
  if (s.mode === 'burst') {
    s.burstToday += 1;
    if (hot) s.calmSinceMs = null; else if (s.calmSinceMs == null) s.calmSinceMs = nowMs;
    const calmDone = s.calmSinceMs != null && nowMs - s.calmSinceMs >= cfg.calmMs;
    const tooLong = nowMs - s.burstStartedMs >= cfg.burstMaxMs;
    if (calmDone || tooLong) {
      s.mode = 'normal'; s.burstStartedMs = null; s.calmSinceMs = null;
      if (tooLong && !calmDone) s.cooldownUntilMs = nowMs + cfg.cooldownMs;
    }
  } else if (hot && nowMs >= s.cooldownUntilMs && s.burstToday < cfg.burstDailyCap) {
    s.mode = 'burst'; s.burstStartedMs = nowMs; s.calmSinceMs = null;
  }
  const capped = s.burstToday >= cfg.burstDailyCap;
  return { state: s, intervalSec: s.mode === 'burst' ? cfg.burstSec : cfg.normalSec, hot, capped };
}

// ── SAMPLE ASSEMBLY ─────────────────────────────────────────────────────────────────────────────────────

/**
 * PURE. Assemble one sample from already-read raw facts. Deterministic: the same `raw` gives a byte-identical
 * sample (no clock, no randomness).
 * @param {object} raw `{at, nowMs, host, psRows, agents, sessionsAgeS, lanes, admission, probe, extras?, cwds?, ioRate?,
 *   tier?, mode?, intervalS?}`
 */
export function buildSample(raw) {
  const rows = Array.isArray(raw.psRows) ? raw.psRows : [];
  const tier = raw.tier ?? guardTier(null);
  const families = summarizeFamilies(rows);
  const psPids = new Set(rows.map((r) => r.pid));
  const psCommands = rows.map((r) => String(r.command ?? ''));
  // The roster may be minutes old (cached), but liveness is re-derived from THIS sample's `ps` whenever the
  // agent row carries a pid, so a session that died since the refresh is not counted live.
  const facts = {};
  for (const a of raw.agents?.agents ?? []) {
    const f = { ...(raw.agents.facts?.[a.sessionId] ?? {}) };
    if (Number.isInteger(a.pid)) f.pidAlive = psPids.has(a.pid);
    facts[a.sessionId] = f;
  }
  const liveAgents = (raw.agents?.agents ?? []).filter((a) => facts[a.sessionId]?.pidAlive === true);
  const sessions = raw.agents ? { ...summarizeSessions({ agents: raw.agents.agents, facts, now: raw.nowMs }), ageS: raw.sessionsAgeS } : null;
  const lanes = reconcileLanes({ lanes: raw.lanes, nowMs: raw.nowMs, psPids, psCommands, agentCwds: liveAgents.map((a) => a.cwd).filter(Boolean) });
  const n = raw.mode === 'burst' ? BURST_TOP_PROCESSES : TOP_PROCESSES;
  const top = tier.detail
    ? selectAndAttribute({ rows, agents: liveAgents, lanes: raw.lanes ?? [], cwds: raw.cwds ?? {}, n, familyOf: classifyFamily, redact: redactCommandLine })
    : [];
  return {
    at: raw.at, host: raw.host, families, sessions, lanes, top, tier: tier.name, mode: raw.mode ?? 'normal', intervalS: raw.intervalS ?? DEFAULT_INTERVAL_SEC,
    admission: raw.admission, probe: raw.probe, extras: tier.detail ? (raw.extras ?? null) : null, ioRate: raw.ioRate ?? null, psRowCount: rows.length,
  };
}

const baseName2 = (p) => String(p).replace(/^.*\//, '');

/**
 * PURE. Shape a sample into the metric-sample array `newMetric` records, gated by the guard tier: `full` writes
 * everything, `detail-off` drops per-process rows and the extra host collectors, `minimal` keeps only load, probes
 * and memory, `halt` writes nothing. Every entry carries `attributes.source`, `sample`, `mode` and `interval_s`.
 * @param {ReturnType<typeof buildSample>} s
 * @returns {Array<{name:string,value:number,unit:string,attributes:object}>}
 */
export function sampleToMetrics(s) {
  const tier = GUARD_TIERS.find((t) => t.name === s.tier) ?? GUARD_TIERS[0];
  if (!tier.light) return [];
  const base = { source: SOURCE, sample: s.at, mode: s.mode, interval_s: s.intervalS };
  const m = (name, value, unit, attributes = {}) => ({ name, value: Number.isFinite(value) ? value : 0, unit, attributes: { ...base, ...attributes } });
  const out = [];
  const [l1, l5, l15] = s.host.load ?? [];
  out.push(m('host.cpu.load1', l1, 'count'), m('host.cpu.load5', l5, 'count'), m('host.cpu.load15', l15, 'count'), m('host.cpu.count', s.host.cpuCount, 'count'));
  out.push(m('host.mem.free_bytes', s.host.freeBytes, 'bytes'), m('host.mem.total_bytes', s.host.totalBytes, 'bytes'));
  if (s.probe) out.push(m('host.probe.spawn_ms', s.probe.spawnMs, 'ms'), m('host.probe.spin_overshoot_ms', s.probe.spinOvershootMs, 'ms'));
  if (!tier.families) return out;

  const cpu = {}; const n = {}; const mem = {};
  let cpuTotal = 0; let nTotal = 0; let memTotal = 0;
  for (const f of FAMILIES) {
    const x = s.families[f];
    cpu[`cpu.${f}`] = x.cpuPct; n[`n.${f}`] = x.count; mem[`mem.${f}`] = x.memBytes;
    cpuTotal += x.cpuPct; nTotal += x.count; memTotal += x.memBytes;
  }
  out.push(m('host.family.cpu_pct', Math.round(cpuTotal * 10) / 10, 'percent', cpu), m('host.family.count', nTotal, 'count', n), m('host.family.mem_bytes', memTotal, 'bytes', mem));
  if (s.sessions) {
    const attrs = { total: s.sessions.total, unknown: s.sessions.unknownLiveness, ageS: s.sessions.ageS };
    for (const [v, c] of Object.entries(s.sessions.verdicts)) attrs[`verdict.${v}`] = c;
    out.push(m('host.sessions.live', s.sessions.live, 'count', attrs));
  }
  const lanePools = {};
  for (const [p, x] of Object.entries(s.lanes.perPool)) lanePools[`leased.${p}`] = x.leased;
  out.push(m('lane.pool.total', s.lanes.total, 'count', { pools: Object.keys(s.lanes.perPool).length }));
  out.push(m('lane.pool.leased', s.lanes.leased, 'count', { ...lanePools, definition: 'unexpired-lease-with-live-process' }));
  out.push(m('lane.pool.stale_leases', s.lanes.staleLeases, 'count', { expired: s.lanes.expired }));
  out.push(m('lane.pool.free', s.lanes.free, 'count'));
  if (s.admission) {
    const owners = (list) => list.map((h) => baseName2(h.owner ?? '')).filter(Boolean).join(',').slice(0, 200);
    out.push(m('heavy.admission.cap', s.admission.cap, 'count'));
    out.push(m('heavy.admission.held', s.admission.heldCount, 'count', { holders: owners(s.admission.held ?? []) }));
    out.push(m('heavy.admission.waiting', s.admission.waiting.length, 'count', { stale: s.admission.staleWaiting?.length ?? 0, waiters: owners(s.admission.waiting) }));
  }
  if (!tier.detail) return out;

  const x = s.extras;
  if (x?.mem) {
    out.push(m('host.mem.available_bytes', x.mem.availableBytes, 'bytes', { wired_bytes: x.mem.wiredBytes, active_bytes: x.mem.activeBytes, inactive_bytes: x.mem.inactiveBytes, pageins: x.mem.pageins, pageouts: x.mem.pageouts, swapins: x.mem.swapins, swapouts: x.mem.swapouts }));
    out.push(m('host.mem.compressed_bytes', x.mem.compressedBytes, 'bytes'));
  }
  if (x?.swap) {
    out.push(m('host.mem.swap_used_bytes', x.swap.swapUsedBytes, 'bytes', { total_bytes: x.swap.swapTotalBytes }));
    out.push(m('host.mem.pressure_level', x.swap.pressureLevel, 'count'));
  }
  if (x?.disk) out.push(m('host.disk.free_bytes', x.disk.freeBytes, 'bytes', { used_pct: x.disk.usedPct }));
  if (s.ioRate) out.push(m('host.disk.io_bytes_per_s', s.ioRate.bytesPerS, 'bytes', { xfrs_per_s: s.ioRate.xfrsPerS }));
  if (x?.therm) out.push(m('host.cpu.thermal_limit_pct', x.therm.cpuSpeedLimitPct, 'percent', { scheduler_limit_pct: x.therm.schedulerLimitPct, warned: x.therm.warned }));
  for (const p of s.top) {
    // Command was redacted (then cut) in `selectAndAttribute`, exactly as `host-process-sample.mjs` orders it.
    out.push(m('host.process.entry.cpu_pct', p.cpuPct, 'percent', {
      pid: p.pid, ppid: p.ppid, family: p.family, command: p.command, mem_bytes: p.memBytes, elapsed_s: p.elapsedS,
      lane: p.lane, lane_source: p.laneSource, session: p.session, session_id: p.sessionId,
    }));
  }
  return out;
}

// ── IO EDGE ─────────────────────────────────────────────────────────────────────────────────────────────

/** The sampler's OWN state dir (lock + caches) — never the telemetry dir, never shared with the runner. */
export function stateDir(env = process.env) {
  return env.HOST_SAMPLER_DIR ? String(env.HOST_SAMPLER_DIR) : join(TELEMETRY_ROOT, '.operations', 'host-sampler');
}

/** Non-blocking exclusive lock via O_EXCL. Reclaims a lock whose pid is provably dead. Returns a release fn or null. */
export function acquireLock(file, { pid = process.pid, pidAlive = (p) => { try { process.kill(p, 0); return true; } catch (e) { return e?.code !== 'ESRCH'; } } } = {}) {
  mkdirSync(dirname(file), { recursive: true });
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const fd = openSync(file, 'wx');
      writeFileSync(fd, String(pid));
      closeSync(fd);
      return () => { try { unlinkSync(file); } catch { /* already gone */ } };
    } catch (e) {
      if (e?.code !== 'EEXIST') return null;
      let holder = NaN;
      try { holder = Number(readFileSync(file, 'utf8')); } catch { /* raced away */ }
      if (Number.isInteger(holder) && holder > 0 && pidAlive(holder)) return null;
      try { unlinkSync(file); } catch { /* raced */ }
    }
  }
  return null;
}

const readJson = (file, fallback) => { try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return fallback; } };
const writeJsonAtomic = (file, data) => { try { mkdirSync(dirname(file), { recursive: true }); const tmp = `${file}.${process.pid}.tmp`; writeFileSync(tmp, JSON.stringify(data)); renameSync(tmp, file); } catch { /* caches are an optimisation only */ } };

function readLanes(poolParent) {
  const lanes = [];
  let pools = [];
  try { pools = readdirSync(poolParent, { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith('.')); } catch { return lanes; }
  for (const pool of pools) {
    let dirs = [];
    try { dirs = readdirSync(join(poolParent, pool.name)).filter((n) => /^lane-\d+$/.test(n)); } catch { continue; }
    for (const lane of dirs) {
      const path = join(poolParent, pool.name, lane);
      let lease = null;
      try { lease = JSON.parse(readFileSync(join(path, '.git', LEASE_FILENAME), 'utf8')); } catch { /* no marker / corrupt = no lease */ }
      lanes.push({ pool: pool.name, lane, path, lease: lease && typeof lease === 'object' ? lease : null });
    }
  }
  return lanes;
}

function readAgentsLight({ now }) {
  // Lazy import: the wip-agents reader pulls in the run store and transcript scanners; only paid on a refresh.
  return import('./wip-agents-io.mjs').then(({ createWipAgentsReader }) => {
    const read = createWipAgentsReader({
      readTranscript: () => ({}), readDispatchRecords: () => new Map(), cliVersion: () => null,
      readDrainHistory: () => null, readDrainAlerts: () => null, now: () => now,
    });
    const r = read();
    return { agents: r.agents, facts: r.facts };
  });
}

/** Read the session cache, refresh via `claude agents --json` when older than `everySec` (or `fresh`). `noRefresh`
 *  (burst mode) only ever serves the cache. */
async function loadSessions({ dir, nowMs, everySec, fresh, noRefresh = false, readAgents = readAgentsLight }) {
  const cacheFile = join(dir, 'sessions.json');
  const cached = readJson(cacheFile, null);
  const age = cached && Number.isFinite(cached.atMs) ? (nowMs - cached.atMs) / 1000 : Infinity;
  if (cached && ((!fresh && age < everySec) || noRefresh)) return { data: cached.data, ageS: Math.round(age) };
  try {
    const data = await readAgents({ now: nowMs });
    writeJsonAtomic(cacheFile, { atMs: nowMs, data });
    return { data, ageS: 0 };
  } catch {
    return cached ? { data: cached.data, ageS: Math.round(age) } : { data: null, ageS: null };
  }
}

/** Read every raw fact for one sample. One `ps`, one lease sweep, one admission read, two probes, a few sub-10 ms
 *  collectors, and `lsof` only for top processes whose cwd is not cached. */
export async function collectRaw({ env = process.env, sessionsEverySec = DEFAULT_SESSIONS_EVERY_SEC, fresh = false, mode = 'normal', intervalS = DEFAULT_INTERVAL_SEC, tier = GUARD_TIERS[0], io = {} } = {}) {
  const nowMs = (io.nowMs ?? Date.now)();
  const cpuNow = io.hrMs ?? (() => Number(process.hrtime.bigint()) / 1e6);
  const dir = stateDir(env);
  const stateFile = join(dir, 'state.json');
  const state = io.state ?? readJson(stateFile, {});
  const burst = mode === 'burst';
  const psText = io.ps
    ? io.ps()
    : (() => { try { return execFileSync('ps', ['-Awwo', 'pid=,ppid=,pcpu=,rss=,etime=,command='], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return ''; } })();
  const psRows = parsePsWide(psText);
  const sessions = io.sessions ? { data: io.sessions, ageS: 0 } : await loadSessions({ dir, nowMs, everySec: sessionsEverySec, fresh, noRefresh: burst });
  const poolParent = defaultPoolRoot(CHECKOUT_ROOT, env);
  let admission = io.admission ?? null;
  if (!admission) try {
    const lockRoot = admissionLockRoot(CHECKOUT_ROOT, env);
    admission = existsSync(lockRoot) ? admissionStatus({ lockRoot, cap: resolveCap(env) }) : { cap: resolveCap(env), heldCount: 0, freeCount: resolveCap(env), held: [], waiting: [], staleWaiting: [] };
  } catch { /* unreadable admission root = no admission facts */ }
  const probe = io.probe ?? {
    spawnMs: measureSpawn({ now: cpuNow, run: () => { spawnSync(process.execPath, ['-e', '0'], { stdio: 'ignore' }); } }),
    spinOvershootMs: spinOvershoot({ now: cpuNow }),
  };
  const lanes = io.lanes ?? readLanes(poolParent);

  // extras + attribution inputs (detail tier only)
  let extras = null; let ioRate = null; let cwds = {};
  const nextState = { ...state };
  if (tier.detail) {
    const slowDue = !burst && (!state.slow || nowMs - state.slow.atMs >= SLOW_EVERY_SEC * 1000);
    extras = io.extras ?? readExtras({ slow: slowDue });
    if (slowDue) nextState.slow = { atMs: nowMs, therm: extras.therm, disk: extras.disk };
    else if (state.slow) { extras = { ...extras, therm: extras.therm ?? state.slow.therm, disk: extras.disk ?? state.slow.disk }; }
    if (extras.io) {
      if (state.io) ioRate = diskRate(state.io, extras.io, (nowMs - state.io.atMs) / 1000);
      nextState.io = { ...extras.io, atMs: nowMs };
    }
    const cache = state.cwds ?? {};
    const startKey = (r) => `${r.pid}:${Math.floor((nowMs / 1000 - (r.etimeS ?? 0)) / 60)}`;
    const wanted = pickTop(psRows, burst ? BURST_TOP_PROCESSES : TOP_PROCESSES);
    const keep = {};
    const missing = [];
    for (const r of wanted) { const k = startKey(r); if (cache[k]) { keep[k] = cache[k]; cwds[r.pid] = cache[k]; } else missing.push(r); }
    if (missing.length && !burst) {
      const fresh2 = io.cwds ? io.cwds(missing.map((r) => r.pid)) : readCwds(missing.map((r) => r.pid));
      for (const r of missing) if (fresh2[r.pid]) { keep[startKey(r)] = fresh2[r.pid]; cwds[r.pid] = fresh2[r.pid]; }
    }
    nextState.cwds = keep;
  }
  if (!io.state && !io.noStateWrite) writeJsonAtomic(stateFile, nextState);
  return {
    at: new Date(nowMs).toISOString(), nowMs,
    host: io.host ?? { load: loadavg(), cpuCount: cpus().length, freeBytes: freemem(), totalBytes: totalmem() },
    psRows, agents: sessions.data, sessionsAgeS: sessions.ageS, lanes, admission, probe, extras, ioRate, cwds, tier, mode, intervalS,
  };
}

/**
 * Take ONE sample and append its records. Own lock (skips, never blocks, if another sampler is mid-write);
 * append-only (one `append` per line, exactly like the runner's recorder); touches nothing the runner owns.
 * The free-space guard runs first: it picks the tier that decides how much this sample may write.
 * @returns {Promise<{skipped?:string, sample?:object, written:number, failed:number, file?:string, tier?:string}>}
 */
export async function runOnce({ env = process.env, dryRun = false, fresh = false, sessionsEverySec = DEFAULT_SESSIONS_EVERY_SEC, mode = 'normal', intervalS = DEFAULT_INTERVAL_SEC, io = {}, store = null, rollover = true } = {}) {
  if (!telemetryEnabled(env)) return { skipped: 'telemetry disabled (WE_TELEMETRY)', written: 0, failed: 0 };
  const release = dryRun ? () => {} : acquireLock(join(stateDir(env), 'sample.lock'));
  if (!release) return { skipped: 'another host-sampler run holds the sample lock', written: 0, failed: 0 };
  try {
    const target = store ?? createFileTelemetryStore({ dir: telemetryDir() });
    const telDir = target.dir ?? telemetryDir();
    const state = readJson(join(stateDir(env), 'guard.json'), {});
    const free = io.freeBytes !== undefined ? io.freeBytes : freeBytesOf(telDir);
    const tier = guardTier(free, state.tier ?? null);
    if (!dryRun) {
      writeJsonAtomic(join(stateDir(env), 'guard.json'), { tier: tier.name, freeBytes: free, atMs: (io.nowMs ?? Date.now)() });
      if (tier.name !== 'full') maybeEscalate({ tier, freeBytes: free, dir: telDir, escalationsDir: io.escalationsDir ?? join(TELEMETRY_ROOT, '.operations', 'escalations'), now: (io.nowMs ?? Date.now)() });
    }
    const raw = await collectRaw({ env, sessionsEverySec, fresh, mode, intervalS, tier, io: dryRun ? { ...io, noStateWrite: true } : io });
    const sample = buildSample(raw);
    const metrics = sampleToMetrics(sample);
    if (dryRun) return { sample, written: 0, failed: 0, tier: tier.name };
    const resource = resourceAttributes();
    const day = dayKey(sample.at);
    let written = 0; let failed = 0;
    for (const x of metrics) {
      const rec = newMetric({ name: x.name, kind: 'sampler', value: x.value, unit: x.unit, timestamp: sample.at, attributes: x.attributes, resource });
      const line = serializeTelemetryEvent(rec);
      if (line && target.append(line, day).ok) written += 1; else failed += 1;
    }
    let rolled = [];
    if (rollover && !io.ps) {
      const rs = readJson(join(stateDir(env), 'rollover.json'), {});
      if (!(Number(rs.checkedMs) > raw.nowMs - ROLLOVER_CHECK_EVERY_SEC * 1000)) {
        writeJsonAtomic(join(stateDir(env), 'rollover.json'), { checkedMs: raw.nowMs });
        rolled = runRollover({ dir: telDir, nowMs: raw.nowMs });
      }
    }
    return { sample, written, failed, tier: tier.name, rolled, file: join(telDir, `${day}.jsonl`) };
  } finally {
    release();
  }
}

// ── CLI ─────────────────────────────────────────────────────────────────────────────────────────────────

function renderSummary(r) {
  if (r.skipped) return `host-sampler: skipped — ${r.skipped}`;
  const s = r.sample;
  const [l1, l5, l15] = s.host.load;
  const lines = [
    `host-sampler ${s.at}  load ${l1.toFixed(2)}/${l5.toFixed(2)}/${l15.toFixed(2)} on ${s.host.cpuCount} cores  mode ${s.mode}  guard ${s.tier}  (${r.written} records written${r.failed ? `, ${r.failed} FAILED` : ''})`,
    `  probe: spawn ${s.probe.spawnMs} ms, spin overshoot ${s.probe.spinOvershootMs} ms`,
    `  families (cpu% of one core / procs): ${FAMILIES.filter((f) => s.families[f].count).map((f) => `${f} ${s.families[f].cpuPct}/${s.families[f].count}`).join(', ')}`,
    s.sessions ? `  sessions: ${s.sessions.live} live of ${s.sessions.total} (${Object.entries(s.sessions.verdicts).filter(([, c]) => c).map(([v, c]) => `${v} ${c}`).join(', ')}; roster age ${s.sessions.ageS}s)` : '  sessions: unavailable',
    `  lanes: ${s.lanes.leased} leased, ${s.lanes.staleLeases} stale-lease${s.lanes.staleLeaseLanes.length ? ` (${s.lanes.staleLeaseLanes.slice(0, 8).join(', ')}${s.lanes.staleLeaseLanes.length > 8 ? ', …' : ''})` : ''}, ${s.lanes.expired} expired, ${s.lanes.free} free of ${s.lanes.total}`,
    s.admission ? `  heavy admission: cap ${s.admission.cap}, held ${s.admission.heldCount}, waiting ${s.admission.waiting.length} (+${s.admission.staleWaiting?.length ?? 0} stale markers ignored)` : '  heavy admission: unavailable',
  ];
  const x = s.extras;
  if (x?.mem) lines.push(`  memory: available ${(x.mem.availableBytes / 1024 ** 3).toFixed(1)} GiB, compressed ${(x.mem.compressedBytes / 1024 ** 3).toFixed(1)} GiB, swap used ${(x.swap?.swapUsedBytes / 1024 ** 3 || 0).toFixed(2)} GiB, pressure level ${x.swap?.pressureLevel ?? '?'}`);
  if (x?.disk || s.ioRate || x?.therm) lines.push(`  disk/thermal: ${x?.disk ? `${(x.disk.freeBytes / 1024 ** 3).toFixed(0)} GiB free` : 'free ?'}, io ${s.ioRate ? `${(s.ioRate.bytesPerS / 1024 ** 2).toFixed(1)} MiB/s` : 'n/a (first sample)'}, cpu speed limit ${x?.therm ? `${x.therm.cpuSpeedLimitPct}%` : '?'}`);
  const unattr = s.top.filter((p) => p.session === 'unattributed').length;
  lines.push(`  top ${s.top.length} processes recorded (${s.top.length - unattr} session-attributed, ${s.top.filter((p) => p.lane !== 'unattributed').length} lane-attributed)`);
  for (const p of s.top.slice(0, 6)) lines.push(`    ${String(p.cpuPct).padStart(6)}%  ${p.family.padEnd(14)} ${p.lane.padEnd(24)} ${String(p.session).padEnd(16)} ${p.command.slice(0, 70)}`);
  return lines.join('\n');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function main(argv = process.argv.slice(2), env = process.env) {
  const cmd = argv.find((a) => !a.startsWith('--')) || 'once';
  const flag = (n) => argv.find((a) => a === `--${n}` || a.startsWith(`--${n}=`));
  const val = (n, d) => { const f = flag(n); return f && f.includes('=') ? f.slice(f.indexOf('=') + 1) : d; };
  const interval = Math.max(5, Number(val('interval', DEFAULT_INTERVAL_SEC)) || DEFAULT_INTERVAL_SEC);
  const sessionsEverySec = Number(val('sessions-every', DEFAULT_SESSIONS_EVERY_SEC)) || DEFAULT_SESSIONS_EVERY_SEC;
  if (cmd === 'once') {
    const burst = !!flag('burst'); // measurement aid: take ONE sample the way burst mode does (top 15, no slow collectors)
    const r = await runOnce({ env, dryRun: !!flag('dry-run'), fresh: !!flag('fresh-sessions'), sessionsEverySec, mode: burst ? 'burst' : 'normal', intervalS: burst ? CADENCE.burstSec : DEFAULT_INTERVAL_SEC });
    if (!flag('quiet') || r.failed) process.stdout.write(`${flag('json') ? JSON.stringify(r.sample ?? r, null, 2) : renderSummary(r)}\n`);
    return r.skipped ? 0 : (r.failed ? 1 : 0);
  }
  if (cmd === 'rollover') {
    const res = runRollover({ dir: telemetryDir(), all: !!flag('all'), dryRun: !!flag('dry-run') });
    process.stdout.write(`${res.length ? res.map((x) => `${x.day}: ${x.ok ? `ok ${x.rawBytes} -> ${x.gzBytes} bytes` : `SKIPPED ${x.reason}`}`).join('\n') : 'nothing due'}\n`);
    return 0;
  }
  if (cmd === 'loop') {
    const releaseLoop = acquireLock(join(stateDir(env), 'loop.lock'));
    if (!releaseLoop) { process.stderr.write('host-sampler: another loop is already running\n'); return 0; }
    let stop = false;
    const maxSamples = Number(val('max-samples', 0)) || Infinity; // bounded runs for measurement and tests
    let taken = 0;
    for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { stop = true; });
    let cadence = initialCadence();
    const cfg = { ...CADENCE, normalSec: interval };
    try {
      while (!stop) {
        const t0 = Date.now();
        let intervalSec = cfg.normalSec;
        try {
          const r = await runOnce({ env, sessionsEverySec, dryRun: !!flag('dry-run'), mode: cadence.mode, intervalS: cadence.mode === 'burst' ? cfg.burstSec : cfg.normalSec });
          process.stdout.write(`${renderSummary(r).split('\n')[0]}\n`);
          if (r.sample) {
            const step = nextCadence(cadence, { load1: r.sample.host.load[0], cores: r.sample.host.cpuCount, spawnMs: r.sample.probe.spawnMs, spinMs: r.sample.probe.spinOvershootMs }, Date.now(), cfg);
            if (step.state.mode !== cadence.mode) process.stdout.write(`host-sampler: cadence ${cadence.mode} -> ${step.state.mode}${step.capped ? ' (daily burst cap reached)' : ''}\n`);
            cadence = step.state; intervalSec = step.intervalSec;
          }
        } catch (e) { process.stderr.write(`host-sampler: sample failed: ${e?.message ?? e}\n`); }
        if (++taken >= maxSamples) break;
        const wait = Math.max(1000, intervalSec * 1000 - (Date.now() - t0));
        for (let waited = 0; !stop && waited < wait; waited += 1000) await sleep(Math.min(1000, wait - waited));
      }
    } finally { releaseLoop(); }
    return 0;
  }
  process.stderr.write('usage: host-sampler.mjs once [--json] [--dry-run] [--quiet] [--fresh-sessions] [--sessions-every=300] | loop [--interval=30] [--max-samples=N] [--dry-run] | rollover [--all] [--dry-run]\n');
  return 2;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().then((code) => { process.exitCode = code; }, (e) => { process.stderr.write(`host-sampler: ${e?.stack ?? e}\n`); process.exitCode = 1; });
}
