#!/usr/bin/env node
/**
 * @file scripts/conveyor/queue-scope.mjs
 * @description QUEUE-SCOPED MECHANICAL PASSES (epic #3383) — the OPT-IN marker that narrows a conveyor
 *   checkout's REPO-WIDE mechanical passes down to the work its OWN `.conveyor/queue.json` names, so a
 *   deliberately-scoped scratch/test instance is actually isolated instead of only looking isolated.
 *
 * THE LIVE BUG THIS FIXES (2026-09-12, observed, not hypothesized). A scratch checkout was seeded with its own
 * `.conveyor/queue.json` (5 named items) and its own `.conveyor/dispatch-pause.json` scoped to hold every spawn
 * kind except `build`, specifically so ONE bounded `runner.mjs --once` tick could touch those 5 items and
 * nothing else. The KIND scoping worked exactly as designed — 1 of the 5 dispatched, the rest held. But the
 * SAME tick also ran its normal mechanical passes, and those passes do not read the queue at all: they read
 * `gh pr list --state open` over the WHOLE repository. They found two PRs sitting in `review:pending` that had
 * nothing to do with the 5 queued items or this checkout, ran full jury reviews on them, and the (separate,
 * resident) drain then landed both. An "isolated" instance merged two unrelated PRs.
 *
 * WHY `dispatch-pause.mjs` COULD NOT HAVE CAUGHT THIS, AND WHY ITS OWN REASONING STANDS. That lever's header
 * says `review-dispatch` "is deliberately NOT in `PAUSABLE_KINDS`: it is a separate mechanical pass that has
 * never been gated by this lever, blanket or scoped, and stays that way." That is CORRECT and is deliberately
 * NOT overridden here. The pause lever is an ADMISSION gate on NEW work — it answers "may this item start?" —
 * and review/verify/the watch sweeps are the opposite axis: they CLEAR work that is already open, which is
 * precisely why holding them by default would strand every in-flight PR the moment an operator paused new
 * dispatch. That reasoning was written for a REAL, different purpose (conserve capacity without wedging
 * in-flight work) and it never contemplated "I want this checkout scoped to nothing but its own queue". So the
 * fix is NOT to add `review-dispatch` to `PAUSABLE_KINDS` — pausing is the wrong verb. The right verb is
 * SCOPING: let the passes keep running, on a narrowed candidate set.
 *
 * DEFAULT OFF, AND THAT IS LOAD-BEARING. With no marker and no env override this module's filters are the
 * IDENTITY function: a normal production checkout keeps today's exact repo-wide behavior, byte for byte. The
 * operator opts a scratch instance IN, explicitly, per checkout. This mirrors `pausedKinds`'s own posture one
 * level over (absent ⇒ today's behavior) rather than inventing a new default.
 *
 * MEMBERSHIP IS QUEUE MEMBERSHIP — NO NEW SOURCE OF TRUTH. A PR is in scope iff its head ref / title names an
 * item id that is in THIS checkout's `.conveyor/queue.json`. No registry, no per-instance PR routing, no label.
 * That is deliberate: `#3639` Fork 1 argues at length that a second membership store can DISAGREE with queue
 * membership, and that the resulting "I cleared it and nothing happened" failure is the silent kind. This
 * module therefore takes `#3639`'s own recommended premise ("an item is in the changeset iff it is in that
 * instance's queue") and applies it to the passes that were ignoring it, WITHOUT preempting any of that card's
 * still-open forks: it adds no named instances, no registry, no `heldAs`, no lease-key namespacing, and it is
 * a pure narrowing filter that can be deleted the day a ruled design supersedes it.
 *
 * WHERE THE MARKER LIVES — `.conveyor/queue-scope.json`, the SESSION-LOCAL gitignored sidecar convention
 * `we:scripts/conveyor/queue-store.mjs` and `we:scripts/readiness/dispatch-pause.mjs` already share: resolved
 * by SCRIPT LOCATION (never CWD, so a child process's own cwd can never pick a different marker than its
 * parent), env-overridable (`WE_QUEUE_SCOPE_FILE`), atomic temp+rename write, and FAILING OPEN — a missing,
 * corrupt or unreadable marker reads as NOT SCOPED, i.e. today's repo-wide behavior. Failing open is the right
 * direction HERE for the same reason it is right there: a state file must never be able to silently switch a
 * production conveyor into doing nothing.
 *
 * PURE-CORE / IO-SHELL SPLIT: {@link emptyScopeState} / {@link parseScopeState} / {@link setScope} /
 * {@link clearScope} / {@link serializeScopeState} / {@link prScopeTokens} / {@link matchesQueueIds} /
 * {@link prMatchesQueueIds} / {@link filterPrsToQueueIds} are PURE (no fs, no clock — `now` injected). The fs
 * helpers (`resolveScopeStorePath` / `readScopeState` / `writeScopeState` / `isQueueScopeEnabled` /
 * `readScopedQueueIds` / {@link scopePrsToQueue}) and the `set` / `clear` / `status` CLI own the boundary.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { writeAllSync } from '../lib/write-all-sync.mjs';
import { normNum, readQueueFile, queueNums } from './queue-store.mjs';

// ── PURE CORE (no fs / clock — every input injected) ────────────────────────────────────────────────────────

/**
 * The env override every child process of a scoped runner inherits. `we:skills-src/conveyor/runner.mjs`'s
 * `--scope-to-queue` flag sets it, so the flag scopes the runner AND every pass it shells in one move — the
 * shape `#3639` Fork 2(C) argues is forced by the architecture (the runner barely does anything itself; its
 * children each resolve their own sidecars, so a parent-only in-memory flag would look scoped and not be).
 *
 * Three-valued on purpose: `1`/`true`/`on`/`yes` forces scoping ON, `0`/`false`/`off`/`no` forces it OFF (an
 * escape hatch that beats a marker file someone forgot to clear), and ABSENT defers to the marker.
 */
