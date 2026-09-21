/**
 * @file scripts/operations/host-sampler-retention.mjs
 * @description KEEP THE HISTORY, BOUND THE RISK (epic #3383, operator amendment 2026-09-20). Telemetry lives under
 * `~/workspace/.operations/telemetry/` (outside every checkout, so a lane reset cannot lose it) as append-only
 * `<day>.jsonl`. This module adds, without ever deleting or truncating history:
 *   1. ROLLOVER — once a UTC day is over and its file has been quiet, gzip it to `<day>.jsonl.gz` (byte-verified
 *      by a gunzip round-trip BEFORE the raw file is replaced) and write the permanent `<day>.rollup.json`.
 *   2. FREE-SPACE GUARD — {@link GUARD_TIERS}: as free space falls the sampler sheds detail first, then writes
 *      only the minimum, then stops writing. It never removes a byte of what is already on disk and it files ONE
 *      escalation packet (`land-advance-escalations.mjs` shape) per tier.
 * PURE: {@link guardTier}, {@link planRollover}, {@link buildDailyRollup}, {@link escalationRow}.
 * IO: {@link freeBytesOf}, {@link rolloverDay}, {@link runRollover}, {@link maybeEscalate}.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, statfsSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';

import { buildCapacityRollup } from './host-sampler-rollup.mjs';
import { groupSamples, SAMPLER_SOURCE } from './load-analysis.mjs';
import { buildEscalationPacket, listEscalations, writeEscalationPacket } from './land-advance-escalations.mjs';
import { parseTelemetryLines, percentile } from './telemetry.mjs';

const GIB = 1024 ** 3;

/**
 * THE GUARD TABLE. Free space is measured on the telemetry volume every sample (one `statfs`, no spawn).
 * | tier       | free space     | what is still written                                          | escalation |
 * |------------|----------------|----------------------------------------------------------------|------------|
 * | full       | >= 30 GiB      | everything (top processes, memory/disk/thermal, sessions)      | none       |
 * | detail-off | 10 - 30 GiB    | light metrics: load, probes, memory, families, lanes, admission| packet     |
 * | minimal    | 3 - 10 GiB     | load1/5/15/count, probes, memory free/total only               | packet     |
 * | halt       | < 3 GiB        | nothing (sampler stays alive and re-checks each sample)        | packet     |
 * Recovery needs {@link HYSTERESIS_BYTES} above a threshold so a value hovering on it does not flap.
 * Nothing in any tier deletes or truncates existing files.
 */
export const GUARD_TIERS = Object.freeze([
  Object.freeze({ name: 'full', minFree: 30 * GIB, detail: true, families: true, light: true }),
  Object.freeze({ name: 'detail-off', minFree: 10 * GIB, detail: false, families: true, light: true }),
  Object.freeze({ name: 'minimal', minFree: 3 * GIB, detail: false, families: false, light: true }),
  Object.freeze({ name: 'halt', minFree: 0, detail: false, families: false, light: false }),
]);
export const HYSTERESIS_BYTES = 2 * GIB;

/** PURE. The tier for `freeBytes`; when `previous` is given, moving to a BETTER tier needs the hysteresis margin. */
export function guardTier(freeBytes, previous = null) {
  const free = freeBytes == null ? NaN : Number(freeBytes);
  if (!Number.isFinite(free)) return GUARD_TIERS[0]; // unknown free space must never silence the sampler
  const raw = GUARD_TIERS.find((t) => free >= t.minFree) ?? GUARD_TIERS[GUARD_TIERS.length - 1];
  if (!previous) return raw;
  const prevIdx = GUARD_TIERS.findIndex((t) => t.name === previous);
  const rawIdx = GUARD_TIERS.indexOf(raw);
  if (prevIdx < 0 || rawIdx >= prevIdx) return raw; // same or worse: take it immediately
  return free >= GUARD_TIERS[rawIdx].minFree + HYSTERESIS_BYTES ? raw : GUARD_TIERS[prevIdx];
}

