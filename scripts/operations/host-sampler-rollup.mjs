/**
 * @file scripts/operations/host-sampler-rollup.mjs
 * @description THE ROLLUPS AND THE SMOOTHED BRAKE (epic #3383, capacity refinement 2026-09-21). Two pure halves over
 * the schema-2 sampler samples ({@link ./load-analysis.mjs#groupSamples}, `sample.cap`):
 *
 * 1. {@link buildCapacityRollup}: what the per-day rollup gains to answer "how much to RESERVE": per hour and per
 *    command class p50/p90/p99/max CPU and RSS, host idle p50/p10/min, heavy-burst EPISODES (start, duration, peak
 *    load1, peak host CPU, the class and holder responsible, how many workers overlapped it) and
 *    `reservation-inputs` (the system + VS Code baseline from QUIET samples, per-worker marginal cost by kind with r
 *    and n, the heavy pool's demand, the lane count and per-lane need). A schema-1 sample (no `cap`) contributes to
 *    nothing here and never throws; a day with none reports `present: false`.
 * 2. {@link smoothedPressure}: the admit / hold BRAKE, computed over the last N minutes of samples with hysteresis,
 *    NEVER from a single reading. {@link replayPressure} chains the hysteresis state through a whole file so the CLI
 *    (`host-sampler.mjs pressure`) reports the state a brake that had been running all day would be in.
 *
 * EVERY THRESHOLD HERE IS PROVISIONAL: the first days of schema-2 data have to set them ({@link PRESSURE_DEFAULTS},
 * {@link EPISODE_DEFAULTS}). PURE: no fs, clock, env, process. The IO edge is {@link readPressureSamples}.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';

import { CONTAINER_ACTIVE_CPU_PCT, NOT_QUIET_CLASSES, HEAVY_CLASSES, SYSTEM_CLASSES, WORKER_KINDS } from './host-sampler-classes.mjs';
import { groupSamples } from './load-analysis.mjs';
import { parseTelemetryLines, percentile } from './telemetry.mjs';

// ── small stats ─────────────────────────────────────────────────────────────────────────────────────────

const fin = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const r2 = (v) => (v == null ? null : Math.round(v * 100) / 100);
const sortedNums = (list) => list.map(fin).filter((x) => x != null).sort((a, b) => a - b);
/** `{p50,p90,p99,max,n}` by nearest rank (the same `percentile` every other telemetry reader uses). */
export function dist(list) {
  const s = sortedNums(list);
  return { p50: r2(percentile(s, 0.5)), p90: r2(percentile(s, 0.9)), p99: r2(percentile(s, 0.99)), max: r2(s.length ? s[s.length - 1] : null), n: s.length };
}
/** `{p50,p10,min,n}`: for idle, the LOW tail is the risk. */
export function lowDist(list) {
  const s = sortedNums(list);
  return { p50: r2(percentile(s, 0.5)), p10: r2(percentile(s, 0.1)), min: r2(s.length ? s[0] : null), n: s.length };
}

/**
 * PURE. Ordinary least squares of `ys` on `xs`. `r` is Pearson's; null when either side has no variance.
 * @returns {{slope:number|null, intercept:number|null, r:number|null, n:number}}
 */
export function regress(xs, ys) {
  const n = xs.length;
  if (n < 2 || n !== ys.length) return { slope: null, intercept: null, r: null, n };
  const mx = xs.reduce((a, b) => a + b, 0) / n; const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxx = 0; let syy = 0; let sxy = 0;
  for (let i = 0; i < n; i++) { sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; sxy += (xs[i] - mx) * (ys[i] - my); }
  if (!(sxx > 0)) return { slope: null, intercept: null, r: null, n };
  const slope = sxy / sxx;
  return { slope: r2(slope), intercept: r2(my - slope * mx), r: syy > 0 ? r2(sxy / Math.sqrt(sxx * syy)) : null, n };
}

// ── THE SMOOTHED BRAKE ──────────────────────────────────────────────────────────────────────────────────

/**
 * PROVISIONAL thresholds, named so the data can move them in one place. HOLD when the window's p90 host busy exceeds
 * `holdBusyPct` or its p90 load1-per-core exceeds `holdLoadPerCore`; RELEASE only once BOTH are under the lower pair.
 * Between the pairs the brake keeps whatever state it was in (that is the hysteresis).
 */
export const PRESSURE_DEFAULTS = Object.freeze({
  windowMs: 10 * 60_000, holdBusyPct: 75, holdLoadPerCore: 1.5, releaseBusyPct: 60, releaseLoadPerCore: 1.0,
  minSamples: 5, staleAfterMs: 5 * 60_000,
});

/** Same numbers, used to decide what counts as a heavy-burst episode in the rollup. */
export const EPISODE_DEFAULTS = Object.freeze({ busyPct: PRESSURE_DEFAULTS.holdBusyPct, loadPerCore: PRESSURE_DEFAULTS.holdLoadPerCore, gapFactor: 3, activeLaneCpuPct: 1 });

