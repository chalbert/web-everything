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
 * is a privacy requirement: if the schema has no field for it, it can't leak. The write is GATED like the
 * write-time shared-gate precedent (#883) — `validateEntry` is a deterministic scrub that REJECTS an entry
 * whose value carries a secret/token, an absolute path, or a long code-looking string, and rejects any key
 * outside the allow-list. A rejected entry is NEVER appended.
 *
 * DESIGN: pure validator/scrub core (no I/O) + a thin CLI. Per we:docs/agent/platform-decisions.md
 * #deterministic-core-thin-judgment — the scrub is script-decidable, so it is one tested script that the
 * CLI, the sweep, and any future UI all SHELL; none re-implements it.
 *
 * Usage (CLI):
 *   node scripts/conveyor/learnings-drop.mjs --kind=friction \
 *        --summary="lane gate re-runs the full suite even for a docs-only diff" \
 *        --area="lane gating / check:standards" \
 *        --suggestion="scope the lane gate to touched file-families" \
 *        [--session=<slug>] [--file=<path>] [--json]
 *   echo '{"kind":"doc-gap","summary":"…","area":"…","suggestion":"…"}' \
 *        | node scripts/conveyor/learnings-drop.mjs --stdin [--session=<slug>]
 *
 * The drop-box file is TRANSIENT session-meta (like claims.json) — it is NOT committed; the sweep consumes
 * it at close. Path resolves to `--file`, else $LEARNINGS_DROPBOX, else
 * `<repo>/.conveyor/learnings/<session||'session'>.jsonl` (gitignored).
 */
import { existsSync, mkdirSync, appendFileSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, isAbsolute } from 'node:path';

// ── schema ────────────────────────────────────────────────────────────────────────────────────────
export const KINDS = ['friction', 'missing-convention', 'doc-gap', 'skill-gap', 'improvement'];
// The ALLOW-LIST is the privacy boundary: any key outside it is rejected, so a caller can't smuggle a
// `path`/`code`/`diff`/`secret` field past the schema. `ts` is the ONE envelope field the helper stamps.
export const ALLOWED_KEYS = ['kind', 'summary', 'area', 'suggestion'];
const TEXT_FIELDS = ['summary', 'area', 'suggestion'];
const MAX_FIELD_LEN = 280; // a generalized lesson is a sentence; anything longer is a code/log paste smell.

// ── scrub: reject a VALUE that carries a secret / absolute path / code-looking string ──────────────
// Deny-at-the-write-seam (the #883 write-time-gate precedent). Each matcher returns a human reason.
const SECRET_PATTERNS = [
  [/-----BEGIN [A-Z ]*(?:PRIVATE KEY|CERTIFICATE)/, 'PEM key/cert block'],
  [/\b(?:sk|pk|rk)-[A-Za-z0-9]{16,}/, 'api-key-shaped token (sk-/pk-/rk-)'],
  [/\bgh[posru]_[A-Za-z0-9]{16,}/, 'GitHub token (ghp_/gho_/…)'],
  [/\bxox[baprs]-[A-Za-z0-9-]{10,}/, 'Slack token (xox…)'],
  [/\bAKIA[0-9A-Z]{12,}/, 'AWS access key id (AKIA…)'],
  [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{6,}/, 'JWT (eyJ….….…)'],
  [/\b[A-Za-z0-9+/]{40,}={0,2}\b/, 'long base64/secret-looking blob (≥40 chars)'],
  [/\b[0-9a-fA-F]{32,}\b/, 'long hex string (≥32 hex chars — token/hash/secret)'],
  [/\b(?:password|passwd|secret|token|api[_-]?key|access[_-]?key)\b\s*[:=]\s*\S+/i, 'inline credential assignment'],
];
const PATH_PATTERNS = [
  [/(?:^|\s)(?:\/[A-Za-z0-9._-]+){2,}/, 'absolute POSIX path (/a/b/…)'],
  [/(?:^|\s)~\/[A-Za-z0-9._/-]+/, 'home-relative absolute path (~/…)'],
  [/\b[A-Za-z]:\\[A-Za-z0-9._\\-]+/, 'absolute Windows path (C:\\…)'],
  [/\bfile:\/\//, 'file:// URL (filesystem path)'],
];
const CODE_PATTERNS = [
  [/```/, 'fenced code block (```)'],
  [/[{;]\s*[\r\n]/, 'multi-line code (brace/semicolon + newline)'],
  [/\bfunction\s+\w+\s*\(|=>\s*\{|\bimport\s+.+\bfrom\b/, 'source code (function/arrow/import)'],
  [/<\/?[a-z][\w-]*(?:\s[^>]*)?>/i, 'HTML/markup tag'],
];

/**
 * scrubReasons(value) → string[] of reasons this string value is unsafe to store. Empty ⇒ clean.
 * Pure; the single source the validator + tests share.
 */
export function scrubReasons(value) {
  const reasons = [];
  if (typeof value !== 'string') return ['not a string'];
  if (value.length > MAX_FIELD_LEN) reasons.push(`too long (${value.length} > ${MAX_FIELD_LEN} chars) — likely a code/log paste`);
  for (const [re, why] of [...SECRET_PATTERNS, ...PATH_PATTERNS, ...CODE_PATTERNS]) {
    if (re.test(value)) reasons.push(why);
  }
  return reasons;
}

/**
 * validateEntry(entry) → { ok, errors, clean }. Deterministic. `clean` is the normalized allow-listed
 * record (the exact object that would be appended, WITHOUT the `ts` stamp) when ok.
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
  // (3) text fields present, non-empty, and scrub-clean.
  for (const f of TEXT_FIELDS) {
    const v = entry[f];
    if (typeof v !== 'string' || !v.trim()) {
      errors.push(`${f} is required and must be a non-empty string`);
      continue;
    }
    for (const reason of scrubReasons(v)) errors.push(`${f}: ${reason}`);
  }
  if (errors.length) return { ok: false, errors, clean: null };
  const clean = {
    kind: entry.kind,
    summary: entry.summary.trim(),
    area: entry.area.trim(),
    suggestion: entry.suggestion.trim(),
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
 * resolveDropboxPath({ file, session, env }) → absolute path of the session drop-box JSONL.
 * Precedence: explicit --file → $LEARNINGS_DROPBOX → <repo>/.conveyor/learnings/<session>.jsonl.
 * Pure given its inputs (env defaults to process.env).
 */
export function resolveDropboxPath({ file, session, env = process.env, root } = {}) {
  if (file) return isAbsolute(file) ? file : join(root || repoRoot(), file);
  if (env && env.LEARNINGS_DROPBOX) return env.LEARNINGS_DROPBOX;
  const slug = (session || env?.LEARNINGS_SESSION || 'session').replace(/[^A-Za-z0-9._-]/g, '-');
  return join(root || repoRoot(), '.conveyor', 'learnings', `${slug}.jsonl`);
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
    if (f.json) console.log(JSON.stringify({ ok: true, path, record }));
    else console.log(`✓ dropped ${record.kind} learning → ${path}`);
    process.exit(0);
  } catch (e) {
    if (f.json) console.log(JSON.stringify({ ok: false, errors: e.reasons || [e.message] }));
    else console.error(`✗ ${e.message}`);
    process.exit(1);
  }
}

// Run only as a CLI (not when imported by tests / the sweep).
import { fileURLToPath } from 'node:url';
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2));
}