export const QUEUE_SCOPE_ENV = 'WE_SCOPE_MECHANICAL_PASSES_TO_QUEUE';

/** A fresh, NOT-scoped state — the read for "no marker yet" and every fail-open path. */
export function emptyScopeState() {
  return { scopeMechanicalPassesToQueue: false, reason: null, by: null, at: null };
}

/**
 * Tolerant parse of `.conveyor/queue-scope.json` text → normalized state. NEVER throws: empty text, bad JSON,
 * a non-object, or an array all degrade to {@link emptyScopeState} (NOT scoped) — a corrupt marker must never
 * be able to silently narrow a production conveyor's passes to nothing. The `Array.isArray` guard is the same
 * load-bearing one `we:scripts/readiness/dispatch-pause.mjs#parsePauseState` carries: `typeof [] === 'object'`
 * passes the object check, and an array's own prototype would otherwise shadow the fields read below.
 * @param {string|null|undefined} text
 * @returns {{scopeMechanicalPassesToQueue:boolean, reason:(string|null), by:(string|null), at:(string|null)}}
 */
export function parseScopeState(text) {
  if (!text || !String(text).trim()) return emptyScopeState();
  let raw;
  try { raw = JSON.parse(text); } catch { return emptyScopeState(); }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return emptyScopeState();
  return {
    scopeMechanicalPassesToQueue: raw.scopeMechanicalPassesToQueue === true,
    reason: raw.reason != null ? String(raw.reason) : null,
    by: raw.by != null ? String(raw.by) : null,
    at: raw.at != null ? String(raw.at) : null,
  };
}

/**
 * Set (or re-set — idempotent) the scope marker. Pure — `now` is injected so this is directly unit-testable.
 * @param {{reason?:(string|null), by?:(string|null)}} [o]
 * @param {number} [now] epoch ms
 */
