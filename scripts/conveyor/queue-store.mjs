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
 *   or an in-memory fixture in tests. The thin fs helpers (`queuePath` / `resolveQueuePath` / `readQueueFile` /
 *   `writeQueueFile`) own the boundary and are used by the CLI ({@link ./queue.mjs}) and the readiness
 *   shells (dispatch-plan / conveyor-state) that read the cleared set. The sidecar path is ONE machine-wide
 *   file in the automation's state home (`we:scripts/lib/automation-home.mjs#automationStateRoot`), never
 *   inside any checkout, so every writer and reader coincides whichever checkout it runs from;
 *   `CONVEYOR_STATE_ROOT` pins that root, `CONVEYOR_QUEUE_FILE` overrides the whole path.
 *
 * DECOUPLE-PRIMARY-CHECKOUT (epic #4075): the sidecar used to resolve by SCRIPT LOCATION — in practice the
 *   operator's primary checkout, which the build-dispatch daemon then had to be pinned at
 *   (`CONVEYOR_STATE_ROOT=<primary>`). It now defaults to the state home. For ONE RELEASE a read of the
 *   default path that finds no file there falls back to the old location ({@link legacyQueuePaths}); the first
 *   read-modify-write (or `queue.mjs migrate`) then lands it in the new home. Nothing ever writes the old file.
 *
 * SHAPE: a JSON ARRAY of `{ num, addedAt }` entries — `num` is the item id as the operator typed it
 *   (a numeric run like "2613" or a JIT hash like "xqxpeac"), `addedAt` an optional ISO stamp (the CLI
 *   fills it via `Date.now`; the pure core stays clock-free). A bare-number array (`["2613", 42]`) and a
 *   `{ queue: [...] }` wrapper both parse tolerantly, so a hand-edited sidecar never wedges a read.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname, resolve } from 'node:path';
import { automationStateRoot, legacyStateRoots } from '../lib/automation-home.mjs';

// ── PURE CORE (no fs / clock / process — every input is injected) ─────────────────────────────────────────────

/**
 * Normalize an item id for DEDUP + MEMBERSHIP. Strips a leading `#` sigil first — every UI (and this CLI's own
 * `list`) renders ids as `#NNN`, so an operator who types `queue.mjs add '#2613'` must match build-queue row
 * `2613`, not be silently dropped (the `#` is display sugar, never part of the id). Then a pure-numeric id is
 * compared with leading zeros stripped ("042" ≡ "42"), so the sidecar never double-lists the same item under a
 * padded/unpadded spelling and a membership test matches regardless of how a caller pads. A non-numeric id (a
 * JIT hash) is trimmed + lower-cased. Empty/nullish → "".
 * @param {*} num
 * @returns {string}
 */
