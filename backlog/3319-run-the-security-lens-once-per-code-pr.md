---
bornAs: xn9c3mh
kind: story
size: 3
parent: "3318"
status: open
dateOpened: "2026-08-26"
scope:
  - we:scripts/operations/review-pr.mjs
tags: []
---

# Run the security lens once per code PR

Of the 92 replayed cases, 87 recorded a lens row and **86 of those 87 were `correctness`**. The security lens ran exactly once — #1457 r2 — and declared exactly **one** finding: the run-store / agent-listing seat-forgery hole at `we:scripts/operations/explore-io.mjs:165`. That single finding is the whole of the evidence that a second lens sees something the incumbent misses. One juror, parallel with correctness, on code PRs only, at roughly 29 cents per PR amortised. Size the decision against evidence of **one**, not more.

> **Retracted — this card's opening sentence was wrong on both halves, re-counted 2026-08-26 over `we:scripts/review-corpus/cases` (92 case files plus `we:scripts/review-corpus/cases/index.json`).**
> It read *"All 84 recorded verdicts ran correctness alone. Security ran once and found two real forgery holes in
> we:scripts/operations/explore-io.mjs, the only lens with evidence it sees something the incumbent misses."*
> **(a)** There is no population of 84 anywhere in the corpus — the parent card `3318` retracts the same figure.
> Measured: 92 cases, 87 record a lens row, 86 of those `correctness`. And "alone" is false: #1457 r2 is `security`.
> **(b)** The security lens declared **one** finding, not two. The second `we:scripts/operations/explore-io.mjs`
> hole — the Nunjucks raw-block injection in `renderResearchTopic` — is recorded in
> `we:scripts/review-corpus/cases/1457-r1.json` under lens `correctness`, so it was the incumbent lens's catch.
> Crediting it to security doubled the evidence for the very claim this card is built on.

## Done when

1. **Executable** — `npx vitest run we:scripts/operations/__tests__/review-pr.test.mjs -t "#3319"` (drop the
   `we:` prefix when actually running it). Fails before this item lands — no `judgeSecurity` step exists and
   the run reaches `confirm` after ONE judge suspend — and passes after.
2. `npm run check:standards` — 0 errors.

## What shipped

A **second declared `judge` step**, `judgeSecurity`, in
[we:scripts/operations/review-pr.mjs](../scripts/operations/review-pr.mjs) — same request recipe
(`buildReviewJudgeRequest`, extracted so the two seats cannot drift), `MANDATORY_LENSES[1]` instead of
`input.lens`, and **not** reachable from the command line. `reduce` now composes the two seats through
`derivePanelVerdict` + `buildPanelFindings` (#2310's ratified reduction, imported), and the write-up renders
the seats that actually judged.

### The option that was rejected, and why it matters

**`judgePanel` (#3050) was NOT wired.** Its per-seat call object omits `allowedTools`, so every panel seat is
`--tools ''` — that is **#3158, still open**. Today's juror is tool-bearing (`REVIEW_JUROR_TOOLS`), and
[we:scripts/lib/judge-spawn.mjs](../scripts/lib/judge-spawn.mjs)'s own header records why that matters: *"The
tools ARE the finding mechanism."* Wiring the panel would have bought the second lens by making BOTH jurors
unable to run a gate, reproduce a hole or mutate a line. Two declared `judge` steps buy the same
pairwise-distinct actors — session ids derive from `runId` + `lens`, and the lenses differ — with no part of
#3158's bill paid.

Two sequential `review-pr` RUNS was rejected too: each run owns a whole `record` step, so it is two durable
comments, two label swaps, two ledger rows and a double-counted `deriveLoopOutcome` round for one review.

### The residual — "on code PRs only" is NOT implemented

It is not implementable inside the declaration, and the reason is structural rather than an omission. The step
list is fixed at REGISTRATION, before any PR is read; the engine runs every declared step at its cursor; and
`advance`'s `judge` case refuses a request that is not `{mandate, input, shape}`-shaped, so a step cannot
decline to judge. An input cannot gate it either — an input changes what a step ASKS, never whether it RUNS.
So a docs-only PR pays for a security juror. Gating belongs to a caller that knows the touch-set before it
starts the run (the drain), or to a conditional step the four-kind statute (#3031) forbids. Stated in the
file header rather than hidden.

### Known follow-up, not fixed here

`factsFromRun` in [we:scripts/operations/record-verdict.mjs](../scripts/operations/record-verdict.mjs) takes
the FIRST telemetry `sessionId`, which is now one of two. The independence marker it carries is therefore
partial rather than wrong. Out of this item's scope.
