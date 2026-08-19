---
bornAs: x39x752
kind: story
size: 5
status: open
dateOpened: "2026-08-18"
preparedDate: "2026-08-18"
scope:
  - we:scripts/review-set-label.mjs
  - we:scripts/__tests__/review-set-label.test.mjs
tags: [review, drain, gate, transport, cloud-vm, merge-safety]
---

# review-set-label emits an ordered apply-plan so a host without gh can still record a verdict

`we:scripts/review-set-label.mjs` is the SINGLE HOME (#2644) for the review label arc and reaches GitHub through
`gh` at five sites, two of which write. On a host where `gh` cannot authenticate — every cloud VM —
the whole `record` step dies, so a verdict can be COMPUTED but never RECORDED. This adds
`--emit-plan`: the home computes what it computes today (refusals, independence, the comment body
with its markers, the label add/remove set, and the ORDER the two writes must land in) and prints it
instead of executing it. A caller with GitHub access applies the steps in order. No decision moves
out of the home.

## Why the cloud-VM case is real, not hypothetical

Measured in a Claude Code cloud VM on 2026-08-18: `gh` INSTALLS (apt, v2.45.0) and still cannot
authenticate. GraphQL is refused by proxy policy; REST returns 403 with **or without** the
environment token; only the session's own connector holds a working credential and a shell process
cannot borrow it. Four PRs (#1463, #1465, #1466, #1467) were reviewed end-to-end through the declared
`review-pr` operation in that VM — ten findings, nine fixed — and every one still reads
`review:pending`, because the `record` step could not write. The judge half already runs anywhere;
the record half is the only thing pinning the loop to a `gh`-authenticated host.

Independence is NOT the blocker and this item does not touch it. `judge-spawn` already gives each
headless `claude -p` juror its own `--session-id`, so the clearing actor differs from the author by
construction (a *subagent* inherits and would not — that distinction is already documented in
`we:scripts/lib/judge-spawn.mjs`).

## The ORDER is the safety property, so the plan must carry it

`we:scripts/review-set-label.mjs` (#2964) picks the order from live state, and it is not constant:

- **`review:accepted` NOT already live** → COMMENT first, then swap. An orphan comment is inert
  (`parseReviewedSha` is only reached behind a live `review:accepted`), while an orphan LABEL makes
  `acceptanceCoversHead` fail OPEN and the drain merges with the #2409 staleness gate disarmed.
- **already live** (re-accept after a fix) → SWAP first. Comment-first would post a marker naming the
  live head while the acceptance is already live, so a failed swap would have freshened the coverage
  of an acceptance it never applied.

So the plan is an ORDERED list of steps, and the order is computed by the home — never re-derived by
the applier, which cannot see `currentLabels`. An applier that reorders the steps reintroduces exactly
the hole #2964 closed. The emitted plan must state the order's reason so a reader can tell the two
cases apart.

## The fork this does not pick: what happens to the ledger row

The verdict-ledger append currently runs BEFORE the writes and is deliberately fail-soft (Phase 1
shadow; a miss is reported as `unledgered`). Under `--emit-plan` nothing is written, so appending at
emit time would record a verdict that may never land.

**(a) Do not append; leave the PR `unledgered`.** Smallest, and the state is already modelled and
reported. Cost: an applied verdict carries no row until someone re-runs.
**(b) Emit the ledger record INSIDE the plan** as a step the applier hands back to a
`--record-applied` mode. Complete, but a three-step dance needing its own idempotency story.
**(c) Append at emit time and accept a possible orphan row.** Rejected in advance — a row for a
verdict that never landed is the one direction the Phase 2 posture ("a missing row means an
un-mergeable PR") cannot tolerate.

Recommend **(a)** for this slice, filing (b) if the row proves load-bearing before Phase 2. The
decision belongs on this card before build.

## The applier's label write is SET-semantics, and the plan must carry the final set

Checked against the connector's actual tool surface, because "something applies the plan" is only real if
the something can perform both writes:

| plan step | connector tool | shape |
|---|---|---|
| post the verdict comment | `add_issue_comment` | matches `gh pr comment` |
| swap the labels | `issue_write(method:'update', labels:[…])` | **replaces the whole set** |

`gh pr edit` takes `--add-label` / `--remove-label`; the connector takes *"labels to apply"*. So the two
appliers are NOT interchangeable, and the plan cannot simply carry `{add, remove}` and hope. It must carry the
resolved FINAL label set as well, computed by the home from `currentLabels` — which it already reads.

That introduces a race the `gh` path does not have: a label added between emit and apply (`ci:failed`,
`checking`, a human's own label) is WIPED by a full replace. Options, none picked: re-read labels at apply
time and refuse if they moved (needs a read step in the plan); carry both shapes and let the applier pick the
one its transport supports; or emit an expected-current set the applier compares first, refusing on mismatch.
The third is the closest analogue to `--force-with-lease` and is the recommended starting point.

`presentRemoveLabels` already intersects removals against live labels, so the home has everything it needs to
compute both shapes; this is about what the plan SAYS, not about new logic.

## Explicitly NOT in scope

- **A full transport port** (`readPrState` / `setLabels` / `postComment` / `readLabels` as swappable
  adapters). That is the larger shape and must reproduce the three-state applied / not-applied /
  indeterminate mapping the effect executor depends on: an adapter reporting failure on a landed write
  double-posts a durable comment; one reporting success on a lost write wedges the run. Worth doing
  only if plan-emission proves insufficient.
- **Any change to independence, the markers, `decideSetLabel`, or INVARIANT 2.** They run above the
  seam and stay byte-identical. `--emit-plan` must still REFUSE everything the executing path refuses,
  at the same point, and print no plan when it refuses.

## Done when

1. **Executable** — this fails before and passes after, on a case asserting `--emit-plan` prints an
   ordered plan and performs no `gh` call (an injected runner records zero invocations):

   ```
   npx vitest run scripts/__tests__/review-set-label.test.mjs
   ```
2. The emitted plan carries: repo, pr, `to`, the independence status, the resolved `addLabel`, the
   INTERSECTED `removeLabels` (`presentRemoveLabels`, so no absent label is ever handed to an edit),
   the RESOLVED FINAL label set (for a set-semantics applier — see the section above), the comment
   body, and the ordered steps with the order's stated reason.
3. Both orderings are covered: a PR already carrying `review:accepted` emits swap-then-comment; one
   not carrying it emits comment-then-swap.
4. Every refusal that blocks the executing path also blocks `--emit-plan`, proven by a test per
   refusal (INVARIANT 2 via `decideSetLabel`, the #2844 self-clear, the `clear-human`-without-
   `review:human` refusal). A refused run emits NO plan.
5. Applying an emitted plan by hand against a live PR produces the same end state as running the
   command normally — verified once, recorded on the card.

## De-risked during prep

- The five `gh` sites were read directly (lines 416, 439, 651, 664, 723): three reads, two writes.
  Site 416 (`gh repo view`) fires only when `--repo` is omitted and is avoidable by always passing it,
  so the plan models four operations, not five.
- The conditional ordering above was read off this file's own #2964 block rather than inferred,
  including its explicit note that the act is still NOT atomic — this item relocates nothing about
  that and must not claim to.
- The cloud-VM premise was measured in a live VM this session, not assumed: `gh` installed, both API
  surfaces refused, four PRs judged and none recorded.