/**
 * PURE. The smoothed pressure verdict at `now` from the samples inside the last `windowMs`.
 * NEVER a single reading: fewer than `minSamples` samples in the window, or a newest sample older than
 * `staleAfterMs`, is `admit` with an `insufficient-data` / `stale-data` reason (fail OPEN, the same choice the
 * heavy-admission semaphore makes on its own timeout), so a dead sampler can never wedge the queue in `hold`.
 * @param {{samples:Array<{atMs:number, busyPct?:number|null, load1?:number|null, cores?:number|null, busyEstimate?:number|null}>,
 *   windowMs?:number, now:number, hysteresis?:{previous?:'admit'|'hold', holdBusyPct?:number, holdLoadPerCore?:number,
 *   releaseBusyPct?:number, releaseLoadPerCore?:number, minSamples?:number, staleAfterMs?:number}}} o
 * @returns {{pressure:number|null, p90CpuBusy:number|null, p90Load1PerCore:number|null, decision:'admit'|'hold', reason:string,
 *   n:number, windowMs:number, busySource:string}}
 */
export function smoothedPressure({ samples, windowMs = PRESSURE_DEFAULTS.windowMs, now, hysteresis = {} }) {
  const h = { ...PRESSURE_DEFAULTS, ...hysteresis };
  const from = now - windowMs;
  const inWin = (Array.isArray(samples) ? samples : []).filter((s) => fin(s?.atMs) != null && s.atMs > from && s.atMs <= now);
  const busy = []; let estimated = 0;
  for (const s of inWin) {
    if (fin(s.busyPct) != null) busy.push(s.busyPct);
    else if (fin(s.busyEstimate) != null) { busy.push(s.busyEstimate); estimated += 1; }
  }
  const load = inWin.filter((s) => fin(s.load1) != null && fin(s.cores) > 0).map((s) => s.load1 / s.cores);
  const p90Busy = r2(percentile(sortedNums(busy), 0.9));
  const p90Load = r2(percentile(sortedNums(load), 0.9));
  const pressure = p90Busy == null && p90Load == null ? null : r2(Math.max((p90Busy ?? 0) / h.holdBusyPct, (p90Load ?? 0) / h.holdLoadPerCore));
  const busySource = !busy.length ? 'none' : estimated === 0 ? 'host-cpu' : estimated === busy.length ? 'ps-sum-estimate' : 'mixed';
  const out = (decision, reason) => ({ pressure, p90CpuBusy: p90Busy, p90Load1PerCore: p90Load, decision, reason, n: inWin.length, windowMs, busySource });
  if (inWin.length < h.minSamples) return out('admit', `insufficient-data: ${inWin.length} sample(s) in the window, need ${h.minSamples}`);
  const newest = Math.max(...inWin.map((s) => s.atMs));
  if (now - newest > h.staleAfterMs) return out('admit', `stale-data: newest sample is ${Math.round((now - newest) / 1000)} s old`);
  const busyHi = p90Busy != null && p90Busy > h.holdBusyPct;
  const loadHi = p90Load != null && p90Load > h.holdLoadPerCore;
  if (busyHi || loadHi) {
    return out('hold', `${busyHi ? `p90 host busy ${p90Busy}% > ${h.holdBusyPct}%` : ''}${busyHi && loadHi ? ' and ' : ''}${loadHi ? `p90 load1/core ${p90Load} > ${h.holdLoadPerCore}` : ''}`);
  }
  const busyLo = p90Busy == null || p90Busy < h.releaseBusyPct;
  const loadLo = p90Load == null || p90Load < h.releaseLoadPerCore;
  if (h.previous === 'hold' && !(busyLo && loadLo)) {
    return out('hold', `hysteresis: still held, p90 busy ${p90Busy}% (release < ${h.releaseBusyPct}%) and p90 load1/core ${p90Load} (release < ${h.releaseLoadPerCore})`);
  }
  return out('admit', h.previous === 'hold' ? `released: p90 busy ${p90Busy}% < ${h.releaseBusyPct}% and p90 load1/core ${p90Load} < ${h.releaseLoadPerCore}` : `under thresholds: p90 busy ${p90Busy}% <= ${h.holdBusyPct}%, p90 load1/core ${p90Load} <= ${h.holdLoadPerCore}`);
}

/**
 * PURE. Run the brake through every sample in time order, carrying the hysteresis state, and return the verdict at
 * `now` plus every admit/hold TRANSITION. This is the state a brake that had been running all along would be in.
 * @param {Parameters<typeof smoothedPressure>[0]} o
 */
export function replayPressure({ samples, windowMs = PRESSURE_DEFAULTS.windowMs, now, hysteresis = {} }) {
  const sorted = (Array.isArray(samples) ? samples : []).filter((s) => fin(s?.atMs) != null && s.atMs <= now).sort((a, b) => a.atMs - b.atMs);
  let previous = hysteresis.previous ?? 'admit';
  const transitions = [];
  for (const s of sorted) {
    const r = smoothedPressure({ samples: sorted, windowMs, now: s.atMs, hysteresis: { ...hysteresis, previous } });
    if (r.decision !== previous) transitions.push({ at: new Date(s.atMs).toISOString(), from: previous, to: r.decision, reason: r.reason });
    previous = r.decision;
  }
  const last = smoothedPressure({ samples: sorted, windowMs, now, hysteresis: { ...hysteresis, previous } });
  return { ...last, transitions, sampleCount: sorted.length };
}

