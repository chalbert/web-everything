#!/usr/bin/env node
/**
 * @file scripts/operations/claude-otel-collector.mjs
 * @description Epic #3383 usage-ledger follow-up — a minimal, DEPENDENCY-FREE local receiver for Claude
 * Code's OWN OpenTelemetry metrics export. This is the PRIMARY source for Claude-side self-tracked usage,
 * superseding the earlier plan (recorded in this same epic) to reconstruct Claude usage by parsing a
 * dispatched build/fix agent's own `--output-format json` stdout: that path only ever covered agents THIS
 * repo's own wrappers spawn, never the interactive orchestrating session itself — and the operator's own
 * requirement is "every session that consumes tokens against the window allowance, orchestrator included."
 * Claude Code's built-in OTEL export is the only signal that is genuinely PER-PROCESS-AGNOSTIC: every `claude`
 * invocation on this machine (interactive or dispatched) emits it identically once the right env vars are set
 * (see `~/.claude/settings.json`'s `env` block, wired alongside this file — itself outside this repo, so not
 * shown here).
 *
 * WHAT CLAUDE CODE ACTUALLY SENDS (confirmed against the CURRENT `code.claude.com/docs/en/monitoring-usage`
 * docs this session fetched directly — not assumed from training data):
 *   - `CLAUDE_CODE_ENABLE_TELEMETRY=1` + `OTEL_METRICS_EXPORTER=otlp` + `OTEL_EXPORTER_OTLP_PROTOCOL=http/json`
 *     + `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:<port>` make every `claude` process POST an OTLP
 *     `ExportMetricsServiceRequest` JSON body to `<endpoint>/v1/metrics` on a timer (default every 60s, or at
 *     process exit) — plain JSON over HTTP, no protobuf, no gRPC, exactly what a dependency-free `node:http`
 *     server can parse with `JSON.parse` alone.
 *   - Metrics of interest: `claude_code.token.usage` (attributes: `type` in {input,output,cacheRead,
 *     cacheCreation}, `model`, plus session/user identity) and `claude_code.cost.usage` (USD, same
 *     attributes minus `type`). Both are exported at DELTA temporality by default
 *     (`OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE` default `delta`, confirmed from the docs) — each
 *     received data point is the increment SINCE THE LAST EXPORT, not a running total, so this collector never
 *     needs to diff consecutive samples against a remembered baseline: every data point it appends is already
 *     the correct amount to sum into a window total. (Had the default been `cumulative`, summing raw samples
 *     would wildly over-count; this file relies on the documented default and does not try to detect or handle
 *     the `cumulative` case — the operator did not configure that override.)
 *   - `Content-Length` is always sent for `http/json` (docs, verbatim), so a plain `req.on('data'/'end')`
 *     buffering read is sufficient; no chunked-transfer edge case to special-case.
 *
 * WHY A HAND-ROLLED RECEIVER, NOT A REAL OTEL COLLECTOR BINARY. This repo is native-first (#75) and already
 * avoids pulling in a dependency for a job `node:http` alone covers — installing/managing a separate
 * `otelcol`/`otelcol-contrib` process would be a new external binary this repo has no other use for, for a
 * JSON body simple enough that `JSON.parse` is the whole "protocol decoder." So this listens for exactly the
 * shape Claude Code sends and nothing more — it is a purpose-built receiver, not a general OTLP collector.
 *
 * PURE / IMPURE SPLIT (mirrors `we:scripts/usage-report/usage-report.mjs`'s own convention):
 * `parseOtlpAttributes`/`parseOtlpMetricsExport`/`otelSampleToRecord` are PURE — fixture JSON in, plain
 * objects out, no fs/network/clock. The file store (`createFileOtelStore`/`createMemoryOtelStore`) and the
 * `node:http` server (`startOtelCollectorServer`) are the only impure parts, isolated below the pure section.
 */
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// ── PURE CORE ────────────────────────────────────────────────────────────────────────────────────────────

/** Only these metric names are kept — every `claude_code.*` counter Claude Code emits, so a future ledger can
 *  read more than tokens/cost without this receiver needing a matching edit; anything NOT namespaced
 *  `claude_code.` is dropped (this receiver exists for exactly one exporter). */
