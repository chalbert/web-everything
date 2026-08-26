---
bornAs: xn9c3mh
kind: story
size: 3
parent: "3318"
status: resolved
dateOpened: "2026-08-26"
dateResolved: "2026-08-26"
graduatedTo: none
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

1. **Executable** — `npx vitest run review-pr -t "#3319" | grep -qE "Tests +[0-9]+ passed"`. Fails before this
   item lands — no `judgeSecurity` step exists and the run reaches `confirm` after ONE judge suspend — and
   passes after (17 passed | 176 skipped).
2. `npm run check:standards` — 0 errors.

> **The `grep` is load-bearing, and the bare form it replaces was vacuous.** The criterion first read
> `npx vitest run … -t "#3319"` with no pipe. A `-t` filter matching nothing is a selection of zero, and
> vitest treats an empty selection as success rather than as a miss — so on `origin/main`, where no `#3319`
> test existed, it exited **0**. The criterion was green before the work, in exactly the way the card claimed
> it would not be.
>
> *(The first version of this paragraph put that empty selection at "368 files and 9221 tests skipped". Those
> were a point-in-time read of an `origin/main` that has since moved and they no longer reproduce. Measured on
> this branch instead: a `-t` filter matching no test name reports `Test Files 368 skipped (368)` and
> `Tests 9232 skipped (9232)`, and still exits 0. The count is incidental; the zero-selection-exits-0
> behaviour is the point.)*
>
> The check must therefore assert that tests **ran**, not merely that the command returned. `Tests N passed`
> appears only when the filter selected something; an all-skipped line does not match it. Verified both ways
> before landing: non-zero on `origin/main`, zero on this branch — where it reports **17 passed | 176
> skipped**.
>
> This is `vacuous-executable-criterion`, one of the eight candidate gates in
> [we:scripts/review-corpus/gates.mjs](../scripts/review-corpus/gates.mjs) — written for the replay harness by
> the same session that then shipped the defect it detects.
>
> **Retracted — the two sentences that diagnosed why the gate stayed silent were both wrong**, and so was the
> claim that the gap had been filed. They read: *"The gate scores a **corpus of past reviews** and never runs
> against a backlog card, so it could not fire here. A detector pointed only backwards catches nobody. Filed
> as its own gap; not fixed in this item."*
>
> **It runs against backlog cards and nothing else.** `vacuousExecutableCriterion`'s first statement is
> `if (!/^backlog\//.test(path || '') || typeof read !== 'function') return [];`, and its registry entry reads
> `{ name: 'vacuous-executable-criterion', fn: vacuousExecutableCriterion, targets: 'backlog card' }`. It did
> see this card. Run directly against the pre-fix text — this file at commit `d2f8b77a`, `path` set to itself —
> it returns `[]`. So "point the detector forward" was a fix for a defect that does not exist, and would have
> closed nothing.
>
> **The real gap is the detector's *shape*.** It models one kind of vacuity only — a criterion demanding a
> named literal be **absent** — and bails at its `demandsAbsence` regex before reading any file. This card's
> vacuity was a different shape: a `-t` filter that selected **zero tests**, where an empty selection exits 0.
> Checked: that regex returns `false` against the pre-fix criterion text.
>
> **Now actually filed**, naming that shape:
> [#3340](/backlog/3340-the-vacuous-criterion-gate-models-one-shape-of-vacuity/). Not fixed in this
> item.
>
> *(Citation corrected 2026-08-26. This originally pointed at #3346, which turned out to be a second card for
> the same defect, filed one second after #3340. #3340 is the survivor; #3346 is resolved as a duplicate and
> carries `graduatedTo: "3340"`.)*

## What shipped

Landed on `origin/main` as **PR #1585** (merge commit `5a1d82b9`, 2026-08-26). Resolved by bookkeeping
reconciliation after the fact — the card was left `open` at land.

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

`factsFromRun` in [we:scripts/operations/record-verdict.mjs](../scripts/operations/record-verdict.mjs)
under-reports on **two** fields, not one — the first draft of this note said `sessionId` alone, which a
reviewer corrected:

- **`sessionId`** takes the first telemetry entry, which is now one of two.
- **`lens`** reads `record.input.lens` — the **CLI input**, i.e. what the FIRST seat judges. The
  `judgeSecurity` seat is not CLI-reachable by design, so it can never appear there. A transported verdict
  therefore names one lens where two jurors sat.

Both make the marker **partial rather than wrong**, and partial in the safe direction: it under-claims
independence and under-claims coverage. Neither invents a juror that did not sit. Out of this item's scope,
but the `lens` half is the one to fix first — an under-reported `sessionId` weakens a proof, while an
under-reported `lens` misdescribes what was actually reviewed.
