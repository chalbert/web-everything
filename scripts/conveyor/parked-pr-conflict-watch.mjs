#!/usr/bin/env node
/**
 * @file scripts/conveyor/parked-pr-conflict-watch.mjs
 * @description The PARKED-PR CONFLICT WATCH (`#xw0odtv`) — a standing, mechanical pass that catches an open,
 *   review-parked PR (`review:human` / `review:pending` / an uncleared `review:changes`) drifting into a REAL
 *   merge conflict against `main` while nobody is actively looking at it, and makes that impossible to miss.
 *
 * WHY THIS EXISTS. Live incident, WE PR #1920: opened parked under `review:human` (a gate-self/statute edit —
 * the conflict-of-interest label), `main` advanced 16 merge commits including one other #2412 sub-slice
 * touching the SAME file, and the PR silently went `mergeable: CONFLICTING` / `mergeStateStatus: DIRTY`. The
 * operator discovered it only by chance, about to clear the `review:human` gate. Traced every existing sweep
 * that reads `mergeable`: `we:scripts/merge-ai-prs.mjs`'s `classifyPr` computes it but a `skip` verdict for a
 * non-rebase-drop-eligible PR is silently discarded (`continue`, no comment, no label);
 * `we:scripts/conveyor/pr-watch.mjs`'s `EXIT_PARKED` is a ONE-SHOT poll that exits the instant a PR first parks
 * and never resumes; `we:scripts/conveyor/branch-drift.mjs` (#3464) watches exactly one named long-lived
 * branch, not the population of open PRs; `#2824` (`we:backlog/2824-launch-agnostic-freshness-gate-any-open-pr-
 * behind-main.md`, still `status: open`) is the closest prior art but is deliberately scoped to
 * `mergeStateStatus === 'BEHIND'` ONLY — its own design explicitly excludes `CONFLICTING`/`DIRTY` ("a
 * real-conflict case… stays left to `/finish`"). Nothing anywhere watches THIS axis. See `#xw0odtv`'s own card
 * for the full reconstruction (merge-base, the overlapping #1911 commit, the backlog search ruling out a
 * duplicate).
 *
 * ALERT-ONLY BY DESIGN — NO AUTO-REBASE. A real content conflict has no single mechanically correct resolution
 * (unlike #2824's clean-rebase BEHIND case): resolving it means choosing which side's edit wins in the
 * overlapping region, exactly the judgment #2824's own design already refuses to automate for this same
 * CONFLICTING/DIRTY case ("left as a skip, logged, no escalation to an agent"). Doing so on a PR that is
 * furthermore explicitly parked for review (nobody has signed off on its content yet) would rewrite it out from
 * under an in-flight human review — the same footgun `#3350`'s own invariant names for the CI-restart case, one
 * level up. This pass's job is the one mechanically-safe half: surface the drift, every tick, so a human/`/finish`
 * picks it up — never resolve it.
 *
 * PURE-CORE / IO-SHELL SPLIT (mirrors `we:scripts/conveyor/branch-drift.mjs` and
 * `we:scripts/conveyor/review-status-tag.mjs`):
 *   • {@link isParkedConflictTarget} and {@link planConflictLabelChange} are PURE — no fs/git/gh/clock.
 *   • The IO shell ({@link defaultListParkedPrs}, {@link watchParkedPrConflicts}, the CLI) owns every `gh` call,
 *     via `we:scripts/lib/review-label-provider.mjs`'s already-tested, injectable provider port — no new
 *     `execFileSync('gh', …)` call site is hand-rolled here.
 *
 * IDEMPOTENCY, NO SEPARATE STORE. The `merge-status:conflicting` label's own presence/absence on the PR IS the
 * durable marker (mirrors `we:scripts/conveyor/review-status-tag.mjs`'s own "the label is the state" contract):
 * a comment is posted only on the transition from absent→present, never repeated while the label already sits
 * on the PR, and the label is removed (self-healing, no comment) the tick the conflict clears — no git note, no
 * `.claude/locks` entry, no new JSON store (per the #2612 "no parallel state store" ruling).
 *
 * THE CADENCE. Wired into `we:skills-src/conveyor/runner.mjs`'s `makeCliMechanicalPasses`, beside the
 * `we:scripts/conveyor/branch-drift.mjs sweep` line — the SAME "piggyback on a pass the headless runner already
 * ticks" shape #3464 used, so a parked PR's conflict state is checked every tick with no new cron/daemon.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

import { createGhProvider } from '../lib/review-label-provider.mjs';
import { hasUnclearedReviewLabel } from '../lib/review-escalation.mjs';
import { writeAllSync, writeLineSync } from '../lib/write-all-sync.mjs';

/** The informative, auto-managed label this pass owns exclusively — nothing else applies or reads it. */
export const CONFLICT_LABEL = 'merge-status:conflicting';

