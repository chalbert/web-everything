#!/usr/bin/env node
/**
 * @file scripts/operations/telemetry-cli.mjs
 * @description THE READ SHELL over the delivery-telemetry log (#3383) — the operator's and the future
 * scoring pass's way in. Mirrors `completion-cli.mjs`/`delivery-report-cli.mjs`'s shape: a thin argv parser
 * over a store handle and the PURE rollup in `telemetry.mjs`. It re-derives nothing — every number it prints
 * comes from {@link goldenSignals}, so the CLI, the future rolling-24h capacity artifact (`we:backlog/3569-*`)
 * and the future run-scoring pass are three shells over ONE implementation and can never disagree.
 *
 * VERBS
 *   report [--since=<h>] [--json]   the four golden signals over a rolling window (default 24h)
 *   trace  --trace=<id> [--json]    one delivery lifecycle, span by span, in time order
 *   traces [--since=<h>] [--json]   every trace in the window, one line each — the index
 *   days                            which day files exist on disk
 *
 * WHY A ROLLING-HOUR WINDOW RATHER THAN A DAY. A day boundary is an artifact of the storage layout, not of
 * anything an operator cares about; "how has the last 24 hours gone" is the actual question, and it spans two
 * day files roughly half the time. The window is applied AFTER reading (by timestamp), so it is exact rather
 * than rounded to whichever files were opened.
 */

import { pathToFileURL } from 'node:url';

import { createFileTelemetryStore, dayKey } from './telemetry-store.mjs';
import { goldenSignals, groupByTrace } from './telemetry.mjs';
import { writeAllSync, writeLineSync } from '../lib/write-all-sync.mjs';

/** The day keys a rolling window of `hours` can possibly touch — at most two for any window under 24h, and
 *  never more than the window's span in days plus one. Reading only these keeps the rolling query O(window)
 *  rather than O(history), which is the whole point of day rotation. */
export function daysInWindow(hours, now = new Date()) {
  const out = [];
  const spanDays = Math.floor(Number(hours) / 24) + 1;
  for (let i = spanDays; i >= 0; i -= 1) {
    out.push(dayKey(new Date(now.getTime() - i * 86400000)));
  }
  return [...new Set(out)];
}

/** The instant an event happened, for windowing. `span.end` is filed by when it ENDED (that is when it became
 *  a fact), everything else by its own single timestamp. `null` for an unparseable stamp, which windows out. */
export function eventTime(e) {
  const raw = e && (e.event === 'metric' ? e.timestamp : (e.endedAt || e.startedAt));
  const t = Date.parse(String(raw ?? ''));
  return Number.isNaN(t) ? null : t;
}

/** Keep only the events inside `[now - hours, now]`. PURE. */
export function withinWindow(events, hours, now = new Date()) {
  const floor = now.getTime() - Number(hours) * 3600000;
  return (Array.isArray(events) ? events : []).filter((e) => {
    const t = eventTime(e);
    return t !== null && t >= floor && t <= now.getTime();
  });
}

/** Human duration — `1.2s` / `4m 13s` / `1h 02m`. Kept here rather than in the pure core: it is a rendering
 *  concern, and the JSON output deliberately carries raw milliseconds so a consumer never has to parse this. */
export function fmtMs(ms) {
  if (!Number.isFinite(ms)) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60000);
  const s = Math.round((ms % 60000) / 1000);
  if (m < 60) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}

const pct = (r) => `${(Number(r) * 100).toFixed(1)}%`;

