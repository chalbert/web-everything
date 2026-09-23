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
 * RESOLVED CONFLICTS OWE A FRESH REVIEW. Once GitHub confirms `mergeable: MERGEABLE` on a previously
 * flagged PR still carrying `review:changes`, hand it to `we:scripts/conveyor/rearm-review.mjs` — the SAME
 * sanctioned hand-back an ordinary repaired bounce uses. Removing only the conflict label stranded this
 * pass's bounce forever; resurrecting an old `review:accepted` would certify a diff predating the resolution.
 * The watcher still posts no clearance comment of its own: rearm owns the durable comment and the
 * `review:changes → review:pending` swap, preserving `review:human`. UNKNOWN is not proof of resolution.
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
 * APPROVED PRS TOO (x832e2v, live 2026-09-23). An approved/queued PR (`review:accepted` / `ready-to-merge`)
 * that drifts into a conflict used to be skipped by this pass AND silently skipped by the drain. It is now
 * labelled at once but bounced only after {@link QUEUED_CONFLICT_GRACE_MS}, giving the drain first try at
 * the one conflict it heals itself; the bounce strips the old approval, so the resolved diff is re-reviewed.
 *
 * THE CADENCE. Each constellation repo runs this as its own resident `pass-daemon` watcher
 * (`we:skills-src/conveyor/daemon-manifest.mjs`, `parked-pr-conflict-watch-<repo>`); the headless runner's
 * `makeCliMechanicalPasses` also calls it when that runner is up.
 */
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { execFileSyncThrottled } from '../lib/gh-throttle.mjs';
import { readPrsFromFile } from './open-pr-fetch.mjs';

import { createGhProvider } from '../lib/review-label-provider.mjs';
import { REVIEW_LABELS, hasReviewLabel, hasUnclearedReviewLabel, isDeclarativeLeashPath, isStatutePath } from '../lib/review-escalation.mjs';
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

/** How long an APPROVED/queued PR may sit conflicting before it is bounced to a fix agent. The drain runs every
 *  minute or so but a pass can take many minutes; this gives it a real chance at the one conflict it heals on
 *  its own (a shared-manifest-only conflict, rebase-dropped on land) before the PR is sent back through fix
 *  and review. */
export const QUEUED_CONFLICT_GRACE_MS = 30 * 60 * 1000;

/**
 * Is this an APPROVED/queued PR (`review:accepted` or `ready-to-merge`, no uncleared hold) that has drifted into
 * a real conflict? PURE. Live-caught 2026-09-23: four approved PRs (#2503, #2505, #2514, #2515) sat DIRTY with
 * nothing acting on them — the parked predicate above skips a cleared PR, and the drain silently skips a
 * conflict it cannot rebase-drop. Such a PR is not bounced at once (the drain gets {@link QUEUED_CONFLICT_GRACE_MS}
 * first); once bounced, its old approval is stripped and it goes through fix and re-review like any other.
 * @param {{mergeable?:string, labels?:Array}} pr
 * @returns {boolean}
 */
export function isQueuedConflictTarget(pr) {
  if (String(pr?.mergeable || '').toUpperCase() !== 'CONFLICTING') return false;
  if (hasUnclearedReviewLabel(pr?.labels, { allowPending: false })) return false; // the parked path owns it
  return hasReviewLabel(pr?.labels, REVIEW_LABELS.accepted) || hasReviewLabel(pr?.labels, 'ready-to-merge');
}

/**
 * How long ago the conflict label was last applied to this PR, from the issue's own event timeline. Returns
 * `null` when it cannot tell — the caller then waits rather than bouncing (the safe direction).
 * @returns {number|null} milliseconds since the label was applied
 */