const KEPT_METRIC_PREFIX = 'claude_code.';

/**
 * OTLP's common `attributes` array — `[{key, value: {stringValue|intValue|boolValue|doubleValue}}]` — into a
 * plain object. Unknown/empty entries are skipped rather than throwing; a value shape this does not recognise
 * (arrayValue/kvlistValue, which Claude Code's own attributes never use) is stringified defensively rather
 * than dropped, so a future attribute this file has not seen yet is still visible, just not typed.
 * @param {Array<object>} attrs
 * @returns {Record<string, *>}
 */
export function parseOtlpAttributes(attrs) {
  const out = {};
  for (const a of Array.isArray(attrs) ? attrs : []) {
    const key = a && a.key;
    if (typeof key !== 'string' || !key) continue;
    const v = a.value || {};
    if ('stringValue' in v) out[key] = v.stringValue;
    else if ('intValue' in v) out[key] = Number(v.intValue); // OTLP/JSON encodes int64 as a STRING
    else if ('doubleValue' in v) out[key] = v.doubleValue;
    else if ('boolValue' in v) out[key] = v.boolValue;
    else if (v && typeof v === 'object') { try { out[key] = JSON.stringify(v); } catch { /* skip */ } }
  }
  return out;
}

/** One numeric data point's value — `asInt` (a STRING per OTLP/JSON's int64-as-string rule) or `asDouble` (a
 *  plain JSON number). Never throws; unparseable yields `null` so a caller can skip the point. */
function dataPointValue(dp) {
  if (dp && 'asInt' in dp) { const n = Number(dp.asInt); return Number.isFinite(n) ? n : null; }
  if (dp && 'asDouble' in dp) { const n = Number(dp.asDouble); return Number.isFinite(n) ? n : null; }
  return null;
}

/**
 * PURE. Flatten one OTLP `ExportMetricsServiceRequest` JSON body into a plain array of samples, one per data
 * point, resource attributes merged in alongside the point's own attributes (a resource attribute — e.g.
 * `session.id`, `user.email` — describes WHICH process emitted the point, and the ledger wants both without a
 * join). Only `sum` and `gauge` metric shapes are read (Claude Code's own metrics are counters/gauges, never
 * histograms); an unrecognised shape is skipped, never thrown on. Filters to {@link KEPT_METRIC_PREFIX}.
 * @param {object} body
 * @returns {Array<{name: string, unit: string, value: number, timeUnixNano: (string|null), attributes: object}>}
 */
export function parseOtlpMetricsExport(body) {
  const out = [];
  const resourceMetrics = Array.isArray(body?.resourceMetrics) ? body.resourceMetrics : [];
  for (const rm of resourceMetrics) {
    const resourceAttrs = parseOtlpAttributes(rm?.resource?.attributes);
    const scopeMetrics = Array.isArray(rm?.scopeMetrics) ? rm.scopeMetrics : [];
    for (const sm of scopeMetrics) {
      const metrics = Array.isArray(sm?.metrics) ? sm.metrics : [];
      for (const m of metrics) {
        const name = typeof m?.name === 'string' ? m.name : '';
        if (!name.startsWith(KEPT_METRIC_PREFIX)) continue;
        const unit = typeof m?.unit === 'string' ? m.unit : '';
        const dataPoints = m?.sum?.dataPoints || m?.gauge?.dataPoints;
        if (!Array.isArray(dataPoints)) continue;
        for (const dp of dataPoints) {
          const value = dataPointValue(dp);
          if (value === null) continue;
          out.push({
            name,
            unit,
            value,
            timeUnixNano: typeof dp?.timeUnixNano === 'string' ? dp.timeUnixNano : null,
            attributes: { ...resourceAttrs, ...parseOtlpAttributes(dp?.attributes) },
          });
        }
      }
    }
  }
  return out;
}

/**
 * PURE. Turn one parsed sample into the record this file's store appends (adds `receivedAt`, the ONLY field
 * not derivable from the OTLP body itself — the ledger reads windows by wall-clock arrival time, since
 * `timeUnixNano` is the metric SDK's own clock and not guaranteed to agree with this process's clock, while
 * `receivedAt` is what actually decides which day-file / renewal window a sample lands in).
 * @param {object} sample - one entry from {@link parseOtlpMetricsExport}.
 * @param {string} receivedAt - ISO instant.
 * @returns {object}
 */