/** Render the golden signals as text. PURE (returns a string), so a test asserts the rendering without stdout. */
export function renderReport(signals, { hours }) {
  const L = [];
  L.push(`delivery telemetry — rolling ${hours}h`);
  L.push('');

  L.push('TRAFFIC');
  const t = signals.traffic;
  L.push(`  ${t.dispatches} dispatch(es) across ${t.traces} trace(s), ${t.spans} span(s)`);
  for (const [kind, n] of Object.entries(t.dispatchesByKind).sort(([, a], [, b]) => b - a)) {
    L.push(`    ${kind.padEnd(18)} ${n}`);
  }
  if (t.dispatches === 0) L.push('    (no dispatches recorded in this window)');
  L.push('');

  L.push('LATENCY — where the time went');
  const rows = Object.entries(signals.latency.bySpan).sort(([, a], [, b]) => b.totalMs - a.totalMs);
  if (!rows.length) L.push('    (nothing recorded)');
  for (const [name, s] of rows) {
    L.push(`    ${name.padEnd(18)} n=${String(s.count).padStart(3)}  total ${fmtMs(s.totalMs).padStart(8)}  p50 ${fmtMs(s.p50Ms).padStart(8)}  p90 ${fmtMs(s.p90Ms).padStart(8)}  max ${fmtMs(s.maxMs).padStart(8)}`);
  }
  const e2e = Object.entries(signals.latency.endToEndByKind);
  if (e2e.length) {
    L.push('    — end to end —');
    for (const [kind, s] of e2e) {
      L.push(`    ${kind.padEnd(18)} n=${String(s.count).padStart(3)}  p50 ${fmtMs(s.p50Ms).padStart(8)}  p90 ${fmtMs(s.p90Ms).padStart(8)}  max ${fmtMs(s.maxMs).padStart(8)}`);
    }
  }
  L.push('');

  L.push('ERRORS — rate per phase, with the classified reason');
  L.push(`    overall ${signals.errors.overall.errors}/${signals.errors.overall.total} spans (${pct(signals.errors.overall.rate)})`);
  for (const [name, b] of Object.entries(signals.errors.bySpan).sort(([, a], [, c]) => c.errors - a.errors)) {
    if (!b.errors) continue;
    const why = Object.entries(b.reasons).sort(([, a], [, c]) => c - a).map(([r, n]) => `${r}×${n}`).join(', ');
    L.push(`    ${name.padEnd(18)} ${b.errors}/${b.total} (${pct(b.rate)})  ${why}`);
  }
  L.push('');

  L.push('SATURATION — was the system capacity-bound?');
  const a = signals.saturation.admission;
  L.push(`    admission  ${a.admitted} admitted · ${a.denied} denied (${pct(a.denyRate)} refused)`);
  for (const [reason, n] of Object.entries(a.reasons).sort(([, x], [, y]) => y - x)) {
    if (reason === 'none') continue;
    L.push(`      ↳ ${reason}: ${n}`);
  }
  for (const [name, g] of Object.entries(signals.saturation.gauges)) {
    if (name === 'dispatch.admitted' || name === 'dispatch.denied') continue;
    L.push(`    ${name.padEnd(26)} last ${g.last}  max ${g.max}  mean ${Number(g.mean).toFixed(1)}  (n=${g.samples})`);
  }
  L.push('');

  const retried = Object.entries(signals.retries).filter(([, r]) => r.retried > 0);
  if (retried.length) {
    L.push('RETRIES');
    for (const [name, r] of retried) L.push(`    ${name.padEnd(18)} ${r.retried}/${r.spans} span(s) beyond attempt 1, deepest attempt ${r.maxAttempt}`);
    L.push('');
  }

  if (signals.abandoned.length) {
    L.push(`ABANDONED — ${signals.abandoned.length} span(s) opened and never closed (process died mid-phase)`);
    for (const s of signals.abandoned.slice(0, 10)) {
      L.push(`    ${s.name.padEnd(18)} ${s.kind.padEnd(16)} trace ${s.traceId}  opened ${s.startedAt}`);
    }
  }
  return L.join('\n');
}

/** Render ONE trace as an ordered span list — the "what happened to item #NNNN" view. PURE. */
export function renderTrace(traceId, events) {
  const spans = events.filter((e) => e.event === 'span.end' && e.traceId === traceId)
    .sort((x, y) => Date.parse(x.startedAt) - Date.parse(y.startedAt));
  if (!spans.length) return `no spans recorded for trace ${traceId}`;
  const L = [`trace ${traceId} — ${spans.length} span(s)`];
  const mark = { ok: '✓', error: '✗', unset: '·' };
  for (const s of spans) {
    const depth = s.parentSpanId ? '  ' : '';
    const attempt = s.attempt > 1 ? ` [attempt ${s.attempt}]` : '';
    const why = s.statusMessage ? `  — ${s.statusMessage}` : '';
    const outcome = s.attributes && s.attributes.outcome ? ` (${s.attributes.outcome})` : '';
    L.push(`  ${depth}${mark[s.status] || '?'} ${s.name.padEnd(16)} ${fmtMs(s.durationMs).padStart(9)}  ${s.kind}${outcome}${attempt}${why}`);
  }
  return L.join('\n');
}

