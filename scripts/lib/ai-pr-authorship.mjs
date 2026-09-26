/**
 * @file scripts/lib/ai-pr-authorship.mjs
 * @description The AI-authorship rubric — "is this PR's content AI-generated" / "does it carry this label" —
 *   extracted from `scripts/merge-ai-prs.mjs` (we:xniq7xs) into its OWN zero-dependency leaf so a small,
 *   read-only consumer (`scripts/lib/pr-limit.mjs`, and through it `scripts/operations/operator-queue.mjs` /
 *   `scripts/readiness/dispatch-plan.mjs`) can reuse the SAME rubric without inheriting `merge-ai-prs.mjs`'s
 *   own heavy transitive import graph (25 top-level imports spanning the whole land/merge/review subsystem) —
 *   the exact failure mode `scripts/operations/__tests__/operator-queue-entry.test.mjs`'s synthetic
 *   minimal-checkout harness exists to catch (an import of a file that checkout never staged crashes the
 *   child process with no diagnostic beyond "main() never ran").
 *
 *   `merge-ai-prs.mjs` re-exports every one of these names unchanged (`export { … } from './lib/ai-pr-
 *   authorship.mjs'`), mirroring `pr-land.mjs`'s own `forge-land-provider.mjs` re-export — every existing
 *   importer of `merge-ai-prs.mjs` keeps resolving them exactly as before; this file is the ONE definition,
 *   never a second, independently-drifting copy.
 *
 *   PURE. Zero imports — plain JS over plain objects (the shape `gh pr list --json commits,labels` returns).
 */

/** An anthropic/Claude identity on a commit author (the `Co-Authored-By: Claude …` trailer gh surfaces as an
 *  author). Matches the name "Claude" or an anthropic email — the stamp every commit in an AI session carries. */
export function isAiAuthor(author) {
  if (!author) return false;
  const name = String(author.name || '').toLowerCase();
  const email = String(author.email || '').toLowerCase();
  return /\bclaude\b/.test(name) || email.includes('anthropic.com') || email.includes('noreply@anthropic');
}

/** A commit is AI if ANY of its authors (author + Co-Authored-By co-authors) is an AI identity. */
export function isAiCommit(commit) {
  const authors = Array.isArray(commit?.authors) ? commit.authors : [];
  // Fallback: some gh versions omit co-authors from `authors` but keep the trailer in the body.
  const bodyHasTrailer = /co-authored-by:\s*claude/i.test(String(commit?.messageBody || commit?.body || ''));
  return authors.some(isAiAuthor) || bodyHasTrailer;
}

/** A mechanical integration commit — either shape below carries no NEW authored content of its own, so neither
 *  counts as human work and neither may disqualify an otherwise-AI PR:
 *   1. `Merge branch 'main' …` / `Merge remote-tracking …` with an EMPTY body — what `gh pr update-branch` /
 *      a local rebase-on-behind creates.
 *   2. `Merge pull request #NNN from owner/branch` — GitHub's OWN fixed-boilerplate merge-commit headline
 *      (created by `gh pr merge --merge` / the merge button; this repo's own drain default,
 *      `we:scripts/lib/pr-merge-gate.mjs`'s `mergeMethodFlag`). Its body is always non-empty (GitHub fills it
 *      with the MERGED PR's own title), so it fails shape 1's empty-body test even though it is exactly as
 *      mechanical: this specific commit only merges two trees, it adds no line of its own. #3729 — a
 *      long-lived lane that later merges `origin/main` into itself (shape 1, routine) inherits every OTHER
 *      already-landed PR's shape-2 merge commit into its OWN open PR's `commits` list (the PR's recorded base
 *      predates them), so before this fix one stray shape-2 commit — authored solely by the merge bot, never
 *      by a human or Claude — silently flipped `isAiGeneratedPr` to `false` for an otherwise fully-AI PR,
 *      which disqualified it from the #2421 TOTAL ci-lifecycle reconcile forever (a `ci:failed` label from an
 *      earlier red head never cleared once the current head went green — confirmed live on PR #2685/#2653). */
export function isMechanicalMergeCommit(commit) {
  const head = String(commit?.messageHeadline || '').trim();
  const body = String(commit?.messageBody || '').trim();
  if (/^Merge (branch|remote-tracking branch) /i.test(head) && body === '') return true;
  if (/^Merge pull request #\d+ from \S+/i.test(head)) return true;
  return false;
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
