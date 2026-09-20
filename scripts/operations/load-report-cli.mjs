#!/usr/bin/env node
/**
 * @file scripts/operations/load-report-cli.mjs
 * @description Print the load report (`load-analysis.mjs`) over the telemetry files.
 *   load-report-cli.mjs [--since=<iso>] [--json] [--dir=<telemetry dir>] [--otel-dir=<claude-otel dir> | --no-otel]
 *   load-report-cli.mjs --review [--since=<iso>] [--dir=<dir>]            write telemetry/reviews/<date>.md
 *   load-report-cli.mjs --record-limit-change --limit=<name> --old=<n> --new=<n> --reason=<text> --who=<name>
 * The report and `--review` are READ-ONLY over telemetry (a review is a new file under `reviews/`, never overwriting).
 * `--record-limit-change` appends ONE `config.limit.changed` event; it changes no limit itself.
 * Both day files (`<day>.jsonl`) and rolled-over ones (`<day>.jsonl.gz`) are read. Corrupt lines are skipped.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

import { analyzeLoad, renderReport } from './load-analysis.mjs';
import { buildReview, latestReview, recordLimitChange, writeReview } from './load-review.mjs';
import { parseTelemetryLines } from './telemetry.mjs';
import { createFileTelemetryStore, telemetryDir } from './telemetry-store.mjs';

/** Read every day file (raw or gzipped) that could hold events at/after `sinceMs` (day files are UTC-keyed). */
export function readEvents(dir, sinceMs = null) {
  if (!existsSync(dir)) return [];
  // utc-day-slice-ok: selects UTC-keyed day files (telemetry-store#dayKey), not an operator-facing date
  const sinceDay = sinceMs == null ? null : new Date(sinceMs).toISOString().slice(0, 10);
  const events = [];
  const files = readdirSync(dir).filter((n) => /^\d{4}-\d{2}-\d{2}\.jsonl(\.gz)?$/.test(n)).sort();
  const seen = new Set();
  for (const name of files) {
    const day = name.slice(0, 10);
    if (sinceDay && day < sinceDay) continue;
    if (seen.has(day)) continue; // raw and gz of one day (mid-rollover): raw is complete, read it once
    seen.add(day);
    const path = join(dir, files.includes(`${day}.jsonl`) ? `${day}.jsonl` : name);
    const buf = readFileSync(path);
    events.push(...parseTelemetryLines((path.endsWith('.gz') ? gunzipSync(buf) : buf).toString('utf8')).events);
  }
  return events;
}

/** The claude-otel collector's default store (inside the primary checkout; see `claude-otel-collector.mjs`). */
export function defaultOtelDir(env = process.env) {
  return env.CLAUDE_OTEL_DIR || join(env.HOME || homedir(), 'workspace', 'webeverything', '.operations', 'claude-otel');
}

/**
 * Read OTEL usage records, KEEPING ONLY what the join needs (`session.id`, `model`, `type`, name, value, time).
 * The raw records carry user email and account ids; those never leave this function.
 */
export function readOtel(dir, sinceMs = null) {
  if (!dir || !existsSync(dir)) return null;
  // utc-day-slice-ok: selects UTC-keyed day files (telemetry-store#dayKey), not an operator-facing date
  const sinceDay = sinceMs == null ? null : new Date(sinceMs).toISOString().slice(0, 10);
  const out = [];
  for (const name of readdirSync(dir).filter((n) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(n)).sort()) {
    if (sinceDay && name.slice(0, 10) < sinceDay) continue;
    for (const line of readFileSync(join(dir, name), 'utf8').split('\n')) {
      if (!line.trim()) continue;
      let r; try { r = JSON.parse(line); } catch { continue; }
      const a = r?.attributes ?? {};
      if (!a['session.id'] || typeof r.name !== 'string') continue;
      out.push({ name: r.name, value: r.value, receivedAt: r.receivedAt, attributes: { 'session.id': a['session.id'], model: a.model, type: a.type } });
    }
  }
  return out;
}

export function main(argv = process.argv.slice(2), env = process.env) {
  const val = (n) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : null; };
  const dir = val('dir') ?? telemetryDir();

  if (argv.includes('--record-limit-change')) {
    try {
      const r = recordLimitChange({ limit: val('limit'), old: val('old') == null ? null : Number(val('old')), new: val('new'), reason: val('reason'), who: val('who') }, { store: createFileTelemetryStore({ dir }) });
      process.stdout.write(r.ok ? `recorded config.limit.changed: ${JSON.stringify(r.record.attributes)}\n` : 'FAILED to append the event\n');
      return r.ok ? 0 : 1;
    } catch (e) { process.stderr.write(`load-report: ${e.message}\n`); return 2; }
  }

  const sinceRaw = val('since');
  const sinceMs = sinceRaw ? Date.parse(sinceRaw) : null;
  if (sinceRaw && !Number.isFinite(sinceMs)) { process.stderr.write(`load-report: --since must be an ISO instant, got ${sinceRaw}\n`); return 2; }
  const otel = argv.includes('--no-otel') ? null : readOtel(val('otel-dir') ?? defaultOtelDir(env), sinceMs);
  const report = analyzeLoad(readEvents(dir, sinceMs), { sinceMs, otel });

  if (argv.includes('--review')) {
    const reviewsDir = join(dir, 'reviews');
    const generatedAt = new Date().toISOString();
    const prev = latestReview(reviewsDir);
    const review = buildReview(report, { generatedAt, previousData: prev?.data ?? null });
    const file = writeReview({ dir: reviewsDir, markdown: review.markdown, generatedAt });
    process.stdout.write(`${review.markdown}\nwrote ${file}\n`);
    return 0;
  }
  process.stdout.write(`${argv.includes('--json') ? JSON.stringify(report, null, 2) : renderReport(report)}\n`);
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exitCode = main();