export function setScope({ reason = null, by = null } = {}, now = Date.now()) {
  return {
    scopeMechanicalPassesToQueue: true,
    reason: reason != null && String(reason).trim() ? String(reason).trim() : 'operator scoped this checkout to its own queue',
    by: by != null && String(by).trim() ? String(by).trim() : null,
    at: new Date(now).toISOString(),
  };
}

/** Clear the marker — back to {@link emptyScopeState}, i.e. today's repo-wide behavior. Idempotent. */
export function clearScope() {
  return emptyScopeState();
}

/** Serialize a state object back to `queue-scope.json` text (a bare JSON object, newline-terminated). */
export function serializeScopeState(state) {
  const s = state && typeof state === 'object' ? state : emptyScopeState();
  return JSON.stringify({
    scopeMechanicalPassesToQueue: s.scopeMechanicalPassesToQueue === true,
    reason: s.reason ?? null,
    by: s.by ?? null,
    at: s.at ?? null,
  }, null, 2) + '\n';
}

/**
 * Read the env override → `true` / `false` / `null` (absent, defer to the marker). Pure over an injected env.
 * @param {object} [env]
 * @returns {boolean|null}
 */
export function envScopeOverride(env = {}) {
  const raw = env ? env[QUEUE_SCOPE_ENV] : undefined;
  if (raw == null) return null;
  const v = String(raw).trim().toLowerCase();
  if (v === '') return null;
  if (['1', 'true', 'on', 'yes'].includes(v)) return true;
  if (['0', 'false', 'off', 'no'].includes(v)) return false;
  // An unrecognized value FAILS OPEN (not scoped) rather than guessing "on" — the same direction every other
  // sidecar in `.conveyor/` degrades in, and the direction that preserves production behavior on a typo.
  return false;
}

/**
 * The id shapes this repo actually mints, and the ONLY tokens accepted as an item id. Mirrors (does not import
 * — the surrounding jobs differ, see {@link prMatchesQueueIds}) the `isId` guard in
 * `we:scripts/backlog-stranded-sweep.mjs#prDeliveredItem`: a numeric run, or a `x`-prefixed 7-char JIT hash.
 * Anything else is dropped rather than escaped, because these tokens are interpolated into comparisons and an
 * id that is not an id is a data error, not something to pattern-match.
 */
const NUMERIC_ID_RE = /^\d{1,6}$/;
const HASH_ID_RE = /^x[0-9a-z]{6}$/;

/** Is this token a real item id (numeric run or JIT hash)? Pure. */
export function isItemId(token) {
  const t = normNum(token);
  return NUMERIC_ID_RE.test(t) || HASH_ID_RE.test(t);
}

/**
 * Normalize a raw queue id list → the deduped set of real ids, as {@link normNum} spells them ("042" ⇒ "42",
 * `#3639` ⇒ "3639", a hash lower-cased). Junk and non-id tokens are DROPPED, never kept: a token that cannot
 * be an item id can only ever widen a match by accident. Pure.
 * @param {Array<*>} ids
 * @returns {string[]}
 */
export function normalizeQueueIds(ids) {
  const out = [];
  for (const raw of Array.isArray(ids) ? ids : []) {
    const id = normNum(raw);
    if (!id || !isItemId(id) || out.includes(id)) continue;
    out.push(id);
  }
  return out;
}

/**
 * The candidate id tokens a PR's head ref contributes, with `YYYY-MM-DD` runs removed. Pure.
 *
 * SEGMENT-EXACT, NEVER SUBSTRING. `lane/3631-throttle-review-set-label` splits to
 * `['lane','3631','throttle',…]`, so queue id `363` does NOT match `3631` and an unrelated
 * `lane/mechanical-dispatcher` contributes no id tokens at all. A substring test would be the same
 * over-matching that made this filter necessary in the first place, one level down.
 *
 * DATE SEGMENTS ARE DROPPED for the reason `prDeliveredItem`'s own `#2899` jury comment records:
 * `lane/calibrate-2026-08-02` was crediting item #2026 purely because every numeric segment was a candidate.
 * A batch ref (`lane/batch-<date>-<id>-<id>-<id>`) keeps EVERY id segment here, unlike `prDeliveredItem`'s
 * last-segment-only rule — see {@link prMatchesQueueIds} for why the two want opposite answers.
 * @param {string} headRefName
 * @returns {string[]}
 */
