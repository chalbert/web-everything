/**
 * @file scripts/operations/review-prep-io.mjs
 * @description THE IO SHELL of the `review-prep` declaration (backlog/xzdi27a-*, under epic #3099) — the
 *   reader its `read` step is injected with, and the sink its `record` step's effects are applied through.
 *
 * WHY IT IS A SEPARATE FILE. {@link ./review-prep.mjs} is the DECLARATION: what the operation is. This is the
 * only place it touches the world — same pure-core / io-shell split {@link ./review-pr-io.mjs} uses for the
 * sibling `review-pr` operation, which is what lets the declaration be unit-tested with a stub reader and stub
 * sinks — no `fs`, no `git`, no `gh`, no network.
 *
 * WHAT THIS IS NOT. A card has no PR, no diff, no GitHub label. `readPrep` reads ONE markdown file's
 * frontmatter + body off disk (via `gray-matter`, the SAME parser `we:scripts/backlog.mjs`'s `readScopeList`
 * uses for a block-list `scope:` field, so this reader and the backlog gate never disagree on what the field
 * says). `recordPrepVerdict` appends a review section, commits, and shells the SAME `we:scripts/pr-land.mjs`
 * transport every other AI-edit path in this repo lands through (#2138) — it does not reimplement `git push` /
 * `gh pr create` sequencing, the same "shell the single home, do not re-derive it" discipline
 * `we:scripts/operations/review-pr-io.mjs` documents for `review-set-label.mjs`.
 *
 * THE RACE GUARD (the corrected card's "Watch for": a card mid-review by a human must not be silently
 * overwritten by a mechanized pass racing it — and with no `confirm` step there is no human to ask). `readPrep`
 * hashes the card's raw bytes at read time; `recordPrepVerdict` re-reads the LIVE file at record time and
 * compares. A mismatch means the card changed underneath this run — `recordPrepVerdict` makes NO write and
 * returns `{ recorded: false, aborted: true, reason }` rather than throwing: a throw would either retry into
 * the same stale mismatch forever (`notApplied`) or wedge the run for a human that does not exist on this
 * operation's path (a bare throw → INDETERMINATE). Declaring the abstention as a normal, non-throwing result is
 * the operational equivalent of `review-pr`'s `abstain` answer — just reached deterministically instead of by
 * asking.
 *
 * IMPURE by construction: `fs`, `git`, `gh` (via `pr-land.mjs`).
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

import { REVIEW_PREP_EFFECTS, isCleanPrepReview, renderPrepReviewSection } from './review-prep.mjs';
import { notApplied } from './effect-executor.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
/** The repo root, resolved by SCRIPT LOCATION and never by cwd — same reason `run-store.mjs` does it. */
export const REPO_ROOT = resolve(HERE, '..', '..');

const requireCjs = createRequire(import.meta.url);

/** SHA-256 of the raw bytes, hex. The race guard's whole mechanism — see the file header. */
export function contentHashOf(raw) {
  return createHash('sha256').update(String(raw), 'utf8').digest('hex');
}

/**
 * Resolve a backlog item id (a number like `"3103"` or a hash slug like `"xk1tron"`) to its card path, the
 * SAME convention `we:scripts/backlog.mjs`'s own item resolver uses (`files().filter(f =>
 * f.startsWith('${padded}-'))`) — an exact `<item>.md` also matches, for a card whose slug IS its id.
 *
 * @param {{item: string, cwd?: string}} o
 * @returns {string} absolute path.
 */
export function resolveCardPath({ item, cwd = REPO_ROOT } = {}) {
  const id = String(item ?? '').trim();
  if (!id) throw new TypeError('review-prep-io: `item` must be a non-empty backlog id (a number or a hash slug)');
  const backlogDir = join(cwd, 'backlog');
  let files;
  try {
    files = readdirSync(backlogDir).filter((f) => f.endsWith('.md'));
  } catch (e) {
    throw new Error(`review-prep-io: could not read ${backlogDir} — ${String(e?.message ?? e)}`);
  }
  const matches = files.filter((f) => f === `${id}.md` || f.startsWith(`${id}-`));
  if (matches.length === 0) {
    throw new Error(`review-prep-io: no backlog card matches item ${JSON.stringify(id)} under ${backlogDir}`);
  }
  if (matches.length > 1) {
    throw new Error(`review-prep-io: item ${JSON.stringify(id)} is ambiguous: ${matches.sort().join(', ')}`);
  }
  return join(backlogDir, matches[0]);
}

/**
 * Read one backlog card's review context — the `readPrep` the declaration is injected with. Reads
 * frontmatter + body (via `gray-matter`, never a hand-rolled YAML split — same parser
 * `we:scripts/backlog.mjs#readScopeList` uses for a block-list `scope:`) and the declared `scope:` files. NO
 * `gh`, NO diff: a card has neither.
 *
 * @param {{item: string, repo: string, cwd?: string}} o
 * @returns {{card: {path: string, frontmatter: object, body: string, raw: string, contentHash: string},
 *   scopeFiles: string[]}}
 */
