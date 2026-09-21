---
kind: story
size: 3
parent: "3383"
status: open
relatedTo: ["3712", "3692"]
scope: ["we:scripts/lib/advisory-labels.mjs", "we:scripts/operations/review-pr.mjs", "we:scripts/operations/review-pr-io.mjs", "we:scripts/operations/operator-queue.mjs", "we:scripts/operations/review-loop-cli.mjs"]
dateOpened: "2026-09-21"
tags: []
---

# A review:human PR whose unattended advisory carries no verdict never reaches the operator's NEEDS YOU

The unattended review of a `review:human` PR can finish without producing any advisory VERDICT the operator queue can use, so the PR sits in NOT READY as "no advisory verdict" and never reaches NEEDS YOU, even when both mandatory lenses accepted. The missing label is only the symptom. Operator, 2026-09-21: "it's not just a question of label, they really have no advisory". Design-first and deliberately not cleared for the conveyor. Relates #3712 (the `advisory:accepted` / `advisory:changes` label pair and the queue gate) and #3692.

## FOUND (2026-09-21)

- **The queue's rule.** we:scripts/operations/operator-queue.mjs lists a `review:human` PR in NEEDS YOU only with `advisory:accepted` and neither `review:pending` nor `review:changes`. With no parsable advisory comment for the head it reports "no advisory verdict".
- **What counts as an advisory.** `parseAdvisories` in we:scripts/lib/advisory-labels.mjs accepts a comment only if it has BOTH a `**Verdict:**` line and a `Net basis: <base>..<head>` line; the outcome comes from an `**Advisory outcome:** accept|changes` line. `labelForOutcome` maps only `accept` and `changes` to a label; anything else maps to none.
- **Who sets the label.** Only the `advise` step of the declared `review-pr` operation: `renderAdvisoryNote` in we:scripts/operations/review-pr.mjs writes the comment, and the sink in we:scripts/operations/review-pr-io.mjs applies the label through `planAdvisoryLabels`; we:scripts/conveyor/advisory-label-sweep.mjs drops it on a new commit. The unattended path is `review-dispatch` then we:scripts/operations/review-loop-cli.mjs.
- **Why nothing set it on this path.** `advisoryLabelOutcome` returns null unless the read judged a pinned commit (`netBasis.rev` present and not degraded). When the read is degraded, `renderAdvisoryNote` prints "DEGRADED BASIS" in place of the `Net basis:` line and prints no outcome line, so `parseAdvisories` skips the comment and no label is applied. Checked on GitHub 2026-09-21: the advisory comments on `review:human` PRs #2371, #2373 and #2374 (posted 13:40 to 13:43 UTC) each say verdict "human review required", disposition "converge with an advisory fix — a human must still clear it before merge", correctness = accept and security = accept, 2, 2 and 1 findings, "DEGRADED BASIS (`ref-unresolved`)", no `Advisory outcome` line and no `Net basis` line, and state "No review:* label was changed and no decision was recorded". The operator cleared the human gate on them by hand (#2371 at 13:46 UTC and merged; #2373 and #2374 carried `review:accepted` when checked).
- **The mapping itself is not the fault when the basis is pinned.** `deriveAdvisoryOutcome` (we:scripts/operations/review-pr.mjs) reduces the panel with the human gate factored out, so an all-accept panel with no finding at or above the prevention bar (`PREVENTION_IMPACT_BAR`, we:scripts/lib/jury-core.mjs) yields `accept`; anything else yields `changes`. This was read in code, not run on these three PRs.
- **Not established.** Why the read was degraded with `ref-unresolved`: `review-pr-io` says that path is for a PR head this clone has not fetched, but I did not determine why it happened in these three runs.

## DESIGN TO SETTLE

1. **Degraded basis.** Fetch the PR head so the review pins a commit, or emit a NAMED outcome for "advisory could not judge a pinned head" (with the reason) instead of silence, and show it in the queue with that reason rather than "no advisory verdict".
2. **All accept, only non-blocking findings.** Must this yield `accept` (`advisory:accepted`, findings listed as follow-ups)? The code says yes on a pinned head; confirm that is the intent, and whether "owed prevention" findings stay follow-ups.
3. **What makes it `changes`.** State the severity or impact bar in one place.
4. **A third class, "needs a human anyway".** Whether it exists, what it means, and how the queue shows it (NEEDS YOU with the finding count and highest severity, or a separate group).
5. **One mapping.** A single pure function from panel result to advisory outcome, shared by the review loop and the queue, so the two cannot disagree.

## Done when

1. **Executable** — `npx vitest run we:scripts/lib/__tests__/advisory-labels.test.mjs we:scripts/operations/__tests__/operator-queue-entry.test.mjs` passes, with new fixture cases that fail today: a panel with two accept verdicts and one cosmetic finding on a pinned head yields `advisory:accepted` and the queue lists that PR in NEEDS YOU; a panel with a blocking finding yields `advisory:changes`; a read with a degraded basis (`ref-unresolved`) yields a named outcome with its reason (not silence), and the queue shows that reason instead of "no advisory verdict".
2. **Executable** — one pure function maps a panel result to the advisory outcome, and both the `advise` step and the queue call it (a test imports it from that one home).
