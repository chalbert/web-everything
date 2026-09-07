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
 * says). `recordPrepVerdict` appends a review section, commits, and ALWAYS PUSHES that one commit — the push
 * needs only the git transport, which is credentialed on every host including a cloud VM (#3233;
 * `we:agent-memory-src/workflow-cloud-vm-github-api-boundary.md`). Opening/landing the PR is a SEPARATE leg,
 * through the SAME `we:scripts/pr-land.mjs` transport every other AI-edit path in this repo lands through
 * (#2138) — it does not reimplement `git push` / `gh pr create` sequencing, the same "shell the single home, do
 * not re-derive it" discipline `we:scripts/operations/review-pr-io.mjs` documents for `review-set-label.mjs`.
 * That leg needs the GitHub API, which a cloud VM cannot reach, so it is DOWNGRADED to push-only there (a
 * credential probe decides this up front, before any mutation) and the result carries a `followUp` — the
 * argv a credentialed host should run to finish the land — instead of silently stranding the pushed verdict.
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
 * Commit an ALREADY-STAGED card. NO pathspec on the `commit` itself — deliberately, not an oversight: `git
 * commit -- <path>` re-reads `<path>` from the WORKING TREE at commit time (pathspec-qualified commit
 * bypasses the index), which would silently undo the whole point of #3230's post-stage verify — a writer
 * racing the working tree between the verify read and this call would get ITS bytes committed even though
 * the index (what was actually verified) held the good ones. A bare `git commit` has no such reopening: it
 * commits exactly the index, which at this point holds only this run's own staged add (never `git add -A` —
 * this repo's own git-hygiene rule; a review that accidentally swept up an unrelated dirty file would be its
 * own defect class). Returns the new commit's full SHA.
 * @param {{message: string, exec: Function, cwd: string}} o
 */
function commitStagedCard({ message, exec, cwd }) {
  exec('git', ['commit', '-m', message], { cwd, encoding: 'utf8' });
  return String(exec('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' })).trim();
}

/**
 * Whether the rendered review section actually landed in `content` — the post-write read-back predicate
 * card #3230 checks, extracted so a test can assert on it directly rather than only through the full
 * `recordPrepVerdict` path.
 * @param {string} content
 * @param {string} section
 * @returns {boolean}
 */
export function sectionRecorded(content, section) {
  return typeof content === 'string' && typeof section === 'string' && section.length > 0 && content.includes(section);
}

/**
 * Whether a REAL GitHub credential is usable in this process — #3233's step-0 probe, decided before any
 * mutation, by shelling `gh auth status` (the exact probe the memory note documents). A laptop with `gh`
 * authenticated (via keychain or a real env token) exits 0. A cloud VM's proxy injects a 14-char `prox…`
 * sentinel into `GH_TOKEN`, which is not a credential at all — `gh auth status` calls it "invalid" (misleadingly:
 * it was never a token, not a stale one) and exits non-zero. See
 * `we:agent-memory-src/workflow-cloud-vm-github-api-boundary.md` for the measured boundary this mirrors. A bare
 * env-var shape check would wrongly downgrade every laptop whose `gh` credential lives outside `GH_TOKEN` (the
 * common case), which is exactly the "every laptop caller keeps exactly today's behaviour" ruling this must not
 * violate — so this shells the real probe rather than guessing from env. Exported (and separately injectable as
 * `hasCredential`) so a test can stub a credential-less (or -full) host without touching a real `gh` process.
 * @param {{cwd?: string}} [o]
 * @returns {boolean}
 */
