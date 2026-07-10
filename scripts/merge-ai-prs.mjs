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
import { emptyParkState, parseParkState, serializeParkState, getParkedSinceMs, recordParked, clearParked } from './lib/review-park-state.mjs';
import { mergePr, hasNonEmptyBody } from './lib/pr-merge-gate.mjs';
import { DERIVED_REGEN, DERIVED_OUTPUT_PATHS, numberPendingHashes, isPostLandTreeDirty } from './lane-drain.mjs';
import { findDuplicateIds, summarizeDuplicates } from './lib/duplicate-id-tripwire.mjs';

// #2262 — the local, machine-scoped park-age clock the review-escalation watch-window gate reads its
// `parkedSinceMs` from (see review-park-state.mjs for why losing/corrupting this file is safe). Resolved
// against cwd (the drain always runs from the target repo's root).
const REVIEW_PARK_STATE_PATH = resolve(process.cwd(), '.claude/skills/drain/review-park-state.json');

const argv = process.argv.slice(2);
const flags = {};
for (const a of argv) { const m = a.match(/^--([^=]+)(?:=(.*))?$/); if (m) flags[m[1]] = m[2] === undefined ? true : m[2]; }

// ── PURE helpers (unit-tested in scripts/__tests__/merge-ai-prs.test.mjs) ──────────────────────────────

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
 * Order a set of merge candidates for ONE cascade pass, honouring cross-item `blockedBy` (#2188). Pure.
 * This is the drain↔/merge convergence: the `ready-to-merge` label bounds the set, and each PR's
 * `.lane-manifest.json` (read off its head ref) supplies its backlog `item` + `blockedBy` items. A PR is
 * READY this pass only if none of its `blockedBy` items is still OPEN in the candidate set (an unlanded
 * blocker — whether a not-yet-merged sibling or a red/skip PR — defers its dependents, exactly like the
 * lane-drain `planWatch` cascade). Orphan PRs (no manifest → item null, blockedBy []) are always ready, so
 * this degrades to the legacy unordered sweep when nothing carries a manifest.
 *
 * @param {Array<{num:number, item:(number|null), blockedBy:number[], decision:'merge'|'skip'}>} candidates
 * @returns {{ready:Array, deferred:Array<{num,item,waitOn:number[]}>}}  ready is ordered (item asc, then PR#).
 */
export function planLabelDrain(candidates) {
  const list = Array.isArray(candidates) ? candidates : [];
  // Every candidate still in play keeps its item "open" — a red/skip blocker must still defer its dependents,
  // so the open set is ALL candidate items, not just the mergeable ones. (A merged item is removed by the
  // caller between passes, which is what frees the dependent.)
  const openItems = new Set(list.map((c) => c.item).filter((x) => x != null).map(Number));
  const ready = [];
  const deferred = [];
  for (const c of list) {
    if (c.decision !== 'merge') continue;
    const waitOn = (Array.isArray(c.blockedBy) ? c.blockedBy : []).map(Number).filter((b) => openItems.has(b));
    if (waitOn.length === 0) ready.push(c);
    else deferred.push({ num: c.num, item: c.item, waitOn });
  }
  ready.sort((a, b) => (Number(a.item ?? Infinity) - Number(b.item ?? Infinity)) || (a.num - b.num));
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

/** Build the comment body for a park/skip reason. Pure. */
export function buildDrainReasonComment(kind, reasonText) {
  const heading = kind === 'park' ? '⏸ **Parked for review by the drain**' : '· **Skipped by the drain**';
  return `${drainReasonMarker(kind)}\n${heading}\n\n${reasonText}`;
}

/**
 * #2333 — should a PARK stamp its escalation reason as a PR comment (#2313)? ONLY for a NON-human
 * (agent-reviewable) park. A `review:human` park already states the SAME reason IN THE PR BODY via #2324's
 * escalation-reason block, so a park comment there would just duplicate it (harmless but redundant). The
 * humanRequired case is surfaced by the body-block alone; this comment path fires for agent-reviewable parks
 * (and genuine skips post their own comment on a separate path). Pure. */
export function shouldPostParkReasonComment({ humanRequired } = {}) {
  return !humanRequired;
}

/** Has this exact (kind, reasonText) already been stamped on the PR? Pure. `comments` is the raw
 *  `gh pr view --json comments` array (tolerant of a missing/odd shape). */
export function hasDrainReasonComment(comments, kind, reasonText) {
  const marker = drainReasonMarker(kind);
  const text = String(reasonText || '');
  return (Array.isArray(comments) ? comments : []).some((c) => {
    const body = String(c?.body || '');
    return body.startsWith(marker) && body.includes(text);
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
 * #2373 — the SHARED net-diff basis for the review-escalation rubric, used by BOTH the producer
 * (`pr-land.mjs`'s `applyReviewEscalationLabel`) and the drain backstop below — the ONE place this basis is
 * computed, so the two paths can't independently drift (#1821 fixed the drain path's basis; #2373 found the
 * producer path still mis-computed it via a bare `git fetch <remote> <base>`, which relies on git's
 * "opportunistic" tracking-ref update and can leave a stale local `<remote>/<base>` even after a
 * "successful" fetch — silently sweeping already-landed upstream commits into the score, e.g. a gate-fix
 * commit another lane merged onto `main` between this lane's claim and its PR-open). Fetching with an
 * EXPLICIT destination refspec (`+<base>:refs/remotes/<remote>/<base>`) force-updates the tracking ref
 * unconditionally, so the subsequent `git diff --numstat <remote>/<base> <rev>` — a NET two-tree comparison,
 * content-only and ancestry-independent, deliberately NOT a three-dot/merge-base diff — always scores off
 * the CURRENT upstream base, never one a concurrently-landed PR has since advanced past.
 *
 * Tries a short fallback chain for `rev` (`rev` itself, then `<remote>/rev`) since a foreign/sibling clone
 * scoring another repo's PR may not have `rev` as a local branch. `rev` is tried FIRST: for the producer path
 * (`rev` is always an already-resolved local SHA) this succeeds immediately; `<remote>/<rev>` covers the
 * sibling-clone case where the head ref was fetched (`fetchExtraRefs` carries it). `FETCH_HEAD` is DELIBERATELY
 * NOT a candidate (#2373-review): the base is listed FIRST in the fetch refspec and `git diff FETCH_HEAD` /
 * `git rev-parse FETCH_HEAD` resolve to that first line, so `FETCH_HEAD` always points at `<remote>/<base>` —
 * a `FETCH_HEAD` diff would therefore be base-vs-base (an EMPTY diff) and "succeed" with `scored:true` and zero
 * changed files, MASKING a real `<remote>/<rev>` miss. Without it, when neither `rev` nor `<remote>/<rev>`
 * resolves the function returns `scored:false` and the caller correctly falls through to its GitHub files-list
 * backstop (the safe, over-scoring direction). `fetchExtraRefs` still fetches the head ref so `<remote>/<rev>`
 * resolves in the normal sibling-clone case — it just never gets offered as a diff candidate via `FETCH_HEAD`.
 * @param {{exec:Function, remote?:string, base?:string, rev:string, fetchExtraRefs?:string[]}} opts
 *   `exec(cmd, args, opts)` — inject `execFileSync`-shaped exec so this stays unit-testable with a fake.
 * @returns {{changedFiles:string[], diffLines:number, scored:boolean}}
 */
export function computeNetDiffChangedFiles({ exec, remote = 'origin', base = 'main', rev, fetchExtraRefs = [] } = {}) {
  if (typeof exec !== 'function' || !rev) return { changedFiles: [], diffLines: 0, scored: false };
  try {
    exec('git', ['fetch', remote, `+${base}:refs/remotes/${remote}/${base}`, ...fetchExtraRefs, '--quiet'], { stdio: ['ignore', 'ignore', 'ignore'] });
  } catch { /* degrade to whatever is locally cached — the diff attempts below still run */ }
  const candidates = [rev, `${remote}/${rev}`];
  for (const candidate of candidates) {
    try {
      const out = exec('git', ['diff', '--numstat', `${remote}/${base}`, candidate], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      return { ...parseNumstat(out), scored: true };
    } catch { /* try next candidate */ }
  }
  return { changedFiles: [], diffLines: 0, scored: false };
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
 * ONLY resyncs when cwd is genuinely DETACHED (an attached branch — e.g. the primary's own possibly-diverged
 * `main` — is left untouched; its existing warn-only behaviour in `runCli` stands), carries no TRACKED local
 * edits (never reset a dirty tree), AND HEAD is already an ANCESTOR of `origin/${base}` (#2348 review) — a
 * lane clone can carry MORE local commits than the one couple this pass just landed (e.g. a session already
 * committed a SECOND item's work in the same clone before pushing it); `git checkout --detach` would
 * silently ORPHAN those unpushed commits (reachable only via reflog) the instant HEAD moves off them.
 * Requiring HEAD to already BE reachable from the real merged tip means the detach is always a true no-op
 * rebase-in-place — never a discard. Mirrors pr-land's runHeal/runRegen dirty-probe + detach pattern
 * (#2225), sharing the same `isPostLandTreeDirty` (single source, never a fork), plus the extra ancestor
 * guard runHeal doesn't need (it always runs against a freshly-pushed, single-purpose lane). `exec` is
 * injectable (default the real `execFileSync`) so this is unit-testable without shelling.
 * @param {{exec:Function, landedLocal:boolean, localSynced:boolean, remote?:string, base?:string}} o
 * @returns {{resynced:boolean, skipped?:string, detail?:string}}
 */
export function resyncDetachedCwdForLand({ exec, landedLocal, localSynced, remote = 'origin', base = 'main' }) {
  if (!landedLocal || localSynced || typeof exec !== 'function') return { resynced: false, skipped: 'not-applicable' };
  let detached = false;
  try { exec('git', ['symbolic-ref', '-q', 'HEAD'], { stdio: ['ignore', 'ignore', 'ignore'] }); }
  catch { detached = true; }
  if (!detached) return { resynced: false, skipped: 'attached' };
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
  // #2216 — before a label-scoped sweep, LABEL any green-but-unlabelled producer PR (a `pr-land --label-on-green`
  // that timed out left it stranded). ON by default for the label-scoped drain (it IS the reconcile point);
  // `--no-reconcile-labels` disables. Under `--watch` this re-labels each interval — the label applies the
  // moment CI goes green, with no human step.
  const RECONCILE = label && !flags['no-reconcile-labels'];
  // #2171 — DETERMINISTIC review-escalation rubric: before merging a ready PR, score it (blast radius, size,
  // dismissed pre-PR findings, cross-repo couple, 1-in-N sampling); an escalated PR PARKS ALIVE (labelled
  // review:pending, SKIPPED — non-blocking, the queue keeps flowing) until a reviewer applies review:accepted.
  // ON by default for a label-scoped drain; `--no-review-escalation` disables. `--sample-nth=N` tunes the floor.
  const REVIEW_ESCALATION = label && !flags['no-review-escalation'];
  const SAMPLE_NTH = Number.isFinite(Number(flags['sample-nth'])) && Number(flags['sample-nth']) > 0 ? Number(flags['sample-nth']) : undefined;
  // #2262 — `--review-window-minutes=N` tunes the park timeout (default from review-escalation.mjs); the park
  // AGE itself is tracked in REVIEW_PARK_STATE_PATH (see import above) so a sampled PR times out to
  // merge-anyway instead of re-parking forever with no reviewer daemon to accept it.
  const REVIEW_WINDOW_MS = Number.isFinite(Number(flags['review-window-minutes'])) && Number(flags['review-window-minutes']) > 0
    ? Number(flags['review-window-minutes']) * 60_000
    : undefined;

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
  const postDrainReasonComment = (repo, num, kind, reasonText) => {
    if (DRY_RUN || !reasonText) return false;
    let comments = [];
    try {
      const data = JSON.parse(execFileSync('gh', ['pr', 'view', String(num), ...repoFlag(repo), '--json', 'comments'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim() || '{}');
      comments = Array.isArray(data.comments) ? data.comments : [];
    } catch { /* best-effort read; fall through and attempt the post anyway */ }
    if (hasDrainReasonComment(comments, kind, reasonText)) return false;
    try { execFileSync('gh', ['pr', 'comment', String(num), ...repoFlag(repo), '--body', buildDrainReasonComment(kind, reasonText)], { stdio: ['ignore', 'ignore', 'pipe'] }); return true; }
    catch { return false; }
  };

  const fail = (reason, detail, code) => {
    if (AS_JSON) process.stdout.write(JSON.stringify({ ok: false, reason, detail }) + '\n');
    else process.stderr.write(`merge-ai-prs ✗ ${reason}: ${detail}\n`);
    process.exit(code);
  };

  // Read a PR's `.lane-manifest.json` off its head ref (#2188). Only a WE PR carries one (the producer writes
  // it into the WE lane commit); an orphan/impl PR has none → { item:null, blockedBy:[] } → always ready (the
  // legacy unordered behaviour). Best-effort: a fetch/parse miss degrades to no-manifest, never throws.
  const readPrManifest = (repo, headRef) => {
    if (!headRef) return null;
    if (!isLocalRepo(repo)) {
      // #2257 — a remote-repo PR has no local clone to `git show`; read the manifest off its head ref via the
      // GitHub API (`gh api …/contents/.lane-manifest.json?ref=<headRef>` → base64 `.content`). Best-effort:
      // an impl/orphan PR carries no manifest → null → always ready (the legacy unordered behaviour).
      try {
        const b64 = execFileSync('gh', ['api', `repos/${repo}/contents/.lane-manifest.json`, '-f', `ref=${headRef}`, '-q', '.content'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
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

  // #2216 — POST-CI LABEL RECONCILE. Before the labelled sweep, label any green-but-unlabelled producer PR that
  // a `pr-land --label-on-green` timeout left stranded. Lists open PRs unfiltered by label, filters to the cheap
  // signals (unlabelled + required check green), confirms producer authorship per-candidate (commits), then adds
  // the label. Best-effort — a gh miss never fails the drain. Returns the labelled PR numbers.
  const reconcileGreenLabels = (repo) => {
    if (!RECONCILE) return [];
    let open;
    try { open = JSON.parse(execFileSync('gh', ['pr', 'list', ...repoFlag(repo), '--state', 'open', '--limit', '100', '--json', 'number,title,labels,statusCheckRollup'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim() || '[]'); }
    catch { return []; } // reconcile is best-effort; the real sweep below still hard-fails on a bad env
    const cheap = open.filter((p) => !hasLabel(p, label) && isRequiredCheckGreen(p, REQUIRED)); // green + unlabelled
    const labelled = [];
    for (const p of cheap) {
      let commits = [];
      try { commits = JSON.parse(execFileSync('gh', ['pr', 'view', String(p.number), ...repoFlag(repo), '--json', 'commits'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim() || '{}').commits || []; } catch { continue; }
      if (!shouldLabelOnGreen({ ...p, commits }, { requiredCheck: REQUIRED, label })) continue;
      if (DRY_RUN) { labelled.push(p.number); if (!AS_JSON) process.stderr.write(`  🏷 ${repoTag(repo)}${p.number} would label "${label}" (required check green, was unlabelled)\n`); continue; }
      try { execFileSync('gh', ['pr', 'edit', String(p.number), ...repoFlag(repo), '--add-label', label], { stdio: ['ignore', 'ignore', 'pipe'] }); labelled.push(p.number); if (!AS_JSON) process.stderr.write(`  🏷 ${repoTag(repo)}${p.number} labelled "${label}" (post-CI reconcile — required check went green after a label-on-green timeout)\n`); }
      catch { /* a label race/permission miss is non-fatal — the next pass retries */ }
    }
    return labelled;
  };

  // ── ONE sweep pass — reconcile labels → list → classify → cascade-merge → sync. Returns the pass result (no
  // emit/exit), so the watch loop can call it repeatedly. A gh-list failure still hard-fails (bad env).
  const sweepOnce = () => {
  // #2257 — collect + classify across EVERY repo in the sweep set into ONE global candidate list. PR numbers
  // are per-repo (WE #10 ≠ FUI #10), so each verdict carries its own `repo` + head ref instead of a
  // number-keyed cross-repo map. The single list is what lets the cascade honour cross-repo `blockedBy`.
  const reconciledLabels = [];
  const verdicts = [];
  for (const repo of REPOS) {
    reconciledLabels.push(...reconcileGreenLabels(repo)); // #2216 — label green-but-unlabelled producer PRs first
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
      v.item = m && m.item != null ? Number(m.item) : null;
      v.blockedBy = m && Array.isArray(m.blockedBy) ? m.blockedBy.map(Number) : [];
      v.hasManifest = m != null; // #2183 — carries the transient manifest on its head → must be stripped before merge
      // #2171 review-escalation signals off the manifest: cross-repo couple (>1 repo) + dismissed pre-PR findings.
      v.crossRepo = m && Array.isArray(m.repos) ? m.repos.length > 1 : false;
      v.dismissedFindings = m && Number.isFinite(Number(m.dismissedFindings)) ? Number(m.dismissedFindings) : 0;
      v.prLabels = p.labels || [];
      verdicts.push(v);
    }
  }
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
      } else if (!AS_JSON) {
        process.stderr.write(`  ↻ ${repoTag(v.repo)}${v.num} left skipped: ${r.reason}\n`);
      }
    }
  }

  // #2366 — CONCURRENT-LANDER BACKSTOP. The bare `/merge` orphan sweep never runs the `REVIEW_ESCALATION` pass
  // below (that pass is `--label`-gated), so without this it would happily merge a PR a label-scoped `/drain`
  // pass already parked under `review:pending`/`review:human`, or bounced under `review:changes` — the race
  // that shipped plateau#11 and web-everything#290 before their review panels' verdicts landed. Only fires when
  // this pass ISN'T already running the full rubric (`decideReviewGate` re-derives the correct verdict itself,
  // incl. the merge-anyway timeout override — double-gating here would wrongly strand a timed-out PR forever).
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
    // #2262 fix (2/2) — a deterministically-sampled PR (1-in-N floor, keyed on PR number) re-scores `escalate`
    // on EVERY pass; with no reviewer daemon to apply `review:accepted`, it must not park forever. Read the
    // durable park-age clock (review-park-state.mjs) so `decideReviewGate`'s already-tested timeout branch can
    // actually fire: once a PR has sat parked (no verdict) past the window, it merges anyway rather than being
    // permanently stranded. Best-effort, tolerant read — a missing/corrupt file just starts every PR's clock now.
    let parkState = emptyParkState();
    try { parkState = parseParkState(readFileSync(REVIEW_PARK_STATE_PATH, 'utf8')); } catch { /* no file yet — fresh clocks */ }
    const nowMs = Date.now();
    let parkStateChanged = false;
    for (const v of verdicts) {
      if (v.decision !== 'merge') continue;
      let changedFiles = [];
      let diffLines = 0;
      // #2373 — score off the SHARED net-diff basis (`computeNetDiffChangedFiles`, also used by the
      // producer path in pr-land.mjs — the ONE place this basis is computed, #1821's original fix folded
      // in). Best-effort local git read (needs the local clone or a provisioned sibling clone); falls back
      // to the old GitHub files-list read if neither is available.
      const escCwd = isLocalRepo(v.repo) ? undefined : siblingCloneDir(v.repo);
      let netScored = false;
      if (v.headRef && (isLocalRepo(v.repo) || escCwd)) {
        const exec = (cmd, args, opts) => execFileSync(cmd, args, { cwd: escCwd, ...opts });
        const net = computeNetDiffChangedFiles({ exec, rev: v.headRef, fetchExtraRefs: [v.headRef] });
        changedFiles = net.changedFiles;
        diffLines = net.diffLines;
        netScored = net.scored;
      }
      if (!netScored) {
        try {
          const files = JSON.parse(execFileSync('gh', ['pr', 'view', String(v.num), ...repoFlag(v.repo), '--json', 'files'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim() || '{}').files || [];
          changedFiles = files.map((f) => f.path).filter(Boolean);
          diffLines = files.reduce((s, f) => s + (Number(f.additions) || 0) + (Number(f.deletions) || 0), 0);
        } catch { /* signal-fetch miss → score on the manifest signals alone */ }
      }
      const score = scoreEscalation({ changedFiles, diffLines, dismissedFindings: v.dismissedFindings, crossRepo: v.crossRepo, prNum: Number(v.num), thresholds: SAMPLE_NTH ? { sampleNth: SAMPLE_NTH } : {} });
      const parkedSinceMs = getParkedSinceMs(parkState, { repo: v.repo, num: v.num });
      const gate = decideReviewGate({ escalate: score.escalate, humanRequired: score.humanRequired, labels: v.prLabels, parkedSinceMs, nowMs, ...(REVIEW_WINDOW_MS ? { windowMs: REVIEW_WINDOW_MS } : {}) });
      v.escalated = score.escalate ? 'yes' : 'no';
      // #2365 — gate.humanRequired (not score.humanRequired): decideReviewGate's verdict is the sticky one (#2362
      // makes an already-applied review:human label win even when a rebase narrows the diff back to
      // humanRequired:false); the drain caller must report THAT verdict, never the fresh-diff score alone, or a
      // label-only human park gets reported as agent-reviewable and an agent panel can clear its own gate change.
      v.humanRequired = !!gate.humanRequired; // #2285 v1 — gate-self conflict of interest: an agent may NOT auto-review this; a human must
      v.escalateReasons = score.reasons;
      if (gate.action === 'park' || gate.action === 'wait-author') {
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
            const posted = postDrainReasonComment(v.repo, v.num, 'park', v.reason);
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
        // #2262 — track the park age so the watch-window can time out; a review:changes verdict ends the clock.
        if (gate.action === 'park') { if (!DRY_RUN) { parkState = recordParked(parkState, { repo: v.repo, num: v.num }, nowMs); parkStateChanged = true; } }
        else if (!DRY_RUN) { const cleared = clearParked(parkState, { repo: v.repo, num: v.num }); if (cleared !== parkState) { parkState = cleared; parkStateChanged = true; } }
        // #2285 v1 — the skill's auto-review step consumes this: humanRequired PRs are left for the operator,
        // the rest are eligible for a fresh-context adversarial review subagent.
        parked.push({ num: v.num, repo: v.repo || localSlug, humanRequired: !!gate.humanRequired, reasons: score.reasons });
        if (!AS_JSON) process.stderr.write(`  ⏸ ${repoTag(v.repo)}${v.num} parked for review (${gate.action}${gate.applyLabel ? `, labelled ${gate.applyLabel}` : ''}${gate.humanRequired ? ', HUMAN required' : ', agent-reviewable'}): ${score.reasons.join('; ')}\n`);
      } else if (gate.action === 'merge-anyway') {
        // #2262 — the review window expired with no reviewer verdict: merge NOW (decision stays 'merge', its
        // default) rather than re-park forever, but never SILENTLY drop the owed review — auto-file it as a
        // durable PR comment (best-effort) so the obligation stays visible after the PR closes.
        v.escalated = 'yes';
        v.escalateReasons = score.reasons;
        v.reviewTimedOut = true;
        if (!DRY_RUN) {
          const cleared = clearParked(parkState, { repo: v.repo, num: v.num });
          if (cleared !== parkState) { parkState = cleared; parkStateChanged = true; }
          // Note: this comment fires BEFORE the merge attempt below (same pass) — the merge can still bounce
          // (e.g. a check regressed since scoring) and retry next pass, so the wording describes the DECISION
          // (proceeding to merge), not a confirmed outcome.
          try { execFileSync('gh', ['pr', 'comment', String(v.num), ...repoFlag(v.repo), '--body', `⏱ review-escalation window expired with no reviewer verdict — proceeding to merge per the #2171 rubric (never permanently stranding an escalated PR). The review is still owed: ${score.reasons.join('; ')}.`], { stdio: ['ignore', 'ignore', 'pipe'] }); } catch { /* auto-file best-effort */ }
        }
        if (!AS_JSON) process.stderr.write(`  ⏱ ${repoTag(v.repo)}${v.num} review window expired — merging anyway (unfinished review auto-filed): ${score.reasons.join('; ')}\n`);
      } else if (score.escalate && !AS_JSON) {
        process.stderr.write(`  ✓ ${repoTag(v.repo)}${v.num} escalation cleared (${gate.reason})\n`);
      }
    }
    if (parkStateChanged && !DRY_RUN) { try { writeFileSync(REVIEW_PARK_STATE_PATH, serializeParkState(parkState)); } catch { /* best-effort local cache — a write miss just re-parks fresh next pass */ } }
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
      const posted = postDrainReasonComment(v.repo, v.num, 'skip', v.reason);
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
    // Report the planned first-pass order (blockedBy-honoured) without merging.
    const plan = planLabelDrain(verdicts);
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
      const plan = planLabelDrain(remaining);
      deferred = plan.deferred;
      if (!plan.ready.length) break;
      let progressed = false;
      for (const c of plan.ready) {
        try {
          // #2290 — the drain is the SOLE writer to main: the one `gh pr merge` now routes through the shared
          // gate (caller 'drain' — the only caller the gate permits). Behaviour is identical to the prior
          // inline call (`gh pr merge <n> [--repo …] --merge --delete-branch`, throw on a non-zero gh exit).
          mergePr({ pr: c.num, repo: c.repo, method: 'merge', caller: 'drain' });
          merged.push({ num: c.num, repo: c.repo }); progressed = true;
          remaining = remaining.filter((x) => !sameCand(x, c)); // merged → item leaves the open set (frees dependents)
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

  // #2348 — a LANE CLONE's `/pr` fast drain runs THIS process with a DETACHED HEAD (the #2183 clone model),
  // so the branch-pull above always errors there and left the JIT-numbering + derived-regen steps below
  // operating on a stale, lineage-disconnected tree (see `resyncDetachedCwdForLand`'s doc for the full story
  // — this is how #2347 stranded a hash on main). Best-effort, non-fatal — a skip/failure is reported and
  // the numbering/regen steps below simply see whatever tree cwd already has (their existing best-effort
  // contract, unchanged).
  const detachedResync = resyncDetachedCwdForLand({ exec: execFileSync, landedLocal, localSynced });
  if (detachedResync.resynced) {
    localSynced = true;
    if (!AS_JSON) process.stderr.write(`  ✓ detached cwd resynced to origin/main for JIT numbering + derived regen (#2348)\n`);
  } else if (detachedResync.skipped === 'exec-failed' && !AS_JSON) {
    process.stderr.write(`  ⚠ could not resync detached cwd to origin/main (${detachedResync.detail}) — JIT numbering/derived regen below may see a stale tree\n`);
  } else if (detachedResync.skipped === 'dirty' && !AS_JSON) {
    process.stderr.write(`  ⚠ detached cwd has TRACKED local changes — skipped the resync (won't reset a dirty tree); JIT numbering/derived regen below may see a stale tree\n`);
  } else if (detachedResync.skipped === 'unpublished-commits' && !AS_JSON) {
    process.stderr.write(`  ⚠ detached cwd's HEAD carries commit(s) not yet on origin/main — skipped the resync (won't orphan unpushed work); JIT numbering/derived regen below may see a stale tree\n`);
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
    numbered = numberPendingHashes(process.cwd());
    if (numbered.committed) {
      try {
        execFileSync('git', ['push', 'origin', 'HEAD:main'], { env: { ...process.env, MAIN_PUSH_OK: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
        if (!AS_JSON) process.stderr.write(`  ✓ JIT-numbered ${numbered.assigned.map((a) => `${a.hash}→#${a.nnn}`).join(', ')} + pushed to main (#2288)\n`);
      } catch (e) {
        if (!AS_JSON) process.stderr.write(`  ⚠ JIT numbering committed locally but push FAILED (${String(e.message || e).split('\n')[0]}) — push main by hand\n`);
      }
    }
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