/**
 * PURE. Sampler samples → the shape the brake reads. `busyEstimate` is the fallback for a schema-1 sample that has no
 * true host CPU: the SUM of per-process CPU over cores, capped at 100 (a documented, rougher figure, flagged by
 * `busySource` in the verdict).
 * @param {object[]} events telemetry events
 */
export function pressureSamples(events) {
  return groupSamples(events).filter((s) => s.atMs != null && s.mode !== 'calibration').map((s) => {
    const psSum = (s.famCpu ?? []).reduce((t, f) => t + (fin(f.cpuPct) ?? 0), 0);
    return {
      atMs: s.atMs, load1: s.load1, cores: s.cores, busyPct: s.cap?.busyPct ?? null,
      busyEstimate: s.cap?.busyPct == null && s.cores > 0 && s.famCpu?.length ? Math.min(100, r2(psSum / s.cores)) : null,
    };
  });
}

/** `10m` / `90s` / `2h` / bare seconds → ms, or null. */
export function parseDuration(text) {
  const m = /^(\d+(?:\.\d+)?)\s*(ms|s|m|h)?$/.exec(String(text ?? '').trim());
  if (!m) return null;
  return Math.round(Number(m[1]) * ({ ms: 1, s: 1000, m: 60_000, h: 3_600_000 }[m[2] ?? 's']));
}

/**
 * IO. The telemetry events needed to evaluate the brake at `nowMs`: today's day file and, when the window (plus the
 * hysteresis lead-in) reaches back before UTC midnight, yesterday's (raw or gzipped). Read-only.
 * @returns {{events:object[], files:string[]}}
 */
export function readPressureSamples({ dir, nowMs, leadMs = 0 }) {
  // utc-day-slice-ok: the telemetry day files are keyed by UTC day (telemetry-store#dayKey)
  const dayOf = (ms) => new Date(ms).toISOString().slice(0, 10);
  const days = [...new Set([dayOf(nowMs - leadMs), dayOf(nowMs)])];
  const events = []; const files = [];
  for (const day of days) {
    const raw = join(dir, `${day}.jsonl`); const gz = join(dir, `${day}.jsonl.gz`);
    let text = null;
    try { if (existsSync(raw)) text = readFileSync(raw, 'utf8'); else if (existsSync(gz)) text = gunzipSync(readFileSync(gz)).toString('utf8'); } catch { text = null; }
    if (text == null) continue;
    files.push(existsSync(raw) ? raw : gz);
    events.push(...parseTelemetryLines(text).events);
  }
  return { events, files };
}

/** PURE. The human rendering of one brake verdict. */
export function renderPressure(r, { nowMs = null } = {}) {
  const p = PRESSURE_DEFAULTS;
  const win = `${Math.round(r.windowMs / 60_000 * 10) / 10}m`;
  const lines = [
    `pressure ${r.pressure ?? 'n/a'}  ->  ${r.decision.toUpperCase()}   (window ${win}, ${r.n} samples, host-busy source: ${r.busySource})`,
    `  p90 host busy   ${r.p90CpuBusy ?? 'n/a'}%      hold > ${p.holdBusyPct}%   release < ${p.releaseBusyPct}%`,
    `  p90 load1/core  ${r.p90Load1PerCore ?? 'n/a'}      hold > ${p.holdLoadPerCore}   release < ${p.releaseLoadPerCore}`,
    `  reason: ${r.reason}`,
  ];
  if (r.transitions?.length) lines.push(`  transitions in the file: ${r.transitions.length} (last: ${r.transitions[r.transitions.length - 1].at} ${r.transitions[r.transitions.length - 1].from} -> ${r.transitions[r.transitions.length - 1].to})`);
  lines.push('  thresholds are PROVISIONAL: the collected data has to set them.');
  return lines.join('\n');
}

// ── THE CAPACITY ROLLUP ─────────────────────────────────────────────────────────────────────────────────

const isoHour = (ms) => `${new Date(ms).toISOString().slice(0, 13)}:00Z`; // utc-day-slice-ok: rollup hours are UTC, like the day files
const classTotals = (cap, key, names) => names.reduce((t, k) => t + (cap[key]?.[k] ?? 0), 0);

/** Per-hour, per-class p50/p90/p99/max of CPU% and RSS bytes, and host idle p50/p10/min. */
function hourly(capSamples) {
  const byHour = new Map();
  for (const s of capSamples) { const k = isoHour(s.atMs); if (!byHour.has(k)) byHour.set(k, []); byHour.get(k).push(s); }
  const out = {};
  for (const k of [...byHour.keys()].sort()) {
    const list = byHour.get(k);
    const names = new Set();
    for (const s of list) for (const c of Object.keys(s.cap.classCpu ?? {})) names.add(c);
    const families = {};
    for (const c of [...names].sort()) {
      const cpu = list.map((s) => s.cap.classCpu?.[c] ?? 0); const rss = list.map((s) => s.cap.classMem?.[c] ?? 0);
      if (!cpu.some((v) => v > 0) && !rss.some((v) => v > 0)) continue;
      families[c] = { cpu: dist(cpu), rssBytes: dist(rss), presentShare: r2(list.filter((s) => (s.cap.classN?.[c] ?? 0) > 0).length / list.length) };
    }
    out[k] = {
      samples: list.length, hostIdlePct: lowDist(list.map((s) => s.cap.idlePct)), hostBusyPct: dist(list.map((s) => s.cap.busyPct)),
      load1: dist(list.map((s) => s.load1)), families,
    };
  }
  return out;
}

