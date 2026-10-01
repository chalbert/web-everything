#!/usr/bin/env node
/**
 * @file scripts/lib/gh-spend.mjs
 * @description #4309 — GitHub API spend accounting per caller, from `gh-throttle.mjs`'s `calls.jsonl`.
 *
 * WHERE THE NUMBERS COME FROM. The throttle's CLI passthrough (every agent session's `gh`, via the gh App shim)
 * logs GitHub's own free `X-Ratelimit-*` headers on each call line (`rl: [{used, rem, limit, reset, res}]`, one
 * per HTTP response). `used` is the bucket's running counter for one `(identity, resource, reset)` window, so the
 * change between two observations is what was spent in between. Daemon calls made through `runGhSync` carry the
 * same `rl` since #4375; a line without one (capture off, a non-piped stderr, an older line) can only be ESTIMATED.
 *
 * Counter movement is bucket evidence, never exclusive per-caller cost. Only in-band costs
 * are attributed; legacy response costs remain unknown. Estimates consume gap residuals.
 * Installation-labelled identities stay separate; legacy `app` means unknown installation.
 * Reports expose read coverage and baseline windows, not a claim of complete API capture.
 *
 * Usage:
 *   node scripts/lib/gh-spend.mjs report [--hours=24 | --start=ISO --end=ISO] [--by=caller|op|caller+op] [--json] [--log=PATH]
 */
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readSync, renameSync, statSync, writeFileSync, appendFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { classifyGhResource, ghThrottleLockRoot, ghThrottleLogPath } from './gh-throttle.mjs';

export const HOUR_MS = 60 * 60_000;
/** Legacy export retained for consumers; never used to infer per-response cost. */
export const MAX_ATTRIBUTED_PER_RESPONSE = 50;
/** How far back measured calls teach the per-op average used to estimate unmeasured ones. */
export const LEARN_WINDOW_MS = 24 * HOUR_MS;
/** A closed hour is persisted only once this long past its end (late appends from concurrent writers). */
export const PERSIST_GRACE_MS = 60_000;
export const SPEND_HOURLY_FILENAME = 'spend-hourly.jsonl';
export const SPEND_CURSOR_FILENAME = 'spend-cursor.json';

/** Rough GraphQL points per logged call, by op — `gh` gives no per-call cost, so this is an ESTIMATE from
 *  `rateLimit(dryRun:true)` measurements (2026-09-27): a full `--limit 100/200` `pr list` with connection
 *  fields costs 2-5, a right-sized snapshot refresh 1, a single-PR read or mutation 1. */
export function estimateGraphqlPoints(e) {
  const op = String(e?.op || '');
  if (!/^(pr|issue|repo|project|search)\b|^api graphql/.test(op)) return 0; // REST — a different bucket
  if (/^pr list \(snapshot\)/.test(op)) return 1;
  if (/^pr list/.test(op) && !/pr-limit/.test(op)) return 3;
  return 1;
}

/** The static fallback estimate for one invocation on `resource` (REST calls cost 1 against `core`). */
export function staticPointsEstimate(e, resource) {
  return resource === 'graphql' ? estimateGraphqlPoints(e) : 1;
}

/** Which bucket a log line spent: its own `resource` field, else classified from its `op` (pre-#4309 lines). */
export function entryResource(e) {
  return e?.resource || classifyGhResource(String(e?.op || '').split(' '));
}

export function hourStart(ms, hourMs = HOUR_MS) {
  return Math.floor(ms / hourMs) * hourMs;
}

/** A map keyed by log data (caller, op, resource names) — no prototype, so `__proto__` or `constructor` is an
 *  ordinary key and never reaches `Object.prototype` (PR #2851 review). Serializes like `{}`. */
function dict() { return Object.create(null); }

/** One rate-limit response a window can be diffed on: a numeric `used` and `reset`, and a named bucket. */
function isObservation(r) {
  return !!r && Number.isFinite(r.used) && !!r.res && Number.isFinite(r.reset);
}