/** IO. Free bytes on the volume holding `dir` (nearest existing ancestor), or null. */
export function freeBytesOf(dir, statfs = statfsSync) {
  let p = dir;
  for (let i = 0; i < 8; i++) {
    try { const s = statfs(p); return Number(s.bavail) * Number(s.bsize); } catch { p = join(p, '..'); }
  }
  return null;
}

/** PURE. The escalation row (shape `buildEscalationPacket` consumes) for a degraded guard tier. */
export function escalationRow(tier, freeBytes, dir) {
  return {
    packetId: `host-sampler-disk-${tier.name}`, kind: 'host-sampler-free-space', subject: 'host-sampler telemetry volume', pr: null,
    evidence: [`free space ${(freeBytes / GIB).toFixed(1)} GiB on the volume holding ${dir}`, `guard tier ${tier.name} (thresholds: full >= 30 GiB, detail-off >= 10, minimal >= 3, halt < 3)`,
      'per-process detail is shed first; history is never deleted or truncated'],
    verdict: `guard tier ${tier.name}`, blockedBy: null,
  };
}

/** IO. Write ONE packet per tier (stable id) unless an open one already exists. Returns the path or null. */
export function maybeEscalate({ tier, freeBytes, dir, escalationsDir, now = Date.now() }) {
  if (tier.name === 'full') return null;
  try {
    const row = escalationRow(tier, freeBytes, dir);
    const existing = listEscalations({ dir: escalationsDir }).find((p) => p.id === row.packetId);
    if (existing && existing.status === 'open') return null;
    return writeEscalationPacket(buildEscalationPacket(row, now, existing), { dir: escalationsDir });
  } catch { return null; }
}

// ── ROLLUP ──────────────────────────────────────────────────────────────────────────────────────────────

const pctl = (list) => {
  const s = list.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  const r = (v) => (v == null ? null : Math.round(v * 100) / 100);
  return { p50: r(percentile(s, 0.5)), p90: r(percentile(s, 0.9)), p99: r(percentile(s, 0.99)), max: r(s.length ? s[s.length - 1] : null) };
};
const topN = (obj, n) => Object.entries(obj).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n);

/**
 * PURE + DETERMINISTIC. The permanent per-day summary: per-family CPU percentiles, sample counts, busy windows,
 * the worst samples with their attribution, probe percentiles, and attributed-vs-unattributed CPU shares.
 * Same events in, byte-identical JSON out (no clock, sorted keys). `schema: 2` adds the `capacity` section
 * ({@link buildCapacityRollup}); every `v: 1` field is unchanged, so a `v: 1` reader keeps working (`v` is the rollup FORMAT, `schema` the sampler's record schema).
 * @param {object[]} events @param {{day:string}} o
 */
