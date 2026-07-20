#!/usr/bin/env node
/**
 * merge-ai-prs.mjs — sweep OPEN pull requests and merge the AI-generated ones that are safe to land.
 *
 * SOLE WRITER TO MAIN (#2290). This drain is now the ONLY route that runs `gh pr merge` — /pr (pr-land) and
 * /finish (lane-resume) stop merging directly and instead enqueue (`ready-to-merge`) + trigger a single-couple
 * drain pass here (`--only=<pr>`). The one merge call routes through the shared gate (`scripts/lib/pr-merge-gate.mjs`,
 * caller 'drain'); every other route is REJECTED by that gate unless the documented `WE_MERGE_BREAK_GLASS=1`
 * admin override is set. A single serialized writer is the prerequisite for JIT NNN numbering. Because it is the
 * sole writer, the drain also OWNS the post-land WE derived-artifact regen (#2182/#2173, `regenDerivedOnLand`):
 * after a pass that lands ≥1 WE couple it reproduces `gen:inventory` + `gen:reference-index` and commits+pushes
 * any change to main (pr-land can no longer do this — it does not merge). Reuses lane-drain's `DERIVED_REGEN`.
 *
 * WHY: under #2183 every producer completes by opening a ready-to-merge PR; a lander merges them. This is that
 * lander. It lists open PRs, keeps only the ones that are UNAMBIGUOUSLY AI-generated (EVERY commit co-authored
 * by Claude), and merges the ones whose required `test` check is green and that GitHub reports cleanly
 * mergeable — via the SAME self-approved, non-admin `gh pr merge` the `/pr` flow uses. It NEVER uses `--admin`,
 * never force-merges, and refuses any PR with a human-authored commit.
 *
 * CONVERGENCE (#2188 — /merge ↔ drain become ONE label-scoped lander). Bare, it sweeps EVERY qualifying AI PR
 * (the `/merge` orphan sweep). With `--label ready-to-merge` it scopes to producer-completed PRs (the F1
 * signal) — the `/drain` role. Either way it now honours cross-item `blockedBy`: each PR's `.lane-manifest.json`
 * (read off its head ref) supplies its backlog `item` + `blockedBy`, and PRs merge in a **cascade** — a PR whose
 * blocker is still an open (unlanded) PR DEFERS until that blocker merges (mirrors the lane-drain `planWatch`
 * cascade). The PR merge IS the single clear point (the label leaves with the closed PR — no `queued.json`
 * unqueue). Orphan PRs (no manifest) have no `blockedBy` → always ready, so the bare sweep is unchanged.
 *
 * SAFETY (why this is not a rubber-stamp):
 *  - AI-generated gate: a PR qualifies ONLY if every commit carries the `Co-Authored-By: Claude …` trailer
 *    (surfaced by gh as a commit author with an anthropic identity). One human commit ⇒ the PR is skipped.
 *  - Green gate: the required `test` check must be SUCCESS. A missing/failed `test` ⇒ skipped. (`cla` /
 *    `Workers Builds` are non-required and ignored, matching branch protection + the /pr contract.)
 *  - Mergeable gate: GitHub's mergeStateStatus must be CLEAN or UNSTABLE (mergeable; only non-required checks
 *    red) and mergeable == MERGEABLE. BEHIND (needs rebase), DIRTY, BLOCKED, DRAFT ⇒ skipped and reported
 *    (a BEHIND PR is left for its author / a later rebase — the sweep never force-updates someone's branch).
 *  - Non-admin merge only: `gh pr merge <n> --merge --delete-branch`. If branch protection blocks it, that
 *    is surfaced, never overridden.
 *
 * REBASE-DROP MANIFEST (#2198 — kills the "manifest lands then conflicts every other PR" wall). Every lane
 * writes `.lane-manifest.json` to the SAME repo-root path, so the first PR lands it and every OTHER open lane PR
 * then goes CONFLICTING on that one shared path (observed 2026-07-03: 1 landed, ~24 walled on the manifest
 * alone while real code merged clean). Before merging, a certified + green PR that is only CONFLICTING/BEHIND is
 * rebuilt onto main with the manifest dropped, via pure plumbing (merge-tree → temp-index write-tree →
 * commit-tree with main as FIRST parent → push to the `lane/*` ref, NO checkout — guard-safe). A real
 * (non-manifest) conflict is left as a skip for a human. The rebuilt tip re-runs `test`, so it lands on a later
 * watch pass; that is expected progress, not a merge failure. Disable with `--no-rebase-drop`. (Shared helper:
 * `scripts/lib/rebase-drop-manifest.mjs`, reused by `scripts/lane-resume.mjs land`.)
 *
 * SAFE-CONTENT REBASE-DROP (#2371 — widens the above beyond the manifest-only case). When the manifest resolver
 * skips a candidate with a REAL (non-manifest) conflict, it is retried with `scripts/lib/rebase-drop-content.mjs`:
 * if EVERY conflicting hunk in EVERY conflicting path is non-overlapping (the two sides changed disjoint base-
 * line ranges — e.g. two `/slice` PRs each merely appending their own verdict to the same report file), the tip
 * is rebuilt with the safe union of both sides and pushed, same no-checkout plumbing, same "re-runs `test` before
 * it lands" gate. Any genuinely overlapping hunk is left, as before, for `/finish` — this never guesses on
 * semantic divergence. Disable with `--no-content-rebase-drop` (or `--no-rebase-drop`, which disables both).
 *
 * WATCH (#2194 — /drain converges onto THIS lander). Bare, this is ONE cascade pass (`/drain`). With `--watch`
 * it becomes the long-lived monitor (`/drain watch`): it re-sweeps the labelled PRs on a fixed `--interval=N`
 * (default 30s), landing each the instant it becomes eligible (green + mergeable), in the same blockedBy
 * cascade order — so a producer that opens a ready-to-merge PR while the watch runs gets it landed on the next
 * poll. `--max-idle=N` bounds the follow: after N consecutive passes that merge nothing AND have nothing left
 * deferred, the watch exits 0 (an unbounded `--watch` runs until Ctrl-C). This retires the `queued.json` poll —
 * the label lander is now the single collection point for ALL producer output (`/workflow`, `/pr`, solo lanes).
 *
 * Usage:
 *   node scripts/merge-ai-prs.mjs --dry-run            # list every open PR + the merge/skip verdict, merge NOTHING
 *   node scripts/merge-ai-prs.mjs --dry-run --json     # machine-readable verdicts
 *   node scripts/merge-ai-prs.mjs                       # merge every qualifying AI PR (green + cleanly mergeable)
 *   node scripts/merge-ai-prs.mjs --pr=12               # consider ONLY PR #12 (still subject to every gate)
 *   node scripts/merge-ai-prs.mjs --only=12 --label=ready-to-merge --this-repo # #2290 single-couple FAST DRAIN (what /pr + /finish shell to stay instant)
 *   node scripts/merge-ai-prs.mjs --base=main           # restrict to PRs targeting <base> (default: any)
 *   node scripts/merge-ai-prs.mjs --label=ready-to-merge # the /drain role: scope to producer-completed PRs, merge in blockedBy order
 *   node scripts/merge-ai-prs.mjs --label=ready-to-merge --dry-run # print the blockedBy-ordered merge plan, merge NOTHING
 *   node scripts/merge-ai-prs.mjs --label=ready-to-merge --watch --interval=30 # the /drain-watch monitor: poll + land as PRs go green (--max-idle=N bounds it)
 *   node scripts/merge-ai-prs.mjs --label=ready-to-merge --watch --until-batches-idle  # self-terminate when the active batch is fully delivered (#2330; reads the active-progress feed — --batch-feed=<path> to point at the primary's copy)
 *   node scripts/merge-ai-prs.mjs --label=ready-to-merge --watch --until-batches-idle --max-runtime-min=60  # the push-at-close drain: a wall-clock lifetime cap (#2395); the whole-process lease is held automatically (#2449)
 *   node scripts/merge-ai-prs.mjs --label=ready-to-merge --under-lease=<owner>  # #2449 a resident-daemon child pass: run WITHOUT acquiring — the declared live holder (the daemon) owns the lease + heartbeat
 *   node scripts/merge-ai-prs.mjs --label=ready-to-merge --no-drain-lease  # escape hatch: skip the whole-process lease entirely (tests / break-glass)
 *   node scripts/merge-ai-prs.mjs --label=ready-to-merge # #2257/#2287 — the ONE /drain sweeps ALL 3 constellation repos BY DEFAULT (WE+frontierui+plateau-app), one global blockedBy cascade
 *   node scripts/merge-ai-prs.mjs --label=ready-to-merge --this-repo # #2287 — opt OUT: scope to the cwd repo only (a deliberately single-repo drain)
 *   node scripts/merge-ai-prs.mjs --repos=chalbert/frontierui,chalbert/plateau-app # sweep an explicit repo set (comma-separated owner/name slugs)
 *
 * MULTI-REPO (#2257/#2287 — the single /drain lander sweeps all 3 constellation repos BY DEFAULT). Neither
 * `--repos` nor `--this-repo` → the constellation (self's owner × web-everything/frontierui/plateau-app, self
 * first); `--repos=a,b` is an explicit set; `--this-repo` scopes to the cwd repo only. Every `gh pr list/view/edit/merge` is
 * `--repo`-scoped and candidates from ALL repos merge in ONE global `blockedBy` cascade — REQUIRED, not
 * optional: the backlog is WE-global, so a frontierui PR can be `blockedBy` a WE item, and independent per-repo
 * drains could not sequence that. A remote-repo PR reads its manifest via the GitHub API (never a local clone).
 * REBASE-DROP (#2198) still needs pure LOCAL git plumbing (merge-tree/commit-tree/push) — for the local clone's
 * own repo it runs in `process.cwd()`; for a remote constellation repo (frontierui/plateau-app) it routes
 * through that repo's SIBLING clone (`../frontierui`, `../plateau-app`, provisioned at the lane-pool root —
 * #2263/#2303) when one exists, so a CONFLICTING/BEHIND non-local lane tip can be rebuilt too. No sibling clone
 * provisioned ⇒ left for its author, unchanged. Landing a frontierui/plateau PR still needs that repo's own
 * required `test` check + branch protection (#2242/#2243/#2246) or GitHub blocks the merge.
 *
 * Exit codes: 0 = swept (merged 0+ qualifying PRs, none failed); 2 = at least one merge attempt FAILED
 * (surfaced); 3 = bad input / `gh` unavailable.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, realpathSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, join, dirname } from 'node:path';
import { rebaseDropManifest, gitRunner } from './lib/rebase-drop-manifest.mjs';
import { rebaseDropContent } from './lib/rebase-drop-content.mjs';
import { healNnnCollision } from './lib/nnn-collision-heal.mjs';
import { scoreEscalation, decideReviewGate, REVIEW_LABELS, REVIEW_LABEL_META, buildEscalationReasonBlock, bodyHasEscalationReason, shouldApplyReviewLabel, hasUnclearedReviewLabel } from './lib/review-escalation.mjs';
import { emptyBaselineState, parseBaselineState, serializeBaselineState, getBaseline, recordBaseline, diffBaseline } from './lib/review-baseline-state.mjs';
import { mergePr, hasNonEmptyBody } from './lib/pr-merge-gate.mjs';
import { DERIVED_REGEN, DERIVED_OUTPUT_PATHS, numberPendingHashes, isPostLandTreeDirty, landedNumberFor } from './lane-drain.mjs';
import { isHash } from './backlog/id.mjs'; // #2393 — a stackParent hash's bornAs-on-main lookup is hash-only
import { withNumberingLock, acquireDrainLease, heartbeatDrainLease, releaseDrainLease, drainLeaseStatus, drainOwner, DRAIN_LOCK_ROOT } from './readiness/drain-lock.mjs'; // #2391 — numbering-critical-section mutex + (#2395) whole-process drain lease a `--watch` monitor holds for its lifetime
import { findDuplicateIds, summarizeDuplicates } from './lib/duplicate-id-tripwire.mjs';
import { extractManifestFromBody, manifestAuditLine, asItemId, repoKeyFromSlug, manifestBaseForRepo } from './readiness/lane-manifest.mjs';
// #2399 — the ONE remote-manifest `gh api` argv, shared with `/finish` (lane-resume) so the two readers never
// drift. Re-exported to keep this file's public surface (and its tests' import site) stable.
import { remoteManifestApiArgs } from './lib/remote-manifest.mjs';
export { remoteManifestApiArgs };

// #2414 — the local, machine-scoped FIRST-DRAIN-SIGHTING manifest baseline the land-time tamper gate diffs a
// landing PR against. Covers "edits after the drain first sees the ready-to-merge PR" (post-queue), NOT
// everything since review. CACHE-LOSS is NOT a benign fail-safe: losing this file makes the gate fail OPEN AND
// re-capture the current (possibly-tampered) body as the new trusted baseline — a durable bypass if the loss
// races a tamper (see review-baseline-state.mjs's cache-loss residual). Co-located with the park-state cache;
// resolved against cwd.
const REVIEW_BASELINE_STATE_PATH = resolve(process.cwd(), '.claude/skills/drain/review-baseline-state.json');

const argv = process.argv.slice(2);
const flags = {};
for (const a of argv) { const m = a.match(/^--([^=]+)(?:=(.*))?$/); if (m) flags[m[1]] = m[2] === undefined ? true : m[2]; }

// ── PURE helpers (unit-tested in scripts/__tests__/merge-ai-prs.test.mjs) ──────────────────────────────

/**
 * #2423 — read EVERY occurrence of a REPEATABLE `--<name>` flag off the raw argv. The last-write-wins `flags`
 * object above (`flags[name] = …` in a loop) keeps ONLY the final occurrence, so a flag a caller may legitimately
 * pass more than once (`--no-review-escalation=12 --no-review-escalation=34`) would silently drop all but the
 * last. This collects them in order. A BARE occurrence (`--<name>` with no `=value`) is recorded as `true`; a
 * valued one (`--<name>=v`) as its raw string `v`. Pure.
 * @param {string[]} argv - the raw `process.argv.slice(2)` (or a test's stand-in)
 * @param {string} name - the flag name WITHOUT the leading `--`
 * @returns {Array<true|string>}
 */
export function collectFlagOccurrences(argv, name) {
  const out = [];
  const prefix = `--${name}`;
  for (const a of Array.isArray(argv) ? argv : []) {
    if (a === prefix) { out.push(true); continue; }
    if (typeof a === 'string' && a.startsWith(`${prefix}=`)) out.push(a.slice(prefix.length + 1));
  }
  return out;
}

/**
 * #2423 — parse the `--no-review-escalation` flag into a per-PR relief plan. The flag is REPEATABLE and each
 * value is comma-separated, so `--no-review-escalation=12,34 --no-review-escalation=56` scopes relief to PRs
 * 12/34/56. A BARE `--no-review-escalation` (no value, or an empty value) still means the LEGACY pass-wide
 * waiver (`passWide: true`) — the whole escalation rubric off for the pass. Pure.
 *   - `passWide` — true iff any BARE occurrence is present (the deprecated pass-wide form).
 *   - `prs`      — the de-duplicated positive PR numbers named across every valued occurrence.
 * A `#`-prefixed or whitespace-padded number is tolerated; a non-numeric/≤0 token is dropped.
 * @param {string[]} argv
 * @param {string} [name='no-review-escalation']
 * @returns {{passWide: boolean, prs: number[]}}
 */