/** Heavy-burst episodes: consecutive hot samples (true busy or load per core over the provisional thresholds). */
function episodes(samples, cfg = EPISODE_DEFAULTS) {
  const t = samples.map((s) => s.atMs).filter((x) => x != null);
  const gaps = []; for (let i = 1; i < t.length; i++) gaps.push(t[i] - t[i - 1]);
  gaps.sort((a, b) => a - b);
  const spacing = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 30_000;
  const gapMs = cfg.gapFactor * spacing;
  const hot = (s) => (fin(s.cap?.busyPct) != null && s.cap.busyPct > cfg.busyPct) || (s.cores > 0 && s.load1 / s.cores > cfg.loadPerCore);
  const groups = [];
  for (const s of samples) {
    if (s.atMs == null || !hot(s)) continue;
    const last = groups[groups.length - 1];
    if (last && s.atMs - last[last.length - 1].atMs <= gapMs) last.push(s); else groups.push([s]);
  }
  const events = samples.flatMap((s) => (s.cap?.events ?? []).filter((e) => !e.discovered).map((e) => ({ ...e, atMs: Date.parse(e.at) })));
  return groups.map((g) => {
    const startMs = g[0].atMs; const endMs = g[g.length - 1].atMs + spacing;
    const clsCpu = {}; const holderCpu = {};
    for (const s of g) {
      for (const [c, v] of Object.entries(s.cap?.classCpu ?? {})) clsCpu[c] = (clsCpu[c] || 0) + v;
      for (const h of s.cap?.holders ?? []) holderCpu[h.id] = (holderCpu[h.id] || 0) + h.cpuPct;
    }
    const rank = (o) => Object.entries(o).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const total = Object.values(clsCpu).reduce((a, b) => a + b, 0);
    const top = rank(clsCpu);
    const heavyTop = top.find(([c]) => HEAVY_CLASSES.includes(c));
    const holderTop = rank(holderCpu)[0];
    const live = g.map((s) => s.cap?.workers?.total).filter((v) => v != null);
    const peakByKind = {};
    for (const k of WORKER_KINDS) { const v = g.map((s) => s.cap?.workers?.byKind?.[k]?.n).filter((x) => x != null); if (v.length) peakByKind[k] = Math.max(...v); }
    const inside = events.filter((e) => e.atMs >= startMs && e.atMs <= endMs);
    return {
      start: new Date(startMs).toISOString(), durationS: Math.round((endMs - startMs) / 1000), samples: g.length,
      peakLoad1: r2(Math.max(...g.map((s) => s.load1))), peakBusyPct: g.some((s) => fin(s.cap?.busyPct) != null) ? r2(Math.max(...g.map((s) => s.cap?.busyPct ?? 0))) : null,
      responsibleClass: top[0]?.[0] ?? null, responsibleShare: total > 0 && top[0] ? r2(top[0][1] / total) : null,
      topClasses: top.slice(0, 3).map(([c, v]) => ({ class: c, share: total > 0 ? r2(v / total) : null })),
      responsibleHeavyClass: heavyTop?.[0] ?? null, responsibleHolder: holderTop?.[0] ?? null,
      workersLive: live.length ? { peak: Math.max(...live), mean: r2(live.reduce((a, b) => a + b, 0) / live.length), peakByKind } : null,
      workerStarts: inside.filter((e) => e.event === 'start').length, workerFinishes: inside.filter((e) => e.event === 'finish').length,
    };
  });
}

/** Marginal cost of one more live session of `kind`: OLS + the plain mean per worker, or "not enough data". */
function perWorker(capSamples, kind, { minN = 30 } = {}) {
  const rows = capSamples.filter((s) => s.cap.workers?.byKind?.[kind]);
  const xs = rows.map((s) => s.cap.workers.byKind[kind].n);
  const distinct = [...new Set(xs)].sort((a, b) => a - b);
  const withKind = rows.filter((s) => s.cap.workers.byKind[kind].n > 0);
  const sumX = withKind.reduce((t, s) => t + s.cap.workers.byKind[kind].n, 0);
  const one = (key) => {
    const ys = rows.map((s) => s.cap.workers.byKind[kind][key]);
    const fit = regress(xs, ys);
    const mean = sumX > 0 ? r2(withKind.reduce((t, s) => t + s.cap.workers.byKind[kind][key], 0) / sumX) : null;
    if (rows.length < minN || distinct.length < 2 || fit.slope == null) return { verdict: 'not enough data', n: rows.length, distinctCounts: distinct, meanPerWorker: mean };
    return { verdict: 'ok', perWorker: fit.slope, intercept: fit.intercept, r: fit.r, n: fit.n, distinctCounts: distinct, meanPerWorker: mean };
  };
  return { samples: rows.length, samplesWithKind: withKind.length, cpuPct: one('cpu'), rssBytes: one('mem'), heavyCpuPctMeanWhenPresent: withKind.length ? r2(withKind.reduce((t, s) => t + s.cap.workers.byKind[kind].heavyCpu, 0) / withKind.length) : null };
}