export function buildDailyRollup(events, { day }) {
  const samples = groupSamples(events);
  const cores = samples.find((s) => s.cores)?.cores ?? null;
  const fam = {};
  for (const s of samples) for (const f of s.famCpu ?? []) (fam[f.name] ||= { cpu: [], count: [] }).cpu.push(f.cpuPct);
  for (const s of samples) for (const [name, n] of Object.entries(s.famCount ?? {})) (fam[name] ||= { cpu: [], count: [] }).count.push(n);
  const families = {};
  for (const name of Object.keys(fam).sort()) {
    const c = pctl(fam[name].cpu);
    families[name] = { cpu: c, countMax: fam[name].count.length ? Math.max(...fam[name].count) : 0, samplesPresent: fam[name].cpu.length };
  }
  // busy windows: consecutive samples above the core count, merged across gaps up to 3x the typical spacing
  const busy = [];
  const gap = 3 * (typicalSpacingMs(samples) || 30_000);
  for (const s of samples) {
    if (!(s.cores && s.load1 > s.cores) || s.atMs == null) continue;
    const last = busy[busy.length - 1];
    if (last && s.atMs - last.toMs <= gap) { last.toMs = s.atMs; last.samples += 1; last.maxLoad1 = Math.max(last.maxLoad1, s.load1); }
    else busy.push({ fromMs: s.atMs, toMs: s.atMs, samples: 1, maxLoad1: s.load1 });
  }
  const bySession = {}; const byLane = {}; let attributedCpu = 0; let totalCpu = 0; let laneUnattr = 0;
  for (const s of samples) for (const p of s.procs ?? []) {
    totalCpu += p.cpuPct;
    if (p.session !== 'unattributed') { bySession[p.session] = (bySession[p.session] || 0) + p.cpuPct; attributedCpu += p.cpuPct; }
    if (p.lane !== 'unattributed') byLane[p.lane] = (byLane[p.lane] || 0) + p.cpuPct; else laneUnattr += p.cpuPct;
  }
  const r1 = (v) => Math.round(v * 10) / 10;
  const worst = [...samples].sort((a, b) => b.load1 - a.load1 || (a.atMs ?? 0) - (b.atMs ?? 0)).slice(0, 6).map((s) => ({
    at: s.atMs == null ? null : new Date(s.atMs).toISOString(), load1: r1(s.load1), topFamilies: s.topFamilies,
    topProcesses: (s.procs ?? []).slice(0, 5).map((p) => ({ cpuPct: r1(p.cpuPct), family: p.family, session: p.session, lane: p.lane, command: p.command.slice(0, 80) })),
  }));
  const max = (list) => { const v = list.filter(Number.isFinite); return v.length ? Math.max(...v) : null; };
  const min = (list) => { const v = list.filter(Number.isFinite); return v.length ? Math.min(...v) : null; };
  return {
    v: 1, schema: 2, day, cores,
    samples: { total: samples.length, sampler: samples.filter((s) => s.source === SAMPLER_SOURCE).length, burst: samples.filter((s) => s.mode === 'burst').length },
    load1: pctl(samples.map((s) => s.load1)),
    probe: { spawnMs: pctl(samples.map((s) => s.spawnMs)), spinOvershootMs: pctl(samples.map((s) => s.spinMs)) },
    families,
    busyWindows: busy.map((b) => ({ from: new Date(b.fromMs).toISOString(), to: new Date(b.toMs).toISOString(), samples: b.samples, maxLoad1: r1(b.maxLoad1) })),
    worst,
    attribution: {
      recordedCpuPctSamples: r1(totalCpu),
      sessionShare: totalCpu ? Math.round((attributedCpu / totalCpu) * 1000) / 1000 : null,
      laneUnattributedShare: totalCpu ? Math.round((laneUnattr / totalCpu) * 1000) / 1000 : null,
      topSessions: topN(bySession, 10).map(([name, cpu]) => ({ name, cpuPctSamples: r1(cpu) })),
      topLanes: topN(byLane, 10).map(([name, cpu]) => ({ name, cpuPctSamples: r1(cpu) })),
    },
    memory: { pressureMax: max(samples.map((s) => s.pressure)), swapUsedMaxBytes: max(samples.map((s) => s.swapUsed)), availableMinBytes: min(samples.map((s) => s.available)) },
    disk: { freeMinBytes: min(samples.map((s) => s.diskFree)), ioBytesPerSMax: max(samples.map((s) => s.diskIo)) },
    thermal: { cpuSpeedLimitMinPct: min(samples.map((s) => s.thermLimit)) },
    // schema 2 (capacity refinement): additive. `capacity.present` is false for a day of schema-1 samples only.
    capacity: buildCapacityRollup(samples),
  };
}

function typicalSpacingMs(samples) {
  const t = samples.map((s) => s.atMs).filter((x) => x != null);
  const d = []; for (let i = 1; i < t.length; i++) d.push(t[i] - t[i - 1]);
  d.sort((a, b) => a - b);
  return d.length ? d[Math.floor(d.length / 2)] : null;
}

// ── ROLLOVER ────────────────────────────────────────────────────────────────────────────────────────────

export const ROLLOVER_GRACE_MS = 60 * 60_000; // wait this long past UTC midnight
export const ROLLOVER_QUIET_MS = 30 * 60_000; // and until the raw file has been quiet this long

/**
 * PURE. Which raw day files are due for rollover: strictly before today (UTC), past the grace, quiet, and not
 * already gzipped.
 * @param {Array<{name:string, mtimeMs:number}>} files directory listing (name + mtime)
 */
