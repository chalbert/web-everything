---
bornAs: xo75zon
kind: task
status: resolved
dateOpened: "2026-07-12"
dateStarted: "2026-08-03"
dateResolved: "2026-08-03"
tags: [review, drain, panel, net-diff]
relatedTo: ["1821", "2373", "2336", "2310"]
scope:
  - we:scripts/lib/review-core.mjs
  - we:scripts/lib/__tests__/review-core.test.mjs
  - we:scripts/merge-ai-prs.mjs
  - we:scripts/__tests__/merge-ai-prs.test.mjs
  - we:skills-src/drain/SKILL.md
  - we:.claude/skills/drain/SKILL.md
---

# Drain auto-review panels are seeded with the stale merge-base diff — phantom scope-creep findings burn negotiation rounds

The drain's panel↔editor auto-review (#2285 v3/#2310) seeds each lens reviewer with `gh pr diff <num>` — a three-dot merge-base diff. After sibling lanes land and the drain rebase-drops, that diff shows files already on main as if the PR added them, so panels report phantom scope-creep and burn negotiation rounds on it. #1821/#2373 fixed this stale-base class for the escalation **classifier** (`computeNetDiffChangedFiles`); the reviewer-facing diff **text** still uses the raw three-dot output. Fix: seed panels from a net diff vs current main (reuse the #2373 basis), in `we:skills-src/drain/SKILL.md` step 1 and the panel-seeding plumbing.

## Observed (2026-07-11/12, drain of batch-2026-07-11)

- The round-2 panel on PR #426 (#2433) reported an "undeclared backlog-triage payload" (#2444/#2445/#2446, re-parenting of #2241/#2418, retriage of #2417/#2442) as scope creep; `git diff --name-only origin/main origin/<branch>` showed the branch tree identical to main outside the six declared files — the payload had landed via PR #429 and only appeared in the three-dot diff.
- The same phantom payload was re-reported by fresh panels on PRs #423 and #424, and pre-refuting it required hand-injecting a "ground-truth note" into every later panel prompt (#422/#426-r3/#427-r2/r3) — a per-session workaround for what should be the seeding default.
- Each phantom finding costs a full lens report, risks a wasted editor round, and erodes the operator's trust in panel verdicts ("scope creep" is exactly the finding a human takes seriously).

## Fix shape

- Generate the reviewer diff on a net basis vs current main: either compute it from the same base `computeNetDiffChangedFiles` (`we:scripts/merge-ai-prs.mjs`, #2373) resolves, or refresh the merge-base (fetch + `git diff origin/main...head` against a current base) before rendering the diff handed to `buildPanelMandate()` (`we:scripts/lib/review-core.mjs`) reviewers.
- Update `we:skills-src/drain/SKILL.md` step 1 of the negotiation loop (currently: "Get the diff (`gh pr diff <num> --repo <repo>` …)") to name the net-diff basis, keeping the #2336 no-checkout constraint intact.
- Optional hardening: include the net changed-file list in the panel seed as ground truth (the classifier already computes it), so a reviewer can self-check before reporting scope findings.

## Progress

**Delivered on `main` — verified, not rebuilt.** All three parts of the fix shape
are live, including the optional hardening. Verification against `origin/main`:

- **The net-diff TEXT helper exists and shares ONE basis with the score.**
  `we:scripts/merge-ai-prs.mjs` exports `computeNetDiffText`, which resolves its
  base through the same `resolveNetDiffBasis` that `computeNetDiffChangedFiles`
  uses — so the diff the panel reads and the escalation score can no longer drift
  onto different bases. It returns the two-tree `git diff <forkpoint> <head>` text
  (content-only, ancestry-independent), not `gh pr diff`'s three-dot output, and
  degrades to `{ scored:false, text:'' }` so the caller can fall back. The #2336
  no-checkout constraint holds: it only fetches tracking refs and diffs two trees
  in place.
- **The base narrows to the #2404 provable fork point.** `resolveNetDiffBasis`
  runs the #2373 explicit-refspec force-fetch of the base tracking ref, then per
  candidate diffs from `merge-base(<remote>/<base>, candidate)` — which is exactly
  what stops a sibling-lane file that has since landed on main from appearing as
  if this PR added it.
- **The drain skill names the net basis.** `we:skills-src/drain/SKILL.md` step 1 of
  the negotiation loop now instructs `computeNetDiffText({ exec, rev: v.headRef,
  fetchExtraRefs: [v.headRef] })`, states plainly that this is *not* `gh pr diff`'s
  three-dot diff and why, and keeps `gh pr diff` only as the `scored:false`
  fallback.
- **The optional hardening shipped too.** `buildPanelMandate` in
  `we:scripts/lib/review-core.mjs` takes an optional `netChangedFiles` and appends a
  GROUND TRUTH block naming the PR's net changed-file set; the drain skill passes it
  (`buildPanelMandate({ lens, netChangedFiles })`) so a reviewer will not flag a
  diff-side file outside that set as scope creep.
- **Live oracles.** `we:scripts/__tests__/merge-ai-prs.test.mjs` carries a
  `computeNetDiffText (#2450 …)` describe block covering the resolved-basis path,
  the extra-ref fetch, the failure degradations, and the empty-arg guards.
  `we:scripts/__tests__/merge-ai-prs.test.mjs` + `we:scripts/lib/__tests__/review-core.test.mjs`
  run green together: **478 passed**.

The phantom scope-creep this item was filed against — a landed sibling file read as
this PR's addition — is closed on both axes: the diff text no longer contains it,
and the ground-truth file list lets a reviewer self-check even if it did.
