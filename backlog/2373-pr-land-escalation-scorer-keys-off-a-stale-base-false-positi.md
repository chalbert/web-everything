---
kind: task
status: resolved
dateOpened: "2026-07-09"
dateStarted: "2026-07-10"
dateResolved: "2026-07-10"
graduatedTo: "#2373 (fix landed): pr-land.mjs's applyReviewEscalationLabel now calls the shared computeNetDiffChangedFiles (scripts/merge-ai-prs.mjs), which fetches BASE with an explicit destination refspec and is also used by the drain backstop — one net-diff basis, no second place to drift"
tags: [review, drain, gate-self, pr-land]
relatedTo: ["1821", "2365"]
---

# pr-land escalation scorer keys off a stale base — false-positive review:human when origin/main advances past the lane

`pr-land` feeds `scoreEscalation` (`we:scripts/lib/review-escalation.mjs`) a
`changedFiles` set computed against a base **behind the PR's real merge base**,
so gate-touching commits already landed on `main` — present in the PR's *history*
but **not** its net diff — get attributed to the PR. Result: a spurious sticky
`review:human` on a PR that changes **no** lander code, which then never
times out and is not agent-clearable, stalling a clean PR on the human path.

## Live repro (2026-07-09)

Filing a one-file backlog item opened **PR #324** (net diff: a single
`we:backlog/xroy4fk-…md`, verified identical across the GitHub files list, the
two-dot `origin/main..HEAD`, and the three-dot `origin/main...HEAD`). Yet
`pr-land --label-on-green` labelled it `review:human` with:

- `blast-radius (we:scripts/lib/__tests__/review-escalation.test.mjs, we:scripts/lib/review-escalation.mjs, we:scripts/merge-ai-prs.mjs)`
- `gate-self (we:scripts/lib/review-escalation.mjs, we:scripts/merge-ai-prs.mjs) — human review required`

`scoreEscalation` (lines ~112–117) lists exactly the files in the `changedFiles`
it is *handed* that match `isBlastRadiusPath` / `isGateSelfPath`. So the input
list was wrong. Those three files are the changeset of commit `95a163a5` (the
#2362 review-gate fix, part of the landed #311 batch) — and
`git merge-base --is-ancestor 95a163a5 <#324-base>` is **true**: they are in
#324's base history, not its diff. So the scorer's `changedFiles` was computed
against a base **older than** #324's actual base (`bd68d0d8`, the #311 merge),
sweeping in already-landed gate hunks.

## Root cause

`pr-land`'s escalation `changedFiles` must be the **net two-dot diff vs current
`origin/main`** (`git diff --name-only origin/main..<head>`, after fetching), NOT
a set that can include commits already on `main`. A stale local base ref, or a
three-dot/merge-base basis against an out-of-date ref, lets upstream-landed files
leak into the score.

## Relation to #1821

**#1821** fixed *the same class of defect* — but in the **drain backstop**
(`we:scripts/merge-ai-prs.mjs`'s `scoreEscalation` call), moving it to the net
two-dot basis. This is the **producer path** (`we:scripts/pr-land.mjs`), which
still mis-computes the basis. The fix is symmetric: feed `scoreEscalation` the
net-vs-current-`main` file set. Cross-reference #2365 (the `review:human`
sticky-veto wiring), which interacts with how a mis-applied label then sticks.

## Acceptance

- A PR whose net two-dot diff vs current `origin/main` touches no
  blast-radius / gate-self path is NOT labelled `review:human`, even when
  `origin/main` advanced past the lane's base (with gate-file commits) between
  acquire and PR-open.
- The #324 repro, re-run, labels `ready-to-merge` only (no escalation).
- The producer and drain paths share ONE net-diff basis for `changedFiles`
  (no second place to drift).
