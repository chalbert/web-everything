---
bornAs: xme425q
kind: story
size: 2
status: resolved
priority: high
dateOpened: "2026-08-06"
dateStarted: "2026-08-08"
dateResolved: "2026-08-08"
relatedTo: ["2409", "2750", "2838", "2893", "2895"]
scope:
  - we:scripts/review-set-label.mjs
  - we:scripts/__tests__/review-set-label.test.mjs
  - we:scripts/lib/auto-land-seam.mjs
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

**Swap steps 3 and 4: post the comment first, then the labels.** On a PR that is not already accepted, a comment
with no swap is inert and the command is re-runnable; a swap with no comment is neither. That qualifier is
load-bearing — see "The hazard the reorder INTRODUCES" below, which the implementation must close.

- **No data dependency.** `decision`, `headSha` and the rendered `commentBody` are all computed BEFORE the edit
  today. Reordering is moving one block above another — zero data-flow change.
- **An orphan marker is inert — on a PR that carries NO live `review:accepted`.** `parseReviewedSha` is only
  ever reached behind a `review:accepted` label check (the read is lazy, inside
  `if (hasReviewLabel(v.prLabels, REVIEW_LABELS.accepted))` in
  [we:scripts/merge-ai-prs.mjs](scripts/merge-ai-prs.mjs)), and `decideReviewGate` only consults the accepted
  SHA inside its `accepted`-label branch. No label ⇒ the marker is never read, so a comment that lands with no
  swap behind it changes nothing and the command stays re-runnable. **That is the whole of the claim.** It
  covers the failure this item opens with — a FIRST accept, or a `clear-human`, on a PR that is not already
  accepted — and nothing beyond it. An earlier draft went further and said an orphan marker "can only make the
  gate **stricter**, a concrete SHA replacing the `null` that fails open". That is **false** and is retracted:
  when the label is already live the marker is not replacing `null`, it is replacing an OLDER marker, and
  freshening it is a loosening. See the hazard below.
- **It repairs a currently-false contract — for that same case, and only it.**
  [we:scripts/lib/auto-land-seam.mjs](scripts/lib/auto-land-seam.mjs) catches the CLI's non-zero exit and
  returns `{ landed: false }`, documented as "the PR stays parked". Under today's order that claim is false
  when the swap succeeded and the comment did not: `gh pr edit` landed, the PR *is* accepted, and the seam
  reports it parked. Comment-first makes the documented contract true **there**. It does NOT make it true on an
  already-accepted PR — the seam still reports `landed: false` while the failed run has just freshened the very
  marker that lets the drain merge. Same false contract, pointing the other way, and worse. This bullet rests
  on the bullet above and inherits its limit.

## The hazard the reorder INTRODUCES — a PR that already carries `review:accepted`

**The reorder is not universally stricter.** On a PR whose `review:accepted` label is already live, comment-first
opens a merge path that today's order closes — so this is a trade, not a free win, and the implementation must
close the new side of it.

The setup is the ordinary re-accept-after-a-fix flow the interactive `/review` ceremony drives: the PR was
accepted at some head, a commit has since ridden in, and the reviewer re-runs `--to=accepted` against the new
head. Nothing refuses that: `decideSetLabel` only refuses `accepted` on a `review:human` PR, and with
`review:pending` absent `presentRemoveLabels` narrows the removals to `[]`, so `gh pr edit` degenerates to an
idempotent `--add-label review:accepted`. Now let that edit fail — the same transient 5xx / rate-limit / network
blip this item is about, just on the other call.

1. **Today (edit-first):** the edit failed, so `fail(…, 1)` exits before `gh pr comment` runs. No new marker is
   posted and the durable one still names the OLD head. `acceptanceCoversHead` returns `covers: false`, and the
   #2409 staleness gate **re-parks** the PR — the correct outcome.
2. **Comment-first:** the comment is already durable, and it stamps the LIVE head (`headSha` comes from the same
   `gh pr view` this run made). `parseReviewedSha` takes the LATEST marker, so `acceptanceCoversHead` now
   returns `covers: true`; the still-live `review:accepted` label sends `decideReviewGate` straight to
   `action: 'merge'`. **The drain lands a tree no successful swap ever vouched for** — the staleness gate is not
   just fail-open here, it has been actively re-armed to say *covered* by a run that failed.

The failed run has FRESHENED the coverage of an acceptance it did not apply. The hazard reaches both
marker-stamping targets — `buildVerdictComment` emits the marker on `accepted` and `clear-human` only, so
`changes` and `rearm` are unaffected.

