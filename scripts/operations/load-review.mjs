/**
 * @file scripts/operations/load-review.mjs
 * @description THE CORRECT-COURSE LOOP (epic #3383, operator amendment 2026-09-20). A persisted, comparable review of
 * how the host is coping, so limits are corrected from data on a schedule rather than by feel:
 *   • {@link buildReview} — p90 load, saturation share, probe p90, per-family attribution of the worst windows, the
 *     limit suggestion from {@link suggestLimits}, and the CHANGE against the previous review.
 *   • {@link writeReview} — `telemetry/reviews/<date>.md`, never overwritten (a same-day rerun gets `-2`, `-3`…).
 *   • {@link limitChangedMetric} / {@link recordLimitChange} — the `config.limit.changed` event ANY limit change
 *     must emit (limit, old, new, reason, who), so before/after windows can be compared later.
 *   • {@link resourceReviewOwed} — pure gate for `land-advance` / `wip-report` to consume in a later slice.
 * Nothing here changes a limit; it only recommends.
 *
 * THE RECOMMENDATION METHOD ({@link suggestLimits}). Heavy-command admission (vitest + playwright processes) is the
 * DRIVER, because heavy processes carry the CPU and lane/session counts did not predict load. A bucket is HEALTHY when
 * it has >= {@link MIN_BUCKET_SAMPLES} samples, load1 p90 <= cores, and probe p90 within its bound. The suggested cap
 * is the upper edge of the highest healthy bucket reached without a gap from the bottom. It is marked NOT CONFIDENT
 * until the coverage rule holds (>= 48 h of sampler data including at least one busy window).
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { BUCKET_EDGES } from './load-analysis.mjs';
import { newMetric, serializeTelemetryEvent } from './telemetry.mjs';
import { dayKey } from './telemetry-store.mjs';

export const REVIEW_INTERVAL_DAYS = 7;
export const MIN_BUCKET_SAMPLES = 30;
export const PROBE_BOUNDS = Object.freeze({ spawnMs: 250, spinMs: 25 });

/** PURE. True when no review exists, or the last one is `days` or more old. @param {string|number|Date|null} lastReviewAt */
export function resourceReviewOwed(lastReviewAt, now, days = REVIEW_INTERVAL_DAYS) {
  const last = lastReviewAt == null ? NaN : (lastReviewAt instanceof Date ? lastReviewAt.getTime() : (typeof lastReviewAt === 'number' ? lastReviewAt : Date.parse(lastReviewAt)));
  const at = now instanceof Date ? now.getTime() : (typeof now === 'number' ? now : Date.parse(now));
  if (!Number.isFinite(last) || !Number.isFinite(at)) return true;
  return at - last >= days * 86_400_000;
}

/** Upper edge (inclusive) of bucket `i` of `edges`, or null for the open-ended last bucket. */
const upperEdge = (edges, i) => (i + 1 < edges.length ? edges[i + 1] - 1 : null);

/**
 * PURE. Suggest a limit per dimension from a load report. See the module header for the method.
 * @param {ReturnType<import('./load-analysis.mjs').analyzeLoad>} report
 */
export function suggestLimits(report) {
  const cores = report.cores;
  const out = {};
  for (const [dim, key] of [['heavy', 'heavyAdmissionCap'], ['sessions', 'concurrentSessions'], ['leased', 'concurrentLanes']]) {
    const edges = BUCKET_EDGES[dim];
    const byLabel = new Map(report.buckets[dim].map((b) => [b.bucket, b]));
    const labels = edges.map((lo, i) => (upperEdge(edges, i) === null ? `${lo}+` : (upperEdge(edges, i) === lo ? `${lo}` : `${lo}-${upperEdge(edges, i)}`)));
    let suggested = null; let basis = 'no data'; let stoppedAt = null;
    for (let i = 0; i < labels.length; i++) {
      const b = byLabel.get(labels[i]);
      if (!b) { if (suggested == null) basis = `no samples in bucket ${labels[i]}`; break; }
      const healthy = b.n >= MIN_BUCKET_SAMPLES && cores != null && b.load1.p90 != null && b.load1.p90 <= cores
        && (b.probe.spawnP90 == null || b.probe.spawnP90 <= PROBE_BOUNDS.spawnMs) && (b.probe.spinP90 == null || b.probe.spinP90 <= PROBE_BOUNDS.spinMs);
      if (!healthy) { stoppedAt = { bucket: labels[i], n: b.n, load1P90: b.load1.p90, spawnP90: b.probe.spawnP90, spinP90: b.probe.spinP90 }; basis = b.n < MIN_BUCKET_SAMPLES ? `bucket ${labels[i]} has only ${b.n} samples (< ${MIN_BUCKET_SAMPLES})` : `bucket ${labels[i]} is over target (load1 p90 ${b.load1.p90} vs ${cores} cores, probes ${b.probe.spawnP90 ?? '-'}/${b.probe.spinP90 ?? '-'} ms)`; break; }
      const up = upperEdge(edges, i);
      suggested = up ?? (report.maxObserved?.[dim] ?? edges[i]);
      basis = up == null ? `every bucket up to the observed top (${labels[i]}) is healthy: no saturation evidence yet` : `buckets up to ${labels[i]} are healthy`;
    }
    out[key] = { suggested, basis, stoppedAt, driver: dim === 'heavy' };
  }
  return {
    target: { load1P90AtMostCores: cores, spawnP90AtMostMs: PROBE_BOUNDS.spawnMs, spinP90AtMostMs: PROBE_BOUNDS.spinMs, minBucketSamples: MIN_BUCKET_SAMPLES },
    confident: !!report.coverage?.sufficient,
    ...out,
  };
}

