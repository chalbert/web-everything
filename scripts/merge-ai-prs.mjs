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
 *   node scripts/merge-ai-prs.mjs --only=12 --label=ready-to-merge          # #2683 fast drain, target = the LOCAL repo's PR #12; the full constellation is listed for cross-repo blockedBy ordering context
 *   node scripts/merge-ai-prs.mjs --only=12 --only-repo=owner/frontierui --label=ready-to-merge # #2683 fast drain whose target PR #12 lives in a SIBLING repo (still ordered against the whole constellation)
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
import { execFileSync, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, readFileSync, writeFileSync, realpathSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, join, dirname } from 'node:path';
import { rebaseDropManifest, gitRunner } from './lib/rebase-drop-manifest.mjs';
import { rebaseDropContent } from './lib/rebase-drop-content.mjs';
import { healNnnCollision } from './lib/nnn-collision-heal.mjs';
// Rebase resolution (2026-08-08): the UNION of four independent concerns on one import line — #2979's accept
// fingerprint reader (`parseReviewedDiff`), #2832/#984's hold-invariant helpers (`READY_TO_MERGE_LABEL`,
// `isReviewHoldLabel`, `decideParkReadyStrip`), #2890's null-contract diff mapper (`diffHunksFrom`), and
// #x9xqexm's contribution fingerprint reader (`parseReviewedContribution`). None supersedes another.
import { scoreEscalation, diffHunksFrom, decideReviewGate, REVIEW_LABELS, REVIEW_LABEL_META, buildEscalationReasonBlock, bodyHasEscalationReason, shouldApplyReviewLabel, hasUnclearedReviewLabel, hasReviewLabel, parseReviewedSha, parseReviewedDiff, parseReviewedContribution, parseOperatorClearance, buildClearanceRevocationComment, READY_TO_MERGE_LABEL, isReviewHoldLabel, decideParkReadyStrip } from './lib/review-escalation.mjs';
import { emptyBaselineState, parseBaselineState, serializeBaselineState, getBaseline, recordBaseline, diffBaseline } from './lib/review-baseline-state.mjs';
import { mergePr, hasNonEmptyBody, scanTestTampering } from './lib/pr-merge-gate.mjs';
import { DERIVED_REGEN, DERIVED_OUTPUT_PATHS, numberPendingHashes, isPostLandTreeDirty, landedNumberFor, resolveLandedItem } from './lane-drain.mjs'; // #2899 A5 — `resolveLandedItem` shares lane-drain's ONE resolve-on-land home, exactly as `numberPendingHashes` shares its numbering (never a fork)
import { isHash } from './backlog/id.mjs'; // #2393 — a stackParent hash's bornAs-on-main lookup is hash-only
import { withNumberingLock, withLandWriteLock, acquireDrainLease, heartbeatDrainLease, releaseDrainLease, drainLeaseStatus, drainOwner, DRAIN_LOCK_ROOT } from './readiness/drain-lock.mjs'; // #2391 — numbering-critical-section mutex + (#2683) the merge-write mutex (withLandWriteLock, same lock key) + (#2395) whole-process drain lease a `--watch` monitor holds for its lifetime
import { findDuplicateIds, summarizeDuplicates } from './lib/duplicate-id-tripwire.mjs';
import { extractManifestFromBody, manifestAuditLine, asItemId, isItemId, repoKeyFromSlug, manifestBaseForRepo } from './readiness/lane-manifest.mjs';
import { isDispatchFrozen, readFreeze } from './readiness/red-main-remediation.mjs'; // #2681 — the RED-MAIN dispatch-freeze the sole writer consults (stop-the-line while main is red)
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
  // #2409 — a stale-acceptance re-park (the head advanced past the reviewed commit) is NOT a "review never
  // arrived" pending park; it is a different concern (the accepted tree is no longer the landing tree). The
  // pending-relief valve must NEVER waive it, even though it carries review:pending — a fresh look is required.
  if (gate.staleAcceptance) {
    return { waive: false, reason: 'stale acceptance (#2409) — head advanced past the reviewed commit; not waivable by the pending-relief valve' };
  }
  if (gate.humanRequired || gate.applyLabel === REVIEW_LABELS.human) {
    return { waive: false, reason: 'review:human is human-only — never waivable by a per-PR relief valve (#2285)' };
  }
  if (gate.applyLabel !== REVIEW_LABELS.pending) return { waive: false };
  return { waive: true, reason: 'per-PR --no-review-escalation relief — agent-reviewable review:pending waived to a merge (#2423)' };
}

/**
 * #2683 — does this PR match the `--only=<pr>` fast-drain TARGET? Pure. PR numbers are per-repo, so a bare
 * `--only=12` on the default constellation scope must not match a same-numbered PR in a sibling repo. Rules
 * (first match wins):
 *   - number mismatch → never.
 *   - `--only-repo=<slug>` given → the PR's repo must equal it (the explicit sibling-PR case, e.g. pr-watch).
 *   - else a SINGLE-repo sweep (`repoCount === 1`: `--this-repo` → the cwd repo, OR `--repos=<one>` → one
 *     explicit slug) → match (the legacy `/pr` + `/finish` callers, which scope the sweep and pass NO
 *     `--only-repo`; without this branch a `--repos=<remoteslug>` `/finish` would filter its own target out).
 *   - else (a multi-repo default sweep with no `--only-repo`) → match ONLY the local/cwd repo (disambiguate).
 * @param {{prNumber:(number|string), onlyPr:(number|string), repo:(string|null), onlyRepo:(string|null), isLocal:boolean, repoCount:number}} o
 * @returns {boolean}
 */
