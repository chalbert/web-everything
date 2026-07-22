#!/usr/bin/env node
/**
 * @file scripts/conveyor/queue-store.mjs
 * @description The SESSION-LOCAL conveyor queue store (WE #2613, epic #2612). Holds the operator's
 *   "clear this item for the conveyor to build" gesture in a **gitignored session sidecar**
 *   (`.conveyor/queue.json` under the repo root), NOT in committed `buildQueued` frontmatter.
 *
 * WHY A SIDECAR (the bug this fixes): clearing an item for build is SESSION-LOCAL operator intent, not
 *   committed repo state. The old path — `backlog.mjs build-queue add <NNN>` — writes `buildQueued:true`
 *   frontmatter through `writeBacklogMd`, which the no-override lane guard (backlog.mjs, #2302/#104/#2219/
 *   #2339) BLOCKS from the primary/main checkout. But the /conveyor skill runs from the main session, so
 *   the operator could never actually clear work: the whole loop dispatched nothing. A sidecar the lane
 *   guard does not police (precedent: the drain's `queued.json`, `.claude/lane-ports.json`, and the
 *   conveyor learnings drop-box `.conveyor/learnings/`, all gitignored operational sidecars) lets the
 *   operator clear/unclear work from the primary checkout — because it is NOT a card mutation and never
 *   touches backlog frontmatter or `writeBacklogMd`.
 *
 * PURE-CORE / IO-SHELL SPLIT (mirrors queued-state.mjs #2161): the PURE core (`parseQueue` / `addToQueue`
 *   / `removeFromQueue` / `queueHas` / `serializeQueue`) has NO fs / clock / process — callers inject the
 *   file text (and, for adds, an ISO stamp), so the same logic runs against the live `.conveyor/queue.json`
 *   or an in-memory fixture in tests. The thin fs helpers (`repoRoot` / `queuePath` / `readQueueFile` /
 *   `writeQueueFile`) own the boundary and are used by the CLI ({@link ./queue.mjs}) and the readiness
 *   shells (dispatch-plan / conveyor-state) that read the cleared set.
 *
 * SHAPE: a JSON ARRAY of `{ num, addedAt }` entries — `num` is the item id as the operator typed it
 *   (a numeric run like "2613" or a JIT hash like "xqxpeac"), `addedAt` an optional ISO stamp (the CLI
 *   fills it via `Date.now`; the pure core stays clock-free). A bare-number array (`["2613", 42]`) and a
 *   `{ queue: [...] }` wrapper both parse tolerantly, so a hand-edited sidecar never wedges a read.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';

// ── PURE CORE (no fs / clock / process — every input is injected) ─────────────────────────────────────────────

/**
 * Normalize an item id for DEDUP + MEMBERSHIP: a pure-numeric id is compared with leading zeros stripped
 * ("042" ≡ "42"), so the sidecar never double-lists the same item under a padded/unpadded spelling and a
 * membership test matches regardless of how a caller pads. A non-numeric id (a JIT hash) is trimmed +
 * lower-cased. Empty/nullish → "".
 * @param {*} num
 * @returns {string}
 */
export function normNum(num) {
  const s = String(num ?? '').trim();
  if (s === '') return '';
  return /^\d+$/.test(s) ? String(Number(s)) : s.toLowerCase();
}

/**
 * Tolerant parse of `.conveyor/queue.json` text → a normalized `[{ num, addedAt }]` array. NEVER throws:
 * empty/whitespace, bad JSON, a `{queue:[...]}` wrapper, bare-number entries, and junk rows all degrade to
 * a clean array rather than breaking the reader (a corrupt sidecar must never wedge a dispatch tick). Dedups
 * by {@link normNum}, keeping the FIRST spelling seen.
 * @param {string|null|undefined} text
 * @returns {Array<{num:string, addedAt:(string|null)}>}
 */
export function parseQueue(text) {
  if (!text || !String(text).trim()) return [];
  let raw;
  try { raw = JSON.parse(text); } catch { return []; }
  const arr = Array.isArray(raw) ? raw : Array.isArray(raw?.queue) ? raw.queue : [];
  const seen = new Set();
  const out = [];
  for (const e of arr) {
    const rawNum = e && typeof e === 'object' ? e.num : e;
    if (rawNum == null) continue;
    const num = String(rawNum).trim();
    const key = normNum(num);
    if (key === '' || seen.has(key)) continue;
    seen.add(key);
    const addedAt = e && typeof e === 'object' && e.addedAt != null ? String(e.addedAt) : null;
    out.push({ num, addedAt });
  }
  return out;
}

/** Is `num` cleared in this queue? Pure membership read (normalized). */
export function queueHas(queue, num) {
  const key = normNum(num);
  if (key === '') return false;
  return (Array.isArray(queue) ? queue : []).some((e) => normNum(e?.num) === key);
}

/** The list of cleared item ids (as stored). Pure. */
export function queueNums(queue) {
  return (Array.isArray(queue) ? queue : []).map((e) => String(e?.num));
}

/**
 * Add `num` to the queue — IDEMPOTENT: re-adding an already-cleared item returns the queue unchanged (no
 * duplicate, no stamp refresh — the FIRST clear's `addedAt` is retained). A blank/nullish `num` is a no-op.
 * `addedAt` is injected (the CLI passes `new Date().toISOString()`; the pure core never reads the clock).
 * @returns {Array<{num:string, addedAt:(string|null)}>} a NEW array (never mutates the input)
 */
export function addToQueue(queue, num, addedAt = null) {
  const q = Array.isArray(queue) ? queue : [];
  const clean = String(num ?? '').trim();
  if (clean === '' || normNum(clean) === '') return q;
  if (queueHas(q, clean)) return q; // idempotent — already cleared
  return [...q, { num: clean, addedAt: addedAt != null ? String(addedAt) : null }];
}

/** Remove `num` from the queue — a NO-OP if absent. Returns a new array. Pure. */
export function removeFromQueue(queue, num) {
  const q = Array.isArray(queue) ? queue : [];
  const key = normNum(num);
  if (key === '') return q;
  return q.filter((e) => normNum(e?.num) !== key);
}

/** Serialize the queue back to `.conveyor/queue.json` text (a bare JSON array, newline-terminated). Pure. */
export function serializeQueue(queue) {
  return JSON.stringify(Array.isArray(queue) ? queue : [], null, 2) + '\n';
}

// ── THIN FS SHELL (the boundary — used by the CLI + the readiness shells that read the cleared set) ───────────

/** The repo ROOT — `git rev-parse --show-toplevel`, cwd as the fallback (mirrors learnings-drop.mjs). */
export function repoRoot() {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return process.cwd();
  }
}

/** The session sidecar path: `<root>/.conveyor/queue.json` (root defaults to {@link repoRoot}). */
export function queuePath(root = repoRoot()) {
  return join(root, '.conveyor', 'queue.json');
}

/** Read + parse the sidecar at `path` → the cleared `[{num, addedAt}]` array (empty on a missing/corrupt file). */
export function readQueueFile(path = queuePath()) {
  if (!existsSync(path)) return [];
  try { return parseQueue(readFileSync(path, 'utf8')); }
  catch { return []; }
}

/** Write the queue to the sidecar at `path`, creating `.conveyor/` if needed. */
export function writeQueueFile(queue, path = queuePath()) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, serializeQueue(queue));
}