const num = (v) => (Number.isFinite(v) ? v : null);

/** PURE. The machine-readable core of a review (embedded in the markdown for the next diff). */
export function reviewData(report, { generatedAt }) {
  return {
    generatedAt,
    window: report.window, cores: report.cores,
    load1: report.overall.load1, saturation: { overCores: report.overall.shareOverCores, over1_5x: report.overall.shareOver1_5x, n: report.overall.n },
    probe: { spawnP90: report.overall.probe.spawnP90, spinP90: report.overall.probe.spinP90 },
    worst: report.worst.map((w) => ({ at: w.at, load1: w.load1, topFamilies: w.topFamilies, topProcesses: w.topProcesses })),
    suggestion: suggestLimits(report),
    coverage: report.coverage,
  };
}

/** PURE. Deltas of the headline numbers against a previous review's data (null = no previous). */
export function diffReviews(cur, prev) {
  if (!prev) return null;
  const d = (a, b) => (num(a) == null || num(b) == null ? null : Math.round((a - b) * 1000) / 1000);
  const sug = (r) => JSON.stringify([r?.suggestion?.heavyAdmissionCap?.suggested ?? null, r?.suggestion?.concurrentSessions?.suggested ?? null, r?.suggestion?.concurrentLanes?.suggested ?? null]);
  return {
    previousAt: prev.generatedAt,
    load1P90: d(cur.load1.p90, prev.load1?.p90), load1Max: d(cur.load1.max, prev.load1?.max),
    saturationOverCores: d(cur.saturation.overCores, prev.saturation?.overCores),
    saturationOver1_5x: d(cur.saturation.over1_5x, prev.saturation?.over1_5x),
    probeSpawnP90: d(cur.probe?.spawnP90, prev.probe?.spawnP90), probeSpinP90: d(cur.probe?.spinP90, prev.probe?.spinP90),
    samples: d(cur.window?.samples, prev.window?.samples),
    suggestionChanged: sug(cur) !== sug(prev),
    previousSuggestion: { heavyAdmissionCap: prev.suggestion?.heavyAdmissionCap?.suggested ?? null, concurrentSessions: prev.suggestion?.concurrentSessions?.suggested ?? null, concurrentLanes: prev.suggestion?.concurrentLanes?.suggested ?? null },
  };
}

const fmt = (v) => (v == null ? '-' : String(v));
const signed = (v) => (v == null ? '-' : `${v > 0 ? '+' : ''}${v}`);