export function parseNoReviewEscalation(argv, name = 'no-review-escalation') {
  let passWide = false;
  const prs = [];
  for (const occ of collectFlagOccurrences(argv, name)) {
    if (occ === true || String(occ).trim() === '') { passWide = true; continue; } // a BARE flag → legacy pass-wide waiver
    for (const part of String(occ).split(',')) {
      const t = part.trim().replace(/^#/, '');
      if (!t) continue;
      const n = Number(t);
      if (Number.isInteger(n) && n > 0) prs.push(n);
    }
  }
  return { passWide, prs: [...new Set(prs)] };
}

/**
 * #2423 — the per-PR relief decision. Given a candidate's FRESH `decideReviewGate` verdict and whether this PR
 * was named in `--no-review-escalation=<pr#>`, decide whether to WAIVE its park to a merge. Pure. Relief is
 * DELIBERATELY narrow: it waives ONLY an agent-reviewable `review:pending` park (`action:'park'`,
 * `applyLabel:review:pending`, `humanRequired:false`). It NEVER waives:
 *   - `review:human` (a gate-self/statute edit — human-only, never waivable by an operator flag, #2285), nor
 *   - `review:changes` (`action:'wait-author'` — the reviewer actively rejected the diff).
 * A non-relieved PR, or a gate that already says `merge`, is never touched. Because runCli keeps the escalation
 * rubric LIVE for a scoped `=<pr#>` (only a BARE flag turns it off pass-wide), a fresh gate-self verdict on the
 * named PR still surfaces here as `humanRequired` and is correctly refused.
 * @param {{action?:string, applyLabel?:string, humanRequired?:boolean}} gate - a `decideReviewGate` verdict
 * @param {{relieved?:boolean}} [o]
 * @returns {{waive:boolean, reason?:string}}
 */
export function applyEscalationRelief(gate, { relieved = false } = {}) {
  if (!relieved || !gate) return { waive: false };
  if (gate.action !== 'park') return { waive: false }; // merge / wait-author (review:changes) — nothing waivable
  if (gate.humanRequired || gate.applyLabel === REVIEW_LABELS.human) {
    return { waive: false, reason: 'review:human is human-only — never waivable by a per-PR relief valve (#2285)' };
  }
  if (gate.applyLabel !== REVIEW_LABELS.pending) return { waive: false };
  return { waive: true, reason: 'per-PR --no-review-escalation relief — agent-reviewable review:pending waived to a merge (#2423)' };
}

/** An anthropic/Claude identity on a commit author (the `Co-Authored-By: Claude …` trailer gh surfaces as an
 *  author). Matches the name "Claude" or an anthropic email — the stamp every commit in an AI session carries. */
export function isAiAuthor(author) {
  if (!author) return false;
  const name = String(author.name || '').toLowerCase();
  const email = String(author.email || '').toLowerCase();
  return /\bclaude\b/.test(name) || email.includes('anthropic.com') || email.includes('noreply@anthropic');
}

/**
 * Locate the user's primary checkout to ff-sync after a land, INDEPENDENT of how the drain clone was made
 * (#xwokc1n). Resolution order: an explicit `--primary=<path>` (wins), else the `WE_PRIMARY` env, else the
 * clone's git alternates file (`.git/objects/info/alternates` → `<primary>/.git/objects` → `<primary>`) — the
 * legacy `git clone --reference/--shared` case. A `--local` clone (the drain skill's own provisioning) has NO
 * alternates, so without the flag/env the old alternates-only finder silently returned null and the primary
 * rotted unseen (observed 75 commits behind). Returns an absolute path or null (the caller skips + logs
 * loudly). PURE except the alternates read, injected as `readAlt` for the unit test.
 */
export function resolvePrimaryPath(cwd, { flag, env } = {}, readAlt = (p) => readFileSync(p, 'utf8')) {
  if (typeof flag === 'string' && flag.trim()) return resolve(cwd, flag.trim()); // relative --primary → against cwd, not process.cwd()
  if (typeof env === 'string' && env.trim()) return resolve(cwd, env.trim());
  try {
    const alt = readAlt(resolve(cwd, '.git/objects/info/alternates')).trim().split('\n')[0];
    if (alt) return resolve(alt, '..', '..');            // <primary>/.git/objects → <primary>
  } catch { /* no alternates file → not locatable this way */ }
  return null;
}

/**
 * Decide + perform the post-land ff-sync of the user's PRIMARY checkout (#xwokc1n). PURE except the injected
 * `exec` (git spawner) and `isCwd` (self-check) — so every branch is unit-testable (the sync lived untested in
 * the CLI before). Returns `{ synced, reason, warn }`:
 *   - `synced:true`  → a pure `git pull --ff-only` succeeded.
 *   - `synced:false` → deliberately skipped; `reason` ∈ from-primary | not-located | not-a-repo | not-on-main |
 *     dirty | status-failed | diverged. `warn` gates the log: LOUD for an actionable skip (a bad `--primary`,
 *     a dirty/diverged primary), QUIET for the benign ones (cwd IS the primary — already ff-synced by the
 *     `localSynced` pull above; or unlocatable with NO flag/env hint, the common single-checkout run).
 *
 * Two review fixes (#xwokc1n, PR #202) baked in:
 *   1. The dirty guard uses `--untracked-files=no` — only TRACKED uncommitted work blocks the sync. Untracked
 *      scratch/build cruft (near-universal on a real primary) must NOT perpetually skip it (that would re-rot
 *      the very thing this exists to fix); `git pull --ff-only` is already safe against clobbering untracked
 *      files (it aborts, caught as `diverged`). The strand being guarded against was an autostash-pop over
 *      TRACKED work — untracked files were never the hazard.
 *   2. `not-located` warns ONLY when a `--primary`/`WE_PRIMARY` hint was given but resolved to nothing (a
 *      typo, worth shouting about). With NO hint, cwd is almost certainly the primary itself (already synced),
 *      so it stays quiet instead of nagging "pass --primary" on every single-checkout land.
 * No `--autostash` anywhere (the 2026-07-03 strand). Best-effort; the caller never fails a land on this.
 */
export function syncPrimaryOnLand({ exec, primary, hinted = false, isCwd = () => false }) {
  if (!primary) return { synced: false, reason: 'not-located', warn: !!hinted };
  try { if (isCwd(primary)) return { synced: false, reason: 'from-primary', warn: false }; } catch { return { synced: false, reason: 'from-primary', warn: false }; }
  const at = (a) => String(exec(['-C', primary, ...a]) ?? '').trim();
  let branch; try { branch = at(['rev-parse', '--abbrev-ref', 'HEAD']); } catch { return { synced: false, reason: 'not-a-repo', warn: true }; }
  if (branch !== 'main') return { synced: false, reason: 'not-on-main', warn: true, branch: branch || 'unknown' };
  let dirty; try { dirty = at(['status', '--porcelain', '--untracked-files=no']); } catch { return { synced: false, reason: 'status-failed', warn: true }; }
  if (dirty) return { synced: false, reason: 'dirty', warn: true };
  try { at(['pull', '--ff-only']); return { synced: true, reason: 'synced', warn: false }; }
  catch { return { synced: false, reason: 'diverged', warn: true }; }
}

/** A commit is AI if ANY of its authors (author + Co-Authored-By co-authors) is an AI identity. */
export function isAiCommit(commit) {
  const authors = Array.isArray(commit?.authors) ? commit.authors : [];
  // Fallback: some gh versions omit co-authors from `authors` but keep the trailer in the body.
  const bodyHasTrailer = /co-authored-by:\s*claude/i.test(String(commit?.messageBody || commit?.body || ''));
  return authors.some(isAiAuthor) || bodyHasTrailer;
}

/** A mechanical integration commit (`Merge branch 'main' …` / `Merge remote-tracking …` with an EMPTY body) —
 *  what `gh pr update-branch` / a rebase-on-behind creates. It carries no authored content, so it does not
 *  count as human work and must not disqualify an otherwise-AI PR. A merge commit WITH a body, or a
 *  `Merge pull request …`, is treated as a normal (must-be-AI) commit. */
export function isMechanicalMergeCommit(commit) {
  const head = String(commit?.messageHeadline || '').trim();
  const body = String(commit?.messageBody || '').trim();
  return /^Merge (branch|remote-tracking branch) /i.test(head) && body === '';
}

/** A PR is AI-generated ONLY if — ignoring mechanical merge commits — it has ≥1 substantive commit and EVERY
 *  substantive commit is AI (one human content commit disqualifies it). */
export function isAiGeneratedPr(pr) {
  const commits = Array.isArray(pr?.commits) ? pr.commits : [];
  const substantive = commits.filter((c) => !isMechanicalMergeCommit(c));
  return substantive.length > 0 && substantive.every(isAiCommit);
}

/** Does this PR carry the given label? (#2196 producer-certification signal, e.g. `ready-to-merge`.) The gh
 *  list surfaces labels as `[{ name }]`; tolerant of a missing/odd shape. Pure. */
export function hasLabel(pr, label) {
  if (!label) return false;
  const labels = Array.isArray(pr?.labels) ? pr.labels : [];
  return labels.some((l) => (typeof l === 'string' ? l : l?.name) === label);
}

/** Is the required `test` check green on this PR's rollup? (Other checks — cla, Workers Builds — are ignored.) */
export function isRequiredCheckGreen(pr, requiredCheck = 'test') {
  const roll = Array.isArray(pr?.statusCheckRollup) ? pr.statusCheckRollup : [];
  const check = roll.find((c) => (c?.name || c?.context) === requiredCheck);
  if (!check) return false;
  const concl = String(check.conclusion || check.state || '').toUpperCase();
  return concl === 'SUCCESS';
}

/** Is the required `test` check DEFINITIVELY red (failed/cancelled/timed-out/errored) on this PR's rollup? The
 *  twin of `isRequiredCheckGreen` (#2421). A MISSING check (not yet reported) is NOT failed — it reads as
 *  in-flight (`checking`), never `ci:failed`; only a check GitHub has actually concluded red counts. */
export function isRequiredCheckFailed(pr, requiredCheck = 'test') {
  const roll = Array.isArray(pr?.statusCheckRollup) ? pr.statusCheckRollup : [];
  const check = roll.find((c) => (c?.name || c?.context) === requiredCheck);
  if (!check) return false;
  const concl = String(check.conclusion || check.state || '').toUpperCase();
  return ['FAILURE', 'ERROR', 'CANCELLED', 'TIMED_OUT', 'ACTION_REQUIRED', 'STARTUP_FAILURE'].includes(concl);
}

/**
 * #2421 — the ratified ci-lifecycle label taxonomy (#2281 Fork 2: `ci:failed` opens a deterministic `ci:*`
 * state family; `blocked` stays bare to match its bare sibling `ready-to-merge`). Keyed by the semantic state
 * name so callers never hand-spell the label string. `ready` reuses the EXISTING `ready-to-merge` label
 * (#2196/#2199) — this taxonomy does not mint a second label for the same state.
 */
export const CI_LIFECYCLE_LABELS = { checking: 'checking', failed: 'ci:failed', blocked: 'blocked', ready: 'ready-to-merge' };

/** Provisioning metadata (#2279-style single source) for the two NEW ci-lifecycle labels this ruling mints —
 *  `ready-to-merge` is minted elsewhere (pr-land.mjs, the first-applier) and deliberately NOT duplicated here. */
export const CI_LIFECYCLE_LABEL_META = {
  [CI_LIFECYCLE_LABELS.checking]: { color: 'BFD4F2', description: 'Required checks are still running — CI truth not yet known (#2281)' },
  [CI_LIFECYCLE_LABELS.failed]: { color: 'D93F0B', description: 'Required check failed — the producer must fix and re-push (#2281)' },
  [CI_LIFECYCLE_LABELS.blocked]: { color: 'D4C5F9', description: 'Waiting on a cross-item blockedBy dependency to land first (#2281)' },
};

/**
 * #2421 — the #2281 ruling's TOTAL ci-lifecycle label function, generalizing #2216's green-only
 * `reconcileGreenLabels` to every state an open, producer-owned AI PR can be in. Pure. Exactly ONE of the four
 * `CI_LIFECYCLE_LABELS` values is "the" state for any input — no state is ever left to be inferred from a
 * label's ABSENCE (the directive #2281 codifies). Precedence (checked in order, first match wins):
 *   1. `blocked`        — a manifest `blockedBy` item is still open (cross-item ordering, independent of CI).
 *   2. `ready-to-merge`  — the required check is green.
 *   3. `ci:failed`      — the required check has definitively failed/cancelled/timed-out.
 *   4. `checking`        — none of the above: checks are still in flight (the default/fallback state).
 * @param {{blocked?:boolean, checkGreen?:boolean, checkFailed?:boolean}} o
 * @returns {'blocked'|'ready-to-merge'|'ci:failed'|'checking'}
 */
export function lifecycleLabelFromCiTruth({ blocked = false, checkGreen = false, checkFailed = false } = {}) {
  if (blocked) return CI_LIFECYCLE_LABELS.blocked;
  if (checkGreen) return CI_LIFECYCLE_LABELS.ready;
  if (checkFailed) return CI_LIFECYCLE_LABELS.failed;
  return CI_LIFECYCLE_LABELS.checking;
}

/**
 * #2421 — what label add/remove calls does a caller need to reach the `desired` ci-lifecycle state? Pure.
 * Enforces "at most one of `owned` present" (the exactly-one invariant, scoped to the labels THIS caller is
 * allowed to manage — `owned`). `desired` outside `owned` is a legal no-add (e.g. `ready-to-merge`, which the
 * CLI wiring below deliberately excludes from `owned` — see the caller for why) but its `owned` siblings are
 * still cleared, so a PR that reaches that state still sheds any stale `checking`/`ci:failed`/`blocked` label.
 * @param {{currentLabels?:Array, desired:string, owned?:string[]}} o  `owned` defaults to all four states.
 * @returns {{toAdd:string[], toRemove:string[]}}
 */
export function planCiLifecycleLabelUpdate({ currentLabels = [], desired, owned = Object.values(CI_LIFECYCLE_LABELS) } = {}) {
  const has = (name) => hasLabel({ labels: currentLabels }, name);
  const toAdd = desired && owned.includes(desired) && !has(desired) ? [desired] : [];
  const toRemove = owned.filter((name) => name !== desired && has(name));
  return { toAdd, toRemove };
}

/**
 * Classify one PR into a merge/skip verdict. Pure — no gh calls. Returns
 *   { num, title, decision: 'merge'|'skip', reason, aiGenerated, certifyLabel, testGreen, state, mergeable }.
 * `decision === 'merge'` requires ALL of: producer-certified, required check green, mergeable, a landable
 * mergeStateStatus (CLEAN or UNSTABLE), and a non-empty/whitespace description (#2324). Anything else is a
 * `skip` with the first failing reason.
 *
 * PRODUCER CERTIFICATION (#2195, blockedBy #2196). "Certified" is EITHER of two independent signals:
 *   - the `trustLabel` (`ready-to-merge`) is present — the producer step (#2196: every AI-edit path applies it
 *     via the shared transport) certified the couple. This is the SOLE authorization the label lander scopes
 *     to, so a labelled PR is collected on green+mergeable ALONE — MIXED human+AI authorship is allowed (the
 *     over-strict every-commit-AI check wrongly skipped genuinely-AI PRs carrying one hand-authored commit,
 *     observed: #40/#42). Safe only because the label is exclusively producer-applied (#2196).
 *   - OR every substantive commit carries the `Co-Authored-By: Claude` trailer (`isAiGeneratedPr`) — the
 *     signal the bare `/merge` orphan sweep relies on, where NO label is present. This branch is UNCHANGED:
 *     an unlabelled mixed-authorship PR still SKIPS (strict gate preserved for the orphan sweep).
 * Pass `trustLabel: null` to force the strict every-commit gate regardless of labels.
 */
export function classifyPr(pr, { requiredCheck = 'test', trustLabel = 'ready-to-merge' } = {}) {
  const num = pr?.number;
  const title = pr?.title || '';
  const aiGenerated = isAiGeneratedPr(pr);
  const certifyLabel = hasLabel(pr, trustLabel);
  const certified = certifyLabel || aiGenerated; // #2195: the label OR the every-commit-AI trailer certifies
  const testGreen = isRequiredCheckGreen(pr, requiredCheck);
  const state = String(pr?.mergeStateStatus || '').toUpperCase();
  const mergeable = String(pr?.mergeable || '').toUpperCase();
  const landableState = state === 'CLEAN' || state === 'UNSTABLE'; // UNSTABLE = mergeable, only non-required checks red
  let decision = 'merge';
  let reason = certifyLabel ? `producer-certified (label "${trustLabel}"), required check green, cleanly mergeable` : 'AI-generated, required check green, cleanly mergeable';
  if (!certified) { decision = 'skip'; reason = `not AI-generated (a commit lacks the Co-Authored-By: Claude trailer) and no "${trustLabel}" label`; }
  else if (!testGreen) { decision = 'skip'; reason = `required check "${requiredCheck}" is not green`; }
  else if (mergeable !== 'MERGEABLE') { decision = 'skip'; reason = `not mergeable (mergeable=${mergeable || 'UNKNOWN'})`; }
  else if (!landableState) { decision = 'skip'; reason = `merge state ${state || 'UNKNOWN'} (BEHIND⇒needs rebase, DIRTY/BLOCKED/DRAFT⇒not landable) — left for its author`; }
  // #2324 — refuse to land a PR with an empty/whitespace description, same rule pr-land.mjs enforces before
  // labelling (PR #206 landed bodyless). Checked LAST so the earlier, more actionable reasons (uncertified /
  // red / unmergeable) still win when several are true at once.
  else if (!hasNonEmptyBody(pr?.body)) { decision = 'skip'; reason = 'empty/whitespace description — refusing to land it (add a real summary of what changed and why; #2324)'; }
  return { num, title, decision, reason, aiGenerated, certifyLabel, testGreen, state, mergeable };
}

/**
 * Is this SKIPPED verdict a rebase-drop-manifest candidate (#2198)? Pure. A PR that is producer-certified and
 * required-check-green but not landable ONLY because it is BEHIND/DIRTY/CONFLICTING is (almost always) blocked
 * by the shared `.lane-manifest.json` on that one repo-root path — the classic "manifest lands then conflicts
 * every other PR" wall. Such a PR is worth a `merge-tree` probe: if the only conflict is the manifest, the tip
 * is rebuilt onto main (manifest dropped) and it becomes landable. A real code conflict is left as the skip.
 * NOT a candidate: an un-certified PR (never auto-resolve someone's un-blessed branch), a red `test` (a real
 * bug, not a manifest artefact), or a non-rebasable state (BLOCKED/DRAFT — a human/branch-protection concern).
 */
export function isRebaseDropCandidate(v) {
  if (!v || v.decision !== 'skip') return false;
  const certified = !!(v.certifyLabel || v.aiGenerated);
  if (!certified || !v.testGreen) return false;
  const state = String(v.state || '').toUpperCase();
  const mergeable = String(v.mergeable || '').toUpperCase();
  return mergeable === 'CONFLICTING' || state === 'BEHIND' || state === 'DIRTY';
}

/**
 * #2183 first-lander leak fix — must an already-landable PR be rebuilt to DROP its `.lane-manifest.json`
 * BEFORE it merges? Every lane commits the transient manifest to its OWN tip so the drain can read cross-item
 * ordering off the ref; the rebase-drop (#2198) sheds it, but `isRebaseDropCandidate` only fires on a
 * CONFLICTING/BEHIND/DIRTY PR — so the FIRST PR of a batch (nothing to conflict with) merged CLEAN and carried
 * the manifest onto `main` (observed 2026-07-03: #79 leaked `.lane-manifest.json`). Any manifest-carrying PR
 * that is otherwise landable must therefore be stripped first, conflict or not. Pure — `v.hasManifest` is set
 * from the same `readPrManifest` probe that supplies the merge ordering. `--no-rebase-drop` still disables the
 * whole mechanism.
 */
export function needsManifestStripBeforeMerge(v) {
  return !!v && v.decision === 'merge' && !!v.hasManifest;
}

/**
 * #2393 — the impl-PR→WE-manifest `laneRef` join. Pure. Closes the impl-orphan-always-ready hole: only a WE
 * lane carries a `.lane-manifest.json`, so a couple's IMPL PR (frontierui/plateau-app) — and any WE PR whose
 * manifest didn't parse — reads as a manifest-less ORPHAN, which `planLabelDrain` treats as always-ready. An
 * impl PR could then land AHEAD of its couple, dragging the impl half of a deferred/broken couple onto main
 * with no WE resolve (a stowaway at the impl level).
 *
 * The couple's WE manifest already names every repo's lane ref in `repos[]` (impl-first/WE-last). So we index
 * each carrying PR by ALL of its couple's lane refs, then let every manifest-less PR INHERIT its couple's
 * `item` + `blockedBy` + `stackParents` by matching its own `headRef` against that index. An impl PR thereby
 * carries the SAME gate as its couple's WE PR — it defers whenever the couple defers, and is never
 * independently "ready" ahead of it. A TRUE orphan (a headRef in no couple manifest — a hand-opened PR, a
 * `/merge` sweep target) matches nothing and stays a plain always-ready orphan, so the bare sweep is unchanged.
 *
 * MUTATES + returns the same array (the caller works with the joined verdicts). A carrying PR keeps its own
 * manifest fields untouched. `manifestRefs` is the couple's lane-ref list (built in the collect loop from
 * `m.repos[].ref`); a PR with none defines no couple.
 *
 * @param {Array<{num:number, repo:(string|null), headRef?:string, hasManifest?:boolean, manifestRefs?:string[], item?:(number|string|null), blockedBy?:Array<number|string>, stackParents?:Array<number|string>}>} verdicts
 * @returns {typeof verdicts}
 */
export function joinImplToCouples(verdicts) {
  const list = Array.isArray(verdicts) ? verdicts : [];
  // Index every carrying PR (a WE couple manifest) by each of its couple's lane refs. First writer wins — a
  // lane ref belongs to exactly one couple, so a duplicate is defensive noise, never a real second couple.
  const byRef = new Map();
  for (const v of list) {
    if (!v || !v.hasManifest) continue;
    for (const ref of Array.isArray(v.manifestRefs) ? v.manifestRefs : []) {
      if (ref && !byRef.has(ref)) byRef.set(ref, v);
    }
  }
  for (const v of list) {
    if (!v || v.hasManifest) continue;             // a carrying PR keeps its own manifest
    const couple = v.headRef ? byRef.get(v.headRef) : null;
    if (!couple) continue;                          // a true orphan → unchanged always-ready behaviour
    v.item = couple.item;                           // inherit the couple's identity + gate edges
    v.blockedBy = Array.isArray(couple.blockedBy) ? couple.blockedBy.slice() : [];
    v.stackParents = Array.isArray(couple.stackParents) ? couple.stackParents.slice() : [];
    v.joinedToCouple = couple.item;                 // marks an impl PR gated via its couple (diagnostics/tests)
  }
  return list;
}

/**
 * Order a set of merge candidates for ONE cascade pass, honouring cross-item `blockedBy` (#2188) AND the
 * overlap-stacking proof-of-land gate (#2387 F5 / #2393). Pure.
 * This is the drain↔/merge convergence: the `ready-to-merge` label bounds the set, and each PR's
 * `.lane-manifest.json` (read off its head ref) supplies its backlog `item` + `blockedBy` + `stackParents`. A
 * PR is READY this pass only if BOTH gates pass:
 *   - `blockedBy` (the hard semantic edge): none of its `blockedBy` items is still OPEN in the candidate set —
 *     an unlanded blocker (a not-yet-merged sibling or a red/skip PR) defers its dependents.
 *   - `stackParents` (the overlap-stack edge, #2393): every stackParent is PROVEN LANDED — either landed
 *     THIS drain run (the caller's in-memory `landedThisPass` set, keyed on the WE-carrier merge) OR
 *     `bornAs`-proven on `origin/main` (the caller's `provenOnMain` set, from `landedNumberFor`). This is a
 *     POSITIVE, identity-based proof: absence from the candidate set is NEVER read as "landed" (that is the
 *     stowaway F5 forbids — salvaging a descendant past an unlanded parent silently drags the parent's
 *     unreviewed code onto main under the child's number). A stackParent still OPEN in the candidate set, or a
 *     provisional hash with no proof, DEFERS the descendant.
 * Orphan PRs (no manifest → item null, blockedBy [], stackParents []) are always ready, so this degrades to
 * the legacy unordered sweep when nothing carries a manifest.
 *
 * @param {Array<{num:number, item:(number|string|null), blockedBy:Array<number|string>, stackParents?:Array<number|string>, decision:'merge'|'skip'}>} candidates
 * @param {{landedThisPass?:Set, provenOnMain?:Set}} [proof]  positive proof-of-land sets (both `asItemId`-keyed)
 * @returns {{ready:Array, deferred:Array<{num,item,waitOn:Array<number|string>}>}}  ready is ordered (item asc, then PR#).
 */
export function planLabelDrain(candidates, { landedThisPass = new Set(), provenOnMain = new Set() } = {}) {
  const list = Array.isArray(candidates) ? candidates : [];
  // Every candidate still in play keeps its item "open" — a red/skip blocker must still defer its dependents,
  // so the open set is ALL candidate items, not just the mergeable ones. (A merged item is removed by the
  // caller between passes, which is what frees the dependent.)
  //
  // #2388 — `asItemId` (not `Number`) so a hash-keyed item (JIT numbering, #2288) stays its own distinct
  // string in the Set. A bare `Number("x5lail9")` is `NaN`, and `Set` uses SameValueZero equality where
  // `NaN === NaN` — so EVERY hash item would collapse into ONE indistinguishable "open" entry, and below,
  // EVERY hash `blockedBy` edge would spuriously resolve `openItems.has(NaN)` → true against ANY other open
  // hash item, not just its actual blocker (defers/frees the wrong item).
  const openItems = new Set(list.map((c) => c.item).filter((x) => x != null).map(asItemId));
  // #2393 — is a `stackParent` PROVEN LANDED? POSITIVE proof by identity (F5), NEVER ref-absence:
  //   1. landed THIS run  — the caller adds the item on its WE-carrier merge (aligned with `bornAs`, which is
  //      stamped only at the WE land, so a green impl PR of a red couple never counts its parent "landed").
  //   2. still an OPEN candidate — NOT landed yet → defer (the ordinary in-pass sequencing: it frees the
  //      descendant only once it actually merges and leaves the set next pass, exactly like a blockedBy edge).
  //   3. `bornAs`-proven on main — landed in a PRIOR session (the caller's `provenOnMain`, from `landedNumberFor`).
  //   4. a NUMERIC NNN not in the candidate set — a number only exists post-land (JIT numbering, #2288), so an
  //      already-numbered parent absent from this pass is landed.
  //   5. otherwise (a provisional hash, no proof, not a candidate) — NOT proven → defer. This is the stowaway
  //      guard: a descendant is never salvaged past a parent whose land we cannot positively prove.
  const stackProven = (sp) => {
    const id = asItemId(sp);
    if (landedThisPass.has(id)) return true;   // (1)
    if (openItems.has(id)) return false;       // (2)
    if (provenOnMain.has(id)) return true;     // (3)
    return typeof id === 'number' && Number.isFinite(id); // (4); a hash → false (5)
  };
  const ready = [];
  const deferred = [];
  for (const c of list) {
    if (c.decision !== 'merge') continue;
    const blockWait = (Array.isArray(c.blockedBy) ? c.blockedBy : []).map(asItemId).filter((b) => openItems.has(b));
    const stackWait = (Array.isArray(c.stackParents) ? c.stackParents : []).map(asItemId).filter((sp) => !stackProven(sp));
    const waitOn = [...new Set([...blockWait, ...stackWait])];
    if (waitOn.length === 0) ready.push(c);
    else deferred.push({ num: c.num, item: c.item, waitOn });
  }
  // Numeric items (landed NNNs) sort by number ascending, as before. A hash item has no numeric order yet
  // (JIT numbering assigns the real NNN only at land, #2288) so it sorts after every numbered item; ties
  // (incl. between distinct hashes) break on PR # — never on the item id itself, so two different hashes
  // never collide into one NaN-comparator bucket the way `Number(hash) - Number(hash)` (NaN) used to.
  // A hash item's relative order vs. ANOTHER item it is `blockedBy` is already governed by that edge, not
  // this comparator: two mutually-dependent items can never BOTH be `ready` in the same pass (the dependent's
  // blocker is still `openItems` until the caller's outer cascade merges it and recomputes the next pass) —
  // so within one `ready` array there is no live blockedBy/stackParents edge left to order by; the topology
  // is instead realized ACROSS passes by the caller re-invoking this function after each merge.
  const rank = (item) => {
    if (item == null) return Infinity;
    const id = asItemId(item);
    return typeof id === 'string' ? Infinity : id;
  };
  ready.sort((a, b) => (rank(a.item) - rank(b.item)) || (a.num - b.num));
  return { ready, deferred };
}

/** Bound a `--watch --interval=N` poll count. `--max-idle=N` (optional) exits after N consecutive idle passes
 *  (a pass that merged nothing AND has nothing deferred waiting); omitted → unbounded (until Ctrl-C). Pure.
 *  #2330 — `--until-batches-idle` adds a BATCH-AWARE exit (a drain launched to land a batch self-terminates
 *  once that batch is fully delivered): it reads the active-progress feed and exits only when no
 *  `kind:batch status:running` run remains AND the ready-to-merge queue is empty AND nothing is deferred —
 *  debounced over `--batch-idle-debounce` (default 2) consecutive passes. Unlike `--max-idle` this is SAFE for
 *  a live batch (items take minutes, so the watch goes idle *between* PRs — `--max-idle` would exit mid-batch). */
export function parseWatchOpts({ watch, interval, maxIdle, untilBatchesIdle, batchIdleDebounce } = {}) {
  const on = !!watch;
  const iv = Number.isFinite(Number(interval)) && Number(interval) > 0 ? Number(interval) : 30;
  const mi = Number.isFinite(Number(maxIdle)) && Number(maxIdle) >= 0 ? Number(maxIdle) : null;
  const untilBatches = !!untilBatchesIdle;
  const debounce = Number.isFinite(Number(batchIdleDebounce)) && Number(batchIdleDebounce) >= 1 ? Number(batchIdleDebounce) : 2;
  return { watch: on, intervalSec: iv, maxIdle: mi, untilBatchesIdle: untilBatches, batchIdleDebounce: debounce };
}

/** #2449 — route a run through the WHOLE-PROCESS drain lease (#2391), now ALWAYS-ON for full/label sweeps and
 *  watches (closes #2424's opt-in gap and ratifies #2443's "hold by default"): at most ONE full drain runs on
 *  the machine regardless of who launched it — a resident daemon, push-at-close, or an interactive `/drain`.
 *  Pure ROUTING only — the atomic acquire itself can still lose a race (the caller treats a failed acquire as
 *  `noop`). Actions:
 *    • `bypass`      — run WITHOUT the lease: a `--dry-run` (merges nothing, must never be blocked by a
 *      resident drain), a `--only=<pr>` single-PR fast drain (scoped; the numbering mutex already serializes
 *      the land — this is what keeps `/pr`/`/finish` instant next to a resident daemon), or the explicit
 *      `--no-drain-lease` escape hatch.
 *    • `under-lease` — the caller declared it runs UNDER a live holder (`--under-lease=<owner>`, a resident
 *      daemon's child pass): run without acquiring; the parent owns the lease + heartbeat.
 *    • `noop`        — a LIVE lease is held by someone else, or the declared under-lease holder is gone (a
 *      daemon that died between spawn and child start — fail SAFE, the queue rides the next drain): exit 0
 *      surfacing the holder; that drain's next pass already covers this work.
 *    • `acquire`     — the lease is free (or stale → reclaimable): take it for this run's FULL lifetime,
 *      one-shot and watch alike. */
export function decideDrainLeaseGate({ dryRun = false, onlyPr = null, noLease = false, underLease = null, status = { held: false, stale: false, owner: null } } = {}) {
  if (dryRun) return { action: 'bypass', reason: 'dry-run' };
  if (onlyPr != null) return { action: 'bypass', reason: 'single-pr-fast-drain' };
  if (noLease) return { action: 'bypass', reason: 'no-drain-lease' };
  if (underLease) {
    if (status.held && status.owner === underLease) return { action: 'under-lease', heldBy: status.owner };
    return { action: 'noop', heldBy: status.held ? status.owner : null, reason: status.held ? 'lease-held-by-other' : 'declared-holder-gone' };
  }
  if (status.held) return { action: 'noop', heldBy: status.owner, reason: 'lease-held' };
  return { action: 'acquire' };
}

/** #2330 — the running-batch entries in an active-progress feed object. Pure (takes the parsed JSON). A batch
 *  is "still producing" iff it has a `runs[]` entry with `kind:'batch'` and a non-terminal `status:'running'`. */
export function pickRunningBatches(feed) {
  const runs = feed && Array.isArray(feed.runs) ? feed.runs : [];
  return runs.filter((r) => r && r.kind === 'batch' && r.status === 'running');
}

/** #2330 — read the active-progress feed and report the running batches, or `known:false` when the signal is
 *  UNSAFE to trust (absent / unparseable / STALE — the feed only exists while the dev watcher runs, and 404s on
 *  a static publish). A `known:false` read must make the caller KEEP WATCHING, never stop (a missing feed can
 *  never trigger a false exit). `fs`/`now` injected so the classify logic is unit-testable without a real file.
 *  @returns {{known:boolean, running:Array, reason?:string}} */
export function readBatchFeed(path, { now = Date.now(), staleMs = 30_000, fs = { existsSync, readFileSync, statSync } } = {}) {
  try {
    if (!path || !fs.existsSync(path)) return { known: false, running: [], reason: 'feed-absent' };
    const ageMs = now - fs.statSync(path).mtimeMs;
    if (ageMs > staleMs) return { known: false, running: [], reason: 'feed-stale' };
    const feed = JSON.parse(fs.readFileSync(path, 'utf8'));
    return { known: true, running: pickRunningBatches(feed) };
  } catch {
    return { known: false, running: [], reason: 'feed-unreadable' };
  }
}

/** #2330 — should a `--until-batches-idle` watch EXIT now? Pure. The safe conjunction (all must hold):
 *  the pass was idle (merged/deferred/rebuilt nothing), the ready-to-merge queue is empty (`considered===0`,
 *  NOT "all nums resolved" — a dropped/parked item never lands and would hang the drain forever), and the
 *  batch feed has been observed KNOWN-and-non-running for `debounce` consecutive passes (absorbs feed lag). */
export function decideBatchesIdleExit({ enabled = false, idlePass = false, considered = 0, batchNonRunningStreak = 0, debounce = 2 } = {}) {
  if (!enabled) return false;
  if (!idlePass) return false;        // still landing / rebuilding a tip → keep going
  if (considered > 0) return false;   // queue not empty → keep going
  return batchNonRunningStreak >= debounce;
}

/** #2216 — should this OPEN PR be labelled now because its required check went green? Pure. Closes the lane-
 *  closure liveness gap: `pr-land --label-on-green` labels only if CI beats its `--timeout-min` wait; on a
 *  timeout the PR is left green-eventually-but-UNLABELLED and stranded. A post-CI reconcile pass labels it the
 *  moment the required check is green — no human step. Only the PRODUCER'S OWN work (AI-generated) is labelled,
 *  never a human orphan, and never a PR that already carries the label. */
export function shouldLabelOnGreen(pr, { requiredCheck = 'test', label = 'ready-to-merge' } = {}) {
  if (!label || hasLabel(pr, label)) return false;    // already labelled (or no label configured) → nothing to do
  if (!isAiGeneratedPr(pr)) return false;             // only the producer's own AI PRs — never a human orphan
  return isRequiredCheckGreen(pr, requiredCheck);     // label the instant the required check is green
}

/** #2230 — should a `--label`-scoped ONE-SHOT drain re-poll once before concluding the queue is empty? GitHub's
 *  `gh pr list --label` index lags the `gh pr edit --add-label` write by a few seconds, so a drain fired
 *  immediately after a producer labels can read the just-labelled PR as ABSENT ("0 to merge") and strand it.
 *  Re-poll ONCE when the labelled set found is smaller than expected — default threshold 1 (any at all), or
 *  `--expect=N`. Only for a label-scoped sweep (the race bites the bare one-shot; `--watch` self-heals on its
 *  next interval) and only once (never a busy-loop). Pure. `found` = the count of labelled PRs the sweep saw.
 *  @param {{label:string|null, found:number, expect?:number|null, retried:boolean}} o
 */
export function shouldRepollForLabelLag({ label, found, expect, retried } = {}) {
  if (!label || retried) return false;
  const threshold = Number.isFinite(Number(expect)) && Number(expect) > 0 ? Number(expect) : 1;
  return Number(found) < threshold;
}

/**
 * #2313 — the drain STAMPS a park/skip reason onto the PR itself (a `gh pr comment`), not only its own
 * ephemeral log (`we:scripts/merge-ai-prs.mjs`, previously ~715-722) — the log lives in whoever ran the drain's
 * terminal; the PR is where the human reviewer actually is. Pure builder + pure dedupe check (the `gh` I/O lives
 * in the CLI-only `postDrainReasonComment` wrapper below); unit-tested in `merge-ai-prs.test.mjs`.
 *   `kind`  — 'park' (review-escalation parked it, #2171) or 'skip' (a real non-manifest conflict / red check).
 *   Dedup   — marker-prefixed body; a `--watch` loop re-scores the SAME PR every pass, so `hasDrainReasonComment`
 *             finds an existing comment carrying both the marker AND the exact same reason text and the caller
 *             skips re-posting. A CHANGED reason (escalation reasons shifted, a different check went red) has no
 *             matching prior comment, so it posts fresh — no external state needed beyond the PR's own comments.
 */
export function drainReasonMarker(kind) { return `<!-- drain-${kind}-reason -->`; }

/** Build the comment body for a park/skip/land reason. Pure.
 *  `kind` — 'park' (review-escalation parked it), 'skip' (a real conflict / red check), or 'land' (xnsk54v
 *  follow-up — the drain is about to MERGE a manifest-carrying PR; this records what it acted on BEFORE the
 *  merge, so the attack's SUCCESS state — `dismissedFindings` edited DOWN so the PR lands — still leaves a
 *  durable trail).
 *  `auditLine` (xnsk54v follow-up) — the optional `manifestAuditLine` recording the escalation-sensitive
 *  manifest values (`dismissedFindings`/`crossRepo`/`blockedBy`) this decision ACTED ON. Because the manifest
 *  now lives in the editable, un-reviewed PR body, folding the acted-on values into this durable, timestamped
 *  comment makes a later body edit tamper-evident (diff recorded-vs-live). Appended verbatim; omitted when
 *  absent (an orphan/impl PR carrying no manifest is unchanged). */
export function buildDrainReasonComment(kind, reasonText, auditLine) {
  const heading = kind === 'park' ? '⏸ **Parked for review by the drain**'
    : kind === 'land' ? '✅ **Landed by the drain**'
    : '· **Skipped by the drain**';
  const audit = auditLine ? `\n\n${auditLine}` : '';
  return `${drainReasonMarker(kind)}\n${heading}\n\n${reasonText}${audit}`;
}

/** xnsk54v follow-up — the fixed reason text for the land-path audit record. Exported (and imported by the
 *  test) so the string lives in ONE place: the record and its assertion can't silently drift apart. */
export const LAND_REASON = 'landing — recording the acted-on manifest escalation values before merge';

/** xnsk54v follow-up — the acted-on manifest audit line for a verdict/candidate `x`, or `undefined` when the
 *  PR carries no manifest (an orphan/impl PR has nothing body-sourced to record — its comment stays
 *  byte-identical to before). `manifestAuditLine` destructures exactly `dismissedFindings`/`crossRepo`/
 *  `blockedBy`, so passing the whole verdict is safe — its extra keys are ignored. Collapses the identical
 *  park/skip/land call sites into one. */
const auditLineFor = (x) => x.hasManifest ? manifestAuditLine(x) : undefined;

/**
 * #2333 — should a PARK stamp its escalation reason as a PR comment (#2313)? ONLY for a NON-human
 * (agent-reviewable) park. A `review:human` park already states the SAME reason IN THE PR BODY via #2324's
 * escalation-reason block, so a park comment there would just duplicate it (harmless but redundant). The
 * humanRequired case is surfaced by the body-block alone; this comment path fires for agent-reviewable parks
 * (and genuine skips post their own comment on a separate path). Pure. */
export function shouldPostParkReasonComment({ humanRequired } = {}) {
  return !humanRequired;
}

/** Has this exact (kind, reasonText, auditLine) already been stamped on the PR? Pure. `comments` is the raw
 *  `gh pr view --json comments` array (tolerant of a missing/odd shape). `auditLine` (xnsk54v follow-up) is
 *  matched too so a CHANGED acted-on manifest value posts a FRESH, separately-timestamped comment (the
 *  tamper trail) rather than dedupe-hiding under the prior post; omitted/empty ⇒ `includes('')` ⇒ no-op
 *  (backward compatible with a call that passes no audit line). */
export function hasDrainReasonComment(comments, kind, reasonText, auditLine) {
  const marker = drainReasonMarker(kind);
  const text = String(reasonText || '');
  const audit = String(auditLine || '');
  return (Array.isArray(comments) ? comments : []).some((c) => {
    const body = String(c?.body || '');
    return body.startsWith(marker) && body.includes(text) && body.includes(audit);
  });
}

// #2257/#2263 — the constellation's short repo names, SINGLE SOURCE for both `resolveRepos` (`--all-repos`
// expansion) and `siblingCloneName` (#2263 sibling-clone routing) — a duplicated literal in each would drift
// silently if the constellation ever grows a 4th repo.
const CONSTELLATION_REPO_NAMES = ['web-everything', 'frontierui', 'plateau-app'];

/**
 * #2257 — resolve the set of repos this ONE lander sweeps. Pure. The single `/drain` skill stays one skill;
 * this makes its lander repo-aware instead of copying the transport into each repo (the rejected #2244/#2245
 * approach). Independent per-repo drains CANNOT sequence cross-repo `blockedBy` — the backlog is WE-global, so
 * a frontierui PR can be blocked by a WE item — so a single global cascade over all repos is required, not
 * optional — so it is the DEFAULT (#2287), not an opt-in flag. Resolution:
 *   - `--repos=owner/a,owner/b` → those exact slugs (explicit override).
 *   - neither `--repos` nor `--this-repo` → the constellation: self's owner × {web-everything, frontierui,
 *     plateau-app}, **self FIRST** so the local clone (rebase-drop, local-main sync) is the primary repo.
 *     This is the default (#2287). (`--all-repos` is accepted as a harmless no-op alias of the default.)
 *   - `--this-repo` (`singleRepo`) → `[null]`: a deliberately scoped single-repo drain. `null` = "the cwd
 *     repo, NO `--repo` flag" (the established single-repo git path). An underivable owner (no `self` slug)
 *     also falls back to `[null]` — safe.
 * A slug entry routes every gh call through `--repo`; a `null`-or-self entry keeps using local git for the
 * manifest read / rebase-drop / sync. `self` is the cwd repo slug "owner/name" (derived from origin).
 * @param {{repos?:string|null, singleRepo?:boolean, self?:string|null}} o
 * @returns {Array<string|null>}
 */
export function resolveRepos({ repos, singleRepo, self } = {}) {
  if (typeof repos === 'string' && repos.trim()) {
    const list = repos.split(',').map((s) => s.trim()).filter(Boolean);
    if (list.length) return list;
  }
  // #2287 — the constellation is the DEFAULT (the backlog is WE-global, so cross-repo blockedBy needs one
  // global cascade). Opt OUT with `--this-repo` for a deliberately scoped single-repo drain.
  if (singleRepo) return [null];
  const owner = self && self.includes('/') ? self.split('/')[0] : null;
  if (!owner) return [null]; // can't derive the constellation without an owner → stay single-repo (safe)
  const slugs = CONSTELLATION_REPO_NAMES.map((n) => `${owner}/${n}`);
  return [...new Set([self, ...slugs.filter((s) => s !== self)])]; // self first (the local clone), then the rest
}

/**
 * #2263 — the sibling-clone DIRECTORY NAME for a constellation repo slug (e.g. `chalbert/frontierui` →
 * `frontierui`), so the local-only rebase-drop plumbing (#2198) can be routed through THAT repo's own clone
 * instead of being left as a `skipped-remote` skip. Pure. `null` for a repo outside the known constellation
 * (nothing to route to — unchanged legacy skip). Whether that sibling clone actually EXISTS is a runtime
 * filesystem check (`siblingCloneDir` below), kept separate so this stays pure/unit-testable.
 * @param {string|null} repo
 * @returns {string|null}
 */
export function siblingCloneName(repo) {
  if (!repo || !repo.includes('/')) return null;
  const name = repo.split('/').pop();
  return CONSTELLATION_REPO_NAMES.includes(name) ? name : null;
}

/**
 * #1821 — parse `git diff --numstat <base> <head>` output into the escalation rubric's `{changedFiles,
 * diffLines}` shape. Pure. This is the NET TWO-DOT diff (content that actually differs between the two
 * snapshots) — deliberately NOT the GitHub PR `files` list, which is a three-dot / merge-base diff and so
 * still lists a file from an earlier stacked-pipeline stage that has since landed on `main` (net-identical),
 * even though the PR's real diff no longer touches it. Each line is `<added>\t<deleted>\t<path>` (`-` for a
 * binary file's counts). Unparseable/blank lines are skipped.
 * @param {string} numstat
 * @returns {{changedFiles:string[], diffLines:number}}
 */
export function parseNumstat(numstat) {
  const changedFiles = [];
  let diffLines = 0;
  for (const line of String(numstat || '').split('\n')) {
    const m = line.match(/^(\d+|-)\t(\d+|-)\t(.+)$/);
    if (!m) continue;
    diffLines += (m[1] === '-' ? 0 : Number(m[1])) + (m[2] === '-' ? 0 : Number(m[2]));
    changedFiles.push(m[3]);
  }
  return { changedFiles, diffLines };
}

/**
 * #2390-review-fix — is `ancestor` a STRICT ancestor of `descendant` (an ancestor, AND not the same commit)?
 * Used to gate the stacked-lane SIZE de-inflation: a self-declared/mis-set `base` is trusted for `base…head`
 * ONLY if it provably sits behind head, so it can never be `base==head` (an empty own-delta silently
 * `scored:true` under-score) nor an unrelated tree. `git merge-base --is-ancestor` exits 0 for an ancestor
 * (INCLUDING equality), so equality is rejected separately via `rev-parse`. Any git error → `false` (don't
 * trust the base → the caller uses the safe cumulative basis). Pure aside from the injected `exec`.
 */
function isStrictAncestor(exec, ancestor, descendant) {
  try {
    exec('git', ['merge-base', '--is-ancestor', ancestor, descendant], { stdio: ['ignore', 'ignore', 'ignore'] });
  } catch { return false; } // non-zero exit (not an ancestor) or unresolvable → don't trust the base
  try {
    const a = String(exec('git', ['rev-parse', ancestor], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }) || '').trim();
    const b = String(exec('git', ['rev-parse', descendant], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }) || '').trim();
    if (a && b && a === b) return false; // base == head → degenerate empty own-delta, reject
  } catch { /* can't resolve to SHAs → is-ancestor already vouched it's a distinct ancestor path */ }
  return true;
}