export function otelSampleToRecord(sample, receivedAt) {
  return {
    v: 1,
    receivedAt,
    name: sample.name,
    unit: sample.unit,
    value: sample.value,
    attributes: sample.attributes || {},
  };
}

// ── API REQUEST EVENTS (OTLP logs, allowlisted) ─────────────────────────────────────────────────────────
// #3383 capacity audit 2026-09-23: metrics alone never say how long an API request took or whether it was refused
// (429 rate limit, 529 overload), so an API-bound hour looked like a hardware limit. Claude Code sends those facts
// only as LOG events, and log events can carry content (a prompt, a tool's input), so nothing from `/v1/logs` is
// kept except the two API event kinds below, each projected through a closed field allowlist at ingest. A new
// attribute Claude Code starts sending is dropped until it is added here on purpose.

/** The log event kinds kept (the `claude_code.` prefix stripped). */
export const KEPT_API_EVENTS = Object.freeze(['api_request', 'api_error']);

/** The only attributes an API event record may carry. Numbers stay numbers; nothing else passes. */
export const API_EVENT_FIELDS = Object.freeze([
  'event.timestamp', 'session.id', 'model', 'query_source', 'effort', 'status_code', 'attempt', 'duration_ms',
  'input_tokens', 'output_tokens', 'cache_read_tokens', 'cache_creation_tokens', 'cost_usd', 'error_type',
]);

/** An API error message is reduced to its leading error type (`rate_limit_error`, `overloaded_error`, ...), never kept whole. */
export function errorTypeOf(message) {
  const m = /\b([a-z]+(?:_[a-z]+)*_error)\b/.exec(String(message ?? ''));
  return m ? m[1] : (message ? 'other' : null);
}

/**
 * PURE. Flatten an OTLP `ExportLogsServiceRequest` JSON body into allowlisted API event records. Everything that is
 * not an {@link KEPT_API_EVENTS} event is dropped; every kept event keeps only {@link API_EVENT_FIELDS}.
 * @param {object} body
 * @param {string} receivedAt ISO instant
 * @returns {Array<{v:1, receivedAt:string, name:string, attributes:object}>}
 */
export function parseOtlpApiEvents(body, receivedAt) {
  const out = [];
  for (const rl of Array.isArray(body?.resourceLogs) ? body.resourceLogs : []) {
    const resourceAttrs = parseOtlpAttributes(rl?.resource?.attributes);
    for (const sl of Array.isArray(rl?.scopeLogs) ? rl.scopeLogs : []) {
      for (const rec of Array.isArray(sl?.logRecords) ? sl.logRecords : []) {
        const attrs = { ...resourceAttrs, ...parseOtlpAttributes(rec?.attributes) };
        const rawName = String(attrs['event.name'] ?? rec?.body?.stringValue ?? '');
        const kind = rawName.replace(/^claude_code\./, '');
        if (!KEPT_API_EVENTS.includes(kind)) continue;
        const picked = {};
        for (const k of API_EVENT_FIELDS) {
          if (k === 'error_type') continue;
          const v = attrs[k];
          if (v === undefined || v === null || v === '') continue;
          const n = Number(v);
          picked[k] = k === 'session.id' || k === 'model' || k === 'query_source' || k === 'effort' || k === 'event.timestamp' ? String(v).slice(0, 80) : (Number.isFinite(n) ? n : null);
        }
        if (kind === 'api_error') picked.error_type = errorTypeOf(attrs.error);
        out.push({ v: 1, receivedAt, name: `claude_code.${kind}`, attributes: picked });
      }
    }
  }
  return out;
}

const pct = (xs, p) => { const s = xs.filter(Number.isFinite).sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : null; };

/**
 * PURE. Per-hour rollup of API event records: requests, p50/p90 request duration, and errors by type (with the
 * 429 and 529 counts named, since those are the "the API was the limit" signals).
 * @param {object[]} records {@link parseOtlpApiEvents} output
 * @returns {Array<{hour:string, requests:number, durationP50Ms:number|null, durationP90Ms:number|null, errors:number, rateLimited:number, overloaded:number, errorTypes:Record<string,number>}>}
 */