export function defaultHasCredential({ cwd = REPO_ROOT } = {}) {
  try {
    execFileSync('gh', ['auth', 'status'], { cwd, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * The exact follow-up argv a credentialed host should run to finish landing a pushed-but-not-landed verdict
 * (#3233) — a returned field, not advice in a log line, so a caller can act on it rather than the ref going
 * undiscovered like the 21 orphans this card exists to stop.
 * @param {{ref: string, sha: string, bodyPath: string, cwd: string}} o
 * @returns {string[]}
 */
function buildFollowUp({ ref, sha, bodyPath, cwd }) {
  const bodyRel = bodyPath.startsWith(cwd) ? bodyPath.slice(cwd.length + 1) : bodyPath;
  // `--no-require-verified` is spelled out explicitly (never left implicit) so this string DECLARES ITS POSTURE
  // per #3321's caller sweep (`we:scripts/__tests__/lane-verify.test.mjs`) on its own — it is handed to a
  // DIFFERENT host to run at an unknown LATER time, so unlike the `argv` array a few lines below it, it cannot
  // lean on an adjacent verify-lane run in THIS source text to prove the gate means anything (source adjacency
  // is a proxy for "the verify precedes the land in the SAME run", which does not hold across a hand-off to a
  // separate session). The opt-out is also the honest posture here: `verified` (this run's own content check,
  // above) already vetted the pushed commit; there is no fresh HEAD to gate a second time.
  return [
    `node scripts/pr-land.mjs --ref=${ref} --sha=${sha} --base=main --body-file=${bodyRel} --label-on-green --no-require-verified`,
  ];
}

/**
 * Append the "## Independent review — <date>" section, commit, and land or park — the `recordPrepVerdict` the
 * declaration's `record` step is shelled through.
 *
 * THE RACE GUARD (see file header). `expectedContentHash` is the hash `readPrep` captured; if the LIVE file's
 * hash has since moved, this makes NO write and returns `{recorded: false, aborted: true, reason}` — the
 * deterministic stand-in for the `confirm` step this operation deliberately does not have. That guard is
 * PRE-write — it cannot see a write that is issued but does not land.
 *
 * THE POST-WRITE VERIFY (#3230). After writing, this STAGES the card, then reads back the STAGED bytes
 * (`readStagedContent`, default `git show :<path>` — the index, never the working tree) and checks the
 * rendered section actually landed there. Verifying the index rather than the working tree means the bytes
 * checked are exactly the bytes about to be committed — a second writer racing the working tree AFTER the
 * stage cannot fool this check, AND (see `commitStagedCard`) the commit itself never re-reads the working
 * tree either, so the bytes verified are the bytes that land. Absent ⇒ this returns `{recorded: false,
 * verified: false, path}` — a determinate THIRD outcome, never a throw (a throw would be indistinguishable
 * from a crash and get replayed as UNKNOWN) — and skips the commit and the `pr-land` shell entirely: nothing
 * further happens on a write that did not land. Present ⇒ commit proceeds and the success return carries
 * `verified: true`.
 *
 * `land` (#3233, default `true`) DECIDES WHETHER `pr-land.mjs` RUNS AT ALL — it does not choose land-vs-park
 * (that is `isCleanPrepReview`, unconditional). STEP 0, before any mutation: the effective land is the
 * requested `land` AND a GitHub credential being usable (`hasCredential`, default shells `gh auth status` —
 * see {@link defaultHasCredential}). No credential downgrades the request to push-only with `reason:
 * 'no-credential'`; an explicit `land: false` takes the same push-only path with no reason (nothing was
 * downgraded — it was asked for).
 *
 * EFFECTIVE LAND: a clean review (`isCleanPrepReview`) is committed and handed to
 * `we:scripts/pr-land.mjs --label-on-green` — the SAME transport every AI-edit path in this repo lands through
 * (#2138), so this operation adds no second way to reach `main`. Anything else is parked `--park=review:pending`
 * (pr-land's OWN `PARK_LABELS`, #2622 — `review:changes` is `review-pr`'s DIFFERENT label vocabulary and
 * `resolveParkLabel` refuses anything outside `review:human`/`review:pending`; a real live-fire run against
 * #1637 hit this refusal, caught it as INDETERMINATE post-commit, and is why this is `review:pending` now, not
 * `review:changes` — a prep review parks for a first LOOK, it is not `review:human`'s gate-self ceremony) so a
 * person sees the corrections before it lands. Returns `{..., pushed: true, landed: true, disposition, land}`
 * (`land` here is `pr-land.mjs`'s own JSON result, unrelated to the `land` INPUT flag of the same name).
 *
 * NOT EFFECTIVE LAND (downgraded or explicit `land: false`): pushes this ONE commit — never the caller's
 * accumulated branch — to `lane/review-prep-<item>-<sha8>` and returns `{..., pushed, landed: false,
 * followUp}` with no `disposition`/`land` (pr-land was never shelled). `followUp` is the exact argv a
 * credentialed host should run to finish the land — a returned field, not a log line, so the pushed verdict
 * is a hand-off rather than an orphan. A failed push still returns determinately: `pushed: false`, the local
 * commit intact, `followUp` owed — never a throw (see the race-guard rationale above for why).
 *
 * @param {{item: string, repo: string, cwd?: string, confidence: string,
 *   risks?: Array<{risk: string, addressed: boolean, note?: string}>, corrections?: string[],
 *   fixApplied?: boolean, note?: string, actor?: string, land?: boolean, expectedContentHash?: string|null,
 *   exec?: Function, runNode?: Function, readStagedContent?: (relPath: string) => string,
 *   hasCredential?: (env?: NodeJS.ProcessEnv) => boolean}} o
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
  expectedContentHash = null,
  exec = execFileIn(cwd),
  runNode = (argv, opts) => execFileSync(process.execPath, argv, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, ...opts }),
  readStagedContent = (relPath) => exec('git', ['show', `:${relPath}`], { cwd, encoding: 'utf8' }),
  hasCredential = () => defaultHasCredential({ cwd }),
} = {}) {
  // ── STEP 0 — resolve the EFFECTIVE `land`, before any mutation (#3233). requested `land` AND a credential
  //    being present; no credential downgrades to push-only rather than refusing (the cloud-VM population this
  //    exists for gets served, not blocked). An explicit `land: false` needs no probe and carries no reason —
  //    nothing was downgraded, it was asked for. ─────────────────────────────────────────────────────────────
  let effectiveLand = Boolean(land);
  let downgradeReason;
  if (effectiveLand && !hasCredential()) {
    effectiveLand = false;
    downgradeReason = 'no-credential';
  }

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

  try {
    exec('git', ['add', '--', relPath], { cwd });
  } catch (e) {
    throw notApplied(`review-prep-io: git add failed before any commit — ${String(e?.message ?? e)}`, { path });
  }

  // ── VERIFY THE STAGED WRITE (#3230) — the INDEX, not the working tree; see file header. ──────────────────
  let stagedContent;
  try {
    stagedContent = String(readStagedContent(relPath));
  } catch (e) {
    throw notApplied(`review-prep-io: reading the staged content failed before any commit — ${String(e?.message ?? e)}`, { path });
  }
  if (!sectionRecorded(stagedContent, section)) {
    return {
      recorded: false,
      verified: false,
      path,
      reason:
        `review-prep-io: the staged content at ${path} does not contain the rendered review section — the `
        + 'write did not land (a concurrent writer likely raced it after the read). No commit, no push: '
        + 're-run the operation to retry.',
    };
  }

  const clean = isCleanPrepReview({ confidence, risks, fixApplied });
  const commitMessage = clean
    ? `review-prep: independent review of #${item} — confidence ${confidence}, no corrections owed`
    : `review-prep: independent review of #${item} — confidence ${confidence}, corrections recorded`;

  let sha;
  try {
    sha = commitStagedCard({ message: commitMessage, exec, cwd });
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

  // ── NOT LANDING (#3233) — push ONLY this commit, onto a ref named for the item, and hand back the exact
  //    follow-up. Never both this AND the pr-land shell below (mutually exclusive with the branch past it). ──
  if (!effectiveLand) {
    const followUp = buildFollowUp({ ref, sha, bodyPath, cwd });
    const base = {
      recorded: true, verified: true, aborted: false, path, sha, ref, clean, actor, followUp,
      ...(downgradeReason ? { reason: downgradeReason } : {}),
    };
    try {
      exec('git', ['push', 'origin', `${sha}:refs/heads/${ref}`], { cwd, encoding: 'utf8' });
    } catch {
      // Determinate, not a throw — the commit stands and the push is owed and reported (see file header).
      return { ...base, pushed: false, landed: false };
    }
    return { ...base, pushed: true, landed: false };
  }

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
    verified: true,
    aborted: false,
    path,
    sha,
    ref,
    clean,
    disposition: clean ? 'landed' : 'parked',
    actor,
    pushed: true,
    landed: true,
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
