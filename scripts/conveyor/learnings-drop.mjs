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
// STRUCTURAL leak-class kill (review fix A): a summary is a sentence, a suggestion a short recommendation, an
// area a coarse label. Capping each field forecloses whole leak classes (PEM keys, code blocks, pasted files
// can't FIT) with zero false positives on real prose — cheaper and stronger than any regex list.
export const FIELD_CAPS = { summary: 240, area: 60, suggestion: 400 };

// ── entropy / character-class helpers (review fix B) ─────────────────────────────────────────────
/** Shannon entropy in bits/char — high for opaque keys, low for repetitive/dictionary text. */
function shannonEntropy(s) {
  const freq = new Map();
  for (const ch of s) freq.set(ch, (freq.get(ch) || 0) + 1);
  let h = 0;
  for (const n of freq.values()) { const p = n / s.length; h -= p * Math.log2(p); }
  return h;
}
/** How many of {lowercase, uppercase, digit} a string uses (0–3). ≥3 ⇒ mixed like a random secret. */
function charClasses(s) {
  return (/[a-z]/.test(s) ? 1 : 0) + (/[A-Z]/.test(s) ? 1 : 0) + (/[0-9]/.test(s) ? 1 : 0);
}
/**
 * Vowel ratio over the ALPHABETIC chars — the cheap discriminator between a random opaque token and a
 * word-concatenation identifier. Random secrets (base32/hex/keys) run ~0–15% vowels; English-derived
 * identifiers run ~25–55% (measured: `item2614dropbox` 0.36, `lane5poolacquire` 0.53, a base32 TOTP 0.05).
 * Returns 1 (treated as "pronounceable, don't flag") when there are too few letters to judge.
 */
function vowelRatio(s) {
  const letters = (s.match(/[A-Za-z]/g) || []).length;
  if (letters < 8) return 1;
  const vowels = (s.match(/[AEIOU]/gi) || []).length;
  return vowels / letters;
}
/**
 * A whitespace-delimited token that reads as an OPAQUE secret/key rather than prose. TWO shapes:
 *   (a) MIXED — ≥3 character classes (lower+upper+digit) + high entropy: unknown-format keys and long
 *       tokens the prefix/blob rules skip (e.g. a Google AIza… key, a github_pat_… PAT with internal `_`).
 *   (b) NON-PRONOUNCEABLE — a long run of token chars with a very low vowel ratio + real entropy: catches
 *       2-class base32/random secrets (e.g. a TOTP `jbswy3d…`) that entropy-alone can't separate from a
 *       word-concatenation identifier (which stays pronounceable, so its vowel ratio spares it).
 * The upper length bound is generous (a real field is length-capped anyway) so ~88-char PATs are not skipped.
 */
export function isHighEntropyToken(tok) {
  if (tok.length < 16 || tok.length > 256) return false;
  if (!/^[A-Za-z0-9_-]+$/.test(tok)) return false; // a single opaque run, not a phrase with punctuation
  const entropy = shannonEntropy(tok);
  if (charClasses(tok) >= 3 && entropy >= 3.0) return true;              // (a) mixed-class key
  if (vowelRatio(tok) < 0.15 && entropy >= 3.0) return true;            // (b) non-pronounceable random token
  return false;
}