export function summarizeApiEvents(records) {
  const byHour = new Map();
  for (const r of Array.isArray(records) ? records : []) {
    const at = r?.attributes?.['event.timestamp'] ?? r?.receivedAt;
    const t = Date.parse(at);
    if (!Number.isFinite(t)) continue;
    // utc-day-slice-ok: an hour bucket key over machine timestamps
    const hour = new Date(t).toISOString().slice(0, 13);
    const h = byHour.get(hour) ?? { hour, durations: [], requests: 0, errors: 0, rateLimited: 0, overloaded: 0, errorTypes: {} };
    if (r.name === 'claude_code.api_request') { h.requests += 1; h.durations.push(r.attributes.duration_ms); }
    if (r.name === 'claude_code.api_error') {
      h.errors += 1;
      const ty = r.attributes.error_type ?? 'other';
      h.errorTypes[ty] = (h.errorTypes[ty] || 0) + 1;
      if (r.attributes.status_code === 429) h.rateLimited += 1;
      if (r.attributes.status_code === 529) h.overloaded += 1;
    }
    byHour.set(hour, h);
  }
  return [...byHour.values()].sort((a, b) => a.hour.localeCompare(b.hour)).map(({ durations, ...h }) => ({ ...h, durationP50Ms: pct(durations, 0.5), durationP90Ms: pct(durations, 0.9) }));
}

// ── IO SHELL ─────────────────────────────────────────────────────────────────────────────────────────────

const HERE = dirname(fileURLToPath(import.meta.url));
/** Resolved by SCRIPT LOCATION, never CWD. NOTE: `telemetry-store.mjs#TELEMETRY_ROOT` no longer follows this
 *  exact convention (#3383 follow-on) — it now resolves to a shared, workspace-anchored root so every lane
 *  clone agrees on one storage location, since a per-clone root there meant a rolling-window rollup silently
 *  only ever saw whichever clone produced it. This file's own per-clone `CLAUDE_OTEL_ROOT` has the identical
 *  latent fragmentation and was NOT in scope for that fix; worth applying the same treatment if/when this
 *  collector's cross-clone rollup story matters the same way. */
export const CLAUDE_OTEL_ROOT = resolve(HERE, '..', '..');

/** `<root>/.operations/claude-otel` — day-rotated NDJSON, overridable via `OPERATION_CLAUDE_OTEL_DIR`
 *  (mirrors `telemetry-store.mjs#telemetryDir`'s own override convention). */
export function claudeOtelDir(root = CLAUDE_OTEL_ROOT) {
  const override = process.env.OPERATION_CLAUDE_OTEL_DIR;
  if (override && String(override).trim() !== '') return resolve(String(override));
  return join(root, '.operations', 'claude-otel');
}

/** `<claude-otel dir>/api` — the allowlisted API request/error events, kept apart from the metric day files so a
 *  reader that sums every record of a day file never mixes the two. */
export function claudeOtelApiDir(root = CLAUDE_OTEL_ROOT) {
  return join(claudeOtelDir(root), 'api');
}

/** The day key (`YYYY-MM-DD`) a record at `iso` belongs to — UTC, same "storage partition key, not an
 *  operator-facing date" reasoning as `telemetry-store.mjs#dayKey`. */
export function claudeOtelDayKey(iso) {
  const d = new Date(String(iso));
  // utc-day-slice-ok: a machine log's storage partition key (mirrors telemetry-store.mjs#dayKey's own
  // reasoning), not an operator-facing calendar date — must be zone-independent so the day-file this record
  // lands in agrees with the ledger's own UTC-anchored window arithmetic.
  return (Number.isNaN(d.getTime()) ? new Date() : d).toISOString().slice(0, 10);
}

/** The file-backed store: append one record, read back by day. Mirrors `telemetry-store.mjs`'s own
 *  `createFileTelemetryStore` shape (append-only NDJSON, one file per UTC day, tolerant read). */