/**
 * #2373 — the SHARED net-diff basis for the review-escalation rubric, used by BOTH the producer
 * (`pr-land.mjs`'s `applyReviewEscalationLabel`) and the drain backstop below — the ONE place this basis is
 * computed, so the two paths can't independently drift (#1821 fixed the drain path's basis; #2373 found the
 * producer path still mis-computed it via a bare `git fetch <remote> <base>`, which relies on git's
 * "opportunistic" tracking-ref update and can leave a stale local `<remote>/<base>` even after a
 * "successful" fetch — silently sweeping already-landed upstream commits into the score, e.g. a gate-fix
 * commit another lane merged onto `main` between this lane's claim and its PR-open). Fetching with an
 * EXPLICIT destination refspec (`+<base>:refs/remotes/<remote>/<base>`) force-updates the tracking ref
 * unconditionally, so the subsequent diff always scores off the CURRENT upstream base, never one a
 * concurrently-landed PR has since advanced past.
 *
 * #2404 — twin of #2373 in the OTHER direction: #2373 fixed a STALE base under-reporting; a fresh base
 * against an UN-REBASED head over-reports instead — a bare `<remote>/<base>..<rev>` two-tree diff then counts
 * every file upstream has advanced since the lane forked as if the PR itself touched it (repro: PR #364, a
 * 2-file docs change scored `changedFiles` in the dozens off upstream-only commits). The diff basis is
 * therefore taken from `git merge-base <remote>/<base> <candidate>` — the commit the lane actually forked
 * from — to `<candidate>`, not from the base tip directly. This is STILL a two-tree, content-only,
 * ancestry-independent `git diff --numstat` (never a three-dot diff); only the LEFT side moves to the
 * provable fork point. Unlike `baseRev` below, the merge-base is derived purely from the commit graph — never
 * a self-declared/manifest value — so it can't be gamed the way #2390-review-fix guards `baseRev` against,
 * and it degrades safely: a rebased head has `merge-base(base, head) == base`, so this is a no-op there, and
 * an unresolvable/no-common-history merge-base falls back to the base tip itself (the prior, safe
 * over-scoring behavior). This narrows BOTH `own` and the cumulative `humanBasisFiles`, so the #2404 fix
 * benefits the human-gate signal too.
 *
 * Tries a short fallback chain for `rev` (`<remote>/<rev>` first, then the bare `rev`) since a foreign/sibling
 * clone scoring another repo's PR may not have `rev` as a local branch. `<remote>/<rev>` is tried FIRST, not the
 * bare `rev` (#2373-review-r2): in the DRAIN path `rev` is a branch NAME (`v.headRef`), and the clone may hold a
 * STALE local branch of that same name — a bare `git diff <remote>/<base> <headRef>` would then resolve against
 * that stale local branch and return `scored:true` with wrong/partial `changedFiles`, under-scoring escalation
 * (the UNSAFE direction: a gate-self PR whose gate-touching files are missing from the diff could slip past).
 * `fetchExtraRefs` freshly fetched the head ref, so `<remote>/<rev>` is the just-fetched truth — consulting it
 * before any local branch of the same name dodges that collision. The PRODUCER path is unaffected: there `rev`
 * is an already-resolved local SHA, so `<remote>/<sha>` (e.g. `origin/abc123`) is an invalid ref that fails fast
 * (one extra cheap failed git call), falling through to the bare `rev` SHA which resolves. `FETCH_HEAD` is DELIBERATELY
 * NOT a candidate (#2373-review): the base is listed FIRST in the fetch refspec and `git diff FETCH_HEAD` /
 * `git rev-parse FETCH_HEAD` resolve to that first line, so `FETCH_HEAD` always points at `<remote>/<base>` —
 * a `FETCH_HEAD` diff would therefore be base-vs-base (an EMPTY diff) and "succeed" with `scored:true` and zero
 * changed files, MASKING a real `<remote>/<rev>` miss. Without it, when neither `rev` nor `<remote>/<rev>`
 * resolves the function returns `scored:false` and the caller correctly falls through to its GitHub files-list
 * backstop (the safe, over-scoring direction). `fetchExtraRefs` still fetches the head ref so `<remote>/<rev>`
 * resolves in the normal sibling-clone case — it just never gets offered as a diff candidate via `FETCH_HEAD`.
 * #2390 — a STACKED lane records the commit SHA it was cut from (its predecessor's tip) as the manifest
 * per-repo `base`. Pass it as `baseRev` and the SIZE / blast-radius diff (`changedFiles`/`diffLines`) is
 * computed from THAT base — so the lane's blast-radius is scored on its OWN delta, killing cumulative-stack
 * inflation. A plain sibling lane carries no base → `baseRev` is null → the unchanged `<remote>/<base>` basis.
 *
 * #2390-review-fix — but the base rides the EDITABLE PR body, so it MUST NOT be able to shrink the
 * `humanRequired` / gate-self trigger. Two guards:
 *   1. `humanBasisFiles` is ALWAYS the cumulative `<remote>/<base>…head` file set (never de-inflated by
 *      `baseRev`). `scoreEscalation` reads the gate-self signal from it, so an ancestor's OR the child's edit
 *      to the auto-review trust chain always forces `review:human` — a self-declared/mis-set base can shrink
 *      SIZE but never suppress the human gate (over-escalating is the safe direction, #2285).
 *   2. `baseRev` is trusted for the SIZE de-inflation ONLY when it is a STRICT ancestor of head (never
 *      `base==head`, which would be an empty own-delta silently `scored:true` under-score; never an unrelated
 *      tree). Otherwise the own-delta falls back to the cumulative basis. `baseRev` is also shape-guarded to a
 *      git object hash so a malformed manifest value can never become an injected `git` argument.
 * The base tracking-ref is ALWAYS force-updated (the cumulative basis needs it); `baseRev` reaches via the
 * fetched head ref. Any diff failure falls through to `scored:false`, the safe over-scoring direction.
 * @param {{exec:Function, remote?:string, base?:string, baseRev?:string|null, rev:string, fetchExtraRefs?:string[]}} opts
 *   `exec(cmd, args, opts)` — inject `execFileSync`-shaped exec so this stays unit-testable with a fake.
 * @returns {{changedFiles:string[], diffLines:number, scored:boolean, humanBasisFiles:string[]}}
 */