export function readPrep({ item, repo, cwd = REPO_ROOT } = {}) {
  if (typeof repo !== 'string' || !/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    throw new TypeError(`review-prep-io: \`repo\` must be <owner/name>, got ${JSON.stringify(repo)}`);
  }
  const path = resolveCardPath({ item, cwd });
  const raw = readFileSync(path, 'utf8');
  const parsed = requireCjs('gray-matter')(raw);
  const frontmatter = parsed?.data && typeof parsed.data === 'object' ? parsed.data : {};
  const body = typeof parsed?.content === 'string' ? parsed.content : '';
  const scope = Array.isArray(frontmatter.scope) ? frontmatter.scope : [];
  const scopeFiles = scope.filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim());

  return {
    card: { path, frontmatter, body, raw, contentHash: contentHashOf(raw) },
    scopeFiles,
  };
}

/** `readPrep` bound to one repo/cwd, which is the shape the declaration wants. */
export function createReviewPrepReader({ cwd = REPO_ROOT } = {}) {
  return ({ item, repo }) => readPrep({ item, repo, cwd });
}

/** Today's date, `YYYY-MM-DD`, local — matches every existing `## Independent review — <date>` section in this
 *  repo's backlog (`we:backlog/3103-*.md`, this operation's own card). Exported so a test can pin it without a
 *  real clock. */
export function todayIso(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const execFileIn = (cwd) => (cmd, args, opts) => execFileSync(cmd, args, { ...opts, cwd });

/**
 * Commit the just-rewritten card. ONE commit, the card path only — never `git add -A` (this repo's own
 * git-hygiene rule; a review that accidentally swept up an unrelated dirty file would be its own defect
 * class). Returns the new commit's full SHA.
 * @param {{path: string, message: string, exec: Function, cwd: string}} o
 */
function commitCard({ path, message, exec, cwd }) {
  exec('git', ['add', '--', path], { cwd });
  exec('git', ['commit', '-m', message, '--', path], { cwd, encoding: 'utf8' });
  return String(exec('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' })).trim();
}

/**
 * Append the "## Independent review — <date>" section, commit, and land or park — the `recordPrepVerdict` the
 * declaration's `record` step is shelled through.
 *
 * THE RACE GUARD (see file header). `expectedContentHash` is the hash `readPrep` captured; if the LIVE file's
 * hash has since moved, this makes NO write and returns `{recorded: false, aborted: true, reason}` — the
 * deterministic stand-in for the `confirm` step this operation deliberately does not have.
 *
 * LANDS OR PARKS (never both). A clean review (`isCleanPrepReview`) is committed and handed to
 * `we:scripts/pr-land.mjs --label-on-green` — the SAME transport every AI-edit path in this repo lands through
 * (#2138), so this operation adds no second way to reach `main`. Anything else is parked `--park=review:pending`
 * (pr-land's OWN `PARK_LABELS`, #2622 — `review:changes` is `review-pr`'s DIFFERENT label vocabulary and
 * `resolveParkLabel` refuses anything outside `review:human`/`review:pending`; a real live-fire run against
 * #1637 hit this refusal, caught it as INDETERMINATE post-commit, and is why this is `review:pending` now, not
 * `review:changes` — a prep review parks for a first LOOK, it is not `review:human`'s gate-self ceremony) so a
 * person sees the corrections before it lands.
 *
 * @param {{item: string, repo: string, cwd?: string, confidence: string,
 *   risks?: Array<{risk: string, addressed: boolean, note?: string}>, corrections?: string[],
 *   fixApplied?: boolean, note?: string, actor?: string, expectedContentHash?: string|null,
 *   exec?: Function, runNode?: Function}} o
 * @returns {Promise<object>}
 */