/** Provisioning metadata, mirrors `we:scripts/conveyor/review-status-tag.mjs`'s own `ensureLabel` call shape. */
export const CONFLICT_LABEL_META = Object.freeze({
  color: 'B60205', // same red as `review:human` — this is also a "something needs a human" signal
  description: 'informative: this parked PR has drifted into a real merge conflict against main — needs a human/agent rebase or resolve before it can land (auto-managed, #xw0odtv)',
});

/** How many open PRs one `gh pr list` call reads per repo — generous relative to any repo's live parked count. */
export const PR_LIST_LIMIT = 200;

// ── PURE CORE (no fs / git / gh / clock — every input is injected) ─────────────────────────────────────────

/**
 * Is this open PR a PARKED-CONFLICT target — a REAL merge conflict (`mergeable === 'CONFLICTING'`) sitting on a
 * PR that is ALSO parked for review (an uncleared `review:human` / `review:pending` / `review:changes` hold)?
 * PURE. Reuses the SAME canonical hold predicate `classifyPr` / `#2824`'s own `isFreshnessRefreshTarget` use
 * (`hasUnclearedReviewLabel`, `we:scripts/lib/review-escalation.mjs`), not a re-declared local check.
 *
 * Deliberately narrower than `we:scripts/merge-ai-prs.mjs#isRebaseDropCandidate`, which also fires on BEHIND/
 * DIRTY for a CERTIFIED+green PR queued to merge — that is a different population (queued, mechanically
 * healable) from this one (parked for human judgment, a real content conflict). `allowPending: false` so a
 * plain `review:pending` park counts too, not just `review:human` — matching the task's own framing of "a
 * slow human/review step", not only the conflict-of-interest gate.
 * @param {{mergeable?:string, labels?:Array}} pr
 * @returns {boolean}
 */
export function isParkedConflictTarget(pr) {
  const mergeable = String(pr?.mergeable || '').toUpperCase();
  if (mergeable !== 'CONFLICTING') return false;
  return hasUnclearedReviewLabel(pr?.labels, { allowPending: false });
}

/**
 * PURE: what to add/remove so `currentLabels` shows the `merge-status:conflicting` label iff `isConflicting`,
 * and whether THIS call is the first time it's being added (the one moment a comment is owed). Mirrors
 * `we:scripts/conveyor/review-status-tag.mjs#planStatusLabelChange`'s add/remove shape.
 * @param {{isConflicting:boolean, currentLabels?:Array<{name?:string}|string>}} o
 * @returns {{add:string|null, remove:string[], newlyDetected:boolean}}
 */
export function planConflictLabelChange({ isConflicting, currentLabels = [] } = {}) {
  const names = currentLabels.map((l) => (typeof l === 'string' ? l : l?.name)).filter(Boolean);
  const already = names.includes(CONFLICT_LABEL);
  if (isConflicting && !already) return { add: CONFLICT_LABEL, remove: [], newlyDetected: true };
  if (!isConflicting && already) return { add: null, remove: [CONFLICT_LABEL], newlyDetected: false };
  return { add: null, remove: [], newlyDetected: false };
}

/**
 * The one-time alert comment posted on the transition to `newlyDetected`. PURE (a string builder — the actual
 * `gh pr comment` write is the IO shell's job).
 * @param {{num:number|string, headRefName?:string}} pr
 * @returns {string}
 */
export function buildConflictComment(pr) {
  const ref = pr?.headRefName ? ` (\`${pr.headRefName}\`)` : '';
  return [
    '⚠️ **This parked PR has drifted into a real merge conflict against `main`**',
    '',
    `GitHub reports \`mergeable: CONFLICTING\` on this PR${ref} while it is parked for review — it will not ` +
      'resolve on its own. One or more PRs merged to `main` since this one opened touched overlapping content.',
    '',
    'Left as a **judgment call for a human or `/finish`**, not auto-rebased: resolving a real content conflict ' +
      'means choosing which side\'s edit wins in the overlapping region, and rewriting a review-parked PR\'s ' +
      'content before it has been reviewed is unsafe.',
    '',
    '_Auto-detected by the parked-PR conflict watch (`we:scripts/conveyor/parked-pr-conflict-watch.mjs`, `#xw0odtv`). ' +
      `This will self-clear (the \`${CONFLICT_LABEL}\` label is removed, no further comment) once the conflict resolves._`,
  ].join('\n');
}

