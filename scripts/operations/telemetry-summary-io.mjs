/**
 * @file scripts/operations/telemetry-summary-io.mjs
 * @description The INJECTED READERS for the `telemetry-summary` operation — the only half that touches the
 * filesystem, `plutil` and the clock. Kept out of `telemetry-summary.mjs` for the same reason
 * `gate-health-io.mjs` is kept out of `gate-health.mjs`: the declaration's import graph is asserted to be
 * free of `node:` specifiers, so its step functions provably hold no reader in lexical scope. Everything
 * here READS — no sink, no write.
 *
 * DATA ROOTS (plateau-app `docs/telemetry-page.md`, "data roots"):
 *   - collector root: `OPERATION_CLAUDE_OTEL_DIR` env, else the shared `<workspace>/.operations/claude-otel`
 *     if it exists, else the primary checkout's `<workspace>/webeverything/.operations/claude-otel`.
 *   - host root: `telemetry-store`'s shared `<workspace>/.operations/telemetry` (derived via
 *     `workspaceFor()`, `we:scripts/lib/lane-pool-paths.mjs`, so a lane clone resolves the SAME shared root a
 *     primary checkout does, never a nested one under the lane).
 *
 * TODAY'S HOST FILE GETS TWO DIFFERENT READS, for two different needs. `machine.now` (busy/sessions/
 * pressure/cores) only needs the MOST RECENT sample of each, so {@link readHostToday} reads a bounded TAIL
 * (a few MB) — cheap, and correct for "latest value". `machine.todayHourlyBusyPct` needs the whole day's
 * `host.cpu.busy_pct` history, and a tail read cannot supply that: the file grows unbounded over a day (past
 * 90 MB by evening) and a 4 MB tail is only the last hour or so — every earlier ET hour of "today" would read
 * as a gap that is not actually a gap. {@link scanFileForMetric} answers that need with a BOUNDED-MEMORY
 * (never bounded-BYTES) scan: fixed-size chunks read synchronously start to end, one metric name matched by
 * a cheap substring pre-filter before `JSON.parse`, so only a chunk buffer and the small filtered sample
 * array are ever resident — never the whole file's content at once, and never an async stream (this
 * operation's engine calls its `compute` step's `fn` synchronously with no `await`, so nothing here may
 * return a Promise).
 */
import {
  existsSync, readFileSync, readdirSync, statSync, openSync, fstatSync, readSync, closeSync,
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { workspaceFor } from '../lib/lane-pool-paths.mjs';
import { previousWeeklyRenewalUtc, PLAN_WEEK_RENEWAL } from '../lib/telemetry-summary.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');
const WORKSPACE = workspaceFor(REPO_ROOT);

/** Default bound on a single tail read of today's (still-growing) host-sampler day file. */
export const DEFAULT_TAIL_BYTES = 4 * 1024 * 1024;

export const COLLECTOR_HAZARD_PLIST = join(
  homedir(), 'Library', 'LaunchAgents', 'com.webeverything.claude-otel-collector.plist',
);

// ── root resolution ──────────────────────────────────────────────────────────────────────────────────────

/** The collector's day-file root — env override, else the shared workspace root, else the primary checkout. */
export function resolveCollectorRoot({ env = process.env } = {}) {
  if (env.OPERATION_CLAUDE_OTEL_DIR) return env.OPERATION_CLAUDE_OTEL_DIR;
  const shared = join(WORKSPACE, '.operations', 'claude-otel');
  if (existsSync(shared)) return shared;
  return join(WORKSPACE, 'webeverything', '.operations', 'claude-otel');
}

/** The host-sampler's day-file root — always the shared workspace root (`telemetry-store`'s own). */
export function resolveHostRoot() {
  return join(WORKSPACE, '.operations', 'telemetry');
}

// ── day-key arithmetic (UTC calendar days, for filenames) ──────────────────────────────────────────────

function pad2(n) { return String(n).padStart(2, '0'); }