export function createFileOtelStore({ dir = claudeOtelDir() } = {}) {
  return {
    dir,
    append(record) {
      try {
        mkdirSync(dir, { recursive: true });
        const day = claudeOtelDayKey(record.receivedAt);
        appendFileSync(join(dir, `${day}.jsonl`), `${JSON.stringify(record)}\n`);
        return { ok: true };
      } catch (e) {
        return { ok: false, error: String((e && e.message) || e) };
      }
    },
    days() {
      try {
        if (!existsSync(dir)) return [];
        return readdirSync(dir).filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f)).map((f) => f.slice(0, 10)).sort();
      } catch {
        return [];
      }
    },
    readDay(day) {
      try {
        const p = join(dir, `${day}.jsonl`);
        if (!existsSync(p)) return [];
        const out = [];
        for (const line of readFileSync(p, 'utf8').split('\n')) {
          const t = line.trim();
          if (!t) continue;
          try { out.push(JSON.parse(t)); } catch { /* tolerant read — a torn last line is skipped, not fatal */ }
        }
        return out;
      } catch {
        return [];
      }
    },
    readAll(dayList) {
      const wanted = Array.isArray(dayList) ? dayList : this.days();
      const out = [];
      for (const d of wanted) out.push(...this.readDay(d));
      return out;
    },
  };
}

/** The memory twin — same records-in/records-out contract, no disk. Test-only. */
export function createMemoryOtelStore() {
  const byDay = new Map();
  return {
    dir: '<memory>',
    append(record) {
      const day = claudeOtelDayKey(record.receivedAt);
      const arr = byDay.get(day) || [];
      arr.push(record);
      byDay.set(day, arr);
      return { ok: true };
    },
    days() { return [...byDay.keys()].sort(); },
    readDay(day) { return byDay.get(day) || []; },
    readAll(dayList) {
      const wanted = Array.isArray(dayList) ? dayList : this.days();
      const out = [];
      for (const d of wanted) out.push(...this.readDay(d));
      return out;
    },
  };
}

/** Read the full request body as text, bounded so a misbehaving/malicious client cannot exhaust memory. Never
 *  throws on a client abort — resolves to `''`, and the caller's own `try/JSON.parse` handles that as an empty
 *  body would (a 400, not a crash). */
function readBody(req, { maxBytes = 8 * 1024 * 1024 } = {}) {
  return new Promise((resolvePromise) => {
    let size = 0;
    const chunks = [];
    let done = false;
    const finish = (text) => { if (!done) { done = true; resolvePromise(text); } };
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) { finish(''); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => finish(Buffer.concat(chunks).toString('utf8')));
    req.on('error', () => finish(''));
  });
}

/**
 * Start the collector's `node:http` server. `POST /v1/metrics` parses an OTLP/HTTP-JSON metrics export and
 * appends every `claude_code.*` sample to `store`. `POST /v1/logs` keeps ONLY the allowlisted API request and
 * error events ({@link parseOtlpApiEvents}) in `apiStore`: log events can carry prompt or tool content, so every
 * other event and every non-allowlisted attribute is dropped at ingest (#3383 capacity audit 2026-09-23). Every
 * other path/method gets a harmless 200/404 so Claude Code's own exporter never sees this receiver as a reason to
 * retry or log an error. NEVER throws out of a request handler: a malformed body is
 * answered 200 (an OTLP exporter has no retry-on-4xx contract this file wants to trigger) and the parse
 * failure is swallowed — a self-tracking receiver must never be the thing that makes a real Claude Code
 * session slower or noisier.
 * @param {{port?: number, store?: object, apiStore?: object, now?: () => Date, log?: (msg: string) => void}} [o]
 * @returns {Promise<{server: import('node:http').Server, port: number, close: () => Promise<void>}>}
 */