/** Group `call` lines into invocations (retries share `inv`; a nested record joins its `outer`). */
function groupInvocations(entries) {
  const groups = new Map();
  (entries || []).forEach((e, i) => {
    if (!e || e.outcome !== 'call') return;
    const t = Date.parse(e.ts || '');
    if (!Number.isFinite(t)) return;
    const key = e.outer ? `inv:${e.outer}` : e.inv ? `inv:${e.inv}` : `line:${i}`;
    let g = groups.get(key);
    if (!g) { g = { key, records: [] }; groups.set(key, g); }
    g.records.push({ e, t });
  });
  const out = [];
  for (const g of groups.values()) {
    // The OUTER record (no `outer` field) names the logical caller and op; a lone inner record names itself.
    const head = (g.records.find((r) => !r.e.outer) || g.records[0]).e;
    const ts = Math.max(...g.records.map((r) => r.t));
    const responses = [];
    const knownResponses = new Set();
    for (const r of g.records) {
      if (!Array.isArray(r.e.rl)) continue;
      const seenInRecord = [];
      for (const x of r.e.rl) {
        if (isObservation(x)) {
          const signature = JSON.stringify([r.e.id || '?', x.res, x.reset, x.used, x.cost, x.shape]);
          if (knownResponses.has(signature)) continue; // outer capture and nested shim echo
          seenInRecord.push(signature);
        }
        responses.push({ ...x, id: r.e.id || '?', t: r.t });
      }
      for (const signature of seenInRecord) knownResponses.add(signature);
    }
    // MEASURED means at least one usable header observation — an empty or malformed `rl` is as unmeasured as an
    // absent one (PR #2851 review), never an "attributed" invocation that silently costs zero.
    const identities = [...new Set(responses.length ? responses.map((r) => r.id) : [head.id || '?'])];
    for (const [index, id] of identities.entries()) {
      const own = responses.filter((r) => r.id === id);
      const observations = own.filter(isObservation).length;
      out.push({
        key: g.key, ts, id, requests: index === 0 ? 1 : 0,
        resource: entryResource(head), caller: head.caller || 'unknown',
        op: String(head.op || '?'), measured: observations > 0, observations, responses: own,
        attributedByRes: dict(), baselineOnly: 0, kind: null, estimated: 0, estimateRaw: 0,
      });
    }
  }
  return out;
}

/** PURE: the per-op measured cost (`{'<resource>|<op>': {pts, n}}`) of attributed invocations within `windowMs` of `now`. */
export function measuredOpCost(invocations, { now = Date.now(), windowMs = LEARN_WINDOW_MS } = {}) {
  const out = {};
  for (const inv of invocations) {
    if (inv.kind !== 'attributed' || now - inv.ts > windowMs) continue;
    const k = `${inv.resource}|${inv.op}`;
    const pts = inv.attributedByRes[inv.resource] || 0;
    out[k] = { pts: (out[k]?.pts || 0) + pts, n: (out[k]?.n || 0) + 1 };
  }
  return out;
}

function mergeOpCost(a = {}, b = {}) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = { pts: (out[k]?.pts || 0) + v.pts, n: (out[k]?.n || 0) + v.n };
  return out;
}

/**
 * PURE: attribute points to every invocation in `entries`.
 * @param {object[]} entries  parsed `calls.jsonl` lines
 * @param {{baselines?:Record<string,{used:number,t:number}>, learnedOpCost?:Record<string,{pts:number,n:number}>, now?:number, hourMs?:number}} [o]
 * @returns {{invocations:object[], gaps:object[], baselines:Record<string,{used:number,t:number}>, opCost:Record<string,{pts:number,n:number}>}}
 */