/** The UTC calendar day (`YYYY-MM-DD`) an instant falls on — collector/host day files are named by this. */
export function utcDayKey(d) {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/** The ET calendar day (`YYYY-MM-DD`) an instant falls on. */
export function etDayKeyOnly(instant, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(instant).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** `dayKey` shifted by `n` calendar days — plain Gregorian arithmetic. */
export function addDaysToDayKey(dayKey, n) {
  const [y, m, d] = dayKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return utcDayKey(dt);
}

/**
 * Which UTC-day collector files the usage core needs: the plan week + the previous week (for
 * `previousWeek` comparison) + the last 10 ET days, each padded with the NEXT UTC day too (a day's
 * late-evening ET hours land in the following UTC file). PURE — no fs — so it is testable with fixture
 * clocks alone; the actual reads are a separate step.
 *
 * @returns {string[]} sorted, deduplicated UTC day keys.
 */
export function neededCollectorDayKeys(nowDate, renewal = PLAN_WEEK_RENEWAL, timezone = renewal.timezone) {
  const weekStart = previousWeeklyRenewalUtc(nowDate, renewal);
  const startDayKey = etDayKeyOnly(weekStart, timezone);
  const planWeek = Array.from({ length: 8 }, (_, i) => addDaysToDayKey(startDayKey, i));

  const prevWeekStart = previousWeeklyRenewalUtc(new Date(weekStart.getTime() - 1), renewal);
  const prevStartDayKey = etDayKeyOnly(prevWeekStart, timezone);
  const prevWeek = Array.from({ length: 8 }, (_, i) => addDaysToDayKey(prevStartDayKey, i));

  const todayKey = etDayKeyOnly(nowDate, timezone);
  const last10 = Array.from({ length: 10 }, (_, i) => addDaysToDayKey(todayKey, i - 9));

  const etDays = new Set([...planWeek, ...prevWeek, ...last10]);
  const utcFiles = new Set();
  for (const dk of etDays) {
    utcFiles.add(dk);
    utcFiles.add(addDaysToDayKey(dk, 1));
  }
  return [...utcFiles].sort();
}

// ── line parsing, torn-line tolerant ─────────────────────────────────────────────────────────────────────

/** Parse NDJSON text, skipping blank and TORN lines (a line mid-write when the file was read) rather than
 *  throwing — one bad line must not sink the whole day's records. */
export function parseJsonlLines(text) {
  const out = [];
  for (const line of String(text ?? '').split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try { out.push(JSON.parse(t)); } catch { /* torn line — skip it, never throw */ }
  }
  return out;
}

/** Drop a leading PARTIAL line from tail-read text — only when the read did not start at byte 0, since then
 *  (and only then) the first line is a fragment of whatever preceded the read window. */
export function dropPartialFirstLine(text, startedMidFile) {
  if (!startedMidFile) return text;
  const nl = text.indexOf('\n');
  return nl >= 0 ? text.slice(nl + 1) : '';
}

/**
 * Read at most `maxBytes` from the END of a file — the bound this operation's own "done when" requires for
 * today's (still-growing, tens-of-MB) host-sampler file. Never reads the whole file: the buffer allocated is
 * `min(maxBytes, fileSize)`, regardless of how large the file actually is.
 */
export function readTailBytes(path, maxBytes = DEFAULT_TAIL_BYTES) {
  const fd = openSync(path, 'r');
  try {
    const { size } = fstatSync(fd);
    const start = Math.max(0, size - maxBytes);
    const len = size - start;
    const buf = Buffer.alloc(len);
    if (len > 0) readSync(fd, buf, 0, len, start);
    return dropPartialFirstLine(buf.toString('utf8'), start > 0);
  } finally {
    closeSync(fd);
  }
}

// ── collector (claude-usage) reads ──────────────────────────────────────────────────────────────────────

/** One collector day file's records, whole (these files stay small — single-digit MB even on a busy day,
 *  unlike the host-sampler's today file). `[]` for a day with no file yet. */
export function readCollectorDay(root, dayKey) {
  const p = join(root, `${dayKey}.jsonl`);
  if (!existsSync(p)) return [];
  let text;
  try { text = readFileSync(p, 'utf8'); } catch { return []; }
  return parseJsonlLines(text);
}

// ── host-sampler (today, tail-only) reads ───────────────────────────────────────────────────────────────

/** Today's host-sampler records (tail-bounded) plus the latest `receivedAt`-equivalent timestamp among them,
 *  for source-freshness. A day with no file yet is NOT a read failure (`missing: false`) — it is simply no
 *  data yet, which {@link module:telemetry-machine.sourceState} already treats as `'ok'`. */
export function readHostToday(root, dayKey, maxBytes = DEFAULT_TAIL_BYTES) {
  const p = join(root, `${dayKey}.jsonl`);
  if (!existsSync(p)) return { records: [], lastAtMs: null, root: p };
  const text = readTailBytes(p, maxBytes);
  const records = parseJsonlLines(text).filter((r) => r && r.event === 'metric');
  let lastAtMs = null;
  for (const r of records) {
    const t = new Date(r.timestamp).getTime();
    if (Number.isFinite(t) && (lastAtMs === null || t > lastAtMs)) lastAtMs = t;
  }
  return { records, lastAtMs, root: p };
}

/** `{timestamp, value}` samples for one metric `name` out of a records array (host-sampler shape:
 *  `{event:'metric', name, value, timestamp}`). */
export function extractSamplesByName(records, name) {
  const out = [];
  for (const r of Array.isArray(records) ? records : []) {
    if (r?.name === name) out.push({ timestamp: r.timestamp, value: r.value });
  }
  return out;
}

/** Default chunk size for {@link scanFileForMetric} — small enough that a chunk plus its carried-over
 *  partial line never amounts to more than a few MB resident, whatever the file's total size. */
export const DEFAULT_SCAN_CHUNK_BYTES = 2 * 1024 * 1024;

/**
 * Every `{timestamp, value}` sample for ONE metric `name`, scanning `path` start to end in fixed-size
 * chunks — BOUNDED MEMORY, never bounded bytes: unlike {@link readTailBytes}, this reads the whole file, but
 * only ever holds one chunk buffer, one carried-over partial line, and the (small, pre-filtered) output
 * array at a time — never the file's full content. Synchronous throughout (`openSync`/`readSync`), because
 * the declaration's `compute` step calls its reader with no `await` (see this file's header) — an async
 * `readline` stream is not an option here.
 *
 * A cheap substring pre-filter (`"name":"<metricName>"`) skips `JSON.parse` for every line that cannot
 * possibly match, which is the overwhelming majority on a host-sampler day (dozens of metric names share the
 * file). A line that matches the substring but still fails to parse — the torn last line of a file still
 * being appended — is skipped, never thrown, the same tolerance {@link parseJsonlLines} gives every other
 * reader in this module.
 *
 * @param {string} path
 * @param {string} metricName
 * @param {{chunkBytes?: number}} [o]
 * @returns {Array<{timestamp: string, value: number}>}
 */
export function scanFileForMetric(path, metricName, { chunkBytes = DEFAULT_SCAN_CHUNK_BYTES } = {}) {
  const needle = `"name":"${metricName}"`;
  const out = [];
  const takeIfMatch = (line) => {
    if (!line || !line.includes(needle)) return;
    let rec;
    try { rec = JSON.parse(line); } catch { return; } // torn line — skip, never throw
    if (rec && rec.event === 'metric' && rec.name === metricName) out.push({ timestamp: rec.timestamp, value: rec.value });
  };

  const fd = openSync(path, 'r');
  try {
    const { size } = fstatSync(fd);
    const buf = Buffer.alloc(chunkBytes);
    let pos = 0;
    let leftover = '';
    while (pos < size) {
      const len = Math.min(chunkBytes, size - pos);
      const n = readSync(fd, buf, 0, len, pos);
      if (n <= 0) break; // defensive — a short read here would otherwise spin forever
      pos += n;
      const chunkText = leftover + buf.toString('utf8', 0, n);
      const lastNl = chunkText.lastIndexOf('\n');
      if (lastNl < 0) { leftover = chunkText; continue; } // no complete line in this chunk yet
      for (const line of chunkText.slice(0, lastNl).split('\n')) takeIfMatch(line);
      leftover = chunkText.slice(lastNl + 1);
    }
    takeIfMatch(leftover); // the true EOF tail — a torn line here is tolerated by `takeIfMatch` itself
  } finally {
    closeSync(fd);
  }
  return out;
}

// ── host-sampler rollups (closed days) ──────────────────────────────────────────────────────────────────

/** Every `<day>.rollup.json` under `root`, parsed, newest day first. Skips a file that fails to parse rather
 *  than failing the whole read — one bad rollup must not blank out the others. */
export function listRollups(root) {
  const names = readdirSync(root).filter((n) => n.endsWith('.rollup.json'));
  const out = [];
  for (const n of names) {
    const full = join(root, n);
    try {
      const stat = statSync(full);
      const data = JSON.parse(readFileSync(full, 'utf8'));
      out.push({ dayKey: n.replace(/\.rollup\.json$/, ''), mtimeMs: stat.mtimeMs, data });
    } catch { /* a malformed rollup is skipped, not a read failure for the whole store */ }
  }
  out.sort((a, b) => (a.dayKey < b.dayKey ? 1 : -1));
  return out;
}

/** `machine.todayHourlyBusyPct` candidate samples from a closed day's rollup — one sample per UTC hour
 *  bucket, at that bucket's median busy % (`capacity.hourly[<iso hour>].hostBusyPct.p50`). The pure lib
 *  re-buckets these onto ET hours itself; this only shapes what the rollup actually recorded. */
export function extractHourlySamplesFromRollup(rollup) {
  const hourly = rollup?.capacity?.hourly;
  if (!hourly || typeof hourly !== 'object') return [];
  const out = [];
  for (const [isoHour, bucket] of Object.entries(hourly)) {
    const p50 = Number(bucket?.hostBusyPct?.p50);
    if (!Number.isFinite(p50)) continue;
    const normalized = isoHour.replace(/Z$/, ':00Z'); // "…T00:00Z" → "…T00:00:00Z", parses uniformly
    const t = new Date(normalized);
    if (!Number.isFinite(t.getTime())) continue;
    out.push({ timestamp: t.toISOString(), value: p50 });
  }
  return out;
}

// ── the collector-restart hazard (#3739) ────────────────────────────────────────────────────────────────

/**
 * The launchd job's declared script path, and whether it exists — read via `plutil -convert json` first
 * (the documented, structure-aware route), falling back to a regex over the raw XML if `plutil` is
 * unavailable or the plist does not parse.
 */
export function readHazardFacts({ plistPath = COLLECTOR_HAZARD_PLIST } = {}) {
  if (!existsSync(plistPath)) return { plistFound: false, scriptPath: null, scriptExists: null };
  let scriptPath = null;
  try {
    const out = execFileSync('plutil', ['-convert', 'json', '-o', '-', plistPath], { encoding: 'utf8' });
    const parsed = JSON.parse(out);
    const args = Array.isArray(parsed.ProgramArguments) ? parsed.ProgramArguments : [];
    scriptPath = args.find((a) => typeof a === 'string' && a.endsWith('.mjs')) || null;
  } catch {
    try {
      const raw = readFileSync(plistPath, 'utf8');
      const m = raw.match(/<string>([^<]*\.mjs)<\/string>/);
      scriptPath = m ? m[1] : null;
    } catch { /* leave scriptPath null — reported as "cannot tell", never as a false hazard */ }
  }
  return { plistFound: true, scriptPath, scriptExists: scriptPath ? existsSync(scriptPath) : null };
}

// ── the reader the declaration injects ──────────────────────────────────────────────────────────────────

/**
 * Binds every read above into the zero-argument `loadFacts()` the `telemetry-summary` declaration calls.
 * Unlike `gate-health`'s `createHistoryReader`, the returned function takes no per-call argument: there is
 * one laptop, one collector, one host store, so nothing an operation caller supplies could change WHICH
 * files this reads.
 *
 * @param {object} [o]
 * @param {NodeJS.ProcessEnv} [o.env]
 * @param {() => Date} [o.now] - injected clock, for tests.
 * @param {string} [o.timezone]
 * @param {{dayOfWeek:string,time:string,timezone:string}} [o.renewal]
 * @param {number} [o.tailBytes]
 * @returns {() => object} the raw facts bundle `telemetry-summary.mjs#shapeFactsFinding` validates.
 */
export function createTelemetrySummaryReader({
  env = process.env,
  now = () => new Date(),
  timezone = PLAN_WEEK_RENEWAL.timezone,
  renewal = PLAN_WEEK_RENEWAL,
  tailBytes = DEFAULT_TAIL_BYTES,
} = {}) {
  return () => {
    const nowDate = now();
    const collectorRoot = resolveCollectorRoot({ env });
    const hostRoot = resolveHostRoot();

    // ── claude-usage (collector day files) ──────────────────────────────────────────────────────────
    let usageRecords = [];
    let collectorMissing = false;
    if (!existsSync(collectorRoot)) {
      collectorMissing = true;
    } else {
      try {
        for (const dk of neededCollectorDayKeys(nowDate, renewal, timezone)) {
          usageRecords = usageRecords.concat(readCollectorDay(collectorRoot, dk));
        }
      } catch {
        collectorMissing = true;
        usageRecords = [];
      }
    }
    let claudeUsageLastAtMs = null;
    for (const r of usageRecords) {
      const t = new Date(r.receivedAt).getTime();
      if (Number.isFinite(t) && (claudeUsageLastAtMs === null || t > claudeUsageLastAtMs)) claudeUsageLastAtMs = t;
    }

    // ── host-sampler (today, tail-only) ─────────────────────────────────────────────────────────────
    const todayUtcDayKey = utcDayKey(nowDate);
    let hostToday = { records: [], lastAtMs: null, root: join(hostRoot, `${todayUtcDayKey}.jsonl`) };
    let hostMissing = false;
    if (!existsSync(hostRoot)) {
      hostMissing = true;
    } else {
      try {
        hostToday = readHostToday(hostRoot, todayUtcDayKey, tailBytes);
      } catch {
        hostMissing = true;
      }
    }

    // ── rollups (closed days) ───────────────────────────────────────────────────────────────────────
    let rollupFiles = [];
    let rollupsMissing = false;
    if (!existsSync(hostRoot)) {
      rollupsMissing = true;
    } else {
      try {
        rollupFiles = listRollups(hostRoot);
      } catch {
        rollupsMissing = true;
      }
    }
    const rollups = rollupFiles.slice(0, 3).map((f) => f.data);
    const rollupsLastAtMs = rollupFiles.length ? rollupFiles[0].mtimeMs : null;

    // ── machine samples ──────────────────────────────────────────────────────────────────────────────
    // "now" — the LATEST value of each, so the cheap tail read is enough (see this file's header).
    const busySamples = extractSamplesByName(hostToday.records, 'host.cpu.busy_pct');
    const sessionSamples = extractSamplesByName(hostToday.records, 'host.sessions.live');
    const pressureSamples = extractSamplesByName(hostToday.records, 'host.mem.pressure_level');
    const coreSamples = extractSamplesByName(hostToday.records, 'host.cpu.count');
    // `machine.todayHourlyBusyPct` — the WHOLE day's history, which the tail read above cannot supply (past
    // the first hour or so of a multi-tens-of-MB file). A bounded-memory full scan, not a bounded-bytes one.
    let todayFullDayBusySamples = [];
    if (!hostMissing && existsSync(hostToday.root)) {
      try {
        todayFullDayBusySamples = scanFileForMetric(hostToday.root, 'host.cpu.busy_pct', { chunkBytes: tailBytes });
      } catch {
        // A scan failure degrades the hourly chart to fewer hours, not a hard operation failure — the tail
        // read above still covers `machine.now`, and `host-sampler`'s source state is unaffected by this.
        todayFullDayBusySamples = [];
      }
    }
    // Yesterday's rollup (the newest closed day) backfills the ET hours that fall in the PREVIOUS UTC day —
    // the sliver of "today" (ET) whose wall-clock hours precede today's own UTC day boundary. Today's own
    // full-day scan takes priority wherever both exist, since a rollup's median is a coarser summary of the
    // same ground truth.
    const rollupHourlySamples = rollupFiles.length ? extractHourlySamplesFromRollup(rollupFiles[0].data) : [];
    const hourlySamples = [...rollupHourlySamples, ...todayFullDayBusySamples];
    const fallbackCores = rollupFiles.length ? rollupFiles[0].data?.cores ?? null : null;

    const hazard = readHazardFacts();

    return {
      now: nowDate,
      timezone,
      renewal,
      usage: { records: usageRecords },
      machine: {
        busySamples, sessionSamples, pressureSamples, coreSamples, fallbackCores, hourlySamples, rollups,
      },
      sources: {
        'claude-usage': { lastAtMs: claudeUsageLastAtMs, missing: collectorMissing, root: collectorRoot },
        'host-sampler': { lastAtMs: hostToday.lastAtMs, missing: hostMissing, root: hostToday.root },
        rollups: { lastAtMs: rollupsLastAtMs, missing: rollupsMissing, root: hostRoot },
      },
      hazard,
    };
  };
}
