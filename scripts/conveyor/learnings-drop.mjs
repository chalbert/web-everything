#!/usr/bin/env node
/**
 * learnings-drop.mjs — the delivery-agent LEARNINGS DROP-BOX append helper (#2614, under conveyor #2612).
 *
 * WHAT: a per-session, append-only JSONL drop-box where every conveyor delivery agent (#2608) writes ONE
 * structured learnings entry — a friction hit, a missing convention, a doc/skill gap, an improvement idea.
 * Capture is DISTRIBUTED (every agent, cheaply, one append in the moment); curation is CENTRALIZED (one
 * vetted `/closing-session` sweep dedups + red-teams the pile — see close-session-sweep.mjs). A subagent
 * can't run a session close itself, so N micro-closes would land N unvetted duplicates; the drop-box is the
 * hand-off seam between the two.
 *
 * TENANT-READY BY CONSTRUCTION (the hard rule). The entry schema carries GENERALIZED-LESSON fields ONLY —
 * there is deliberately NO field for raw code, diffs, secrets, or absolute/repo-identifying paths. This is
 * the same seam that later feeds the multi-tenant product feedback channel (#2610), where minimal-by-schema
 * is a privacy requirement: if the schema has no field for it, it can't leak. `validateEntry` enforces that
 * SCHEMA boundary — the allow-list, the `kind` enum, the per-field caps. A rejected entry is NEVER appended.
 *
 * THE CONTENT SCRUB NO LONGER RUNS HERE (#3015, ratified #2978 Fork 3). It used to: `validateEntry` also ran
 * `scrubReasons` on every text field, so an entry carrying a secret was refused at APPEND time. That gated
 * the wrong seam — the pool file is machine-local, untracked, and never leaves the machine, while the seam
 * where content becomes a COMMITTED, PUSHED artifact (a `backlog/*.md` card, a memory topic file) had no
 * scrub at all. The gate moved to that publish seam: `scrubPublish` in we:scripts/lib/secret-scrub.mjs,
 * wired into `writeBacklogMd` (we:scripts/backlog.mjs), the `--pre` hooks in we:scripts/backlog-guard.mjs and
 * we:scripts/check-memory.mjs, and a corpus sweep in `check:standards`. CONSEQUENCE, stated plainly: a
 * secret-shaped value in `summary`/`area`/`suggestion` now PASSES this validator and lands in the local
 * pool. It is blocked from being COMMITTED, not blocked from being written or read.
 *
 * DESIGN: pure validator core (no I/O) + a thin CLI. Per we:docs/agent/platform-decisions.md
 * #deterministic-core-thin-judgment — the scrub is script-decidable, so it is one tested module
 * (we:scripts/lib/secret-scrub.mjs) that the CLI, the sweep, the hooks and any future UI all SHELL; none
 * re-implements it. The scrub symbols are re-exported here so existing importers keep working.
 *
 * Usage (CLI):
 *   node scripts/conveyor/learnings-drop.mjs --kind=friction \
 *        --summary="lane gate re-runs the full suite even for a docs-only diff" \
 *        --area="lane gating / check:standards" \
 *        --suggestion="scope the lane gate to touched file-families" \
 *        --session=<slug> [--file=<path>] [--json]
 *   echo '{"kind":"doc-gap","summary":"…","area":"…","suggestion":"…"}' \
 *        | node scripts/conveyor/learnings-drop.mjs --stdin --session=<slug>
 *
 * `--session` is REQUIRED (unless an explicit --file / $LEARNINGS_DROPBOX targets a file): distinct-session
 * COUNT is the harvest's ranking signal, so a shared default file would silently collapse every session
 * into one.
 *
 * The drop-box file is TRANSIENT session-meta (like claims.json) — it is NOT committed; the sweep consumes
 * it at close. Path resolves to `--file`, else $LEARNINGS_DROPBOX, else `<pool>/<session>.jsonl` where
 * `<pool>` is the MACHINE-fixed `$LEARNINGS_POOL || ~/.claude/conveyor/learnings` — deliberately outside any
 * working copy, so a lane clone and the primary checkout append to the SAME pool (see `poolDir`).
 */
