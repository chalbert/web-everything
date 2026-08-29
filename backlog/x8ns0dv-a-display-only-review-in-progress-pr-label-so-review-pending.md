---
kind: story
size: 3
parent: "2612"
status: open
dateOpened: "2026-08-29"
relatedTo: ["375", "3296", "2279", "2974"]
scope:
  - we:scripts/lib/review-escalation.mjs
  - we:scripts/review-set-label.mjs
  - we:scripts/__tests__/review-escalation.test.mjs
  - we:scripts/__tests__/review-set-label.test.mjs
tags: [conveyor, delivery, review, legibility, operator]
---

# A display-only review:in-progress PR label, so review:pending stops meaning two things

`review:pending` currently answers "is a review owed?" and is read as if it answered "is a review
running?" — two different facts. Every in-flight signal the system has is host-local (the run store, the
`we:scripts/review-runner.mjs` singleton lease, the jury ledger), so from GitHub a PR whose juror started
ten seconds ago is indistinguishable from one nothing has touched for a day. Add `review:in-progress`
as a PURELY COSMETIC label: something writes it when it dispatches a reviewer, every verdict swap strips
it, and NOTHING reads it. Same shape as #375's `preparing` chip — a legibility gap, not new safety.

## Nothing derives from it — this is the whole constraint

The label is for a person glancing at the PR list. It is NOT a claim, NOT a lease, and NOT a mutex, and
the item is mis-built the moment anything branches on it:

- **It cannot be a mutex anyway.** GitHub label writes have no compare-and-swap, so two dispatchers both
  read "absent" and both write it. Anything that trusts it as a claim is trusting a race.
- **It must not reach `classifyPr`** (`we:scripts/progress-board.mjs`). That function is BORROWED by
  `we:scripts/conveyor/reconcile-core.mjs` as its phase input, so a new phase there is a new *dispatch*
  input — exactly the derivation this item forbids. The board keeps rendering the `review:pending`
  phase; GitHub's own label chip is the display surface.
- **It must stay out of** `REVIEW_HOLD_LABELS` / `isReviewHoldLabel` / `hasUnclearedReviewLabel`
  (`we:scripts/lib/review-escalation.mjs`), and out of every discovery filter —
  `partitionRunnerPRs`, `we:scripts/fetch-parked.mjs`, `we:scripts/review-runner.mjs`. A PR carrying it
  is picked up, parked, merged and reviewed exactly as if it did not.
