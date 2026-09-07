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
 * ALERT-ONLY WAS THE ORIGINAL DESIGN; `#xu2krte` (ratified 2026-09-06,
 * `docs/agent/platform-decisions.md#parked-pr-conflict-dispatched-not-scripted`) NARROWED THAT, NOT REVERSED IT.
 * A real content conflict has no single mechanically-correct resolution for a deterministic SCRIPT: resolving it
 * means choosing which side's edit wins in the overlapping region, exactly the judgment #2824's own design
 * already refuses to automate for this same CONFLICTING/DIRTY case. That reasoning does not extend to
 * dispatching a real AGENT at the same conflict, though — the agent's output still lands through the identical
 * independent-review gate this file's own alert protects (`review:human`/`review:pending`/`review:changes` is
 * never touched by a fix agent, conflict or otherwise). So on a FRESH conflict this pass now does TWO things,
 * not one: it still applies the informative label + one-time alert (below, unchanged), AND it hands the PR to
 * the SAME bounce+fix-dispatch pipeline `we:scripts/conveyor/reconcile-fix-dispatch.mjs` already runs for an
 * ordinary reviewer finding — via `we:scripts/conveyor/reconcile-finding.mjs` ({@link postConflictFinding}) —
 * UNLESS the conflict sits in a declarative-leash/statute-tier file ({@link isStatuteTierConflict}), in which
 * case it routes straight to a human via `we:scripts/conveyor/stand-down.mjs --reason=conflict`
 * ({@link postConflictStandDown}) with no dispatch attempt at all. This file itself still never resolves a
 * conflict or writes a fix — it only decides which of the two existing downstream pipelines a fresh conflict
 * reaches.
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
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

import { createGhProvider } from '../lib/review-label-provider.mjs';
import { hasUnclearedReviewLabel, isDeclarativeLeashPath, isStatutePath } from '../lib/review-escalation.mjs';
import { writeAllSync, writeLineSync } from '../lib/write-all-sync.mjs';
import { REPO_ROOT } from '../operations/dispatch-lane-io.mjs';

/** The informative, auto-managed label this pass owns exclusively — nothing else applies or reads it. */
export const CONFLICT_LABEL = 'merge-status:conflicting';

/** Provisioning metadata, mirrors `we:scripts/conveyor/review-status-tag.mjs`'s own `ensureLabel` call shape.
 *  `description` MUST stay at or under GitHub's 100-char label-description cap — the original 163-char text
 *  made every `gh label create` call fail `HTTP 422: description is too long`, confirmed live 2026-09-05
 *  re-verifying the xoh8fkw repo-resolution fix against real PR #1932: the repo resolved correctly, then THIS
 *  hit, so the label was still never actually applied. */
