---
bornAs: xmgv6bx
kind: story
size: 3
parent: "3718"
status: resolved
relatedTo: ["2421", "3720"]
scope: ["we:scripts/merge-ai-prs.mjs", "we:scripts/__tests__/merge-ai-prs-ci-lifecycle-and-land-effects.test.mjs"]
dateOpened: "2026-09-19"
dateStarted: "2026-09-25"
dateResolved: "2026-09-25"
tags: []
---

# Diagnose and fix a stale ci:failed label left on a review-parked PR whose current head is green

PR #2107 kept `ci:failed` from an earlier head after its current head went green, and a person removed it by hand. The drain already reconciles that label from CI truth, so the miss is unexplained. Reproduce it against the live population first, then close the hole, so no session has to spot a stale label by hand.

## What the code already does

- `we:scripts/merge-ai-prs.mjs` (`lifecycleLabelFromCiTruth`, `planCiLifecycleLabelUpdate`, #2421) reconciles the `checking` / `ci:failed` / `blocked` labels from the latest required-check run (`latestRequiredCheck`, so a superseded cancelled run cannot stamp `ci:failed`). Its "TOTAL branch" applies this to every open PR that `isAiGeneratedPr` says the producer owns, and removes `ci:failed` once the check is green.
- `we:scripts/operator/dispatch.mjs` (`healCi`) also clears a stale `ci:failed` when every check passed, for PRs the converge daemon handles.

## What is unexplained (a hypothesis, not a diagnosis)

The #2107 evidence (the worker's result note: label from head 21aaedb0b, a red run on 2026-09-09, current head fd37ce270 green) shows the label outliving its head. Candidate causes, none yet tested:

1. The reconcile only runs inside the sweep's per-PR loop, for the sweep's candidate set. The daemon runs `we:scripts/merge-ai-prs.mjs` with `--label=ready-to-merge`; #2107 was review-parked at the time, not `ready-to-merge`, so it may never have entered the loop.
2. `isAiGeneratedPr` was false for it (the PR's author reads as the operator's own login, `is_bot: false`).
3. The reconcile ran but the label write failed silently (`ok = false` swallows the error).

Do not guess between them. Test each against the real open-PR population: list open PRs carrying `ci:failed` whose latest required check is green (`gh pr list --json` plus `isRequiredCheckGreen` from `we:scripts/merge-ai-prs.mjs`), and see which candidate each one falls under.

## Fix shape

Whichever cause holds, the answer is a widening of WHO the reconcile covers, or a fix to its write path, in the one place that already owns it. Do NOT add a second stale-label sweep. If the cause is population, widen the reconcile to every open PR regardless of the `--label` scope (a label fix, not a merge decision). If it is human-authored PRs, decide whether the drain may touch their `ci:*` labels at all; that is a policy question, so stop and say so rather than widening silently.

## Out of scope, on purpose

A stale stand-down comment whose blocker is gone. The stand-down marker is terminal by design (`we:scripts/conveyor/reconcile-core.mjs`, refusal 1: "an agent that stopped to ask a question is never restarted"), and the marker carries no machine-checkable "unblocked when" condition, so "the blocker is gone" is a judgment today. It becomes mechanical only if the marker gains such a condition; that is a design change to record when there is evidence for it, not a slice.

## Done when

1. **Executable** — a fixture-driven case in `we:scripts/__tests__/merge-ai-prs-ci-lifecycle-and-land-effects.test.mjs` reproduces the confirmed cause (a review-parked, not-`ready-to-merge` PR carrying `ci:failed` with a green latest required check) and fails before the fix, passes after.
2. **Probed live** — the same query over the real open PRs lists zero PRs with `ci:failed` and a green latest required check after one pass, and the cause found is written into this item's body.

## Cause found (live-confirmed 2026-09-25)

None of the three original hypotheses: the TOTAL-branch reconcile is already label/`--only`-blind (`collectOpenPrContext` lists every open PR across the constellation, not the `--label`-scoped candidate set — ruling out #1), and it is not a silent write failure (#3).

The real cause is a variant of #2 — `isAiGeneratedPr` really was `false`, but not because the PR's top-level GitHub author is human. `isAiGeneratedPr` never reads the PR author field at all; it reads `pr.commits`. The drain lands PRs with `gh pr merge --merge` (`we:scripts/lib/pr-merge-gate.mjs`'s `mergeMethodFlag` default), which leaves a GitHub-native `Merge pull request #NNN from owner/branch` commit on `main` for every landed PR, authored solely by `web-everything[bot]`. A long-lived lane that later merges `origin/main` into itself (a routine rebase-refresh — the OTHER, already-recognized-as-mechanical `Merge remote-tracking branch 'origin/main' into lane/…` shape) inherits every one of those bot-authored merge commits into its OWN open PR's `commits` list, because the PR's recorded base predates them.

Confirmed live against `chalbert/web-everything#2685` (`gh pr view 2685 --json commits`): its commit list carries `"Merge pull request #2688 from chalbert/lane/4091-resolve-item"`, sole author `web-everything[bot]`, body `"backlog: resolve #4091 -- merged to main via PR #2678"` (never empty — GitHub always fills a merge-commit's body with the merged PR's own title). The pre-fix `isMechanicalMergeCommit` only recognized `Merge branch`/`Merge remote-tracking branch` headlines AND required an empty body, so this commit counted as "substantive" and non-AI — which alone flipped `isAiGeneratedPr` to `false` for #2685 (otherwise 100% Claude-authored), disqualifying it from the #2421 TOTAL reconcile and leaving `ci:failed` on the PR straight through to merge. Live query at fix time: `gh pr list --repo chalbert/web-everything --state open --label ci:failed` returned `[]` (no currently-open PR carries the stale label — #2685/#2653 both already merged/cleared by hand before this session), so the "zero open PRs with `ci:failed` + green check" probe is satisfied vacuously; the fixture case is what proves the mechanism.

**Fix (part 1)**: `we:scripts/lib/ai-pr-authorship.mjs`'s `isMechanicalMergeCommit` now also recognizes the `Merge pull request #NNN from owner/branch` headline (GitHub's own merge-commit boilerplate) as mechanical regardless of body — it merges two trees and adds no authored content of its own, exactly like the empty-body local-merge shape it already excluded. Not a "widen who the reconcile covers" change and not a human-authored-PR policy question: the PR in question genuinely is AI work, misclassified by an authorship heuristic gap.

**Residual (found re-testing against #2685's REAL live commit list after part 1)**: `isAiGeneratedPr` still returned `false` for #2685. Its inherited history also carries the drain's OWN direct-to-main bookkeeping commits (`drain: rebase lane/xgqz204-… onto …, drop transient we:.lane-manifest.json`, `drain: JIT-number … at land`, `drain: resolve #NNN on land`) — genuinely NOT `Merge …` commits (so `isMechanicalMergeCommit` correctly leaves them alone: a script rewriting a real file is not content-free the way a merge commit is), authored solely by the drain's own git identity, with no Claude/human trailer. **This is not a new bug — it is an already-RATIFIED, named gap**: `classifyPr`'s own #2196/#2326 comment names it verbatim ("the drain's OWN rebase … commit stranded it"), and its ratified remedy was never to loosen `isAiGeneratedPr` (deliberately kept strict) but to certify via `certifyLabel || aiGenerated || humanCleared` instead (`ready-to-merge` is exclusively producer-applied, #2196; `review:accepted` is a human's own certification). The #2421 TOTAL ci-lifecycle reconcile had no such OR-path at all — a straight asymmetry with `classifyPr`.

**Fix (part 2)**: the TOTAL branch now certifies via the SAME condition `classifyPr` already uses (`isAiGeneratedPr(withCommits) || hasLabel(withCommits, READY_TO_MERGE_LABEL) || hasLabel(withCommits, REVIEW_LABELS.accepted)`), reusing #2196/#2326's ratified certification rather than inventing a second one or re-opening the deliberately-strict `isAiGeneratedPr` definition. Re-verified against #2685's real live data (commits + labels): `isAiGeneratedPr` is `false`, but it carries `ready-to-merge` (and `review:accepted`), so it now certifies and its ci-lifecycle labels reconcile correctly.