- **It touches no INVARIANT-2 path.** It is not a disposition, so `decideSetLabel`'s refusals
  (`accepted` on a `review:human` PR, the #2844 independence check) neither read it nor change.

## The write path is NOT free — PR #1680 review, rounds 1-3

The first draft of this card said adding `in-progress` / `clear-in-progress` to `REVIEW_LABEL_TARGETS`
was a self-contained edit that wrote no comment and no ledger row. That was false in two independent
ways, both re-verified against `we:scripts/review-set-label.mjs` at `45aaf2d0`, and a builder following
it would have shipped the bug:

1. **`decideSetLabel` has no default-refuse.** Its branches are `restamp`, `rearm`, `clear-human` and
   `accepted`; anything else FALLS THROUGH to the `changes` bounce. A bare array addition therefore makes
   `--to=in-progress` return `addLabel: 'review:changes'` with
   `removeLabels: ['review:pending', 'review:accepted', 'ready-to-merge']` — dispatching a reviewer would
   silently record a changes-requested verdict and strip the hold labels.
2. **`runReviewLabelCli` writes unconditionally.** It builds the durable comment (`buildComment`) and
   attempts the ledger append (`appendVerdict(buildVerdictRecord(...))`) for EVERY `to` that passes the
   `REVIEW_LABEL_TARGETS` membership check, structurally independent of what `decideSetLabel` returned.
   So even a correct new branch still posts a comment and a ledger row on every dispatch.

The live totality suite is `#2974` — `decideSetLabel — totality over REVIEW_LABEL_TARGETS × starting
label sets`, at `we:scripts/__tests__/review-set-label.test.mjs:120`. It reddens with 16 named failures
on a bare array addition, which is the gate that catches (1). Nothing catches (2). **#2959 is NOT that
gate** — it is an open proposal for a totality checker and was mis-cited here as live.

## Build

- **`we:scripts/lib/review-escalation.mjs`** — add `inProgress: 'review:in-progress'` to `REVIEW_LABELS`
  and an entry to `REVIEW_LABEL_META` (grey, e.g. `BFD4F2`; the description should say *display only —
  nothing derives from it*, since that description is what a future reader sees on GitHub). #2279's
  on-demand upsert in `we:scripts/merge-ai-prs.mjs` then mints it with no bootstrap step.
- **Split VERDICT targets from COSMETIC ones** (`we:scripts/review-set-label.mjs`) — this is the real
  work of the item, not a detail. `in-progress` / `clear-in-progress` join `REVIEW_LABEL_TARGETS` AND
  get their own `decideSetLabel` branch (add/remove only this label, never a verdict label), AND a
  predicate — one place naming which targets RECORD A VERDICT — that gates the comment build and the
  ledger append in `runReviewLabelCli`. A cosmetic target must reach neither writer.
- **Do not route it around the single home.** A separate cosmetic label writer would dodge all of the
  above, and is rejected: #2644 makes `we:scripts/review-set-label.mjs` the ONE place a label swap
  lands, and a second writer is exactly the drift that rule exists to prevent. The cost of honouring it
  is the predicate above.
- **Strip it on every terminal swap** — add the label to the `removeLabels` of the `accepted`, `changes`,
  `rearm` and `clear-human` branches of `decideSetLabel`. `presentRemoveLabels` already narrows removals
  to labels the PR actually carries, so this is inert on a PR that never got tagged.
- **Caller** — whoever dispatches a reviewer sets it (the conveyor's review dispatch; a person running
  `/review` may set it by hand). Deliberately NOT the juror: on a cloud judging host the only outbound
  write is `git push` (`we:agent-memory-src/workflow-cloud-vm-github-api-boundary.md`), so a tag written
  from there would arrive via the staged-request transport possibly after its own verdict.

## Residual, accepted

A reviewer that dies mid-run leaves the label behind, and a label carries no TTL to expire it. That
costs a stale chip on a PR list and nothing else — precisely because nothing derives from it — and the
next verdict swap strips it. No sweeper in this item.

## Done when

1. **Executable** — `npx vitest run we:scripts/__tests__/review-escalation.test.mjs we:scripts/__tests__/review-set-label.test.mjs`
   passes with four NEW assertions that fail before this lands:
   (a) an INERTNESS equivalence — `decideReviewGate` (`we:scripts/lib/review-escalation.mjs`) called with
   `labels: ['review:accepted', 'review:in-progress']` deep-equals the same call with
   `labels: ['review:accepted']`, and likewise for a `review:pending` pair;
   (b) `REVIEW_HOLD_LABELS` does not contain `REVIEW_LABELS.inProgress` and
   `isReviewHoldLabel('review:in-progress')` is `false`;
   (c) every `decideSetLabel` branch that returns `allowed: true` for `accepted` / `changes` / `rearm` /
   `clear-human` lists `REVIEW_LABELS.inProgress` in its `removeLabels`;
   (d) `decideSetLabel({ to: 'in-progress', … })` returns `addLabel: 'review:in-progress'` and an EMPTY
   `removeLabels` — pinning that it did not fall through to the `changes` bounce.
2. **Executable** — the cosmetic targets reach neither writer: a `runReviewLabelCli` test with stubbed
   `buildComment` / `appendVerdict` seams pins that `--to=in-progress` calls NEITHER, while
   `--to=accepted` calls BOTH.
3. `npm run check:standards` is no worse than at branch point.