// ── scrub: reject a VALUE that carries a secret / path / code / PII string ──────────────────────────
// Deny-at-the-write-seam (the #883 write-time-gate precedent). Each matcher returns a human reason.
const SECRET_PATTERNS = [
  [/-----BEGIN [A-Z ]*(?:PRIVATE KEY|CERTIFICATE)/, 'PEM key/cert block'],
  [/\b(?:sk|pk|rk)-[A-Za-z0-9]{16,}/, 'api-key-shaped token (sk-/pk-/rk-)'],
  [/\bgh[posru]_[A-Za-z0-9]{16,}/, 'GitHub token (ghp_/gho_/…)'],
  [/\bgithub_pat_[A-Za-z0-9_]{40,}/, 'GitHub fine-grained PAT (github_pat_…)'],
  [/\bxox[baprs]-[A-Za-z0-9-]{10,}/, 'Slack token (xox…)'],
  [/\bAKIA[0-9A-Z]{12,}/, 'AWS access key id (AKIA…)'],
  [/\bAIza[0-9A-Za-z_-]{30,}/, 'Google API key (AIza…)'],
  [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{6,}/, 'JWT (eyJ….….…)'],
  [/\b[A-Za-z0-9+/]{40,}={0,2}\b/, 'long base64/secret-looking blob (≥40 chars)'],
  // Lowered 32→20: a 20-char lowercase-hex session id / short-lived token is a real leak class. Pure-hex
  // runs of ≥20 chars are ~never prose (git SHORT shas are ≤12 → pass; hex colors are 6 → pass).
  [/\b[0-9a-fA-F]{20,}\b/, 'long hex string (≥20 hex chars — token/hash/session id)'],
];
const PATH_PATTERNS = [
  // Leading boundary is any NON-path char (not just whitespace), so an absolute path glued to `=`, a quote,
  // or a paren — `path=/Users/nic/…`, `"/Users/…"`, `(/Users/…)` — is caught, not only the space-separated form.
  [/(?:^|[^A-Za-z0-9._/-])(?:\/[A-Za-z0-9._-]+){2,}/, 'absolute POSIX path (/a/b/…)'],
  [/(?:^|[^A-Za-z0-9._/-])~\/[A-Za-z0-9._/-]+/, 'home-relative absolute path (~/…)'],
  [/\b[A-Za-z]:\\[A-Za-z0-9._\\-]+/, 'absolute Windows path (C:\\…)'],
  [/\bfile:\/\//, 'file:// URL (filesystem path)'],
  [/\b[a-z][a-z0-9+.-]*:\/\/[^\s/@]+:[^\s/@]+@/, 'URL with inline credentials (user:pass@host)'],
];
// Single-line code smells too (not just fenced/multi-line): a one-liner `const x = fetch(…)` or inline SQL
// must not slip through. Kept narrow to spare domain prose — see the should-pass fixtures in the tests.
const CODE_PATTERNS = [
  [/```/, 'fenced code block (```)'],
  [/[{};]\s*[\r\n]/, 'multi-line code (brace/semicolon + newline)'],
  [/=>/, 'arrow function (=>)'],
  [/===|!==/, 'strict comparison operator (===/!==)'],
  [/\b[A-Za-z_]\w*\([^)]*\)/, 'call-syntax (name(...))'],
  [/\b(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=/, 'JS declaration (const/let/var x =)'],
  [/\bimport\s+.+\bfrom\b/, 'ES import statement'],
  [/\bSELECT\b[\s\S]*\bFROM\b/, 'SQL SELECT … FROM'],
  [/\bDELETE\s+FROM\b/, 'SQL DELETE FROM'],
  [/\bINSERT\s+INTO\b/, 'SQL INSERT INTO'],
  [/\bUPDATE\s+\S+\s+SET\b/, 'SQL UPDATE … SET'],
  // Markup: only a tag WITH attributes, or a CLOSING tag — so domain vocabulary like a bare `<select>`,
  // `<dialog>`, `<slot>` still passes (this is a web-components repo; those ARE the content).
  [/<[a-z][\w-]*\s+[^>]*>/i, 'HTML tag with attributes'],
  [/<\/[a-z][\w-]*>/i, 'HTML closing tag'],
];
// PII the downstream product/telemetry seam (#2610) must never carry: author emails, internal IPs.
const PII_PATTERNS = [
  [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/, 'email address'],
  [/\b\d{1,3}(?:\.\d{1,3}){3}\b/, 'IPv4 address'],
  [/\b(?:[0-9A-Fa-f]{1,4}:){3,}[0-9A-Fa-f]{1,4}\b/, 'IPv6 address'],
];
// Source-code file extensions: a filename/path with one is repo-identifying (the ratified "no
// repo-identifying paths"). EXTENSION-based, not slash-based, so `check:standards` / `scope: []` pass.
const CODE_EXT = /\.(?:ts|tsx|mjs|cjs|js|jsx|py|go|rs|sh|css|scss|less)\b/i;
// Doc/data extensions are repo-identifying only inside a PATH (has a slash) — a bare `AGENTS.md` mention passes.
const DOC_EXT = /\.(?:md|json|njk|html?|ya?ml)\b/i;
const REPO_NAMES = /\bweb-?everything\b/i;
// Labeled credential — reject only when the VALUE is secret-shaped, so `the session token: often expires`
// (a plain word value) passes but `password: hunter2Trombone` does not. `matchAll` (global) → each hit.
const CRED_LABEL = /\b(?:password|passwd|secret|api[_-]?key|access[_-]?key|token|credential)s?\b\s*[:=]\s*(['"]?)([^\s'"]+)\1/gi;

/**
 * scrubReasons(value) → string[] of reasons this string value is unsafe to store. Empty ⇒ clean.
 * Pure; the single source the validator + tests share. NOTE: field-LOCAL — it scans one value, so a secret
 * SPLIT across two fields (e.g. the word "password" in `summary` and the value in `suggestion`) cannot be
 * caught here by construction; the length caps + entropy + labeled-value check narrow that gap but the
 * composition limit is inherent to per-field scrubbing (documented; see the split-secret test).
 */
export function scrubReasons(value) {
  if (typeof value !== 'string') return ['not a string'];
  const reasons = [];
  for (const [re, why] of [...SECRET_PATTERNS, ...PATH_PATTERNS, ...CODE_PATTERNS, ...PII_PATTERNS]) {
    if (re.test(value)) reasons.push(why);
  }
  // Labeled credential with a secret-shaped value (≥8 chars, ≥2 character classes).
  for (const m of value.matchAll(CRED_LABEL)) {
    const v = m[2] || '';
    if (v.length >= 8 && charClasses(v) >= 2) { reasons.push('inline credential (secret-shaped value)'); break; }
  }
  // Per-token: repo-identifying paths/names + opaque high-entropy secrets.
  for (const tok of value.split(/\s+/)) {
    if (!tok) continue;
    if (tok.includes('../')) reasons.push('relative path traversal (../ — repo-identifying)');
    else if (CODE_EXT.test(tok)) reasons.push('source file path/name (code extension — repo-identifying)');
    else if (DOC_EXT.test(tok) && tok.includes('/')) reasons.push('repo-relative doc path');
    if (REPO_NAMES.test(tok)) reasons.push('repo-identifying name (webeverything)');
    if (isHighEntropyToken(tok)) reasons.push('high-entropy token (opaque key/secret)');
  }
  return [...new Set(reasons)];
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
  // (3) text fields present, non-empty, within the per-field cap, and scrub-clean.
  for (const f of TEXT_FIELDS) {
    const v = entry[f];
    if (typeof v !== 'string' || !v.trim()) {
      errors.push(`${f} is required and must be a non-empty string`);
      continue;
    }
    if (v.length > FIELD_CAPS[f]) {
      errors.push(`${f}: too long (${v.length} > ${FIELD_CAPS[f]} chars) — a ${f} is a short generalized lesson, not a paste`);
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