function histogram(values, edges) {
  const out = {}; const n = values.length || 1;
  for (const v of values) { let k = String(edges[0]); for (const e of edges) if (v >= e) k = e === edges[edges.length - 1] ? `${e}+` : String(e); out[k] = (out[k] || 0) + 1; }
  return Object.fromEntries(Object.entries(out).map(([k, c]) => [k, r2(c / n)]));
}

/** The four reservation inputs. */
function reservationInputs(capSamples, allSamples, cfg = EPISODE_DEFAULTS) {
  const quiet = capSamples.filter((s) => s.cap.classN && !NOT_QUIET_CLASSES.some((c) => (s.cap.classN[c] ?? 0) > 0) && (s.cap.classCpu?.container ?? 0) < CONTAINER_ACTIVE_CPU_PCT);
  const quietIdle = quiet.filter((s) => (s.cap.workers?.total ?? 1) === 0);
  const baseline = {
    quietSamples: quiet.length, totalSamples: capSamples.length,
    definition: `no heavy class (vitest, check-standards, verify-lane, playwright), no dev server, container class under ${CONTAINER_ACTIVE_CPU_PCT}% CPU`,
    systemPlusVscodeCpuPct: dist(quiet.map((s) => classTotals(s.cap, 'classCpu', SYSTEM_CLASSES))),
    systemPlusVscodeRssBytes: dist(quiet.map((s) => classTotals(s.cap, 'classMem', SYSTEM_CLASSES))),
    hostBusyPctWhenQuiet: dist(quiet.map((s) => s.cap.busyPct)),
    hostBusyPctQuietNoWorkers: quietIdle.length ? { ...dist(quietIdle.map((s) => s.cap.busyPct)) } : { n: 0 },
  };
  const workers = {};
  for (const k of WORKER_KINDS) workers[k] = perWorker(capSamples, k);
  const rootsRows = capSamples.filter((s) => s.cap.heavyRoots != null);
  const roots = rootsRows.map((s) => s.cap.heavyRoots);
  const heldMax = new Map();
  for (const s of capSamples) for (const h of s.cap.holders ?? []) if (h.id && !h.unslotted && h.heldForS != null) heldMax.set(h.id, Math.max(heldMax.get(h.id) ?? 0, h.heldForS));
  const cap = [...capSamples].reverse().find((s) => s.cap.admissionCap != null)?.cap.admissionCap ?? null;
  const perHeavyClass = {};
  for (const c of HEAVY_CLASSES) {
    const rows = capSamples.filter((s) => (s.cap.classN?.[c] ?? 0) > 0);
    if (rows.length) perHeavyClass[c] = { presentSamples: rows.length, cpuPctWhenPresent: dist(rows.map((s) => s.cap.classCpu?.[c])), rssBytesWhenPresent: dist(rows.map((s) => s.cap.classMem?.[c])) };
  }
  const heavyPool = {
    admissionCap: cap, samples: rootsRows.length, concurrentHeavyCommands: dist(roots), concurrencyShare: histogram(roots, [0, 1, 2, 3, 4]),
    shareAboveCap: cap != null && rootsRows.length ? r2(roots.filter((v) => v > cap).length / rootsRows.length) : null,
    heldSlots: histogram(rootsRows.map((s) => s.cap.held ?? 0), [0, 1, 2, 3]),
    unadmittedShare: rootsRows.length ? r2(rootsRows.filter((s) => (s.cap.unadmittedN ?? 0) > 0).length / rootsRows.length) : null,
    unadmittedCpuPctWhenPresent: dist(rootsRows.filter((s) => (s.cap.unadmittedN ?? 0) > 0).map((s) => s.cap.unadmittedCpu)),
    holdSecondsPerHolder: dist([...heldMax.values()]), holders: heldMax.size, perHeavyClass,
  };
  const leased = allSamples.map((s) => s.leased).filter((v) => v != null);
  const active = []; const perLaneCpu = []; const perLaneRss = []; const perActiveCpu = []; const perActiveRss = [];
  for (const s of capSamples) {
    if (!s.cap.laneCpu) continue;
    let n = 0;
    for (const [lane, cpu] of Object.entries(s.cap.laneCpu)) {
      const rss = s.cap.laneMem?.[lane] ?? 0;
      perLaneCpu.push(cpu); perLaneRss.push(rss);
      if (cpu >= cfg.activeLaneCpuPct) { n += 1; perActiveCpu.push(cpu); perActiveRss.push(rss); }
    }
    active.push(n);
  }
  const lanes = {
    leased: { ...dist(leased), share: histogram(leased, [0, 1, 2, 3, 4, 6, 8]) },
    activeLanesPerSample: { ...dist(active), definition: `lanes with >= ${cfg.activeLaneCpuPct}% CPU attributed` },
    perLaneCpuPct: dist(perLaneCpu), perLaneRssBytes: dist(perLaneRss),
    perActiveLaneCpuPct: dist(perActiveCpu), perActiveLaneRssBytes: dist(perActiveRss),
    note: 'each sample records its 12 busiest lanes; a lane below the cut is not in these figures',
  };
  return { baseline, perWorker: workers, heavyPool, lanes };
}

