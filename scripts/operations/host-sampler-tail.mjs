/**
 * @file scripts/operations/host-sampler-tail.mjs
 * @description BOUNDED-MEMORY READERS FOR THE TELEMETRY DAY FILES (epic #3383). A day file is ~100 MB and 150k+ records
 * once the sampler bursts at 5 s, so nothing that reads one may hold the whole text in a string or spread a whole list
 * into a call (`events.push(...all)` overflows the call stack on a full day: the 2026-09-21 `pressure` crash).
 *
 *  - {@link readEventsTail}: newest records first, from the END of the file in chunks, stopping once the lines are older
 *    than the wanted span. The cost follows the SPAN, not the file (this is what `pressure` uses).
 *  - {@link readEventsFile}: every record, read forward in chunks, appended in a plain loop.
 *
 * Both take a raw `<day>.jsonl` or a gzipped `<day>.jsonl.gz` (a gzip stream cannot be seeked, so its inflated buffer is
 * scanned the same way, without ever turning it into one string). READ-ONLY: nothing here writes or truncates a file.
 * IO edge: `node:fs` / `node:zlib` only; parsing is {@link parseTelemetryLine}, the same one every reader uses.
 */
import { closeSync, existsSync, fstatSync, openSync, readFileSync, readSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

import { parseTelemetryLine } from './telemetry.mjs';

const NL = 0x0a;
/** Chunk size for both directions. */
export const CHUNK_BYTES = 1 << 20;
/** How much older than the wanted span a line may be before it counts as "past the span" (a sample's records span a few seconds). */
export const SPAN_SLACK_MS = 2 * 60_000;
/** The tail scan stops after this many CONSECUTIVE lines older than the span, so one stray out-of-order line cannot end it early. */
export const OLD_LINES_TO_STOP = 64;

/**
 * Open a day file as a random-access byte source. Raw: a file descriptor (nothing loaded). Gzip: the inflated bytes as a Buffer.
 * @returns {{size:number, read:(pos:number, len:number)=>Buffer, close:()=>void}|null} null when neither file exists / is readable
 */
export function openDayFile({ raw, gz }) {
  try {
    if (raw && existsSync(raw)) {
      const fd = openSync(raw, 'r');
      const size = fstatSync(fd).size;
      return {
        size,
        read: (pos, len) => { const b = Buffer.allocUnsafe(len); const n = readSync(fd, b, 0, len, pos); return n === len ? b : b.subarray(0, n); },
        close: () => closeSync(fd),
      };
    }
    if (gz && existsSync(gz)) {
      const buf = gunzipSync(readFileSync(gz));
      return { size: buf.length, read: (pos, len) => buf.subarray(pos, pos + len), close: () => {} };
    }
  } catch { /* unreadable: the caller skips the day */ }
  return null;
}

/** Newest line first. Yields each non-empty line as a string; a line is never split across chunks. */
export function* linesBackward(src, chunk = CHUNK_BYTES) {
  let pos = src.size;
  let carry = Buffer.alloc(0); // the front of the line that continues into the previous chunk
  while (pos > 0) {
    const len = Math.min(chunk, pos);
    pos -= len;
    const buf = carry.length ? Buffer.concat([src.read(pos, len), carry]) : src.read(pos, len);
    let end = buf.length;
    let nl = end > 0 ? buf.lastIndexOf(NL, end - 1) : -1;
    while (nl >= 0) {
      if (end - nl - 1 > 0) yield buf.toString('utf8', nl + 1, end);
      end = nl;
      nl = end > 0 ? buf.lastIndexOf(NL, end - 1) : -1;
    }
    carry = buf.subarray(0, end);
  }
  if (carry.length) yield carry.toString('utf8');
}

/** Oldest line first. */
export function* linesForward(src, chunk = CHUNK_BYTES * 4) {
  let pos = 0;
  let carry = Buffer.alloc(0);
  while (pos < src.size) {
    const len = Math.min(chunk, src.size - pos);
    const piece = src.read(pos, len);
    pos += len;
    const buf = carry.length ? Buffer.concat([carry, piece]) : piece;
    let start = 0;
    let nl = buf.indexOf(NL, start);
    while (nl >= 0) {
      if (nl > start) yield buf.toString('utf8', start, nl);
      start = nl + 1;
      nl = buf.indexOf(NL, start);
    }
    carry = buf.subarray(start);
  }
  if (carry.length) yield carry.toString('utf8');
}

const TS_KEY = '"timestamp":"';
/** The line's `timestamp` in ms without parsing the whole record, or null when it has none / it is not a date. */
export function lineTimeMs(line) {
  const i = line.indexOf(TS_KEY);
  if (i < 0) return null;
  const j = line.indexOf('"', i + TS_KEY.length);
  if (j < 0) return null;
  const ms = Date.parse(line.slice(i + TS_KEY.length, j));
  return Number.isFinite(ms) ? ms : null;
}

/**
 * The parsed records whose timestamp is in `[fromMs - SPAN_SLACK_MS, toMs]`, read from the END of the file. Records
 * newer than `toMs` are skipped without parsing (an `--at` in the past); the scan ends after {@link OLD_LINES_TO_STOP}
 * consecutive older lines. Returned oldest first (file order), like a forward read. A line with no readable timestamp
 * is parsed and kept, and never ends the scan.
 * @returns {{events:object[], scanned:number, parsed:number, bytes:number}} `scanned` lines looked at, `parsed` JSON-parsed
 */
export function readEventsTail({ raw, gz, fromMs, toMs = Infinity }) {
  const src = openDayFile({ raw, gz });
  if (!src) return { events: [], scanned: 0, parsed: 0, bytes: 0, found: false };
  const kept = []; let scanned = 0; let parsed = 0; let old = 0;
  const floor = fromMs - SPAN_SLACK_MS;
  try {
    for (const line of linesBackward(src)) {
      scanned += 1;
      const t = lineTimeMs(line);
      if (t != null) {
        if (t > toMs) continue;
        if (t < floor) { old += 1; if (old >= OLD_LINES_TO_STOP) break; continue; }
        old = 0;
      }
      parsed += 1;
      const rec = parseTelemetryLine(line);
      if (rec) kept.push(rec);
    }
  } finally { src.close(); }
  kept.reverse();
  return { events: kept, scanned, parsed, bytes: src.size, found: true };
}

/**
 * EVERY record in the file, read forward in chunks. Returns the parsed records (the same set `parseTelemetryLines`
 * of the whole text would, without holding that text) and how many lines failed to parse.
 * @returns {{events:object[], corrupt:number, found:boolean}}
 */
export function readEventsFile({ raw, gz }) {
  const src = openDayFile({ raw, gz });
  if (!src) return { events: [], corrupt: 0, found: false };
  const events = []; let corrupt = 0;
  try {
    for (const line of linesForward(src)) {
      if (line.trim() === '') continue;
      const rec = parseTelemetryLine(line);
      if (rec) events.push(rec); else corrupt += 1;
    }
  } finally { src.close(); }
  return { events, corrupt, found: true };
}

/** {@link parseTelemetryLines} over a Buffer without decoding it into one string. */
export function parseEventsFromBuffer(buf) {
  const src = { size: buf.length, read: (pos, len) => buf.subarray(pos, pos + len), close: () => {} };
  const events = []; let corrupt = 0;
  for (const line of linesForward(src)) {
    if (line.trim() === '') continue;
    const rec = parseTelemetryLine(line);
    if (rec) events.push(rec); else corrupt += 1;
  }
  return { events, corrupt };
}

/** Max of a numeric list without spreading it into a call (a spread of ~125k+ items overflows the stack). `null` on empty. */
export function maxOf(list) { let m = null; for (const v of list) if (m == null || v > m) m = v; return m; }
/** Min counterpart of {@link maxOf}. */
export function minOf(list) { let m = null; for (const v of list) if (m == null || v < m) m = v; return m; }