export function attributeSpend(entries, { baselines = {}, learnedOpCost = {}, now = Date.now(), hourMs = HOUR_MS } = {}) {
  const invocations = groupInvocations(entries);
  // 1. Observations per (identity, resource, reset) window, sorted by the bucket's running `used`.
  const windows = new Map();
  for (const inv of invocations) {
    for (const r of inv.responses) {
      if (!isObservation(r)) continue;
      const wk = `${inv.id}|${r.res}|${r.reset}`;
      if (!windows.has(wk)) windows.set(wk, []);
      windows.get(wk).push({ used: r.used, t: r.t, res: r.res, cost: r.cost, limit: r.limit, inv });
    }
  }
  const gaps = [];
  const baselinesOut = { ...baselines };
  for (const [wk, obs] of windows) {
    obs.sort((a, b) => a.t - b.t || a.used - b.used);
    const carried = baselines[wk];
    let prev = carried && Number.isFinite(carried.used) && carried.t <= obs[0].t ? carried : null;
    for (const o of obs) {
      if (prev && o.used < prev.used) { o.inv.stale = true; continue; }
      if (!prev) {
        if (Number.isInteger(o.cost) && o.cost >= 0 && o.used >= o.cost) prev = { used: o.used - o.cost, t: o.t };
        else { o.inv.baselineOnly += 1; prev = o; continue; }
      }
      const delta = Math.max(0, o.used - prev.used);
      // In-band cost belongs to THIS response; shared-counter deltas do not.
      const attributed = Number.isInteger(o.cost) && o.cost >= 0
        ? Math.min(delta, o.cost) : 0;
      // Caller columns report the actual response cost even if overlapping counter
      // observations leave a smaller gap. Totals still use only observed bucket movement.
      const callerCost = Number.isInteger(o.cost) && o.cost >= 0 ? o.cost : attributed;
      o.inv.attributedByRes[o.res] = (o.inv.attributedByRes[o.res] || 0) + callerCost;
      // Keyed on the INVOCATION's hour (not the record's) so a row's gaps and its callers' points always agree.
      gaps.push({ id: o.inv.id, res: o.res, fromT: prev.t, toT: o.t, hour: hourStart(o.inv.ts, hourMs), delta, attributed, estimated: 0, unattributed: delta - attributed, members: [], closer: o.inv });
      prev = o;
    }
    const last = prev;
    baselinesOut[wk] = { used: last.used, t: last.t, ...(Number.isFinite(last.limit) ? { limit: last.limit } : {}) };
  }
  // 2. Measured invocations are attributed (unless every observation they carried was a window's first, bare baseline).
  for (const inv of invocations) {
    if (!inv.measured) continue;
    inv.kind = inv.responses.every((r) => Number.isInteger(r.cost) && r.cost >= 0) && !inv.stale ? 'attributed' : 'unknown';
  }
  // 3. Unmeasured invocations get an estimate ONLY inside an observed gap's residual (same identity, resource
  //    and hour), scaled down to fit; anything outside every observed gap is UNKNOWN.
  const gapIndex = new Map();
  for (const g of gaps) {
    const k = `${g.id}|${g.res}`;
    if (!gapIndex.has(k)) gapIndex.set(k, []);
    gapIndex.get(k).push(g);
  }
  for (const inv of invocations) {
    if (inv.measured) continue;
    const gap = (gapIndex.get(`${inv.id}|${inv.resource}`) || [])
      .find((g) => inv.ts > g.fromT && inv.ts <= g.toT && hourStart(inv.ts, hourMs) === g.hour);
    if (gap) { gap.members.push(inv); inv.kind = 'estimated'; } else inv.kind = 'unknown';
  }
  // 4. Learn per-op costs only from CLEAN gaps (no other logged call in between) — a gap shared with other
  //    traffic over-attributes to its closing response, and learning from it would inflate every estimate.
  //    A line with no logged identity (pre-#4309) could have spent from any bucket, so it dirties a gap too.
  for (const g of gaps) if (g.members.length) g.closer.dirty = true;
  const anonymous = invocations.filter((i) => !i.measured && i.id === '?');
  if (anonymous.length) {
    for (const g of gaps) {
      if (!g.closer.dirty && anonymous.some((i) => i.resource === g.res && i.ts > g.fromT && i.ts <= g.toT)) g.closer.dirty = true;
    }
  }
  const opCost = measuredOpCost(invocations.filter((i) => !i.dirty), { now });
  const learned = mergeOpCost(learnedOpCost, opCost);
  for (const inv of invocations) {
    if (inv.measured) continue;
    const l = learned[`${inv.resource}|${inv.op}`];
    inv.estimateRaw = l && l.n > 0 ? l.pts / l.n : staticPointsEstimate(inv, inv.resource);
  }
  for (const g of gaps) {
    const residual = g.delta - g.attributed;
    const raw = g.members.reduce((s, m) => s + m.estimateRaw, 0);
    const allocated = Math.min(raw, residual);
    const scale = raw > 0 ? allocated / raw : 0;
    for (const m of g.members) m.estimated = m.estimateRaw * scale;
    g.estimated = allocated;
    g.unattributed = residual - allocated;
    delete g.members;
    delete g.closer;
  }
  return { invocations, gaps, baselines: baselinesOut, opCost };
}

function emptyDim() { return { attributed: 0, estimated: 0, unknown: 0, requests: 0, responses: 0, deferred: 0 }; }
/** `map` must be a {@link dict} (or a JSON-parsed row map, where `__proto__` is already an own key). */
function bump(map, key, patch) {
  const d = map[key] || (map[key] = emptyDim());
  for (const k of Object.keys(emptyDim())) if (k in patch) d[k] += patch[k];
}