export function computeNetDiffChangedFiles({ exec, remote = 'origin', base = 'main', baseRev = null, rev, fetchExtraRefs = [] } = {}) {
  if (typeof exec !== 'function' || !rev) return { changedFiles: [], diffLines: 0, scored: false, humanBasisFiles: [] };
  const baseRevOk = typeof baseRev === 'string' && /^[0-9a-f]{7,64}$/i.test(baseRev);
  const baseRef = `${remote}/${base}`;
  try {
    // ALWAYS force-update the base tracking-ref (#2373 opportunistic-fetch fix): the cumulative human-gate basis
    // below is `<remote>/<base>…head`, which a stacked `baseRev` must never be able to shrink (#2390-review-fix).
    exec('git', ['fetch', remote, `+${base}:refs/remotes/${remote}/${base}`, ...fetchExtraRefs, '--quiet'], { stdio: ['ignore', 'ignore', 'ignore'] });
  } catch { /* degrade to whatever is locally cached — the diff attempts below still run */ }
  const candidates = [`${remote}/${rev}`, rev];
  for (const candidate of candidates) {
    // #2404 — narrow the LEFT side of the diff to the provable fork point (`merge-base(baseRef, candidate)`)
    // when one exists, instead of diffing straight off the base tip: a head that's behind an advanced base
    // would otherwise have every upstream-only commit swept in as if the PR touched it. A merge-base lookup
    // failure (no common history / candidate unresolvable) is swallowed here and falls back to `baseRef`
    // itself — the diff call right after is still the real candidate-resolves probe.
    let diffBase = baseRef;
    try {
      // `git merge-base A B` can print MORE THAN ONE line (a criss-cross-merge history can have several
      // equally-valid best common ancestors) — take only the first; `.trim()` alone would leave an embedded
      // newline in a would-be single revision arg, making it an invalid `git diff` argument (a "continue" to
      // the next candidate, or `scored:false` if both candidates hit it — always the safe over-scoring
      // fallback, never wrong data, but avoidable).
      const mb = String(exec('git', ['merge-base', baseRef, candidate], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }) || '').split('\n')[0].trim();
      if (mb) diffBase = mb;
    } catch { /* no common history, or candidate doesn't resolve yet — the diff below is the real probe */ }
    // The cumulative `<mergeBase>…head` diff is BOTH the human-gate basis AND the candidate-resolves probe.
    let humanBasis;
    try {
      humanBasis = parseNumstat(exec('git', ['diff', '--numstat', diffBase, candidate], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
    } catch { continue; /* candidate doesn't resolve — try the next one */ }
    // SIZE / blast-radius de-inflate to the OWN delta (`baseRev…head`) ONLY when `baseRev` provably is a STRICT
    // ancestor of head; otherwise use the cumulative basis (the safe over-scoring direction).
    let own = humanBasis;
    if (baseRevOk && isStrictAncestor(exec, baseRev, candidate)) {
      try { own = parseNumstat(exec('git', ['diff', '--numstat', baseRev, candidate], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })); }
      catch { own = humanBasis; /* own-delta diff failed → fall back to the cumulative basis */ }
    }
    return { changedFiles: own.changedFiles, diffLines: own.diffLines, scored: true, humanBasisFiles: humanBasis.changedFiles };
  }
  return { changedFiles: [], diffLines: 0, scored: false, humanBasisFiles: [] };
}

/**
 * #2290 — POST-LAND WE DERIVED-ARTIFACT REGEN, now owned by the drain (the sole writer to main). Under #2183
 * lanes never commit the derived artifacts (`gen:inventory` → the AGENTS.md inventory block; `gen:reference-index`
 * → src/_data/referenceIndex.json). pr-land used to regen+commit+push them after its own merge (#2182), but
 * pr-land no longer merges — and a non-drain push to main is blocked by the pre-push hook — so the regen MUST run
 * INSIDE the drain. Reuses lane-drain's `DERIVED_REGEN` (imported, lock-step — never a copied array). After a
 * sweep pass that LANDED ≥1 WE (local/cwd) couple, reproduce the artifacts ONCE and, if they changed, commit +
 * push them to main AS THE DRAIN (the push carries `MAIN_PUSH_OK=1`, the same override pr-land's sanctioned
 * main-writes used). WE-only: it skips entirely unless a LOCAL-repo couple landed (a pure frontierui/plateau land
 * regenerates nothing here — those repos have their own artifacts). Best-effort/non-fatal: a generator/commit/push
 * failure is REPORTED, never thrown (the couples already landed). `exec(cmd,args,opts)` is injectable (default the
 * real execFileSync) so this is unit-testable without shelling — the git/npm calls are the I/O boundary.
 * @param {{exec:Function, cwd?:string, landed?:boolean, dryRun?:boolean, remote?:string, base?:string, regenSet?:Array}} o
 * @returns {{ran:boolean, done:string[], failed:{cmd:string,detail:string}[], committed:boolean, pushed:boolean, warning?:string}}
 */