// ── IO SHELL (gh only past this point — the CLI, gated on the main-module check) ───────────────────────────

/**
 * The open-PR discovery query. `exec` is injectable so the argv is assertable with no `gh` on PATH. Narrower
 * `--json` than `we:scripts/merge-ai-prs.mjs`'s main listing — this pass never classifies for merge, so it
 * needs no `body`/`statusCheckRollup`.
 * @param {{exec?:Function, repo?:string|null}} [o]
 * @returns {Array<object>}
 */
export function defaultListParkedPrs({ exec = execFileSync, repo = null } = {}) {
  const argv = ['pr', 'list', '--state', 'open', '--limit', String(PR_LIST_LIMIT),
    '--json', 'number,headRefName,mergeable,mergeStateStatus,labels'];
  if (repo) argv.push('--repo', repo);
  const out = exec('gh', argv, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
  const parsed = JSON.parse(String(out || '[]'));
  return Array.isArray(parsed) ? parsed : [];
}

/**
 * THE IO SHELL. Lists open PRs, classifies each, applies the label change + posts the one-time comment when a
 * PR newly transitions into conflict, and reports what happened. Never throws on a per-PR write failure — one
 * bad `gh` call must not stop the sweep from checking the rest (mirrors this file's siblings' best-effort
 * contract); the failure is reported in the per-PR result instead.
 * @param {{repo?:string|null, listPrs?:Function, provider?:object, dryRun?:boolean}} [o]
 * @returns {Array<{num:number, isConflicting:boolean, add:string|null, remove:string[], newlyDetected:boolean, commented:boolean, error?:string}>}
 */
export function watchParkedPrConflicts({ repo = null, listPrs = defaultListParkedPrs, provider = createGhProvider(), dryRun = false } = {}) {
  const prs = listPrs({ repo });
  const results = [];
  for (const pr of Array.isArray(prs) ? prs : []) {
    const isConflicting = isParkedConflictTarget(pr);
    const plan = planConflictLabelChange({ isConflicting, currentLabels: pr?.labels });
    if (!plan.add && plan.remove.length === 0) continue;
    const entry = { num: pr?.number, isConflicting, ...plan, commented: false };
    if (dryRun) { results.push(entry); continue; }
    try {
      if (plan.add) provider.ensureLabel(repo, CONFLICT_LABEL, CONFLICT_LABEL_META);
      provider.setLabels(repo, pr?.number, { add: plan.add ?? undefined, remove: plan.remove });
      if (plan.newlyDetected) {
        provider.postComment(repo, pr?.number, buildConflictComment(pr));
        entry.commented = true;
      }
    } catch (e) {
      entry.error = String((e && e.message) || e).split('\n')[0];
    }
    results.push(entry);
  }
  return results;
}

const IS_CLI = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (IS_CLI) {
  const argv = process.argv.slice(2);
  const flag = (name) => (argv.find((a) => a.startsWith(`--${name}=`)) || '').slice(name.length + 3) || undefined;
  const verb = argv.find((a) => !a.startsWith('--')) || 'sweep';
  const repo = flag('repo') || null;
  const dryRun = argv.includes('--dry-run');
  if (verb !== 'sweep') {
    writeLineSync(2, `usage: parked-pr-conflict-watch.mjs sweep [--repo=<owner/name>] [--dry-run]`);
    process.exitCode = 2;
  } else {
    try {
      const results = watchParkedPrConflicts({ repo, dryRun });
      for (const r of results) {
        const verb2 = dryRun ? 'would' : r.error ? 'FAILED to' : 'did';
        const what = r.add ? `apply ${CONFLICT_LABEL}${r.commented ? ' + comment' : ''}` : `remove ${r.remove.join(',')}`;
        writeLineSync(2, `  ⚠ PR #${r.num}: ${verb2} ${what}${r.error ? ` (${r.error})` : ''}`);
      }
      writeAllSync(1, `${JSON.stringify({ checked: true, changed: results.length, results })}\n`);
    } catch (e) {
      writeLineSync(2, `error: ${String(e?.message ?? e)}`);
      process.exitCode = 1;
    }
  }
}