import { existsSync, mkdirSync, appendFileSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { dirname, join, isAbsolute } from 'node:path';

// ── schema ────────────────────────────────────────────────────────────────────────────────────────
export const KINDS = ['friction', 'missing-convention', 'doc-gap', 'skill-gap', 'improvement'];
// The ALLOW-LIST is the privacy boundary: any key outside it is rejected, so a caller can't smuggle a
// `path`/`code`/`diff`/`secret` field past the schema. `ts` is the ONE envelope field the helper stamps.
export const ALLOWED_KEYS = ['kind', 'summary', 'area', 'suggestion'];
const TEXT_FIELDS = ['summary', 'area', 'suggestion'];
// STRUCTURAL leak-class kill (review fix A): a summary is a sentence, a suggestion a short recommendation, an
// area a coarse label. Capping each field forecloses whole leak classes (PEM keys, code blocks, pasted files
// can't FIT) with zero false positives on real prose — cheaper and stronger than any regex list.
export const FIELD_CAPS = { summary: 240, area: 60, suggestion: 400 };

// ── scrub core (moved out — #3015) ───────────────────────────────────────────────────────────────
// The regex/entropy detectors now live in we:scripts/lib/secret-scrub.mjs, the shared pure home for BOTH
// seams (append + publish). Re-exported here verbatim so existing importers and their tests are undisturbed
// — but note `validateEntry` below no longer CALLS `scrubReasons`; see this file's header for why.
export {
  SECRET_PATTERNS, PATH_PATTERNS, CODE_PATTERNS, PII_PATTERNS, CODE_EXT, DOC_EXT, REPO_NAMES, CRED_LABEL,
  isHighEntropyToken, scrubReasons, scrubPublish, isOpaquePublishToken,
} from '../lib/secret-scrub.mjs';

// STRICT ISO-8601 UTC instant — the ONLY shape `ts` may carry. Deliberately narrow (not `Date.parse`,
// which accepts almost anything): the stamp is machine-written, and a narrow shape is what makes
// lexicographic ordering equal chronological ordering for every consumer that sorts stamps as strings.
const ISO_TS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

/**
 * normalizeTs(value) → the value when it is a strict ISO-8601 UTC stamp, else null. TOTAL: never throws,
 * never passes anything through un-checked. `ts` is the one envelope field the validator emits, so it must
 * go through the same boundary as the content fields — see validateEntry.
 */
export function normalizeTs(value) {
  if (typeof value !== 'string' || !ISO_TS.test(value)) return null;
  return Number.isFinite(Date.parse(value)) ? value : null;
}

/**
 * validateEntry(entry) → { ok, errors, clean }. Deterministic. `clean` is the normalized allow-listed
 * record (the exact object that would be appended) when ok, INCLUDING a normalized `ts` (null when absent
 * or malformed); `appendEntry` overwrites it with its own stamp.
 *
 * `ts` IS PART OF THE BOUNDARY (review fix, PR #1068 blocker 4). It used to be omitted from `clean`, so
 * every reader had to re-attach it raw off the pool line — making the one field that skipped the scrub
 * also the one guaranteed to be rendered (`--json` prints `stats.oldest` verbatim). Normalizing it here
 * makes the validator TOTAL over the record: no consumer needs a `raw.*` read, so none can reintroduce the
 * bypass. It also fixes the everyday failure — one non-ISO stamp anywhere used to null the age signal for
 * the whole pool; now it nulls only its own entry.
 */
export function validateEntry(entry) {
  const errors = [];
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    return { ok: false, errors: ['entry must be a JSON object'], clean: null };
  }
  // (1) No key outside the allow-list — the privacy boundary. `ts` is tolerated (envelope) but stripped.
  for (const key of Object.keys(entry)) {
    if (!ALLOWED_KEYS.includes(key) && key !== 'ts') {
      errors.push(`disallowed field "${key}" — schema carries generalized-lesson fields only (${ALLOWED_KEYS.join(', ')})`);
    }
  }
  // (2) kind ∈ KINDS.
  if (!KINDS.includes(entry.kind)) {
    errors.push(`kind must be one of ${KINDS.join('|')} (got ${JSON.stringify(entry.kind)})`);
  }
  // (3) text fields present, non-empty, and within the per-field cap. NO CONTENT SCRUB — #3015 moved it to
  // the publish seam; the caps remain (they are structural, and #3016 is what removes them).
  for (const f of TEXT_FIELDS) {
    const v = entry[f];
    if (typeof v !== 'string' || !v.trim()) {
      errors.push(`${f} is required and must be a non-empty string`);
      continue;
    }
    if (v.length > FIELD_CAPS[f]) {
      errors.push(`${f}: too long (${v.length} > ${FIELD_CAPS[f]} chars) — a ${f} is a short generalized lesson, not a paste`);
    }
  }
  if (errors.length) return { ok: false, errors, clean: null };
  const clean = {
    kind: entry.kind,
    summary: entry.summary.trim(),
    area: entry.area.trim(),
    suggestion: entry.suggestion.trim(),
    ts: normalizeTs(entry.ts),
  };
  return { ok: true, errors: [], clean };
}

// ── path resolution ─────────────────────────────────────────────────────────────────────────────
function repoRoot() {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return process.cwd();
  }
}