export function regenDerivedOnLand({ exec, cwd = process.cwd(), landed = false, dryRun = false, remote = 'origin', base = 'main', regenSet = DERIVED_REGEN, outputPaths = DERIVED_OUTPUT_PATHS } = {}) {
  const skip = { ran: false, done: [], failed: [], committed: false, pushed: false };
  if (!landed || dryRun || typeof exec !== 'function') return skip;
  const firstLine = (e) => String((e && e.message) || e).split('\n')[0];
  const done = [];
  const failed = [];
  for (const [cmd, ...args] of regenSet) {
    try { exec(cmd, args, { cwd, stdio: ['ignore', 'ignore', 'pipe'] }); done.push([cmd, ...args].join(' ')); }
    catch (e) { failed.push({ cmd: [cmd, ...args].join(' '), detail: firstLine(e) }); }
  }
  if (done.length === 0) return { ran: true, done, failed, committed: false, pushed: false, warning: failed.length ? `derived-artifact regen failed (non-fatal): ${failed.map((f) => f.cmd).join(', ')}` : undefined };
  // What did the deterministic generators change? SCOPE strictly to the known derived-output paths — the drain
  // can run in a checkout carrying UNRELATED dirty tracked files (a concurrent session's in-flight claim), so a
  // bare `git diff --name-only` would sweep those foreign edits into this commit and publish them (the same
  // shared-index hazard `finalizeLand` guards with an explicit pathspec). Intersecting with `outputPaths` means
  // the commit provably carries ONLY `AGENTS.md` / `referenceIndex.json`, whatever else is dirty in the tree.
  let dirty = [];
  try { dirty = String(exec('git', ['diff', '--name-only', '--', ...outputPaths], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) || '').split('\n').filter(Boolean); }
  catch { dirty = []; }
  const changed = dirty.filter((f) => outputPaths.includes(f));
  if (changed.length === 0) return { ran: true, done, failed, committed: false, pushed: false }; // regen was a no-op (derived inputs didn't change)
  try {
    // Explicit pathspec — only these derived files ride the commit (never `git add -A`, and never the broad
    // `git diff` sweep). Mirror pr-land's runRegen commit message + gated main push exactly (#2182).
    exec('git', ['add', ...changed], { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    exec('git', ['commit', '-m', `chore: regen derived artifacts post-land (#2182) [${done.map((c) => c.replace('npm run ', '')).join(', ')}]`], { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    exec('git', ['push', remote, `HEAD:${base}`], { cwd, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, MAIN_PUSH_OK: '1' } });
    return { ran: true, done, failed, committed: true, pushed: true };
  } catch (e) {
    return { ran: true, done, failed, committed: false, pushed: false, warning: `derived-artifact regen committed/pushed FAILED (${firstLine(e)}) — run gen:inventory + gen:reference-index on ${base} + push by hand (no force-push)` };
  }
}

/**
 * #2348 — resync a DETACHED cwd onto the real just-merged `origin/${base}` before JIT numbering / derived
 * regen read it. `git pull --ff-only` (the block above, in `runCli`) needs an ATTACHED branch with an
 * upstream — the PRIMARY's local `main`. It always errors on a DETACHED HEAD, which is exactly the state
 * every LANE CLONE sits in (the #2183 clone model never checks out a local `main` branch there), so the
 * single-couple fast drain `/pr` (pr-land.mjs) shells FROM a lane clone (#2290) always left the tree at the
 * lane's OWN pre-merge tip — lineage-disconnected from the just-created `origin/${base}` merge commit — and
 * a downstream `push origin HEAD:${base}` was a non-fast-forward the remote silently REJECTED (HEAD is an
 * ANCESTOR of the real tip, never a descendant). That is exactly how #2347 stranded a hash on main via this
 * NORMAL route (distinct from the `--fallback-git` gap #2322 closed) — repro: this session's PR #262.
 *
 * ONLY resyncs when cwd is genuinely DETACHED, OR attached to a STALE `lane/*` branch (#2419 — see below);
 * an attached branch that is `${base}` itself — e.g. the primary's own possibly-diverged `main` — or any
 * other non-`lane/*` branch is left untouched (its existing warn-only behaviour in `runCli` stands). It also
 * carries no TRACKED local edits (never reset a dirty tree), AND HEAD is already an ANCESTOR of
 * `origin/${base}` (#2348 review) — a lane clone can carry MORE local commits than the one couple this pass
 * just landed (e.g. a session already committed a SECOND item's work in the same clone before pushing it);
 * `git checkout --detach` would silently ORPHAN those unpushed commits (reachable only via reflog) the
 * instant HEAD moves off them. Requiring HEAD to already BE reachable from the real merged tip means the
 * detach is always a true no-op rebase-in-place — never a discard. Mirrors pr-land's runHeal/runRegen
 * dirty-probe + detach pattern (#2225), sharing the same `isPostLandTreeDirty` (single source, never a
 * fork), plus the extra ancestor guard runHeal doesn't need (it always runs against a freshly-pushed,
 * single-purpose lane). `exec` is injectable (default the real `execFileSync`) so this is unit-testable
 * without shelling.
 *
 * #2419 — widened beyond the original DETACHED-only trigger: a lane clone can also be left ATTACHED to a
 * STALE `lane/*` branch (a leftover from an earlier rebase-drop or a manual checkout, #2419's root cause —
 * `lane-pool.mjs`'s `acquire` now fixes this at the source with `checkout -B`, but this is the backstop for
 * a lane that is ALREADY stray, or a future regression upstream). `git pull --ff-only` needs an attached
 * branch WITH an upstream; a lane's local `lane/*` branch has none, so the pull silently no-ops and the
 * original detached-only check (`skipped: 'attached'`) let that stale tree through unresynced — the strand
 * this item exists to close. Same dirty/ancestor/detach mechanics either way; only the trigger condition
 * widens.
 * @param {{exec:Function, landedLocal:boolean, localSynced:boolean, remote?:string, base?:string}} o
 * @returns {{resynced:boolean, skipped?:string, detail?:string}}
 */
export function resyncDetachedCwdForLand({ exec, landedLocal, localSynced, remote = 'origin', base = 'main' }) {
  if (!landedLocal || localSynced || typeof exec !== 'function') return { resynced: false, skipped: 'not-applicable' };
  let ref = null;
  try { ref = exec('git', ['symbolic-ref', '-q', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); }
  catch { ref = null; } // throws → HEAD is genuinely detached
  const detached = ref == null;
  const attachedBranch = detached ? null : String(ref).trim().replace(/^refs\/heads\//, '');
  const staleLaneBranch = !detached && /^lane\//.test(attachedBranch); // #2419 — the widened trigger
  if (!detached && !staleLaneBranch) return { resynced: false, skipped: 'attached' };
  let dirty = true;
  try { dirty = isPostLandTreeDirty(exec('git', ['status', '--porcelain', '--untracked-files=no'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })); }
  catch { dirty = true; } // status unreadable → treat as dirty, never reset blind
  if (dirty) return { resynced: false, skipped: 'dirty' };
  try {
    exec('git', ['fetch', remote, base, '--quiet'], { stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    return { resynced: false, skipped: 'exec-failed', detail: String((e && e.message) || e).split('\n')[0] };
  }
  try { exec('git', ['merge-base', '--is-ancestor', 'HEAD', `${remote}/${base}`], { stdio: ['ignore', 'ignore', 'ignore'] }); }
  catch { return { resynced: false, skipped: 'unpublished-commits' }; } // HEAD carries commits origin/${base} doesn't — never orphan them
  try {
    exec('git', ['checkout', '--detach', `${remote}/${base}`, '--quiet'], { stdio: ['ignore', 'pipe', 'pipe'] });
    return { resynced: true };
  } catch (e) {
    return { resynced: false, skipped: 'exec-failed', detail: String((e && e.message) || e).split('\n')[0] };
  }
}

/** Synchronous sleep (the CLI is fully synchronous — execFileSync throughout — so the watch loop blocks here
 *  between polls without an event loop). Uses Atomics.wait so it spawns nothing. */
function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, Math.max(0, Math.trunc(ms)));
}

// ── CLI boundary ───────────────────────────────────────────────────────────────────────────────────────
const IS_CLI = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (IS_CLI) runCli();

function runCli() {
  const AS_JSON = !!flags.json;
  const DRY_RUN = !!flags['dry-run'];
  const REQUIRED = typeof flags.check === 'string' ? flags.check : 'test';
  // #2290 — `--only=<pr>` (alias `--couple=<pr>`, and the legacy `--pr=<pr>`) scopes the sweep to ONE PR: the
  // single-couple FAST DRAIN that /pr (pr-land) and /finish (lane-resume) shell so they still feel instant
  // while the drain stays the sole writer to main. Same gated land path as a full sweep, just number-filtered.
  const onlyPr = flags.only != null ? String(flags.only) : (flags.couple != null ? String(flags.couple) : (flags.pr != null ? String(flags.pr) : null));
  const base = typeof flags.base === 'string' ? flags.base : null;
  // #2188 — the drain↔/merge convergence: `--label ready-to-merge` scopes the sweep to producer-completed PRs
  // (the F1 signal), so this ONE lander serves both `/merge` (bare = every AI PR) and `/drain` (label-scoped +
  // manifest-ordered). Omit → the legacy sweep-all behaviour, unchanged.
  const label = typeof flags.label === 'string' ? flags.label : null;
  // #2194 — /drain converges onto this lander: `--watch` turns the one-shot sweep into the long-lived monitor
  // (`/drain watch`), re-sweeping on `--interval=N`s and landing each PR the instant it goes green.
  const { watch: WATCH, intervalSec: INTERVAL, maxIdle: MAX_IDLE, untilBatchesIdle: UNTIL_BATCHES_IDLE, batchIdleDebounce: BATCH_DEBOUNCE } =
    parseWatchOpts({ watch: flags.watch, interval: flags.interval, maxIdle: flags['max-idle'], untilBatchesIdle: flags['until-batches-idle'], batchIdleDebounce: flags['batch-idle-debounce'] });
  // #2330 — the active-progress feed the batch-aware exit reads. The feed is a dev-only artifact the website's
  // Active-work tab reads; it lives at <repo>/_site/active-progress.json and is written by
  // `scripts/dev/active-progress-watch.mjs` (which must be running for the signal to exist — a drain-only
  // session should point `--batch-feed` at the primary checkout's copy). Absent/stale ⇒ the watch keeps polling.
  const BATCH_FEED = typeof flags['batch-feed'] === 'string' ? flags['batch-feed'] : join(resolve(dirname(fileURLToPath(import.meta.url)), '..'), '_site', 'active-progress.json');
  // #2330 review (3) — `--batch-feed-stale-sec` should comfortably EXCEED the dev watcher's write cadence
  // (active-progress-watch writes ~every 4s) so a fresh-but-quiet feed never reads as stale (that direction is
  // safe — it keeps watching — but defeats the exit). The 30s default clears the 4s cadence with wide margin;
  // it is independent of `--interval` (they merely share a 30s default value).
  const BATCH_FEED_STALE_MS = (Number.isFinite(Number(flags['batch-feed-stale-sec'])) && Number(flags['batch-feed-stale-sec']) > 0 ? Number(flags['batch-feed-stale-sec']) : 30) * 1000;
  // #2449 — the WHOLE-PROCESS drain lease (#2391) is ALWAYS-ON for full/label sweeps and watches (see
  // decideDrainLeaseGate — closes #2424, ratifies #2443). `--hold-drain-lease` (#2395) is accepted as a
  // legacy no-op alias (holding is the default now); `--no-drain-lease` is the explicit escape hatch; and
  // `--under-lease=<owner>` (or the DRAIN_UNDER_LEASE env) declares this run a CHILD of the resident drain
  // daemon that already holds the lease (#2449) — run without acquiring, the parent owns the heartbeat.
  const NO_DRAIN_LEASE = !!flags['no-drain-lease'];
  const UNDER_LEASE = (typeof flags['under-lease'] === 'string' && flags['under-lease']) ? flags['under-lease'] : (process.env.DRAIN_UNDER_LEASE || null);
  // #2395 — `--max-runtime-min=N`: a wall-clock lifetime cap on a `--watch` monitor. The bounded-max-lifetime
  // backstop push-at-close needs: when its detached drain has no batch feed, `--until-batches-idle` is INERT
  // and would poll forever, so this hard-stops the watch after N minutes regardless of idle/feed state. 0/unset
  // ⇒ no cap (Ctrl-C / the idle bounds decide). Correctness holds if it fires: the deferred sweep is the backstop.
  const MAX_RUNTIME_MS = (Number.isFinite(Number(flags['max-runtime-min'])) && Number(flags['max-runtime-min']) > 0) ? Number(flags['max-runtime-min']) * 60_000 : null;
  // #2198 — rebase-drop the shared `.lane-manifest.json` on land (ON by default; `--no-rebase-drop` disables).
  const REBASE_DROP = flags['no-rebase-drop'] ? false : true;
  // #2371 — safe-content rebase-drop: when the manifest-only resolver (#2198) finds a REAL (non-manifest)
  // conflict, retry with the wider content resolver — auto-resolves it ONLY if every conflicting hunk is
  // non-overlapping (disjoint base-line ranges; a genuine overlapping edit still skips to `/finish`). ON by
  // default whenever REBASE_DROP is; `--no-rebase-drop` disables both (mirrors the manifest resolver's own
  // guard), `--no-content-rebase-drop` disables just this wider step.
  const CONTENT_REBASE_DROP = REBASE_DROP && !flags['no-content-rebase-drop'];
  // #2222 — pre-check id-collision self-heal (ON by default; `--no-heal-collision` disables). Before merging, a
  // certified PR whose NEW backlog item reuses an id already on main fails the required `test` check (`ids must
  // be unique`) — the merge blocks, so the post-merge heal (#2071) never runs. This renumbers the incoming new
  // item to a free GAP id and rebuilds the lane tip, so CI re-runs green and it lands on a later pass. Local
  // repos only (pure git plumbing needs the local clone).
  const HEAL_COLLISION = flags['no-heal-collision'] ? false : true;
  // #2230 — re-poll the label-scoped one-shot once to absorb the `ready-to-merge` index-propagation lag.
  const EXPECT = flags.expect != null && Number.isFinite(Number(flags.expect)) ? Number(flags.expect) : null;
  const REPOLL_SEC = Number.isFinite(Number(flags['repoll-delay'])) && Number(flags['repoll-delay']) >= 0 ? Number(flags['repoll-delay']) : 4;
  // #2216/#2421 — before a label-scoped sweep, bring every open producer PR's ci-lifecycle label to CI truth:
  // green-but-unlabelled → `ready-to-merge` (a `pr-land --label-on-green` that timed out left it stranded,
  // #2216's original scope), PLUS the #2281-ratified total coverage — `checking`/`ci:failed`/`blocked` — so no
  // ci-lifecycle state is ever left to be inferred from a label's absence. ON by default for the label-scoped
  // drain (it IS the reconcile point); `--no-reconcile-labels` disables both. Under `--watch` this re-labels
  // each interval — self-healing, with no human step and no per-check-tick `pr-land` write.
  const RECONCILE = label && !flags['no-reconcile-labels'];
  // #2171 — DETERMINISTIC review-escalation rubric: before merging a ready PR, score it (blast radius, size,
  // dismissed pre-PR findings, cross-repo couple, 1-in-N sampling); an escalated PR PARKS ALIVE (labelled
  // review:pending, SKIPPED — non-blocking, the queue keeps flowing) until a reviewer applies review:accepted.
  // ON by default for a label-scoped drain. `--sample-nth=N` tunes the floor.
  // #2423 — the RELIEF VALVE. `--no-review-escalation=<pr#>` (repeatable + comma-separated) is the PER-PR form:
  // it waives ONLY the named PR's agent-reviewable review:pending park (via `applyEscalationRelief` below), and
  // the rubric stays LIVE for every OTHER candidate — so REVIEW_ESCALATION is driven off `!passWide`, NOT flag
  // presence, and a scoped run keeps fresh gate-self/human-required detection firing for the rest of the pass.
  // A BARE `--no-review-escalation` is the legacy PASS-WIDE waiver (`passWide` → escalation off, whole pass);
  // it still works but is DEPRECATED — warned loudly below, pointing at the per-PR form.
  const escalationRelief = parseNoReviewEscalation(argv);
  const REVIEW_ESCALATION = label && !escalationRelief.passWide;
  if (escalationRelief.passWide && !AS_JSON) {
    process.stderr.write('  ⚠ --no-review-escalation (bare) is DEPRECATED: it waives the escalation rubric PASS-WIDE — EVERY candidate this pass merges unscored, incl. a fresh gate-self diff. Prefer the per-PR form --no-review-escalation=<pr#> (repeatable, comma-separated) to relieve just the stuck PR while the rubric stays live for the rest (#2423).\n');
  }
  const SAMPLE_NTH = Number.isFinite(Number(flags['sample-nth'])) && Number(flags['sample-nth']) > 0 ? Number(flags['sample-nth']) : undefined;
  // #2257 — the ONE /drain lander sweeps all 3 constellation repos. Derive the local repo slug from origin
  // (used to keep git-side ops — manifest read, rebase-drop, local-main sync — scoped to the local clone), then
  // resolve the repo set: `--repos=a,b` (explicit) / `--this-repo` (scoped single-repo) / neither → the
  // constellation (the #2287 default; `--all-repos` is accepted as a harmless no-op alias of the default).
  const localSlug = (() => {
    try {
      const url = execFileSync('git', ['remote', 'get-url', 'origin'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      const m = url.match(/[:/]([^/:]+\/[^/]+?)(?:\.git)?$/);
      return m ? m[1] : null;
    } catch { return null; }
  })();
  const REPOS = resolveRepos({ repos: typeof flags.repos === 'string' ? flags.repos : null, singleRepo: !!flags['this-repo'], self: localSlug });
  const repoFlag = (repo) => (repo ? ['--repo', repo] : []);      // a slug → scope the gh call; null → cwd repo
  const isLocalRepo = (repo) => repo == null || repo === localSlug; // git-side ops only run against the local clone
  const repoTag = (repo) => (repo && repo !== localSlug ? `${repo.split('/').pop()}#` : '#'); // display prefix per PR
  // #2262 — under `--watch`, `sweepOnce()` (below) runs every `--interval`s FOREVER; memoize which (repo, label)
  // pairs this process has already ensured exist so a long-lived watch doesn't `gh label create` the same
  // review:* labels every single pass (wasted round-trips on an idempotent one-time mint).
  const ensuredLabels = new Set();

  // #2263 — a SIBLING clone of a non-local constellation repo (`../frontierui`, `../plateau-app` next to this
  // WE clone) lets the rebase-drop plumbing rebuild THAT repo's lane tip too, instead of leaving every
  // CONFLICTING/BEHIND frontierui/plateau-app PR for its author. Best-effort + read-only-check: a repo whose
  // sibling directory is missing (not provisioned) or isn't a git working copy falls back to the prior skip —
  // nothing here clones on the fly (provisioning is the lane-pool allocator's job — #2303, see
  // skills-src/drain/SKILL.md's Preconditions).
  const siblingCloneDir = (repo) => {
    if (isLocalRepo(repo)) return null;
    const name = siblingCloneName(repo);
    if (!name) return null;
    const dir = resolve(process.cwd(), '..', name);
    try { return existsSync(join(dir, '.git')) ? dir : null; } catch { return null; }
  };

  // #2313 — post (or skip, if already posted) a drain reason comment on a PR. Best-effort: a `gh` miss never
  // fails the sweep. Reads the PR's existing comments once per call (only called for park/skip verdicts, not
  // every open PR) so a `--watch` loop dedupes on the SAME (kind, reason) with no extra state to maintain.
  // `auditLine` (xnsk54v follow-up) — the optional `manifestAuditLine` recording the escalation-sensitive
  // manifest values this verdict ACTED ON. Threaded into both the dedupe check and the posted body so an
  // unchanged decision de-dupes (idempotent) while a body-edited manifest value posts a fresh, timestamped
  // record — the tamper trail. It is ancillary to the reason (`reasonText` still gates posting), never the
  // sole trigger for a comment.
  const postDrainReasonComment = (repo, num, kind, reasonText, auditLine) => {
    if (DRY_RUN || !reasonText) return false;
    let comments = [];
    try {
      const data = JSON.parse(execFileSync('gh', ['pr', 'view', String(num), ...repoFlag(repo), '--json', 'comments'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim() || '{}');
      comments = Array.isArray(data.comments) ? data.comments : [];
    } catch { /* best-effort read; fall through and attempt the post anyway */ }
    if (hasDrainReasonComment(comments, kind, reasonText, auditLine)) return false;
    try { execFileSync('gh', ['pr', 'comment', String(num), ...repoFlag(repo), '--body', buildDrainReasonComment(kind, reasonText, auditLine)], { stdio: ['ignore', 'ignore', 'pipe'] }); return true; }
    catch { return false; }
  };

  const fail = (reason, detail, code) => {
    if (AS_JSON) process.stdout.write(JSON.stringify({ ok: false, reason, detail }) + '\n');
    else process.stderr.write(`merge-ai-prs ✗ ${reason}: ${detail}\n`);
    process.exit(code);
  };

  // Read a PR's lane manifest (#2188). xnsk54v — the manifest now rides the PR BODY (drain-only orchestration
  // metadata belongs ON the PR, not committed into the tree), so read it PR-BODY-FIRST via
  // `gh pr list --head <headRef> --json body` → `extractManifestFromBody`, mirroring lane-drain.mjs's
  // `readManifestFromPrBody`/`readManifestOffRef`. Fall back to the legacy tree-committed
  // `.lane-manifest.json` off the head ref for lanes queued BEFORE the cutover. Only a WE PR carries one; an
  // orphan/impl PR has none → null → always ready (the legacy unordered behaviour). Best-effort throughout: a
  // fetch/parse miss degrades to no-manifest, never throws.
  const readManifestFromPrBody = (repo, headRef) => {
    try {
      const out = execFileSync('gh', ['pr', 'list', '--head', headRef, '--state', 'open', ...repoFlag(repo), '--json', 'body'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      return extractManifestFromBody(JSON.parse(out || '[]')?.[0]?.body);
    } catch { return null; } // gh absent / no open PR for the ref / no block → fall through to the ref file
  };
  const readPrManifest = (repo, headRef) => {
    if (!headRef) return null;
    const fromPr = readManifestFromPrBody(repo, headRef);
    if (fromPr) return fromPr;
    // ── Legacy fallback: the tree-committed manifest (lanes queued before the PR-body cutover). ──
    if (!isLocalRepo(repo)) {
      // #2257 — a remote-repo PR has no local clone to `git show`; read the manifest off its head ref via the
      // GitHub API (`gh api …/contents/.lane-manifest.json?ref=<headRef>` → base64 `.content`). Best-effort:
      // an impl/orphan PR carries no manifest → null → always ready (the legacy unordered behaviour).
      // #2399 — `remoteManifestApiArgs` (shared, `scripts/lib/remote-manifest.mjs`) makes the `--method GET`
      // explicit; one argv for both the drain and lane-resume so the readers never drift.
      try {
        const b64 = execFileSync('gh', remoteManifestApiArgs(repo, headRef), { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
        if (b64) { const m = JSON.parse(Buffer.from(b64, 'base64').toString('utf8')); if (m && m.item != null) return m; }
      } catch { /* no manifest on this ref */ }
      return null;
    }
    try { execFileSync('git', ['fetch', 'origin', headRef, '--quiet'], { stdio: ['ignore', 'ignore', 'ignore'] }); } catch { /* ref may be local */ }
    for (const rev of ['FETCH_HEAD', `origin/${headRef}`, headRef]) {
      try {
        const txt = execFileSync('git', ['show', `${rev}:.lane-manifest.json`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
        const m = JSON.parse(txt);
        if (m && m.item != null) return m;
      } catch { /* try next rev */ }
    }
    return null;
  };

  // #2421 — ONE unfiltered per-repo PR listing + manifest read, shared by BOTH the cross-repo "is this backlog
  // item still open" set the `blocked` branch of `lifecycleLabelFromCiTruth` needs, AND the reconcile below —
  // instead of each independently re-listing + re-reading manifests for the SAME open-PR set (2x the `gh pr
  // list` calls and 2x the per-PR manifest reads every drain pass / `--watch` interval). An item is "open" iff
  // SOME open PR (any repo, any authorship — a blocker need not itself be an AI PR) carries a manifest naming
  // it — the SAME openness question `planLabelDrain` answers for the merge cascade, computed here independently
  // because this listing (like #2216's `reconcileGreenLabels` before it) is deliberately UNFILTERED-by-label,
  // so it must not depend on the (possibly `--label`-scoped) `verdicts` collected later this pass. Best-effort
  // throughout — a gh miss for one repo contributes nothing from that repo, never throws.
  const collectOpenPrContext = () => {
    const prsByRepo = new Map();
    const openItems = new Set();
    const manifestByPr = new Map();
    for (const repo of REPOS) {
      let open = [];
      try { open = JSON.parse(execFileSync('gh', ['pr', 'list', ...repoFlag(repo), '--state', 'open', '--limit', '100', '--json', 'number,title,labels,statusCheckRollup,headRefName'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim() || '[]'); }
      catch { /* this repo's listing failed — the mint loop still runs (idempotent); its reconcile loop below sees no PRs */ }
      prsByRepo.set(repo, open);
      for (const p of open) {
        const m = readPrManifest(repo, p.headRefName);
        manifestByPr.set(`${repo || 'cwd'}::${p.number}`, m);
        if (m && m.item != null) openItems.add(asItemId(m.item));
      }
    }
    return { prsByRepo, openItems, manifestByPr };
  };

  // #2421 — POST-CI TOTAL CI-LIFECYCLE LABEL RECONCILE, generalizing #2216's green-only `reconcileGreenLabels`
  // per the #2281 ruling. Every open, PRODUCER-OWNED (AI-generated) PR is brought to the state
  // `lifecycleLabelFromCiTruth` says it should be in — self-healing (runs every drain pass + `--watch`
  // interval), never a per-check-tick `pr-land` write. `ready-to-merge` keeps being applied by the EXISTING
  // mechanism below (unchanged — the `label` var, `shouldLabelOnGreen`) and is deliberately EXCLUDED from the
  // `owned` set this reconcile add/removes: stripping it here would drop a still-open, merely-reordered PR out
  // of the SAME PASS's `--label`-scoped `verdicts` listing (built right after this returns), which derives
  // `planLabelDrain`'s cross-item `openItems` set — a same-pass hazard that could let a PR blockedBy THIS one
  // wrongly read it as landed. So `ready-to-merge`'s presence/absence — the landing-gate signal #2183 F1 /
  // #2138 F4 depend on — is left to the pre-existing mechanic entirely; only `checking` / `ci:failed` /
  // `blocked` are added/removed here. A PR can therefore legitimately carry BOTH `ready-to-merge` AND `blocked`
  // at once (green, but still waiting on an item) — informative, not a merge-safety issue (the drain's
  // `blockedBy` defer already gates on the manifest directly, never on this label). Best-effort throughout — a
  // gh miss never fails the drain. Returns the reconciled PR numbers (for the pass summary), reported ONLY when
  // every label mutation this pass attempted for that PR actually succeeded (never a false-positive "reconciled"
  // on a silently-failed `gh pr edit`).
  const CI_LIFECYCLE_OWNED = [CI_LIFECYCLE_LABELS.checking, CI_LIFECYCLE_LABELS.failed, CI_LIFECYCLE_LABELS.blocked];
  const reconcileCiLifecycleLabels = (repo, ctx) => {
    if (!RECONCILE) return [];
    const open = ctx.prsByRepo.get(repo) || [];
    // Mint the two NEW labels once per (repo, process) — `ready-to-merge` is minted by pr-land.mjs (the first
    // applier); never re-minted here so its color/description keeps ONE single source. Mirrors the review-label
    // mint below: the WHOLE ensure-loop (including the `ensuredLabels` memoization) is skipped under DRY_RUN, so
    // a dry-run process never marks a label "ensured" without having actually minted it.
    if (!DRY_RUN) {
      for (const [name, meta] of Object.entries(CI_LIFECYCLE_LABEL_META)) {
        const ensureKey = `${repo || 'cwd'}::${name}`;
        if (ensuredLabels.has(ensureKey)) continue;
        ensuredLabels.add(ensureKey);
        try { execFileSync('gh', ['label', 'create', name, '--color', meta.color, '--description', meta.description, ...repoFlag(repo)], { stdio: ['ignore', 'ignore', 'pipe'] }); } catch { /* already exists — fine */ }
      }
    }
    const reconciled = [];
    for (const p of open) {
      let commits = [];
      try { commits = JSON.parse(execFileSync('gh', ['pr', 'view', String(p.number), ...repoFlag(repo), '--json', 'commits'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim() || '{}').commits || []; } catch { continue; }
      const withCommits = { ...p, commits };
      let touched = false;
      // ── The legacy #2216 branch: green-but-unlabelled → ready-to-merge (label lander's collection signal),
      //    UNCHANGED — see the `owned` note above for why this stays separate from the add/remove state below. ──
      if (!hasLabel(p, label) && shouldLabelOnGreen(withCommits, { requiredCheck: REQUIRED, label })) {
        if (DRY_RUN) { touched = true; if (!AS_JSON) process.stderr.write(`  🏷 ${repoTag(repo)}${p.number} would label "${label}" (required check green, was unlabelled)\n`); }
        else {
          try { execFileSync('gh', ['pr', 'edit', String(p.number), ...repoFlag(repo), '--add-label', label], { stdio: ['ignore', 'ignore', 'pipe'] }); touched = true; if (!AS_JSON) process.stderr.write(`  🏷 ${repoTag(repo)}${p.number} labelled "${label}" (post-CI reconcile — required check went green after a label-on-green timeout)\n`); }
          catch { /* a label race/permission miss is non-fatal — the next pass retries */ }
        }
      }
      // ── The #2421 TOTAL branch: every producer-owned open PR gets its checking/ci:failed/blocked state
      //    reconciled (mutually exclusive among themselves, cleared once none applies — e.g. once green). ──
      if (isAiGeneratedPr(withCommits)) { // only the producer's own AI PRs — never a human orphan (mirrors #2216)
        const manifest = ctx.manifestByPr.get(`${repo || 'cwd'}::${p.number}`) ?? null;
        const blockedBy = manifest && Array.isArray(manifest.blockedBy) ? manifest.blockedBy.map(asItemId) : [];
        const blocked = blockedBy.some((b) => ctx.openItems.has(b));
        const desired = lifecycleLabelFromCiTruth({
          blocked,
          checkGreen: isRequiredCheckGreen(p, REQUIRED),
          checkFailed: isRequiredCheckFailed(p, REQUIRED),
        });
        const plan = planCiLifecycleLabelUpdate({ currentLabels: p.labels, desired, owned: CI_LIFECYCLE_OWNED });
        if (plan.toAdd.length || plan.toRemove.length) {
          if (DRY_RUN) {
            touched = true;
            if (!AS_JSON) process.stderr.write(`  🏷 ${repoTag(repo)}${p.number} would reconcile ci-lifecycle → "${desired}"${plan.toRemove.length ? ` (drop ${plan.toRemove.join(', ')})` : ''}\n`);
          } else {
            let ok = true;
            for (const rm of plan.toRemove) { try { execFileSync('gh', ['pr', 'edit', String(p.number), ...repoFlag(repo), '--remove-label', rm], { stdio: ['ignore', 'ignore', 'pipe'] }); } catch { ok = false; /* best-effort — the next pass retries */ } }
            for (const add of plan.toAdd) { try { execFileSync('gh', ['pr', 'edit', String(p.number), ...repoFlag(repo), '--add-label', add], { stdio: ['ignore', 'ignore', 'pipe'] }); } catch { ok = false; /* a label race/permission miss is non-fatal — the next pass retries */ } }
            if (ok) { touched = true; if (!AS_JSON) process.stderr.write(`  🏷 ${repoTag(repo)}${p.number} ci-lifecycle → "${desired}" (reconcile)\n`); }
          }
        }
      }
      if (touched) reconciled.push(p.number);
    }
    return reconciled;
  };

  // ── ONE sweep pass — reconcile labels → list → classify → cascade-merge → sync. Returns the pass result (no
  // emit/exit), so the watch loop can call it repeatedly. A gh-list failure still hard-fails (bad env).
  const sweepOnce = () => {
  // #2257 — collect + classify across EVERY repo in the sweep set into ONE global candidate list. PR numbers
  // are per-repo (WE #10 ≠ FUI #10), so each verdict carries its own `repo` + head ref instead of a
  // number-keyed cross-repo map. The single list is what lets the cascade honour cross-repo `blockedBy`.
  const reconciledLabels = [];
  const verdicts = [];
  // #2421 — the shared open-PR listing + manifest reads + cross-repo item-openness set the reconcile below
  // needs, computed ONCE for this pass (RECONCILE-gated — same cost profile as the reconcile it feeds: free on
  // a bare, unlabelled sweep).
  const openPrContext = RECONCILE ? collectOpenPrContext() : { prsByRepo: new Map(), openItems: new Set(), manifestByPr: new Map() };
  for (const repo of REPOS) {
    reconciledLabels.push(...reconcileCiLifecycleLabels(repo, openPrContext)); // #2421 (generalizes #2216) — total ci-lifecycle relabel first
    // List open PRs WITHOUT commits (commits×authors×limit overflows GitHub's GraphQL node cap), then fetch each
    // candidate's commits per-PR — the rollup + mergeable come from the list; commits (the AI gate) come per PR.
    const listArgs = ['pr', 'list', ...repoFlag(repo), '--state', 'open', '--limit', '100',
      '--json', 'number,title,body,headRefName,baseRefName,mergeable,mergeStateStatus,statusCheckRollup,labels'];
    if (base) listArgs.push('--base', base);
    if (label) listArgs.push('--label', label);
    let prs;
    try { prs = JSON.parse(execFileSync('gh', listArgs, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim() || '[]'); }
    catch (e) { fail('gh-error', `gh pr list${repo ? ` --repo ${repo}` : ''} failed (${String(e.message || e).split('\n')[0]}) — is gh authenticated?`, 3); }

    if (onlyPr) prs = prs.filter((p) => String(p.number) === onlyPr);
    // Attach each PR's commits (per-PR fetch avoids the node-cap overflow of asking for them in the list).
    for (const p of prs) {
      try { p.commits = JSON.parse(execFileSync('gh', ['pr', 'view', String(p.number), ...repoFlag(repo), '--json', 'commits'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim() || '{}').commits || []; }
      catch { p.commits = []; } // no commits ⇒ isAiGeneratedPr → false → skipped (never merged on missing data)
    }
    for (const p of prs) {
      const v = classifyPr(p, { requiredCheck: REQUIRED });
      v.repo = repo;               // null (local clone) or a slug — routes the merge/view/edit + the git-side gate
      v.headRef = p.headRefName;
      // #2188: attach the manifest (backlog `item` + cross-item `blockedBy`) so the GLOBAL cascade honours
      // cross-repo dependencies. Only a WE lane carries one; the rest degrade to no-manifest → always ready.
      const m = readPrManifest(repo, p.headRefName);
      // #2388 — `asItemId` (not a bare `Number()`) keeps a hash-keyed item (e.g. `x5lail9`, JIT numbering
      // #2288) as its own distinct string; the legacy fallback path below reads a raw un-normalized manifest
      // off `git show`/`gh api` (bypassing `buildManifest`'s own `asItemId` pass), so this coercion is still
      // needed even though the PR-body path already normalized it.
      v.item = m && m.item != null ? asItemId(m.item) : null;
      v.blockedBy = m && Array.isArray(m.blockedBy) ? m.blockedBy.map(asItemId) : [];
      v.hasManifest = m != null; // #2183 — carries the transient manifest on its head → must be stripped before merge
      // #2393 — the overlap-stacking edge + the couple's lane refs. `stackParents` gates this PR behind its
      // parents' proven land; `manifestRefs` (every repo's lane ref in this couple, impl-first/WE-last) is what
      // `joinImplToCouples` indexes so a manifest-LESS impl PR inherits this couple's item/blockedBy/stackParents.
      v.stackParents = m && Array.isArray(m.stackParents) ? m.stackParents.map(asItemId) : [];
      v.manifestRefs = m && Array.isArray(m.repos) ? m.repos.map((r) => r && r.ref).filter(Boolean) : [];
      // #2171 review-escalation signals off the manifest: cross-repo couple (>1 repo) + dismissed pre-PR findings.
      v.crossRepo = m && Array.isArray(m.repos) ? m.repos.length > 1 : false;
      // #2390 — the SHA this repo's lane was cut from (a predecessor tip when overlap-stacked, #2387). Scoring
      // from it below diffs the lane on its OWN delta, not the cumulative stack. `isLocalRepo` is the WE clone
      // the drain runs in → key `we` (default when the origin slug is underivable); a sibling slug maps by short
      // name. A missing/unmatched base is `null` → the scorer falls through to the unchanged `origin/main` basis.
      v.base = manifestBaseForRepo(m, isLocalRepo(v.repo) ? (repoKeyFromSlug(localSlug) || 'we') : repoKeyFromSlug(v.repo));
      v.dismissedFindings = m && Number.isFinite(Number(m.dismissedFindings)) ? Number(m.dismissedFindings) : 0;
      v.prLabels = p.labels || [];
      verdicts.push(v);
    }
  }
  // #2393 — the impl-PR→WE-manifest `laneRef` join: a manifest-less impl PR (frontierui/plateau-app) INHERITS
  // its couple's item + blockedBy + stackParents from the WE manifest that names its head ref in `repos[]`, so
  // it is gated WITH its couple (couple-granular, impl-first/WE-last) instead of reading as an always-ready
  // orphan. Runs once the GLOBAL candidate list is complete (a couple's impl + WE PRs can be in different repos).
  joinImplToCouples(verdicts);
  // #2393 — the `stackParents` proof-of-land gate's SECOND proof source: a parent that landed in a PRIOR drain
  // session, read off `origin/main`'s durable `bornAs:<hash>` record (#2392). Computed ONCE per pass over every
  // distinct stackParent hash (numeric ids are already-landed by construction — handled inside planLabelDrain;
  // a parent landing THIS run is captured by the caller's in-memory `landedThisPass`). `landedNumberFor` is a
  // local `git grep origin/main` — cheap, best-effort (a miss → not proven → the descendant defers, the safe
  // direction). Only meaningful for the local WE clone (where origin/main carries the backlog).
  const provenOnMain = new Set();
  const stackParentIds = new Set();
  for (const v of verdicts) for (const sp of Array.isArray(v.stackParents) ? v.stackParents : []) stackParentIds.add(asItemId(sp));
  for (const sp of stackParentIds) {
    if (isHash(String(sp)) && landedNumberFor(String(sp), process.cwd()) != null) provenOnMain.add(sp);
  }
  // #2393 — the in-memory "landed THIS run" proof set, populated on each WE-carrier merge below (the WE PR is
  // the resolve carrier + the point `bornAs` is stamped, so a descendant only counts a parent landed once the
  // parent's WE side lands — never on a green impl PR of an otherwise-broken couple). Threaded into every
  // planLabelDrain call this pass so a chain lands in order.
  const landedThisPass = new Set();
  // #2222 — PRE-CHECK id-collision self-heal, retained here (THE drain, the sole writer to main, #2290) as a
  // DORMANT BACKSTOP under JIT numbering (#2288/#2291): a new item is now born hash-keyed, so a lane's NEW item
  // reusing a base `NNN` should be unrepresentable pre-land — this stays a cheap no-op on the common path, kept
  // as defense-in-depth (not deleted) rather than pruned like the now-dead duplicate precheck this same helper
  // used to run on the deprecated `/pr` producer route (pruned, #2291 — see pr-land.mjs).
  // A certified PR whose NEW backlog item reuses an id already on main fails the required `test` check (`ids
  // must be unique`), so it never becomes landable and the merge blocks the post-merge heal. Detect it cheaply
  // (base vs lane backlog names) and, only on a real collision, rebuild the lane tip with the new item
  // renumbered to a free GAP id — CI re-runs green and it lands on a later pass. Local-repo candidates only
  // (pure git plumbing needs the local clone); best-effort, never fatal. Dry-run annotates without pushing.
  const healed = [];
  if (HEAL_COLLISION) {
    for (const v of verdicts) {
      // Only a certified candidate that is NOT already landable is worth healing — a red required check is the
      // symptom of the collision. A landable PR has no collision (it passed `ids must be unique`); skip it.
      const certified = !!(v.certifyLabel || v.aiGenerated);
      if (!certified || v.decision === 'merge') continue;
      if (!isLocalRepo(v.repo) || !v.headRef) continue;
      // #2276 — a rebase-drop candidate (stale-green + BEHIND/CONFLICTING) is healed INSIDE the rebase-drop
      // rebuild below (one rebuilt tip drops the manifest AND renumbers), so skip it here to avoid a double
      // rebuild. The standalone rebuild then only covers a collision-RED PR that is not a rebase-drop candidate.
      if (REBASE_DROP && isRebaseDropCandidate(v)) continue;
      if (DRY_RUN) {
        // Cheap detect only (no push) so the dry-run plan can flag a collision without mutating anything.
        const probe = healNnnCollision({ laneRef: v.headRef, base: 'origin/main', run: (cmd, args, opts) => (args[0] === 'push' || args[0] === 'commit-tree' || args[0] === 'update-index' || args[0] === 'write-tree' || args[0] === 'read-tree' || args[0] === 'hash-object' || args[0] === 'cat-file' ? { status: 0, stdout: '' } : gitRunner(cmd, args, opts)) });
        if (probe.action === 'error' && !AS_JSON) process.stderr.write(`  ⚠ ${repoTag(v.repo)}${v.num} could not probe id collision (${probe.reason})\n`);
        continue;
      }
      const h = healNnnCollision({ laneRef: v.headRef, base: 'origin/main' });
      if (h.action === 'rebased') {
        v.collisionHealed = h.renumbered;
        healed.push(v.num);
        // The tip advanced; its `test` check is re-running on the renumbered tree, so it lands on a later pass
        // (mirrors the rebase-drop pending-rebuild contract). Leave it skipped this pass.
        if (!AS_JSON) process.stderr.write(`  ↻ ${repoTag(v.repo)}${v.num} renumbered new-item id collision (${h.renumbered.map((r) => `#${r.oldNum}→#${r.newNum}`).join(', ')}) → ${h.newCommit.slice(0, 9)}; awaiting re-run of checks\n`);
      } else if (h.action === 'error' && !AS_JSON) {
        process.stderr.write(`  ⚠ ${repoTag(v.repo)}${v.num} id-collision heal skipped (${h.reason})\n`);
      }
    }
  }

  // #2198 — rebase-drop the transient manifest so a certified+green PR that is only CONFLICTING/BEHIND on the
  // shared `.lane-manifest.json` path lands instead of walling the whole queue. Per candidate: merge-tree
  // main×lane; if the ONLY conflict is the manifest, rebuild its tip onto main (manifest dropped) via pure
  // plumbing (no checkout) and push to the lane/* ref — then it is CLEAN and the cascade merges it. A real code
  // conflict stays a skip. Dry-run only ANNOTATES (no push). Disable with `--no-rebase-drop`.
  const rebased = [];
  if (REBASE_DROP) {
    for (const v of verdicts) {
      // Rebuild-to-drop the manifest when the PR is BLOCKED on it (CONFLICTING/BEHIND) OR when it is already
      // landable but still CARRIES the manifest on its head (#2183 first-lander leak — a clean merge would
      // otherwise commit the transient file to `main`). Both cases route through the same plumbing.
      if (!isRebaseDropCandidate(v) && !needsManifestStripBeforeMerge(v)) continue;
      const laneRef = v.headRef;
      if (!laneRef) continue;
      // #2198/#2263 — rebase-drop is pure git plumbing (merge-tree/commit-tree/push): for the LOCAL clone's
      // repo it runs in `process.cwd()` unchanged; for a REMOTE constellation repo (frontierui/plateau-app) it
      // routes through that repo's own SIBLING clone (`../frontierui`, `../plateau-app`) when one is provisioned
      // — the fetch/merge-tree/push all resolve against that clone's own `origin`. No sibling clone found ⇒ the
      // prior "left for its author" skip (rebasing it needs a clone of that repo).
      const cloneDir = isLocalRepo(v.repo) ? undefined : siblingCloneDir(v.repo);
      if (!isLocalRepo(v.repo) && !cloneDir) {
        if (isRebaseDropCandidate(v)) { v.rebaseDrop = 'skipped-remote'; if (!AS_JSON) process.stderr.write(`  ↻ ${repoTag(v.repo)}${v.num} needs rebase in a ${v.repo} clone (no sibling clone provisioned — rebase-drop is local-only); left for its author\n`); }
        continue;
      }
      if (DRY_RUN) {
        v.rebaseDrop = 'would-attempt';
        if (!AS_JSON) process.stderr.write(`  ↻ ${repoTag(v.repo)}${v.num} would rebase-drop manifest (state ${v.state}/${v.mergeable})${cloneDir ? ` via ${cloneDir}` : ''} then merge\n`);
        continue;
      }
      let r = rebaseDropManifest({ laneRef, base: 'origin/main', healCollision: HEAL_COLLISION, run: gitRunner, cwd: cloneDir });
      // #2371 — a REAL (non-manifest) conflict is the manifest resolver's own skip boundary; retry it with the
      // wider content resolver, which ONLY auto-resolves if every conflicting hunk is non-overlapping. Its own
      // skip (a genuine overlapping/unsafe hunk) is left exactly as before — surfaced for `/finish`.
      let contentResolved = false;
      if (r.action === 'skip' && CONTENT_REBASE_DROP && /^real conflict beyond /.test(r.reason || '')) {
        const cr = rebaseDropContent({ laneRef, base: 'origin/main', run: gitRunner, cwd: cloneDir });
        if (cr.action === 'rebased') { r = cr; contentResolved = true; }
        else if (cr.action === 'error' && !AS_JSON) {
          process.stderr.write(`  ⚠ ${repoTag(v.repo)}${v.num} content-conflict resolve errored (${cr.reason})\n`);
        }
      }
      v.rebaseDrop = r.action;
      if (r.action === 'rebased') {
        v.decision = 'merge';
        const healTag = r.healed && r.healed.length ? ` (renumbered ${r.healed.map((h) => `#${h.oldNum}→#${h.newNum}`).join('/')})` : '';
        const contentTag = contentResolved ? ` (auto-resolved non-overlapping content conflict in ${r.mergedPaths.join(', ')})` : '';
        v.reason = `rebased onto main${r.dropped || r.droppedManifest ? ' (dropped manifest)' : ''}${healTag}${contentTag}, required check green — landable`;
        if (r.healed && r.healed.length) v.collisionHealed = r.healed;
        if (contentResolved) v.contentRebaseDrop = r.mergedPaths;
        rebased.push(v.num);
        if (!AS_JSON) process.stderr.write(`  ↻ ${repoTag(v.repo)}${v.num} rebased onto main${r.dropped || r.droppedManifest ? ' (manifest dropped)' : ''}${healTag}${contentTag}${cloneDir ? ` (via ${cloneDir})` : ''} → ${r.newCommit.slice(0, 9)}\n`);
      } else if (r.action === 'current') {
        // IDEMPOTENCY (drain re-push churn bug) — the tip is ALREADY on main and manifest-free; rebaseDropManifest minted/pushed NOTHING. Treat
        // it as landable (proceed to merge) but do NOT count it as churn — no head SHA changed, so it must NOT
        // join the `rebased` list (that list is the "we just repushed, CI will restart" set). This is the whole
        // fix: a green, on-main, manifest-free PR stops getting its head rewritten every drain pass.
        v.decision = 'merge';
        v.reason = `already up-to-date on main (manifest-free), required check green — landable`;
        if (!AS_JSON) process.stderr.write(`  ↻ ${repoTag(v.repo)}${v.num} already current on main (manifest-free) — no rebuild needed\n`);
      } else if (!AS_JSON) {
        process.stderr.write(`  ↻ ${repoTag(v.repo)}${v.num} left skipped: ${r.reason}\n`);
      }
    }
  }

  // #2366 — CONCURRENT-LANDER BACKSTOP. The bare `/merge` orphan sweep never runs the `REVIEW_ESCALATION` pass
  // below (that pass is `--label`-gated), so without this it would happily merge a PR a label-scoped `/drain`
  // pass already parked under `review:pending`/`review:human`, or bounced under `review:changes` — the race
  // that shipped plateau#11 and web-everything#290 before their review panels' verdicts landed. Only fires when
  // this pass ISN'T already running the full rubric (`decideReviewGate` re-derives the correct verdict itself —
  // double-gating here on raw label presence would fight that richer verdict).
  //
  // The `!REVIEW_ESCALATION` gate catches TWO invocations, and they get DIFFERENT refusals (see
  // `hasUnclearedReviewLabel`'s `allowPending`): the truly-bare sweep (no `--label`) has no verdict owner, so it
  // refuses every un-cleared label (`allowPending: false`); a `--label --no-review-escalation` run is the
  // operator deliberately waiving escalation to push a green-but-parked `review:pending` PR through (#2262's
  // documented manual override), so it honors that on `review:pending` (`allowPending: true`) but STILL refuses
  // `review:human` (human-only, never waivable — #2285) and `review:changes` (reviewer rejected). A blunt gate
  // that refused all three under the override would strand the very PR the operator invoked the flag to land;
  // one that relaxed all three would let an un-reviewed gate-self edit merge — both are wrong.
  if (!REVIEW_ESCALATION) {
    const allowPending = !!label; // `--label ... --no-review-escalation`: explicit operator override, honor review:pending
    for (const v of verdicts) {
      if (v.decision !== 'merge') continue;
      if (hasUnclearedReviewLabel(v.prLabels, { allowPending })) {
        v.decision = 'skip';
        v.reason = allowPending
          ? 'review:human/review:changes not cleared — refusing to merge even under --no-review-escalation (human-only / reviewer-rejected, #2366)'
          : 'review-escalation label not cleared (review:pending/review:human/review:changes present without review:accepted) — refusing to merge (#2366)';
      }
    }
  }

  // #2171 — REVIEW-ESCALATION PASS. Before merging, score each ready candidate against the deterministic rubric.
  // An escalated PR PARKS ALIVE — labelled review:pending and SKIPPED (non-blocking: the cascade keeps landing
  // the rest) — until a reviewer applies review:accepted. review:changes → the author lane fixes + re-pushes.
  // Every candidate is STAMPED with the rule outcome (escalated yes/no + reasons). Couples: any WE-PR carrying
  // the manifest already fails-strict via crossRepo, so an escalated impl half keeps its WE half from landing
  // through the existing blockedBy ordering. Signals: blast radius (diff files), size, dismissed findings +
  // cross-repo (manifest), 1-in-N sampling. Best-effort per candidate; a signal-fetch miss defaults to no-escalate.
  const parked = [];
  if (REVIEW_ESCALATION) {
    // #2262 fix (1/2) — the `review:*` verdict labels are never minted anywhere (unlike `ready-to-merge`,
    // which `pr-land.mjs` `gh label create`s before first use), so `gate.applyLabel` below silently no-ops:
    // `gh` returns "not found" and the catch swallows it — the park applies NO visible label. Mint every
    // label (idempotent — an existing label errors harmlessly), memoized per (repo, label) via `ensuredLabels`
    // so a long-lived `--watch` mints each one ONCE per process rather than every single pass (same convention
    // as `pr-land.mjs`'s one-time `ready-to-merge` mint).
    // #2279 — color + description are single-sourced from REVIEW_LABEL_META (review-escalation.mjs) so the
    // provisioner and the applier never drift, and EVERY verdict label (incl. review:human, #2285) is minted
    // with its real color/description, not a placeholder — no label silently no-ops on a fresh repo.
    if (!DRY_RUN) {
      // #2257 — a multi-repo sweep scores candidates from several repos in one pass; a label lives per-repo on
      // GitHub, so mint it in EVERY repo actually carrying a candidate this pass (not just the local repo).
      const escalationRepos = new Set(verdicts.filter((v) => v.decision === 'merge').map((v) => v.repo || null));
      for (const repo of escalationRepos) {
        for (const [name, meta] of Object.entries(REVIEW_LABEL_META)) {
          const ensureKey = `${repo || 'cwd'}::${name}`;
          if (ensuredLabels.has(ensureKey)) continue;
          ensuredLabels.add(ensureKey);
          try { execFileSync('gh', ['label', 'create', name, '--color', meta.color, '--description', meta.description, ...repoFlag(repo)], { stdio: ['ignore', 'ignore', 'pipe'] }); } catch { /* already exists — fine */ }
        }
      }
    }
    // #2414 — the first-drain-sighting manifest baseline store: captured first-seen below, diffed at land to
    // catch a post-queue body edit that WEAKENS the manifest (edit-DOWN or full STRIP). Tolerant read — a
    // missing/corrupt file makes every PR re-capture from its CURRENT body; if that current body is already
    // tampered (cache lost while a tamper is live), the gate both fails open AND launders the tampered values
    // into the new baseline for all future passes (durable bypass, not a one-pass gap — see the module doc).
    let baselineState = emptyBaselineState();
    try { baselineState = parseBaselineState(readFileSync(REVIEW_BASELINE_STATE_PATH, 'utf8')); } catch { /* no file yet — fresh baselines */ }
    let baselineStateChanged = false;
    for (const v of verdicts) {
      if (v.decision !== 'merge') continue;
      let changedFiles = [];
      let diffLines = 0;
      // #2390-review-fix — the CUMULATIVE origin/main…head file set the gate-self/human trigger scores over
      // (never de-inflated by a stacked base). `null` → scoreEscalation falls back to `changedFiles`.
      let humanBasisFiles = null;
      // #2373 — score off the SHARED net-diff basis (`computeNetDiffChangedFiles`, also used by the
      // producer path in pr-land.mjs — the ONE place this basis is computed, #1821's original fix folded
      // in). Best-effort local git read (needs the local clone or a provisioned sibling clone); falls back
      // to the old GitHub files-list read if neither is available.
      const escCwd = isLocalRepo(v.repo) ? undefined : siblingCloneDir(v.repo);
      let netScored = false;
      if (v.headRef && (isLocalRepo(v.repo) || escCwd)) {
        const exec = (cmd, args, opts) => execFileSync(cmd, args, { cwd: escCwd, ...opts });
        const net = computeNetDiffChangedFiles({ exec, rev: v.headRef, baseRev: v.base, fetchExtraRefs: [v.headRef] });
        changedFiles = net.changedFiles;
        diffLines = net.diffLines;
        humanBasisFiles = net.humanBasisFiles;
        netScored = net.scored;
      }
      if (!netScored) {
        try {
          const files = JSON.parse(execFileSync('gh', ['pr', 'view', String(v.num), ...repoFlag(v.repo), '--json', 'files'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim() || '{}').files || [];
          changedFiles = files.map((f) => f.path).filter(Boolean);
          diffLines = files.reduce((s, f) => s + (Number(f.additions) || 0) + (Number(f.deletions) || 0), 0);
          // The gh files list is the PR's full diff vs its base branch (main) — already cumulative, so it IS the
          // human-gate basis (a stacked base never de-inflates this fallback path).
          humanBasisFiles = changedFiles;
        } catch { /* signal-fetch miss → score on the manifest signals alone */ }
      }
      const score = scoreEscalation({ changedFiles, diffLines, humanBasisFiles, dismissedFindings: v.dismissedFindings, crossRepo: v.crossRepo, prNum: Number(v.num), thresholds: SAMPLE_NTH ? { sampleNth: SAMPLE_NTH } : {} });
      // #2414 — first-drain-sighting manifest baseline gate. The manifest values (`v.hasManifest`/
      // `dismissedFindings`/`crossRepo`/`blockedBy`) are re-read from the LIVE PR body every pass
      // (readPrManifest), so we can capture what the drain FIRST saw for a ready-to-merge PR and diff a later
      // pass against it. #2415 records tamper-EVIDENCE into a durable comment, but its land stamp is gated on
      // `c.hasManifest`, so a full manifest STRIP (block deleted → hasManifest false → "no manifest, always
      // ready") slips through with NO record. Diffing the live manifest against the first-sighting baseline
      // GATES both the strip and the edit-DOWN uniformly, and — because the baseline is captured at first
      // sighting and checked at land regardless — without depending on a prior park having fired. First-seen-
      // wins (recordBaseline keeps the honest first capture); the diff flags ONLY the escalation-WEAKENING
      // direction, so an honest strengthening edit never blocks a land.
      // COVERAGE (honest): this is a POST-QUEUE window, not a from-review guarantee. A manifest weakened BEFORE
      // the PR reached ready-to-merge is captured here in its already-weak form and becomes the trusted baseline
      // — the gate is a no-op for that PR. And if the local cache is lost while a tamper is live, `priorBaseline`
      // is null so the tampered body is (re-)captured as the baseline AND the diff fails open — a durable
      // bypass. The same code path can't tell a cache-loss re-sighting from a genuine first sighting without a
      // durable per-PR signal, so it is not defended here (see review-baseline-state.mjs's cache-loss residual).
      const liveManifestValues = { hasManifest: !!v.hasManifest, dismissedFindings: v.dismissedFindings, crossRepo: v.crossRepo, blockedBy: v.blockedBy };
      const priorBaseline = getBaseline(baselineState, { repo: v.repo, num: v.num });
      if (!priorBaseline && !DRY_RUN) {
        const nextBaseline = recordBaseline(baselineState, { repo: v.repo, num: v.num }, liveManifestValues);
        if (nextBaseline !== baselineState) { baselineState = nextBaseline; baselineStateChanged = true; }
      }
      const tamper = diffBaseline(priorBaseline, liveManifestValues);
      if (tamper.tampered) {
        // A post-review WEAKENING edit — refuse the auto-land and re-park for a HUMAN look (a manifest tamper
        // is a trust-chain concern the agent panel must not clear for itself). `skip` keeps it out of the
        // merge cascade AND keeps it blocking its dependents; the durable comment records WHAT changed vs the
        // reviewed baseline (tamper-evidence that now GATES, not just informs).
        v.decision = 'skip';
        v.escalated = 'yes';
        v.humanRequired = true;
        v.escalateReasons = tamper.reasons;
        v.reason = `manifest baseline mismatch — post-review tamper suspected: ${tamper.reasons.join('; ')}`;
        if (!DRY_RUN) {
          if (shouldApplyReviewLabel(REVIEW_LABELS.human, v.prLabels)) {
            try { execFileSync('gh', ['pr', 'edit', String(v.num), ...repoFlag(v.repo), '--add-label', REVIEW_LABELS.human], { stdio: ['ignore', 'ignore', 'pipe'] }); } catch { /* label best-effort */ }
          }
          const posted = postDrainReasonComment(v.repo, v.num, 'park', v.reason, auditLineFor(v));
          if (posted && !AS_JSON) process.stderr.write(`  💬 ${repoTag(v.repo)}${v.num} manifest-tamper baseline mismatch stamped on PR\n`);
        }
        parked.push({ num: v.num, repo: v.repo || localSlug, humanRequired: true, reasons: tamper.reasons });
        if (!AS_JSON) process.stderr.write(`  ⏸ ${repoTag(v.repo)}${v.num} re-parked — manifest baseline mismatch (post-review tamper, HUMAN required): ${tamper.reasons.join('; ')}\n`);
        continue;
      }
      const gate = decideReviewGate({ escalate: score.escalate, humanRequired: score.humanRequired, labels: v.prLabels });
      v.escalated = score.escalate ? 'yes' : 'no';
      // #2365 — gate.humanRequired (not score.humanRequired): decideReviewGate's verdict is the sticky one (#2362
      // makes an already-applied review:human label win even when a rebase narrows the diff back to
      // humanRequired:false); the drain caller must report THAT verdict, never the fresh-diff score alone, or a
      // label-only human park gets reported as agent-reviewable and an agent panel can clear its own gate change.
      v.humanRequired = !!gate.humanRequired; // #2285 v1 — gate-self conflict of interest: an agent may NOT auto-review this; a human must
      v.escalateReasons = score.reasons;
      // #2423 — the per-PR relief valve. If THIS PR was named in `--no-review-escalation=<pr#>`, waive an
      // agent-reviewable review:pending park to a merge (NEVER review:human/review:changes — see
      // applyEscalationRelief). The rubric still RAN for it (the fresh gate-self/human score above fired), and it
      // still ran for every OTHER candidate this pass — relief is scoped to this one PR, not the whole pass.
      const relief = applyEscalationRelief(gate, { relieved: escalationRelief.prs.includes(Number(v.num)) });
      if (relief.waive) {
        v.reliefWaived = true;
        if (!AS_JSON) process.stderr.write(`  🔓 ${repoTag(v.repo)}${v.num} relieved — ${relief.reason}: ${score.reasons.join('; ') || 'agent-reviewable'}\n`);
        // leave v.decision === 'merge' → falls through to the land cascade below.
      } else if (gate.action === 'park' || gate.action === 'wait-author') {
        v.decision = 'skip';
        v.reason = gate.reason + (score.reasons.length ? ` [${score.reasons.join('; ')}]` : '');
        // #2307 — a PR the PRODUCER already labelled at PR-open (or a prior drain pass already caught) is
        // already-scored: this pass is an idempotent backstop/reconcile, not the first applier, so skip the
        // redundant `gh pr edit --add-label` call when the verdict label is already present (never a
        // double-apply). `shouldApplyReviewLabel` is the SAME shared gate `pr-land.mjs` uses at open, so
        // producer- and drain-applied verdicts can never drift on what "already labelled" means.
        if (gate.applyLabel && !DRY_RUN) {
          if (shouldApplyReviewLabel(gate.applyLabel, v.prLabels)) {
            try { execFileSync('gh', ['pr', 'edit', String(v.num), ...repoFlag(v.repo), '--add-label', gate.applyLabel], { stdio: ['ignore', 'ignore', 'pipe'] }); } catch { /* label best-effort */ }
          }
          // #2313 — stamp the WHY + what-to-look-for onto the PR itself, not only this log line below.
          // #2333 — but ONLY for a NON-human (agent-reviewable) park: a review:human park already carries the
          // same reason in its PR body (#2324's block, written below), so a park comment there would duplicate
          // it. Fire the comment in the `else` of humanRequired.
          if (shouldPostParkReasonComment({ humanRequired: gate.humanRequired })) {
            // xnsk54v follow-up — record the escalation-sensitive manifest values THIS park acted on (the same
            // `dismissedFindings`/`crossRepo`/`blockedBy` that fed `scoreEscalation` above) into the durable,
            // timestamped comment. Only for a manifest-carrying PR (an orphan/impl PR has nothing body-sourced
            // to record — its comment stays byte-identical to before). Does not change the verdict/label already
            // decided above; it only records what was acted on, so a later body edit is tamper-evident.
            const posted = postDrainReasonComment(v.repo, v.num, 'park', v.reason, auditLineFor(v));
            if (posted && !AS_JSON) process.stderr.write(`  💬 ${repoTag(v.repo)}${v.num} escalation reason stamped on PR\n`);
          }
        }
        // #2324 (guarantee 2) — a `review:human` park must STATE the escalation reason IN THE PR BODY, so the
        // operator opening it sees why a human is required without re-deriving it from the rubric. Augment
        // (never replace) the live body with the marked block at park time, then verify the write landed —
        // best-effort (a write/verify miss is surfaced, never fatal: the label already carries the signal).
        if (gate.humanRequired && !DRY_RUN) {
          let liveBody = '';
          try { liveBody = JSON.parse(execFileSync('gh', ['pr', 'view', String(v.num), ...repoFlag(v.repo), '--json', 'body'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim() || '{}').body || ''; } catch { /* fetch miss — augment from empty, still best-effort */ }
          if (!bodyHasEscalationReason(liveBody)) {
            const newBody = liveBody + buildEscalationReasonBlock(score.reasons);
            try { execFileSync('gh', ['pr', 'edit', String(v.num), ...repoFlag(v.repo), '--body', newBody], { stdio: ['ignore', 'ignore', 'pipe'] }); }
            catch { if (!AS_JSON) process.stderr.write(`  ⚠ ${repoTag(v.repo)}${v.num} could not write the review:human escalation reason into the PR body (#2324) — add it by hand: ${score.reasons.join('; ')}\n`); }
            // Verify the write actually landed (never trust the edit call's exit code alone — gh can succeed
            // against a stale body if two edits race). A miss is loud, not silent.
            let verified = false;
            try { verified = bodyHasEscalationReason(JSON.parse(execFileSync('gh', ['pr', 'view', String(v.num), ...repoFlag(v.repo), '--json', 'body'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim() || '{}').body || ''); } catch { /* verify miss — reported below as unverified */ }
            if (!verified && !AS_JSON) process.stderr.write(`  ⚠ ${repoTag(v.repo)}${v.num} review:human body still missing the escalation reason after the write (#2324) — verify by hand: ${score.reasons.join('; ')}\n`);
          }
        }
        // #2285 v1 — the skill's auto-review step consumes this: humanRequired PRs are left for the operator,
        // the rest are eligible for a fresh-context adversarial review subagent.
        parked.push({ num: v.num, repo: v.repo || localSlug, humanRequired: !!gate.humanRequired, reasons: score.reasons });
        if (!AS_JSON) process.stderr.write(`  ⏸ ${repoTag(v.repo)}${v.num} parked for review (${gate.action}${gate.applyLabel ? `, labelled ${gate.applyLabel}` : ''}${gate.humanRequired ? ', HUMAN required' : ', agent-reviewable'}): ${score.reasons.join('; ')}\n`);
      } else if (score.escalate && !AS_JSON) {
        process.stderr.write(`  ✓ ${repoTag(v.repo)}${v.num} escalation cleared (${gate.reason})\n`);
      }
    }
    // #2414 — persist the first-drain-sighting baselines captured this pass. Best-effort local cache — but a
    // write miss is NOT a benign "re-capture fresh next pass": if the miss drops an honest baseline while a
    // tamper is live, next pass re-captures the tampered body as the trusted baseline AND the gate fails open
    // (durable bypass, not a one-pass gap — see review-baseline-state.mjs's cache-loss residual).
    if (baselineStateChanged && !DRY_RUN) { try { writeFileSync(REVIEW_BASELINE_STATE_PATH, serializeBaselineState(baselineState)); } catch { /* best-effort local cache */ } }
  }

  const toMerge = verdicts.filter((v) => v.decision === 'merge');
  const skipped = verdicts.filter((v) => v.decision === 'skip');

  // #2313 — stamp the *why* onto every OTHER final skip too (a real non-manifest conflict, a red required
  // check, an unlandable merge state, …), not only the review-escalation park path above. Excludes: verdicts
  // already commented via the park path (`v.escalated === 'yes'`, kind 'park' above); a collision-heal in
  // flight (`v.collisionHealed` — self-fixing, CI is re-running on the renumbered tip, nothing for a human to
  // act on yet); an uncertified PR (not a producer PR the drain owns — never comment on an unrelated human PR).
  if (!DRY_RUN) {
    for (const v of skipped) {
      if (v.escalated === 'yes' || v.collisionHealed) continue;
      if (!(v.certifyLabel || v.aiGenerated)) continue;
      // xnsk54v follow-up — mirror the park path: record the acted-on manifest values into the durable skip
      // comment for a manifest-carrying PR (tamper-evidence), leaving orphan/impl skip comments unchanged.
      const posted = postDrainReasonComment(v.repo, v.num, 'skip', v.reason, auditLineFor(v));
      if (posted && !AS_JSON) process.stderr.write(`  💬 ${repoTag(v.repo)}${v.num} skip reason stamped on PR\n`);
    }
  }

  if (!AS_JSON) {
    for (const v of verdicts) process.stderr.write(`  ${v.decision === 'merge' ? '→ merge' : '· skip '} ${repoTag(v.repo)}${v.num} ${v.item ? `(#${v.item}${v.blockedBy.length ? ` ⤳ ${v.blockedBy.join(',')}` : ''}) ` : ''}${v.decision === 'skip' ? `(${v.reason})` : ''} — ${v.title}\n`);
    process.stderr.write(`${DRY_RUN ? 'DRY-RUN: ' : ''}${toMerge.length} AI PR(s) to merge${label ? ` (label "${label}")` : ''}, ${skipped.length} skipped.\n`);
  }

  const merged = [];
  const failedMerges = [];
  const pendingRebased = []; // #2198 — PRs rebuilt onto main this pass; CI re-running, land on a later pass
  let deferred = [];
  if (DRY_RUN) {
    // Report the planned first-pass order (blockedBy + #2393 stackParents-honoured) without merging. Nothing has
    // landed this run, so `landedThisPass` is empty — the plan reflects only prior-session `bornAs` proof.
    const plan = planLabelDrain(verdicts, { landedThisPass, provenOnMain });
    deferred = plan.deferred;
    if (!AS_JSON) {
      process.stderr.write(`  merge order: ${plan.ready.map((c) => repoTag(c.repo) + c.num + (c.item ? `→${c.item}` : '')).join(' → ') || '(none ready)'}\n`);
      if (deferred.length) process.stderr.write(`  deferred (blockedBy unlanded): ${deferred.map((d) => `#${d.num}→[${d.waitOn.join(',')}]`).join(', ')}\n`);
    }
  } else {
    // Cascade: merge every READY candidate in blockedBy order; a merged item leaves the open set, freeing its
    // dependents next pass (mirrors the lane-drain cascade). A merge FAILURE (red/behind) marks the PR `skip`
    // so it keeps blocking its dependents — never land past a broken blocker.
    let remaining = verdicts.map((v) => ({ ...v }));
    // #2257 — an item is unique per (repo, PR#): match/remove candidates on both so a WE #10 and a FUI #10 never
    // collide in the cascade bookkeeping.
    const sameCand = (a, b) => a.num === b.num && a.repo === b.repo;
    for (;;) {
      const plan = planLabelDrain(remaining, { landedThisPass, provenOnMain });
      deferred = plan.deferred;
      if (!plan.ready.length) break;
      let progressed = false;
      for (const c of plan.ready) {
        try {
          // xnsk54v follow-up (land-path tamper-evidence) — the park/skip comment paths only fire when the drain
          // does NOT merge, so they record NOTHING in the attack's SUCCESS state: `dismissedFindings` edited DOWN
          // to suppress escalation so the PR LANDS. Close that gap by stamping the acted-on manifest values onto
          // the PR as a durable, timestamped comment BEFORE the merge — a landed manifest PR then always carries
          // a record of the escalation-sensitive values the drain acted on. Manifest-carrying PRs only (an
          // orphan/impl PR has nothing body-sourced to record — its behaviour is byte-identical to before).
          // Decision-preserving: `postDrainReasonComment` swallows every `gh` error internally (returns a bool,
          // never throws), so it can neither block nor alter the merge below — it only records.
          // NOTE: this land stamp fires only under `c.hasManifest`, so on its own it records the edit-a-value-DOWN
          // variant but NOT a full manifest STRIP (deleting the whole block flips `hasManifest` false → no land
          // record). #2414 narrows that: the escalation loop above diffs each candidate's LIVE manifest against
          // the FIRST-DRAIN-SIGHTING baseline (captured first-seen, post-queue) and RE-PARKS a landing PR whose
          // manifest was weakened — a stripped manifest OR an edit-down — BEFORE it reaches this cascade. So a
          // tampered PR seen intact at first sighting is already `skip` here; this stamp remains the durable
          // acted-on record for the honest manifest PRs that do land. (Residual: a manifest already weak at first
          // sighting, or a local baseline-cache loss racing a tamper, is NOT caught — see #2414's cache-loss doc.)
          if (c.hasManifest) {
            const posted = postDrainReasonComment(c.repo, c.num, 'land', LAND_REASON, auditLineFor(c));
            if (posted && !AS_JSON) process.stderr.write(`  💬 ${repoTag(c.repo)}${c.num} acted-on manifest values stamped on PR before merge\n`);
          }
          // #2290 — the drain is the SOLE writer to main: the one `gh pr merge` now routes through the shared
          // gate (caller 'drain' — the only caller the gate permits). Behaviour is identical to the prior
          // inline call (`gh pr merge <n> [--repo …] --merge --delete-branch`, throw on a non-zero gh exit).
          mergePr({ pr: c.num, repo: c.repo, method: 'merge', caller: 'drain' });
          merged.push({ num: c.num, repo: c.repo }); progressed = true;
          remaining = remaining.filter((x) => !sameCand(x, c)); // merged → item leaves the open set (frees dependents)
          // #2393 — a WE-carrier merge (the PR carrying its OWN manifest = the resolve carrier + where `bornAs`
          // is stamped) PROVES the couple landed this run: record its item so a descendant that stackParents on
          // it becomes ready next pass. Keyed on `hasManifest` (NOT an inherited impl PR) so a green impl PR of
          // an otherwise-broken couple never counts the couple "landed" — that alignment with `bornAs` is what
          // keeps the stowaway guard honest.
          if (c.hasManifest && c.item != null) landedThisPass.add(asItemId(c.item));
          if (!AS_JSON) process.stderr.write(`  ✓ merged ${repoTag(c.repo)}${c.num}${c.item ? ` (#${c.item})` : ''}\n`);
        } catch (e) {
          const detail = String(e.message || e).split('\n')[0];
          const cc = remaining.find((x) => sameCand(x, c)); if (cc) cc.decision = 'skip'; // stays blocking its dependents; not retried this pass
          // #2198 — a PR we JUST rebuilt (rebase-drop) has a new head, so CI (`test`) is re-running; an immediate
          // merge is EXPECTED to bounce on pending checks. That is not a hard failure — the watch re-sweeps and
          // lands it the next pass once green. Only a merge failure on a PR we did NOT just touch is a real fault.
          if (c.rebaseDrop === 'rebased') {
            pendingRebased.push(c.num);
            if (!AS_JSON) process.stderr.write(`  ↻ ${repoTag(c.repo)}${c.num} rebuilt onto main — awaiting re-run of checks; will land on a later pass\n`);
          } else {
            failedMerges.push({ num: c.num, repo: c.repo, detail });
            if (!AS_JSON) process.stderr.write(`  ✗ ${repoTag(c.repo)}${c.num} merge failed: ${detail}\n`);
          }
        }
      }
      if (!progressed) break; // every ready candidate failed → stop (dependents stay deferred)
    }
    if (deferred.length && !AS_JSON) process.stderr.write(`  · ${deferred.length} deferred (blockedBy an unlanded PR): ${deferred.map((d) => `#${d.num}→[${d.waitOn.join(',')}]`).join(', ')}\n`);
  }

  // Sync the LOCAL main checkout to the just-advanced origin/main (a merged PR moved origin, not local) — local
  // main is KEPT UP TO DATE after each merge (user request 2026-07-03). `--autostash` is what makes this
  // reliable: under #2183 local main never diverges (edits land via PR, not direct commits), so the sync is a
  // pure fast-forward — but the working tree is almost always dirty (session-state like `claims.json`, mid-edit
  // docs), and a bare `pull --ff-only` aborts the ff the moment ANY incoming file is also locally-modified.
  // `--autostash` sets the dirty edits aside, fast-forwards, then reapplies them — so main advances AND local
  // edits are preserved. Still ff-only (never rebases/force — a genuine divergence aborts and is reported). The
  // rare case where a reapplied edit overlaps an incoming change surfaces a normal stash-pop conflict for the
  // human, rather than silently leaving main behind. Only when something actually merged. #2257 — the local
  // pull only makes sense for the LOCAL clone's repo, so it fires only when a LOCAL-repo PR merged (a remote-
  // repo merge advanced that repo's origin, which this clone doesn't track).
  let localSynced = false;
  const landedLocal = !DRY_RUN && merged.some((m) => isLocalRepo(m.repo));
  if (landedLocal) {
    try { execFileSync('git', ['pull', '--ff-only', '--autostash'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); localSynced = true; }
    catch { localSynced = false; }
    if (!AS_JSON) process.stderr.write(localSynced ? `  ✓ local main fast-forwarded to origin (autostash preserved local edits)\n` : `  · local main NOT fast-forwarded (diverged, or a reapplied local edit conflicts) — reconcile by hand\n`);
  }

  // #2348/#2419 — a LANE CLONE's `/pr` fast drain runs THIS process with a DETACHED HEAD (the #2183 clone
  // model), or occasionally ATTACHED to a STALE `lane/*` branch (#2419 — a leftover from an earlier
  // rebase-drop/manual checkout), so the branch-pull above always errors there and left the JIT-numbering +
  // derived-regen steps below operating on a stale, lineage-disconnected tree (see `resyncDetachedCwdForLand`'s
  // doc for the full story — this is how #2347/#2418 stranded a hash on main). Best-effort, non-fatal — a
  // skip/failure is reported and the numbering/regen steps below simply see whatever tree cwd already has
  // (their existing best-effort contract, unchanged).
  const detachedResync = resyncDetachedCwdForLand({ exec: execFileSync, landedLocal, localSynced });
  if (detachedResync.resynced) {
    localSynced = true;
    if (!AS_JSON) process.stderr.write(`  ✓ cwd resynced to origin/main for JIT numbering + derived regen (#2348/#2419)\n`);
  } else if (detachedResync.skipped === 'exec-failed' && !AS_JSON) {
    process.stderr.write(`  ⚠ could not resync cwd to origin/main (${detachedResync.detail}) — JIT numbering/derived regen below may see a stale tree\n`);
  } else if (detachedResync.skipped === 'dirty' && !AS_JSON) {
    process.stderr.write(`  ⚠ cwd has TRACKED local changes — skipped the resync (won't reset a dirty tree); JIT numbering/derived regen below may see a stale tree\n`);
  } else if (detachedResync.skipped === 'unpublished-commits' && !AS_JSON) {
    process.stderr.write(`  ⚠ cwd's HEAD carries commit(s) not yet on origin/main — skipped the resync (won't orphan unpushed work); JIT numbering/derived regen below may see a stale tree\n`);
  }

  // #2284 residual (2) / #xwokc1n — the pull above ff-syncs the drain's OWN cwd. But when the drain runs from a
  // LANE CLONE (the #2123 isolated-clone rule) rather than the user's primary checkout, that primary (a SEPARATE
  // directory) still drifts behind on every land (observed 75 commits behind origin/main). Locate the primary
  // ROBUSTLY via `resolvePrimaryPath` (`--primary=<path>` → `WE_PRIMARY` → git alternates) so a `--local` clone
  // (which has NO alternates) still syncs it, then `syncPrimaryOnLand` decides + performs the ff-sync (pure,
  // tested). Sync ONLY a DIFFERENT dir, on main, with a TRACKED-clean tree: a pure `git pull --ff-only`, no
  // `--autostash` (the 2026-07-03 strand). Untracked cruft does NOT block; a bad `--primary`/dirty/diverged is
  // left UNTOUCHED and loudly logged; a hint-less unlocatable (cwd IS the primary, already synced) stays quiet.
  let primarySynced = null;
  if (landedLocal) {
    const primary = resolvePrimaryPath(process.cwd(), { flag: flags.primary, env: process.env.WE_PRIMARY });
    const hinted = (typeof flags.primary === 'string' && flags.primary.trim()) || (typeof process.env.WE_PRIMARY === 'string' && process.env.WE_PRIMARY.trim());
    const gitAt = (a) => execFileSync('git', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const isCwd = (p) => { try { return realpathSync(p) === realpathSync(process.cwd()); } catch { return false; } };
    const r = syncPrimaryOnLand({ exec: gitAt, primary, hinted: !!hinted, isCwd });
    // null = benign no-op (cwd is the primary, or hint-less unlocatable); true = synced; false = actionable skip.
    primarySynced = r.synced ? true : (r.warn ? false : null);
    if (!AS_JSON) {
      if (r.synced) process.stderr.write(`  ✓ user primary checkout fast-forwarded to origin/main\n`);
      else if (r.warn) {
        const why = { 'not-located': `not located (pass --primary=<path> or set WE_PRIMARY)`, 'not-a-repo': `${primary} is not a readable git repo`, 'not-on-main': `${primary} not on main (on ${r.branch})`, 'status-failed': `${primary} git status failed`, dirty: `${primary} has uncommitted TRACKED changes — left UNTOUCHED (no autostash)`, diverged: `${primary} NOT fast-forwarded (diverged)` }[r.reason] || r.reason;
        process.stderr.write(`  · user primary ${why} — skipped primary ff-sync; pull it by hand\n`);
      }
    }
  }

  // JIT numbering (#2288) — the drain is the sole serial writer to main, so THIS land path (the /pr fast drain
  // + /merge sweep) is also where a provisional (hash-keyed) item gets its real sequential NNN. After a WE
  // couple lands on cwd's main, number every hash file now present (the couple's own item + any leftover
  // scaffolded in its lane) and push. Runs BEFORE the derived regen so the inventory reflects the final numbers.
  // Shares lane-drain's `numberPendingHashes` (single source, never a fork). Best-effort/non-fatal.
  let numbered = { assigned: [], committed: false };
  if (landedLocal && !DRY_RUN) {
    // #2391 — number+publish is the NUMBERING CRITICAL SECTION (sole-serial-writer, #2288/#2290). Guard it with
    // the TTL-bounded numbering mutex so a concurrent drain/land never mints the same NNN off the same base.
    const numLock = withNumberingLock(() => {
      const n = numberPendingHashes(process.cwd());
      if (n.committed) {
        try {
          execFileSync('git', ['push', 'origin', 'HEAD:main'], { env: { ...process.env, MAIN_PUSH_OK: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
          if (!AS_JSON) process.stderr.write(`  ✓ JIT-numbered ${n.assigned.map((a) => `${a.hash}→#${a.nnn}`).join(', ')} + pushed to main (#2288)\n`);
        } catch (e) {
          if (!AS_JSON) process.stderr.write(`  ⚠ JIT numbering committed locally but push FAILED (${String(e.message || e).split('\n')[0]}) — push main by hand\n`);
        }
      }
      return n;
    });
    numbered = numLock.result;
    if (numLock.contended && !AS_JSON) process.stderr.write(`  ⚠ numbering mutex not acquired (held by ${numLock.heldBy || '?'}) — numbered without it (#2391); the #2318 duplicate-NNN tripwire is the backstop\n`);
  }

  // #2318 — POST-LAND DUPLICATE-NNN TRIPWIRE (LOUD-ONLY, #xsyia6k). JIT numbering (#2288) makes two lanes racing
  // to one birth-NNN structurally rare, but a bug on ANY land path could still put two files at one numeric id on
  // main — exactly the #2316 double-land, where two individually-green PRs both passed `ids must be unique` against
  // a main that did not YET hold #2316, both landed in one pass, and the duplicate sat SILENTLY on main and turned
  // every open PR's required `test` check red globally (root cause: the pre-merge `healNnnCollision` only heals a
  // NOT-yet-landable/red PR, so two green siblings slip past it).
  //
  // This tripwire's charter is impossible-or-LOUD: DETECT the duplicate and surface it, NOT auto-fix it. It does
  // NOT run the renumber heal here, deliberately (#xsyia6k). A post-land heal that yields one of the two colliding
  // files rewrites `#NNN`/`blockedBy` refs corpus-wide, and — with no `--onto-ref` to scope it (the healer's #2316
  // edge-clobber guard reads `ontoSet`, which is empty post-land) — that sweep can clobber a SURVIVING main item's
  // legitimate edge (the exact #2314 corruption). Passing `--onto-ref=main` can't rescue it either: both colliding
  // files then count as published, so `planRenumber` yields nothing and the heal is a no-op. So we detect → exit 3
  // → a human runs the guarded `backlog-renumber-collisions.mjs` (with the right onto-ref) by hand. Given how rare
  // a post-land dup now is, trading a silent dup for a possible silent edge-clobber is the wrong bargain.
  //
  // Runs on EVERY non-dry pass (not only one that landed a local couple) so a duplicate lingering on main from a
  // prior failed land is caught too — the detect is a cheap fs read, so a standing invariant is strictly stronger.
  let duplicateIdsOnMain = [];
  if (!DRY_RUN) {
    duplicateIdsOnMain = findDuplicateIds(join(process.cwd(), 'backlog'));
    if (duplicateIdsOnMain.length && !AS_JSON) {
      process.stderr.write(`\n  ✗✗ TRIPWIRE (#2318): duplicate id(s) on main — ${summarizeDuplicates(duplicateIdsOnMain)}. The merge queue stays RED (exit 3) until this is resolved by hand: run \`node scripts/backlog-renumber-collisions.mjs --onto-ref=<pre-dup main sha>\` on main. NOT auto-healed (an unguarded sweep can clobber a surviving edge, #2314); NOT left silent.\n\n`);
    }
  }

  // #2290 — the drain is the sole writer to main, so the WE derived-artifact regen (#2182/#2173) moves INTO the
  // drain: after a pass that landed ≥1 WE (local) couple, reproduce the artifacts ONCE and, if changed, commit +
  // push them to main as the drain (pr-land can no longer do this — it does not merge). Best-effort/non-fatal.
  let derived = { ran: false, done: [], failed: [], committed: false, pushed: false };
  if (landedLocal) {
    if (!AS_JSON) process.stderr.write(`  ↻ regenerating WE derived artifacts once (${DERIVED_REGEN.map((c) => c.join(' ')).join(', ')})…\n`);
    derived = regenDerivedOnLand({ exec: execFileSync, cwd: process.cwd(), landed: true, dryRun: DRY_RUN });
    if (!AS_JSON) {
      if (derived.committed) process.stderr.write(`  ✓ derived artifacts regenerated + pushed to main (${derived.done.join(', ')})\n`);
      else if (derived.ran && !derived.warning) process.stderr.write(`  · derived regen: no change (inputs unchanged)\n`);
      if (derived.warning) process.stderr.write(`  ⚠ ${derived.warning}\n`);
    }
  }

  // #2222 — a healed tip is a PENDING rebuild (CI re-running on the renumbered tree), so it counts as progress
  // for the watch's idle accounting exactly like a rebase-drop rebuild — it lands on a later pass.
  const pendingAll = [...pendingRebased, ...healed];
  const result = { ok: duplicateIdsOnMain.length === 0, dryRun: DRY_RUN, label, repos: REPOS.map((r) => r || localSlug || 'cwd'), considered: verdicts.length, toMerge: toMerge.map((v) => ({ num: v.num, repo: v.repo || localSlug })), merged, failed: failedMerges, rebased, pendingRebased, healed, deferred, localSynced, ...(primarySynced !== null ? { primarySynced } : {}), ...(numbered.assigned.length ? { jitNumbered: numbered.assigned } : {}), ...(duplicateIdsOnMain.length ? { duplicateIdsOnMain } : {}), derivedRegenerated: derived.done, derivedFailed: derived.failed, ...(derived.warning ? { derivedWarning: derived.warning } : {}), reconciledLabels, parked, skipped: skipped.map((v) => ({ num: v.num, repo: v.repo || localSlug, reason: v.reason, ...(v.escalated ? { escalated: v.escalated } : {}), ...(v.humanRequired ? { humanRequired: true } : {}) })) };
  return { result, merged, failedMerges, pendingRebased: pendingAll, deferred, duplicateIdsOnMain };
  }; // end sweepOnce

  // ── Whole-process drain lease — ALWAYS-ON for full/label sweeps + watches (#2449; #2391/#2424/#2443) ──────
  // Route through the pure gate, then perform the atomic acquire. A live foreign holder (or a lost acquire
  // race) means this run's work is already being done — no-op exit 0 surfacing the holder. An acquired lease
  // covers the run's FULL lifetime (one-shot AND watch) and is released on EVERY exit path (normal, break,
  // signal) via the `exit` handler. `--only` fast drains, `--dry-run`, and `--no-drain-lease` bypass;
  // a daemon child pass runs `under-lease` without acquiring (the parent heartbeats).
  const leaseOwner = drainOwner();
  const leaseGate = decideDrainLeaseGate({ dryRun: DRY_RUN, onlyPr, noLease: NO_DRAIN_LEASE, underLease: UNDER_LEASE, status: drainLeaseStatus(DRAIN_LOCK_ROOT) });
  let leaseHeld = false;
  if (leaseGate.action === 'acquire') leaseHeld = acquireDrainLease(DRAIN_LOCK_ROOT, leaseOwner).ok === true;
  if (leaseGate.action === 'noop' || (leaseGate.action === 'acquire' && !leaseHeld)) {
    const st = drainLeaseStatus(DRAIN_LOCK_ROOT);
    const heldBy = st.owner || leaseGate.heldBy || null;
    const detail = leaseGate.reason === 'declared-holder-gone'
      ? `--under-lease holder ${UNDER_LEASE} no longer holds a live lease — no-op; the queue rides the next drain (#2449)`
      : `another drain already holds the whole-process lease (${heldBy || '?'}) — no-op; its next pass covers this work (#2449/#2391)`;
    if (AS_JSON) process.stdout.write(JSON.stringify({ ok: true, ...(WATCH ? { watch: true } : {}), skipped: 'drain-in-progress', heldBy, detail }) + '\n');
    else process.stderr.write(`merge-ai-prs · ${detail}\n`);
    process.exit(0);
  }
  if (leaseHeld) {
    // Release on ANY exit path (the watch loop has several `break`s + signal kills). Idempotent + owner-fenced:
    // releaseDrainLease only frees a lease THIS owner still holds, so a reclaimer who seized it is never stomped.
    process.on('exit', () => { releaseDrainLease(DRAIN_LOCK_ROOT, leaseOwner); });
    for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => process.exit(0)); // → triggers the exit handler → frees the lease
  }

  // ── Driver — one sweep (the /drain one-shot + /merge bare), or the `--watch` monitor (`/drain watch`) ──────
  if (!WATCH) {
    let { result, failedMerges, duplicateIdsOnMain } = sweepOnce();
    // #2230 — the label index lags the producer's label write, so a one-shot fired right after labelling can see
    // the just-labelled PR as absent. Re-poll ONCE after a short delay before concluding the queue is empty.
    // Fail-soft: a still-empty re-poll is a legitimate empty queue, not an error.
    if (shouldRepollForLabelLag({ label, found: result.considered, expect: EXPECT, retried: false })) {
      if (!AS_JSON) process.stderr.write(`  · ${result.considered} labelled candidate(s)${EXPECT ? ` (< expected ${EXPECT})` : ''} — re-polling once in ${REPOLL_SEC}s (label index may lag the producer's label write)…\n`);
      sleepSync(REPOLL_SEC * 1000);
      ({ result, failedMerges, duplicateIdsOnMain } = sweepOnce());
    }
    if (AS_JSON) process.stdout.write(JSON.stringify(result) + '\n');
    // #2318 — a duplicate id surviving on main is a LOUD failure (exit 3), distinct from a merge failure (exit 2):
    // main is in a globally-red state until it is resolved by hand, so the drain must never exit 0 over it.
    process.exit((duplicateIdsOnMain && duplicateIdsOnMain.length) ? 3 : (failedMerges.length ? 2 : 0));
  }

  // WATCH: re-sweep on a fixed interval, landing PRs as they become eligible, until `--max-idle` consecutive
  // idle passes (merged nothing AND nothing deferred waiting) — or forever if `--max-idle` is unset (Ctrl-C).
  const watchStartedAt = Date.now(); // #2395 — for the `--max-runtime-min` wall-clock cap
  const exitBound = MAX_IDLE != null ? `exit after ${MAX_IDLE} idle pass${MAX_IDLE === 1 ? '' : 'es'}`
    : UNTIL_BATCHES_IDLE ? `exit when the active batch is idle (debounce ${BATCH_DEBOUNCE})` : 'Ctrl-C to stop';
  if (!AS_JSON) process.stderr.write(`watch: polling ${label ? `label "${label}" ` : ''}every ${INTERVAL}s (${exitBound})…\n`);
  const passes = [];
  const allMerged = [];
  let idle = 0;
  let batchNonRunningStreak = 0; // #2330 — consecutive passes the feed is KNOWN and reports no running batch
  let batchFeedAbsentWarned = false; // #2330 — emit the "feed absent ⇒ inert" note at most once
  let lastFailed = [];
  let lastDup = [];
  for (let pass = 1; ; pass++) {
    if (leaseHeld) heartbeatDrainLease(DRAIN_LOCK_ROOT, leaseOwner); // #2395 — keep the whole-process lease alive across a long watch (an `under-lease` child never heartbeats — its parent daemon owns that)
    // #2395 — wall-clock lifetime cap: hard-stop a `--max-runtime-min` watch so an inert `--until-batches-idle`
    // (no batch feed present) can never poll forever. The deferred sweep is the backstop for anything unlanded.
    if (MAX_RUNTIME_MS != null && Date.now() - watchStartedAt >= MAX_RUNTIME_MS) {
      if (!AS_JSON) process.stderr.write(`watch: STOPPING — reached the --max-runtime-min cap (${MAX_RUNTIME_MS / 60_000}m); anything unlanded rides the deferred sweep.\n`);
      break;
    }
    if (!AS_JSON) process.stderr.write(`── pass ${pass} ──\n`);
    const { result, merged, failedMerges, pendingRebased, deferred, duplicateIdsOnMain } = sweepOnce();
    passes.push(result);
    allMerged.push(...merged);
    lastFailed = failedMerges;
    lastDup = duplicateIdsOnMain || [];
    // #2318 — a duplicate id on main is a hard, LOUD stop: polling won't clear it (main is globally red), so
    // break the watch immediately and surface it rather than spinning idle passes over a broken main.
    if (lastDup.length) {
      if (!AS_JSON) process.stderr.write(`watch: STOPPING — duplicate id(s) survive on main (${summarizeDuplicates(lastDup)}); resolve by hand then re-run the drain.\n`);
      break;
    }
    // A pass that rebuilt a tip (pendingRebased) made progress — keep polling so it lands once CI re-runs.
    const idlePass = merged.length === 0 && deferred.length === 0 && pendingRebased.length === 0;
    idle = idlePass ? idle + 1 : 0;
    if (MAX_IDLE != null && idle >= MAX_IDLE) break;
    // #2330 — batch-aware exit: stop once the active batch is fully delivered. Only trust a KNOWN, non-running
    // feed; an absent/stale feed leaves the streak at 0 so it can never trigger a false stop (keep watching).
    if (UNTIL_BATCHES_IDLE) {
      const feed = readBatchFeed(BATCH_FEED, { staleMs: BATCH_FEED_STALE_MS });
      // #2330 review (2) — a drain-only session usually has NO feed at the default path (it lives in the primary),
      // so `--until-batches-idle` is silently inert (runs unbounded). Surface that ONCE so the degrade is visible.
      if (!feed.known && !batchFeedAbsentWarned && !AS_JSON) {
        batchFeedAbsentWarned = true;
        process.stderr.write(`  · batch feed ${feed.reason || 'unavailable'} at ${BATCH_FEED} — --until-batches-idle is INERT (running unbounded until Ctrl-C). Point --batch-feed at the primary checkout's _site/active-progress.json.\n`);
      }
      batchNonRunningStreak = feed.known && feed.running.length === 0 ? batchNonRunningStreak + 1 : 0;
      if (decideBatchesIdleExit({ enabled: true, idlePass, considered: result.considered, batchNonRunningStreak, debounce: BATCH_DEBOUNCE })) {
        // #2330 review (1) — the queue-empty signal (`considered === 0`) rides the SAME lagging label index
        // #2230 guards: after the producer resolves the LAST item its reservation drops (feed → non-running)
        // promptly, but that item's `ready-to-merge` label can stay invisible to `gh pr list --label` for
        // minutes. Without a confirm, the debounced streak + a stale-empty queue would exit and DROP the batch's
        // final PR. So re-poll ONCE (same defense as the one-shot path) and only exit if the queue is STILL empty.
        if (!AS_JSON) process.stderr.write(`  · batch idle + queue empty — confirming in ${REPOLL_SEC}s (label index may lag the final PR's label)…\n`);
        sleepSync(REPOLL_SEC * 1000);
        const confirm = sweepOnce();
        passes.push(confirm.result);
        allMerged.push(...confirm.merged);
        lastFailed = confirm.failedMerges;
        lastDup = confirm.duplicateIdsOnMain || [];
        if (lastDup.length) {
          if (!AS_JSON) process.stderr.write(`watch: STOPPING — duplicate id(s) survive on main (${summarizeDuplicates(lastDup)}); resolve by hand then re-run the drain.\n`);
          break;
        }
        const confirmedEmpty = confirm.result.considered === 0 && confirm.merged.length === 0 && confirm.deferred.length === 0 && confirm.pendingRebased.length === 0;
        if (confirmedEmpty) {
          if (!AS_JSON) process.stderr.write(`watch: STOPPING — active batch idle, queue confirmed empty after repoll — batch fully delivered.\n`);
          break;
        }
        // The repoll surfaced late work (a lagging label became visible / a PR landed) — do NOT exit; the label
        // lag has cleared, so reset the streak and keep watching so the final PR gets landed on a later pass.
        batchNonRunningStreak = 0;
        if (!AS_JSON) process.stderr.write(`  · repoll surfaced ${confirm.result.considered} candidate(s), merged ${confirm.merged.length} — label lag cleared; continuing watch.\n`);
      }
    }
    if (!AS_JSON) process.stderr.write(`  … pass ${pass}: merged ${merged.length}, deferred ${deferred.length}${idlePass ? ` (idle ${idle}${MAX_IDLE != null ? `/${MAX_IDLE}` : ''})` : ''}${UNTIL_BATCHES_IDLE ? ` [batch-idle ${batchNonRunningStreak}/${BATCH_DEBOUNCE}]` : ''} — next poll in ${INTERVAL}s\n`);
    sleepSync(INTERVAL * 1000);
  }
  if (!AS_JSON) process.stderr.write(`watch: stopped after ${passes.length} pass(es); merged ${allMerged.length} PR(s) total.\n`);
  if (AS_JSON) process.stdout.write(JSON.stringify({ ok: lastDup.length === 0, watch: true, label, interval: INTERVAL, maxIdle: MAX_IDLE, passes: passes.length, merged: allMerged, lastFailed, ...(lastDup.length ? { duplicateIdsOnMain: lastDup } : {}) }) + '\n');
  process.exit(lastDup.length ? 3 : (lastFailed.length ? 2 : 0));
}