export function startOtelCollectorServer({
  port = 4318, store = createFileOtelStore(), apiStore = createFileOtelStore({ dir: claudeOtelApiDir() }), now = () => new Date(), log = (m) => process.stdout.write(`${m}\n`),
} = {}) {
  const server = createServer((req, res) => {
    if (req.method === 'POST' && req.url && req.url.startsWith('/v1/metrics')) {
      readBody(req).then((text) => {
        let count = 0;
        try {
          const body = JSON.parse(text || '{}');
          const receivedAt = now().toISOString();
          for (const sample of parseOtlpMetricsExport(body)) {
            store.append(otelSampleToRecord(sample, receivedAt));
            count += 1;
          }
        } catch (e) {
          log(`claude-otel-collector: could not parse an export — ${String((e && e.message) || e)}`);
        }
        if (count) log(`claude-otel-collector: recorded ${count} sample(s)`);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end('{}');
      });
      return;
    }
    if (req.method === 'POST' && req.url && req.url.startsWith('/v1/logs')) {
      // Only the allowlisted API events are kept; everything else in the body is dropped. See this function's docblock.
      readBody(req).then((text) => {
        try {
          for (const rec of parseOtlpApiEvents(JSON.parse(text || '{}'), now().toISOString())) apiStore.append(rec);
        } catch { /* a malformed logs body is dropped, never an error to the exporter */ }
        res.writeHead(200, { 'content-type': 'application/json' }); res.end('{}');
      });
      return;
    }
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  });
  return new Promise((resolvePromise, reject) => {
    server.on('error', reject);
    server.listen(port, () => {
      const actualPort = server.address().port;
      resolvePromise({
        server,
        port: actualPort,
        close: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
}

// ── CLI ──────────────────────────────────────────────────────────────────────────────────────────────────

const USAGE = 'usage: claude-otel-collector.mjs [--port=4318]\n       claude-otel-collector.mjs api-report [--hours=24] [--json]   (per-hour API requests, latency and errors, read-only)';

/** `api-report`: the per-hour API rollup over the last `--hours` hours of the allowlisted event files. Read-only. */
function apiReport(argv, { out, apiStore = createFileOtelStore({ dir: claudeOtelApiDir() }), nowMs = Date.now() }) {
  const hoursFlag = argv.find((a) => a.startsWith('--hours='));
  const hours = Math.max(1, Number(hoursFlag?.slice('--hours='.length)) || 24);
  const since = nowMs - hours * 3_600_000;
  const recs = apiStore.readAll().filter((r) => Date.parse(r.attributes?.['event.timestamp'] ?? r.receivedAt) >= since);
  const rows = summarizeApiEvents(recs);
  if (argv.includes('--json')) { out(`${JSON.stringify({ hours, rows })}\n`); return 0; }
  if (!rows.length) { out(`no API events in the last ${hours} h (is OTEL_LOGS_EXPORTER=otlp set for Claude Code?)\n`); return 0; }
  for (const r of rows) out(`${r.hour}:00Z  ${r.requests} req  p50 ${r.durationP50Ms ?? '-'} ms  p90 ${r.durationP90Ms ?? '-'} ms  errors ${r.errors} (429: ${r.rateLimited}, 529: ${r.overloaded})\n`);
  return 0;
}

export async function runClaudeOtelCollectorCli(argv, { out = (s) => process.stdout.write(s), apiStore, nowMs } = {}) {
  if (argv.includes('--help') || argv.includes('-h')) { out(`${USAGE}\n`); return 0; }
  if (argv[0] === 'api-report') return apiReport(argv.slice(1), { out, ...(apiStore ? { apiStore } : {}), ...(nowMs ? { nowMs } : {}) });
  const portFlag = argv.find((a) => a.startsWith('--port='));
  const port = portFlag ? Number(portFlag.slice('--port='.length)) || 4318 : 4318;
  const store = createFileOtelStore();
  const { port: actualPort } = await startOtelCollectorServer({ port, store, log: (m) => out(`${m}\n`) });
  out(`claude-otel-collector: listening on http://localhost:${actualPort} (POST /v1/metrics, /v1/logs API events only) — writing to ${store.dir}\n`);
  out('This process must keep running for OTEL-configured Claude Code sessions to have anywhere to send usage data. Ctrl-C to stop.\n');
  return 0; // never resolves in practice — the http server keeps the event loop alive until Ctrl-C/SIGTERM.
}

const IS_CLI = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (IS_CLI) {
  runClaudeOtelCollectorCli(process.argv.slice(2)).catch((e) => {
    process.stderr.write(`error: ${String(e?.message || e)}\n`);
    process.exitCode = 1;
  });
}