// ── THE LANE LOAD MODEL (operator addition 2026-09-21) ──────────────────────────────────────────────────

/**
 * PROVISIONAL sufficiency rules for the lane-load model. A table cell below `minN` is "not enough data"; below `thinN`
 * it is "thin"; fewer than `minDays` days is preliminary whatever the count. The data has to set these.
 */
export const LANE_LOAD = Object.freeze({ minN: 5, thinN: 30, minDays: 3, activeLaneCpuPct: 1, heavyLaneCpuPct: 1 });

const BINS = Object.freeze(['1', '2', '3', '4+']);
/** Concurrency bin of a run: the time-weighted MEAN number of heavy runs in flight (itself included), rounded, floor 1. */
export const concurrencyBin = (mean) => { const k = Math.max(1, Math.round(Number.isFinite(mean) ? mean : 1)); return k >= 4 ? '4+' : String(k); };

/** `{n, days, verdict, line}`: the one-line data-sufficiency verdict every table carries so nobody trusts an empty cell. */
export function sufficiency(n, days, unit = 'samples') {
  const verdict = n < LANE_LOAD.minN ? 'not enough data' : n < LANE_LOAD.thinN ? 'thin' : 'ok';
  const prelim = days < LANE_LOAD.minDays;
  return { n, days, verdict, line: `n=${n} ${unit} over ${days} day${days === 1 ? '' : 's'}: ${verdict}${prelim ? ` (fewer than ${LANE_LOAD.minDays} days: preliminary)` : ''}` };
}

const median = (list) => percentile(sortedNums(list), 0.5);

/** Per-bin wall time and slowdown of one family's runs versus its solo (bin `1`) baseline. */
function wallByConcurrency(runs) {
  const by = Object.fromEntries(BINS.map((b) => [b, runs.filter((e) => concurrencyBin(e.conc_mean) === b)]));
  const solo = by['1'];
  const soloWall = solo.length >= LANE_LOAD.minN ? median(solo.map((e) => e.wall_s)) : null;
  const perWork = (e) => (e.cpu_s > 0 ? e.wall_s / e.cpu_s : null);
  const soloWork = solo.length >= LANE_LOAD.minN ? median(solo.map(perWork)) : null;
  const out = {};
  for (const b of BINS) {
    const list = by[b];
    const enough = list.length >= LANE_LOAD.minN;
    const w = enough ? median(list.map((e) => e.wall_s)) : null;
    const pw = enough ? median(list.map(perWork)) : null;
    out[b] = {
      n: list.length, wallS: enough ? { p50: r2(w), p90: r2(percentile(sortedNums(list.map((e) => e.wall_s)), 0.9)) } : 'not enough data',
      slowdown: enough && soloWall ? r2(w / soloWall) : (b === '1' ? (enough ? 1 : 'not enough data') : 'not enough data'),
      // wall per CPU-second removes the run-to-run size difference (a bigger test subset), leaving contention
      slowdownPerWork: enough && soloWork && pw ? r2(pw / soloWork) : (b === '1' ? (enough ? 1 : 'not enough data') : 'not enough data'),
    };
  }
  return out;
}

/**
 * PURE. The lane load model from heavy-run episodes and per-sample lane figures: what one heavy run of each family
 * costs, how its wall time stretches with concurrency, what each lane does to the host during its heavy phases, and
 * how active lanes and concurrent heavy runs co-occur. Every table carries a data-sufficiency verdict.
 * @param {{samples:object[], days?:number}} o `samples` are {@link groupSamples} outputs
 */
