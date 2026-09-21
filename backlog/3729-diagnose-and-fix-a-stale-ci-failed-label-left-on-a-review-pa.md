---
bornAs: xmgv6bx
kind: story
size: 3
parent: "3718"
status: open
relatedTo: ["2421", "3720"]
scope: ["we:scripts/merge-ai-prs.mjs", "we:scripts/__tests__/merge-ai-prs-ci-lifecycle-and-land-effects.test.mjs"]
dateOpened: "2026-09-19"
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