export function matchesOnlyTarget({ prNumber, onlyPr, repo, onlyRepo, isLocal, repoCount } = {}) {
  if (String(prNumber) !== String(onlyPr)) return false;
  if (onlyRepo) return repo === onlyRepo;
  if (repoCount === 1) return true;
  return !!isLocal;
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

/**
 * #xkfv491 — the MOST RECENT rollup entry for a check name, which is the only one that describes the CURRENT
 * tree. A head SHA routinely carries SEVERAL runs of the same check: a workflow `concurrency` group cancels the
 * in-flight run when a new one supersedes it, leaving a CANCELLED entry sitting next to the SUCCESS that
 * actually finished.
 *
 * Both callers below used `roll.find(...)`, i.e. the FIRST entry by name — and GitHub returns the rollup in
 * creation order, so `find` reliably picked the OLDEST run. Observed on PR #1042: `test` had CANCELLED at
 * 18:34:02 (superseded) at index 0 and SUCCESS at 18:35:32 at index 1, so the drain read the PR as not-green
 * and skipped it every pass while `gh pr checks` reported a pass — the two disagreed because `gh` collapses to
 * the latest run per name and the drain did not. Three PRs were held at once (#1042, #1046, #1012), and the
 * twin `isRequiredCheckFailed` would have stamped `ci:failed` on a genuinely green PR from the same evidence.
 * Re-running CI does NOT clear it: the cancelled entry stays in the rollup and a re-run only appends.
 *
 * WE TRUST GITHUB'S ORDER — the rollup arrives in creation order, so the LAST matching entry is the newest.
 * An earlier cut of this fix ranked entries by a timestamp instead, to be robust to an ordering GitHub does
 * not actually emit. That bought three defects and no observed benefit (review of PR #1049), so it is gone:
 *   • it compared one run's `completedAt` against another's `startedAt` — different clocks, so a run that
 *     ENDED late outranked the newer run that had only STARTED;
 *   • an entry with no usable stamp ranked as globally OLDEST, so an in-flight run could never suppress a
 *     stale SUCCESS;
 *   • it needed a special case for the `0001-01-01T00:00:00Z` sentinel GitHub reports for an unfinished run.
 * If a rollup ever arrives out of creation order, that is the moment to revisit — not before.
 *
 * CHECK RUNS OUTRANK COMMIT STATUSES. A rollup can mix two shapes: a `CheckRun` (produced by the workflow) and
 * a legacy `StatusContext` (posted through the commit-statuses API by anyone holding `statuses:write` — a
 * collaborator, a bot, an installed App). Plain last-wins across both would let a `test`-named status posted
 * after the real run OVERRIDE its FAILURE and clear the merge gate, which the pre-#xkfv491 `find` did not
 * allow. So when any CheckRun matches the name, only CheckRuns are considered; a StatusContext decides only
 * when the workflow has produced nothing at all.
 *
 * THE UNION MEMBER IS READ OFF `__typename`, NOT GUESSED FROM `name` (PR #1049 review). Every live
 * `gh pr view --json statusCheckRollup` row carries `__typename` (verified on PR #1049 itself), so the
 * authoritative tag is free. An earlier cut inferred "this is a CheckRun" from the presence of `name` — correct
 * against raw gh output, but `rollupToCheckRows` (`we:scripts/fetch-parked.mjs#rollupToCheckRows`) re-normalises
 * rows to `{ name: c.name || c.context }`, so every StatusContext in that output would have classified as a
 * CheckRun and the preference above would have silently collapsed to plain last-wins. A row with NO (or an
 * unrecognised) `__typename` is therefore treated as UNTRUSTED rather than as a CheckRun: it ranks in its own
 * tier, below any tagged CheckRun. {@link rollupRowKind} does the classification; the pool is the FIRST
 * non-empty tier of `CheckRun` → untagged → `StatusContext`.
 *
 * Latest-wins is the principled rule, not "ignore CANCELLED": if the NEWEST run is cancelled then the check
 * genuinely has no current verdict and the PR must not land. Pure.
 * @param {{statusCheckRollup?: Array<object>}} pr
 * @param {string} requiredCheck
 * @returns {object|null} the newest matching entry, or `null` when the check has not reported at all.
 */
export function latestRequiredCheck(pr, requiredCheck = 'test') {
  const roll = Array.isArray(pr?.statusCheckRollup) ? pr.statusCheckRollup : [];
  const collapsed = collapseRollupToLatestPerName(roll);
  return collapsed.find((c) => (c?.name || c?.context) === requiredCheck) || null;
}

/**
 * #2925 — the SAME per-name collapse `latestRequiredCheck` implements above, generalised from ONE check name to
 * EVERY name in the rollup. `latestRequiredCheck` is now a by-name lookup over this function's output — ONE
 * implementation, no fork. Exists because a reader that folds every rollup ENTRY into one verdict (rather than
 * picking one check out) has the SAME defect as `.find(...)`-picks-the-first: a superseded `CANCELLED` entry
 * beside a later `SUCCESS` outranks the run that actually finished, whether it is read first or folded in at all.
 * `we:scripts/fetch-parked.mjs#rollupToCheckRows` and `we:scripts/readiness/conveyor-state.mjs#ciRollup` both fold
 * every entry — collapse to the latest entry per name FIRST, then fold.
 *
 * Within a name: take the FIRST non-empty tier of `CheckRun` → untagged → `StatusContext` ({@link rollupRowKind}),
 * then the LAST entry (creation order, #xkfv491) in that tier. Pure. Order of the returned rows is NOT the input
 * order — one row per distinct name, in first-seen order.
 *
 * A row with NEITHER `name` NOR `context` (unreachable off a real `gh pr view --json statusCheckRollup` — every
 * live row carries one or the other) is passed through UNCOLLAPSED, one output row per such input row: there is
 * no name to group it by, so grouping it with any other nameless row would silently fold two unrelated checks
 * into one and grouping it under a shared empty-string key would do the same. Each gets its own group.
 * @param {Array<object>|null|undefined} rollup
 * @returns {Array<object>} one collapsed entry per distinct check name (nameless rows pass through 1:1).
 */
export function collapseRollupToLatestPerName(rollup) {
  const roll = Array.isArray(rollup) ? rollup : [];
  const byName = new Map();
  for (const c of roll) {
    const name = c?.name || c?.context || Symbol('nameless-rollup-row'); // ungroupable — its own singleton group
    if (!byName.has(name)) byName.set(name, []);
    byName.get(name).push(c);
  }
  const out = [];
  for (const matches of byName.values()) {
    const tier = (k) => matches.filter((c) => rollupRowKind(c) === k);
    const pool = [tier('CheckRun'), tier('untagged'), matches].find((t) => t.length);
    out.push(pool[pool.length - 1]);
  }
  return out;
}

/**
 * Which member of GitHub's `StatusCheckRollupContext` union a rollup row is — `'CheckRun'`, `'StatusContext'`,
 * or `'untagged'` (unknown provenance, never granted CheckRun rank). `__typename` is authoritative when present;
 * only when it is absent entirely do we fall back to shape, and then only for the ONE unambiguous case: a
 * `context` with no `name` is the legacy commit-status shape and nothing else. A bare `name` is NOT taken as
 * proof of a CheckRun — that is exactly the inference `rollupToCheckRows` output would fool. Pure.
 * @param {object|null|undefined} c a single `statusCheckRollup` entry
 * @returns {'CheckRun'|'StatusContext'|'untagged'}
 */
export function rollupRowKind(c) {
  const t = c?.__typename;
  if (t === 'CheckRun' || t === 'StatusContext') return t;
  if (t) return 'untagged';                                     // a union member we don't know — no CheckRun rank
  if (c?.context != null && c?.name == null) return 'StatusContext'; // unambiguous legacy commit-status shape
  return 'untagged';
}

/** Is the required `test` check green on this PR's rollup? (Other checks — cla, Workers Builds — are ignored.)
 *  Reads the LATEST run of that check (#xkfv491), never the first-listed one. */
export function isRequiredCheckGreen(pr, requiredCheck = 'test') {
  const check = latestRequiredCheck(pr, requiredCheck);
  if (!check) return false;
  const concl = String(check.conclusion || check.state || '').toUpperCase();
  return concl === 'SUCCESS';
}

/** Is the required `test` check DEFINITIVELY red (failed/cancelled/timed-out/errored) on this PR's rollup? The
 *  twin of `isRequiredCheckGreen` (#2421), reading the same LATEST run (#xkfv491) — so a superseded CANCELLED
 *  run can no longer stamp `ci:failed` on a PR whose current run went green. A MISSING check (not yet reported)
 *  is NOT failed — it reads as in-flight (`checking`), never `ci:failed`; only a check GitHub has actually
 *  concluded red counts. */
export function isRequiredCheckFailed(pr, requiredCheck = 'test') {
  const check = latestRequiredCheck(pr, requiredCheck);
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
 *
 * HOLD-INTEGRITY (#2820). The merge decision is an AND, never an OR on `ready-to-merge` alone: a PR bearing an
 * UNSATISFIED review hold — `review:changes` / `review:human`, or a non-relieved `review:pending`, all WITHOUT
 * `review:accepted` — is SKIPPED here regardless of `ready-to-merge`. ci-lifecycle stamps `ready-to-merge` on
 * green CI independently of review state, so the hold and the go-ahead sit on the same PR at once; reading only
 * `ready-to-merge` let the go-ahead win and merged WE #956 while it carried `review:changes`. Checking the review
 * hold in the predicate itself makes it the single source of truth — no label-timing race downstream can slip a
 * held PR through. `allowPendingReview` mirrors the #2423 per-PR relief valve: a PR the operator named in
 * `--no-review-escalation=<pr#>` may still merge past `review:pending` (NEVER past `review:changes`/`review:human`,
 * which stay held even when relieved). A PR with NO review label at all is unaffected — it merges exactly as before.
 */
export function classifyPr(pr, { requiredCheck = 'test', trustLabel = 'ready-to-merge', allowPendingReview = false } = {}) {
  const num = pr?.number;
  const title = pr?.title || '';
  const aiGenerated = isAiGeneratedPr(pr);
  const certifyLabel = hasLabel(pr, trustLabel);
  // #2196/#2326 — a HUMAN clearing a parked PR (review:accepted, applied ONLY by /review) is the strongest
  // producer-certification there is: it means "this may merge", regardless of the AI-trailer heuristic. Without
  // this a cleared PR whose only non-AI commit is the drain's OWN rebase (`drain: rebase …`, no Co-Authored-By
  // trailer, and not a `Merge branch` mechanical commit isAiGeneratedPr forgives) is neither label- nor
  // AI-certified — silently dropped from the queue: accepted but stranded. decideReviewGate already says merge
  // on review:accepted, but a PR must first BE certified to enter the candidate set for that gate to run.
  const humanCleared = hasLabel(pr, REVIEW_LABELS.accepted);
  const certified = certifyLabel || aiGenerated || humanCleared; // #2195: the label OR every-commit-AI OR a human clear certifies
  const testGreen = isRequiredCheckGreen(pr, requiredCheck);
  const state = String(pr?.mergeStateStatus || '').toUpperCase();
  const mergeable = String(pr?.mergeable || '').toUpperCase();
  const landableState = state === 'CLEAN' || state === 'UNSTABLE'; // UNSTABLE = mergeable, only non-required checks red
  // #2820 HOLD-INTEGRITY — is an unsatisfied review hold live on this PR? `hasUnclearedReviewLabel` is the shared
  // hold predicate: true iff review:changes / review:human (or, unless relieved, review:pending) is present AND
  // review:accepted is NOT. This is the durable half of the fix — the merge predicate ANDs review-satisfied with
  // ready-to-merge, so no downstream ci-lifecycle re-add of `ready-to-merge` can slip a held PR through.
  const reviewUncleared = hasUnclearedReviewLabel(pr?.labels, { allowPending: allowPendingReview });
  const heldLabel = hasLabel(pr, REVIEW_LABELS.changes) ? REVIEW_LABELS.changes
    : hasLabel(pr, REVIEW_LABELS.human) ? REVIEW_LABELS.human
      : REVIEW_LABELS.pending;
  let decision = 'merge';
  // #2820-review-fix (finding 3) — `reviewHeld` means the review hold is the OPERATIVE blocker: the PR is
  // otherwise fully landable (certified, green, cleanly mergeable, real body) and ONLY the uncleared review label
  // stops it. It is set true inside the else-if chain BELOW, reached only after the CI / mergeability / landable /
  // body clauses all pass — so a red-CI, CONFLICTING, or bodyless PR that merely happens to carry a review label
  // is NOT `reviewHeld` and keeps its more actionable reason. That matters because `reviewHeld` is what admits a
  // PR into the downstream passes gated on it (the escalation pass, the id-collision heal): those must only ever
  // see a PR the hold ALONE is holding, never one already unlandable for a different reason (finding 3 / 4).
  let reviewHeld = false;
  let reason = certifyLabel
    ? `producer-certified (label "${trustLabel}"), required check green, cleanly mergeable`
    : humanCleared
      ? 'human-cleared (review:accepted), required check green, cleanly mergeable'
      : 'AI-generated, required check green, cleanly mergeable';
  if (!certified) { decision = 'skip'; reason = `not AI-generated (a commit lacks the Co-Authored-By: Claude trailer), no "${trustLabel}" label, and not human-cleared (review:accepted)`; }
  else if (!testGreen) { decision = 'skip'; reason = `required check "${requiredCheck}" is not green`; }
  else if (mergeable !== 'MERGEABLE') { decision = 'skip'; reason = `not mergeable (mergeable=${mergeable || 'UNKNOWN'})`; }
  else if (!landableState) { decision = 'skip'; reason = `merge state ${state || 'UNKNOWN'} (BEHIND⇒needs rebase, DIRTY/BLOCKED/DRAFT⇒not landable) — left for its author`; }
  // #2324 — refuse to land a PR with an empty/whitespace description, same rule pr-land.mjs enforces before
  // labelling (PR #206 landed bodyless). Checked before the review hold so the more actionable reasons win.
  else if (!hasNonEmptyBody(pr?.body)) { decision = 'skip'; reason = 'empty/whitespace description — refusing to land it (add a real summary of what changed and why; #2324)'; }
  // #2820 — the review hold is checked LAST, on an OTHERWISE-LANDABLE PR (every clause above passed): WE #956's
  // exact state (`ready-to-merge` + `review:changes`, green, cleanly mergeable) is refused HERE with the hold as
  // the auditable reason, while a red / unmergeable / bodyless held PR keeps its more actionable reason. This is
  // still a hard AND on ready-to-merge — no path lets a held PR reach `merge` — but only when the hold is the SOLE
  // blocker does it flag `reviewHeld`, so the downstream passes see the hold in isolation. No review label ⇒ never
  // held ⇒ a no-op for the common case (#2820-review-fix finding 3 — "checked LAST so earlier reasons win").
  else if (reviewUncleared) { decision = 'skip'; reviewHeld = true; reason = `unsatisfied review hold ("${heldLabel}") present without review:accepted — refusing to merge regardless of "${trustLabel}" (#2820)`; }
  return { num, title, decision, reason, aiGenerated, certifyLabel, humanCleared, reviewHeld, testGreen, state, mergeable };
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
  return !!v && v.decision === 'merge' && !!v.hasManifest; // @merge-gate-exempt a held PR must NEVER be manifest-stripped (a force-push mutation); reviewHeld PRs are excluded here on purpose
}

/**
 * #2684 — is this candidate a cross-locus couple's WE half that was OVERLAP-STACKED on its impl tip? Such a PR
 * carries the couple manifest (`hasManifest` + `crossRepo`) AND a per-repo `base` sha (`v.base` — the impl tip
 * it stacked on, from `manifestBaseForRepo`). Used ONLY to TAG which couple CI-concurrency regime the
 * rebase-drop outcome realized (`current` = fast-forward skip, `rebased` = the re-CI fallback) — observability,
 * never a control-flow gate: the git state itself is the guard (a superseded base makes the half BEHIND →
 * `rebased` → re-CI, so it never lands on a base its CI never validated). A WE half opened off `main` (a serial
 * couple) has no `base` → not stacked → untagged, unchanged path. Pure. */
export function isStackedWeCoupleHalf(v) {
  return !!v && !!v.hasManifest && !!v.crossRepo && typeof v.base === 'string' && /^[0-9a-f]{7,64}$/i.test(v.base);
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
 * #xc7p3q9 (R13) — the second argument is a REQUIRED options bag, not an afterthought: a bare one-arg call
 * `joinImplToCouples(verdicts)` runs with `carrierHealth=null, contextComplete=false`, which fails EVERY impl
 * closed (`incomplete-context`) — never call it without threading the pass's real context.
 *
 * @param {Array<{num:number, repo:(string|null), headRef?:string, hasManifest?:boolean, manifestRefs?:string[], item?:(number|string|null), blockedBy?:Array<number|string>, stackParents?:Array<number|string>, decision?:string}>} verdicts
 * @param {object} [opts]
 * @param {Map|null} [opts.carrierHealth]   the blind-context carrier health index (`buildCarrierHealth`); the gate reads `held`/`nameable`/`degraded` from it, NEVER from the narrowed candidate list.
 * @param {boolean} [opts.truncated]        the open-PR listing hit the `--limit` cap → fail closed (may be missing carriers).
 * @param {boolean} [opts.contextComplete]  the blind context is PROVABLY complete → a carrier's ABSENCE reads as "landed"; false → absence is UNKNOWN → fail closed.
 * @param {Set|null} [opts.openHeadRefs]    (R7) the head refs the blind context shows OPEN, so a carrier defers while a sibling `manifestRefs` entry is still an open, not-landing PR.
 * @returns {typeof verdicts}
 */
export function joinImplToCouples(verdicts, { carrierHealth = null, truncated = false, contextComplete = false, openHeadRefs = null } = {}) {
  const list = Array.isArray(verdicts) ? verdicts : [];
  const health = carrierHealth instanceof Map ? carrierHealth : new Map();
  const liveSet = new Set(list);                    // the live candidate verdicts (for the B7 two-sided defer)
  const openRefs = openHeadRefs instanceof Set ? openHeadRefs : new Set();   // #xc7p3q9 (R7) — blind-context open head refs
  // Index every carrying PR (a WE couple manifest) by each of its couple's lane refs. First writer wins — a
  // lane ref belongs to exactly one couple, so a duplicate is defensive noise, never a real second couple.
  const byRef = new Map();
  const indexCarrier = (v) => {
    if (!v || !v.hasManifest) return;
    for (const ref of Array.isArray(v.manifestRefs) ? v.manifestRefs : []) {
      if (ref && !byRef.has(ref)) byRef.set(ref, v);
    }
  };
  // #xc7p3q9 — index the LIVE candidate carriers (from `verdicts`) FIRST, then SUPPLEMENT from the label/only-
  // BLIND `carrierHealth` (constellation-wide, single-sourced — B9 removes the redundant `buildExtraCoupleCarriers`
  // projection). This is the couple-join twin of PR #999/xq985wu's ordering decouple: when a HELD WE carrier is
  // STRIPPED of `ready-to-merge` (or merely NARROWED out of the `--only`/`--repos` candidate list), it leaves
  // `verdicts` — so a byRef built from verdicts alone loses its couple's lane refs and the manifest-LESS impl half
  // (frontierui/plateau-app) inherits NOTHING, reads as an always-ready orphan, and lands ALONE (no WE resolve,
  // couple blockedBy/#2393 stackParents proof bypassed). Supplementing from the health map keeps a stripped/
  // narrowed carrier indexable by its manifestRefs so the impl still inherits the couple edge. Candidate-FIRST
  // ordering keeps a normal couple's LIVE carrier as the index target (so the B7 defer propagates to the real
  // verdict, not a synthetic).
  for (const v of list) indexCarrier(v);
  for (const h of health.values()) indexCarrier({ num: h.num, repo: h.repo, hasManifest: true, manifestRefs: h.manifestRefs, item: h.item, blockedBy: h.blockedBy, stackParents: h.stackParents });
  for (const v of list) {
    if (!v || v.hasManifest) continue;             // a carrying PR keeps its own manifest
    const couple = v.headRef ? byRef.get(v.headRef) : null;
    if (!couple) continue;                          // a true orphan → unchanged always-ready behaviour
    v.item = couple.item;                           // inherit the couple's identity + gate edges
    v.blockedBy = Array.isArray(couple.blockedBy) ? couple.blockedBy.slice() : [];
    v.stackParents = Array.isArray(couple.stackParents) ? couple.stackParents.slice() : [];
    v.joinedToCouple = couple.item;                 // marks an impl PR gated via its couple (diagnostics/tests)
    // #xc7p3q9 — the COUPLE-GATE decision, computed HERE (plan-prep time) from the carrier's HEALTH read out of
    // the label/only/repo-BLIND `carrierHealth` map (sourced from `collectOpenPrContext`, which lists ALL open PRs
    // constellation-wide) — NOT from the carrier's presence in the NARROWED candidate `list`. Fix-1: a carrier
    // merely filtered out of `list` by `--only`/`--repos`/`--this-repo` but present-and-HEALTHY in the blind
    // context must NOT defer the impl; only a carrier that is genuinely OPEN-AND-HELD, UNNAMEABLE, DEGRADED, in a
    // TRUNCATED listing, or ABSENT-FROM-AN-INCOMPLETE-context (B1/B2/B3) defers it. The decision is stamped on the
    // impl; `planLabelDrain` READS it and never re-derives from `list`.
    v.coupleCarrier = { num: couple.num ?? null, repo: couple.repo ?? null, item: couple.item ?? null };
    const key = `${couple.repo || 'cwd'}::${couple.num}`;
    const h = health.get(key) ?? null;
    const dec = carrierDeferDecision({ health: h, truncated, contextComplete });
    v.coupleDefer = dec.defer;
    v.coupleDeferReason = dec.reason;
    v.coupleHumanTerminal = dec.humanTerminal === true;   // #xc7p3q9 (R9) — the carrier is HELD regardless of the winning reason
    // #xc7p3q9 (B7) — the defer is TWO-SIDED: when a couple cannot fully land, the WE carrier must NOT land ahead
    // of its held/undeferrable impl half (else main gets the item's active→resolved flip + the WE change with the
    // impl still open). If the carrier is a LIVE candidate verdict, propagate the defer onto it too. A held-couple
    // carrier is already `skip` (classifyPr) so this is a no-op there; the case that matters is a HEALTHY carrier
    // whose impl fails closed on truncated/degraded/unnameable/incomplete-context — without this it would land
    // WE-first. The reason is carried through (never 'held' here) so idle accounting keeps polling (may re-clear).
    if (dec.defer && liveSet.has(couple)) {
      couple.coupleDefer = true;
      if (couple.coupleDeferReason !== 'held') couple.coupleDeferReason = dec.reason;
    }
  }
  // #xc7p3q9 (R7) — the couple-level invariant, carrier side: before a carrier enters `ready`, EVERY `manifestRefs`
  // entry other than its OWN head must be ABSENT from the blind context (its impl already landed/closed) or
  // JOINED-AND-READY (a live impl verdict on that ref that is landing this pass). Under `--only=<carrierPR>` the
  // impl half is NOT a candidate verdict, so the impl-verdict→carrier propagation (B7) above never fires — yet the
  // impl PR is still OPEN in the blind context. Without this a WE carrier lands with the `active→resolved` flip
  // while its impl PR sits open (B7's stated invariant, un-covered on the carrier-only narrow).
  const readyImplRefs = new Set(list.filter((v) => v && !v.hasManifest && v.decision === 'merge' && v.coupleDefer !== true).map((v) => v.headRef).filter(Boolean));
  for (const v of list) {
    if (!v || !v.hasManifest) continue;               // carriers only
    const own = v.headRef;
    for (const ref of Array.isArray(v.manifestRefs) ? v.manifestRefs : []) {
      if (!ref || ref === own) continue;
      const implOpenNotLanding = openRefs.has(ref) && !readyImplRefs.has(ref);
      if (implOpenNotLanding) {
        v.coupleDefer = true;
        if (v.coupleDeferReason !== 'held') v.coupleDeferReason = 'impl-open';
        break;
      }
    }
  }
  return list;
}

/**
 * #2899 A5 — which item ids should the label lander RESOLVE after this pass's JIT numbering? Pure.
 *
 * `landedItems` is the pass's `landedThisPass` set — item ids stamped on the WE-CARRIER merge. Two corrections
 * turn that into the set safe to resolve:
 *
 * **1 — re-key hashes to their minted NNN.** A hash-born item (#2288) was JUST renamed to its real `<NNN>` by
 * `numberPendingHashes`, so resolving under the pre-numbering hash would look for a file that no longer exists.
 * Re-key through `assigned` (`[{hash, nnn}]`, the numbering's own report) and de-duplicate, preserving
 * first-seen order so the emitted log line is stable. A hash with NO `assigned` entry is kept AS-IS rather than
 * dropped: numbering can legitimately be a no-op (the card landed already-numbered, or a concurrent lander
 * minted it), and `resolveLandedItem` is a safe no-op when the path does not resolve — whereas dropping it
 * would silently re-open the stranded-item hole this closes.
 *
 * **2 — require the WHOLE couple to have landed, not just the carrier (PR #1012 round-3 review, B5).** The
 * original gate rested on a comment claiming "WE-last ordering means the carrier merges only after its impl half
 * did". That is FALSE, and it was disproved by running the cascade: `coupleDefer`/`readyImplRefs` are computed
 * once at PLAN time from `decision === 'merge'` — a *planned* merge — and the in-cascade `replan` calls
 * `planLabelDrain` only, so the couple join never re-runs. If the impl's `gh pr merge` throws (conflict, branch
 * protection, CI flipping red between classify and merge), the handler sets its decision to `skip` and the
 * carrier STILL lands. Resolving off the carrier alone then flips the card to `resolved` on main with the
 * implementation PR still open — and nothing re-dispatches it, which is the exact forever-block this item
 * exists to close, reappearing inside the fix.
 *
 * So a couple resolves only when every OTHER lane ref its manifest names is **no longer an open PR**: either it
 * merged in this pass or it had already landed. A sibling ref still sitting in `openHeadRefs` is positive
 * evidence the couple did not fully land, and it defers the flip to a later pass — the safe direction, since an
 * unresolved card is a re-pack (annoying) while a wrongly-resolved one is a silent forever-block (harmful).
 * A carrier with no `carriers` entry keeps the old behaviour, so a caller that cannot supply couple shape is
 * unchanged rather than silently blocked.
 *
 * @param {{landedItems?: Iterable<number|string>,
 *          assigned?: Array<{hash:(string|number), nnn:(string|number)}>,
 *          carriers?: Array<{item:(number|string), headRef?:string, manifestRefs?:string[]}>,
 *          openHeadRefs?: Iterable<string>}} o
 * @returns {Array<number|string>} ids to flip, de-duplicated, in first-seen order
 */
export function planResolveOnLand({ landedItems = [], assigned = [], carriers = [], openHeadRefs = [] } = {}) {
  const byHash = new Map();
  for (const a of (Array.isArray(assigned) ? assigned : [])) {
    if (a && a.hash != null && a.nnn != null) byHash.set(String(a.hash), a.nnn);
  }
  // Couple shape keyed by item — but the WE CARRIER wins on collision (jury J4). A non-WE PR can carry a body
  // manifest too, so two verdicts can share one item id; if the impl half won, its ref became `headRef` and the
  // exemption below skipped the very ref that proves the couple is incomplete.
  const coupleByItem = new Map();
  for (const c of (Array.isArray(carriers) ? carriers : [])) {
    if (!c || c.item == null) continue;
    const key = String(c.item);
    const prev = coupleByItem.get(key);
    if (prev && prev.isWe && !c.isWe) continue;          // keep the WE carrier
    coupleByItem.set(key, {
      isWe: !!c.isWe,
      headRef: c.headRef || null,
      refs: (Array.isArray(c.manifestRefs) ? c.manifestRefs : []).filter(Boolean),
    });
  }
  const stillOpen = new Set([...(openHeadRefs || [])].filter(Boolean).map(String));
  const resolve = [];
  const deferred = [];
  const seen = new Set();
  for (const raw of (landedItems || [])) {
    if (raw == null) continue;
    const id = byHash.has(String(raw)) ? byHash.get(String(raw)) : raw;
    const key = String(id);
    if (seen.has(key)) continue;
    seen.add(key);
    // B5 — a sibling half still OPEN proves the couple did not fully land this pass. Keyed on the PRE-numbering
    // id, because that is what the manifest (and `landedThisPass`) carries. The withheld item is REPORTED, not
    // dropped (jury J2): this deferral is terminal for the run, and the A4 stranded sweep is the recovery path.
    const couple = coupleByItem.get(String(raw));
    const blocking = couple ? couple.refs.filter((r) => r !== couple.headRef && stillOpen.has(String(r))) : [];
    if (blocking.length) deferred.push({ id, reason: `couple half still open: ${blocking.join(', ')}` });
    else resolve.push(id);
  }
  return { resolve, deferred };
}

/**
 * #2899 A5 — back-compat shim: the ids to flip. Prefer `planResolveOnLand`, which also reports what it withheld
 * — a caller that only takes this list cannot honour the totality rule (every landed item in exactly one
 * observable bucket) that jury finding J2 exists to enforce.
 */
export function resolveIdsForLandedPass(o = {}) {
  return planResolveOnLand(o).resolve;
}

/**
 * #xc7p3q9 — decide, from a carrier's HEALTH (read out of the label/only-blind full open-PR context),
 * whether a coupled impl half must DEFER with it. Pure. The health object (from `buildCarrierHealth`) carries
 * `{ held, nameable, degraded }`; `null` health means the carrier is ABSENT from the blind context entirely.
 *
 * COMPLETENESS IS A PROPERTY OF THE CONTEXT, NOT OF A ROW (B1/B2/B3 fix). The old code read `health === null`
 * as "genuinely landed → NOT a defer" — a fail-OPEN on three independent paths, because a null health entry
 * is ALSO what you get when (B2) a `gh pr list` threw and was swallowed to `[]`, (B1) a manifest read degraded
 * so the carrier was dropped, or (B3) the context was never collected (`RECONCILE` false). So absence in the
 * context is read as real "landed" ONLY when the context is PROVABLY complete (`contextComplete === true`);
 * otherwise absence is UNKNOWN and we fail CLOSED. Fail-CLOSED order:
 *   - `truncated` (the `--limit` cap was hit — the listing MAY be missing PRs) → DEFER.
 *   - health `null` + `contextComplete` → NOT a defer: genuinely landed/closed (a COMPLETE blind context lists
 *     ALL open PRs, so absence there is real absence). health `null` + NOT `contextComplete` → DEFER: absence is
 *     unknowable (a swallowed listing error / a degraded read / an uncollected context could hide the carrier).
 *   - `degraded` (a swallowed `gh` error left this carrier's read incomplete/unreadable) → DEFER (fail closed).
 *   - not `nameable` (an invalid/`NaN`/`null`/`0` item id — the #2388 collapse hazard) → DEFER (fail closed —
 *     never land an impl whose couple can't be positively named).
 *   - `held` (a live `review:*` hold with no `review:accepted`) → DEFER — the carrier is not landing.
 *   - otherwise → NOT a defer (present-and-healthy → the impl lands as the fast drain did before Fix 1).
 * @param {{health:({held?:boolean,nameable?:boolean,degraded?:boolean}|null), truncated?:boolean, contextComplete?:boolean}} o
 * @returns {{defer:boolean, reason:string}}
 */
export function carrierDeferDecision({ health = null, truncated = false, contextComplete = false } = {}) {
  // #xc7p3q9 (R9) — `humanTerminal` = the carrier is HELD (a `review:*` hold), computed from `health.held`
  // REGARDLESS of which defer reason won. A held carrier with ANY read noise (truncated/degraded) still defers on
  // the noisier reason, but the hold will NOT clear by polling — so idle accounting must treat the couple as
  // settled. Returned separately so the reason (which may re-clear) and the human-terminal fact don't collide.
  const humanTerminal = !!(health && health.held);
  if (truncated) return { defer: true, reason: 'truncated', humanTerminal };
  if (!health) return contextComplete ? { defer: false, reason: 'absent-landed', humanTerminal: false } : { defer: true, reason: 'incomplete-context', humanTerminal: false };
  if (health.degraded) return { defer: true, reason: 'degraded', humanTerminal };
  if (!health.nameable) return { defer: true, reason: 'unnameable', humanTerminal };
  if (health.held) return { defer: true, reason: 'held', humanTerminal: true };
  return { defer: false, reason: 'healthy', humanTerminal: false };
}

/**
 * #xc7p3q9 — the carrier-HEALTH index for the couple gate, built from the label/only/repo-BLIND full open-PR
 * context (`collectOpenPrContext`), keyed `${repo||'cwd'}::${num}`. Pure. For every open PR carrying a couple
 * manifest it records `{ held, nameable, degraded }` — the ONLY signals the gate reads (never the narrowed
 * candidate list).
 *   - `held` = an uncleared `review:*` hold on the PR's labels. B6 — computed with the SAME
 *     `escalationRelief`/`--no-review-escalation` waiver `classifyPr` threads (`allowPending`), so this gate's
 *     `held` and `classifyPr`'s `held` cannot disagree; otherwise the escape hatch lands the WE carrier while
 *     the impl defers `held` → the couple lands WE-first, inverting impl-first/WE-last.
 *   - `nameable` = a positively-named item id, derived from the SAME expression that computes `item` (B4) so the
 *     two can never contradict; `isItemId` is FALSE for the `NaN`/`null`/`0` an item-less manifest yields.
 *   - `degraded` = the PR's context read was a swallowed-error best-effort (from `openPrContext.degradedByPr`).
 * B1 — a carrier whose manifest read DEGRADED (threw → `{manifest:null, degraded:true}`) is NOT dropped: it gets
 * a `{ degraded:true, unreadable:true, nameable:false }` marker entry so the gate fails closed on it, instead of
 * the old `continue` that erased the very case the `degraded` branch exists for.
 * @param {{manifestByPr?:Map, prsByRepo?:Map, degradedByPr?:Map}} openPrContext
 * @param {{escalationRelief?:{prs?:Array<number>, passWide?:boolean}, label?:(string|null)}} [opts]
 * @returns {Map<string, {num:number, repo:(string|null), item:(number|string), manifestRefs:string[], blockedBy:Array, stackParents:Array, held:boolean, nameable:boolean, degraded:boolean, unreadable?:boolean, present:true}>}
 */
export function buildCarrierHealth(openPrContext = {}, { escalationRelief = { prs: [], passWide: false }, label = null, candidateHeldByKey = null } = {}) {
  const health = new Map();
  const ctx = openPrContext || {};
  const relief = escalationRelief || { prs: [], passWide: false };
  // #xc7p3q9 (R5) — for a carrier that is ALSO a live candidate this pass, its FINAL decision (skip/park from the
  // escalation pass, which runs BEFORE this build now) is the authoritative `held`, not the pre-escalation label
  // snapshot. `candidateHeldByKey` (key→held) carries that final truth; carriers OUTSIDE the candidate set fall
  // back to the label read below.
  const finalHeldFor = (key, labelHeld) => (candidateHeldByKey instanceof Map && candidateHeldByKey.has(key)) ? !!candidateHeldByKey.get(key) : labelHeld;
  const manifestByPr = ctx.manifestByPr instanceof Map ? ctx.manifestByPr : new Map();
  const degradedByPr = ctx.degradedByPr instanceof Map ? ctx.degradedByPr : new Map();
  const labelsByKey = new Map();
  if (ctx.prsByRepo instanceof Map) {
    for (const [repo, prs] of ctx.prsByRepo) for (const p of (Array.isArray(prs) ? prs : [])) {
      labelsByKey.set(`${repo || 'cwd'}::${p.number}`, Array.isArray(p.labels) ? p.labels : []);
    }
  }
  for (const [key, manifest] of manifestByPr) {
    const [repoK, numK] = String(key).split('::');
    const num = Number(numK);
    const repo = repoK === 'cwd' ? null : repoK;
    const degraded = !!degradedByPr.get(key);
    // B6 — the SAME waiver `classifyPr` uses (per-PR `--no-review-escalation=<pr#>` OR the pass-wide bare flag,
    // gated on `!!label` exactly like the classify site) so the two `held` notions agree.
    const allowPending = (relief.prs || []).includes(num) || (!!relief.passWide && !!label);
    const held = finalHeldFor(key, hasUnclearedReviewLabel(labelsByKey.get(key) || [], { allowPending }));
    const refs = manifest && Array.isArray(manifest.repos) ? manifest.repos.map((r) => r && r.ref).filter(Boolean) : [];
    if (!manifest || !Array.isArray(manifest.repos) || !refs.length) {
      // B1 — a DEGRADED/unreadable carrier read must stay VISIBLE and fail closed, not vanish. A clean read with
      // no manifest is a plain non-carrier PR (an orphan / impl half) → not a carrier → skip.
      if (degraded) health.set(key, { num, repo, item: NaN, manifestRefs: [], blockedBy: [], stackParents: [], held, nameable: false, degraded: true, unreadable: true, present: true });
      continue;
    }
    // B4 — compute `item` ONCE, then derive `nameable` from it, so the two fields cannot contradict. `asItemId`
    // of an item-less manifest is NaN; keep it (never coerce to null, which would read as "absent/landed").
    const item = manifest.item != null ? asItemId(manifest.item) : NaN;
    health.set(key, {
      num,
      repo,
      item,
      manifestRefs: refs,
      blockedBy: Array.isArray(manifest.blockedBy) ? manifest.blockedBy.map(asItemId) : [],
      stackParents: Array.isArray(manifest.stackParents) ? manifest.stackParents.map(asItemId) : [],
      held,
      nameable: isItemId(item),                     // derived from the same `item` expression (B4)
      degraded,
      present: true,
    });
  }
  return health;
}

/**
 * #xc7p3q9 (R4 structural) — the PURE reduction of the label/only-blind open-PR context. Given the per-repo
 * `listings` (`[{repo, prs, failed}]`) and the per-PR `reads` (Map key→`{manifest, commits, degraded}`), compute
 * the maps + flags the couple gate consumes. `contextComplete` is computed HERE, in ONE place — runCli's collector
 * AND the test suite both call this, so nothing re-derives the formula (the round-1 hole: the closure computed it
 * once and the test helper re-typed it, with nothing binding the two). `reconcileRan:false` (a bare `/merge`
 * sweep or `--no-reconcile-labels`, where the context is never collected) is INCOMPLETE by construction (B3). Pure.
 * @param {{listings?:Array<{repo:(string|null), prs?:Array, failed?:boolean}>, reads?:Map, reconcileRan?:boolean}} o
 * @returns {{prsByRepo:Map, openItems:Set, manifestByPr:Map, commitsByPr:Map, degradedByPr:Map, truncated:boolean, contextComplete:boolean}}
 */
export function reduceOpenPrContext({ listings = [], reads = new Map(), reconcileRan = true } = {}) {
  const prsByRepo = new Map();
  const openItems = new Set();
  const manifestByPr = new Map();
  const commitsByPr = new Map();
  const degradedByPr = new Map();
  let listingTruncated = false;
  let listingFailed = false;
  const readsMap = reads instanceof Map ? reads : new Map();
  for (const entry of (Array.isArray(listings) ? listings : [])) {
    const repo = entry && 'repo' in entry ? entry.repo : null;
    const open = entry && Array.isArray(entry.prs) ? entry.prs : [];
    if (entry && entry.failed) listingFailed = true;                    // #xc7p3q9 (B2) — a swallowed `gh pr list` throw
    if (isDegradedOpenPrListing(open.length)) listingTruncated = true;  // #999/xq985wu F3 — a full page MAY be truncated
    prsByRepo.set(repo, open);
    for (const p of open) {
      const key = `${repo || 'cwd'}::${p.number}`;
      const r = readsMap.get(key) || {};
      const manifest = r.manifest ?? null;
      const commits = Array.isArray(r.commits) ? r.commits : [];
      manifestByPr.set(key, manifest);
      commitsByPr.set(key, commits);
      degradedByPr.set(key, !!r.degraded);   // #xc7p3q9 Fix 2 — a swallowed-error read → fail closed in the couple gate
      if (manifest && manifest.item != null) openItems.add(asItemId(manifest.item));
    }
  }
  const anyDegraded = [...degradedByPr.values()].some(Boolean);
  // #xc7p3q9 (B1/B2/B3) — completeness is a property of the CONTEXT, computed HERE once. Complete only when the
  // reconcile collection actually ran, every per-repo listing succeeded (B2), none was truncated at the `--limit`
  // cap (the oldest held blockers may be missing), and no per-PR read degraded (B1). Incomplete → the couple gate
  // reads a carrier's ABSENCE as UNKNOWN and fails closed, instead of as "landed" → orphan-land.
  const contextComplete = !!reconcileRan && !listingFailed && !listingTruncated && !anyDegraded;
  return { prsByRepo, openItems, manifestByPr, commitsByPr, degradedByPr, truncated: listingTruncated, contextComplete };
}

/**
 * #xc7p3q9 (R4 structural) — collect the label/only-blind constellation-wide open-PR context. Extracted OUT of
 * runCli's closure and made INJECTABLE (every gh dependency is a parameter) so the SAME code runCli runs is driven
 * by the test suite. `listOpenPrs(repo)` lists a repo's open PRs (may THROW → the swallowed-listing `failed` flag,
 * B2); `fetchReads(flat)` returns the per-PR read Map. A revert of the `failed` marker, or a narrowing of the
 * CONTEXT repo set, now breaks a test (R4 — the closure was previously unreachable from any test). The pure
 * reduction is {@link reduceOpenPrContext}; this owns only the async gh fan-out.
 * @returns {Promise<ReturnType<typeof reduceOpenPrContext>>}
 */
export async function collectOpenPrContext({ contextRepos = [], listOpenPrs, fetchReads, reconcileRan = true, onListingFailed = () => {}, onListingTruncated = () => {} } = {}) {
  const repos = Array.isArray(contextRepos) ? contextRepos : [];
  const listings = await mapWithConcurrency(repos, Math.max(1, repos.length), async (repo) => {
    try { return { repo, prs: await listOpenPrs(repo) }; }
    catch { return { repo, prs: [], failed: true }; }   // #xc7p3q9 (B2) — a swallowed throw marks the context INCOMPLETE
  });
  for (const { repo, prs, failed } of listings) {
    if (failed) onListingFailed(repo);
    else if (isDegradedOpenPrListing((prs || []).length)) onListingTruncated(repo, (prs || []).length);
  }
  const flat = [];
  for (const { repo, prs } of listings) for (const p of (prs || [])) flat.push({ repo, p });
  const reads = typeof fetchReads === 'function' ? await fetchReads(flat) : new Map();
  return reduceOpenPrContext({ listings, reads, reconcileRan });
}

/**
 * #xc7p3q9 (R3) — is a thrown `gh api …/contents/.lane-manifest.json` a DEFINITIVE "no manifest" (a 404 — the
 * file is confirmed absent from the ref's tree, exactly as the local-git fallback already treats a missing file)
 * rather than a transport/auth failure? A 404 is a genuine answer → `degraded:false`; every OTHER throw (5xx,
 * rate-limit, auth-scope, network) is `degraded:true` (fail closed, re-fetch next pass). Pure — inspects the
 * error's exit metadata + stderr/stdout text. This is why `contextComplete` was false on EVERY pass with a
 * manifest-less impl PR open (R3): the retired tree file 404s, and the old catch tagged that as degraded. */
export function isContentsNotFound(err) {
  if (!err) return false;
  const text = `${err.stderr ?? ''}\n${err.stdout ?? ''}\n${err.message ?? ''}`;
  return /\bHTTP\s*404\b|\b404\b|not\s*found/i.test(text);
}

/**
 * #xc7p3q9 (R3) — read a REMOTE-repo PR's legacy tree-committed manifest off its head ref via the GitHub contents
 * API (`gh api …/contents/.lane-manifest.json?ref=<headRef>` → base64 `.content`). Extracted + injectable (`exec`)
 * so the ERROR TAXONOMY is unit-tested with a stubbed exec: a 404 is a DEFINITIVE "no manifest on this ref"
 * (`degraded:false`) — the file was retired to the PR body (#2411), so it is legitimately absent from every ref's
 * tree; every OTHER throw (5xx / rate-limit / auth / network) is `degraded:true` (fail closed, re-fetch). This is
 * the root of the R2 livelock: the old blanket `degraded:true` made `contextComplete` false on EVERY pass with a
 * manifest-less impl PR open. Returns `{manifest, degraded}`.
 */
export async function readRemoteManifestViaApi({ exec, repo, headRef, apiArgs = remoteManifestApiArgs } = {}) {
  try {
    const { stdout } = await exec('gh', apiArgs(repo, headRef), { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const b64 = (stdout || '').trim();
    if (b64) { const m = JSON.parse(Buffer.from(b64, 'base64').toString('utf8')); if (m && m.item != null) return { manifest: m, degraded: false }; }
    return { manifest: null, degraded: false }; // API read SUCCEEDED → confirmed no manifest, not degraded
  } catch (e) {
    return { manifest: null, degraded: !isContentsNotFound(e) };
  }
}

/**
 * #xc7p3q9 — the couple half of the verdict build, extracted so runCli AND the test suite drive the SAME
 * narrowing→classify→attach path (Fix 4: the round-5 regressions all came from tests hand-building verdicts that
 * diverged from runCli's real wiring). Pure. `readOf(repo, num)` returns the per-PR `{ commits, manifest }` read.
 * @param {{prsByRepo:Map, readOf:function, repos:Array, requiredCheck?:string, escalationRelief?:object, label?:(string|null), isLocalRepo?:function, localSlug?:(string|null)}} o
 * @returns {Array} verdicts (classify + manifest fields attached; NOT yet couple-joined)
 */
export function buildDrainVerdicts({ prsByRepo, readOf, repos = [], requiredCheck = 'test', escalationRelief = { prs: [], passWide: false }, label = null, isLocalRepo = () => false, localSlug = null } = {}) {
  const verdicts = [];
  const relief = escalationRelief || { prs: [], passWide: false };
  for (const repo of (Array.isArray(repos) ? repos : [])) {
    const prs = (prsByRepo instanceof Map ? prsByRepo.get(repo) : null) || [];
    for (const p of prs) {
      const read = (typeof readOf === 'function' ? readOf(repo, p.number) : null) || {};
      p.commits = read.commits || [];
      const v = classifyPr(p, { requiredCheck, allowPendingReview: (relief.prs || []).includes(Number(p.number)) || (relief.passWide && !!label) });
      v.repo = repo;               // null (local clone) or a slug — routes the merge/view/edit + the git-side gate
      v.headRef = p.headRefName;
      attachManifestToVerdict(v, read.manifest ?? null, { repo, isLocalRepo, localSlug });
      v.prLabels = p.labels || [];
      verdicts.push(v);
    }
  }
  return verdicts;
}

/**
 * #xc7p3q9 — attach a PR's `.lane-manifest.json` fields (backlog item + cross-item edges + couple refs +
 * escalation-scoring inputs) onto its verdict. Pure MUTATE + return. Single-sourced (called by
 * `buildDrainVerdicts`) so every verdict-build attaches identical fields (Fix 4). Not exported — B10: it was
 * exported + imported by the test but never called there; it has no external caller now.
 */
function attachManifestToVerdict(v, m, { repo = null, isLocalRepo = () => false, localSlug = null } = {}) {
  v.item = m && m.item != null ? asItemId(m.item) : null;
  v.blockedBy = m && Array.isArray(m.blockedBy) ? m.blockedBy.map(asItemId) : [];
  v.hasManifest = m != null;      // #2183 — carries the transient manifest on its head → must be stripped before merge
  v.stackParents = m && Array.isArray(m.stackParents) ? m.stackParents.map(asItemId) : [];
  v.manifestRefs = m && Array.isArray(m.repos) ? m.repos.map((r) => r && r.ref).filter(Boolean) : [];
  v.crossRepo = m && Array.isArray(m.repos) ? m.repos.length > 1 : false;
  const local = typeof isLocalRepo === 'function' ? isLocalRepo(repo) : false;
  v.base = manifestBaseForRepo(m, local ? (repoKeyFromSlug(localSlug) || 'we') : repoKeyFromSlug(repo));
  v.dismissedFindings = m && Number.isFinite(Number(m.dismissedFindings)) ? Number(m.dismissedFindings) : 0;
  return v;
}

/**
 * #xc7p3q9 — the REAL `--only`/`--repos` narrowing of the per-repo listings, extracted (was inline in
 * runCli) so tests exercise it too (Fix 4). Pure. `listings` is `[{repo, prs}]` (the sweep listing); returns the
 * narrowed `Map<repo, PR[]>`. Mirrors runCli exactly: `--only` filters via `matchesOnlyTarget`, else pass-through.
 * @param {Array<{repo:(string|null), prs:Array}>} listings
 * @param {{onlyPr?:(string|null), onlyRepo?:(string|null), repos?:Array, isLocalRepo?:function}} o
 * @returns {Map<(string|null), Array>}
 */
export function narrowPrsByRepo(listings, { onlyPr = null, onlyRepo = null, repos = [], isLocalRepo = () => false } = {}) {
  const repoCount = (Array.isArray(repos) ? repos : []).length;
  const out = new Map();
  for (const { repo, prs } of (Array.isArray(listings) ? listings : [])) {
    const l = Array.isArray(prs) ? prs : [];
    out.set(repo, onlyPr ? l.filter((p) => matchesOnlyTarget({ prNumber: p.number, onlyPr, repo, onlyRepo, isLocal: (typeof isLocalRepo === 'function' ? isLocalRepo(repo) : false), repoCount })) : l);
  }
  return out;
}

/**
 * #xc7p3q9 (Fix 4 / B12) — the narrow→classify→attach half of the pass. `narrowPrsByRepo → buildDrainVerdicts`.
 * Deliberately does NOT couple-join or build carrier health: R5 moves the couple gate to AFTER the escalation/park
 * pass, so `held` is read from each carrier's FINAL decision, not a pre-escalation label snapshot. The join +
 * health + plan is {@link planDrainPass}, which runCli calls with the escalated verdicts. Pure. `readOf(repo,
 * num)` returns the per-PR `{ commits, manifest }` read.
 * @returns {{prsByRepo:Map, verdicts:Array}}
 */
export function prepareDrainVerdicts({ listings, repos = [], onlyPr = null, onlyRepo = null, readOf, requiredCheck = 'test', escalationRelief = { prs: [], passWide: false }, label = null, isLocalRepo = () => false, localSlug = null } = {}) {
  const prsByRepo = narrowPrsByRepo(listings, { onlyPr, onlyRepo, repos, isLocalRepo });
  const verdicts = buildDrainVerdicts({ prsByRepo, readOf, repos, requiredCheck, escalationRelief, label, isLocalRepo, localSlug });
  return { prsByRepo, verdicts };
}

/**
 * #xc7p3q9 (R4/R5) — the ONE production plan seam: build carrier HEALTH from the label/only-blind context, couple-
 * JOIN the impl halves (stamping `coupleDefer` from the carrier's health), and PLAN the merge order — threading
 * `truncated` + `contextComplete` + the plan-wide fail-closed invariant. runCli CALLS this (it is no longer a
 * test-only function — R4: previously `planDrainPass` had zero production callers and the runCli half re-typed its
 * own `planLabelDrain` wiring). Accepts EITHER pre-built `verdicts` (runCli's escalated verdicts — R5, the join
 * runs after the park pass) OR builds them from `listings` (a one-shot / the test suite). `candidateHeldByKey`
 * carries each live candidate's FINAL held (skip/park) so a carrier the escalation pass parked reads `held` (R5).
 * Pure.
 * @returns {{prsByRepo:Map, verdicts:Array, carrierHealth:Map, plan:{ready:Array, deferred:Array, staleLandedOpenItems:Array}}}
 */
export function planDrainPass({ verdicts = null, listings = null, openPrContext = {}, repos = [], onlyPr = null, onlyRepo = null, readOf, requiredCheck = 'test', escalationRelief = { prs: [], passWide: false }, label = null, isLocalRepo = () => false, localSlug = null, candidateHeldByKey = null, landedThisPass = new Set(), provenOnMain = new Set() } = {}) {
  let prsByRepo = null;
  let vs = verdicts;
  if (!Array.isArray(vs)) {
    const prep = prepareDrainVerdicts({ listings, repos, onlyPr, onlyRepo, readOf, requiredCheck, escalationRelief, label, isLocalRepo, localSlug });
    vs = prep.verdicts;
    prsByRepo = prep.prsByRepo;
  }
  const ctx = openPrContext || {};
  const carrierHealth = buildCarrierHealth(ctx, { escalationRelief, label, candidateHeldByKey });
  // #xc7p3q9 (R7) — the set of head refs the blind context shows OPEN, so a carrier cannot enter `ready` while a
  // sibling ref named in its manifest is still an open, not-landing PR (the impl-open couple-level invariant).
  const openHeadRefs = new Set();
  if (ctx.prsByRepo instanceof Map) for (const prs of ctx.prsByRepo.values()) for (const p of (Array.isArray(prs) ? prs : [])) { if (p && p.headRefName) openHeadRefs.add(p.headRefName); }
  joinImplToCouples(vs, { carrierHealth, truncated: !!ctx.truncated, contextComplete: !!ctx.contextComplete, openHeadRefs });
  const plan = planLabelDrain(vs, { landedThisPass, provenOnMain, extraOpenItems: ctx.openItems, contextComplete: !!ctx.contextComplete, isWeRepo: isLocalRepo });
  return { prsByRepo, verdicts: vs, carrierHealth, plan };
}

/**
 * #xc7p3q9 (Fix 3) — is a pass IDLE for the purpose of `--max-idle` / `--until-batches-idle`, given its
 * deferrals? A deferral `blocked SOLELY on a review-HELD carrier` (`heldCoupleOnly`, stamped by `planLabelDrain`)
 * is not real progress-in-waiting — a human hold will not clear by polling — so a pass whose EVERY deferral is
 * such a held-couple defer counts as idle. A degraded/truncated fail-closed defer does NOT count (it may clear on
 * a re-fetch, so keep polling). Pure. Empty `deferred` is handled by the caller's own `=== 0` short-circuit.
 * @param {Array<{heldCoupleOnly?:boolean}>} deferred
 * @returns {boolean}
 */
export function deferralsAllHeldCouple(deferred) {
  const list = Array.isArray(deferred) ? deferred : [];
  return list.length > 0 && list.every((d) => d && d.heldCoupleOnly === true);
}

/**
 * #xc7p3q9 (R4 structural / Fix 3) — is a `--watch` pass IDLE for `--max-idle`? Extracted OUT of the inline runCli
 * expression so a revert of the held-couple allowance breaks a test (mutation 5). Idle = nothing merged, no tip
 * rebuilt, and EITHER nothing deferred OR every deferral is a human-held couple (won't clear by polling). Pure.
 */
export function isPassIdle({ merged = 0, pendingRebased = 0, deferred = [] } = {}) {
  const d = Array.isArray(deferred) ? deferred : [];
  return merged === 0 && pendingRebased === 0 && (d.length === 0 || deferralsAllHeldCouple(d));
}

/**
 * #xc7p3q9 (R4 structural / B5) — is the `--until-batches-idle` CONFIRM sweep settled (safe to STOP)? Extracted
 * OUT of the inline runCli expression so a revert of the held-couple allowance breaks a test (mutation 6). Settled
 * = nothing merged, no tip rebuilt, and the queue is empty OR blocked SOLELY on a human-held couple (on both the
 * `considered` and the `deferred` reading). Pure.
 */
export function isConfirmSweepSettled({ merged = 0, pendingRebased = 0, considered = 0, deferred = [] } = {}) {
  const d = Array.isArray(deferred) ? deferred : [];
  return merged === 0 && pendingRebased === 0
    && (considered === 0 || deferralsAllHeldCouple(d))
    && (d.length === 0 || deferralsAllHeldCouple(d));
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
 * #xc7p3q9 (R1) — the PLAN-WIDE fail-closed invariant: when `contextComplete === false`, a manifest-less verdict
 * from a NON-WE repo (`!isWeRepo(repo)`) MIGHT be a coupled impl whose carrier we could not read, so it must never
 * appear in `ready` — it defers, whether or not a couple-join stamped `coupleDefer`. This catches the un-joined
 * orphan the per-carrier gate structurally misses (an unreadable/unlisted carrier has no `manifestRefs` to key a
 * join on). #xc7p3q9 (R2) — a verdict's `waitOn` is NEVER allowed to name its OWN item (a self-referential wait is
 * structurally unsatisfiable — the livelock); such an edge is stripped.
 * @param {{landedThisPass?:Set, provenOnMain?:Set, extraOpenItems?:Iterable<number|string>, contextComplete?:boolean, isWeRepo?:function}} [proof]  positive proof-of-land sets (both `asItemId`-keyed)
 * @returns {{ready:Array, deferred:Array<{num,item,waitOn:Array<number|string>}>, staleLandedOpenItems:Array<number|string>}}  ready is ordered (item asc, then PR#); staleLandedOpenItems = items proven landed yet still named by an open PR (#999/xq985wu F2 stale-PR diagnostic).
 */
export function planLabelDrain(candidates, { landedThisPass = new Set(), provenOnMain = new Set(), extraOpenItems = null, contextComplete = true, isWeRepo = () => false } = {}) {
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
  // #2683 — `extraOpenItems` unions in the items of open PRs OUTSIDE the candidate `list`. This is what makes a
  // `--only=<pr>` FAST DRAIN (whose candidate list is NARROWED to the single target PR) order IDENTICALLY to the
  // full sweep: without it the target's `blockedBy`/`stackParents` edges pointing at a still-open SIBLING PR
  // would resolve against an `openItems` that only knows the target's own item → the edge reads as "landed" and
  // the target lands EARLY (AC1). Feeding the full open-PR item set (from the pass's `collectOpenPrContext`) in
  // here defers the target whenever a blocker is still open — never lands it ahead of its dependency. A superset
  // is safe: it can only ADD a defer, never drop one (the safe direction). Empty/absent on the full sweep, where
  // the candidate list already IS the full set.
  if (extraOpenItems) for (const it of extraOpenItems) { if (it != null) openItems.add(asItemId(it)); }
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
  // #999/xq985wu LIVENESS FIX — an item is a LIVE blocker only if it is open AND not proven landed. This mirrors
  // `stackProven`'s landedThisPass-BEFORE-openItems precedence on the `blockedBy` path, which it lacked: the
  // frozen `extraOpenItems` superset is snapshotted BEFORE any merge and never updated, so without this a blocker
  // that landed THIS pass (`landedThisPass`, added on its WE-carrier merge) or in a PRIOR session (`provenOnMain`,
  // `bornAs`-proven on main) stays in `openItems` and defers its dependent forever — a chain lands one link per
  // pass (F1), and a stale/abandoned/impl-half PR still naming a LANDED item defers dependents permanently (F2).
  // POSITIVE proof only (never absence): the edge clears solely on landedThisPass OR provenOnMain, matching the
  // stowaway guard — an open blocker with no proof still defers.
  const provenLanded = (id) => landedThisPass.has(id) || provenOnMain.has(id);
  const ready = [];
  const deferred = [];
  // #999/xq985wu F2 diagnostic — items proven landed yet STILL named by an open PR (present in `openItems`). The
  // fix clears their `blockedBy`/`stackParents` edges, but the open PR naming a landed item is a STALE-PR smell
  // worth surfacing so a real "blocker genuinely unlanded" defer is distinguishable from it. Collected here (the
  // one place with both sets in scope) and returned for the caller to name the holding PR.
  const staleLandedOpenItems = [...openItems].filter((id) => provenLanded(id));
  for (const c of list) {
    if (c.decision !== 'merge') continue; // @merge-gate-exempt builds the merge-ORDERING lists (ready/deferred); a held PR is `skip` and correctly not ordered for landing — it must not join the merge cascade
    const blockWait = (Array.isArray(c.blockedBy) ? c.blockedBy : []).map(asItemId).filter((b) => openItems.has(b) && !provenLanded(b));
    const stackWait = (Array.isArray(c.stackParents) ? c.stackParents : []).map(asItemId).filter((sp) => !stackProven(sp));
    // #xc7p3q9 — the COUPLE gate: a manifest-less impl PR joined to a WE couple defers with its carrier
    // when `joinImplToCouples` stamped `coupleDefer` — a carrier that is OPEN-AND-HELD, unnameable, degraded, or
    // in a truncated listing (all knowable from the label/only-blind context, NEVER from the narrowed `list`).
    // This reads the PRECOMPUTED boolean; it does NOT re-derive the carrier's landing status from `list` (the
    // Fix-1 hole: `--only`/`--repos` narrows `list` to the impl half, so a carrier-in-`list` test defers a
    // perfectly healthy open carrier's impl forever). A carrier merely DEFERRED on its OWN edges keeps the impl
    // bound via the inherited blockedBy/stackParents above — this gate only adds the carrier-NOT-LANDING case.
    const coupleDeferred = c.coupleDefer === true;
    // #xc7p3q9 (R2) — the couple-wait token references the CARRIER PR distinctly (never the impl's own — often
    // INHERITED — item), so the self-wait strip below cannot erase a genuine couple defer while it still removes a
    // literal self-referential edge.
    const coupleWait = coupleDeferred ? [`couple-carrier:${c.coupleCarrier?.num ?? c.coupleCarrier?.item ?? 'unknown'}`] : [];
    // #xc7p3q9 (R1) — PLAN-WIDE fail-closed backstop: in an INCOMPLETE context a manifest-less verdict from a
    // NON-WE repo MIGHT be a coupled impl whose carrier we could not read → it must never enter `ready`, whether or
    // not a join stamped `coupleDefer`. Catches the un-joined orphan the per-carrier gate structurally misses.
    const blindImplDefer = contextComplete !== true && c.hasManifest !== true && !isWeRepo(c.repo);
    const blindWait = blindImplDefer ? ['incomplete-context'] : [];
    // #xc7p3q9 (R2) — a verdict may NEVER waitOn its OWN item (a self-referential wait is structurally
    // unsatisfiable — the livelock). Strip any edge naming this verdict's own item.
    const waitOn = [...new Set([...blockWait, ...stackWait, ...coupleWait, ...blindWait])].filter((w) => c.item == null || String(w) !== String(c.item));
    if (waitOn.length === 0) ready.push(c);
    else {
      // #xc7p3q9 (Fix 3) — a defer whose ONLY cause is a review-HELD carrier is flagged `heldCoupleOnly`
      // so idle accounting can treat such a pass as idle (a human hold will not clear by polling). A defer that
      // ALSO waits on a real blockedBy/stackParents edge, or that fails closed on degraded/truncated/incomplete
      // (which MAY clear on a re-fetch), is NOT flagged — the watch keeps polling.
      const heldCoupleOnly = blockWait.length === 0 && stackWait.length === 0 && blindWait.length === 0 && coupleDeferred && (c.coupleDeferReason === 'held' || c.coupleHumanTerminal === true);
      deferred.push({ num: c.num, item: c.item, waitOn, ...(heldCoupleOnly ? { heldCoupleOnly: true } : {}) });
    }
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
  return { ready, deferred, staleLandedOpenItems };
}

/** #999/xq985wu F3 — the per-repo open-PR listing cap `collectOpenPrContext` uses. Since #xq985wu that listing
 *  is the SOLE cross-item ordering source on a full sweep, so a SILENTLY truncated page (gh lists newest-first)
 *  drops the OLDEST open PRs — exactly the long-lived HELD blockers this change exists to keep visible — and a
 *  dependent then reads the missing edge as landed and merges EARLY (the hazard #xq985wu closes, reappearing
 *  under load). Raised substantially off the old silent 100 to push the truncation point well past any realistic
 *  open-PR count, but raising alone does NOT retire the class: `isDegradedOpenPrListing` still flags a full page
 *  as a DEGRADED read so the ordering decision is never silently trusted on a truncated listing (truncation is
 *  the UNSAFE direction). */
export const OPEN_PR_LIST_LIMIT = 500;
/** True when a listing came back at/over the cap — i.e. gh MAY have truncated it (a full page is indistinguishable
 *  from an exactly-full one, so treat it as possibly-incomplete). A degraded listing must not be trusted as the
 *  authoritative open set for the early-land decision. Pure. */
export function isDegradedOpenPrListing(count, limit = OPEN_PR_LIST_LIMIT) {
  return Number(count) >= Number(limit);
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
export function decideDrainLeaseGate({ dryRun = false, onlyPr = null, noLease = false, underLease = null, repos = null, status = { held: false, stale: false, owner: null, scope: null } } = {}) {
  if (dryRun) return { action: 'bypass', reason: 'dry-run' };
  if (onlyPr != null) return { action: 'bypass', reason: 'single-pr-fast-drain' };
  if (noLease) return { action: 'bypass', reason: 'no-drain-lease' };
  if (underLease) {
    if (status.held && status.owner === underLease) return { action: 'under-lease', heldBy: status.owner };
    return { action: 'noop', heldBy: status.held ? status.owner : null, reason: status.held ? 'lease-held-by-other' : 'declared-holder-gone' };
  }
  if (status.held) {
    // #2458 — a held lease no longer BLINDLY no-ops claiming "the holder's next pass covers this work". Before
    // #2458 any full/label sweep exited 0 with that claim — FALSE when the holder is a differently-scoped drain
    // (--this-repo / --repos=…) that never sweeps this run's repos, silently stranding those PRs until it exits.
    // Compare the holder's recorded repo scope to THIS run's and NEVER assert coverage that is false:
    //   • holder scope UNKNOWN (legacy/unscoped lease) or this run's scope unknown → conservative: assume
    //     covered, no-op (preserves the safe pre-#2458 behaviour; never a false-negative land).
    //   • this run ⊆ holder → the holder genuinely covers this work → honest no-op.
    //   • otherwise (some repos NOT in the holder's scope — a partial OR a full disjoint) → no-op, but report
    //     the UNCOVERED repos HONESTLY instead of the old false "its next pass covers this work". We do NOT
    //     auto-run concurrently: a lease-less bypass would remove mutual exclusion between two SAME-scope
    //     launches (both see only the narrow holder → both bypass → a same-repo drain race), re-introducing the
    //     very "two full drains at once" #2391/#2449 prevents. Honesty is the safe floor the item requires; the
    //     operator forces an immediate scoped run with --no-drain-lease if the uncovered repos can't wait.
    const runScope = Array.isArray(repos) ? [...new Set(repos.filter(Boolean))] : [];
    const holderScope = Array.isArray(status.scope) ? status.scope.filter(Boolean) : null;
    if (!holderScope || !holderScope.length || !runScope.length) return { action: 'noop', heldBy: status.owner, reason: 'lease-held' };
    const holderSet = new Set(holderScope);
    const uncovered = runScope.filter((r) => !holderSet.has(r));
    const covered = runScope.filter((r) => holderSet.has(r));
    if (!uncovered.length) return { action: 'noop', heldBy: status.owner, reason: 'lease-held' };
    return { action: 'noop', heldBy: status.owner, reason: 'lease-held-uncovered', uncovered, covered };
  }
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
 *  batch feed has been observed KNOWN-and-non-running for `debounce` consecutive passes (absorbs feed lag).
 *
 *  #xc7p3q9 (B5) — the production launcher (`drain-push-at-close.mjs`) runs `--watch --until-batches-idle` with
 *  NO `--max-idle`, so it exits HERE, not via `idlePass`/`--max-idle`. `considered` = `verdicts.length` counts
 *  BOTH halves of a held couple, so a pass blocked SOLELY on a human-held couple never satisfied `considered===0`
 *  and the drain ran to its `--max-runtime-min` cap holding the lease. Consult the SAME `deferralsAllHeldCouple`
 *  allowance `idlePass` uses (the ONE shared helper): a non-empty queue whose ENTIRE remaining deferral set is
 *  held-couple-only (a human hold that will not clear by polling) counts as settled. A degraded/truncated fail-
 *  closed defer is NOT held-couple-only, so it still keeps the watch polling (it may clear on a re-fetch). */
export function decideBatchesIdleExit({ enabled = false, idlePass = false, considered = 0, deferred = [], heldCoupleMembers = 0, batchNonRunningStreak = 0, debounce = 2 } = {}) {
  if (!enabled) return false;
  if (!idlePass) return false;        // still landing / rebuilding a tip → keep going
  // #xc7p3q9 (R6) — SUBTRACT the held couple's members (its deferred impl half + its `skip` carrier) from
  // `considered`, rather than WAIVING the `considered>0` check wholesale (the round-1 regression). `considered =
  // verdicts.length` still counts NON-held candidates whose CI is running (they classify `skip`, so they are
  // neither `merged` nor in `deferred`) — a wholesale waiver exited with those in flight and dropped their PRs.
  // Any in-flight work BEYOND the held couple keeps the watch polling.
  const held = Number.isFinite(Number(heldCoupleMembers)) ? Number(heldCoupleMembers) : 0;
  if (considered - held > 0) return false;   // queue not empty beyond the held couple → keep going
  return batchNonRunningStreak >= debounce;
}

/** #2216 — should this OPEN PR be labelled now because its required check went green? Pure. Closes the lane-
 *  closure liveness gap: `pr-land --label-on-green` labels only if CI beats its `--timeout-min` wait; on a
 *  timeout the PR is left green-eventually-but-UNLABELLED and stranded. A post-CI reconcile pass labels it the
 *  moment the required check is green — no human step. Only the PRODUCER'S OWN work (AI-generated) is labelled,
 *  never a human orphan, and never a PR that already carries the label. */
export function shouldLabelOnGreen(pr, opts = {}) {
  return labelOnGreenVerdict(pr, opts).label === true;
}

/**
 * #2832 — `shouldLabelOnGreen` with a REASON channel. Pure. Same decision, but it also says WHY it refused when
 * the refusal is the new hold rule, so the caller can make a withheld go-ahead ANNOUNCE itself.
 *
 * Why the reason channel exists. Before #2832 a held PR still carried `ready-to-merge`, so it entered the
 * candidate `verdicts`, was skipped by the merge gate, and got a park-reason comment ON THE PR. Refusing the
 * stamp keeps it out of the `--label ready-to-merge`-scoped candidate set entirely — correct, but it also means
 * nothing posts that comment any more, so the PR goes SILENT instead of saying why it is waiting. `reason:'held'`
 * is what lets the reconcile post it instead. The order below matters for the reason, not the refusal: the hold
 * is tested LAST, so `held` is reported only when the hold is the ONLY thing left standing between this PR and
 * the label. A red or non-producer PR is not "stuck because held" — it is stuck for its own reason, which the
 * ci-lifecycle labels already carry.
 *
 * `allowPendingReview` mirrors the #2423 per-PR relief valve exactly as `classifyPr` does. Without it the label
 * half and the merge half DISAGREE: `--no-review-escalation=<pr#>` would still waive the merge predicate, but
 * the PR would never be stamped, so the label-scoped drain would never see it and the ratified valve would be a
 * no-op. The relief is narrow at both layers — it waives `review:pending` only, NEVER `review:changes` or
 * `review:human` (`hasUnclearedReviewLabel`'s `allowPending` enforces that, not this function).
 * @param {object} pr - a PR read (labels + commits + statusCheckRollup)
 * @param {{requiredCheck?:string, label?:string, allowPendingReview?:boolean}} [o]
 * @returns {{label:boolean, reason:(null|'held')}}
 */
export function labelOnGreenVerdict(pr, { requiredCheck = 'test', label = 'ready-to-merge', allowPendingReview = false } = {}) {
  if (!label || hasLabel(pr, label)) return { label: false, reason: null };   // already labelled (or no label configured) → nothing to do
  // Only the producer's own AI PRs are auto-labelled — never a human orphan — EXCEPT a human-cleared parked PR
  // (review:accepted): the human clear IS the certification, so mint ready-to-merge on green even when the
  // AI-trailer heuristic reads non-AI (e.g. the drain's own `drain: rebase …` commit stranded it). #2196/#2326
  if (!isAiGeneratedPr(pr) && !hasLabel(pr, REVIEW_LABELS.accepted)) return { label: false, reason: null };
  if (!isRequiredCheckGreen(pr, requiredCheck)) return { label: false, reason: null };
  // #2832 — a held PR (review:pending/review:changes/review:human, uncleared by review:accepted) must NEVER be
  // auto-stamped ready-to-merge: a hold and a go-ahead are contradictory. Refusing HERE is what keeps the
  // CI-green reconcile from RE-ADDING the go-ahead while a hold still stands — the ADD-side of the write-time
  // invariant, and the reason the pre-#2832 hand-strip was a race rather than a lock.
  if (hasUnclearedReviewLabel(pr?.labels, { allowPending: allowPendingReview })) return { label: false, reason: 'held' };
  return { label: true, reason: null };               // label the instant the required check is green
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
    // #xc7p3q9 (R10) — NORMALIZE every `--repos` entry to `owner/name`. A short-name `--repos=frontierui` otherwise
    // yields a bogus `frontierui` alongside the canonical `chalbert/frontierui`: its listing throws, and (pre-R3)
    // latched `contextComplete:false` permanently. Prefix the local owner when an entry carries no `/`.
    const owner = self && self.includes('/') ? self.split('/')[0] : null;
    const norm = (s) => (s.includes('/') || !owner) ? s : `${owner}/${s}`;
    const list = [...new Set(repos.split(',').map((s) => s.trim()).filter(Boolean).map(norm))];
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
 * #xc7p3q9 (B8) — the CONTEXT repo set for `collectOpenPrContext`: the candidate `repos` UNION'd with the full
 * constellation (so the couple gate's blind health read still sees a carrier that `--only`/`--repos`/`--this-repo`
 * narrowed OUT of the candidate set). Pure. CANONICALIZES the local repo's two interchangeable ids (`null` ≡
 * `self`) to the ONE form `repos` already uses for it, so the union never holds BOTH — the old
 * `[...new Set([...REPOS, ...resolveRepos({self})])]` listed the local repo TWICE under `--this-repo`
 * (`REPOS=[null]` + the constellation's `self` slug), reading every local PR twice under two cache keys and
 * doubling the `gh` traffic (the hottest path: `/pr`, `/finish`). Matching `repos`' representation (not blindly
 * `r||self`) keeps the health keys agreeing with the candidate sweep's `couple.repo` — a `r||self` normalize
 * would rekey the local repo to the slug while the `--this-repo` sweep keys it `null`, breaking the join lookup.
 * @param {Array<string|null>} repos  the candidate repo set (REPOS)
 * @param {string|null} self          the local repo slug (localSlug)
 * @returns {Array<string|null>}
 */
export function resolveContextRepos(repos, self) {
  const base = Array.isArray(repos) ? repos : [];
  const localToken = base.includes(null) ? null : self;   // the form REPOS uses for the local repo
  return [...new Set([...base, ...resolveRepos({ self })].map((r) => (r == null || r === self) ? localToken : r))];
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
    exec('git', ['merge-base', '--is-ancestor', '--end-of-options', ancestor, descendant], { stdio: ['ignore', 'ignore', 'ignore'] });
  } catch { return false; } // non-zero exit (not an ancestor) or unresolvable → don't trust the base
  try {
    const a = String(exec('git', ['rev-parse', '--verify', '--end-of-options', ancestor], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }) || '').trim();
    const b = String(exec('git', ['rev-parse', '--verify', '--end-of-options', descendant], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }) || '').trim();
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
 * #2952 — additive: the unscored return now also carries `reason` — `'exec-contract'` (the injected `exec` isn't
 * `(cmd, args, opts) => execFileSync(cmd, args, opts)`-shaped — a caller bug to FIX, not license to fall back) or
 * `'ref-unresolved'` (neither candidate resolves — legitimately absent, unfixable, correctly falls back).
 * Existing consumers that read only `scored` are untouched.
 * @param {{exec:Function, remote?:string, base?:string, baseRev?:string|null, rev:string, fetchExtraRefs?:string[]}} opts
 *   `exec(cmd, args, opts)` — inject `execFileSync`-shaped exec so this stays unit-testable with a fake.
 * @returns {{changedFiles:string[], diffLines:number, scored:boolean, humanBasisFiles:string[], reason?:'exec-contract'|'ref-unresolved'|'basis-mismatch'}}
 */
/**
 * #2450 — the SHARED base-RESOLUTION half of the net diff, factored out of `computeNetDiffChangedFiles` so the
 * escalation classifier's changed-file SET and the reviewer-facing diff TEXT (`computeNetDiffText`) resolve the
 * base ONCE, the SAME way, and can never drift onto different bases. It runs the #2373 explicit-refspec base
 * fetch (force-updates the `<remote>/<base>` tracking ref unconditionally — never the opportunistic bare fetch),
 * then per candidate narrows the LEFT side of the diff to the #2404 provable fork point
 * (`merge-base(<remote>/<base>, candidate)`) and probes candidate resolution with a cheap `git diff --numstat`
 * (which doubles as the human-gate basis). Returns the resolved `{ baseRef, diffBase, candidate, humanBasis }`
 * for the FIRST candidate (`<remote>/<rev>` first, then bare `rev` — the #2373-review-r2 order) that resolves,
 * or `{ ok:false, reason }` when it can't produce one (the caller degrades to the safe over-scoring / `gh pr diff`
 * fallback). NEVER checks out the PR branch (#2336): it only fetches tracking refs and diffs two trees in place.
 * Pure aside from the injected `exec`.
 *
 * #2952 — the failure `reason` distinguishes a FIXABLE caller-side bug from a legitimately absent ref, which
 * used to be byte-identical (`{ scored: false }`, no signal). `isExecContractError` classifies which: the
 * injected `exec` is contractually `(cmd, args, opts) => execFileSync(cmd, args, opts)` (see the `@param` below),
 * and a caller that hands in a differently-shaped function (e.g. a shell-exec `(cmd, opts) => execSync(cmd,
 * opts)`) receives the ARGS ARRAY in its `opts` position — that throws a `TypeError` from inside Node's own
 * argument validation (or from the caller's body dereferencing a non-object), never the plain `Error` git itself
 * raises for a real command failure (unknown revision, network unreachable, etc., which execFileSync surfaces
 * with a numeric `.status`/`.signal`, not as a `TypeError`). So: a `TypeError` from ANY exec call here means the
 * shape contract was violated — that is a caller bug to FIX, not license to fall back — and short-circuits
 * immediately with `reason: 'exec-contract'` rather than continuing to the next candidate (every further exec
 * call would throw the same way; retrying buys nothing and only obscures the real cause). A well-shaped `exec`
 * whose candidates simply don't resolve (both diff probes throw a normal `Error`) exhausts the loop and returns
 * `reason: 'ref-unresolved'` — the legitimately-absent-ref case, unfixable and correctly falls back.
 * @param {{exec:Function, remote?:string, base?:string, rev:string, fetchExtraRefs?:string[]}} opts
 *   `exec(cmd, args, opts)` — inject `execFileSync`-shaped exec so this stays unit-testable with a fake.
 * @returns {{ok:true, baseRef:string, diffBase:string, candidate:string, humanBasis:{changedFiles:string[],diffLines:number}, requestedFor:{remote:string,base:string,rev:string}}|{ok:false, reason:'exec-contract'|'ref-unresolved', requestedFor:{remote:string,base:string,rev:string|null}}}
 */
/**
 * #2890-review-r2 finding 1 — does this already-resolved basis answer the question THIS call is asking?
 * `basis` overrides `rev`, `remote` AND `base` outright (they are used only for the `!rev` guard once one is
 * supplied), so an unchecked mismatch lets a helper answer confidently about a DIFFERENT branch — reproduced
 * live: a basis resolved for `main`, handed to `computeNetDiffText({rev: <lane>})`, returned
 * `{scored:true, rev:'origin/main', text:''}`, which `diffHunksFrom` maps to `''` — "computed, genuinely
 * empty", the strongest clearance the contract can express — for a lane with a real diff. A basis with no
 * `requestedFor` at all is treated as a mismatch too: it predates this check (or was hand-built), and a gate
 * must not extend trust to an unidentifiable basis.
 */
function basisAnswersRequest(basis, { remote, base, rev }) {
  const f = basis && basis.requestedFor;
  return !!f && f.rev === rev && f.remote === remote && f.base === base;
}

function isExecContractError(err) {
  // A shape-violating `exec` (wrong arity / wrong positional meaning) fails inside Node's own argument
  // validation or the caller's body dereferencing the wrong thing — both surface as a `TypeError`. A real git
  // command failure via `execFileSync` throws a plain `Error` carrying `.status`/`.signal`, never `TypeError`.
  return err instanceof TypeError;
}

/**
 * #2890-review-fix finding 3 — EXPORTED so a caller that needs BOTH the changed-file shape and the diff TEXT
 * for one ref can resolve the basis ONCE and hand the same resolved object to both helpers (`basis` option
 * below), instead of paying two full `resolveNetDiffBasis` runs — two network fetches and two candidate probes
 * — for one ref. In-repo, `computeNetDiffSignals` is the ONE place that does this; `pr-land.mjs` and the
 * drain's scoring loop both go through it.
 *
 * The result is a plain value with no hidden state, so two helpers handed the SAME basis cannot disagree with
 * each other. #2890-review-r2 finding 1 — that is NOT the same as "cannot be wrong": a basis resolved for ref A
 * and handed to a helper called with ref B used to answer, `scored:true`, about A, silently. For
 * `computeNetDiffText` that produced `text:''` for a lane whose real diff is large — i.e. the STRONGEST
 * clearance the `diffHunks` contract can express ("computed, genuinely empty"), for the wrong branch. So the
 * basis now CARRIES the request it was resolved for (`requestedFor: {remote, base, rev}`, on the failure shape
 * too), and both helpers REFUSE a basis that does not match their own call: `reason:'basis-mismatch'`,
 * `scored:false` — a caller bug to FIX, in the same class as `'exec-contract'`, never a fallback that answers
 * about some other ref. What is provable is therefore narrower and true: one basis, one fetch, and a mismatched
 * basis is refused rather than answered.
 */
export function resolveNetDiffBasis({ exec, remote = 'origin', base = 'main', rev, fetchExtraRefs = [] } = {}) {
  // The identity of the REQUEST this basis answers. Rides both the ok and the failure shape so a shared basis
  // is checkable in every case — an `{ok:false}` basis for the wrong ref must not be reported as this ref's
  // own `'ref-unresolved'` either (that reads as "this branch is gone", which is a different fact).
  const requestedFor = { remote, base, rev: rev || null };
  if (typeof exec !== 'function' || !rev) return { ok: false, reason: 'ref-unresolved', requestedFor };
  const baseRef = `${remote}/${base}`;
  try {
    // ALWAYS force-update the base tracking-ref (#2373 opportunistic-fetch fix): the cumulative human-gate basis
    // below is `<remote>/<base>…head`, which a stacked `baseRev` must never be able to shrink (#2390-review-fix).
    // `--end-of-options` FIRST: `fetchExtraRefs` carries a branch name straight off the `gh` API, and a
    // dash-leading refname is legal (`git check-ref-format 'refs/heads/--output=/tmp/pwn'` exits 0), so without
    // the guard git parses it as an option — `--upload-pack=<script>` EXECUTES. Verified against git 2.50.1.
    exec('git', ['fetch', '--quiet', '--end-of-options', remote, `+${base}:refs/remotes/${remote}/${base}`, ...fetchExtraRefs], { stdio: ['ignore', 'ignore', 'ignore'] });
  } catch (err) {
    // #2952 — a shape-violating exec fails EVERY call the same way; bail immediately rather than degrade to
    // "whatever is locally cached", which would just re-throw on the very next call below.
    if (isExecContractError(err)) return { ok: false, reason: 'exec-contract', requestedFor };
    /* a real fetch failure degrades to whatever is locally cached — the diff attempts below still run */
  }
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
      // the next candidate, or a `null` resolve if both candidates hit it — always the safe over-scoring
      // fallback, never wrong data, but avoidable).
      const mb = String(exec('git', ['merge-base', '--end-of-options', baseRef, candidate], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }) || '').split('\n')[0].trim();
      if (mb) diffBase = mb;
    } catch (err) {
      if (isExecContractError(err)) return { ok: false, reason: 'exec-contract', requestedFor };
      /* no common history, or candidate doesn't resolve yet — the diff below is the real probe */
    }
    // The cumulative `<mergeBase>…head` diff is BOTH the human-gate basis AND the candidate-resolves probe.
    let humanBasis;
    try {
      // `--end-of-options` — `candidate` is `rev` verbatim on the second pass, i.e. a caller-supplied refname.
      // Verified on git 2.50.1: unguarded, `git diff --numstat <base> '--output=<path>'` exits 0 and WRITES that
      // file, and the swallowed numstat then reads EMPTY while the candidate still resolves — a zero blast-radius
      // score for a PR about to land, the exact de-inflation the #2390-review-fix comments assert is impossible.
      humanBasis = parseNumstat(exec('git', ['diff', '--numstat', '--end-of-options', diffBase, candidate], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
    } catch (err) {
      if (isExecContractError(err)) return { ok: false, reason: 'exec-contract', requestedFor };
      continue; /* candidate doesn't resolve — try the next one */
    }
    return { ok: true, baseRef, diffBase, candidate, humanBasis, requestedFor };
  }
  return { ok: false, reason: 'ref-unresolved', requestedFor };
}

export function computeNetDiffChangedFiles({ exec, remote = 'origin', base = 'main', baseRev = null, rev, fetchExtraRefs = [], basis: sharedBasis = null } = {}) {
  const empty = { changedFiles: [], diffLines: 0, scored: false, humanBasisFiles: [] };
  if (typeof exec !== 'function' || !rev) return empty;
  const baseRevOk = typeof baseRev === 'string' && /^[0-9a-f]{7,64}$/i.test(baseRev);
  // #2890-review-r2 finding 1 — a shared basis must have been resolved for THIS exact request, or it is refused
  // outright. Never fall back to resolving our own here: a caller that hands in the wrong basis has a bug to
  // fix, and silently doing the right thing anyway would hide it (same posture as `'exec-contract'`).
  if (sharedBasis && !basisAnswersRequest(sharedBasis, { remote, base, rev })) return { ...empty, reason: 'basis-mismatch' };
  // #2890-review-fix finding 3 — reuse a basis the caller already resolved for this same ref (see
  // `resolveNetDiffBasis`); absent one, resolve our own exactly as before.
  const basis = sharedBasis || resolveNetDiffBasis({ exec, remote, base, rev, fetchExtraRefs });
  // #2952 — additive: `reason` distinguishes a fixable caller-side `exec`-contract violation ('exec-contract')
  // from a legitimately absent ref ('ref-unresolved'). Existing consumers that read only `scored` are untouched.
  if (!basis.ok) return { ...empty, reason: basis.reason };
  const { candidate, humanBasis } = basis;
  // SIZE / blast-radius de-inflate to the OWN delta (`baseRev…head`) ONLY when `baseRev` provably is a STRICT
  // ancestor of head; otherwise use the cumulative basis (the safe over-scoring direction).
  let own = humanBasis;
  if (baseRevOk && isStrictAncestor(exec, baseRev, candidate)) {
    // Same class: `baseRev` is hex-validated by `baseRevOk`, `candidate` is not — it is the caller-supplied
    // refname. Every argv position in this file that takes a caller-supplied ref is now guarded; `merge-base`
    // and `rev-parse` are hardening rather than live holes (both reject an unknown option on git 2.50.1, and
    // the surrounding catch absorbs it), while the `git diff` positions are genuinely exploitable — verified.
    try { own = parseNumstat(exec('git', ['diff', '--numstat', '--end-of-options', baseRev, candidate], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })); }
    catch { own = humanBasis; /* own-delta diff failed → fall back to the cumulative basis */ }
  }
  return { changedFiles: own.changedFiles, diffLines: own.diffLines, scored: true, humanBasisFiles: humanBasis.changedFiles };
}

/**
 * #2450 — the reviewer-facing NET DIFF TEXT vs CURRENT main, resolved off the SAME #2373/#2404 basis
 * `computeNetDiffChangedFiles` uses (both go through `resolveNetDiffBasis`), so the diff the drain's panel
 * reviews and the escalation SCORE share ONE basis and cannot drift. Returns the two-tree
 * `git diff <forkpoint> <head>` TEXT — content-only, ancestry-independent — NOT `gh pr diff`'s three-dot
 * merge-base diff, which still lists a sibling-lane file that has since landed on main as if THIS PR added it
 * (the phantom scope-creep that burns negotiation rounds, #2450). Degrades to `{ scored:false, text:'' }` when
 * the basis can't be resolved OR the text diff itself fails — the caller then falls back to `gh pr diff`. Like
 * `computeNetDiffChangedFiles`, it NEVER checks out the PR branch (#2336): it only fetches tracking refs and
 * diffs two trees in place. `exec(cmd,args,opts)` is injected so this stays unit-testable with a fake.
 *
 * #2952 — additive: the unscored return now also carries `reason` — `'exec-contract'` (the injected `exec` isn't
 * `(cmd, args, opts) => execFileSync(cmd, args, opts)`-shaped — a caller bug to FIX, not license to fall back),
 * `'ref-unresolved'` (neither candidate resolves — legitimately absent, unfixable, correctly falls back), or
 * `'diff-failed'` (the basis resolved but the text diff itself then failed). Existing consumers that read only
 * `scored` are untouched.
 * @param {{exec:Function, remote?:string, base?:string, rev:string, fetchExtraRefs?:string[], basis?:object|null}} opts
 *   `basis` — an already-resolved `resolveNetDiffBasis` result for this same ref (#2890-review-fix finding 3);
 *   pass it to share ONE fetch + candidate probe with `computeNetDiffChangedFiles` instead of resolving twice.
 * @returns {{text:string, base:string|null, rev:string|null, scored:boolean, reason?:'exec-contract'|'ref-unresolved'|'diff-failed'|'basis-mismatch'}}
 */
export function computeNetDiffText({ exec, remote = 'origin', base = 'main', rev, fetchExtraRefs = [], basis: sharedBasis = null } = {}) {
  const unscored = { text: '', base: null, rev: null, scored: false };
  if (typeof exec !== 'function' || !rev) return unscored;
  // #2890-review-r2 finding 1 — refuse a basis resolved for a DIFFERENT request rather than answering about the
  // wrong ref. This is the fail-open the check exists for: an unchecked wrong basis returned `scored:true` with
  // `text:''`, which the `diffHunks` contract reads as "computed, genuinely empty" — a full clearance.
  if (sharedBasis && !basisAnswersRequest(sharedBasis, { remote, base, rev })) return { ...unscored, reason: 'basis-mismatch' };
  // #2890-review-fix finding 3 — reuse a caller-resolved basis for this ref when given one (one fetch, one
  // candidate probe, shared with `computeNetDiffChangedFiles`); otherwise resolve our own exactly as before.
  const basis = sharedBasis || resolveNetDiffBasis({ exec, remote, base, rev, fetchExtraRefs });
  if (!basis.ok) return { ...unscored, reason: basis.reason }; // caller falls back to `gh pr diff`
  const { diffBase, candidate } = basis;
  try {
    // Same guard, same reason — this is the reviewer-facing diff TEXT, off the same caller-supplied candidate.
    // #2890-review-r2 finding 2b — `--no-ext-diff`. A `diff.external` in the caller's git config, or a
    // `GIT_EXTERNAL_DIFF` inherited from the developer's environment (delta, difftastic — both common), REPLACES
    // git's own diff output wholesale: verified, a one-line external driver made this return
    // `{text:'HIJACKED — no hunks here\n', scored:true}`. That text now feeds `diffHunks`, the anti-test-gaming
    // scan and the reviewer panel, none of which may read a user-configurable RENDERING of the diff.
    // Deliberately NOT `--text`: unlike the single-file write-time diff, this is a whole-PR diff and forcing
    // binary blobs into it would splat megabytes of asset bytes into the reviewer-facing text (see
    // `diff-hunks.mjs`, where `--text` is right precisely because the payload is one bounded file).
    const text = String(exec('git', ['diff', '--no-ext-diff', '--end-of-options', diffBase, candidate], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) || '');
    return { text, base: diffBase, rev: candidate, scored: true };
  } catch (err) {
    // the text diff failed even though the basis resolved → caller falls back to `gh pr diff`
    return { ...unscored, reason: isExecContractError(err) ? 'exec-contract' : 'diff-failed' };
  }
}

/**
 * #2890-review-r2 finding 3 — THE one place the escalation inputs for a ref are derived, and the only in-repo
 * caller of the `basis` sharing option. Both production call sites (`pr-land.mjs#applyReviewEscalationLabel`
 * and the drain's scoring loop) used to hand-assemble the same four steps — resolve the basis, changed-file
 * shape, diff text, `diffHunksFrom` — and the review found that assembly pinned by NOTHING behavioural:
 * deleting `basis:` from all three call sites failed zero tests, and the only guard on the `diffHunks` mapping
 * was a source-level grep for one literal spelling. Collapsing the assembly into one exported function makes
 * the properties testable AS BEHAVIOUR — the fetch/subprocess count, and "a failed text diff yields
 * `diffHunks:null` while `changedFiles` still populates" — instead of as a regex over two named files.
 *
 * Everything here is exactly what the two call sites did, in the same order:
 *   • ONE `resolveNetDiffBasis` (one `git fetch`, one candidate probe) shared by both helpers below (finding 3
 *     of round 1: independent resolution measured 5 → 11 subprocesses and 1 → 2 network fetches per PR open).
 *   • `computeNetDiffChangedFiles` for the SIZE/blast-radius shape, de-inflated to `baseRev…head` for a stacked
 *     couple (#2390), plus the cumulative `humanBasisFiles` the human gate scores over (#2390-review-fix).
 *   • `computeNetDiffText` for the CONTENT, always cumulative — and `diffHunksFrom` to map it onto
 *     `scoreEscalation`'s `null`-means-NOT-COMPUTED contract (round-1 finding 1). `netDiffText` is returned
 *     whole as well, because the drain reuses that same object for the anti-test-gaming scan.
 * A caller with no clone to read does not call this at all (the drain's `gh pr view --json files` fallback).
 * @param {{exec:Function, remote?:string, base?:string, baseRev?:string|null, rev:string, fetchExtraRefs?:string[]}} o
 * @returns {{changedFiles:string[], diffLines:number, humanBasisFiles:string[], scored:boolean,
 *   netDiffText:{text:string,scored:boolean,reason?:string}, diffHunks:string|null}}
 */
export function computeNetDiffSignals({ exec, remote = 'origin', base = 'main', baseRev = null, rev, fetchExtraRefs = [] } = {}) {
  const basis = resolveNetDiffBasis({ exec, remote, base, rev, fetchExtraRefs });
  const net = computeNetDiffChangedFiles({ exec, remote, base, baseRev, rev, fetchExtraRefs, basis });
  const netDiffText = computeNetDiffText({ exec, remote, base, rev, fetchExtraRefs, basis });
  return {
    changedFiles: net.changedFiles,
    diffLines: net.diffLines,
    humanBasisFiles: net.humanBasisFiles,
    scored: net.scored,
    netDiffText,
    diffHunks: diffHunksFrom(netDiffText),
  };
}

/**
 * #2901 / #1031 review finding 5 — the NET changed-file list as PLAIN PATHS, off the SAME basis
 * `computeNetDiffText` resolves. This is the list a REVIEWER or a JUROR may cite.
 *
 * WHY THIS EXISTS SEPARATELY FROM `computeNetDiffChangedFiles`. That one is the SCORING path: it returns
 * `parseNumstat` output, which is git's DISPLAY encoding — a rename renders as `a.txt => b.txt`, and a
 * non-ASCII path is C-quoted (`"caf\303\251.txt"`). That is correct for counting lines and it is WRONG for
 * anything that intersects with `gh pr view --json files`, which reports the plain new path: the intersection
 * silently drops those entries, so a rename-only PR yields a ZERO-file list presented as authoritative. A
 * reviewer is then told a real file is not in the PR and dismisses genuine findings on it — strictly worse than
 * the inflated three-dot list this replaced.
 *
 * `--name-only -z` gives plain NUL-separated paths in every case. `--no-renames` is deliberately NOT passed:
 * with it, a rename reports BOTH the old and new path while `gh` reports only the new one, so the intersection
 * loses an entry and the caller's fail-open downgrade fires on every rename-carrying PR. Without it, git
 * reports the new path alone — exactly what `gh` reports.
 *
 * Same `resolveNetDiffBasis`, so the diff text, the score, and this list cannot drift. Never checks out the PR
 * branch (#2336). Degrades to `{ scored:false, paths:[] }` — the caller must then NOT claim a `net` basis.
 *
 * #2952 — additive: the unscored return now also carries `reason` — `'exec-contract'` (the injected `exec` isn't
 * `(cmd, args, opts) => execFileSync(cmd, args, opts)`-shaped — a caller bug to FIX, not license to fall back),
 * `'ref-unresolved'` (neither candidate resolves — legitimately absent, unfixable, correctly falls back), or
 * `'diff-failed'` (the basis resolved but this name-only diff itself then failed). Existing consumers that read
 * only `scored` are untouched.
 * @param {{exec:Function, remote?:string, base?:string, rev:string, fetchExtraRefs?:string[]}} opts
 * @returns {{paths:string[], base:string|null, rev:string|null, scored:boolean, reason?:'exec-contract'|'ref-unresolved'|'diff-failed'}}
 */
export function computeNetDiffPaths({ exec, remote = 'origin', base = 'main', rev, fetchExtraRefs = [] } = {}) {
  const unscored = { paths: [], base: null, rev: null, scored: false };
  if (typeof exec !== 'function' || !rev) return unscored;
  const basis = resolveNetDiffBasis({ exec, remote, base, rev, fetchExtraRefs });
  if (!basis.ok) return { ...unscored, reason: basis.reason };
  const { diffBase, candidate } = basis;
  try {
    const raw = exec('git', ['diff', '--name-only', '-z', '--end-of-options', `${diffBase}..${candidate}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const paths = String(raw || '').split('\0').filter(Boolean);
    return { paths, base: diffBase, rev: candidate, scored: true };
  } catch (err) {
    return { ...unscored, reason: isExecContractError(err) ? 'exec-contract' : 'diff-failed' };
  }
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

const execFileP = promisify(execFile);

/**
 * #2417 — bounded-concurrency async map. Runs `fn` over `items` with at most `limit` invocations in flight
 * at once, returning results in INPUT ORDER. The drain's per-pass candidate reads (`gh pr view --json commits`
 * + the manifest probe) are read-only, touch nothing on main, and have no ordering constraint, so a pool cuts
 * a ~N-PR / 3-repo sweep from ~N serial `gh` round-trips to ⌈N/limit⌉ waves — WITHOUT touching the strictly
 * serial `blockedBy`-ordered merge cascade downstream (that stays byte-for-byte the same, deliberately). Pure:
 * no gh/git coupling here, so it is unit-tested directly.
 */
export async function mapWithConcurrency(items, limit, fn) {
  const list = Array.isArray(items) ? items : [...items];
  const results = new Array(list.length);
  const width = Math.max(1, Math.min(Math.trunc(limit) || 1, list.length || 1));
  let next = 0;
  const worker = async () => {
    for (let i = next++; i < list.length; i = next++) results[i] = await fn(list[i], i);
  };
  await Promise.all(Array.from({ length: width }, worker));
  return results;
}

/**
 * #2417 — cross-pass read cache for the drain's per-PR candidate reads, keyed on `(repo, number, headSha)`.
 * Under `--watch` the sweep re-runs every `--interval`s FOREVER; a PR whose head SHA is UNCHANGED since the
 * previous pass reuses its cached commits/manifest instead of re-issuing the reads every pass. A changed SHA
 * (rebase-drop rebuilt the conflicting tip, or the producer pushed a fix) MISSES the cache and re-fetches —
 * the only reads that must be fresh. PRs absent from the current pass's set are evicted so a long-lived watch's
 * cache tracks the live open set (bounded growth, never a leak).
 *
 * The fetch fans out through `mapWithConcurrency`. Pure + injectable — `keyOf` / `shaOf` / `fetchOne` are
 * supplied by the caller (the sweep wires them to gh), so the cache + fan-out is unit-testable with a fetch
 * counter, proving an unchanged-SHA PR is NOT re-fetched on a second pass (the #2417 acceptance).
 *
 * #2417 review — optional `isDegraded(value)` guards the cross-pass cache against LATCHING an error-path read.
 * When it returns truthy (a swallowed gh error left a spurious `[]`/`null`), the read is used for THIS pass but
 * NOT cached, so the next pass re-fetches instead of serving the degraded read for the whole head-SHA lifetime.
 *
 * @returns {Promise<Map<string,{sha:string|null,value:any,cached:boolean}>>} key → the (possibly cached) read.
 */
export async function fetchPrReadsCached(prs, { cache, keyOf, shaOf, fetchOne, isDegraded, concurrency = 8 } = {}) {
  const present = new Set();
  const entries = await mapWithConcurrency(prs, concurrency, async (p) => {
    const key = keyOf(p);
    const sha = shaOf(p);
    present.add(key);
    const hit = cache.get(key);
    if (hit && sha != null && hit.sha === sha) return [key, { sha, value: hit.value, cached: true }];
    const value = await fetchOne(p);
    // #2417 review — only cache a GENUINELY-SUCCESSFUL read. When `isDegraded(value)` (a swallowed gh error left a
    // spurious `[]` commits / `null` manifest), skip `cache.set` so this pass still USES the best-effort value but
    // the next pass RE-FETCHES — otherwise a transient failure latches a degraded read for the head-SHA lifetime
    // (a latched-liveness regression under `--watch`). Safety is unaffected: the degraded value is the same
    // conservative no-op it was before; only its persistence changes.
    if (!(typeof isDegraded === 'function' && isDegraded(value))) cache.set(key, { sha, value });
    return [key, { sha, value, cached: false }];
  });
  for (const k of [...cache.keys()]) if (!present.has(k)) cache.delete(k); // evict PRs no longer in this pass
  return new Map(entries);
}

/** #2417 — a minimal in-process async mutex (serialize a fragile section that a fan-out would otherwise race). */
function makeAsyncMutex() {
  let tail = Promise.resolve();
  return { run(fn) { const r = tail.then(() => fn()); tail = r.catch(() => {}); return r; } };
}

// ── CLI boundary ───────────────────────────────────────────────────────────────────────────────────────
const IS_CLI = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (IS_CLI) runCli().catch((e) => { process.stderr.write(`merge-ai-prs ✗ ${String(e && e.stack || e)}\n`); process.exit(1); });

async function runCli() {
  const AS_JSON = !!flags.json;
  const DRY_RUN = !!flags['dry-run'];
  const REQUIRED = typeof flags.check === 'string' ? flags.check : 'test';
  // #2290 — `--only=<pr>` (alias `--couple=<pr>`, and the legacy `--pr=<pr>`) scopes the sweep to ONE PR: the
  // single-couple FAST DRAIN that /pr (pr-land) and /finish (lane-resume) shell so they still feel instant
  // while the drain stays the sole writer to main. Same gated land path as a full sweep, just number-filtered.
  const onlyPr = flags.only != null ? String(flags.only) : (flags.couple != null ? String(flags.couple) : (flags.pr != null ? String(flags.pr) : null));
  // #2683 — the target repo for `--only=<pr>`. PR numbers are per-repo (WE #12 ≠ FUI #12), so a bare `--only=12`
  // on the DEFAULT constellation scope would match a same-numbered PR in EVERY repo. `--only-repo=<slug>` names
  // the ONE repo the target lives in; absent, the target defaults to the LOCAL (cwd) repo. The full REPOS scope
  // is still listed for the cross-repo ordering context (`collectOpenPrContext` → `extraOpenItems`), so the fast
  // drain sequences blockedBy against the whole constellation while merging exactly one PR. Legacy `/pr`+`/finish`
  // callers pass `--only=<n> --this-repo` (REPOS=[cwd], no `--only-repo`) → the single cwd PR, unchanged.
  const onlyRepo = typeof flags['only-repo'] === 'string' && flags['only-repo'].trim() ? flags['only-repo'].trim() : null;
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
  // #xc7p3q9 (R2) — the operator escape hatch (symmetric to --no-review-escalation): force the couple gate to
  // treat the open-PR context as COMPLETE, so a genuinely-stuck queue has a lever short of editing the script.
  const ASSUME_COMPLETE_CONTEXT = !!flags['assume-complete-context'];
  // #2171 — DETERMINISTIC review-escalation rubric: before merging a ready PR, score it (blast radius, size,
  // dismissed pre-PR findings, cross-repo couple); an escalated PR PARKS ALIVE (labelled
  // review:pending, SKIPPED — non-blocking, the queue keeps flowing) until a reviewer applies review:accepted.
  // ON by default for a label-scoped drain. #xlno40g — there is NO random/sampling floor: a PR reaches a
  // reviewer only for a real reason, never a dice roll (random sampling was found to have no value).
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
  // #xc7p3q9 (Fix 1 / B8) — the CONTEXT repo set for `collectOpenPrContext` is the FULL constellation, UNION'd
  // with REPOS, regardless of `--only`/`--repos`/`--this-repo` narrowing. The couple gate reads carrier HEALTH
  // (held / nameable / degraded) out of this blind context, so a WE carrier NARROWED out of a `--repos=<impl>` /
  // `--this-repo` candidate sweep is STILL visible here — its coupled impl half joins it and defers if it is held,
  // instead of orphan-landing past a hidden held carrier. `resolveContextRepos` canonicalizes the local repo so
  // it is never listed twice (B8). For the common full-constellation drain (REPOS === the constellation) this is a
  // no-op — no extra listings.
  const CONTEXT_REPOS = resolveContextRepos(REPOS, localSlug);
  // #2458 — THIS run's repo scope (`null` = the cwd repo → normalize to localSlug), recorded in the drain
  // lease so a differently-scoped launch can tell whether the holder actually covers its repos.
  const leaseScope = [...new Set(REPOS.map((r) => r || localSlug).filter(Boolean))].sort();
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
  // #2417 review — returns `{ manifest, degraded }`. `degraded:true` means the gh read THREW (a swallowed
  // transient failure), NOT a confirmed "no manifest" — so the caller can decline to cache the spurious null and
  // re-fetch next `--watch` pass instead of latching a degraded read for the head-SHA lifetime. A successful read
  // that legitimately finds no manifest block returns `{ manifest: null, degraded: false }` (a genuine answer).
  const readManifestFromPrBody = async (repo, headRef) => {
    try {
      const { stdout } = await execFileP('gh', ['pr', 'list', '--head', headRef, '--state', 'open', ...repoFlag(repo), '--json', 'body'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
      return { manifest: extractManifestFromBody(JSON.parse(stdout || '[]')?.[0]?.body), degraded: false };
    } catch { return { manifest: null, degraded: true }; } // gh threw → degraded → fall through to the ref file
  };
  // #2417 — the LOCAL legacy git-fetch fallback (below) writes/reads `FETCH_HEAD`, which is process-global: two
  // concurrent `git fetch` in the same clone would clobber each other's `FETCH_HEAD`. So it runs under a mutex —
  // the pool fans out the SAFE gh-network reads (PR-body + remote-api manifests) concurrently, and the rare
  // pre-PR-body-cutover git fallback is serialized. It is a fallback (~every current lane rides the PR-BODY
  // manifest), so serializing it costs ~nothing while keeping the fan-out correct.
  const legacyGitManifestMutex = makeAsyncMutex();
  const readLegacyLocalManifest = (headRef) => legacyGitManifestMutex.run(() => {
    // The same argv class, third instance. NOTE: no repo-wide lint exists for it — an earlier version of this
    // comment cited one, which read as captured prevention and is exactly how a sibling instance survived one
    // function away. Guarded by hand here; the lint is filed, not built. `headRef` is a
    // `gh`-supplied refname and a dash-leading one is legal, so bare it is parsed as an option. It reaches TWO
    // calls here: the fetch, and — via `rev` — the `git show` argument, where `git show` accepts diff options
    // including `--output=`. Both guarded.
    try { execFileSync('git', ['fetch', '--quiet', '--end-of-options', 'origin', headRef], { stdio: ['ignore', 'ignore', 'ignore'] }); } catch { /* ref may be local */ }
    for (const rev of ['FETCH_HEAD', `origin/${headRef}`, headRef]) {
      try {
        const m = JSON.parse(execFileSync('git', ['show', '--end-of-options', `${rev}:.lane-manifest.json`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
        if (m && m.item != null) return m;
      } catch { /* try next rev */ }
    }
    return null;
  });
  // #2417 review — returns `{ manifest, degraded }`. `degraded:true` marks a null that came from a swallowed gh
  // error (a transient failure we couldn't distinguish from truth), so `fetchPrReadsCached` skips caching it and
  // the next `--watch` pass re-fetches instead of latching the degraded read for the head-SHA lifetime. A null
  // from a SUCCESSFUL read (no manifest on the ref — the common orphan/impl case) is `degraded:false`: cache it.
  const readPrManifest = async (repo, headRef) => {
    if (!headRef) return { manifest: null, degraded: false };
    const fromPr = await readManifestFromPrBody(repo, headRef);
    if (fromPr.manifest) return { manifest: fromPr.manifest, degraded: false };
    // ── Legacy fallback: the tree-committed manifest (lanes queued before the PR-body cutover). ──
    if (!isLocalRepo(repo)) {
      // #2257 — a remote-repo PR has no local clone to `git show`; read the manifest off its head ref via the
      // GitHub API (`gh api …/contents/.lane-manifest.json?ref=<headRef>` → base64 `.content`). Best-effort:
      // an impl/orphan PR carries no manifest → null → always ready (the legacy unordered behaviour).
      // #2399 — `remoteManifestApiArgs` (shared, `scripts/lib/remote-manifest.mjs`) makes the `--method GET`
      // explicit; one argv for both the drain and lane-resume so the readers never drift.
      // #xc7p3q9 (R3) — the error taxonomy (404 = definitive-absent → degraded:false; else degrade) lives in the
      // extracted, unit-tested `readRemoteManifestViaApi`. This is the ROOT of the R2 livelock: the old blanket
      // `degraded:true` made `contextComplete` false on EVERY pass with a manifest-less impl PR open.
      return await readRemoteManifestViaApi({ exec: execFileP, repo, headRef });
    }
    const legacy = await readLegacyLocalManifest(headRef);
    if (legacy) return { manifest: legacy, degraded: false };
    // Local git fallback found nothing. Post-cutover lanes carry the manifest in the PR BODY (not the tree), so a
    // null here after the PR-body gh read THREW is a spurious degrade — surface `fromPr.degraded` so it re-fetches.
    return { manifest: null, degraded: fromPr.degraded };
  };
  // #2417 — a PR's HEAD SHA cache key. `gh pr list --json headRefOid` supplies it in the SAME list call (no
  // extra round-trip); a PR whose SHA is unchanged since the previous `--watch` pass reuses its cached reads.
  const prCacheKey = (repo, num) => `${repo || 'cwd'}::${num}`;
  const prHeadSha = (p) => p.headRefOid || null;
  // Cross-pass read caches (live for the whole runCli lifetime, so a `--watch` loop reuses them each pass, like
  // `ensuredLabels` above). Two independent caches for the two deliberately-independent listings (#2421): the
  // unfiltered open-PR context, and the (possibly `--label`-scoped) merge-candidate sweep.
  const ctxReadCache = new Map();   // collectOpenPrContext: (repo, num, sha) → { manifest, commits }
  const sweepReadCache = new Map(); // the merge-candidate loop: (repo, num, sha) → { commits, manifest }
  // #2417 review — returns `{ commits, degraded }`. `degraded:true` means the gh read THREW (a swallowed transient
  // failure): the empty `[]` is a fallback, not a confirmed "no commits", so `fetchPrReadsCached` declines to cache
  // it and re-fetches next `--watch` pass rather than latching an empty read for the head-SHA lifetime. Behaviour
  // THIS pass is unchanged — the caller still sees `[]` (⇒ isAiGeneratedPr → false → skipped, never merged on
  // missing data); a genuinely-empty successful read returns `{ commits: [], degraded: false }` and DOES cache.
  const fetchPrCommits = async (repo, num) => {
    try {
      const { stdout } = await execFileP('gh', ['pr', 'view', String(num), ...repoFlag(repo), '--json', 'commits'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
      return { commits: JSON.parse(stdout.trim() || '{}').commits || [], degraded: false };
    } catch { return { commits: [], degraded: true }; } // gh threw → degraded → re-fetch next pass
  };

  // #2683 — the per-PR IDEMPOTENCY probe for the merge-write critical section. Re-reads the PR's CURRENT state
  // SERVER-SIDE right before the `gh pr merge` (inside the serial-writer mutex): a PR a CONCURRENT lander (a
  // resident-daemon 60s sweep, or another fast drain) already merged reads MERGED here → the caller makes it a
  // safe NO-OP instead of a double `gh pr merge`. Best-effort: a gh miss returns false (proceed to attempt — gh
  // itself refuses an already-merged PR, so a probe hiccup can never CAUSE a double-land, only fail to short it).
  const isPrAlreadyMerged = (repo, num) => {
    try {
      const out = execFileSync('gh', ['pr', 'view', String(num), ...repoFlag(repo), '--json', 'state,mergedAt'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      const j = JSON.parse(out || '{}');
      return String(j.state || '').toUpperCase() === 'MERGED' || !!j.mergedAt;
    } catch { return false; }
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
  // #xc7p3q9 (R4 structural) — a THIN wrapper over the exported, injectable `collectOpenPrContext`: it wires the
  // real gh dependencies (list + cached per-PR reads) and the LOUD degraded/failed warnings, then delegates the
  // pure reduction (maps + `contextComplete`) to `reduceOpenPrContext`. The reduction the couple gate depends on is
  // now unit-tested through the SAME code (R4 — the old closure was unreachable from any test). Lists over
  // CONTEXT_REPOS (the constellation ∪ REPOS), NOT the narrowed REPOS, so a carrier a `--repos`/`--this-repo`/
  // `--only` sweep filtered out of the candidate set is still visible for the couple gate's health read.
  const collectContext = () => collectOpenPrContext({
    contextRepos: CONTEXT_REPOS,
    reconcileRan: true,
    // #999/xq985wu F3 — `--limit OPEN_PR_LIST_LIMIT` (raised off the old silent 100). This listing is the SOLE
    // cross-item ordering source on a full sweep, so a truncated page is a MERGE-SAFETY hazard.
    listOpenPrs: async (repo) => {
      const { stdout } = await execFileP('gh', ['pr', 'list', ...repoFlag(repo), '--state', 'open', '--limit', String(OPEN_PR_LIST_LIMIT), '--json', 'number,title,labels,statusCheckRollup,headRefName,headRefOid'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
      return JSON.parse(stdout.trim() || '[]');
    },
    // #2417 — fan out the per-PR manifest + commits reads across ALL repos' open PRs at once (bounded pool), cached
    // across `--watch` passes on unchanged head SHA. Returns the reduced key→{manifest, commits, degraded} map.
    fetchReads: async (flat) => {
      const readsRaw = await fetchPrReadsCached(flat, {
        cache: ctxReadCache,
        keyOf: ({ repo, p }) => prCacheKey(repo, p.number),
        shaOf: ({ p }) => prHeadSha(p),
        isDegraded: (v) => !!v?.degraded, // #2417 review — an error-path read is NOT cached (re-fetches next pass)
        fetchOne: async ({ repo, p }) => {
          const [manifestRes, commitsRes] = await Promise.all([readPrManifest(repo, p.headRefName), fetchPrCommits(repo, p.number)]);
          return { manifest: manifestRes.manifest, commits: commitsRes.commits, degraded: manifestRes.degraded || commitsRes.degraded };
        },
      });
      const out = new Map();
      for (const { repo, p } of flat) { const k = prCacheKey(repo, p.number); out.set(k, readsRaw.get(k)?.value || {}); }
      return out;
    },
    onListingFailed: (repo) => { if (!AS_JSON) process.stderr.write(`  ⚠️  FAILED open-PR listing for ${repoTag(repo) || 'cwd'}: gh pr list threw — the couple gate treats the open-PR context as INCOMPLETE this pass (fail closed; #xc7p3q9 B2).\n`); },
    onListingTruncated: (repo, n) => { if (!AS_JSON) process.stderr.write(`  ⚠️  DEGRADED open-PR listing for ${repoTag(repo) || 'cwd'}: ${n} PRs hit the --limit ${OPEN_PR_LIST_LIMIT} cap — the page MAY be truncated (oldest, longest-held blockers dropped first). The cross-item merge order derived from this listing is NOT trustworthy for the early-land decision this pass (#999/xq985wu F3).\n`); },
  });

  // #2421 — POST-CI TOTAL CI-LIFECYCLE LABEL RECONCILE, generalizing #2216's green-only `reconcileGreenLabels`
  // per the #2281 ruling. Every open, PRODUCER-OWNED (AI-generated) PR is brought to the state
  // `lifecycleLabelFromCiTruth` says it should be in — self-healing (runs every drain pass + `--watch`
  // interval), never a per-check-tick `pr-land` write. `ready-to-merge` keeps being applied by the EXISTING
  // mechanism below (unchanged — the `label` var, `shouldLabelOnGreen`) and is deliberately EXCLUDED from the
  // `owned` set this reconcile add/removes: only `checking` / `ci:failed` / `blocked` are added/removed here.
  // #xq985wu — HAZARD NOTE (ordering side, now RESOLVED): stripping `ready-to-merge` here would drop a
  // still-open, merely-reordered PR out of the SAME PASS's `--label`-scoped `verdicts` listing (built right
  // after this returns). BEFORE #xq985wu the cross-item `openItems` set `planLabelDrain` orders by derived
  // SOLELY from that scoped listing on a full sweep, so such a strip could let a PR `blockedBy` the dropped one
  // wrongly read it as landed and land EARLY. #xq985wu DECOUPLED ordering from the `--label` scope: the ordering
  // context (`orderExtraOpenItems`, below) is now ALWAYS the label-BLIND full-open item set from
  // `collectOpenPrContext`, so a stripped-but-still-open PR stays in the open set and keeps deferring its
  // dependents regardless of its `ready-to-merge` label. That makes stripping `ready-to-merge` from a held PR
  // SAFE for ORDERING — the strip itself is #984/#2832's job (NOT done here; this reconcile still leaves
  // `ready-to-merge` alone, and it keeps being applied by the EXISTING mechanism below — the `label` var,
  // `shouldLabelOnGreen`). So `ready-to-merge`'s presence/absence — the landing-gate signal #2183 F1 /
  // #2138 F4 depend on — is left to the pre-existing mechanic entirely. A PR can therefore legitimately carry BOTH `ready-to-merge` AND `blocked`
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
      // #2417 — reuse the commits read `collectOpenPrContext` already fanned out + cached this pass (was a
      // serial per-PR `gh pr view --json commits` here — the #2421 double-read, now collapsed). A PR missing
      // from the map (its context read failed) is skipped, same as the old per-PR fetch-error `continue`.
      const commits = ctx.commitsByPr?.get(`${repo || 'cwd'}::${p.number}`);
      if (commits == null) continue;
      const withCommits = { ...p, commits };
      let touched = false;
      // ── The legacy #2216 branch: green-but-unlabelled → ready-to-merge (label lander's collection signal),
      //    UNCHANGED — see the `owned` note above for why this stays separate from the add/remove state below. ──
      // #2423/#2832 — thread the SAME per-PR relief the merge predicate uses (`classifyPr`'s `allowPendingReview`,
      // wired identically in `buildDrainVerdicts`). Without this the two halves disagree: the operator's
      // `--no-review-escalation=<pr#>` would waive the merge gate, but the stamp would still be refused, so the
      // named PR would never enter the `--label`-scoped candidate set and the ratified #2423 valve would be dead.
      const reliefAllowsPending = (escalationRelief.prs || []).includes(Number(p.number))
        || (!!escalationRelief.passWide && !!label);
      const greenVerdict = hasLabel(p, label)
        ? { label: false, reason: null }
        : labelOnGreenVerdict(withCommits, { requiredCheck: REQUIRED, label, allowPendingReview: reliefAllowsPending });
      if (greenVerdict.label) {
        if (DRY_RUN) { touched = true; if (!AS_JSON) process.stderr.write(`  🏷 ${repoTag(repo)}${p.number} would label "${label}" (required check green, was unlabelled)\n`); }
        else {
          try { execFileSync('gh', ['pr', 'edit', String(p.number), ...repoFlag(repo), '--add-label', label], { stdio: ['ignore', 'ignore', 'pipe'] }); touched = true; if (!AS_JSON) process.stderr.write(`  🏷 ${repoTag(repo)}${p.number} labelled "${label}" (post-CI reconcile — required check went green after a label-on-green timeout)\n`); }
          catch { /* a label race/permission miss is non-fatal — the next pass retries */ }
        }
      } else if (greenVerdict.reason === 'held') {
        // #2832 — the go-ahead was WITHHELD because a hold stands. Say so ON THE PR. Before #2832 a held PR kept
        // `ready-to-merge`, entered the candidate set, and got a park comment from the merge gate; refusing the
        // stamp removes it from that set, so without this the PR would sit green and silent with nothing
        // explaining the wait. `postDrainReasonComment` dedupes on (kind, reasonText), so a `--watch` loop
        // re-reaching this branch every pass posts ONCE, not once per pass.
        const heldReason = `held — a review hold (${(p.labels || []).map((l) => (typeof l === 'string' ? l : l?.name)).filter((n) => isReviewHoldLabel(n)).join(', ') || 'review'}) stands, so the "${label}" go-ahead is withheld even though the required check is green (#2832). Clear the review to release it.`;
        if (!DRY_RUN) postDrainReasonComment(repo, p.number, 'park', heldReason, null);
        if (!AS_JSON) process.stderr.write(`  ⏸ ${repoTag(repo)}${p.number} green but HELD — "${label}" withheld (#2832)\n`);
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
  const sweepOnce = async () => {
  // #2257 — collect + classify across EVERY repo in the sweep set into ONE global candidate list. PR numbers
  // are per-repo (WE #10 ≠ FUI #10), so each verdict carries its own `repo` + head ref instead of a
  // number-keyed cross-repo map. The single list is what lets the cascade honour cross-repo `blockedBy`.
  const reconciledLabels = [];
  const verdicts = [];
  // #2421 — the shared open-PR listing + manifest reads + cross-repo item-openness set the reconcile below
  // needs, computed ONCE for this pass (RECONCILE-gated — same cost profile as the reconcile it feeds: free on
  // a bare, unlabelled sweep).
  // #xc7p3q9 (B3) — when the blind context is NEVER collected (`RECONCILE` false: a bare `/merge` sweep or
  // `--no-reconcile-labels`), it is INCOMPLETE by construction — `contextComplete:false` — so the couple gate
  // fails closed (a coupled impl defers rather than orphan-landing past a carrier the gate cannot see).
  const openPrContext = RECONCILE ? await collectContext() : reduceOpenPrContext({ listings: [], reads: new Map(), reconcileRan: false });
  // #xc7p3q9 (R2) — the operator escape hatch symmetric to `--no-review-escalation`: `--assume-complete-context`
  // FORCES the context complete so a genuinely-stuck couple (e.g. a persistent read-noise fail-closed) can land
  // short of editing the script. Prints a LOUD one-line waiver. Off by default; the fail-closed gate stays live.
  if (ASSUME_COMPLETE_CONTEXT && !openPrContext.contextComplete) {
    openPrContext.contextComplete = true;
    if (!AS_JSON) process.stderr.write('  ⚠ --assume-complete-context: FORCING contextComplete=true — the couple gate will treat a carrier ABSENT from this pass\'s (possibly incomplete) open-PR context as LANDED. Operator waiver; use only to unstick a queue you have verified by hand (#xc7p3q9 R2).\n');
  }
  // #2417 — list ALL repos CONCURRENTLY up front (was one `gh pr list` per repo, serial, interleaved with the
  // per-repo processing below). A single repo's list failure is a bad-env hard-fail (exit 3), preserved — but
  // now surfaced after the concurrent batch instead of mid-loop. The rollup + mergeable come from the list;
  // commits (the AI gate) are fetched per-PR below (asking for them in the list overflows GitHub's node cap).
  const listOne = async (repo) => {
    const listArgs = ['pr', 'list', ...repoFlag(repo), '--state', 'open', '--limit', '100',
      '--json', 'number,title,body,headRefName,headRefOid,baseRefName,mergeable,mergeStateStatus,statusCheckRollup,labels'];
    if (base) listArgs.push('--base', base);
    if (label) listArgs.push('--label', label);
    try { const { stdout } = await execFileP('gh', listArgs, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); return { repo, prs: JSON.parse(stdout.trim() || '[]') }; }
    catch (e) { return { repo, err: String(e.message || e).split('\n')[0] }; }
  };
  const listings = await mapWithConcurrency(REPOS, REPOS.length, listOne);
  const listErr = listings.find((l) => l.err);
  if (listErr) fail('gh-error', `gh pr list${listErr.repo ? ` --repo ${listErr.repo}` : ''} failed (${listErr.err}) — is gh authenticated?`, 3);
  // #2683 — the `--only` target is repo-scoped (see `matchesOnlyTarget`): `--only-repo=<slug>` names the repo;
  // a single-repo sweep (`--this-repo` / `--repos=<one>` — the legacy `/pr`+`/finish` callers) matches its one
  // repo; a multi-repo default sweep with no `--only-repo` disambiguates to the LOCAL repo. This narrows the
  // MERGE candidate set to the one target PR (the fast-drain contract) while the full REPOS listing still feeds
  // the cross-repo ordering context below.
  // #xc7p3q9 (Fix 4) — the REAL `--only`/`--repos` narrowing is now `narrowPrsByRepo` (shared with the
  // test suite so tests drive the same wiring runCli does).
  const prsByRepo = narrowPrsByRepo(listings, { onlyPr, onlyRepo, repos: REPOS, isLocalRepo });
  // #2417 — fan out the per-PR commits + manifest reads across EVERY candidate PR at once (bounded pool),
  // cached across `--watch` passes on unchanged head SHA — was one serial `gh pr view --json commits` + one
  // serial manifest probe per PR, one repo at a time (~2×N serial `gh` round-trips a pass). The merge cascade
  // downstream is UNCHANGED and stays strictly serial (#2417 explicitly keeps the sole-writer loop serial).
  const sweepFlat = [];
  for (const repo of REPOS) for (const p of (prsByRepo.get(repo) || [])) sweepFlat.push({ repo, p });
  const sweepReads = await fetchPrReadsCached(sweepFlat, {
    cache: sweepReadCache,
    keyOf: ({ repo, p }) => prCacheKey(repo, p.number),
    shaOf: ({ p }) => prHeadSha(p),
    isDegraded: (v) => !!v?.degraded, // #2417 review — an error-path read is NOT cached (re-fetches next pass)
    fetchOne: async ({ repo, p }) => {
      const [commitsRes, manifestRes] = await Promise.all([fetchPrCommits(repo, p.number), readPrManifest(repo, p.headRefName)]);
      return { commits: commitsRes.commits, manifest: manifestRes.manifest, degraded: commitsRes.degraded || manifestRes.degraded };
    },
  });
  // #2421 (generalizes #2216) — total ci-lifecycle relabel first, per swept repo.
  for (const repo of REPOS) reconciledLabels.push(...reconcileCiLifecycleLabels(repo, openPrContext));
  // #xc7p3q9 (Fix 4 / B12) — the narrow→classify→attach→couple-join sequence is now `prepareDrainVerdicts`, the
  // SAME wiring the test suite drives, so a future edit that drops `truncated`/`contextComplete` from the couple
  // gate (or builds carrier health from the narrowed listings) breaks a test instead of silently regressing. The
  // impl-PR→WE-manifest `laneRef` join inherits each manifest-less impl half's couple item + blockedBy +
  // stackParents, and the couple gate reads carrier HEALTH from the label/only/repo-BLIND constellation-wide
  // context (`buildCarrierHealth`) — NOT the narrowed list — so a stripped/narrowed-but-HEALTHY carrier lets the
  // impl land (Fix 1) while a held/unnameable/degraded/truncated/absent-in-an-incomplete-context carrier defers
  // BOTH halves (B7). The per-PR review-escalation waiver (#2820/#2423) is threaded via `escalationRelief`.
  // #xc7p3q9 (R11) — build verdicts from the SINGLE `prsByRepo` narrowed above (no second narrow inside
  // `prepareDrainVerdicts` — the round-1 double-narrow the reviewer flagged). The couple JOIN is deferred to
  // `planDrainPass` AFTER the escalation/park pass (R5), so `held` is read from each carrier's final decision.
  verdicts.push(...buildDrainVerdicts({
    prsByRepo,
    readOf: (repo, num) => sweepReads.get(prCacheKey(repo, num))?.value,
    repos: REPOS,
    requiredCheck: REQUIRED,
    escalationRelief,
    label,
    isLocalRepo,
    localSlug,
  }));
  // #2393 — the `stackParents` proof-of-land gate's SECOND proof source: a parent that landed in a PRIOR drain
  // session, read off `origin/main`'s durable `bornAs:<hash>` record (#2392). Computed ONCE per pass over every
  // distinct stackParent hash (numeric ids are already-landed by construction — handled inside planLabelDrain;
  // a parent landing THIS run is captured by the caller's in-memory `landedThisPass`). `landedNumberFor` is a
  // local `git grep origin/main` — cheap, best-effort (a miss → not proven → the descendant defers, the safe
  // direction). Only meaningful for the local WE clone (where origin/main carries the backlog).
  // #999/xq985wu F2 — the SAME `bornAs`-on-main proof now also covers `blockedBy` edges, not just `stackParents`.
  // A stale/abandoned/draft/human PR — or the impl half of a couple whose WE half already landed — can keep
  // naming a LANDED item in its manifest, holding it in `orderExtraOpenItems` (the label-blind full-open set)
  // forever. Without a proof source the `blockedBy` dependent would defer permanently. Proving the blocker landed
  // on main (via `landedNumberFor`) clears the edge exactly as it does for a stackParent. Numeric blockedBy ids
  // are already-landed by construction and handled inside planLabelDrain; only hashes need the on-main lookup.
  const provenOnMain = new Set();
  const provenCandidateIds = new Set();
  for (const v of verdicts) {
    for (const sp of Array.isArray(v.stackParents) ? v.stackParents : []) provenCandidateIds.add(asItemId(sp));
    for (const b of Array.isArray(v.blockedBy) ? v.blockedBy : []) provenCandidateIds.add(asItemId(b));
  }
  for (const id of provenCandidateIds) {
    if (isHash(String(id)) && landedNumberFor(String(id), process.cwd()) != null) provenOnMain.add(id);
  }
  // #2393 — the in-memory "landed THIS run" proof set, populated on each WE-carrier merge below (the WE PR is
  // the resolve carrier + the point `bornAs` is stamped, so a descendant only counts a parent landed once the
  // parent's WE side lands — never on a green impl PR of an otherwise-broken couple). Threaded into every
  // planLabelDrain call this pass so a chain lands in order.
  const landedThisPass = new Set();
  // #2683/#xq985wu — the cross-item ORDERING CONTEXT for EVERY pass. `planLabelDrain` derives its cross-item
  // `openItems` set from the candidate `verdicts`, but those are `--label ready-to-merge`-SCOPED — so a PR that
  // is still open yet absent from the scoped list (a `--only` narrow, OR #984/#2832 having stripped
  // `ready-to-merge` from a merely-reordered held PR) would be invisible to the ordering gate, and a dependent
  // `blockedBy` it would resolve the edge as "landed" and land EARLY. Feeding the label-BLIND full open-PR item
  // set (`collectOpenPrContext` — every open PR across the swept repos, UNFILTERED by `--only` AND by `--label`)
  // as `extraOpenItems` DECOUPLES ordering from the label scope (#xq985wu): the order derives from what is
  // actually open, not from which PRs carry `ready-to-merge`. A superset is safe by construction (see
  // `planLabelDrain`: it can only ADD a defer, never drop one). Populated whenever RECONCILE ran (the
  // `--label`-scoped drain the daemon/pr-watch/full sweep fire); when it did not (the label-less orphan sweep)
  // `openPrContext.openItems` is an empty Set, which degrades to today's behaviour (the candidate list already
  // IS the full open set when unfiltered). This is what makes #984/#2832's strip of `ready-to-merge` from a held
  // PR SAFE — see the `collectOpenPrContext` note above.
  const orderExtraOpenItems = openPrContext.openItems; // label-blind full-open set feeds ordering on every pass, not just --only (#xq985wu)
  // #999/xq985wu F2 — invert `collectOpenPrContext`'s per-PR manifest map to item → holding open-PR descriptors,
  // so the stale-PR diagnostic below can NAME the open PR still holding a LANDED item open (the case the F2 fix
  // clears silently). Cheap: one pass over the already-fetched manifests.
  const openPrsNamingItem = new Map();
  for (const [pk, manifest] of openPrContext.manifestByPr || []) {
    if (!manifest || manifest.item == null) continue;
    const id = asItemId(manifest.item);
    const [repoK, numK] = String(pk).split('::');
    const tag = `${repoK === 'cwd' ? '' : repoK + '#'}${numK}`;
    if (!openPrsNamingItem.has(id)) openPrsNamingItem.set(id, []);
    openPrsNamingItem.get(id).push(tag);
  }
  const nameStaleHolders = (items) => (items || [])
    .map((id) => { const h = openPrsNamingItem.get(asItemId(id)) || []; return `#${id}${h.length ? ` (open PR${h.length > 1 ? 's' : ''} ${h.join(', ')})` : ''}`; })
    .join(', ');
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
      // #2820-review-fix (finding 4) — also skip a `reviewHeld` PR. Post-#2820, a held PR is `decision:'skip'`
      // while still GREEN and landable (the hold is its ONLY blocker — `reviewHeld` is set precisely then), so it
      // no longer satisfies the `=== 'merge'` guard and would wrongly enter the heal. Healing force-pushes the
      // lane/* ref (renumbers the NNN), moving the head out from under an active reviewer and invalidating any
      // #2409 acceptance stamped against the old SHA. The heal's premise ("a red required check is the symptom")
      // never held for a green-held PR: it has no collision to heal. Excluding `reviewHeld` restores that premise.
      if (!certified || v.decision === 'merge' || v.reviewHeld) continue;
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
      // #2684 — is this a cross-locus couple's WE half that was overlap-stacked on its impl tip? For such a half
      // the rebase-drop OUTCOME below already IS the couple CI-concurrency guard realized in git state — no
      // separate override needed, and any override would be WRONG: reaching `current` is itself proof the tip is
      // on current `origin/main` with a CI that validated `main + WE-delta`. So:
      //   • `current` (tip already on main, manifest-free) = the FAST-FORWARD SKIP — the impl landed at the sha
      //     the WE half stacked on, so its FIRST CI stays valid → it lands with NO re-CI (the whole #2684 win).
      //   • `rebased` (it was BEHIND because the impl landed as a DIFFERENT sha — squash-merge / review:changes
      //     re-stack / `main` advanced) = the FALLBACK — its tip is rebuilt onto `main` and `test` re-runs.
      // The WE half therefore NEVER lands on a base its CI never validated: a superseded stacked base makes it
      // BEHIND → `rebased` → re-CI (fail-safe). The pure MODEL of this decision — from injected shas — is
      // `couple-plan.mjs`'s `decideWeReCi` (the SSOT, unit-tested); here we only TAG which regime the git state
      // realized (`v.coupleReCi`, observability), with zero control-flow change from the pre-#2684 behaviour.
      const stackedWeHalf = isStackedWeCoupleHalf(v);
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
        // #2684 — a stacked WE half that was BEHIND (its impl landed as a different sha) is the FALLBACK regime:
        // rebuilt onto main, `test` re-runs. Tag it for observability; control flow is unchanged.
        if (stackedWeHalf) v.coupleReCi = 're-ci';
        if (!AS_JSON) process.stderr.write(`  ↻ ${repoTag(v.repo)}${v.num} rebased onto main${r.dropped || r.droppedManifest ? ' (manifest dropped)' : ''}${healTag}${contentTag}${cloneDir ? ` (via ${cloneDir})` : ''}${stackedWeHalf ? ' [couple re-CI: stacked base superseded]' : ''} → ${r.newCommit.slice(0, 9)}\n`);
      } else if (r.action === 'current') {
        // IDEMPOTENCY (drain re-push churn bug) — the tip is ALREADY on main and manifest-free; rebaseDropManifest minted/pushed NOTHING. Treat
        // it as landable (proceed to merge) but do NOT count it as churn — no head SHA changed, so it must NOT
        // join the `rebased` list (that list is the "we just repushed, CI will restart" set). This is the whole
        // fix: a green, on-main, manifest-free PR stops getting its head rewritten every drain pass.
        v.decision = 'merge';
        v.reason = `already up-to-date on main (manifest-free), required check green — landable`;
        // #2684 — for a stacked WE couple half, `current` IS the FAST-FORWARD SKIP: the tip is on current main
        // with a still-valid first CI, so it lands with NO re-CI (the win). Tag it; control flow is unchanged —
        // landing a proven-on-main tip on its existing CI was always correct here.
        if (stackedWeHalf) v.coupleReCi = 'ff-skip';
        if (!AS_JSON) process.stderr.write(`  ↻ ${repoTag(v.repo)}${v.num} already current on main (manifest-free) — no rebuild needed${stackedWeHalf ? ' [couple FF-skip: WE re-CI skipped, first CI valid]' : ''}\n`);
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
      if (v.decision !== 'merge') continue; // @merge-gate-exempt DOWNGRADE-only backstop (merge→skip); a held PR is already `skip`, so it needs no reviewHeld branch — re-admitting it here could only wrongly merge it
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
  // cross-repo (manifest). Best-effort per candidate; a signal-fetch miss defaults to no-escalate.
  const parked = [];
  // #2832 / #984 F2 — the ONE `ready-to-merge` strip seam every park site in the escalation pass goes through.
  // Keyed on `decideParkReadyStrip` (the PR's OBSERVED labels PLUS this park's own writes), NEVER on whether the
  // park happens to be applying a label. The shipped shape nested the strip inside `if (gate.applyLabel …)`,
  // which excluded `review:changes` entirely — `decideReviewGate` returns `wait-author` with no `applyLabel` for
  // it, so a PR that reached `review:changes` + `ready-to-merge` stayed contradictory forever with no sweeper
  // (the per-pass reconcile strip was deliberately dropped from this PR — see `xtw8e93`). Routing all THREE park
  // sites — the manifest-tamper park, the anti-test-gaming park, and the `decideReviewGate` park/wait-author
  // branch — through one seam also closes the first two, which applied `review:human` and `continue`d past the
  // strip, CREATING the contradictory state rather than merely failing to heal it.
  // Best-effort, exactly like every other label write here: the merge gate re-checks the hold directly and parks
  // a held PR whether or not `ready-to-merge` is present, so the label is a collection filter, never the land gate.
  const stripReadyOnPark = (v, { applyLabel = null, staleAcceptance = false } = {}) => {
    if (DRY_RUN) return;
    if (!decideParkReadyStrip(v.prLabels, { applyLabel, staleAcceptance })) return;
    try { execFileSync('gh', ['pr', 'edit', String(v.num), ...repoFlag(v.repo), '--remove-label', READY_TO_MERGE_LABEL], { stdio: ['ignore', 'ignore', 'pipe'] }); }
    catch { /* label best-effort */ }
  };
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
      // #2820-review-fix (round-2 finding, the FIFTH `!== 'merge'` site) — this mint set MUST use the SAME
      // predicate the per-verdict escalation loop below now uses (`|| v.reviewHeld`). Post-#2820 a green held PR
      // is `decision:'skip'` (not `'merge'`), so keying only on `=== 'merge'` dropped its repo out of the mint
      // loop — yet the loop below DOES process it (via `|| v.reviewHeld`) and can try to apply a review label that
      // was never `gh label create`d. In a repo where only `review:pending` was ever minted, the failed
      // `--add-label review:human` (test-gaming / manifest / fresh-score human escalation) lands in a swallowed
      // catch: the PR reports `humanRequired:true` in JSON but carries only `review:pending` on GitHub, and
      // `review-parked-prs.mjs` then treats it as agent-clearable and auto-accepts a PR a human was required to
      // clear. Minting for held PRs too keeps every verdict label present before any escalation pass applies one.
      const escalationRepos = new Set(verdicts.filter((v) => v.decision === 'merge' || v.reviewHeld).map((v) => v.repo || null));
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
      // #2820-review-fix — a `reviewHeld` PR is `decision:'skip'` (classifyPr refuses it regardless of
      // ready-to-merge, closing the #956 hold-integrity hole), but it MUST still flow through this pass so
      // `decideReviewGate` routes it to the SAME parked/humanRequired outcome the sticky veto always produced
      // (review:human → parked HUMAN-required; review:pending → parked agent-reviewable; review:changes →
      // wait-author). Without this the classifyPr skip short-circuits the parking path and a held PR is bucketed
      // as a bare `skipped` — losing the parked/humanRequired signal the drain contract + gate tests require
      // (fixture #103). It still never merges: `toMerge` filters on `decision === 'merge'`, which a held PR is
      // not, and decideReviewGate never returns `merge` for it (an uncleared, non-accepted review label always
      // parks). Everything else (no review label) is unaffected — only `decision === 'merge'` OR `reviewHeld`.
      if (v.decision !== 'merge' && !v.reviewHeld) continue;
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
      // #2890 — the net diff TEXT (base-vs-head CONTENT, not just changed-file names + a line count), needed as
      // `scoreEscalation`'s `diffHunks`: the shared precondition #2839's `assertNotPrincipleAndImpl` and #2840's
      // `isPrincipleSurface` need (both read hunk content). Derived in the SAME call as the changed-file shape
      // (`computeNetDiffSignals` — ONE `resolveNetDiffBasis`, #2890-review-fix finding 3) off ONE `exec`
      // closure, and reused below by the anti-test-gaming scan (which used to run its own separate
      // `computeNetDiffText`), so the score, the hunks, and the gaming scan can never see a different diff.
      //
      // No local/sibling clone ⇒ `computeNetDiffSignals` is never called and `diffHunks` stays `null`. That is
      // NOT the same posture as the sibling signals here: `changedFiles` has a `gh pr view --json files`
      // FALLBACK that still populates in exactly that case, so `diffHunks` must travel as `null` (NOT COMPUTED)
      // and never as `''` (#2890-review-fix finding 1). A real file list beside a fake-empty content signal is
      // how a content-reading detector silently concludes "no principle touch".
      let netDiffText = { text: '', scored: false, reason: 'no-clone' };
      let diffHunks = null;
      if (v.headRef && (isLocalRepo(v.repo) || escCwd)) {
        const exec = (cmd, args, opts) => execFileSync(cmd, args, { cwd: escCwd, ...opts });
        const sig = computeNetDiffSignals({ exec, rev: v.headRef, baseRev: v.base, fetchExtraRefs: [v.headRef] });
        changedFiles = sig.changedFiles;
        diffLines = sig.diffLines;
        humanBasisFiles = sig.humanBasisFiles;
        netScored = sig.scored;
        netDiffText = sig.netDiffText;
        diffHunks = sig.diffHunks;
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
      // #2890-review-fix finding 1 — `diffHunks` comes from `computeNetDiffSignals` above, which applies
      // `diffHunksFrom` (never a hand-rolled `scored ? text : null`): the text when it was actually computed,
      // `null` when it was not — including the no-clone path this block skipped entirely. Finding 4 — the hunks
      // are always CUMULATIVE while `changedFiles` may be de-inflated to `v.base…head`; the verdict's
      // `diffHunksBasisFiles` (= `humanBasisFiles`, same basis as the hunks) is what a detector pairs them with.
      const score = scoreEscalation({ changedFiles, diffLines, humanBasisFiles, dismissedFindings: v.dismissedFindings, crossRepo: v.crossRepo, diffHunks });
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
          // #2832 / #984 F2 — this park CREATES a hold (review:human) on a PR that, being in the
          // `--label ready-to-merge` candidate set, carries the go-ahead. Strip it in the same operation, through
          // the same seam the decideReviewGate park uses — this site `continue`s, so it never reached the strip.
          stripReadyOnPark(v, { applyLabel: REVIEW_LABELS.human });
          const posted = postDrainReasonComment(v.repo, v.num, 'park', v.reason, auditLineFor(v));
          if (posted && !AS_JSON) process.stderr.write(`  💬 ${repoTag(v.repo)}${v.num} manifest-tamper baseline mismatch stamped on PR\n`);
        }
        parked.push({ num: v.num, repo: v.repo || localSlug, humanRequired: true, reasons: tamper.reasons });
        if (!AS_JSON) process.stderr.write(`  ⏸ ${repoTag(v.repo)}${v.num} re-parked — manifest baseline mismatch (post-review tamper, HUMAN required): ${tamper.reasons.join('; ')}\n`);
        continue;
      }
      // #2440 (slice C of epic #2410) — ANTI-TEST-GAMING gate on the CI-green land clause. A green required
      // check is only trustworthy if it wasn't manufactured by GAMING the tests (deleting/`.skip`/`.only`-ing a
      // failing test, or shrinking the case set). Scan this PR's NET diff text for those deterministic,
      // diff-visible tamper forms; on a hit, REFUSE the auto-land and park `review:human` — a test removal is a
      // trust-chain concern the agent panel must not clear for itself; a human clears a legit removal. Best-
      // effort like the manifest gate: only when a local/sibling clone is present to read the diff text (no
      // clone ⇒ no text ⇒ the scan is a no-op — the same fail-open the manifest baseline gate documents).
      // #2890 — `netDiffText` was already fetched above (feeding `scoreEscalation`'s `diffHunks`); reused here
      // rather than re-fetched, so this scan and the escalation score can never disagree on what changed.
      const gaming = scanTestTampering({ diffText: netDiffText.text });
      if (netDiffText.scored && gaming.tampered) {
        v.decision = 'skip';
        v.escalated = 'yes';
        v.humanRequired = true;
        v.escalateReasons = gaming.reasons;
        v.reason = `test-gaming suspected — CI-green may be manufactured by tampering with tests: ${gaming.reasons.join('; ')}`;
        if (!DRY_RUN) {
          if (shouldApplyReviewLabel(REVIEW_LABELS.human, v.prLabels)) {
            try { execFileSync('gh', ['pr', 'edit', String(v.num), ...repoFlag(v.repo), '--add-label', REVIEW_LABELS.human], { stdio: ['ignore', 'ignore', 'pipe'] }); } catch { /* label best-effort */ }
          }
          // #2832 / #984 F2 — same as the manifest-tamper park above: this site CREATES a review:human hold on
          // a go-ahead-carrying candidate and `continue`s, so it must strip through the shared seam here.
          stripReadyOnPark(v, { applyLabel: REVIEW_LABELS.human });
          const posted = postDrainReasonComment(v.repo, v.num, 'park', v.reason, auditLineFor(v));
          if (posted && !AS_JSON) process.stderr.write(`  💬 ${repoTag(v.repo)}${v.num} test-gaming reason stamped on PR\n`);
        }
        parked.push({ num: v.num, repo: v.repo || localSlug, humanRequired: true, reasons: gaming.reasons });
        if (!AS_JSON) process.stderr.write(`  ⏸ ${repoTag(v.repo)}${v.num} parked — anti-test-gaming gate tripped (HUMAN required): ${gaming.reasons.join('; ')}\n`);
        continue;
      }
      // #2409 — the reviewed-commit gate. A `review:accepted` verdict only vouches for the tree the reviewer
      // looked at (the head SHA `review-set-label.mjs` stamped into the accept comment). Before the land cascade
      // honours the accept, read that reviewed SHA back plus the PR's LIVE head, and hand both to
      // `decideReviewGate` — it refuses to merge a stale acceptance whose head advanced past the reviewed tree
      // (the PR #368 hole). Fetched LAZILY, only for a PR that actually carries `review:accepted` (a small
      // subset), so the common non-accepted candidate pays no extra gh hop. Any fetch miss → both SHAs stay
      // null → the gate fails OPEN (never blocks a land on a transient read failure).
      let acceptedSha = null;
      let liveHeadSha = null;
      let acceptedDiff = null;
      let liveHeadDiff = null;
      let liveHeadRef = null;
      // #x9xqexm — the base-independent CONTRIBUTION fingerprints, read from the same comment scan and computed
      // from the same live net-diff text as their `*Diff` siblings (no extra gh or git hop).
      let acceptedContribution = null;
      let liveHeadContribution = null;
      // #xmnl36p — the OPERATOR CLEARANCE record, read from the SAME comment scan (no extra gh hop). It never
      // permits a merge; it only lets the gate know that a re-imposed `review:human` is overriding a human's
      // recorded clearance, so the re-hold can be announced instead of landing silently.
      let operatorClearance = null;
      if (hasReviewLabel(v.prLabels, REVIEW_LABELS.accepted)) {
        try {
          const d = JSON.parse(execFileSync('gh', ['pr', 'view', String(v.num), ...repoFlag(v.repo), '--json', 'headRefOid,headRefName,comments'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim() || '{}');
          liveHeadSha = typeof d.headRefOid === 'string' ? d.headRefOid : null;
          liveHeadRef = typeof d.headRefName === 'string' ? d.headRefName : null;
          acceptedSha = parseReviewedSha(d.comments || []);
          acceptedDiff = parseReviewedDiff(d.comments || []);
          acceptedContribution = parseReviewedContribution(d.comments || []);
          operatorClearance = parseOperatorClearance(d.comments || []);
        } catch { /* fetch miss → SHAs null → gate fails open */ }
        // #x169fqe — the LIVE diff, read only when the accept actually recorded a fingerprint to compare it
        // against AND the head has moved. Both conditions keep this off the common path: a pre-#x169fqe accept
        // (no fingerprint) never pays the hop, and neither does an accept whose head never moved. A miss leaves
        // the live diff null, which fails CLOSED into the SHA-identity verdict — a false re-park, never a false
        // honour.
        // THE REPO GUARD IS LOAD-BEARING (PR #1087 review, blocker 1). The drain sweeps PRs from THREE repos in
        // one process with no `chdir`, so every git read must be pinned to that PR's own clone via `escCwd` —
        // exactly as the two `computeNetDiff*` calls above already do. The first cut of this block omitted both
        // the `cwd` and the `isLocalRepo(v.repo) || escCwd` guard, so a sibling-repo PR resolved its refs against
        // the LOCAL WE CHECKOUT. Lane branches share the `lane/<NNN>-<slug>` naming across the constellation, so
        // a same-named local ref genuinely scores rather than failing closed — and if that wrong-repo diff's
        // fingerprint happened to match the recorded one, the drain would honour the accept and land the sibling
        // PR's real, unreviewed head. That is the one direction this gate may never fail in.
        // #x9xqexm — `|| acceptedContribution`: an accept that recorded ONLY the contribution marker (or, later,
        // only that one) must still pay for the live read, or its escape can never fire. Either marker present
        // is enough; neither present still costs nothing.
        if ((acceptedDiff || acceptedContribution) && liveHeadRef && liveHeadSha && acceptedSha
            && (isLocalRepo(v.repo) || escCwd)
            && !liveHeadSha.startsWith(acceptedSha) && !acceptedSha.startsWith(liveHeadSha)) {
          try {
            // #2979 — the NET diff, matching what `review-set-label.mjs` fingerprinted at accept time. It MUST be
            // the same basis on both sides: `gh pr diff`'s three-dot output still lists a sibling lane's file
            // that has since landed on main (#2450), so fingerprinting it made the accept go stale every time
            // ANY other lane landed — nothing to do with this PR's own content.
            const net = computeNetDiffText({
              exec: (cmd, args, opts) => execFileSync(cmd, args, { cwd: escCwd, ...opts }),
              rev: liveHeadRef,
              fetchExtraRefs: [liveHeadRef],
            });
            liveHeadDiff = net && net.scored ? net.text : null;
            // Same bytes, second digest — `acceptanceCoversHead` normalizes each with its own function.
            liveHeadContribution = liveHeadDiff;
          } catch { /* miss → null → SHA-identity verdict (the stricter path) */ }
        }
      }
      const gate = decideReviewGate({ escalate: score.escalate, humanRequired: score.humanRequired, labels: v.prLabels, acceptedSha, headSha: liveHeadSha, acceptedDiff, headDiff: liveHeadDiff, acceptedContribution, headContribution: liveHeadContribution, operatorClearance });
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
        // #2820-review-fix (de-dup, corrected round 3) — the final skip-stamp loop must NOT double-post a
        // byte-identical `skip` comment when THIS branch already recorded the WHY. But "entered this branch" is
        // NOT the same as "recorded the why": a `review:changes` wait-author (no `applyLabel`, `humanRequired`
        // false) and a DE-ESCALATED human park (`parkReasons` empty → the #2324 body block is '') both fall
        // through posting NOTHING. The old round-2 fix set `reviewParked = true` unconditionally on entry, which
        // then SUPPRESSED the skip-stamp for exactly those two kinds — deleting the only drain record of why the
        // PR was not landed (#2313). So track whether a durable record was ACTUALLY posted, and set
        // `reviewParked` from THAT below — the skip loop still stamps the two kinds this branch does not cover.
        let durableRecorded = false;
        v.reason = gate.reason + (score.reasons.length ? ` [${score.reasons.join('; ')}]` : '');
        // #2409 — a stale-acceptance re-park carries its reason on `gate.reason` (the head-advanced-past-reviewed
        // message), NOT on the fresh-diff `score.reasons`. PREPEND it (not either/or): the ride-in commit can
        // ALSO produce fresh escalation reasons (it may touch a blast-radius path), and the operator needs BOTH
        // — WHY the accept was invalidated AND what the new commit tripped — on the durable body/comment/log.
        const parkReasons = gate.staleAcceptance ? [gate.reason, ...score.reasons] : score.reasons;
        // #2832 / #984 F2 — the go-ahead strip runs for EVERY park/wait-author outcome, OUTSIDE the
        // `gate.applyLabel` guard below. `review:changes` reaches here as `wait-author` with NO `applyLabel`, so
        // nesting the strip under that guard left it as the one hold label with no standing reconcile. Keyed on
        // the observed labels plus this park's own writes (`gate.applyLabel`, and the #2409 accepted-drop below).
        stripReadyOnPark(v, { applyLabel: gate.applyLabel, staleAcceptance: gate.staleAcceptance });
        // #2307 — a PR the PRODUCER already labelled at PR-open (or a prior drain pass already caught) is
        // already-scored: this pass is an idempotent backstop/reconcile, not the first applier, so skip the
        // redundant `gh pr edit --add-label` call when the verdict label is already present (never a
        // double-apply). `shouldApplyReviewLabel` is the SAME shared gate `pr-land.mjs` uses at open, so
        // producer- and drain-applied verdicts can never drift on what "already labelled" means.
        if (gate.applyLabel && !DRY_RUN) {
          if (shouldApplyReviewLabel(gate.applyLabel, v.prLabels)) {
            try { execFileSync('gh', ['pr', 'edit', String(v.num), ...repoFlag(v.repo), '--add-label', gate.applyLabel], { stdio: ['ignore', 'ignore', 'pipe'] }); } catch { /* label best-effort */ }
          }
          // #xmnl36p — A CLEARANCE REVOCATION IS NEVER SILENT, and this is the ONE path that guarantees it.
          // It sits AHEAD of `shouldPostParkReasonComment` (which returns false for every human park, routing
          // the reason into the PR body instead) and outside the #2324 body-block write (which is a ONE-SHOT
          // append gated on `bodyHasEscalationReason`, so the second and every later re-hold writes nothing at
          // all). Together those two are exactly why WE PR #1106 was cleared at 00:34:00Z and silently re-held
          // at 00:41:28Z. `postDrainReasonComment` dedupes on the rendered text, which names the head SHA, so a
          // `--watch` loop re-reaching this state on the SAME head posts once — a new head posts again, which
          // is correct: that is a new revocation.
          if (gate.revokesClearance) {
            const posted = postDrainReasonComment(v.repo, v.num, 'park', buildClearanceRevocationComment({
              clearance: gate.clearance, reason: gate.reason, pr: v.num, repo: v.repo || localSlug,
            }), auditLineFor(v));
            if (posted && !AS_JSON) process.stderr.write(`  🔔 ${repoTag(v.repo)}${v.num} clearance-revocation notice posted (cleared by ${gate.clearance?.actor || 'operator'}, re-held review:human)\n`);
            durableRecorded = true;
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
            // This branch OWNS the durable `park` comment for an agent-reviewable park — whether it was posted now
            // or `postDrainReasonComment` deduped it against an identical one from a prior pass, the record exists.
            durableRecorded = true;
          }
        }
        // #x9xqexm — A RE-SCORE NEVER REMOVES `review:accepted`. This is where the drain used to
        // `gh pr edit --remove-label review:accepted` on a stale acceptance (#2409), and it is the second half
        // of the operator's longest-standing complaint: minutes after a `--to=clear-human` ceremony, an
        // automated pass deleted the clearance it had just recorded. Observed on WE PR #1100 (14:41:44) and
        // PR #984 (14:41:51), both 2–3s after the matching re-park label add.
        //
        // WHY DELETING IT WAS NEVER LOAD-BEARING. What stops the merge is the GATE'S VERDICT, not the label
        // state: `decideReviewGate` checks `review:accepted` FIRST and, when `acceptanceCoversHead` says the
        // acceptance is stale, returns `action:'park'` — never `'merge'` — for as long as it stays stale. The
        // park label added just above is applied, `v.decision` is already `'skip'`, and `toMerge` filters on
        // `decision === 'merge'`. So the removal changed no land decision on THIS path; it only destroyed the
        // durable record that a human cleared this PR, and with it the `reviewed-sha`/`reviewed-diff`/
        // `reviewed-contribution` machinery's ability to recognise the SAME clearance once the head settles.
        //
        // THE ONE THING THE REMOVAL DID BUY, closed elsewhere: the NON-scoring paths (the bare `/merge` orphan
        // sweep and the `--no-review-escalation` override) gate on `hasUnclearedReviewLabel`, which used to read
        // a present `review:accepted` as "cleared" unconditionally. That would have let a re-parked
        // `accepted + human` OR `accepted + pending` pair merge — and `pending` is the common one, since this
        // re-park applies it whenever the fresh score is not `humanRequired` (the PR #984 shape).
        // `hasUnclearedReviewLabel` now refuses BOTH pairs regardless of `review:accepted` (see its body for
        // why, and for why `accepted + changes` is deliberately left alone under #2974), so the hole is shut by
        // the predicate rather than by deleting a human's verdict. Retracting an acceptance stays what it always
        // should have been: a REVIEWER action, `review-set-label.mjs --to=changes`, which strips it
        // deliberately and says why.
        // #2324 (guarantee 2) — a `review:human` park must STATE the escalation reason IN THE PR BODY, so the
        // operator opening it sees why a human is required without re-deriving it from the rubric. Augment
        // (never replace) the live body with the marked block at park time, then verify the write landed —
        // best-effort (a write/verify miss is surfaced, never fatal: the label already carries the signal).
        if (gate.humanRequired && !DRY_RUN) {
          // The #2324 body block IS this human park's durable drain record. It exists only when there are reasons
          // to embed: `buildEscalationReasonBlock([])` is '' (a DE-ESCALATED human park has no fresh reasons), so
          // that case records NOTHING here and must NOT suppress the skip-stamp below (finding-1, round 3).
          const reasonBlock = buildEscalationReasonBlock(parkReasons);
          let liveBody = '';
          try { liveBody = JSON.parse(execFileSync('gh', ['pr', 'view', String(v.num), ...repoFlag(v.repo), '--json', 'body'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim() || '{}').body || ''; } catch { /* fetch miss — augment from empty, still best-effort */ }
          if (!bodyHasEscalationReason(liveBody)) {
            const newBody = liveBody + reasonBlock;
            try { execFileSync('gh', ['pr', 'edit', String(v.num), ...repoFlag(v.repo), '--body', newBody], { stdio: ['ignore', 'ignore', 'pipe'] }); }
            catch { if (!AS_JSON) process.stderr.write(`  ⚠ ${repoTag(v.repo)}${v.num} could not write the review:human escalation reason into the PR body (#2324) — add it by hand: ${parkReasons.join('; ')}\n`); }
            // Verify the write actually landed (never trust the edit call's exit code alone — gh can succeed
            // against a stale body if two edits race). A miss is loud, not silent.
            let verified = false;
            try { verified = bodyHasEscalationReason(JSON.parse(execFileSync('gh', ['pr', 'view', String(v.num), ...repoFlag(v.repo), '--json', 'body'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim() || '{}').body || ''); } catch { /* verify miss — reported below as unverified */ }
            if (!verified && !AS_JSON) process.stderr.write(`  ⚠ ${repoTag(v.repo)}${v.num} review:human body still missing the escalation reason after the write (#2324) — verify by hand: ${parkReasons.join('; ')}\n`);
            // #2820-review-fix (round 4) — attest the durable record from the VERIFIED effect of the body write,
            // NOT from merely HAVING COMPUTED the block: an unconfirmed edit (gh exit lies / a racing write) must
            // leave `durableRecorded` false so the skip loop still stamps the reason — otherwise the PR ends the
            // pass with NO record at all (a regression vs main). #2857 sweeps this attest-by-effect class.
            if (reasonBlock) durableRecorded = verified;
          } else if (reasonBlock) {
            // The #2324 block is already durably in the body from a prior pass — the record exists; setting the
            // flag here keeps the skip loop from re-stamping a duplicate (round-3 dedup preserved).
            durableRecorded = true;
          }
        }
        // #2820-review-fix (finding-1, round 3) — suppress the final skip-stamp ONLY when this branch actually
        // recorded the why (an agent-reviewable `park` comment, or a non-empty #2324 human body block). A
        // NON-escalating `review:changes` wait-author and a de-escalated human park recorded nothing →
        // `reviewParked` stays false → the skip loop stamps their reason. (Scope note: this fixes only the kinds
        // the skip loop gates on `reviewParked`. An ESCALATING wait-author — `humanRequired:false`, no applyLabel,
        // no body block — is separately, PRE-EXISTINGLY suppressed by the untouched `escalated==='yes'` exclusion
        // below and is NOT addressed here; the reviewer's own change-request text carries its "why". Widening to
        // cover it would have to loosen `escalated==='yes'`, which the round-2 tamper/test-gaming parks depend on.)
        v.reviewParked = durableRecorded;
        // #2285 v1 — the skill's auto-review step consumes this: humanRequired PRs are left for the operator,
        // the rest are eligible for a fresh-context adversarial review subagent.
        parked.push({ num: v.num, repo: v.repo || localSlug, humanRequired: !!gate.humanRequired, reasons: parkReasons });
        if (!AS_JSON) process.stderr.write(`  ⏸ ${repoTag(v.repo)}${v.num} parked for review (${gate.action}${gate.applyLabel ? `, labelled ${gate.applyLabel}` : ''}${gate.humanRequired ? ', HUMAN required' : ', agent-reviewable'}): ${parkReasons.join('; ')}\n`);
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

  // #xc7p3q9 (R4/R5) — the couple JOIN runs HERE, AFTER the escalation/park pass, through the ONE shared seam
  // `planDrainPass` (the same function the test suite drives). `candidateHeldByKey` carries each live candidate's
  // FINAL held (its decision is now settled: skip/park from escalation), so a fresh carrier the escalation pass
  // just parked reads `held` and its impl DEFERS — instead of the pre-escalation label snapshot that let the impl
  // land while the carrier sat parked (R5). The join mutates `verdicts` in place (stamping `coupleDefer`); the
  // cascade below re-orders those same stamped verdicts. This is runCli's SINGLE plan producer (R4) — the
  // `replan` closure below only re-orders across merges, it never re-derives the join wiring.
  const candidateHeldByKey = new Map();
  for (const v of verdicts) candidateHeldByKey.set(`${v.repo || 'cwd'}::${v.num}`, v.decision !== 'merge');
  const preparedPass = planDrainPass({
    verdicts,
    openPrContext,
    escalationRelief,
    label,
    isLocalRepo,
    localSlug,
    candidateHeldByKey,
    landedThisPass,
    provenOnMain,
  });
  // #xc7p3q9 — the ONE re-plan wiring (shared by the dry-run report and the live cascade): re-orders the joined+
  // stamped `verdicts` across merges, threading the SAME extraOpenItems + contextComplete + WE-repo predicate the
  // seam used. No second, divergently-typed `planLabelDrain` invocation (R4).
  const replan = (cands) => planLabelDrain(cands, { landedThisPass, provenOnMain, extraOpenItems: orderExtraOpenItems, contextComplete: !!openPrContext.contextComplete, isWeRepo: isLocalRepo });
  const toMerge = verdicts.filter((v) => v.decision === 'merge'); // @merge-gate-exempt the FINAL set actually merged; a held PR is `decision:'skip'` and MUST be excluded here — this is the hard AND that never lands a held PR
  const skipped = verdicts.filter((v) => v.decision === 'skip');
  // #xc7p3q9 (R6) — the held couple's members (its `skip` carrier + its deferred impl half — both carry
  // `coupleDeferReason:'held'`) so `decideBatchesIdleExit` can SUBTRACT them from `considered` rather than waive
  // the queue-empty check wholesale.
  const heldCoupleMembers = verdicts.filter((v) => v.coupleDeferReason === 'held').length;

  // #2313 — stamp the *why* onto every OTHER final skip too (a real non-manifest conflict, a red required
  // check, an unlandable merge state, …), not only the review-escalation park path above. Excludes: verdicts
  // whose park path ALREADY posted a durable record (`v.reviewParked` — set true only when the park branch
  // actually stamped an agent `park` comment or wrote a non-empty #2324 human body block, so a `review:changes`
  // wait-author and a de-escalated human park — which record nothing — are NOT excluded and get stamped here;
  // #2820-review-fix corrected this from unconditional-on-entry, which double-commented an agent park yet
  // dropped the record for those two kinds); a collision-heal in flight (`v.collisionHealed` — self-fixing, CI
  // is re-running on the renumbered tip, nothing for a human to act on yet); an uncertified PR (not a producer
  // PR the drain owns — never comment on an unrelated human PR).
  if (!DRY_RUN) {
    for (const v of skipped) {
      if (v.escalated === 'yes' || v.reviewParked || v.collisionHealed) continue;
      if (!(v.certifyLabel || v.aiGenerated)) continue;
      // xnsk54v follow-up — mirror the park path: record the acted-on manifest values into the durable skip
      // comment for a manifest-carrying PR (tamper-evidence), leaving orphan/impl skip comments unchanged.
      const posted = postDrainReasonComment(v.repo, v.num, 'skip', v.reason, auditLineFor(v));
      if (posted && !AS_JSON) process.stderr.write(`  💬 ${repoTag(v.repo)}${v.num} skip reason stamped on PR\n`);
    }
  }

  if (!AS_JSON) {
    // @merge-gate-exempt human-readable one-line-per-verdict log only (no control flow); a held PR prints as `· skip` with its hold reason, which is correct
    for (const v of verdicts) process.stderr.write(`  ${v.decision === 'merge' ? '→ merge' : '· skip '} ${repoTag(v.repo)}${v.num} ${v.item ? `(#${v.item}${v.blockedBy.length ? ` ⤳ ${v.blockedBy.join(',')}` : ''}) ` : ''}${v.decision === 'skip' ? `(${v.reason})` : ''} — ${v.title}\n`);
    process.stderr.write(`${DRY_RUN ? 'DRY-RUN: ' : ''}${toMerge.length} AI PR(s) to merge${label ? ` (label "${label}")` : ''}, ${skipped.length} skipped.\n`);
  }

  const merged = [];
  const failedMerges = [];
  const pendingRebased = []; // #2198 — PRs rebuilt onto main this pass; CI re-running, land on a later pass
  let deferred = [];
  if (DRY_RUN) {
    // Report the planned first-pass order (blockedBy + #2393 stackParents-honoured) without merging. Nothing has
    // landed this run, so `landedThisPass` is empty — the plan reflects the shared seam's plan + prior-session proof.
    const plan = preparedPass.plan;
    deferred = plan.deferred;
    if (!AS_JSON) {
      process.stderr.write(`  merge order: ${plan.ready.map((c) => repoTag(c.repo) + c.num + (c.item ? `→${c.item}` : '')).join(' → ') || '(none ready)'}\n`);
      if (deferred.length) process.stderr.write(`  deferred (blockedBy unlanded): ${deferred.map((d) => `#${d.num}→[${d.waitOn.join(',')}]`).join(', ')}\n`);
      if (plan.staleLandedOpenItems?.length) process.stderr.write(`  ⓘ stale-PR note (#999/xq985wu F2): ${nameStaleHolders(plan.staleLandedOpenItems)} — proven landed but still named by an open PR (edge cleared; the open PR is stale/abandoned/impl-half)\n`);
    }
  } else {
    // Cascade: merge every READY candidate in blockedBy order; a merged item leaves the open set, freeing its
    // dependents next pass (mirrors the lane-drain cascade). A merge FAILURE (red/behind) marks the PR `skip`
    // so it keeps blocking its dependents — never land past a broken blocker.
    let remaining = verdicts.map((v) => ({ ...v }));
    // #2257 — an item is unique per (repo, PR#): match/remove candidates on both so a WE #10 and a FUI #10 never
    // collide in the cascade bookkeeping.
    const sameCand = (a, b) => a.num === b.num && a.repo === b.repo;
    let staleLandedOpenItems = [];
    for (;;) {
      const plan = replan(remaining);
      deferred = plan.deferred;
      staleLandedOpenItems = plan.staleLandedOpenItems || [];
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
          // #2683 — the write is now SERIALIZED by the serial-writer mutex (drain-lock, shared with the numbering
          // section) and GUARDED by a per-PR idempotency re-check. The mutex is the ONLY lock a `--only` fast drain
          // shares with a concurrent resident-daemon sweep (the fast drain bypasses the whole-process lease), so
          // it is what serializes the actual merge write, not just NNN allocation. Inside the lock, the re-check
          // makes a PR another lander already merged a safe no-op — never a double `gh pr merge`.
          const landLock = withLandWriteLock(() => {
            if (isPrAlreadyMerged(c.repo, c.num)) return { skipped: 'already-merged' };
            mergePr({ pr: c.num, repo: c.repo, method: 'merge', caller: 'drain' });
            return { merged: true };
          });
          if (landLock.contended && !AS_JSON) process.stderr.write(`  ⚠ merge-write mutex not acquired (held by ${landLock.heldBy || '?'}) — merged under the per-PR idempotency guard instead (#2683)\n`);
          if (landLock.result && landLock.result.skipped === 'already-merged') {
            // A concurrent lander already merged this PR. Treat it as landed for THIS pass's ordering bookkeeping
            // (item leaves the open set → dependents free) but do NOT add it to `merged`: the lander that actually
            // ran `gh pr merge` owns the post-land numbering / derived-regen / main-sync. Idempotent no-op.
            remaining = remaining.filter((x) => !sameCand(x, c));
            if (c.hasManifest && c.item != null) landedThisPass.add(asItemId(c.item));
            progressed = true;
            if (!AS_JSON) process.stderr.write(`  ✓ ${repoTag(c.repo)}${c.num} already merged by a concurrent lander — idempotent no-op (#2683)\n`);
            continue;
          }
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
          // #2683 — CONTENDED-FALLBACK idempotency recovery. If the merge write raced past the mutex (the
          // never-hang fallback ran `fn` un-locked) and LOST to a concurrent lander, `gh pr merge` throws here on
          // an already-merged PR. Re-probe: if it is now MERGED, this is the SAME safe idempotent no-op as the
          // in-lock pre-check — record it as landed for the ordering bookkeeping instead of a spurious
          // `failedMerges` (the other lander owns the post-land numbering/regen). Only a merge failure on a PR
          // that is genuinely still open is a real fault below.
          if (isPrAlreadyMerged(c.repo, c.num)) {
            remaining = remaining.filter((x) => !sameCand(x, c));
            if (c.hasManifest && c.item != null) landedThisPass.add(asItemId(c.item));
            progressed = true;
            if (!AS_JSON) process.stderr.write(`  ✓ ${repoTag(c.repo)}${c.num} merged by a concurrent lander during a contended write — idempotent no-op (#2683)\n`);
            continue;
          }
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
    if (staleLandedOpenItems.length && !AS_JSON) process.stderr.write(`  ⓘ stale-PR note (#999/xq985wu F2): ${nameStaleHolders(staleLandedOpenItems)} — proven landed but still named by an open PR (edge cleared; the open PR is stale/abandoned/impl-half)\n`);
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
  // #2899 jury J2 — the resolve-on-land totality report: every id in `landedThisPass` ends in exactly one of
  // these buckets, and every bucket reaches the operator (stderr) AND `--json`. A withheld item that appears in
  // none of them is the silent skip this whole item was filed against.
  let resolveOnLandReport = { resolved: [], alreadyResolved: [], deferred: [], failed: [] };
  if (landedLocal && !DRY_RUN) {
    // #2391 — number+publish is the NUMBERING CRITICAL SECTION (sole-serial-writer, #2288/#2290). Guard it with
    // the TTL-bounded numbering mutex so a concurrent drain/land never mints the same NNN off the same base.
    const numLock = withNumberingLock(() => {
      const n = numberPendingHashes(process.cwd());
      // #2899 A5 — RESOLVE-ON-LAND for the LABEL lander. This drain single-sourced lane-drain's NUMBERING but
      // never its RESOLVING, so it assigned the NNN and left `status:` untouched — delivered work kept ranking
      // Tier-A agent-ready and was re-packed into batch after batch (observed on #2880 / #2450, each costing a
      // full claim+lane+investigate cycle to change one frontmatter line). Flip every item whose WE CARRIER
      // merged this pass, via the SAME `resolveLandedItem` lane-drain uses — one home, two callers.
      //
      // Ordering matters and is deliberate: this runs INSIDE the numbering critical section and AFTER
      // `numberPendingHashes`, so a hash-born item is flipped under its freshly-minted `<NNN>` (the id its file
      // now carries), and `publish:false` makes the flip commits ride the SAME push as the numbering commit —
      // so main never shows a numbered-but-unresolved card. `sync:false` because this path already synced and
      // holds an un-pushed numbering commit that a `pull --ff-only` has no business touching.
      //
      // THE GATE (corrected — PR #1012 round-3 review, B5). `landedThisPass` is stamped on the WE-CARRIER merge,
      // and an earlier version of this comment claimed that was sufficient because "WE-last ordering means the
      // carrier merges only after its impl half did". That is FALSE, and running the cascade disproves it: the
      // couple decision is computed once at PLAN time, and the in-cascade `replan` re-runs `planLabelDrain`
      // WITHOUT the couple join — so if the impl's merge throws, its decision flips to `skip` and the carrier
      // still lands. Resolving off the carrier alone would then flip the card on main with the implementation PR
      // still open, and nothing would re-dispatch it: the exact forever-block this item closes, reappearing
      // inside the fix. So the gate now also requires every OTHER lane ref the couple's manifest names to be
      // absent from the pass's OPEN-PR set — positive evidence the whole couple landed. A sibling still open
      // defers the flip to a later pass, the safe direction (an unresolved card costs a re-pack; a wrongly
      // resolved one is a silent forever-block). Best-effort/non-fatal throughout, as numbering is.
      // #2899 jury J4 — key the couple map by ITEM+REPO, not item alone. `landedCarriers` is built from EVERY
      // manifest-bearing verdict, and a non-WE PR can carry a body manifest too, so two verdicts can share one
      // item id. With an item-only key the last writer won, and if that was the IMPL half then `couple.headRef`
      // became the impl's ref — which the gate's `r !== couple.headRef` exemption then treats as "the half that
      // just merged", skipping the very ref that proves the couple is incomplete. The safety check silently
      // disabled itself. The WE carrier is preferred explicitly rather than left to iteration order.
      const landedCarriers = verdicts.filter((v) => v && v.hasManifest && v.item != null)
        .map((v) => ({ item: v.item, repo: v.repo || null, isWe: isLocalRepo(v.repo), headRef: v.headRef, manifestRefs: v.manifestRefs }));
      // `openPrContext` is a PASS-START snapshot, so a sibling that merged during THIS pass is still listed in
      // it. Subtract the refs merged this pass or the gate could never pass for the normal impl-first/WE-last
      // couple — the whole point is to catch a sibling that is STILL open after the cascade finished.
      // #2899 jury J5 — a `merged` entry that matches no verdict is an INTEGRITY failure, not a silent skip: it
      // would leave that ref looking "still open", block its couple, and (pre-J2) drop the item with no trace.
      // Surface it and fail the gate closed for this pass rather than guessing.
      const mergedRefs = new Set();
      const unmatchedMerges = [];
      for (const m of merged) {
        const v = verdicts.find((x) => x && x.num === m.num && (x.repo || null) === (m.repo || null));
        if (v && v.headRef) mergedRefs.add(v.headRef);
        else unmatchedMerges.push(`${m.repo || 'cwd'}#${m.num}`);
      }
      if (unmatchedMerges.length && !AS_JSON) {
        process.stderr.write(`  ⚠ resolve-on-land: ${unmatchedMerges.join(', ')} merged but matched no verdict — cannot prove its couple landed; those items are DEFERRED (#2899)\n`);
      }
      const openHeadRefs = [];
      for (const [, prs] of (openPrContext.prsByRepo instanceof Map ? openPrContext.prsByRepo : new Map())) {
        for (const p of (Array.isArray(prs) ? prs : [])) {
          if (p && p.headRefName && !mergedRefs.has(p.headRefName)) openHeadRefs.push(p.headRefName);
        }
      }
      // #2899 jury J2/J3 — TOTALITY. Every id in `landedThisPass` must end in exactly ONE observable bucket:
      // resolved / already-resolved / deferred / failed. The first cut returned only the ids to flip, so a
      // couple withheld by the B5 gate vanished with no log line, no `--json` key and no retry — and the comment
      // claimed it would "defer to a later pass", which is FALSE: `landedThisPass` is only populated when a
      // carrier merges IN that pass, so a later pass never re-lists it. The deferral is correct (never resolve
      // on partial evidence) but it is TERMINAL for this run, so it must be reported — the A4 stranded sweep is
      // the recovery path, and it can only find what was announced. A silent skip inside a fix for silent skips
      // is the one outcome this item cannot ship.
      const plan = planResolveOnLand({ landedItems: landedThisPass, assigned: n.assigned, carriers: landedCarriers, openHeadRefs });
      const resolvedOnLand = [];
      const alreadyResolved = [];
      const failedResolve = [];
      for (const id of plan.resolve) {
        try {
          const flip = resolveLandedItem(process.cwd(), id, { sync: false, publish: false });
          if (flip.flipped) resolvedOnLand.push(id);
          else if (flip.alreadyResolved) alreadyResolved.push(id);
          else failedResolve.push({ id, reason: flip.reason || 'resolve-refused' });
        } catch (e) {
          // Never unwinds a green land — but never silent either (J3).
          failedResolve.push({ id, reason: String((e && e.message) || e).split('\n')[0] });
        }
      }
      if (!AS_JSON && plan.deferred.length) {
        process.stderr.write(`  · resolve-on-land DEFERRED ${plan.deferred.map((d) => `#${d.id} (${d.reason})`).join(', ')} — the couple did not fully land; \`node scripts/backlog-stranded-sweep.mjs\` finds these (#2899)\n`);
      }
      if (!AS_JSON && failedResolve.length) {
        process.stderr.write(`  ⚠ resolve-on-land FAILED ${failedResolve.map((f) => `#${f.id} (${f.reason})`).join(', ')} — the card is NOT resolved on main; resolve it by hand (#2899)\n`);
      }
      resolveOnLandReport = { resolved: resolvedOnLand, alreadyResolved, deferred: plan.deferred, failed: failedResolve };
      if (n.committed || resolvedOnLand.length) {
        try {
          execFileSync('git', ['push', 'origin', 'HEAD:main'], { env: { ...process.env, MAIN_PUSH_OK: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
          if (!AS_JSON && n.committed) process.stderr.write(`  ✓ JIT-numbered ${n.assigned.map((a) => `${a.hash}→#${a.nnn}`).join(', ')} + pushed to main (#2288)\n`);
          if (!AS_JSON && resolvedOnLand.length) process.stderr.write(`  ✓ resolved on land ${resolvedOnLand.map((i) => `#${i}`).join(', ')} + pushed to main (#2899/#2748)\n`);
        } catch (e) {
          if (!AS_JSON) process.stderr.write(`  ⚠ numbering/resolve committed locally but push FAILED (${String(e.message || e).split('\n')[0]}) — push main by hand\n`);
        }
      }
      return { ...n, resolvedOnLand };
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
  const result = { ok: duplicateIdsOnMain.length === 0, dryRun: DRY_RUN, label, repos: REPOS.map((r) => r || localSlug || 'cwd'), considered: verdicts.length, heldCoupleMembers, toMerge: toMerge.map((v) => ({ num: v.num, repo: v.repo || localSlug })), merged, failed: failedMerges, rebased, pendingRebased, healed, deferred, localSynced, ...(primarySynced !== null ? { primarySynced } : {}), ...(numbered.assigned.length ? { jitNumbered: numbered.assigned } : {}), ...(resolveOnLandReport.resolved.length || resolveOnLandReport.deferred.length || resolveOnLandReport.failed.length || resolveOnLandReport.alreadyResolved.length ? { resolveOnLand: resolveOnLandReport } : {}), ...(duplicateIdsOnMain.length ? { duplicateIdsOnMain } : {}), derivedRegenerated: derived.done, derivedFailed: derived.failed, ...(derived.warning ? { derivedWarning: derived.warning } : {}), reconciledLabels, parked, skipped: skipped.map((v) => ({ num: v.num, repo: v.repo || localSlug, reason: v.reason, ...(v.escalated ? { escalated: v.escalated } : {}), ...(v.humanRequired ? { humanRequired: true } : {}) })) };
  return { result, merged, failedMerges, pendingRebased: pendingAll, deferred, duplicateIdsOnMain };
  }; // end sweepOnce

  // ── Whole-process drain lease — ALWAYS-ON for full/label sweeps + watches (#2449; #2391/#2424/#2443) ──────
  // Route through the pure gate, then perform the atomic acquire. A live foreign holder (or a lost acquire
  // race) means this run's work is already being done — no-op exit 0 surfacing the holder. An acquired lease
  // covers the run's FULL lifetime (one-shot AND watch) and is released on EVERY exit path (normal, break,
  // signal) via the `exit` handler. `--only` fast drains, `--dry-run`, and `--no-drain-lease` bypass;
  // a daemon child pass runs `under-lease` without acquiring (the parent heartbeats).
  const leaseOwner = drainOwner();
  const leaseGate = decideDrainLeaseGate({ dryRun: DRY_RUN, onlyPr, noLease: NO_DRAIN_LEASE, underLease: UNDER_LEASE, repos: leaseScope, status: drainLeaseStatus(DRAIN_LOCK_ROOT) });
  let leaseHeld = false;
  if (leaseGate.action === 'acquire') leaseHeld = acquireDrainLease(DRAIN_LOCK_ROOT, leaseOwner, { scope: leaseScope }).ok === true;
  if (leaseGate.action === 'noop' || (leaseGate.action === 'acquire' && !leaseHeld)) {
    const st = drainLeaseStatus(DRAIN_LOCK_ROOT);
    const heldBy = st.owner || leaseGate.heldBy || null;
    const uncovered = Array.isArray(leaseGate.uncovered) ? leaseGate.uncovered : [];
    const detail = leaseGate.reason === 'declared-holder-gone'
      ? `--under-lease holder ${UNDER_LEASE} no longer holds a live lease — no-op; the queue rides the next drain (#2449)`
      // #2458 — a scoped holder that does NOT cover some of this run's repos: report the UNCOVERED repos HONESTLY
      // rather than the old false "its next pass covers this work" (which stranded them until the holder exited).
      : leaseGate.reason === 'lease-held-uncovered'
      ? `another drain holds the whole-process lease (${heldBy || '?'}) but its scope does NOT cover ${uncovered.join(', ')} — those repos are NOT swept by the holder; wait for it to exit, or force an immediate scoped run with --no-drain-lease (#2458)`
      : `another drain already holds the whole-process lease (${heldBy || '?'}) — no-op; its next pass covers this work (#2449/#2391)`;
    if (AS_JSON) process.stdout.write(JSON.stringify({ ok: true, ...(WATCH ? { watch: true } : {}), skipped: 'drain-in-progress', heldBy, detail, ...(uncovered.length ? { uncovered } : {}) }) + '\n');
    else process.stderr.write(`merge-ai-prs · ${detail}\n`);
    process.exit(0);
  }
  if (leaseHeld) {
    // Release on ANY exit path (the watch loop has several `break`s + signal kills). Idempotent + owner-fenced:
    // releaseDrainLease only frees a lease THIS owner still holds, so a reclaimer who seized it is never stomped.
    process.on('exit', () => { releaseDrainLease(DRAIN_LOCK_ROOT, leaseOwner); });
    for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => process.exit(0)); // → triggers the exit handler → frees the lease
  }

  // ── RED-MAIN dispatch-freeze (#2681) — the sole writer STOPS THE LINE while main is red ─────────────────────
  // Diff-driven shrink (#2681) can let a PR land green while a test outside its selected set is red against the
  // merged tree; the post-land full-suite backstop then reds main. Under the sole writer that is a GLOBAL red —
  // every subsequent land builds on a broken tree. So before landing anything, consult the durable red-main
  // freeze marker (raised by red-main-remediation.mjs on a post-land red). A live freeze ⇒ refuse to land and
  // surface the stop-the-line, symmetric to the duplicate-id-on-main hard stop below. `--no-red-main-freeze`
  // (or WE_MERGE_BREAK_GLASS) is the documented admin bypass. Absent marker ⇒ this is a no-op (the default, and
  // the ONLY state while the shrink flag is off), so it changes nothing about today's landing behaviour.
  // Consulted BEFORE the one-shot land AND at the top of every WATCH pass (a freeze can be raised MID-watch, so
  // like the dup-id stop below it must be re-checked each pass — reading `redMainFreezeStop()` per pass).
  const redMainBypass = !!flags['no-red-main-freeze'] || process.env.WE_MERGE_BREAK_GLASS === '1';
  const redMainFreezeStop = () => {
    if (redMainBypass || !isDispatchFrozen()) return null;
    const fr = readFreeze();
    return {
      marker: fr,
      detail: `main is RED (red-main dispatch-freeze active${fr?.reason ? `: ${fr.reason}` : ''}) — the drain lands NOTHING until main is green again. Revert-to-green${fr?.mergeSha ? ` (revert ${fr.mergeSha})` : ''}, then \`node scripts/readiness/red-main-remediation.mjs unfreeze\` (#2681).`,
    };
  };
  const emitRedMainStop = (stop) => {
    if (AS_JSON) process.stdout.write(JSON.stringify({ ok: false, ...(WATCH ? { watch: true } : {}), stopped: 'red-main-freeze', detail: stop.detail, marker: stop.marker }) + '\n');
    else process.stderr.write(`merge-ai-prs · STOP-THE-LINE — ${stop.detail}\n`);
  };
  {
    const stop = redMainFreezeStop();
    if (stop) { emitRedMainStop(stop); process.exit(5); } // distinct from empty (0), merge-fail (2), dup-id (3): a red-main stop-the-line
  }

  // ── Driver — one sweep (the /drain one-shot + /merge bare), or the `--watch` monitor (`/drain watch`) ──────
  if (!WATCH) {
    let { result, failedMerges, duplicateIdsOnMain } = await sweepOnce();
    // #2230 — the label index lags the producer's label write, so a one-shot fired right after labelling can see
    // the just-labelled PR as absent. Re-poll ONCE after a short delay before concluding the queue is empty.
    // Fail-soft: a still-empty re-poll is a legitimate empty queue, not an error.
    if (shouldRepollForLabelLag({ label, found: result.considered, expect: EXPECT, retried: false })) {
      if (!AS_JSON) process.stderr.write(`  · ${result.considered} labelled candidate(s)${EXPECT ? ` (< expected ${EXPECT})` : ''} — re-polling once in ${REPOLL_SEC}s (label index may lag the producer's label write)…\n`);
      sleepSync(REPOLL_SEC * 1000);
      ({ result, failedMerges, duplicateIdsOnMain } = await sweepOnce());
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
  let redMainStopped = false; // #2681 — a freeze raised MID-watch stops the line this pass
  for (let pass = 1; ; pass++) {
    if (leaseHeld) heartbeatDrainLease(DRAIN_LOCK_ROOT, leaseOwner, { scope: leaseScope }); // #2395 — keep the whole-process lease alive across a long watch (an `under-lease` child never heartbeats — its parent daemon owns that); #2458 re-supply the scope so it survives the heartbeat rewrite
    // #2681 — RE-CHECK the red-main dispatch-freeze EVERY pass: a post-land red can be raised DURING a running
    // watch (the resident drain daemon is a long-lived `--watch`), and stop-the-line must catch it, not just a
    // freeze that predated process start. Symmetric to the dup-id stop below — break and surface with exit 5.
    {
      const stop = redMainFreezeStop();
      if (stop) { emitRedMainStop(stop); redMainStopped = true; break; }
    }
    // #2395 — wall-clock lifetime cap: hard-stop a `--max-runtime-min` watch so an inert `--until-batches-idle`
    // (no batch feed present) can never poll forever. The deferred sweep is the backstop for anything unlanded.
    if (MAX_RUNTIME_MS != null && Date.now() - watchStartedAt >= MAX_RUNTIME_MS) {
      if (!AS_JSON) process.stderr.write(`watch: STOPPING — reached the --max-runtime-min cap (${MAX_RUNTIME_MS / 60_000}m); anything unlanded rides the deferred sweep.\n`);
      break;
    }
    if (!AS_JSON) process.stderr.write(`── pass ${pass} ──\n`);
    const { result, merged, failedMerges, pendingRebased, deferred, duplicateIdsOnMain } = await sweepOnce();
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
    // #xc7p3q9 (Fix 3) — a pass whose deferrals are ALL "blocked solely on a review-HELD carrier"
    // (`deferralsAllHeldCouple`) counts as IDLE: a human hold will not clear by polling, so a `--watch
    // --until-batches-idle` / `--max-idle` drain with one human-held couple must not run to its wall-clock cap
    // holding the lease. A degraded/truncated fail-closed defer is NOT held-couple-only (it may clear on a
    // re-fetch), so it keeps the pass non-idle — the watch keeps polling.
    const idlePass = isPassIdle({ merged: merged.length, pendingRebased: pendingRebased.length, deferred });
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
      if (decideBatchesIdleExit({ enabled: true, idlePass, considered: result.considered, deferred, heldCoupleMembers: result.heldCoupleMembers, batchNonRunningStreak, debounce: BATCH_DEBOUNCE })) {
        // #2330 review (1) — the queue-empty signal (`considered === 0`) rides the SAME lagging label index
        // #2230 guards: after the producer resolves the LAST item its reservation drops (feed → non-running)
        // promptly, but that item's `ready-to-merge` label can stay invisible to `gh pr list --label` for
        // minutes. Without a confirm, the debounced streak + a stale-empty queue would exit and DROP the batch's
        // final PR. So re-poll ONCE (same defense as the one-shot path) and only exit if the queue is STILL empty.
        if (!AS_JSON) process.stderr.write(`  · batch idle + queue empty — confirming in ${REPOLL_SEC}s (label index may lag the final PR's label)…\n`);
        sleepSync(REPOLL_SEC * 1000);
        const confirm = await sweepOnce();
        passes.push(confirm.result);
        allMerged.push(...confirm.merged);
        lastFailed = confirm.failedMerges;
        lastDup = confirm.duplicateIdsOnMain || [];
        if (lastDup.length) {
          if (!AS_JSON) process.stderr.write(`watch: STOPPING — duplicate id(s) survive on main (${summarizeDuplicates(lastDup)}); resolve by hand then re-run the drain.\n`);
          break;
        }
        // #xc7p3q9 (B5) — the confirm sweep uses the SAME held-couple allowance as `decideBatchesIdleExit`: a
        // pass that landed/rebuilt nothing and whose only remaining deferral is a human-held couple is "settled"
        // (the hold won't clear by polling). Without this, one held couple leaves `confirm.deferred.length > 0`
        // forever and the confirm never fires — the drain spins to `--max-runtime-min` holding the lease.
        const confirmedEmpty = isConfirmSweepSettled({ merged: confirm.merged.length, pendingRebased: confirm.pendingRebased.length, considered: confirm.result.considered, deferred: confirm.deferred });
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
  // A red-main freeze already emitted its own stop payload (above) — don't double-emit; just exit 5.
  if (redMainStopped) process.exit(5);
  if (AS_JSON) process.stdout.write(JSON.stringify({ ok: lastDup.length === 0, watch: true, label, interval: INTERVAL, maxIdle: MAX_IDLE, passes: passes.length, merged: allMerged, lastFailed, ...(lastDup.length ? { duplicateIdsOnMain: lastDup } : {}) }) + '\n');
  process.exit(lastDup.length ? 3 : (lastFailed.length ? 2 : 0));
}