/**
 * PURE: the hourly rollup — one row per `(hour, identity, resource)`. A row with no observable gap is
 * `unknown: true` and its point columns are null (not zero: an unknown total is not a known zero).
 * @returns {Array<{hour:string, identity:string, resource:string, unknown:boolean, bucketUsed:(number|null), attributed:(number|null),
 *   unattributed:(number|null), estimated:(number|null), unknownRequests:number, requests:number, responses:number,
 *   byCaller:object, byOp:object, byCallerOp:object, measuredByOp:object}>}
 */
export function rollupSpend(entries, opts = {}) {
  return rollupSpendDetailed(entries, opts).rows;
}

export function rollupSpendDetailed(entries, { hourMs = HOUR_MS, ...rest } = {}) {
  const { invocations, gaps, baselines, opCost } = attributeSpend(entries, { hourMs, ...rest });
  const rows = new Map();
  const row = (hourMs0, id, res) => {
    const k = `${hourMs0}|${id}|${res}`;
    if (!rows.has(k)) {
      rows.set(k, {
        accountingVersion: 2, hour: new Date(hourMs0).toISOString(), identity: id, resource: res, unknown: true,
        bucketUsed: 0, attributed: 0, unattributed: 0, estimated: 0, unknownRequests: 0, requests: 0, responses: 0,
        byCaller: dict(), byOp: dict(), byCallerOp: dict(), measuredByOp: dict(),
      });
    }
    return rows.get(k);
  };
  for (const g of gaps) {
    const r = row(g.hour, g.id, g.res);
    r.unknown = false;
    r.bucketUsed += g.delta; r.attributed += g.attributed; r.estimated += g.estimated; r.unattributed += g.unattributed;
  }
  for (const inv of invocations) {
    const h = hourStart(inv.ts, hourMs);
    const dims = (r, patch) => {
      bump(r.byCaller, inv.caller, patch);
      bump(r.byOp, inv.op, patch);
      bump(r.byCallerOp, `${inv.caller} ${inv.op}`, patch);
    };
    const own = row(h, inv.id, inv.resource);
    own.requests += inv.requests;
    own.responses += inv.responses.length;
    if (inv.kind === 'unknown') own.unknownRequests += inv.requests;
    dims(own, {
      requests: inv.requests, responses: inv.responses.length, unknown: inv.kind === 'unknown' ? inv.requests : 0,
      estimated: inv.kind === 'estimated' ? inv.estimated : 0,
    });
    // Attributed points land on the row of the RESOURCE each response spent (a `pr create` can hit both buckets).
    for (const [res, pts] of Object.entries(inv.attributedByRes)) dims(row(h, inv.id, res), { attributed: pts });
    if (inv.kind === 'attributed' && !inv.dirty) bump(own.measuredByOp, `${inv.resource}|${inv.op}`, { attributed: inv.attributedByRes[inv.resource] || 0, requests: 1 });
  }
  for (const e of entries || []) {
    if (e?.outcome !== 'deferred-low-budget' || !Number.isFinite(Date.parse(e.ts))) continue;
    const r = row(hourStart(Date.parse(e.ts), hourMs), e.id || '?', e.resource || 'graphql');
    r.deferred = (r.deferred || 0) + 1;
    bump(r.byCaller, e.caller || 'unknown', { deferred: 1 });
    bump(r.byOp, e.op || 'unknown', { deferred: 1 });
    bump(r.byCallerOp, `${e.caller || 'unknown'} ${e.op || 'unknown'}`, { deferred: 1 });
  }
  const out = [...rows.values()].map((r) => (r.unknown ? { ...r, bucketUsed: null, attributed: null, unattributed: null, estimated: null } : r));
  out.sort((a, b) => a.hour.localeCompare(b.hour) || a.identity.localeCompare(b.identity) || a.resource.localeCompare(b.resource));
  return { rows: out, baselines, opCost, staleInvocations: invocations.filter((i) => i.stale).length };
}

/** The persisted row key — one row per closed hour per identity per resource. */
export function spendRowKey(r) {
  return `${r.hour}|${r.identity}|${r.resource}`;
}