**So the reorder is a net win only if the implementation closes this.** Two shapes are on the table (pick one
when the work is done, don't default):

- **Keep the marker on the swap side of the seam** — post the durable record first WITHOUT the `reviewed-sha`
  line, swap, then stamp the marker. Preserves the whole benefit (an orphan record is still inert) and leaves
  nothing that can freshen coverage ahead of a swap.
- **Refuse the run outright** when the PR already carries `review:accepted` and the swap would be a no-op —
  smaller, but it removes the re-accept path that the #2409 gate depends on to un-stick a re-parked PR, so it
  needs its own replacement.

Either way, a test must drive *already-accepted + head advanced + `gh pr edit` fails* and assert the marker did
NOT advance. Without it the reorder trades a known hole for an unknown one.

## Severity — medium today, high on the enforce flip

The unattended writer is not armed:
[we:scripts/lib/review-policy.contract.json](scripts/lib/review-policy.contract.json) has `landMode: "shadow"`
and `runAutoLandSeam` has no production caller. Today's live callers are the interactive `/review` ceremony (a
human sees the non-zero exit) and the conveyor's
[we:scripts/conveyor/rearm-review.mjs](scripts/conveyor/rearm-review.mjs) (whose `buildComment` stamps no
marker, so a lost rearm comment is audit-only). **This goes high the moment `landMode` actually reaches
`enforce`.**

**The trigger is #2893, not #2838.** An earlier draft cited #2838; that is wrong. #2838 is **resolved**, and it
is a `kind: decision` that only ratified the *gate* on the flip — codified at
[we:docs/agent/platform-decisions.md#enforce-flip-triple-gated](docs/agent/platform-decisions.md#enforce-flip-triple-gated).
It flips nothing. The pending work is the **OPEN #2893**: the `enforceFlipReady({ ciStatus, reviewShadowLedger })`
predicate, the CI-status probe and shadow ledger that feed it, and the `check:standards` write gate that refuses
`landMode: enforce` until the predicate is ready. That is what arms the unattended writer, and it covers BOTH
arming paths — the `landMode` knob in `we:scripts/lib/review-policy.contract.json` *and* the hard-coded
`LAND_MODES.SHADOW` in `we:scripts/lib/review-runner-core.mjs`. Fix this item before #2893 lands, not after.

**The ordering edge belongs on #2893, not here.** `blockedBy` means "cannot start until the listed item is
resolved", and on this prerequisite the direction runs the other way: this item gates #2893, not the reverse.
Writing `blockedBy: ["2893"]` in *this* file would invert the DAG and wrongly hide ready work — the conservative
rule in [we:docs/agent/backlog-workflow.md](docs/agent/backlog-workflow.md) ("Keep the blocker DAG honest").
So the machine-readable half lives on the dependent: **#2893 carries `blockedBy: [… , "2964"]`**, and this note
records the same fact from the near side.

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
- **The already-accepted hazard is closed and covered by a test** — a run against a PR already carrying
  `review:accepted`, at a head the marker does not cover, whose `gh pr edit` fails, must NOT leave a marker
  naming the live head. See "The hazard the reorder INTRODUCES" above; pick one of the two shapes named there
  and say in the code comment which, and why.
- **Every comment in [we:scripts/review-set-label.mjs](scripts/review-set-label.mjs) that asserts the swap lands
  FIRST is rewritten** — after the reorder the file would otherwise document its own opposite. Against `main` @
  `d26d5cc7` they are:
  - `:49-52` — the `REVIEW_LABEL_TARGETS` doc: "…the label swap landed, and `gh pr comment` then failed —
    leaving an ACCEPTED PR with no `reviewed-sha` marker".
  - `:340-346` — the size-guard comment: "THE SIZE GUARD, on the RENDERED bytes, **before the swap**. …and the
    swap lands FIRST".
  - `:485-490` — `projectVerdictCommentLength`'s doc: "…PASSED the pre-flight, the label swap landed, and
    `gh pr comment` then failed on GitHub's cap". *(Not named in the PR #1073 review; found while confirming
    the two above.)*
  - `:506-510` — the CLI `--body-file` pre-flight: "the label is applied first and the comment posted second".
    *(Likewise found while confirming.)*
  None can simply be deleted — each states the CAUSE its guard exists for, so re-state that cause in the new
  order. The size guard still earns its keep: an oversize comment now fails before ANY write, rather than after
  the swap.
- `runReviewLabelCli`'s own header (`:211-212`) claims it "[f]ails closed — every input is validated BEFORE any
  gh mutation, and any gh error exits non-zero **without a partial swap**". That is false today and stays false
  after the reorder (two non-atomic calls remain two). Amend it to name which half is now the safe one to lose.
- The `auto-land-seam` "fails closed — the PR stays parked" comment is either true or amended — and the
  amendment must be honest about the already-accepted case, where a `landed: false` run can still have
  freshened the marker.