export async function recordPrepVerdict({
  item,
  repo,
  cwd = REPO_ROOT,
  confidence,
  risks = [],
  corrections = [],
  fixApplied = false,
  note = '',
  actor = 'operator',
  expectedContentHash = null,
  exec = execFileIn(cwd),
  runNode = (argv, opts) => execFileSync(process.execPath, argv, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, ...opts }),
} = {}) {
  const path = resolveCardPath({ item, cwd });
  const raw = readFileSync(path, 'utf8');
  const liveHash = contentHashOf(raw);

  // ── THE RACE GUARD — zero effects, not a question (see file header). ─────────────────────────────────────
  if (expectedContentHash && liveHash !== expectedContentHash) {
    return {
      recorded: false,
      aborted: true,
      path,
      reason:
        `review-prep-io: the card at ${path} changed since it was read (its content hash no longer matches) — `
        + 'declaring ZERO effects rather than overwriting a concurrent edit (no `confirm` step exists to ask '
        + 'through). Re-run the operation to review the current text.',
    };
  }

  const date = todayIso();
  const section = renderPrepReviewSection({ date, confidence, risks, corrections, fixApplied, note });
  const updated = `${raw.replace(/\s+$/, '')}\n\n${section}\n`;
  writeFileSync(path, updated, 'utf8');

  const relPath = path.startsWith(cwd) ? path.slice(cwd.length + 1) : path;
  const clean = isCleanPrepReview({ confidence, risks, fixApplied });
  const commitMessage = clean
    ? `review-prep: independent review of #${item} — confidence ${confidence}, no corrections owed`
    : `review-prep: independent review of #${item} — confidence ${confidence}, corrections recorded`;

  let sha;
  try {
    sha = commitCard({ path: relPath, message: commitMessage, exec, cwd });
  } catch (e) {
    throw notApplied(`review-prep-io: git commit failed before any push — ${String(e?.message ?? e)}`, { path });
  }

  const ref = `lane/review-prep-${String(item).replace(/[^\w.-]+/g, '-')}-${sha.slice(0, 8)}`;
  // pr-land REFUSES a bodyless PR (#2332/#2324 — an empty body stalls the drain gate at land); a real live-fire
  // run against #1637 hit that refusal too. The section itself IS the change under review, so it doubles as
  // the PR body — no second copy of the verdict text to keep in sync. STAGED TO A FILE, never `--body=<text>`:
  // pr-land's own argv parser is `^--([^=]+)(?:=(.*))?$` with NO `s` flag, so a multi-line value (this section
  // always is) fails that regex outright and `--body` silently resolves to nothing — reproduced live against
  // #1637 (`--body=…` produced the SAME `empty-body` refusal `--body-file` exists to avoid; pr-land's own
  // header already says the file form is "robust for the multi-line body… a CLI --body flag would mangle").
  const prBody = `Independent review of #${item}, recorded through the declared \`review-prep\` operation.\n\n${section}`;
  const bodyDir = join(cwd, '.operations', 'review-prep');
  mkdirSync(bodyDir, { recursive: true });
  const bodyPath = join(bodyDir, `${String(item).replace(/[^\w.-]+/g, '-')}-${sha.slice(0, 8)}-body.md`);
  writeFileSync(bodyPath, prBody, 'utf8');
  const argv = [
    join(cwd, 'scripts', 'pr-land.mjs'),
    `--ref=${ref}`,
    `--sha=${sha}`,
    `--base=main`,
    `--body-file=${bodyPath}`,
    clean ? '--label-on-green' : '--park=review:pending',
    '--json',
  ];
  let landResult;
  try {
    const stdout = String(runNode(argv, { cwd }));
    landResult = safeJson(stdout) ?? { raw: stdout.trim() };
  } catch (e) {
    const stdout = String((e && e.stdout) || '');
    const parsed = safeJson(stdout);
    // The commit already landed locally regardless of what pr-land.mjs does next — INDETERMINATE from here on
    // (the push/PR-open leg), never re-attempted silently: a person decides, the same fail-closed shape
    // `review-pr-io.mjs`'s LABEL sink uses for its own single-home shell-out.
    throw new Error(
      `review-prep-io: pr-land.mjs failed after the review was committed locally (${sha}) — outcome of the `
      + `push/PR-open is UNKNOWN: ${parsed?.error || String((e && e.message) || e).split('\n').filter(Boolean).pop()}`,
    );
  }

  return {
    recorded: true,
    aborted: false,
    path,
    sha,
    ref,
    clean,
    disposition: clean ? 'landed' : 'parked',
    actor,
    land: landResult,
  };
}

/**
 * THE TWO SINKS, bound to a repo root and an output channel — the shape `createReviewPrSinks` uses for its own
 * effect table.
 * @param {{root?: string, out?: (line: string) => void}} [o]
 * @returns {Record<string, Function>}
 */
export function createReviewPrepSinks({ root = REPO_ROOT, out = (line) => process.stdout.write(`${line}\n`) } = {}) {
  return {
    [REVIEW_PREP_EFFECTS.RECORD]: async (payload) => recordPrepVerdict({ ...payload, cwd: payload.cwd || root }),
    [REVIEW_PREP_EFFECTS.NOTICE]: async (payload) => {
      out(String(payload.notice));
      return { reported: true };
    },
  };
}

/** Parse the LAST JSON line of a CLI's stdout, tolerating banner noise — same tolerant parse
 *  `we:scripts/operations/review-pr-io.mjs` uses for the same reason (a script may print progress before its
 *  machine-readable line). */
function safeJson(stdout) {
  const lines = String(stdout || '').trim().split('\n').filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    try { return JSON.parse(lines[i]); } catch { /* keep walking back */ }
  }
  return null;
}
