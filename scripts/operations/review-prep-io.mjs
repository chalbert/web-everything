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
 * says).
 *
 * LANDING IS NOT AUTOMATIC — IT IS RESOLVED FIRST, AND IT DOWNGRADES (#3233). `recordPrepVerdict` appends a
 * review section, verifies the STAGED bytes, and commits; what happens after that is decided BEFORE anything
 * is touched, from the requested `land` input AND a GitHub-credential probe:
 *   - `land` requested (the default) and a credential present ⇒ shells the SAME `we:scripts/pr-land.mjs`
 *     transport every other AI-edit path in this repo lands through (#2138), which does its own push. This is
 *     byte-identical to what a laptop caller got before the flag existed.
 *   - no credential (a cloud VM — `we:agent-memory-src/workflow-cloud-vm-github-api-boundary.md`: git
 *     transport is credentialed there and the GitHub API is not) ⇒ DOWNGRADED to push-only with
 *     `reason: 'no-credential'`, never refused. Refusing would leave the verdict to die with the box, which
 *     is how 21 `lane/review-prep-*` refs came to carry 20 verdicts that never reached `main`.
 *   - `land: false`, or a push that fails ⇒ the same push-only shape.
 * On every non-landing branch the result carries `followUp`: the argv a credentialed host should run to land
 * the pushed ref. A returned field, not a log line, because the hand-back is the half that was missing.
 * The push carries ONE commit, named by sha (`<sha>:refs/heads/<ref>`), never a branch tip — pushing the
 * caller's accumulated stack under one item's ref is the "six commits on one lane" defect this fixes.
 * It still does not reimplement `gh pr create` sequencing, the same "shell the single home, do not re-derive
 * it" discipline `we:scripts/operations/review-pr-io.mjs` documents for `review-set-label.mjs`.
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
 * Stage the just-rewritten card. The card path only — never `git add -A` (this repo's own git-hygiene rule; a
 * review that accidentally swept up an unrelated dirty file would be its own defect class). SEPARATE from the
 * commit because the verification sits BETWEEN them: what is checked has to be the bytes that get committed.
 * @param {{path: string, exec: Function, cwd: string}} o
 */
function stageCard({ path, exec, cwd }) {
  exec('git', ['add', '--', path], { cwd });
}

/**
 * Commit the STAGED card and return the new commit's full SHA. ONE commit, the card path only.
 * @param {{path: string, message: string, exec: Function, cwd: string}} o
 */
function commitStagedCard({ path, message, exec, cwd }) {
  exec('git', ['commit', '-m', message, '--', path], { cwd, encoding: 'utf8' });
  return String(exec('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' })).trim();
}

/**
 * Read what is STAGED for one path — `git show :<path>`, the index rather than the working tree. Its OWN
 * injectable rather than a call through `recordPrepVerdict`'s `exec`, deliberately: the default landing path
 * has to issue exactly the four subprocesses it issued before this change, and a verification riding `exec`
 * would be a fifth that no caller asked for.
 * @param {{path: string, cwd: string}} o
 * @returns {string}
 */
function readStagedCard({ path, cwd }) {
  return String(execFileSync('git', ['show', `:${path}`], { cwd, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }));
}

/**
 * Is a GitHub API credential reachable FROM THIS HOST? The step-0 probe behind the land downgrade (#3233).
 *
 * Two checks, cheapest first, both from measurement rather than guess
 * (`we:agent-memory-src/workflow-cloud-vm-github-api-boundary.md`). A cloud VM sets `GH_TOKEN` to a
 * 14-character sentinel beginning `prox` — NOT a credential, which is why `gh auth status` there says "the
 * token is invalid" and misleads anyone who reads it as a stale-token problem. So a token that is set but does
 * not look like a real one (`ghp_`/`gho_`/`ghu_`/`ghs_`/`ghr_`/`github_pat_`) answers the question outright,
 * with no subprocess. Otherwise ask `gh` itself, which is the only thing that knows about a keychain login.
 *
 * A THROW IS AN ANSWER, not an error: `gh` absent, or `gh auth status` exiting non-zero, both mean the same
 * "cannot reach the GitHub API from here" this returns `false` for.
 *
 * @param {{env?: object, exec?: Function}} [o]
 * @returns {boolean}
 */
export function hasGitHubCredential({ env = process.env, exec = execFileSync } = {}) {
  const token = String(env.GH_TOKEN || env.GITHUB_TOKEN || '').trim();
  if (token && !/^(gh[pousr]_|github_pat_)/.test(token)) return false;
  try {
    exec('gh', ['auth', 'status'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return true;
  } catch {
    return false;
  }
}

/**
 * Append the "## Independent review — <date>" section, verify it staged, commit, and then EITHER land it or
 * push it and hand back — the `recordPrepVerdict` the declaration's `record` step is shelled through.
 *
 * THE RACE GUARD (see file header). `expectedContentHash` is the hash `readPrep` captured; if the LIVE file's
 * hash has since moved, this makes NO write and returns `{recorded: false, aborted: true, reason}` — the
 * deterministic stand-in for the `confirm` step this operation deliberately does not have.
 *
 * ALWAYS PUSHES; THE CREDENTIAL DOWNGRADE DECIDES HOW (#3233). The effective land is resolved at step 0,
 * before any mutation: `land` (default true) AND `hasCredential()`. With a credential the commit goes to
 * `we:scripts/pr-land.mjs`, which performs the push itself — so the default path pushes exactly ONCE, through
 * the same transport as before this flag existed. Without one — a cloud VM, where git transport is
 * credentialed and the GitHub API is not — the run DOWNGRADES rather than refusing: it pushes the single
 * commit to `lane/review-prep-<item>-<sha8>` by sha and returns `{landed: false, reason: 'no-credential',
 * followUp}`. `land: false` takes the same push-only branch without the probe's verdict mattering, and a
 * FAILED push returns `{pushed: false, followUp}` with the local commit intact rather than throwing. Deciding
 * this first is what turns a fail-halfway into a hand-off: the verdict is always somewhere durable, and the
 * caller is always told what is still owed.
 *
 * CLEAN VS PARKED still chooses pr-land's disposition on the landing branch. A clean review
 * (`isCleanPrepReview`) is handed `--label-on-green`; anything else is `--park=review:pending` (pr-land's OWN
 * `PARK_LABELS`, #2622 — `review:changes` is `review-pr`'s DIFFERENT label vocabulary and `resolveParkLabel`
 * refuses anything outside `review:human`/`review:pending`; a real live-fire run against #1637 hit that
 * refusal, caught it as INDETERMINATE post-commit, and is why this is `review:pending` now) so a person sees
 * the corrections before it lands. `clean` is returned on EVERY branch, including the push-only ones: it is
 * computed from the verdict itself, not from what the land did, and the caller holding a `followUp` is
 * exactly the one who needs to know which disposition that follow-up will ask for.
 *
 * @param {{item: string, repo: string, cwd?: string, confidence: string,
 *   risks?: Array<{risk: string, addressed: boolean, note?: string}>, corrections?: string[],
 *   fixApplied?: boolean, note?: string, actor?: string, land?: boolean,
 *   expectedContentHash?: string|null, exec?: Function, runNode?: Function,
 *   hasCredential?: () => boolean, readStaged?: (o: {path: string, cwd: string}) => string}} o
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
  land = true,
  remote = 'origin',
  expectedContentHash = null,
  exec = execFileIn(cwd),
  runNode = (argv, opts) => execFileSync(process.execPath, argv, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, ...opts }),
  hasCredential = hasGitHubCredential,
  readStaged = readStagedCard,
} = {}) {
  // ── STEP 0 — RESOLVE THE EFFECTIVE LAND, BEFORE ANY MUTATION. ───────────────────────────────────────────
  // `land = true` in the destructuring above is the SECOND of the two read sites the `?? true` in
  // `we:scripts/operations/review-prep.mjs` covers: the engine materialises a step's effect payloads and only
  // then suspends, so a run suspended `awaiting-effect` before #3233 carries a payload with no `land` key at
  // all. Absent must mean today's behaviour here too, or the coalesce upstream is only half a migration.
  //
  // Deciding this FIRST is the whole point of the card: today's failure is a run that mutates the caller's
  // branch and THEN discovers it cannot open a PR, stranding the verdict. Downgrading — never refusing —
  // is what keeps the credential-less population (a cloud VM) served rather than blocked.
  const wantsLand = land !== false;
  const credentialed = wantsLand ? hasCredential({ cwd }) : false;
  const effectiveLand = wantsLand && credentialed;
  const downgraded = wantsLand && !credentialed;

  const path = resolveCardPath({ item, cwd });
  const raw = readFileSync(path, 'utf8');
  const liveHash = contentHashOf(raw);

  // ── STEP 1 — THE RACE GUARD — zero effects, not a question (see file header). ────────────────────────────
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

  // ── STEPS 2-3 — RENDER AND WRITE. ───────────────────────────────────────────────────────────────────────
  const date = todayIso();
  const section = renderPrepReviewSection({ date, confidence, risks, corrections, fixApplied, note });
  const updated = `${raw.replace(/\s+$/, '')}\n\n${section}\n`;
  writeFileSync(path, updated, 'utf8');

  const relPath = path.startsWith(cwd) ? path.slice(cwd.length + 1) : path;
  const clean = isCleanPrepReview({ confidence, risks, fixApplied });
  const commitMessage = clean
    ? `review-prep: independent review of #${item} — confidence ${confidence}, no corrections owed`
    : `review-prep: independent review of #${item} — confidence ${confidence}, corrections recorded`;

  // ── STEP 4 — STAGE. ─────────────────────────────────────────────────────────────────────────────────────
  try {
    stageCard({ path: relPath, exec, cwd });
  } catch (e) {
    throw notApplied(`review-prep-io: git add failed before any commit — ${String(e?.message ?? e)}`, { path });
  }

  // ── STEP 5 — VERIFY THE STAGED BYTES, not an in-memory re-read. ─────────────────────────────────────────
  // The index is what the commit will contain, so checking it closes the window a working-tree re-read leaves
  // open (a concurrent writer landing between the read-back and `git add`). Absent ⇒ a determinate third
  // outcome, never a throw: a throw is indistinguishable from a crash and the engine's replay rules would
  // treat it as UNKNOWN. Nothing is committed and nothing is pushed on this branch.
  let staged;
  try {
    staged = String(readStaged({ path: relPath, cwd }));
  } catch (e) {
    throw notApplied(`review-prep-io: could not read the staged card before committing — ${String(e?.message ?? e)}`, { path });
  }
  if (!staged.includes(section)) {
    return {
      recorded: false,
      verified: false,
      aborted: false,
      path,
      reason:
        `review-prep-io: the review section is NOT in the staged content of ${relPath} — the write did not land `
        + '(a concurrent edit is the observed cause). Nothing was committed and nothing was pushed; re-running '
        + 'the operation is safe.',
    };
  }

  // ── STEP 6 — COMMIT. ────────────────────────────────────────────────────────────────────────────────────
  let sha;
  try {
    sha = commitStagedCard({ path: relPath, message: commitMessage, exec, cwd });
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
  //
  // WRITTEN ON EVERY BRANCH, not only the landing one: `followUp` names this file, and a hand-back whose argv
  // points at a body that was never staged is not a hand-back.
  const prBody = `Independent review of #${item}, recorded through the declared \`review-prep\` operation.\n\n${section}`;
  const bodyDir = join(cwd, '.operations', 'review-prep');
  mkdirSync(bodyDir, { recursive: true });
  const bodyPath = join(bodyDir, `${String(item).replace(/[^\w.-]+/g, '-')}-${sha.slice(0, 8)}-body.md`);
  writeFileSync(bodyPath, prBody, 'utf8');
  const landArgv = [
    join(cwd, 'scripts', 'pr-land.mjs'),
    `--ref=${ref}`,
    `--sha=${sha}`,
    `--base=main`,
    `--body-file=${bodyPath}`,
    clean ? '--label-on-green' : '--park=review:pending',
    '--json',
  ];

  // ── STEP 7 — PUSH-ONLY (exclusive with step 8). ─────────────────────────────────────────────────────────
  // THE REFSPEC NAMES THE SHA, never a branch tip. Pushing `HEAD` or a branch name is what put six unrelated
  // commits on one item's ref: the ref then carries whatever the caller's branch had accumulated, misattributed
  // to whichever item happened to be last. `<sha>:refs/heads/<ref>` carries exactly this review's one commit.
  if (!effectiveLand) {
    const followUp = ['node', ...landArgv];
    let pushed = true;
    let pushError;
    try {
      exec('git', ['push', remote, `${sha}:refs/heads/${ref}`], { cwd, encoding: 'utf8' });
    } catch (e) {
      // NOT a throw. The commit stands, so the verdict is recoverable; what is owed is the push, and saying so
      // in the returned shape is what makes it recoverable BY the caller rather than by an archaeologist.
      pushed = false;
      pushError = String(e?.message ?? e).split('\n').filter(Boolean).pop();
    }
    return {
      recorded: true,
      aborted: false,
      path,
      actor,
      verified: true,
      sha,
      ref,
      pushed,
      landed: false,
      clean,
      followUp,
      ...(downgraded ? { reason: 'no-credential' } : {}),
      ...(pushed ? {} : { pushError }),
    };
  }

  // ── STEP 8 — LAND. pr-land does its OWN push, so this path pushes exactly once. ──────────────────────────
  let landResult;
  try {
    const stdout = String(runNode(landArgv, { cwd }));
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
    actor,
    verified: true,
    sha,
    ref,
    pushed: true,
    landed: true,
    clean,
    disposition: clean ? 'landed' : 'parked',
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