/** Learned per-op costs from persisted rows within `windowMs` of `now` (their `measuredByOp`). */
export function learnedOpCostFromRows(rows, { now = Date.now(), windowMs = LEARN_WINDOW_MS } = {}) {
  const out = {};
  for (const r of rows || []) {
    if (r.accountingVersion !== 2 || now - Date.parse(r.hour) > windowMs) continue;
    for (const [k, v] of Object.entries(r.measuredByOp || {})) out[k] = { pts: (out[k]?.pts || 0) + v.attributed, n: (out[k]?.n || 0) + v.requests };
  }
  return out;
}

// ── IO ─────────────────────────────────────────────────────────────────────────────────────────────────────

function readTailBuf(path, start, end) {
  const len = Math.max(0, end - start);
  const buf = Buffer.alloc(len);
  if (!len) return buf;
  const fd = openSync(path, 'r');
  try { readSync(fd, buf, 0, len, start); } finally { closeSync(fd); }
  return buf;
}

/** Complete lines of `buf` (which starts at byte `base` of its file), each with the byte offset just past it. */
function completeLines(buf, base, { skipFirstPartial = false } = {}) {
  const out = [];
  let pos = 0;
  if (skipFirstPartial) {
    const nl = buf.indexOf(0x0a);
    if (nl === -1) return out;
    pos = nl + 1;
  }
  for (;;) {
    const nl = buf.indexOf(0x0a, pos);
    if (nl === -1) break;
    const text = buf.toString('utf8', pos, nl);
    const start = base + pos;
    pos = nl + 1;
    let entry = null;
    try { entry = text.trim() ? JSON.parse(text) : null; } catch { entry = null; }
    out.push({ entry, start, end: base + pos });
  }
  return out;
}

/** Parsed rows of `spend-hourly.jsonl` (bounded tail read; a torn first line is skipped). */
export function readSpendRows(hourlyPath, { maxBytes = 4 * 1024 * 1024 } = {}) {
  if (!existsSync(hourlyPath)) return [];
  const size = statSync(hourlyPath).size;
  const start = Math.max(0, size - maxBytes);
  return completeLines(readTailBuf(hourlyPath, start, size), start, { skipFirstPartial: start > 0 }).map((l) => l.entry).filter(Boolean);
}

function readCursor(cursorPath) {
  try {
    const c = JSON.parse(readFileSync(cursorPath, 'utf8'));
    if (c && Number.isFinite(c.offset)) return { offset: c.offset, baselines: c.baselines || {}, file: c.file || null };
  } catch { /* absent or torn — start fresh */ }
  return { offset: null, baselines: {}, file: null };
}

/** How many leading bytes of the log identify it (every line starts with its own `ts`, so a new file differs). */
const FILE_HEAD_BYTES = 256;

/** The log's identity for the cursor: its inode plus a hash of its first bytes (PR #2851 review). */
function logFileIdentity(logPath, st, headLen = Math.min(st.size, FILE_HEAD_BYTES)) {
  const head = createHash('sha1').update(readTailBuf(logPath, 0, headLen)).digest('hex');
  return { ino: st.ino, headLen, head };
}

/**
 * Where to resume reading `logPath`: the cursor's offset only while it still points into the SAME file. A file
 * that shrank, has a different inode (renamed into place), or whose first bytes changed (truncated and
 * rewritten) is a rotation — read it from byte 0, whatever its size. A cursor with no recorded identity (written
 * before this check existed) falls back to the size test alone.
 */
function resumeOffset(logPath, st, cursor) {
  if (cursor.offset == null || cursor.offset > st.size) return 0;
  const f = cursor.file;
  if (!f) return cursor.offset;
  if (f.ino !== st.ino || st.size < f.headLen) return 0;
  return logFileIdentity(logPath, st, f.headLen).head === f.head ? cursor.offset : 0;
}

export function spendPaths(logPath) {
  const dir = dirname(logPath);
  return { hourlyPath: join(dir, SPEND_HOURLY_FILENAME), cursorPath: join(dir, SPEND_CURSOR_FILENAME) };
}

/**
 * Persist every fully CLOSED hour of `calls.jsonl` once into `spend-hourly.jsonl` (next to the log), and advance
 * a byte cursor past exactly the lines it consumed — so hours survive log rotation, a bounded tail never loses a
 * window it already rolled up, and re-running is idempotent (rows are keyed `hour+identity+resource`; a row
 * already present is never appended twice, so a crash between the append and the cursor write is harmless).
 * The cursor also carries each window's last `used` baseline across the hour boundary.
 * @returns {{rowsWritten:number, consumedLines:number, offset:number}}
 */
