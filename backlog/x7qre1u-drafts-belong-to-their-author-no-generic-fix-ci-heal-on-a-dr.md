---
kind: story
size: 8
priority: high
status: open
scope: ["we:scripts/conveyor/reconcile-core.mjs", "we:scripts/operations/ci-heal-pr-dispatch.mjs", "we:scripts/conveyor/review-status-tag.mjs", "we:scripts/conveyor/build-dispatch-claim.mjs", "we:scripts/conveyor/fix-dispatch-claim.mjs", "we:scripts/operations/deliver-item-wrapper.mjs", "we:scripts/operations/promote-draft-pr-dispatch.mjs", "we:scripts/merge-ai-prs.mjs", "we:scripts/conveyor/parked-pr-conflict-watch.mjs", "we:scripts/lib/pr-events.mjs", "we:scripts/verify-lane.mjs", "we:scripts/conveyor/__tests__/reconcile-core.test.mjs", "we:scripts/operations/__tests__/ci-heal-pr-dispatch.test.mjs", "we:scripts/__tests__/merge-ai-prs-draft-invisible.test.mjs"]
dateOpened: "2026-09-28"
tags: []
---

# Drafts belong to their author: no generic fix/ci-heal on a draft; red CI on a draft goes back to the author

PR #2855 (building #4349) was a draft with a real soak break written and about to be pushed when the resident ci-heal daemon healed the red we:.github/workflows/soak-replay-gate.yml check by pushing a soak-waiver instead, orphaning the author's real work. we:scripts/conveyor/reconcile-core.mjs's ci-heal branch and its stacked-conflict fix branch carry no isDraft gate (we:scripts/conveyor/review-status-tag.mjs already says a draft is never exempt from CI healing — only from review), and we:scripts/conveyor/build-dispatch-claim.mjs retires the delivery agent's own claim the moment a PR opens, draft or not. Review already refuses drafts; generic fix/ci-heal must too, while the author's claim survives its own draft.

## Operator ruling (2026-09-28, refined twice after the initial ask)