export function buildLaneLoadModel({ samples, days = 1 }) {
  const all = (Array.isArray(samples) ? samples : []).filter((s) => s.cap && s.atMs != null);
  const episodes = all.flatMap((s) => (s.cap.episodes ?? []).map((e) => ({ ...e, atMs: s.atMs })));
  const real = episodes.filter((e) => e.calibration !== true);
  const cal = episodes.filter((e) => e.calibration === true);
  const families = [...new Set(real.map((e) => e.family))].sort();
  const perFamily = {}; const concurrency = {};
  for (const f of families) {
    const runs = real.filter((e) => e.family === f);
    // CPU figures need a run seen at least TWICE (a single sighting has no %cpu integral and only the survivors' cumulative time)
    const seenTwice = runs.filter((e) => (e.samples ?? 2) >= 2 || e.calibration === true);
    perFamily[f] = {
      runs: runs.length, cpuRunsUsed: seenTwice.length, cpuSecondsPerRun: dist(seenTwice.map((e) => e.cpu_s)), avgCoresUsed: dist(seenTwice.map((e) => e.avg_cores)),
      peakCoresUsed: dist(seenTwice.map((e) => (Number.isFinite(e.peak_cpu_pct) ? e.peak_cpu_pct / 100 : null))), peakRssBytes: dist(runs.map((e) => e.peak_rss_bytes)),
      wallS: dist(runs.map((e) => e.wall_s)), admittedShare: r2(runs.filter((e) => e.admitted).length / runs.length),
      admissionWaitS: dist(runs.map((e) => e.admission_wait_s)), startedBeforeFirstSeen: runs.filter((e) => e.started_before_first_seen).length,
      sufficiency: sufficiency(runs.length, days, 'runs'),
    };
    concurrency[f] = { bins: wallByConcurrency(runs), binBy: 'time-weighted mean heavy runs in flight (self included), rounded', sufficiency: sufficiency(runs.length, days, 'runs') };
  }
  // per lane
  const t = all.map((s) => s.atMs); const gaps = []; for (let i = 1; i < t.length; i++) gaps.push(t[i] - t[i - 1]);
  gaps.sort((a, b) => a - b);
  const spacing = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 30_000;
  const spanH = t.length > 1 ? (t[t.length - 1] - t[0] + spacing) / 3_600_000 : 0;
  const laneNames = new Set([...real.map((e) => e.lane), ...all.flatMap((s) => Object.keys(s.cap.laneCpu ?? {}))].filter((l) => l && l !== 'unattributed'));
  const perLane = {};
  for (const lane of [...laneNames].sort()) {
    const act = all.filter((s) => (s.cap.laneCpu?.[lane] ?? 0) >= LANE_LOAD.activeLaneCpuPct);
    const heavy = act.filter((s) => (s.cap.laneHeavyCpu?.[lane] ?? 0) >= LANE_LOAD.heavyLaneCpuPct);
    const light = act.filter((s) => !((s.cap.laneHeavyCpu?.[lane] ?? 0) >= LANE_LOAD.heavyLaneCpuPct));
    const runs = real.filter((e) => e.lane === lane);
    const activeH = (act.length * spacing) / 3_600_000;
    const hp = median(heavy.map((s) => s.cap.laneCpu[lane])); const lp = median(light.map((s) => s.cap.laneCpu[lane]));
    perLane[lane] = {
      heavyRuns: runs.length, activeHours: r2(activeH), heavyRunsPerActiveHour: activeH > 0 ? r2(runs.length / activeH) : null, heavyRunsPerObservedHour: spanH > 0 ? r2(runs.length / spanH) : null,
      heavyDutyCycle: act.length ? r2(heavy.length / act.length) : null,
      marginalHostCpuPct: { heavyPhaseP50: r2(hp), lightPhaseP50: r2(lp), heavyMinusLight: hp != null && lp != null ? r2(hp - lp) : null, heavySamples: heavy.length, lightSamples: light.length },
      sufficiency: sufficiency(act.length, days, 'active-lane samples'),
    };
  }
  // joint: active lanes (leased with a live process) x concurrent heavy runs
  const lb = (v) => (v >= 4 ? '4+' : String(v)); const hb = (v) => (v >= 3 ? '3+' : String(v));
  const joint = all.filter((s) => s.leased != null && s.cap.heavyRoots != null);
  const cells = {};
  for (const s of joint) { const a = lb(s.leased); const b = hb(s.cap.heavyRoots); cells[a] ||= {}; cells[a][b] = (cells[a][b] || 0) + 1; }
  const grid = {};
  for (const a of Object.keys(cells).sort()) for (const b of Object.keys(cells[a]).sort()) { grid[a] ||= {}; grid[a][b] = { n: cells[a][b], timeShare: r2(cells[a][b] / joint.length) }; }
  // calibration runs, kept apart from real ones
  const calibration = {};
  for (const f of [...new Set(cal.map((e) => e.family))].sort()) calibration[f] = { bins: wallByConcurrency(cal.filter((e) => e.family === f)), runs: cal.filter((e) => e.family === f).length };
  const suff = { perFamily: sufficiency(real.length, days, 'runs'), wallByConcurrency: sufficiency(real.length, days, 'runs'), perLane: sufficiency(all.filter((s) => Object.keys(s.cap.laneCpu ?? {}).length).length, days, 'samples with lane data'), activeLanesByHeavyRuns: sufficiency(joint.length, days, 'samples') };
  return { days, spanHours: r2(spanH), heavyRuns: { real: real.length, calibration: cal.length }, perFamily, wallByConcurrency: concurrency, perLane, activeLanesByHeavyRuns: { rows: 'active lanes (leased, live process)', columns: 'concurrent heavy runs', cells: grid, sufficiency: suff.activeLanesByHeavyRuns }, calibration, sufficiency: suff, thresholds: LANE_LOAD };
}

/** The UTC days present as `YYYY-MM-DD.jsonl[.gz]` in `dir` within the last `days` days (today included), oldest first. */
function dayFiles(dir, nowMs, days) {
  let names = [];
  try { names = readdirSync(dir); } catch { return []; }
  // utc-day-slice-ok: the telemetry day files are keyed by UTC day
  const earliest = new Date(nowMs - (days - 1) * 86_400_000).toISOString().slice(0, 10);
  return [...new Set(names.map((n) => /^(\d{4}-\d{2}-\d{2})\.jsonl(\.gz)?$/.exec(n)?.[1]).filter((d) => d && d >= earliest))].sort();
}

/**
 * IO. Read the last `days` day files (raw or gzipped) and build the lane load model over ALL of them: the analysis to
 * run once a few days of schema-2 data exist. Read-only.
 * @returns {{model:object, days:string[]}}
 */