export function persistSpendHours({ logPath = ghThrottleLogPath(ghThrottleLockRoot()), now = Date.now(), maxBytes = 8 * 1024 * 1024, graceMs = PERSIST_GRACE_MS, hourMs = HOUR_MS } = {}) {
  const { hourlyPath, cursorPath } = spendPaths(logPath);
  if (!existsSync(logPath)) return { rowsWritten: 0, consumedLines: 0, offset: 0 };
  const st = statSync(logPath);
  const { size } = st;
  const cursor = readCursor(cursorPath);
  let offset = resumeOffset(logPath, st, cursor); // rotated (shrunk, renamed, or rewritten) → from 0
  let skipFirstPartial = false;
  if (size - offset > maxBytes) { offset = size - maxBytes; skipFirstPartial = true; } // bootstrap / long outage
  const lines = completeLines(readTailBuf(logPath, offset, size), offset, { skipFirstPartial });
  const cutoff = hourStart(now - graceMs, hourMs); // every hour strictly before this one is closed
  const consumed = [];
  let end = lines.length ? lines[0].start : offset; // a skipped torn first line is never re-read
  for (const l of lines) {
    const t = Date.parse(l.entry?.ts || '');
    if (Number.isFinite(t) && t >= cutoff) break;
    if (l.entry) consumed.push(l.entry);
    end = l.end;
  }
  const existing = readSpendRows(hourlyPath);
  const existingKeys = new Set(existing.map(spendRowKey));
  const { rows, baselines } = rollupSpendDetailed(consumed, {
    baselines: cursor.baselines, learnedOpCost: learnedOpCostFromRows(existing, { now }), now, hourMs,
  });
  const fresh = rows.filter((r) => !existingKeys.has(spendRowKey(r)));
  mkdirSync(dirname(hourlyPath), { recursive: true });
  if (fresh.length) appendFileSync(hourlyPath, fresh.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8');
  // Keep only baselines for windows that can still be open (GitHub windows are an hour long).
  const live = Object.fromEntries(Object.entries(baselines).filter(([wk]) => Number(wk.split('|')[2]) * 1000 > now - 2 * hourMs));
  const tmp = `${cursorPath}.tmp-${process.pid}`;
  const file = logFileIdentity(logPath, st);
  writeFileSync(tmp, JSON.stringify({ v: 1, offset: end, file, baselines: live, updatedAt: new Date(now).toISOString() }) + '\n', 'utf8');
  renameSync(tmp, cursorPath);
  return { rowsWritten: fresh.length, consumedLines: consumed.length, offset: end };
}

/** Compatibility array API; use collectSpendReport for interval and coverage metadata. */
export function collectSpendRows(opts = {}) {
  return collectSpendReport(opts).rows;
}

/** Bounded raw replay. Explicit intervals never substitute whole persisted hours for partial hours. */
export function collectSpendReport({ logPath = ghThrottleLogPath(ghThrottleLockRoot()), hours = 24,
  now = Date.now(), start, end = now, maxBytes = 16 * 1024 * 1024, hourMs = HOUR_MS } = {}) {
  const explicit = start !== undefined;
  const until = typeof end === 'number' ? end : Date.parse(end);
  const since = explicit ? (typeof start === 'number' ? start : Date.parse(start))
    : hourStart(until, hourMs) - (hours - 1) * hourMs;
  if (!Number.isFinite(since) || !Number.isFinite(until) || since > until || (explicit && since === until)) throw new Error('Invalid spend interval: start must precede end');
  const { hourlyPath } = spendPaths(logPath);
  const size = existsSync(logPath) ? statSync(logPath).size : 0;
  const offset = Math.max(0, size - maxBytes);
  const lines = size ? completeLines(readTailBuf(logPath, offset, size), offset, { skipFirstPartial: offset > 0 }) : [];
  const entries = lines.map((l) => l.entry).filter((e) => e && Number.isFinite(Date.parse(e.ts)) && Date.parse(e.ts) < until);
  const before = entries.filter((e) => Date.parse(e.ts) < since);
  const selected = entries.filter((e) => Date.parse(e.ts) >= since);
  const { baselines } = attributeSpend(before, { now: until });
  const detail = rollupSpendDetailed(selected, { baselines, now: until, hourMs });
  const keys = new Set(detail.rows.map(spendRowKey));
  const hourlySize = existsSync(hourlyPath) ? statSync(hourlyPath).size : 0;
  const persisted = explicit ? [] : readSpendRows(hourlyPath).filter((r) =>
    Date.parse(r.hour) >= since && Date.parse(r.hour) + hourMs <= until);
  // Legacy rows retain bucket evidence, but their old delta attribution cannot become measured costs.
  const historical = persisted.filter((r) => !keys.has(spendRowKey(r))).map((r) => {
    if (r.accountingVersion === 2) return { ...r, provenance: 'persisted' };
    const migrated = { ...r, provenance: 'persisted-legacy', attributed: r.unknown ? null : 0,
      estimated: r.unknown ? null : 0, unattributed: r.bucketUsed, unknownRequests: r.requests, measuredByOp: {} };
    for (const field of ['byCaller', 'byOp', 'byCallerOp']) migrated[field] = Object.fromEntries(
      Object.entries(r[field] || {}).map(([k, d]) => [k, { ...d, attributed: 0, estimated: 0, unknown: d.requests }]));
    return migrated;
  });
  const unreadBytes = size - (lines.at(-1)?.end ?? offset);
  const skippedBytes = lines[0]?.start ?? offset;
  const rows = [...historical, ...detail.rows.map((r) => ({ ...r, provenance: 'live' }))]
    .sort((a, b) => a.hour.localeCompare(b.hour) || a.identity.localeCompare(b.identity) || a.resource.localeCompare(b.resource));
  return { rows, interval: { start: new Date(since).toISOString(), end: new Date(until).toISOString(),
    semantics: explicit ? 'explicit-half-open' : 'UTC-clock-hours-half-open' },
    coverage: { logPath, hourlyPath, sizeBytes: size, skippedBytes, unreadBytes,
      hourlySizeBytes: hourlySize, hourlyTailTruncated: !explicit && hourlySize > 4 * 1024 * 1024,
      staleInvocations: detail.staleInvocations,
      expiredResetObservations: selected.reduce((n, e) => n + (e.rl || []).filter((r) => Number.isFinite(r.reset) && r.reset * 1000 < Date.parse(e.ts)).length, 0),
      invalidLines: lines.filter((l) => !l.entry || !Number.isFinite(Date.parse(l.entry.ts))).length,
      readComplete: existsSync(logPath) && skippedBytes === 0 && unreadBytes === 0 && lines.every((l) => l.entry && Number.isFinite(Date.parse(l.entry.ts))),
      captureComplete: false, persistedRows: historical.length,
      persistedLiveOverlap: persisted.filter((r) => keys.has(spendRowKey(r))).length,
      baselines, resetWindows: detail.baselines,
      baselineCoverage: 'Only observed counters; gaps crossing the start and unobserved edges have unknown interval cost',
      total: rows.some((r) => !r.unknown) ? 'observed-only' : 'unknown' } };
}

/** PURE: aggregate rows per `(identity, resource)` and per the chosen dimension. */
export function summarizeSpendRows(rows, { by = 'caller' } = {}) {
  const field = by === 'op' ? 'byOp' : by === 'caller+op' ? 'byCallerOp' : 'byCaller';
  const sections = new Map();
  for (const r of rows) {
    const k = `${r.identity}|${r.resource}`;
    if (!sections.has(k)) {
      sections.set(k, { identity: r.identity, resource: r.resource, hours: 0, unknownHours: 0, bucketUsed: 0, attributed: 0, estimated: 0, unattributed: 0, unknownRequests: 0, requests: 0, responses: 0, dims: dict() });
    }
    const s = sections.get(k);
    s.deferred = (s.deferred || 0) + (r.deferred || 0);
    s.hours += 1;
    if (r.unknown) s.unknownHours += 1;
    else { s.bucketUsed += r.bucketUsed; s.attributed += r.attributed; s.estimated += r.estimated; s.unattributed += r.unattributed; }
    s.unknownRequests += r.unknownRequests; s.requests += r.requests; s.responses += r.responses;
    for (const [name, d] of Object.entries(r[field] || {})) bump(s.dims, name, d);
  }
  return [...sections.values()].map((s) => ({
    ...s,
    ...(s.unknownHours === s.hours ? { bucketUsed: null, attributed: null, estimated: null, unattributed: null } : {}),
    dims: Object.entries(s.dims).map(([name, d]) => ({ name, ...d }))
      .sort((a, b) => (b.attributed + b.estimated) - (a.attributed + a.estimated) || b.requests - a.requests),
  }));
}

const r1 = (n) => (n == null ? '—' : String(Math.round(n * 10) / 10));

/** PURE: the human report text. */
export function renderSpendReport(sections, { hours, by, interval, coverage } = {}) {
  const out = [`GitHub API spend — ${interval?.semantics === 'explicit-half-open' ? 'explicit interval' : `${hours} UTC clock hours`}, by ${by}`];
  if (interval) out.push(`[${interval.start}, ${interval.end}) — ${interval.semantics}`);
  if (coverage) out.push(`Log: ${coverage.logPath}; hourly: ${coverage.hourlyPath}`,
    `Read coverage: ${coverage.readComplete ? 'complete file read' : 'INCOMPLETE'}; skipped ${coverage.skippedBytes} bytes; unread ${coverage.unreadBytes} bytes; persisted rows ${coverage.persistedRows}; persisted/live overlap ${coverage.persistedLiveOverlap}`,
    `API capture completeness: unknown. ${coverage.baselineCoverage}`,
    `Hourly tail truncated: ${coverage.hourlyTailTruncated}; stale invocations: ${coverage.staleInvocations}; observations after their reset: ${coverage.expiredResetObservations}`,
    `Reset windows: ${JSON.stringify(coverage.resetWindows)}; preceding baselines: ${JSON.stringify(coverage.baselines)}`);
  if (!sections.length) return `${out.join('\n')}\n(no gh calls observed in range; spend unknown)\n`;
  for (const s of sections) {
    out.push('', `[${s.identity} · ${s.resource}] ${s.requests} invocations · ${s.responses} HTTP responses · ${s.hours - s.unknownHours}/${s.hours} hours observable`);
    out.push(s.hours - s.unknownHours
      ? `  bucket used ${r1(s.bucketUsed)} = attributed ${r1(s.attributed)} + estimated ${r1(s.estimated)} + unattributed ${r1(s.unattributed)}`
      : '  bucket used: unknown (no header observations in range)');
    if (s.deferred) out.push(`  deferred-low-budget: ${s.deferred} calls skipped (no API spend)`);
    if (s.unknownRequests) out.push(`  ${s.unknownRequests} invocations with UNKNOWN points (nothing observable to diff against)`);
    const w = Math.max(10, ...s.dims.slice(0, 25).map((d) => d.name.length));
    out.push(`  ${by.padEnd(w)}  attributed*  estimated  unknown-inv  invocations  responses`);
    for (const d of s.dims.slice(0, 25)) {
      if (d.deferred) out.push(`  ${d.name}: deferred-low-budget ${d.deferred}`);
      // A caller with ONLY unknown invocations has no known points — `—`, never a zero that reads as "free".
      const pts = (v) => (d.unknown === d.requests && !d.attributed && !d.estimated ? '—' : r1(v));
      out.push(`  ${d.name.padEnd(w)}  ${pts(d.attributed).padStart(11)}  ${pts(d.estimated).padStart(9)}  ${String(d.unknown).padStart(11)}  ${String(d.requests).padStart(11)}  ${String(d.responses).padStart(9)}`);
    }
  }
  out.push('', '* attributed uses only in-band rateLimit.cost; legacy costs are UNKNOWN. Bucket movement is observed evidence, not a complete installation budget. Legacy app identity means unknown installation.');
  return out.join('\n') + '\n';
}

function parseFlags(argv) {
  const flags = {};
  for (const a of argv) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (m) flags[m[1]] = m[2] ?? true;
  }
  return flags;
}

function main(argv) {
  const [cmd, ...rest] = argv;
  if (cmd !== 'report') {
    process.stderr.write('usage: node scripts/lib/gh-spend.mjs report [--hours=24 | --start=ISO --end=ISO] [--by=caller|op|caller+op] [--json] [--log=PATH]\n');
    process.exitCode = 2;
    return;
  }
  const flags = parseFlags(rest);
  const hours = Math.max(1, Math.floor(Number(flags.hours) || 24));
  const by = ['caller', 'op', 'caller+op'].includes(flags.by) ? flags.by : 'caller';
  const report = collectSpendReport({ ...(flags.log ? { logPath: flags.log } : {}), hours, ...(flags.start ? { start: flags.start } : {}), ...(flags.end ? { end: flags.end } : {}) });
  const { rows } = report;
  const sections = summarizeSpendRows(rows, { by });
  process.stdout.write(flags.json ? `${JSON.stringify({ hours, by, sections, ...report }, null, 2)}\n` : renderSpendReport(sections, { hours, by, ...report }));
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) main(process.argv.slice(2));