**"The builder is responsible until the PR is not in draft."** Ownership of a draft PR belongs to the delivery
item/builder from open until it is promoted out of draft (its required checks all green — the SAME promotion
`we:scripts/operations/promote-draft-pr-dispatch.mjs` already performs). That does not mean the builder must fix
red CI itself: it MAY delegate to a specialist fixer through a **local request marker → dispatcher → specialist
session** path (the same pattern `we:scripts/verify-lane.mjs`'s own `request` mode already uses: an interactive
session drops a `request`-stamped marker, and a separate mechanical pass — there, `we:scripts/conveyor/verify-dispatch.mjs` —
picks it up on its next tick and runs it to completion; the specialist-role delegation card the operator named,
`xs57vx3`, is the general form of this same shape) — **never through the fix/ci-heal daemon's `we:reconcile-core.mjs`
path**, which is heavier (an independent agent dispatch, a claim, a review-adjacent comment thread) for a case
that is really "the builder's own next step, possibly handed to a cheaper specialist." The signal that a draft's
CI went red should come from the webhook/PR-events feed (`we:scripts/lib/pr-events.mjs`, #2812) or the verify
result the builder's own lane already produces — **never from a daemon polling `gh pr list` for draft state**,
which is exactly the GraphQL-budget pressure #2812 was built to relieve. Only after promotion do the review/fix
daemons take over, unchanged from today.

**"A draft is invisible to every daemon except its author's path."** The drain must not comment, label, or
otherwise touch a draft PR at all — not even a "skip" comment. Live evidence: draft PR #2835 got a
`drain-skip-reason` comment ("required check 'test' is not green" / "merge state ... DRAFT⇒not landable") from
`we:scripts/merge-ai-prs.mjs`'s own skip path (`decision = 'skip'` at line 661, `... DRAFT⇒not landable ... left
for its author`) — the DECISION not to land was already correct, but the drain still spent a `gh` write telling
the author something they already know (their own PR is a draft). Same principle extends to
`we:scripts/conveyor/parked-pr-conflict-watch.mjs`, which today has NO `isDraft` check anywhere in its detection
loop and will apply `merge-status:conflicting` + a comment to a draft exactly as it would a ready PR — and to
`we:scripts/conveyor/review-status-tag.mjs`, whose labels beyond the author's own `awaiting-ci` status (see
Design) must not be applied to a draft either.

## Design

**Ownership window.** A PR is "author-owned" from `isDraft: true` at open through the first tick where
`we:scripts/operations/promote-draft-pr-dispatch.mjs` un-drafts it (all required checks green). Every mechanical
daemon this card touches gates on this SAME `pr.isDraft` field already threaded through `we:reconcile-core.mjs`
(see `deriveReviewStatus`'s existing `isDraft` param) — no new draft-detection is invented.

**Generic fix/ci-heal refuses a draft, mirroring the EXISTING review refusal exactly.**
`we:scripts/conveyor/reconcile-core.mjs`'s `dispatchReviewRow` already refuses review on `pr?.isDraft` FIRST,
ahead of every other check (around line 1063: `if (pr?.isDraft) refuse('draft', ...)`). The ci-heal branch
(`phase === 'ci-red'`, lines ~1532-1709) and the two conflict-fix branches (stacked-rebase ~1930-1940, main-base
~2040) get the IDENTICAL refusal shape, checked first, for the same reason: a draft's red check or conflict is
the author's own problem to resolve or delegate, not the daemon's. `we:scripts/operations/ci-heal-pr-dispatch.mjs`
(the execution-side operation, which today has ZERO mention of `draft` anywhere) gets the same guard as a second,
defense-in-depth layer — a planning refusal that the execution layer could still race past on a stale plan.

**The delegation path a builder MAY use instead of fixing it personally**, modeled on `we:scripts/verify-lane.mjs`'s
`request`/`check` shape: the builder (or its wrapper) drops a request marker naming the role needed (e.g.
`ci-fix`) on its OWN lane; a dispatcher (the mechanism `xs57vx3` declares) picks it up and launches a specialist
session scoped to that one fix, cheaper and less `gh`-heavy than a full reconcile-core round because it never
re-derives review status, never posts a review-adjacent comment thread, and works directly in the builder's own
lane rather than a fresh clone. This card wires reconcile-core's draft branches to STOP short-circuiting into
`kind: 'ci-heal'`/`kind: 'fix'` for a draft, but does not itself build the dispatcher — that is `xs57vx3`'s job,
named here as a hard prerequisite (`blockedBy`).

**The author's claim survives its own draft.** `we:scripts/conveyor/build-dispatch-claim.mjs` retires a claim
"when an open PR delivers the item" (its own header, lines 14-15) — today that fires the INSTANT the PR opens,
draft or not, which is exactly how PR #2855's claim went stale while the author was still actively pushing to
it. The retirement condition becomes "an open PR delivers the item AND that PR is not a draft" — the claim
survives the whole author-owned window and is retired at the SAME promotion tick that flips ownership to the
review/fix daemons, never earlier. `we:scripts/operations/deliver-item-wrapper.mjs` (the delivery agent's own
process) is the other half: it must refresh/hold this claim for as long as it keeps pushing to its own draft, and
release it only at real exit — the same terminal-outcome discipline #4349 is already building for this exact
claim's settlement, reused rather than duplicated.

**Signal source: push, not poll.** Any NEW code this card adds that needs to know "did this draft's CI just go
red" reads it from `we:scripts/lib/pr-events.mjs`'s webhook feed (the daemon-side client already built for
#2812) or from the builder's own `we:scripts/verify-lane.mjs` result — never a new `gh pr list` poll loop. This
does not touch `we:pr-events.mjs` itself; it is a consumption rule for whatever this card wires, not a new feature
of that module (hence its presence in `scope:` is for the WIRE-UP call site, not an edit to the module).

**The drain stays completely silent on a draft — no exception for a "helpful" skip note.**
`we:scripts/merge-ai-prs.mjs`'s skip DECISION for a draft (line 661) is already correct and unchanged; what
changes is that a draft PR is filtered out BEFORE the comment-writing step ever runs for it, so no
`drain-skip-reason` comment, no label, no `gh` write of any kind reaches a draft. `we:scripts/conveyor/parked-pr-conflict-watch.mjs`
gains an `isDraft` exclusion at the top of its detection loop (mirroring the review refusal's "checked first"
placement). `we:scripts/conveyor/review-status-tag.mjs` keeps its own `awaiting-ci` status for a draft (that IS
the author's-own-status the operator's exception names) but applies no OTHER label a ready PR would get.

## Interfaces

- `we:scripts/conveyor/reconcile-core.mjs` — new refusal reason `'draft'` (reusing the SAME string
  `dispatchReviewRow` already uses) added to the ci-heal branch and both conflict-fix branches, each checked
  FIRST in that branch, each producing the same `{ role, reason: 'draft', why }` shape review's own refusal
  already emits — one shared helper, not three copies.
- `we:scripts/operations/ci-heal-pr-dispatch.mjs` — the same `isDraft` guard at its own entry point, refusing
  before any repair attempt.
- `we:scripts/conveyor/build-dispatch-claim.mjs` — the retirement predicate gains `&& !pr.isDraft` (or
  equivalent) alongside "an open PR delivers the item"; unaffected: TTL expiry, "item left the cleared queue",
  and explicit release on dispatch failure.
- `we:scripts/operations/deliver-item-wrapper.mjs` — holds/refreshes its own build-dispatch claim across pushes
  to its own draft; releases it on real terminal exit (shares #4349's settlement work, does not re-derive it).
- `we:scripts/merge-ai-prs.mjs` — a draft PR is excluded before `planLabelDrain`'s comment/label-writing step
  runs for it, not merely reported as a "skip" with a written reason.
- `we:scripts/conveyor/parked-pr-conflict-watch.mjs` — an `isDraft` exclusion at the top of its detection loop,
  before any label/comment decision.
- `we:scripts/conveyor/review-status-tag.mjs` — `awaiting-ci` (the author's-own-status) is the ONLY state a
  draft PR may carry from this module; every other label path is gated on `!isDraft` same as today's review gate.

## Tasks

1. Add the shared `isDraft` refusal to `we:reconcile-core.mjs`'s ci-heal and conflict-fix branches; fixture-driven
   tests reconstructing PR #2855's shape (draft, red soak-replay-gate, real soak break present) prove NO
   `ci-heal`/`fix` dispatch is planned.
2. Add the same guard to `we:ci-heal-pr-dispatch.mjs`'s execution entry point.
3. Fix `we:build-dispatch-claim.mjs`'s retirement predicate; test that a claim for a draft PR survives past the
   point a ready-PR claim would already be retired, and IS retired at promotion.
4. Wire `we:deliver-item-wrapper.mjs` to hold/refresh its claim across its own pushes and release only at real exit
   (coordinate with #4349's settlement work rather than re-deriving it).
5. Exclude drafts from `we:merge-ai-prs.mjs`'s comment/label-writing step and from `we:parked-pr-conflict-watch.mjs`'s
   detection loop; regression test against PR #2835's own reconstructed shape (draft, red `test` check, BLOCKED
   merge state) showing zero `gh` writes where today's behavior would post `drain-skip-reason`.
6. Confirm `we:review-status-tag.mjs` never emits a non-`awaiting-ci` state for a draft (likely already true per its
   existing `isDraft` gate — a confirming test, not a behavior change, unless one is found).
7. Wire the actual delegation call (builder drops the request marker instead of doing nothing when it wants to
   hand off a red-draft fix), once `xs57vx3`'s dispatcher exists to receive it — the last of these seven tasks
   to land, by ordering rather than a recorded edge. NOT a formal `blockedBy` here: `xs57vx3` does not yet
   resolve to an existing item in this checkout (born this session, not yet synced/landed) and
   `check:standards` refuses an edge that cannot verify its target — add the edge by hand once that card is
   confirmed present.

## Delivery shape

Lands incrementally, in the Task order above: each of 1-6 is independently useful and safe behind `main` (a
pure additional refusal/exclusion, never a removal of an existing correct decision). Task 7 is gated on
`xs57vx3` and may land as its own follow-up PR once that dependency ships, rather than holding this whole card
open.

## Independent review

Not yet run — this card was filed and iteratively refined against operator rulings in the same session as
x9my7an/xdm775e, whose ONE scheduled Codex plan-review pass had already completed before this card's third and
fourth refinements arrived. Per instruction it is filed **unstamped** (`preparedDate` withheld) rather than
delayed for a second review round; a follow-up read-only plan review is owed before this is build-ready.

## Done when

1. **Executable** — a fixture reconstructing PR #2855's shape (draft, red `we:.github/workflows/soak-replay-gate.yml`,
   a real soak break present) proves `we:reconcile-core.mjs` plans no `ci-heal`/`fix` dispatch; it fails today (the
   card's own Evidence is the live counter-example) and passes after.
2. A fixture reconstructing PR #2835's shape (draft, red `test`, BLOCKED merge state) proves zero `gh` writes
   from `we:merge-ai-prs.mjs`'s drain pass and zero label/comment from `we:parked-pr-conflict-watch.mjs` — both fail
   today.
3. A build-dispatch claim for a draft PR is still held one tick after the PR opens (where today's retirement
   predicate would already have released it) and is retired at the SAME tick `we:promote-draft-pr-dispatch.mjs`
   un-drafts it — proven by a fixture test, not by inspection.
4. Once `xs57vx3` lands, a builder's dropped request marker reaches a specialist session for a red-draft fix
   without ever touching `we:reconcile-core.mjs`'s `ci-heal`/`fix` dispatch paths.