/** Render the trace index — one line per trace. PURE. */
export function renderTraces(events) {
  const grouped = groupByTrace(events);
  const rows = Object.values(grouped).map((t) => {
    const root = t.spans.find((s) => s.name === 'dispatch');
    const errs = t.spans.filter((s) => s.status === 'error').length;
    return {
      traceId: t.traceId,
      kinds: t.kinds.filter((k) => k !== 'runner').join(',') || t.kinds.join(','),
      spans: t.spans.length,
      errors: errs,
      durationMs: root ? root.durationMs : null,
      outcome: root && root.attributes ? (root.attributes.outcome || null) : null,
      startedAt: root ? root.startedAt : (t.spans[0] && t.spans[0].startedAt) || null,
    };
  }).sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)));
  if (!rows.length) return { rows, text: '(no traces in window)' };
  const text = [`${rows.length} trace(s)`, ...rows.map((r) =>
    `  ${String(r.traceId).padEnd(12)} ${String(r.kinds).padEnd(18)} ${String(r.spans).padStart(3)} span  ${String(r.errors).padStart(2)} err  ${fmtMs(r.durationMs).padStart(9)}  ${r.outcome || '—'}`,
  )].join('\n');
  return { rows, text };
}

// ── CLI ──────────────────────────────────────────────────────────────────────────────────────────────

const USAGE = `usage: telemetry-cli.mjs <report|trace|traces|days> [--since=<hours>] [--trace=<id>] [--json]`;

/**
 * The argv driver, exported so a test drives it with an injected store and clock instead of a subprocess.
 * @param {string[]} argv
 * @param {{store?: object, now?: () => Date, out?: (s: string) => void}} [io]
 * @returns {number} process exit code
 */
export function runTelemetryCli(argv, { store = null, now = () => new Date(), out = (s) => writeAllSync(1, s) } = {}) {
  const verb = argv.find((a) => !a.startsWith('--')) || 'report';
  const flag = (n) => {
    const hit = argv.find((a) => a.startsWith(`--${n}=`));
    return hit ? hit.slice(n.length + 3) : undefined;
  };
  const json = argv.includes('--json');
  const hours = Number(flag('since') ?? 24) || 24;
  const backing = store || createFileTelemetryStore();

  if (verb === 'days') {
    const days = backing.days();
    out(json ? `${JSON.stringify({ days }, null, 2)}\n` : `${days.join('\n') || '(no telemetry on disk)'}\n`);
    return 0;
  }

  if (verb === 'trace') {
    const id = flag('trace');
    if (!id) { writeLineSync(2, 'error: trace requires --trace=<id>'); return 1; }
    // A single trace may predate the rolling window, so this verb reads EVERY day rather than windowing —
    // "show me what happened to item #3441" must not silently return nothing because it finished yesterday.
    const { events } = backing.readAll();
    if (json) {
      const spans = events.filter((e) => e.traceId === id).sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt));
      out(`${JSON.stringify({ traceId: id, events: spans }, null, 2)}\n`);
    } else out(`${renderTrace(id, events)}\n`);
    return 0;
  }

  const { events: all, corrupt } = backing.readAll(daysInWindow(hours, now()));
  const events = withinWindow(all, hours, now());

  if (verb === 'traces') {
    const r = renderTraces(events);
    out(json ? `${JSON.stringify({ hours, traces: r.rows }, null, 2)}\n` : `${r.text}\n`);
    return 0;
  }

  if (verb !== 'report') { writeLineSync(2, USAGE); return 1; }

  const signals = { ...goldenSignals(events), corrupt };
  out(json ? `${JSON.stringify({ hours, ...signals }, null, 2)}\n` : `${renderReport(signals, { hours })}\n`);
  return 0;
}

const IS_CLI = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (IS_CLI) {
  try {
    process.exitCode = runTelemetryCli(process.argv.slice(2));
  } catch (e) {
    writeLineSync(2, `error: ${String((e && e.message) || e)}`);
    process.exitCode = 1;
  }
}