export function normNum(num) {
  let s = String(num ?? '').trim();
  if (s.startsWith('#')) s = s.slice(1).trim(); // `#NNN` UI sugar — the `#` is not part of the id
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

/**
 * Build a HASH → landed-NNN lookup from backlog items (each `{num, bornAs}`), keyed by {@link normNum}. Pure —
 * no fs. The drain JIT-numbers a cleared card the moment its WE half lands (#2288), stamping the pre-number
 * hash it was cut under into the numbered card's `bornAs:` frontmatter (#2392) — that durable, cross-clone
 * record is the ONE link between the two spellings, and it never changes again once stamped. First item wins a
 * hash (each hash mints exactly one card in practice; a duplicate `bornAs` would be a data bug — flagged by
 * `check-standards-rules.mjs#duplicateBornAs` — this index tolerates it silently rather than throwing, like
 * every other bornAs reader in this repo).
 * @param {Array<{num?:*, bornAs?:*}>} items
 * @returns {Map<string,string>} normalized bornAs hash → normalized landed num
 */
export function bornAsIndexFromItems(items) {
  const idx = new Map();
  for (const it of (Array.isArray(items) ? items : [])) {
    const hash = normNum(it?.bornAs);
    if (hash === '' || idx.has(hash)) continue;
    const num = normNum(it?.num);
    if (num === '') continue;
    idx.set(hash, num);
  }
  return idx;
}

/**
 * SELF-HEAL a queue's stale JIT-hash rows (#4291 area, "queue starves the builder"): the drain JIT-numbers a
 * CLEARED card the instant its WE half lands, but the sidecar the operator cleared it into still holds the
 * pre-number hash — every membership test in this file is an EXACT `normNum` match, so a stale hash row reads
 * as "cleared, but no matching ready row" FOREVER even once the card is numbered and ready (the "cleared but
 * not ready" hold that never clears itself is the exact bug this fixes). Rewrites each entry whose normalized
 * `num` is a key in `bornAsIndex` to that hash's landed NNN, keeping the entry's ORIGINAL `addedAt` — the
 * FIRST clear's timestamp survives the rename, never refreshed. An entry that doesn't resolve (not a JIT hash,
 * or a hash `bornAsIndex` has no record of yet) passes through byte-identical. Rewriting through
 * {@link addToQueue} means a queue that independently holds BOTH the stale hash row and an NNN row for the
 * same landed card collapses to ONE entry (idempotent dedup, keeping whichever `addedAt` was added first) —
 * never a duplicate. Pure; called by both the readiness reader (resolve-at-read-time) and `queue.mjs
 * migrate-bornas` (the one-shot on-disk rewrite) so the two never disagree on what a hash resolves to.
 * @param {Array<{num:string, addedAt:(string|null)}>} queue
 * @param {Map<string,string>|Record<string,string>} bornAsIndex  normalized hash → normalized/landed num
 *   ({@link bornAsIndexFromItems})
 * @returns {Array<{num:string, addedAt:(string|null)}>} a NEW array (never mutates the input)
 */
export function resolveBornAsRefs(queue, bornAsIndex) {
  const idx = bornAsIndex instanceof Map ? bornAsIndex : new Map(Object.entries(bornAsIndex || {}));
  let out = [];
  for (const e of (Array.isArray(queue) ? queue : [])) {
    const resolved = idx.get(normNum(e?.num));
    out = addToQueue(out, resolved != null ? resolved : e?.num, e?.addedAt ?? null);
  }
  return out;
}

// ── THIN FS SHELL (the boundary — used by the CLI + the readiness shells that read the cleared set) ───────────

// The repo root resolved by SCRIPT LOCATION (this file is scripts/conveyor/queue-store.mjs → root is two up).
// Before decouple-primary-checkout this WAS the sidecar's root; it is now only the first LEGACY location the
// one-release compatibility read looks at ({@link legacyQueuePaths}).
const HERE = dirname(fileURLToPath(import.meta.url));
export const QUEUE_ROOT = resolve(HERE, '..', '..');

/** #4052 (Ruling #3681 Fork 4 condition (iii)) — the env var that PINS every daemon state file this module
 *  (and {@link ../run-scorecard-store.mjs}) resolves to a single operator-chosen root. Unset, the root is the
 *  automation's state home (`automation-home.mjs#automationStateRoot` — outside every checkout), which is the
 *  same place this variable's own recommended value points; a pin is now only needed to move it elsewhere. */
export const STATE_ROOT_ENV = 'CONVEYOR_STATE_ROOT';

/**
 * The pinned daemon state root from {@link STATE_ROOT_ENV}, or `null` when unset. PURE (besides the `env` read).
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string|null}
 */
export function pinnedStateRoot(env = process.env) {
  const v = env?.[STATE_ROOT_ENV];
  return v && String(v).trim() ? resolve(String(v).trim()) : null;
}

/** The root the sidecar nests under by default: the automation's state home (which itself honours
 *  `CONVEYOR_STATE_ROOT`). Never a checkout unless the operator pins one. */
export function queueStateRoot(env = process.env) {
  return automationStateRoot(env);
}

/** The session sidecar path: `<root>/.conveyor/queue.json`. `root` defaults to {@link queueStateRoot}. */
export function queuePath(root = queueStateRoot()) {
  return join(root, '.conveyor', 'queue.json');
}

/**
 * The canonical sidecar path every consumer (CLI + readiness shells) resolves to — the single source of truth
 * so the writer and readers can NEVER diverge. An explicit `CONVEYOR_QUEUE_FILE` env override wins (tests, and
 * any caller that wants a full-path-precise sidecar); otherwise {@link queuePath}'s state-home default.
 */
export function resolveQueuePath(env = process.env) {
  const f = env?.CONVEYOR_QUEUE_FILE;
  return f && f.trim() ? f.trim() : queuePath(queueStateRoot(env));
}

/** Set to `1` to switch the one-release legacy fallback OFF (the unit-test setup does, so no test ever reads the
 *  host's real old queue through the defaults). */
export const NO_LEGACY_QUEUE_ENV = 'CONVEYOR_NO_LEGACY_QUEUE';

/**
 * The OLD sidecar locations (one-release compatibility read) — `<legacy root>/.conveyor/queue.json` for each
 * `automation-home.mjs#legacyStateRoots` entry that has one. Empty when an explicit `CONVEYOR_QUEUE_FILE` or
 * `CONVEYOR_STATE_ROOT` is set: an operator who pinned a location meant exactly that location.
 * @param {{env?:NodeJS.ProcessEnv, root?:string, exists?:(p:string)=>boolean}} [o]
 * @returns {string[]}
 */
export function legacyQueuePaths({ env = process.env, root = QUEUE_ROOT, exists = existsSync } = {}) {
  if ((env?.CONVEYOR_QUEUE_FILE || '').trim() || pinnedStateRoot(env) || env?.[NO_LEGACY_QUEUE_ENV] === '1') return [];
  return legacyStateRoots({ root, stateRoot: queueStateRoot(env), exists })
    .map((r) => queuePath(r))
    .filter((p) => { try { return exists(p); } catch { return false; } });
}

/**
 * Where a read of `path` actually comes from: `path` itself when it exists or is not the canonical default;
 * else the first legacy file (compatibility read). PURE over the injected probes.
 * @returns {{path:string, source:'canonical'|'legacy'|'explicit', legacyPath:string|null}}
 */
export function resolveQueueSource(path = resolveQueuePath(), { env = process.env, root = QUEUE_ROOT, exists = existsSync } = {}) {
  const canonical = resolveQueuePath(env);
  if (resolve(path) !== resolve(canonical)) return { path, source: 'explicit', legacyPath: null };
  if (exists(path)) return { path, source: 'canonical', legacyPath: null };
  const legacy = legacyQueuePaths({ env, root, exists })[0] ?? null;
  return legacy ? { path: legacy, source: 'legacy', legacyPath: legacy } : { path, source: 'canonical', legacyPath: null };
}

/** Read + parse the sidecar at `path` → the cleared `[{num, addedAt}]` array (empty on a missing/corrupt file).
 *  A read of the canonical default path with no file there yet reads the legacy location instead (see header). */
export function readQueueFile(path = resolveQueuePath()) {
  const src = resolveQueueSource(path);
  if (!existsSync(src.path)) return [];
  try { return parseQueue(readFileSync(src.path, 'utf8')); }
  catch { return []; }
}

/**
 * One-time move of the legacy sidecar into the state home. Only when the canonical file does NOT exist yet
 * (once it does, the new home is authoritative and a legacy entry the operator has since removed must never be
 * resurrected); unions every legacy file found, first-seen `addedAt` wins. The legacy files are left untouched
 * (they may sit in the operator's checkout, which the automation never writes). Idempotent.
 * @param {{env?:NodeJS.ProcessEnv, root?:string, dryRun?:boolean}} [o]
 * @returns {{migrated:boolean, reason:string, path:string, from:string[], count:number, queue:Array}}
 */
export function migrateLegacyQueue({ env = process.env, root = QUEUE_ROOT, dryRun = false } = {}) {
  const path = resolveQueuePath(env);
  if (existsSync(path)) return { migrated: false, reason: 'canonical-exists', path, from: [], count: readQueueFile(path).length, queue: [] };
  const from = legacyQueuePaths({ env, root });
  if (from.length === 0) return { migrated: false, reason: 'no-legacy', path, from, count: 0, queue: [] };
  let queue = [];
  for (const f of from) {
    let entries = [];
    try { entries = parseQueue(readFileSync(f, 'utf8')); } catch { entries = []; }
    for (const e of entries) queue = addToQueue(queue, e.num, e.addedAt);
  }
  if (!dryRun) writeQueueFile(queue, path);
  return { migrated: !dryRun, reason: dryRun ? 'dry-run' : 'migrated', path, from, count: queue.length, queue };
}

/**
 * Is an OLD-code writer still writing a legacy sidecar after the move? True when a legacy file is newer than
 * the canonical one — the operator's checkout (or any not-yet-upgraded clone) cleared work into a file nothing
 * reads any more. Surfaced by `queue.mjs list`; never auto-merged (that could resurrect removed entries).
 * @returns {{diverged:boolean, legacyPath:string|null}}
 */
export function legacyQueueDivergence({ env = process.env, root = QUEUE_ROOT } = {}) {
  const path = resolveQueuePath(env);
  if (!existsSync(path)) return { diverged: false, legacyPath: null };
  let canonicalMs = 0;
  try { canonicalMs = statSync(path).mtimeMs; } catch { return { diverged: false, legacyPath: null }; }
  for (const f of legacyQueuePaths({ env, root })) {
    try { if (statSync(f).mtimeMs > canonicalMs) return { diverged: true, legacyPath: f }; } catch { /* skip */ }
  }
  return { diverged: false, legacyPath: null };
}

/**
 * Write the queue to the sidecar at `path`, creating `.conveyor/` if needed. ATOMIC: writes a temp file then
 * `rename`s it into place, so a dispatch tick reading mid-write never sees partial JSON (which would parse-catch
 * to `[]` → that tick dispatches nothing). Two racing `add`s are still last-write-wins — acceptable for a
 * session-local single-operator sidecar, no lock needed. (#2613 review, nit 3.)
 */
export function writeQueueFile(queue, path = resolveQueuePath()) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, serializeQueue(queue));
  renameSync(tmp, path);
}