export function refScopeTokens(headRefName) {
  const segments = String(headRefName || '').split(/[/\-_]/).filter(Boolean);
  const dateSpans = new Set();
  for (let i = 0; i + 2 < segments.length; i += 1) {
    const [y, m, d] = segments.slice(i, i + 3);
    if (/^(19|20)\d{2}$/.test(y) && /^(0[1-9]|1[0-2])$/.test(m) && /^(0[1-9]|[12]\d|3[01])$/.test(d)) {
      dateSpans.add(y); dateSpans.add(m); dateSpans.add(d);
    }
  }
  const out = [];
  for (const seg of segments) {
    if (dateSpans.has(seg)) continue;
    const t = seg.toLowerCase();
    // A RETRY-LETTERED numeric ref (`lane/3230f-verify-…`, the `#3110` convention) names item 3230. Accepted
    // for numeric ids only: a hash id followed by a letter is a DIFFERENT hash, not a retry of this one.
    const retry = /^(\d{1,6})[a-z]$/.exec(t);
    const token = retry ? retry[1] : t;
    if (!isItemId(token)) continue;
    const id = normNum(token);
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

/**
 * Does this PR name any of `ids`? Pure, and deliberately a DIFFERENT question from
 * `we:scripts/backlog-stranded-sweep.mjs#prDeliveredItem`, which is why this is its own matcher rather than a
 * call to that one:
 *
 *   • `prDeliveredItem` gates an AUTO-COMMITTED `status: resolved` flip, so its every rule narrows (only the
 *     final batch segment counts; an annotation/scope-authoring PR is excluded; a bare `#NNN` in a title is a
 *     citation, not a delivery claim). A false positive there wrongly resolves a live item.
 *   • THIS matcher answers "is this PR part of the working set this checkout was scoped to?". A false positive
 *     here is the exact bug being fixed — an out-of-scope PR gets reviewed/labelled/landed — so it stays
 *     segment-exact and id-shaped. But a PR that merely MENTIONS a queued item in its title is genuinely part
 *     of that item's working set for scoping purposes even when it is not its DELIVERY, and every item of a
 *     batch lane belongs to the instance that queued them, so the two narrowing rules above are deliberately
 *     NOT applied. Getting this wrong in the narrow direction costs only "the scoped instance does less work".
 *
 * Reads `headRefName` and `title` only. The BODY is not read on purpose: a PR body routinely cites unrelated
 * item numbers in prose, and admitting those would re-open the over-matching this whole module exists to shut.
 * @param {{headRefName?:string, title?:string}} pr
 * @param {string[]} ids already-normalized queue ids ({@link normalizeQueueIds})
 * @returns {boolean}
 */
export function prMatchesQueueIds(pr, ids) {
  const wanted = Array.isArray(ids) ? ids : [];
  if (wanted.length === 0) return false;
  const refIds = refScopeTokens(pr && pr.headRefName);
  if (refIds.some((t) => wanted.includes(t))) return true;
  const title = String((pr && pr.title) || '');
  if (!title) return false;
  for (const id of wanted) {
    // Segment-bounded in the title too: `#3631`/`3631:` match, `13631` and `36310` do not.
    if (new RegExp(`(?<![0-9a-z])#?${id}(?![0-9a-z])`, 'i').test(title)) return true;
  }
  return false;
}

/**
 * Does a LANE BRANCH belong to the scoped queue? The branch-side twin of {@link prMatchesQueueIds}, used by
 * `we:scripts/conveyor/verify-dispatch.mjs` — which scans the host-wide lane pool rather than `gh pr list`,
 * and so leaks across instances on a different axis than the PR passes do. Pure.
 * @param {string|null} branch e.g. `lane/3631-throttle-review-set-label`
 * @param {string[]} ids already-normalized queue ids
 * @returns {boolean}
 */
export function branchMatchesQueueIds(branch, ids) {
  const wanted = Array.isArray(ids) ? ids : [];
  if (wanted.length === 0) return false;
  return refScopeTokens(branch).some((t) => wanted.includes(t));
}

/**
 * Narrow a PR list to the ones this checkout's queue names. Pure. `ids` EMPTY ⇒ `[]`, which is the honest
 * answer for "scope to a queue that names nothing" and never the repo-wide list: silently widening back to
 * every PR is the failure this module exists to prevent, so the degenerate case degrades toward doing LESS.
 * Callers only reach here once scoping is already known to be ON ({@link scopePrsToQueue} owns that decision).
 * @param {Array<object>} prs
 * @param {string[]} ids
 * @returns {Array<object>}
 */
export function filterPrsToQueueIds(prs, ids) {
  const wanted = Array.isArray(ids) ? ids : [];
  return (Array.isArray(prs) ? prs : []).filter((pr) => prMatchesQueueIds(pr, wanted));
}

// ── THIN FS/IO SHELL (the boundary every mechanical pass calls) ────────────────────────────────────────────

// Resolved by SCRIPT LOCATION (this file is scripts/conveyor/queue-scope.mjs → root is two up), NEVER by CWD —
// so a pass and the runner that shelled it can never resolve different markers (queue-store.mjs's own rule).
const HERE = dirname(fileURLToPath(import.meta.url));
export const SCOPE_ROOT = resolve(HERE, '..', '..');

/** The session sidecar path: `<root>/.conveyor/queue-scope.json`. */
export function scopeStorePath(root = SCOPE_ROOT) {
  return join(root, '.conveyor', 'queue-scope.json');
}

/** The canonical marker path every consumer resolves to — `WE_QUEUE_SCOPE_FILE` wins, else script-location. */
export function resolveScopeStorePath() {
  const env = process.env.WE_QUEUE_SCOPE_FILE;
  return env && env.trim() ? env.trim() : scopeStorePath();
}

/** Read + parse the marker → normalized state. FAILS OPEN: missing OR corrupt reads as NOT scoped. */
export function readScopeState(path = resolveScopeStorePath()) {
  try {
    if (!existsSync(path)) return emptyScopeState();
    return parseScopeState(readFileSync(path, 'utf8'));
  } catch {
    return emptyScopeState();
  }
}

/**
 * Is this checkout scoped? The ONE predicate every mechanical pass consults. Env override first (so a scoped
 * runner's `--scope-to-queue` reaches every child it shells), marker second, `false` otherwise.
 * @param {{env?:object, path?:string}} [o]
 * @returns {boolean}
 */
export function isQueueScopeEnabled({ env = process.env, path = resolveScopeStorePath() } = {}) {
  const override = envScopeOverride(env);
  if (override !== null) return override;
  return readScopeState(path).scopeMechanicalPassesToQueue === true;
}

/** The normalized ids in THIS checkout's `.conveyor/queue.json` (`CONVEYOR_QUEUE_FILE`-overridable, via
 *  `queue-store.mjs`'s own resolver — so the scope and the dispatcher always read the same queue). */
export function readScopedQueueIds(readQueue = readQueueFile) {
  return normalizeQueueIds(queueNums(readQueue()));
}

/**
 * THE ONE CALL EVERY REPO-WIDE PASS MAKES, right after its `gh pr list`. Scoping OFF (the default) ⇒ the
 * IDENTITY function, so a production checkout's behavior is unchanged to the byte. Scoping ON ⇒ only PRs this
 * checkout's queue names survive, and the narrowing is ANNOUNCED on stderr (never silent: `#3639`'s own
 * "deliberate and visible" caveat, and the only thing that stops a forgotten marker from reading as "the pass
 * is broken").
 * @param {Array<object>} prs
 * @param {{label?:string, enabled?:boolean, ids?:string[], log?:Function}} [o]
 * @returns {Array<object>}
 */
export function scopePrsToQueue(prs, { label = 'mechanical pass', enabled, ids, log = (m) => process.stderr.write(m) } = {}) {
  const on = enabled === undefined ? isQueueScopeEnabled() : enabled === true;
  const all = Array.isArray(prs) ? prs : [];
  if (!on) return all;
  const wanted = ids === undefined ? readScopedQueueIds() : normalizeQueueIds(ids);
  const kept = filterPrsToQueueIds(all, wanted);
  log(`⊂ queue-scoped: ${label} narrowed ${all.length} open PR(s) → ${kept.length} matching this checkout's queue [${wanted.join(', ') || 'empty queue'}]\n`);
  return kept;
}

// ── CLI (runs only when invoked directly) ─────────────────────────────────────────────────────────────────────

/** Hand-rolled `--k=v` / `--flag` parsing (+ positional subcommand) — the sidecar-CLI house style. */
function parseFlags(argv) {
  const flags = {};
  for (const a of argv) {
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq === -1) flags[a.slice(2)] = true;
    else flags[a.slice(2, eq)] = a.slice(eq + 1);
  }
  return flags;
}

/** Write the marker, ATOMICALLY (temp + rename), so a mid-write reader never sees partial JSON. */
export function writeScopeState(state, path = resolveScopeStorePath()) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, serializeScopeState(state));
  renameSync(tmp, path);
}

