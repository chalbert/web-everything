---
bornAs: xme425q
kind: story
size: 2
status: open
priority: high
dateOpened: "2026-08-06"
relatedTo: ["2409", "2750", "2838", "2895"]
scope:
  - we:scripts/review-set-label.mjs
  - we:scripts/__tests__/review-set-label.test.mjs
tags: [review, gate, invariant, atomicity]
---

# Post the review verdict comment BEFORE the label swap — the unsafe half lands first

`runReviewLabelCli` splits one logical act across two non-atomic `gh` calls and orders them so the UNSAFE half
lands first. Any failure between them leaves an accepted PR with no `reviewed-sha` marker, and
`acceptanceCoversHead` fails OPEN on a missing marker — so the drain merges with the #2409 staleness gate
silently disarmed.

Surfaced by the round-4 `/review` of **PR #1056** (#2895's implementation) and kept after an adversarial
red-team pass that tried to refute it and could not.

## The ordering

[we:scripts/review-set-label.mjs](scripts/review-set-label.mjs) `runReviewLabelCli`:

1. the comment body is rendered (**pre-swap**),
2. the `GH_COMMENT_MAX` size guard runs on those rendered bytes,
3. **`gh pr edit`** applies the label swap — this is the half the drain acts on,
4. **`gh pr comment`** posts the durable record — this is the half that carries the `reviewed-sha` marker,
5. the labels are re-read for the printed result.

There is no try/catch spanning 3 and 4, no rollback, and no retry. A failure at step 4 calls `fail(…, 1)` and
exits non-zero — with the label swap already durable.

## Why the consequence is real, not theoretical

- `acceptanceCoversHead` ([we:scripts/lib/review-escalation.mjs](scripts/lib/review-escalation.mjs)) returns
  `{ covers: true }` when either side is absent — documented, deliberate fail-open.
- `parseReviewedSha` returns `null` when no marker exists.
- [we:scripts/merge-ai-prs.mjs](scripts/merge-ai-prs.mjs) hands both to `decideReviewGate`, which merges on
  `covers: true`.

So `review:accepted` + no marker + a head that has since advanced = **merges, gate disarmed**.

This module has been patched **twice** for the size-driven instance of this exact partial state (PR #1005, and
#1056's M2 / #1057's rendered-bytes guard). Each fix guarded a known *cause*. Transient failure — a 5xx, a rate
limit, a network blip, a tmp-file write error — has no cause-side guard and cannot be given one. The ordering
itself was never questioned; there is no doc, backlog item, or design note anywhere defending it.

## The fix, and why it is cheap

**Swap steps 3 and 4: post the comment first, then the labels.** A comment with no swap is inert and the command
is re-runnable; a swap with no comment is neither.

- **No data dependency.** `decision`, `headSha` and the rendered `commentBody` are all computed BEFORE the edit
  today. Reordering is moving one block above another — zero data-flow change.
- **An orphan marker is provably inert.** `parseReviewedSha` is only ever reached behind a `review:accepted`
  label check ([we:scripts/merge-ai-prs.mjs](scripts/merge-ai-prs.mjs)), and `decideReviewGate` only consults
  the accepted SHA inside its `accepted`-label branch. No label ⇒ the marker is never read. And when an orphan
  marker later coexists with a legitimately-applied label it can only make the gate **stricter** — a concrete
  SHA replaces the `null` that fails open. It can never manufacture coverage the label did not already assert.
- **It repairs a currently-false contract.** [we:scripts/lib/auto-land-seam.mjs](scripts/lib/auto-land-seam.mjs)
  catches the CLI's non-zero exit and returns `{ landed: false }`, documented as "fail-closed — the PR stays
  parked". Under today's order that claim is false: `gh pr edit` succeeded, the PR *is* accepted, and the seam
  reports it parked. Comment-first makes the documented contract true.

## Severity — medium today, high on the enforce flip

The unattended writer is not armed:
[we:scripts/lib/review-policy.contract.json](scripts/lib/review-policy.contract.json) has `landMode: "shadow"`
and `runAutoLandSeam` has no production caller. Today's live callers are the interactive `/review` ceremony (a
human sees the non-zero exit) and the conveyor's
[we:scripts/conveyor/rearm-review.mjs](scripts/conveyor/rearm-review.mjs) (whose `buildComment` stamps no
marker, so a lost rearm comment is audit-only). **This goes high the moment #2838 flips `landMode` to
`enforce`** — a filed, intended change. Fix it before that lands, not after.

## Stated precisely — two things this item does NOT claim

Both were corrections from the red-team pass; recording them so the item is not over-sold.

1. **Recovery exists today; it is lossy, not impossible.** After a failed `clear-human` comment, re-running
   `--to=clear-human` correctly refuses ("nothing to clear"), but `--to=accepted` then succeeds: `isHuman` is now
   false, `presentRemoveLabels` narrows the absent labels to `[]`, the edit degenerates to an idempotent
   `--add-label review:accepted`, and `buildVerdictComment` **does** stamp the marker. What is genuinely lost is
   the ATTRIBUTION — the record renders the generic "Recorded by … via the Plateau Loop review console" instead
   of #2895's honesty-tax block. A degraded record, not a permanently disarmed gate.
2. **The reorder RELOCATES the partial state, it does not eliminate it.** Two non-atomic calls remain two
   non-atomic calls. Closing it fully needs reconciliation or rollback. This is a strict improvement, not a
   closure — say so in the code comment rather than letting a future reader believe the seam is sealed.

## Done when

- `gh pr comment` runs before `gh pr edit` in `runReviewLabelCli`, with a comment stating what the reorder buys
  (an orphan comment is inert; an orphan label is not) and what it does not (the act is still non-atomic).
- The end-to-end test's sequence assertion is updated — it currently pins
  `['pr view', 'pr edit', 'pr comment', 'pr view']`, and the order assertion there is incidental to its stated
  purpose (`presentRemoveLabels`).
- A test drives a comment-step failure and asserts NO `pr edit` reached `gh` — the mirror of the existing
  refusal tests, on the impure half.
- The `auto-land-seam` "fails closed — the PR stays parked" comment is either true or amended.