export function readLaneLoadModel({ dir, nowMs, days = 7 }) {
  const list = dayFiles(dir, nowMs, days);
  const events = [];
  for (const day of list) {
    const raw = join(dir, `${day}.jsonl`); const gz = join(dir, `${day}.jsonl.gz`);
    try { events.push(...parseTelemetryLines(existsSync(raw) ? readFileSync(raw, 'utf8') : gunzipSync(readFileSync(gz)).toString('utf8')).events); } catch { /* an unreadable day is skipped, not fatal */ }
  }
  const samples = groupSamples(events);
  const withCap = new Set(samples.filter((s) => s.cap && s.atMs != null).map((s) => new Date(s.atMs).toISOString().slice(0, 10))); // utc-day-slice-ok: day-file key
  return { model: buildLaneLoadModel({ samples, days: Math.max(1, withCap.size) }), days: list };
}

/** PURE. A compact text rendering of the lane load model for the terminal. */
export function renderLaneLoad(m) {
  const L = [`lane load model: ${m.heavyRuns.real} heavy runs (+${m.heavyRuns.calibration} calibration) over ${m.days} day(s), ${m.spanHours} h observed`];
  const q = (d) => (d && d.p50 != null ? `${d.p50}/${d.p90}` : 'n/a');
  for (const [f, v] of Object.entries(m.perFamily)) {
    L.push(`  ${f}: ${v.runs} runs; cpu-s p50/p90 ${q(v.cpuSecondsPerRun)}; avg cores ${q(v.avgCoresUsed)}; peak cores ${q(v.peakCoresUsed)}; wall s ${q(v.wallS)}; peak RSS MB ${v.peakRssBytes.p50 != null ? `${Math.round(v.peakRssBytes.p50 / 1048576)}/${Math.round(v.peakRssBytes.p90 / 1048576)}` : 'n/a'}   [${v.sufficiency.line}]`);
    const bins = m.wallByConcurrency[f].bins;
    L.push(`      by concurrency: ${Object.entries(bins).map(([b, x]) => `${b}: n=${x.n} ${typeof x.wallS === 'string' ? 'not enough data' : `wall ${x.wallS.p50}s x${typeof x.slowdown === 'number' ? x.slowdown : '?'}`}`).join(' | ')}`);
  }
  for (const [l, v] of Object.entries(m.perLane)) L.push(`  lane ${l}: ${v.heavyRuns} runs, ${v.heavyRunsPerActiveHour ?? 'n/a'}/active h, heavy duty ${v.heavyDutyCycle ?? 'n/a'}, host CPU% heavy ${v.marginalHostCpuPct.heavyPhaseP50 ?? 'n/a'} vs light ${v.marginalHostCpuPct.lightPhaseP50 ?? 'n/a'}   [${v.sufficiency.line}]`);
  L.push(`  active lanes x heavy runs: ${Object.entries(m.activeLanesByHeavyRuns.cells).map(([a, row]) => `${a} lanes: ${Object.entries(row).map(([b, c]) => `${b}h ${Math.round(c.timeShare * 100)}%`).join(' ')}`).join(' | ') || 'no data'}   [${m.activeLanesByHeavyRuns.sufficiency.line}]`);
  return L.join('\n');
}

/**
 * PURE + DETERMINISTIC. The schema-2 sections of the daily rollup. `samples` are `groupSamples` outputs.
 * @param {object[]} samples
 * @returns {object} `{present:false}` when no sample carries schema-2 facts
 */
export function buildCapacityRollup(samples) {
  const all = Array.isArray(samples) ? samples : [];
  const capSamples = all.filter((s) => s.cap && s.atMs != null && s.mode !== 'calibration');
  if (!capSamples.length) return { present: false, note: 'no schema-2 samples in this day' };
  const selfRows = capSamples.filter((s) => s.cap.self);
  const span = capSamples.length > 1 ? capSamples[capSamples.length - 1].atMs - capSamples[0].atMs : 0;
  const cpuSum = selfRows.reduce((t, s) => t + (s.cap.self.cpuMsUpperBound ?? 0), 0);
  return {
    present: true, schema: 2, samples: capSamples.length,
    quality: { partial: capSamples.filter((s) => s.cap.quality === 'partial').length, total: capSamples.length },
    selfOverhead: {
      durationMs: dist(selfRows.map((s) => s.cap.self.durationMs)), cpuMsUpperBound: dist(selfRows.map((s) => s.cap.self.cpuMsUpperBound)),
      coreShare: span > 0 && selfRows.length ? r2(cpuSum / (span + (span / (capSamples.length - 1)))) : null,
      heartbeatGapMaxS: selfRows.length ? Math.max(...selfRows.map((s) => s.cap.self.heartbeatGapS ?? 0)) : null,
      heartbeatMissedTotal: selfRows.length ? Math.max(...selfRows.map((s) => s.cap.self.heartbeatMissedTotal ?? 0)) : 0,
    },
    hourly: hourly(capSamples),
    burstEpisodes: episodes(all),
    'reservation-inputs': { ...reservationInputs(capSamples, all), 'lane-load-model': buildLaneLoadModel({ samples: all, days: 1 }) },
    hardware: [...capSamples].reverse().find((x) => x.cap.hardware)?.cap.hardware ?? null,
    thresholds: { episode: EPISODE_DEFAULTS, pressure: PRESSURE_DEFAULTS, status: 'PROVISIONAL' },
  };
}