function runCli(argv) {
  const cmd = argv[0];
  const flags = parseFlags(argv.slice(1));
  const path = resolveScopeStorePath();

  if (cmd === 'set' || cmd === 'on') {
    const state = setScope({ reason: flags.reason, by: flags.by || process.env.USER || null });
    writeScopeState(state, path);
    const ids = readScopedQueueIds();
    process.stderr.write(`⊂ mechanical passes SCOPED to this checkout's queue — ${state.reason}${state.by ? ` (by ${state.by})` : ''}\n`);
    process.stderr.write(`  in scope: ${ids.length ? ids.join(', ') : '(queue is EMPTY — every repo-wide pass will act on nothing)'}\n`);
    writeAllSync(1, JSON.stringify({ ...state, queueIds: ids }, null, 2) + '\n');
    return;
  }
  if (cmd === 'clear' || cmd === 'off') {
    writeScopeState(clearScope(), path);
    process.stderr.write('▣ mechanical passes UNSCOPED — repo-wide again (the production default)\n');
    writeAllSync(1, JSON.stringify({ scopeMechanicalPassesToQueue: false }, null, 2) + '\n');
    return;
  }
  if (cmd === 'status') {
    const state = readScopeState(path);
    const effective = isQueueScopeEnabled({ path });
    const ids = effective ? readScopedQueueIds() : [];
    process.stderr.write(effective
      ? `⊂ SCOPED — repo-wide passes act only on: ${ids.length ? ids.join(', ') : '(nothing — the queue is empty)'}\n`
      : '▣ not scoped — repo-wide passes scan every open PR (the production default)\n');
    writeAllSync(1, JSON.stringify({ ...state, effective, queueIds: ids }, null, 2) + '\n');
    return;
  }
  process.stderr.write(
    'usage: queue-scope.mjs <set|clear|status> [--reason=<text>] [--by=<who>]\n'
    + `       set   — narrow this checkout's repo-wide mechanical passes to its own .conveyor/queue.json\n`
    + `       clear — restore the repo-wide default\n`
    + `       (env override: ${QUEUE_SCOPE_ENV}=1|0 wins over the marker; runner.mjs --scope-to-queue sets it)\n`,
  );
  process.exit(2);
}

const IS_CLI = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (IS_CLI) runCli(process.argv.slice(2));