/**
 * poolDir({ env, home }) → the ONE learnings pool directory for this MACHINE. THE single source of truth
 * for where the pool lives; every emitter and the harvest resolve through here.
 *
 * MACHINE-FIXED, NOT REPO-ANCHORED (review fix, PR #1068 blocker 1). It used to be
 * `<git rev-parse --show-toplevel>/.conveyor/learnings`, which silently forked the pool per WORKING COPY:
 * a delivery agent running in a lane clone appended to that clone's pool, and a harvest run from the
 * primary checkout never saw it — ~84% of real entries were invisible, with nothing erroring. Collection
 * is cumulative in TIME (nothing consumes but `--archive`), so it must be cumulative in SPACE too.
 * Anchoring on the home directory makes every clone on the machine one pool.
 *
 * Precedence: `$LEARNINGS_POOL` (the single env override, for tests/relocation) → `~/.claude/conveyor/learnings`.
 */
export function poolDir({ env = process.env, home } = {}) {
  if (env && env.LEARNINGS_POOL) return env.LEARNINGS_POOL;
  return join(home || env?.HOME || homedir(), '.claude', 'conveyor', 'learnings');
}

/**
 * resolveDropboxPath({ file, session, env }) → absolute path of the session drop-box JSONL.
 * Precedence: explicit --file → $LEARNINGS_DROPBOX → <pool>/<session>.jsonl.
 * Pure given its inputs (env defaults to process.env).
 *
 * THE SLUG IS REQUIRED (review fix, PR #1068 blocker 2). It used to default to the literal `session`, so
 * an emitter that forgot `--session` appended to one shared `session.jsonl` — every close in every session
 * collapsing into ONE apparent session. That silently zeroes the whole point of the pool: `sessions` stays
 * 1 forever, distinct-session ranking never fires, and `--min-sessions=2` filters out 100% of those
 * entries. Refusing is the only way the flag cannot be dropped again by the next emitter.
 */
export function resolveDropboxPath({ file, session, env = process.env, root, home } = {}) {
  if (file) return isAbsolute(file) ? file : join(root || repoRoot(), file);
  if (env && env.LEARNINGS_DROPBOX) return env.LEARNINGS_DROPBOX;
  const raw = String(session || env?.LEARNINGS_SESSION || '').trim();
  if (!raw) {
    throw new Error(
      'learnings-drop: --session=<slug> is required — without a distinct per-session file the pool cannot ' +
      'count DISTINCT sessions, which is the whole ranking signal (pass --session, set $LEARNINGS_SESSION, ' +
      'or target an explicit --file)',
    );
  }
  const slug = raw.replace(/[^A-Za-z0-9._-]/g, '-');
  return join(poolDir({ env, home }), `${slug}.jsonl`);
}

/**
 * appendEntry(entry, opts) → the written record (with `ts`). VALIDATES first and THROWS on any error —
 * a rejected entry is never appended. opts: { file, session, env, now, root }.
 */
export function appendEntry(entry, opts = {}) {
  const { ok, errors, clean } = validateEntry(entry);
  if (!ok) {
    const err = new Error(`learnings-drop: entry rejected — ${errors.join('; ')}`);
    err.reasons = errors;
    throw err;
  }
  const record = { ...clean, ts: (opts.now ? new Date(opts.now) : new Date()).toISOString() };
  const path = resolveDropboxPath(opts);
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, JSON.stringify(record) + '\n', 'utf8');
  return { record, path };
}

// ── thin CLI ──────────────────────────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const flags = {};
  for (const a of argv) {
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq === -1) flags[a.slice(2)] = true;
    else flags[a.slice(2, eq)] = a.slice(eq + 1);
  }
  return flags;
}

function main(argv) {
  const f = parseArgs(argv);
  let entry;
  if (f.stdin) {
    try { entry = JSON.parse(readFileSync(0, 'utf8')); } catch (e) { console.error(`learnings-drop: --stdin expects one JSON object (${e.message})`); process.exit(2); }
  } else {
    entry = { kind: f.kind, summary: f.summary, area: f.area, suggestion: f.suggestion };
  }
  try {
    const { record, path } = appendEntry(entry, { file: f.file, session: f.session });
    if (f.json) writeLineSync(1, JSON.stringify({ ok: true, path, record }));
    else console.log(`✓ dropped ${record.kind} learning → ${path}`);
    process.exit(0);
  } catch (e) {
    if (f.json) writeLineSync(1, JSON.stringify({ ok: false, errors: e.reasons || [e.message] }));
    else console.error(`✗ ${e.message}`);
    process.exit(1);
  }
}

// Run only as a CLI (not when imported by tests / the sweep).
import { fileURLToPath } from 'node:url';
import { writeLineSync } from '../lib/write-all-sync.mjs';
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2));
}