/** PURE. Render the review as markdown with an embedded `review-data` block. */
export function renderReview(data, diff) {
  const s = data.suggestion;
  const lines = [
    `# Resource review ${data.generatedAt.slice(0, 10)}`, '',
    `Window ${fmt(data.window.from)} → ${fmt(data.window.to)}: ${data.window.samples} samples (${data.window.sampler} sampler, ${data.window.runner} runner), ${fmt(data.cores)} cores.`,
    `Coverage: ${data.coverage.samplerSamples} sampler samples over ${data.coverage.samplerSpanHours} h, ${data.coverage.busySamplerSamples} above cores — ${data.coverage.sufficient ? 'enough to act on' : `NOT yet enough (need >= ${data.coverage.minHours} h including a busy window); treat the suggestion as provisional`}.`, '',
    '## Headline', '',
    `- load1 p90 **${fmt(data.load1.p90)}** (median ${fmt(data.load1.median)}, max ${fmt(data.load1.max)}) against ${fmt(data.cores)} cores`,
    `- saturation: load1 > cores in **${fmt(data.saturation.overCores == null ? null : Math.round(data.saturation.overCores * 100))}%** of samples, > 1.5x cores in ${fmt(data.saturation.over1_5x == null ? null : Math.round(data.saturation.over1_5x * 100))}%`,
    `- probe p90: spawn ${fmt(data.probe?.spawnP90)} ms (bound ${PROBE_BOUNDS.spawnMs}), spin overshoot ${fmt(data.probe?.spinP90)} ms (bound ${PROBE_BOUNDS.spinMs})`, '',
    '## Worst windows and what was running', '',
  ];
  for (const w of data.worst) {
    lines.push(`- ${w.at} load1 ${w.load1}: ${w.topFamilies.map((f) => `${f.name} ${Math.round(f.cpuPct)}%`).join(', ') || 'no family data'}${w.topProcesses?.length ? ` — ${w.topProcesses.map((p) => `${Math.round(p.cpuPct)}% ${p.family ?? ''} ${p.lane ?? ''} ${p.session ?? ''}`.trim()).join('; ')}` : ''}`);
  }
  lines.push('', '## Limit suggestion (method: `load-review.mjs#suggestLimits`)', '', `Target: load1 p90 <= ${fmt(s.target.load1P90AtMostCores)} cores, spawn p90 <= ${s.target.spawnP90AtMostMs} ms, spin p90 <= ${s.target.spinP90AtMostMs} ms, >= ${s.target.minBucketSamples} samples per bucket. ${s.confident ? 'Confident.' : '**Not confident (insufficient data).**'}`, '');
  for (const [k, label] of [['heavyAdmissionCap', 'heavy-command admission cap (driver)'], ['concurrentSessions', 'concurrent live sessions'], ['concurrentLanes', 'concurrent leased lanes']]) {
    lines.push(`- ${label}: **${fmt(s[k].suggested)}** — ${s[k].basis}`);
  }
  lines.push('', '## Change since the previous review', '');
  if (!diff) lines.push('First review — nothing to compare against.');
  else lines.push(`Previous review ${diff.previousAt}:`, `- load1 p90 ${signed(diff.load1P90)}, max ${signed(diff.load1Max)}`, `- saturation > cores ${signed(diff.saturationOverCores)}, > 1.5x ${signed(diff.saturationOver1_5x)}`, `- probe p90 spawn ${signed(diff.probeSpawnP90)} ms, spin ${signed(diff.probeSpinP90)} ms`, `- samples ${signed(diff.samples)}`, `- suggestion ${diff.suggestionChanged ? `CHANGED (was ${JSON.stringify(diff.previousSuggestion)})` : 'unchanged'}`);
  lines.push('', '<!-- review-data', JSON.stringify(data), '-->', '');
  return lines.join('\n');
}

/** PURE. Pull the embedded data block back out of a review file. */
export function parseReviewData(markdown) {
  const m = /<!-- review-data\n([\s\S]*?)\n-->/.exec(String(markdown ?? ''));
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

/** IO. The newest review's data in `dir`, or null. */
export function latestReview(dir) {
  if (!existsSync(dir)) return null;
  // ordered by (day, sequence): `<day>.md` is sequence 1, `<day>-2.md` is 2 — a plain string sort would put `-2` first
  const key = (n) => { const m = /^(\d{4}-\d{2}-\d{2})(?:-(\d+))?\.md$/.exec(n); return m ? `${m[1]}#${String(m[2] ?? 1).padStart(6, '0')}` : null; };
  const names = readdirSync(dir).filter((n) => key(n)).sort((a, b) => key(a).localeCompare(key(b)));
  for (let i = names.length - 1; i >= 0; i--) {
    const data = parseReviewData(readFileSync(join(dir, names[i]), 'utf8'));
    if (data) return { file: join(dir, names[i]), data };
  }
  return null;
}

/** IO. Write a review, never overwriting an existing one. Returns its path. */
export function writeReview({ dir, markdown, generatedAt }) {
  mkdirSync(dir, { recursive: true });
  const day = generatedAt.slice(0, 10);
  let file = join(dir, `${day}.md`);
  for (let n = 2; existsSync(file); n++) file = join(dir, `${day}-${n}.md`);
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, markdown);
  renameSync(tmp, file);
  return file;
}

/**
 * PURE. The `config.limit.changed` record. `reason` and `who` are required: an unexplained limit change is exactly
 * what this event exists to prevent.
 * @param {{limit:string, old:*, new:*, reason:string, who:string}} c
 */
export function limitChangedMetric(c, { now = Date.now() } = {}) {
  for (const k of ['limit', 'reason', 'who']) if (typeof c?.[k] !== 'string' || c[k].trim() === '') throw new TypeError(`config.limit.changed needs a non-empty "${k}"`);
  const n = Number(c.new);
  if (!Number.isFinite(n)) throw new TypeError('config.limit.changed needs a numeric "new" value');
  return newMetric({
    name: 'config.limit.changed', kind: 'runner', value: n, unit: 'count', timestamp: new Date(now).toISOString(),
    attributes: { limit: c.limit, old: c.old ?? null, new: n, reason: c.reason, who: c.who },
  });
}

/** IO. Append one `config.limit.changed` event to today's day file through the shared store. */
export function recordLimitChange(change, { store, now = Date.now() }) {
  const rec = limitChangedMetric(change, { now });
  const line = serializeTelemetryEvent(rec);
  const r = line ? store.append(line, dayKey(rec.timestamp)) : { ok: false };
  return { ok: !!r.ok, record: rec };
}

/** PURE. Build a review from a report. @param {string} generatedAt ISO @param {object|null} previousData */
export function buildReview(report, { generatedAt, previousData = null }) {
  const data = reviewData(report, { generatedAt });
  const diff = diffReviews(data, previousData);
  return { data, diff, markdown: renderReview(data, diff) };
}
