---
kind: task
status: open
dateOpened: "2026-07-12"
tags: [review, drain, panel, net-diff]
relatedTo: ["1821", "2373", "2336", "2310"]
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