export function planRollover(files, { nowMs }) {
  const names = new Set(files.map((f) => f.name));
  // utc-day-slice-ok: rollover partitions the UTC-keyed day files (same key as telemetry-store#dayKey), not an operator-facing date
  const todayStart = Date.parse(`${new Date(nowMs).toISOString().slice(0, 10)}T00:00:00.000Z`);
  const due = [];
  for (const f of files) {
    const m = /^(\d{4}-\d{2}-\d{2})\.jsonl$/.exec(f.name);
    if (!m) continue;
    const dayEnd = Date.parse(`${m[1]}T00:00:00.000Z`) + 86_400_000;
    if (dayEnd > todayStart) continue; // today (or future)
    if (nowMs - dayEnd < ROLLOVER_GRACE_MS) continue;
    if (nowMs - f.mtimeMs < ROLLOVER_QUIET_MS) continue;
    if (names.has(`${m[1]}.jsonl.gz`)) continue; // already converted; leave the raw for a human, never delete blindly
    due.push(m[1]);
  }
  return due.sort();
}

/**
 * IO. Roll one day over. Order matters and every step is verified: gzip → gunzip round-trip equals the raw bytes
 * → write `.gz` and `.rollup.json` atomically → re-verify the file on disk → only then replace the raw file.
 * Aborts (leaving everything untouched) if the raw file changed size while we worked.
 * @returns {{day:string, ok:boolean, reason?:string, rawBytes?:number, gzBytes?:number}}
 */
export function rolloverDay({ dir, day, dryRun = false }) {
  const raw = join(dir, `${day}.jsonl`);
  try {
    const before = statSync(raw);
    const buf = readFileSync(raw);
    const events = parseTelemetryLines(buf.toString('utf8')).events;
    const rollup = buildDailyRollup(events, { day });
    const gz = gzipSync(buf, { level: 9 });
    if (!gunzipSync(gz).equals(buf)) return { day, ok: false, reason: 'gzip round-trip mismatch' };
    if (dryRun) return { day, ok: true, rawBytes: buf.length, gzBytes: gz.length };
    if (statSync(raw).size !== before.size) return { day, ok: false, reason: 'raw file changed while rolling over' };
    const write = (path, data) => { const tmp = `${path}.${process.pid}.tmp`; writeFileSync(tmp, data); renameSync(tmp, path); };
    write(join(dir, `${day}.rollup.json`), `${JSON.stringify(rollup, null, 2)}\n`);
    write(join(dir, `${day}.jsonl.gz`), gz);
    if (!gunzipSync(readFileSync(join(dir, `${day}.jsonl.gz`))).equals(buf)) return { day, ok: false, reason: 'on-disk gzip failed verification; raw kept' };
    if (statSync(raw).size !== before.size) return { day, ok: false, reason: 'raw file changed after gzip; raw kept' };
    unlinkSync(raw);
    return { day, ok: true, rawBytes: buf.length, gzBytes: gz.length };
  } catch (e) {
    return { day, ok: false, reason: String(e?.message ?? e) };
  }
}

/** IO. Roll over every due day. `all` includes days the sampler never wrote (history from the runner alone). */
export function runRollover({ dir, nowMs = Date.now(), all = false, dryRun = false }) {
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir).map((name) => { try { return { name, mtimeMs: statSync(join(dir, name)).mtimeMs }; } catch { return null; } }).filter(Boolean);
  const results = [];
  for (const day of planRollover(files, { nowMs })) {
    if (!all) {
      let hasSampler = false;
      try { hasSampler = readFileSync(join(dir, `${day}.jsonl`), 'utf8').includes(`"source":"${SAMPLER_SOURCE}"`); } catch { /* unreadable: skip */ }
      if (!hasSampler) continue;
    }
    results.push(rolloverDay({ dir, day, dryRun }));
  }
  return results;
}

/** Ensure a directory exists (used for reviews). */
export function ensureDir(dir) { mkdirSync(dir, { recursive: true }); return dir; }
