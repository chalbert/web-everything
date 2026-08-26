---
bornAs: xwk0tzu
kind: story
size: 3
parent: "3318"
status: resolved
dateOpened: "2026-08-26"
dateStarted: "2026-08-26"
dateResolved: "2026-08-26"
graduatedTo: none
scope:
  - we:scripts/operations/review-pr-io.mjs
  - we:scripts/operations/review-pr.mjs
  - we:scripts/operations/stage-pr-view.mjs
tags: [review, independence, guard, operations]
---

# Refuse a bare review-pr invocation at read, before a juror is paid

review-pr refuses a self-clear at record — after the juror has run and been billed. The independence of the clearing actor is knowable at read, from the PR author stamp and the current session id, so the refusal can come first. Same shape as #3228, which moved the inert-PR refusal to read for the same reason. Two rounds on PR 1569 cost roughly two dollars before the terminal refusal was reachable.

## Done when

1. **Executable** —

   ```
   npx vitest run review-pr -t "#3322" | grep -qE "Tests +[0-9]+ passed"
   ```

   RED on `origin/main` (exit 1), GREEN on this branch (exit 0). Observed:

   | tree | vitest's own summary line | criterion exit |
   | --- | --- | --- |
   | `origin/main` (`fd68c235`) | `Tests  175 skipped (175)` | **1** |
   | this branch | `Tests  10 passed \| 175 skipped (185)` | **0** |

   **THE `grep` IS THE CRITERION, NOT DECORATION.** `npx vitest run review-pr -t "#3322"` on its own exits
   **0** on `origin/main`: a `-t` filter that matches nothing is a selection of zero, and vitest treats an
   empty selection as success. A criterion written without the pipe is therefore green *before* the work —
   vacuous, and it has already bitten this programme once. `Tests +[0-9]+ passed` asserts that tests actually
   RAN, which is the property the criterion is trying to state.

2. **Mutation-checked** — the six mutants that would make the guard decorative all redden the ten tests
   above (each applied alone, then reverted):

   | mutant | result |
   | --- | --- |
   | the `SELF_CLEAR` comparison never matches (guard deleted) | 2 failed |
   | the comparison inverted to `!==` (every review refused) | 7 failed |
   | the io shell stops carrying `clearerId` up | 1 failed |
   | `createdAt` dropped from `PR_VIEW_FIELDS` | 1 failed |
   | `prCreatedAt` not passed to the decider | 1 failed |
   | `stampLostMarked` not passed to the decider | 1 failed |

## What shipped

Landed on `origin/main` as **PR #1594** (merge commit `9f9cb310`, 2026-08-26). Resolved by bookkeeping
reconciliation after the fact — the card was left `active` at land.

The refusal moved from `record` to `read`, following #3228's pattern exactly — the io shell READS, the pure
declaration DECIDES:

- **we:scripts/operations/review-pr-io.mjs** — `createdAt` joins `PR_VIEW_FIELDS` (one more `--json` field on
  the `gh pr view` that was already being made, no extra hop — the same pattern `body` (#2844) and `state`
  (#2953) used). `readPr` carries `createdAt` and `clearerId: currentActorId()` up beside the `body` it
  already carried. Nothing is decided here.
- **we:scripts/operations/review-pr.mjs** — `shapeReadFinding` calls the SHARED
  `decideClearerIndependence` (we:scripts/lib/review-independence.mjs) and throws on a proven `self-clear`,
  immediately after the #3228 liveness refusal and before anything else. The status is recorded on the read
  finding as `independence` even when it does not refuse.
- **we:scripts/operations/stage-pr-view.mjs** — a consequence, not a choice: that operation deliberately
  refuses any field in `PR_VIEW_FIELDS` it has no declared type for, so `createdAt: 'string'` joins
  `VIEW_FIELD_TYPES`. A view staged before this must be re-staged. That is the right side to fail on — a
  silently-absent `createdAt` turns every stripped stamp on a staged-view host back into the tolerated
  `unknown-author`, which is the hole #3067 exists to close.

**Why refusing the whole run is right.** This operation can only ever record `accepted` or `changes`;
`--to=clear-human`, the one target exempt from #2844's refusal, is deliberately not a declarable step. So a
run that trips the bar has no outcome available to it — the money is spent and the accept is refused
terminally.

**A legitimate review is untouched**, and that direction is tested as hard as the refusal: a session that did
not open the PR gets `independent` and drives all the way to the judge suspend with a real mandate. An
inverted comparison would block every review, which is a worse failure than the one being fixed.

## Not done, deliberately — `stamp-lost` is COMPUTED but does not refuse

Both #3067 inputs (`prCreatedAt`, `stampLostMarked`) are supplied, so a stripped stamp resolves to
`stamp-lost` here and not to the tolerated `unknown-author` — the read side and the write side compute the
SAME status for the same PR. It does not gate anything, because #3067's own card records that refusal as an
open call: *"adding STAMP_LOST would block every PR opened outside pr-land — which on a credential-less host
is all of them … The refusal should land together with a route that stamps a PR opened without pr-land, not
before it."* Refusing it unilaterally here would pre-empt that call and put the two sides on two answers
(#2644). When #3067's pairing lands, both sites widen together.