export const CONFLICT_LABEL_META = Object.freeze({
  color: 'B60205', // same red as `review:human` — this is also a "something needs a human" signal
  description: 'auto-managed: this review-parked PR has drifted into a real merge conflict — see #xw0odtv',
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
export function buildConflictComment(pr, { isStatuteTier = false } = {}) {
  const ref = pr?.headRefName ? ` (\`${pr.headRefName}\`)` : '';
  const nextStep = isStatuteTier
    ? 'Left as a **judgment call for a human or `/finish`**, not auto-resolved: the conflicting hunk touches a ' +
      "declarative-leash/statute-tier file, so choosing which side's edit wins is drafting principle content, " +
      'not ordinary code — exactly the judgment this repo reserves for a person (`#xu2krte` Fork 2).'
    : 'A fix agent is being dispatched to resolve it (`#xu2krte`) — the SAME independent-review gate this PR ' +
      'is already parked behind still applies before anything lands; nobody is rewriting this content ' +
      'unreviewed. If it cannot be resolved safely, it stands down to a human instead of guessing.';
  return [
    '⚠️ **This parked PR has drifted into a real merge conflict against `main`**',
    '',
    `GitHub reports \`mergeable: CONFLICTING\` on this PR${ref} while it is parked for review — it will not ` +
      'resolve on its own. One or more PRs merged to `main` since this one opened touched overlapping content.',
    '',
    nextStep,
    '',
    '_Auto-detected by the parked-PR conflict watch (`we:scripts/conveyor/parked-pr-conflict-watch.mjs`, `#xw0odtv`). ' +
      `This will self-clear (the \`${CONFLICT_LABEL}\` label is removed, no further comment) once the conflict resolves._`,
  ].join('\n');
}

/**
 * we:scripts/conveyor/parked-pr-conflict-watch.mjs#isStatuteTierConflict — Fork 2's (`#xu2krte`) content-based
 * exception: does ANY file this PR touches sit in the declarative-leash or statute tier
 * (`we:scripts/lib/review-escalation.mjs#isDeclarativeLeashPath` / `#isStatutePath` — the SAME predicates
 * `deriveCareLevel`'s own `humanRequired` derivation keys on)? PURE.
 *
 * A CONSERVATIVE, SAFE-DIRECTIONED APPROXIMATION of "the CONFLICTING hunk itself". Isolating the exact
 * overlapping region would need a real three-way merge of the PR's head against `main` (fetching a ref this
 * pass does not otherwise fetch, then a `git merge-tree`) — this reads the PR's WHOLE changed-file set instead
 * (`gh pr list --json files`, a plain `gh` read, no fetch/clone needed). That can occasionally route a PR to a
 * human over a leash/statute file present in the diff but not actually part of the conflicting region — the
 * OVER-cautious direction, never the unsafe one, and it never blocks the PR from a normal review; it only
 * withholds the agent-dispatch shortcut for THIS conflict.
 *
 * CALLER OWES A COMPLETE LIST — see `#xgfzlj1`. `gh pr list --json ...,files` resolves `files` over `gh`'s own
 * GraphQL query, which hardcodes `files(first: 100)` with no pagination (confirmed live against `gh` 2.95.0 /
 * `cli/cli@trunk`'s `api/query_builder.go`, and tracked upstream as a bug, not a documented cap — cli/cli
 * discussion #6930 / issue #5368). A PR touching ≥100 files gets a SILENTLY truncated `files` array with no
 * error — this function has no way to tell "100 files, complete" from "100 files, truncated" from the array
 * alone, so the caller ({@link watchParkedPrConflicts}) is the one that must re-fetch a verified-complete list
 * (`defaultListPrFiles`, paginated `gh api .../pulls/{n}/files`) before trusting a ≥100-length array here.
 * @param {Array<{path?:string}|string>} files - a COMPLETE changed-file list (verified, not gh's capped one).
 * @returns {boolean}
 */
export function isStatuteTierConflict(files) {
  return (Array.isArray(files) ? files : [])
    .map((f) => (typeof f === 'string' ? f : f?.path))
    .filter(Boolean)
    .some((p) => isDeclarativeLeashPath(p) || isStatutePath(p));
}

/**
 * we:scripts/conveyor/parked-pr-conflict-watch.mjs#GH_FILES_GRAPHQL_CAP — `#xgfzlj1`. The exact, confirmed
 * hard cap `gh`'s own `files(first: 100)` GraphQL query imposes on `--json files` (`gh pr list`/`gh pr view`),
 * with NO pagination and NO truncation signal — a PR with exactly this many or more changed files returns an
 * array capped at this length regardless of the real count. A returned `files` array whose length is `<` this
 * cap is therefore PROVABLY complete (gh would have returned every file); a length `>=` this cap is
 * INDISTINGUISHABLE from truncation and must not be trusted for a safety decision.
 */
export const GH_FILES_GRAPHQL_CAP = 100;

/**
 * we:scripts/conveyor/parked-pr-conflict-watch.mjs#defaultListPrFiles — `#xgfzlj1`'s verified-complete fallback:
 * a FULLY PAGINATED read of the REST `pulls/{number}/files` endpoint (`gh api ... --paginate`), which follows
 * every page via the response `Link` header rather than `gh`'s own single-shot, 100-capped GraphQL `files`
 * field. Only called when {@link watchParkedPrConflicts} suspects the cheap `gh pr list --json files` read may
 * be truncated (its length hit {@link GH_FILES_GRAPHQL_CAP}) — the common small-PR tick never pays for it.
 * @param {{number:number|string, repo?:string|null, exec?:Function}} o
 * @returns {string[]} every changed file's path, real pagination applied — no cap.
 */
export function defaultListPrFiles({ number, repo, exec = execFileSync }) {
  const path = repo ? `repos/${repo}/pulls/${number}/files` : `repos/{owner}/{repo}/pulls/${number}/files`;
  const argv = ['api', '--paginate', '-F', 'per_page=100', path, '--jq', '.[].filename'];
  const out = exec('gh', argv, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
  return String(out || '').split('\n').map((s) => s.trim()).filter(Boolean);
}

/**
 * we:scripts/conveyor/parked-pr-conflict-watch.mjs#buildConflictFindingBody — the write-up handed to
 * `we:scripts/conveyor/reconcile-finding.mjs --body-file=` for a DISPATCHABLE (non-statute-tier) fresh
 * conflict (Fork 4). PURE.
 *
 * Says plainly what an ordinary reconcile-finding does not have to: there is no separate reviewer comment to
 * read here — resolving the conflict IS the whole task this bounce exists for.
 * @param {{num:number|string, headRefName?:string}} pr
 * @returns {string}
 */
export function buildConflictFindingBody(pr) {
  const ref = pr?.headRefName ? ` (\`${pr.headRefName}\`)` : '';
  return [
    `PR #${pr?.num ?? pr?.number ?? '?'}${ref} has drifted into a real GIT merge conflict against \`main\` — ` +
      "GitHub reports `mergeable: CONFLICTING`. This is the WHOLE finding; there is no separate reviewer comment " +
      'to read on this PR for it.',
    '',
    '**Resolving the conflict IS the task.** Rebase or merge `main` into this branch, resolve every conflicted ' +
      "hunk by reading BOTH sides' intent (this diff's own and whatever landed on `main` since), push the " +
      'resolution, and let the normal fix-agent flow (this bounce) carry it back to independent review.',
    '',
    '_Auto-detected by the parked-PR conflict watch (`we:scripts/conveyor/parked-pr-conflict-watch.mjs`, ' +
      '`#xw0odtv`), dispatched per `#xu2krte`._',
  ].join('\n');
}

// ── IO SHELL (gh only past this point — the CLI, gated on the main-module check) ───────────────────────────

/**
 * The open-PR discovery query. `exec` is injectable so the argv is assertable with no `gh` on PATH. Narrower
 * `--json` than `we:scripts/merge-ai-prs.mjs`'s main listing — this pass never classifies for merge, so it
 * needs no `body`/`statusCheckRollup`. `files` was added by `#xu2krte` — {@link isStatuteTierConflict} reads
 * it to decide whether a fresh conflict is dispatchable at all; it costs nothing on the common no-conflict tick
 * since it is read off the same `gh pr list` call this pass already makes.
 * @param {{exec?:Function, repo?:string|null}} [o]
 * @returns {Array<object>}
 */
export function defaultListParkedPrs({ exec = execFileSync, repo = null } = {}) {
  const argv = ['pr', 'list', '--state', 'open', '--limit', String(PR_LIST_LIMIT),
    '--json', 'number,headRefName,mergeable,mergeStateStatus,labels,files'];
  if (repo) argv.push('--repo', repo);
  const out = exec('gh', argv, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
  const parsed = JSON.parse(String(out || '[]'));
  return Array.isArray(parsed) ? parsed : [];
}

/**
 * we:scripts/conveyor/parked-pr-conflict-watch.mjs#defaultPostConflictFinding — Fork 4's dispatch entry point:
 * shell `we:scripts/conveyor/reconcile-finding.mjs` (a real subprocess, NOT an in-process call — that file's
 * own CLI harness calls `process.exit(0)` on success, which would kill this pass's own tick if invoked
 * in-process) to post the fresh conflict as a `review:changes` bounce. The body is written to an allowed temp
 * path (`we:scripts/review-set-label.mjs#bodyFileRoots`) and removed afterward either way.
 * @param {{pr:object, repo:string|null, exec?:Function}} o
 */
export function defaultPostConflictFinding({ pr, repo, exec = execFileSync }) {
  const bodyPath = join(tmpdir(), `reconcile-finding-conflict-${pr?.number}-${randomUUID()}.md`);
  writeFileSync(bodyPath, buildConflictFindingBody({ num: pr?.number, headRefName: pr?.headRefName }), 'utf8');
  try {
    const argv = [
      join(REPO_ROOT, 'scripts', 'conveyor', 'reconcile-finding.mjs'), String(pr?.number),
      `--body-file=${bodyPath}`, '--agent=parked-pr-conflict-watch', '--channel=the parked-PR conflict watch (#xw0odtv, dispatched per #xu2krte)',
    ];
    if (repo) argv.push(`--repo=${repo}`);
    exec('node', argv, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 8 * 1024 * 1024 });
  } finally {
    try { unlinkSync(bodyPath); } catch { /* best-effort cleanup only */ }
  }
}

/**
 * we:scripts/conveyor/parked-pr-conflict-watch.mjs#defaultPostConflictStandDown — Fork 2's exception path: a
 * fresh conflict touching a declarative-leash/statute file routes straight here instead of
 * {@link defaultPostConflictFinding}. Shells `we:scripts/conveyor/stand-down.mjs --reason=conflict`, which posts
 * the durable `STAND_DOWN_MARKER` comment `we:scripts/conveyor/reconcile-core.mjs`'s `stood-down` refusal reads
 * FIRST, before phase/findings are even examined — so this PR is refused a fix dispatch no matter what review
 * label it carries, until a human clears the marker.
 * @param {{pr:object, repo:string|null, exec?:Function}} o
 */
export function defaultPostConflictStandDown({ pr, repo, exec = execFileSync }) {
  const argv = [join(REPO_ROOT, 'scripts', 'conveyor', 'stand-down.mjs'), String(pr?.number),
    '--reason=conflict', '--actor=parked-pr-conflict-watch (#xu2krte statute-tier exception)'];
  if (repo) argv.push(`--repo=${repo}`);
  exec('node', argv, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 8 * 1024 * 1024 });
}

/**
 * THE IO SHELL. Lists open PRs, classifies each, applies the label change + posts the one-time comment when a
 * PR newly transitions into conflict, and reports what happened. Never throws on a per-PR write failure — one
 * bad `gh` call must not stop the sweep from checking the rest (mirrors this file's siblings' best-effort
 * contract); the failure is reported in the per-PR result instead.
 * `#xu2krte`'s Fork 2/4 addition: on `newlyDetected`, ALSO route the PR to exactly one of
 * {@link defaultPostConflictFinding} (dispatchable — becomes a `review:changes` bounce the existing
 * fix-dispatch pipeline picks up) or {@link defaultPostConflictStandDown} ({@link isStatuteTierConflict} —
 * straight to a human, no dispatch attempt). Best-effort like every other write here: a failure is reported on
 * the entry, never thrown, and never stops the sweep from checking the rest of the PRs.
 * @param {{repo?:string|null, listPrs?:Function, provider?:object, dryRun?:boolean, postFinding?:Function, postStandDown?:Function, listPrFiles?:Function}} [o]
 * @returns {Array<{num:number, isConflicting:boolean, add:string|null, remove:string[], newlyDetected:boolean, commented:boolean, error?:string, routedTo?:string}>}
 */
export function watchParkedPrConflicts({
  repo = null, listPrs = defaultListParkedPrs, provider = createGhProvider(), dryRun = false,
  postFinding = defaultPostConflictFinding, postStandDown = defaultPostConflictStandDown,
  listPrFiles = defaultListPrFiles,
} = {}) {
  const prs = listPrs({ repo });
  const results = [];
  // xoh8fkw — resolved LAZILY, only once, only when a real write is about to happen (the common empty-sweep tick
  // never pays for the extra `gh repo view` call). `defaultListParkedPrs` above works fine with a null `repo`
  // (`gh pr list` derives it from cwd when `--repo` is omitted), but `review-label-provider.mjs`'s own
  // `GH_ARGV.ensureLabel`/`setLabels`/`postComment` always splice `'--repo', repo` into their argv
  // UNCONDITIONALLY — a null `repo` reaching them becomes a literal `"null"` argument once it hits `gh`.
  // Confirmed live 2026-09-05 on PR #1932: `gh label create … --repo null …` failing
  // `expected the "[HOST/]OWNER/REPO" format, got "null"` — this pass correctly detected the newly-conflicting
  // PR every tick but had NEVER actually applied a label, because the runner's own default invocation
  // (`runQuiet('conveyor/parked-pr-conflict-watch.mjs', ['sweep'])`) never passes `--repo` unless the runner
  // itself was started with one. Mirrors `we:scripts/review-set-label.mjs`'s own `repoOptional` resolution —
  // the provider's `currentRepo()` exists exactly for this ("fires only when `--repo` was omitted", its own
  // docblock) and was simply never called here.
  let resolvedRepo = repo;
  for (const pr of Array.isArray(prs) ? prs : []) {
    const isConflicting = isParkedConflictTarget(pr);
    const plan = planConflictLabelChange({ isConflicting, currentLabels: pr?.labels });
    if (!plan.add && plan.remove.length === 0) continue;
    const entry = { num: pr?.number, isConflicting, ...plan, commented: false };
    if (dryRun) { results.push(entry); continue; }
    try {
      if (resolvedRepo == null) resolvedRepo = provider.currentRepo();
      if (plan.add) provider.ensureLabel(resolvedRepo, CONFLICT_LABEL, CONFLICT_LABEL_META);
      provider.setLabels(resolvedRepo, pr?.number, { add: plan.add ?? undefined, remove: plan.remove });
      if (plan.newlyDetected) {
        // Computed ONCE, ahead of both the alert comment and the routing decision below, so the two can never
        // disagree about what happens next — PR #1966's own review found exactly that drift (the alert still
        // said "not auto-rebased, human/`/finish` only" for a conflict this same call was about to dispatch a
        // fix agent at).
        //
        // #xgfzlj1 — `pr.files` came off `gh pr list --json ...,files`, which resolves `files` over `gh`'s own
        // GraphQL query hardcoding `files(first: 100)` with NO pagination (confirmed against `gh` 2.95.0 /
        // `cli/cli@trunk`; tracked upstream as a bug, cli/cli #6930/#5368). A length under the cap is PROVABLY
        // complete; a length AT the cap is indistinguishable from truncated, so re-fetch a verified-complete
        // list via the paginated REST endpoint before trusting it for this safety decision. On the rare case
        // that re-fetch itself fails, fail OVER-cautious (treat as statute-tier → stand-down), matching this
        // whole predicate's documented safe direction — never silently fall back to the possibly-truncated list.
        const rawFiles = Array.isArray(pr?.files) ? pr.files : [];
        let filesForCheck = rawFiles;
        let statuteCheckFailed = false;
        if (rawFiles.length >= GH_FILES_GRAPHQL_CAP) {
          try {
            filesForCheck = listPrFiles({ number: pr?.number, repo: resolvedRepo });
          } catch (eFiles) {
            statuteCheckFailed = true;
          }
        }
        const isStatuteTier = statuteCheckFailed || isStatuteTierConflict(filesForCheck);
        provider.postComment(resolvedRepo, pr?.number, buildConflictComment(pr, { isStatuteTier }));
        entry.commented = true;
        // Fork 2/4 (#xu2krte) — route to exactly one downstream pipeline. Failures here are reported on the
        // entry the SAME way a label/comment failure already is; the alert above has already posted either way.
        try {
          if (isStatuteTier) {
            postStandDown({ pr, repo: resolvedRepo });
            entry.routedTo = 'stand-down';
          } else {
            postFinding({ pr, repo: resolvedRepo });
            entry.routedTo = 'reconcile-finding';
          }
        } catch (e2) {
          entry.error = String((e2 && e2.message) || e2).split('\n')[0];
        }
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