export function defaultConflictLabelAgeMs({ pr, repo, exec = execFileSyncThrottled, now = Date.now() }) {
  try {
    // Events come oldest-first and a busy PR can span pages: paginate, one line per page, keep the latest date.
    const path = `repos/${repo}/issues/${pr?.number}/events?per_page=100`;
    const out = exec('gh', ['api', '--paginate', path, '--jq',
      `[.[] | select(.event=="labeled" and .label.name=="${CONFLICT_LABEL}") | .created_at] | last`],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const times = String(out || '').split('\n').map((l) => Date.parse(l.trim())).filter(Number.isFinite);
    return times.length ? now - Math.max(...times) : null;
  } catch {
    return null;
  }
}

/**
 * PURE: add the conflict marker on detection, remove it on confirmed resolution, and report the transition.
 * `isResolved` comes from GitHub's
 * mergeable field, independently of the parked-review predicate; an unknown result must keep the marker
 * so a later confirmed resolution can still trigger the hand-back. Mirrors
 * `we:scripts/conveyor/review-status-tag.mjs#planStatusLabelChange`'s add/remove shape.
 * @param {{isConflicting:boolean, isResolved?:boolean, currentLabels?:Array<{name?:string}|string>}} o
 * @returns {{add:string|null, remove:string[], newlyDetected:boolean, newlyResolved?:boolean}}
 */
export function planConflictLabelChange({ isConflicting, isResolved = false, currentLabels = [] } = {}) {
  const names = currentLabels.map((l) => (typeof l === 'string' ? l : l?.name)).filter(Boolean);
  const already = names.includes(CONFLICT_LABEL);
  if (isConflicting && !already) return { add: CONFLICT_LABEL, remove: [], newlyDetected: true };
  if (!isConflicting && already && isResolved) return { add: null, remove: [CONFLICT_LABEL], newlyDetected: false, newlyResolved: true };
  return { add: null, remove: [], newlyDetected: false };
}

/**
 * The one-time alert comment posted on the transition to `newlyDetected`. PURE (a string builder — the actual
 * `gh pr comment` write is the IO shell's job).
 * @param {{num:number|string, headRefName?:string}} pr
 * @returns {string}
 */
export function buildConflictComment(pr, { isStatuteTier = false, deferredToDrain = false, appendOnlyStatute = false } = {}) {
  const ref = pr?.headRefName ? ` (\`${pr.headRefName}\`)` : '';
  const nextStep = deferredToDrain && !isStatuteTier
    ? 'This PR is already approved/queued, so the drain gets the first try — it auto-rebases a PR whose only ' +
      `conflict is the shared manifest. If it is still conflicting in ${QUEUED_CONFLICT_GRACE_MS / 60000} minutes, ` +
      'it is bounced to `review:changes` for a fix agent to resolve, then re-reviewed: the old approval does not ' +
      'cover the resolved diff.'
    : isStatuteTier
    ? 'Left as a **judgment call for a human or `/finish`**, not auto-resolved: the conflicting hunk touches a ' +
      "declarative-leash/statute-tier file, so choosing which side's edit wins is drafting principle content, " +
      'not ordinary code — exactly the judgment this repo reserves for a person (`#xu2krte` Fork 2).'
    : 'A fix agent is being dispatched to resolve it (`#xu2krte`) — the SAME independent-review gate this PR ' +
      'is already parked behind still applies before anything lands; nobody is rewriting this content ' +
      'unreviewed. If it cannot be resolved safely, it stands down to a human instead of guessing.';
  // #3383-append-only-statute — this touches a statute file, but ONLY because both sides independently appended a
  // NEW `### ` section at the same spot; no existing rule text is in dispute. Said explicitly, beside `nextStep`
  // rather than folded into it, so a reader sees at a glance this is a MECHANICAL resolution with a re-review
  // still owed, not a silent downgrade of the statute-tier care this PR would otherwise get.
  const appendOnlyNote = appendOnlyStatute
    ? '\n\n**This is being resolved mechanically, not by a human judgment call.** Both sides only ADDED separate ' +
      'new rule sections at the same insertion point — nobody edited any existing rule text — so this is being ' +
      'handled as an append-only statute conflict (keep both sections) and will go through a fresh independent ' +
      'review once resolved, exactly like any other bounce.'
    : '';
  return [
    `⚠️ **This ${deferredToDrain ? 'approved' : 'parked'} PR has drifted into a real merge conflict against \`main\`**`,
    '',
    `GitHub reports \`mergeable: CONFLICTING\` on this PR${ref} while it is ${deferredToDrain ? 'queued to land' : 'parked for review'} — it will not ` +
      'resolve on its own. One or more PRs merged to `main` since this one opened touched overlapping content.',
    '',
    nextStep + appendOnlyNote,
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
 * we:scripts/conveyor/parked-pr-conflict-watch.mjs#isAppendOnlyStatuteChange — the PURE classifier behind the
 * append-only statute exception (live 2026-09-23, PR #2505). A concurrent statute-tier PR conflicts with `main`
 * ONLY because both sides independently appended a NEW `### ` rule section at the same insertion point (the tail
 * of a `##` section, right before the next one) — nobody edited any EXISTING rule text. That is mechanically
 * resolvable (keep both sections); an edit that touches shared rule text is not, and must still stand down to a
 * human. Every concurrent statute PR collides this exact way, since they all append at the same spot (#2524 will
 * too) — this exists so that shape stops costing a human review each time.
 *
 * Given ONE file's unified-diff `patch` (the per-file field `gh api .../pulls/{n}/files` returns — a bare hunk
 * body, no `--- a/`/`+++ b/` file-header lines), returns true ONLY if:
 *   (a) the patch removes NOTHING — any `-`-prefixed line fails it outright, whatever it says;
 *   (b) EVERY contiguous run of `+`-prefixed lines, once blank lines and lone `---` separator lines are trimmed
 *       off its own top/bottom edge, BEGINS with a `### ` heading line — proving the run is a WHOLE inserted
 *       section, never a line spliced into an existing one's body;
 *   (c) the first non-blank UNCHANGED (context) line following each such run — if the hunk has one at all — is
 *       itself a `---`, a `### ` or a `## ` line, proving the insertion point is a real section BOUNDARY, not the
 *       middle of a rule.
 * Anything the parser cannot make sense of (not a string, no hunk header at all, a run that trims to nothing) reads
 * as false — the safe direction: false only ever costs the stand-down that was already today's behaviour.
 * @param {string} patch
 * @returns {boolean}
 */
export function isAppendOnlyStatuteChange(patch) {
  if (typeof patch !== 'string' || patch === '') return false;
  const lines = patch.split('\n');
  if (!lines.some((l) => l.startsWith('@@'))) return false; // no hunk at all — unparseable
  if (lines.some((l) => l.startsWith('-'))) return false; // (a) — any removal fails it outright, full stop

  const isBlankOrRule = (s) => { const t = s.trim(); return t === '' || t === '---'; };

  // Split into hunks so "the next context line" can never cross a `@@` boundary into an unrelated hunk.
  const hunks = [];
  let hunkStart = -1;
  lines.forEach((l, i) => {
    if (l.startsWith('@@')) { if (hunkStart !== -1) hunks.push(lines.slice(hunkStart, i)); hunkStart = i; }
  });
  if (hunkStart !== -1) hunks.push(lines.slice(hunkStart));

  let sawAnyRun = false;
  for (const hunk of hunks) {
    let i = 1; // index 0 is the `@@ … @@` header line itself
    while (i < hunk.length) {
      if (!hunk[i].startsWith('+')) { i += 1; continue; }
      const runStart = i;
      while (i < hunk.length && hunk[i].startsWith('+')) i += 1;
      const runEnd = i; // exclusive
      sawAnyRun = true;

      const content = hunk.slice(runStart, runEnd).map((l) => l.slice(1));
      let lo = 0;
      let hi = content.length;
      while (lo < hi && isBlankOrRule(content[lo])) lo += 1;
      while (hi > lo && isBlankOrRule(content[hi - 1])) hi -= 1;
      if (lo >= hi) return false; // (b) — trims to nothing, no heading in this run at all
      if (!content[lo].startsWith('### ')) return false; // (b) — not a whole-section insert

      // (c) — the first non-blank CONTEXT line after the run, within this same hunk. A `\ No newline…` meta line
      // is skipped without counting; no other line kind can occur here (a `+`-run is maximal by construction and
      // removals were already ruled out above), so hitting anything else just means "no context line follows".
      let j = runEnd;
      let nextContext = null;
      while (j < hunk.length) {
        const l = hunk[j];
        if (l.startsWith('\\')) { j += 1; continue; }
        if (l.startsWith(' ')) {
          const c = l.slice(1);
          if (c.trim() !== '') { nextContext = c; break; }
          j += 1; continue;
        }
        break;
      }
      if (nextContext != null) {
        const t = nextContext.trim();
        if (!(t === '---' || nextContext.startsWith('### ') || nextContext.startsWith('## '))) return false;
      }
    }
  }
  return sawAnyRun;
}

/**
 * we:scripts/conveyor/parked-pr-conflict-watch.mjs#isAppendOnlyStatuteConflict — lifts
 * {@link isAppendOnlyStatuteChange} from "one file's patch" to "this conflict's whole statute-tier file set".
 * PURE — `patchesByFile` is supplied by the caller (the IO shell fetches it via {@link defaultListPrPatches}).
 *
 * Dispatchable ONLY when EVERY statute-tier file in the conflict is BOTH a statute-path `.md` file (never a
 * declarative-leash file — those are code/contracts with no such thing as an append-only edit) AND its own patch
 * is append-only. A missing/non-string patch entry reads as a fetch failure for THAT file and fails the whole
 * conflict closed — the safe direction, matching {@link isAppendOnlyStatuteChange}'s own contract.
 * @param {string[]} statuteTierFiles - the subset of the conflict's file list that is statute-tier (leash or
 *   statute path) — the same predicate {@link isStatuteTierConflict} already applies.
 * @param {Record<string,string>} patchesByFile - path → that file's unified-diff patch text.
 * @returns {boolean}
 */
export function isAppendOnlyStatuteConflict(statuteTierFiles, patchesByFile) {
  const files = Array.isArray(statuteTierFiles) ? statuteTierFiles : [];
  if (files.length === 0) return false;
  const patches = patchesByFile && typeof patchesByFile === 'object' ? patchesByFile : {};
  return files.every((p) => {
    if (isDeclarativeLeashPath(p)) return false; // leash files are never append-only-eligible
    if (!isStatutePath(p) || !String(p).toLowerCase().endsWith('.md')) return false;
    const patch = patches[p];
    return typeof patch === 'string' && isAppendOnlyStatuteChange(patch);
  });
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
export function defaultListPrFiles({ number, repo, exec = execFileSyncThrottled }) {
  const path = repo ? `repos/${repo}/pulls/${number}/files` : `repos/{owner}/{repo}/pulls/${number}/files`;
  const argv = ['api', '--paginate', '-F', 'per_page=100', path, '--jq', '.[].filename'];
  const out = exec('gh', argv, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
  return String(out || '').split('\n').map((s) => s.trim()).filter(Boolean);
}

/** Undo jq's `@tsv` per-field escaping (`\\`, `\t`, `\n`, `\r`) — the inverse of what {@link defaultListPrPatches}'s
 *  own jq filter applies to reconstitute a multi-line patch onto one output line. */
function unescapeTsvField(s) {
  let out = '';
  for (let i = 0; i < s.length; i += 1) {
    if (s[i] === '\\' && i + 1 < s.length) {
      const n = s[i + 1];
      if (n === 'n') { out += '\n'; i += 1; continue; }
      if (n === 't') { out += '\t'; i += 1; continue; }
      if (n === 'r') { out += '\r'; i += 1; continue; }
      if (n === '\\') { out += '\\'; i += 1; continue; }
    }
    out += s[i];
  }
  return out;
}

/**
 * we:scripts/conveyor/parked-pr-conflict-watch.mjs#defaultListPrPatches — the fetch {@link isAppendOnlyStatuteConflict}
 * needs: a COMPLETE, injectable read of every changed file's own unified-diff `patch` text, keyed by filename.
 * Paginated REST (`pulls/{number}/files`), mirroring {@link defaultListPrFiles}'s own shape/cap concerns exactly
 * — same endpoint, same `-F per_page=100` + `--paginate`, no `gh pr view`/`gh pr list` 100-file GraphQL cap here.
 *
 * PROJECTS VIA `@tsv`, NOT `tojson`/a bare JSON object per line — a `patch` legitimately spans many source lines,
 * and jq's default (non-`-c`) object rendering is pretty-printed across MULTIPLE output lines, which would break
 * any "one record per line" reader silently. `@tsv` escapes each field's own newlines/tabs/backslashes to a
 * literal `\n`/`\t`/`\\` so one file's whole patch always reaches this process as ONE line; {@link unescapeTsvField}
 * undoes that escaping to recover the real multi-line patch text `isAppendOnlyStatuteChange` expects.
 *
 * A file with no `patch` (binary, a pure rename, or one whose diff GitHub declined to compute) projects `.patch`
 * as `null` — mapped to `""` before `@tsv` (which cannot render `null`) so it still reads as ONE empty field
 * rather than corrupting the row; the caller/classifier already treats a non-append/empty patch as ineligible.
 * @param {{number:number|string, repo?:string|null, exec?:Function}} o
 * @returns {Record<string,string>} filename → that file's own patch text (possibly `""`)
 */
export function defaultListPrPatches({ number, repo, exec = execFileSyncThrottled }) {
  const path = repo ? `repos/${repo}/pulls/${number}/files` : `repos/{owner}/{repo}/pulls/${number}/files`;
  const argv = ['api', '--paginate', '-F', 'per_page=100', path, '--jq', '.[] | [.filename, (.patch // "")] | @tsv'];
  const out = exec('gh', argv, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
  const patches = {};
  for (const line of String(out || '').split('\n')) {
    if (line === '') continue;
    const tab = line.indexOf('\t');
    if (tab === -1) continue;
    const filename = unescapeTsvField(line.slice(0, tab));
    patches[filename] = unescapeTsvField(line.slice(tab + 1));
  }
  return patches;
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
export function buildConflictFindingBody(pr, { appendOnlyStatute = false } = {}) {
  const ref = pr?.headRefName ? ` (\`${pr.headRefName}\`)` : '';
  // #3383-append-only-statute — an EXPLICIT, narrower instruction for the one case this file's classifier proves
  // mechanical: both sides only ADDED a new `### ` section at the same spot in a statute doc. Stated as its own
  // paragraph, ahead of the generic "read both sides' intent" instruction, so a fixer never has to re-derive from
  // the raw conflict markers that no existing rule text is actually in dispute here.
  const appendOnlyInstruction = appendOnlyStatute
    ? [
      '',
      "**Append-only statute conflict: resolve by keeping `main`'s version of the file unchanged and " +
        "re-inserting this PR's new `###` section(s), in the same place relative to the neighbouring sections, " +
        "after `main`'s new ones. Change no existing rule text.**",
    ]
    : [];
  return [
    `PR #${pr?.num ?? pr?.number ?? '?'}${ref} has drifted into a real GIT merge conflict against \`main\` — ` +
      "GitHub reports `mergeable: CONFLICTING`. This is the WHOLE finding; there is no separate reviewer comment " +
      'to read on this PR for it.',
    '',
    '**Resolving the conflict IS the task.** Rebase or merge `main` into this branch, resolve every conflicted ' +
      "hunk by reading BOTH sides' intent (this diff's own and whatever landed on `main` since), push the " +
      'resolution, and let the normal fix-agent flow (this bounce) carry it back to independent review.',
    ...appendOnlyInstruction,
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
export function defaultListParkedPrs({ exec = execFileSyncThrottled, repo = null } = {}) {
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
export function defaultPostConflictFinding({ pr, repo, exec = execFileSync, appendOnlyStatute = false }) {
  const bodyPath = join(tmpdir(), `reconcile-finding-conflict-${pr?.number}-${randomUUID()}.md`);
  writeFileSync(bodyPath, buildConflictFindingBody({ num: pr?.number, headRefName: pr?.headRefName }, { appendOnlyStatute }), 'utf8');
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
 * Hand a resolved conflict back through the existing repaired-bounce CLI for a fresh independent review.
 * @param {{pr:object, repo:string|null, exec?:Function}} o
 */
export function defaultPostConflictRearm({ pr, repo, exec = execFileSync }) {
  const argv = [join(REPO_ROOT, 'scripts', 'conveyor', 'rearm-review.mjs'), String(pr?.number),
    '--actor=parked-pr-conflict-watch (conflict resolved)'];
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
 * On `newlyResolved`, a remaining `review:changes` bounce goes to {@link defaultPostConflictRearm}.
 * @param {{repo?:string|null, listPrs?:Function, provider?:object, dryRun?:boolean, postFinding?:Function, postStandDown?:Function, postRearm?:Function, listPrFiles?:Function, listPrPatches?:Function}} [o]
 * @returns {Array<{num:number, isConflicting:boolean, add:string|null, remove:string[], newlyDetected:boolean, newlyResolved?:boolean, commented:boolean, error?:string, routedTo?:string}>}
 */
export function watchParkedPrConflicts({
  repo = null, listPrs = defaultListParkedPrs, provider = createGhProvider(), dryRun = false,
  postFinding = defaultPostConflictFinding, postStandDown = defaultPostConflictStandDown,
  postRearm = defaultPostConflictRearm,
  listPrFiles = defaultListPrFiles,
  listPrPatches = defaultListPrPatches,
  labelAgeMs = defaultConflictLabelAgeMs,
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
    const parked = isParkedConflictTarget(pr);
    const queued = !parked && isQueuedConflictTarget(pr);
    const isConflicting = parked || queued;
    const plan = planConflictLabelChange({
      isConflicting, isResolved: String(pr?.mergeable || '').toUpperCase() === 'MERGEABLE', currentLabels: pr?.labels,
    });
    // An approved PR already flagged on an earlier sweep: bounce it once the drain's grace window has passed.
    const graceDue = queued && !plan.add && hasReviewLabel(pr?.labels, CONFLICT_LABEL);
    if (!plan.add && plan.remove.length === 0 && !graceDue) continue;
    const entry = { num: pr?.number, isConflicting, ...plan, commented: false };
    if (dryRun) { results.push(entry); continue; }
    try {
      if (resolvedRepo == null) resolvedRepo = provider.currentRepo();
      if (graceDue) {
        const age = labelAgeMs({ pr, repo: resolvedRepo });
        if (age == null || age < QUEUED_CONFLICT_GRACE_MS) continue; // the drain still has its turn
        let isStatuteTier;
        try { isStatuteTier = isStatuteTierConflict(listPrFiles({ number: pr?.number, repo: resolvedRepo })); }
        catch { isStatuteTier = true; } // over-cautious, same safe direction as the fresh-detection path
        // A statute-tier conflict was already handed to a human at detection; never re-post it every sweep.
        if (isStatuteTier) continue;
        // The bounce strips review:accepted + ready-to-merge, so this PR is no longer a queued target next sweep.
        postFinding({ pr, repo: resolvedRepo });
        entry.routedTo = 'reconcile-finding (after drain grace)';
        results.push(entry);
        continue;
      }
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
        // #3383-append-only-statute — live 2026-09-23, PR #2505: a statute-tier conflict where BOTH sides only
        // appended a separate new `### ` section is mechanically resolvable (keep both) and does not need to cost
        // a human review the way an actual overlapping-content statute edit must. Only checked when the file set
        // already qualifies as statute-tier at all (the common non-statute tick pays nothing extra), and only
        // over the STATUTE-TIER subset of files — a declarative-leash file anywhere in that subset, a non-`.md`
        // statute path, or any patch-fetch failure all fail this closed (stand-down), the safe direction.
        let appendOnlyStatute = false;
        if (isStatuteTier && !statuteCheckFailed) {
          try {
            const statuteTierFiles = filesForCheck
              .map((f) => (typeof f === 'string' ? f : f?.path))
              .filter((p) => p && (isDeclarativeLeashPath(p) || isStatutePath(p)));
            const patches = listPrPatches({ number: pr?.number, repo: resolvedRepo });
            appendOnlyStatute = isAppendOnlyStatuteConflict(statuteTierFiles, patches);
          } catch {
            appendOnlyStatute = false; // fetch failure → stand down, the safe direction
          }
        }
        const standDown = isStatuteTier && !appendOnlyStatute;
        provider.postComment(resolvedRepo, pr?.number,
          buildConflictComment(pr, { isStatuteTier: standDown, deferredToDrain: queued, appendOnlyStatute }));
        entry.commented = true;
        // Fork 2/4 (#xu2krte) — route to exactly one downstream pipeline. Failures here are reported on the
        // entry the SAME way a label/comment failure already is; the alert above has already posted either way.
        // An append-only statute conflict is dispatched AT ONCE, bypassing the queued-PR drain grace below: that
        // grace exists to let the drain auto-rebase a shared-manifest-only conflict, which is not this case (a
        // real content insertion in a statute doc), so waiting on it would only delay the mechanical fix.
        try {
          if (standDown) {
            postStandDown({ pr, repo: resolvedRepo });
            entry.routedTo = 'stand-down';
          } else if (isStatuteTier) {
            postFinding({ pr, repo: resolvedRepo, appendOnlyStatute: true });
            entry.routedTo = 'reconcile-finding (append-only statute)';
          } else if (queued) {
            entry.routedTo = 'deferred-to-drain'; // bounced by a later sweep once QUEUED_CONFLICT_GRACE_MS passes
          } else {
            postFinding({ pr, repo: resolvedRepo });
            entry.routedTo = 'reconcile-finding';
          }
        } catch (e2) {
          entry.error = String((e2 && e2.message) || e2).split('\n')[0];
        }
      } else if (plan.newlyResolved && hasReviewLabel(pr?.labels, REVIEW_LABELS.changes)) {
        try {
          postRearm({ pr, repo: resolvedRepo });
          entry.routedTo = 'rearm-review';
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
  const prsFile = flag('prs-file');
  if (verb !== 'sweep') {
    writeLineSync(2, `usage: parked-pr-conflict-watch.mjs sweep [--repo=<owner/name>] [--dry-run] [--prs-file=<path>]`);
    process.exitCode = 2;
  } else {
    try {
      const results = watchParkedPrConflicts({
        repo, dryRun, ...(prsFile ? { listPrs: () => readPrsFromFile(prsFile) } : {}),
      });
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
