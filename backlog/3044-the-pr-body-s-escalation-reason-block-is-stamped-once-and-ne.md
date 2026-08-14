---
bornAs: xx15niz
kind: story
size: 5
status: open
dateOpened: "2026-08-08"
tags: [review, converge-loop, gate]
relatedTo: ["2908", "2324", "2844"]
scope:
  - we:scripts/lib/review-escalation.mjs
  - we:scripts/pr-land.mjs
  - we:scripts/merge-ai-prs.mjs
  - we:scripts/__tests__/review-escalation.test.mjs
  - we:scripts/__tests__/pr-land.test.mjs
  - we:scripts/__tests__/merge-ai-prs.test.mjs
---

# The PR body's escalation-reason block is stamped once and never refreshed, so a re-score can leave it stale-low

The `## Escalation reason` block is written only when the marker is ABSENT. Both writers guard on
`bodyAlreadyCarriesReasonBlock` (we:scripts/pr-land.mjs:884, we:scripts/merge-ai-prs.mjs:3349) — the RAW
text presence check, not the trusted quoted-aware reader `bodyHasEscalationReason` (correcting this card's
earlier wording, which named the wrong function). A later re-park that scores MORE (or fewer) reasons updates
the drain's park comment but cannot update the block, so the block is a snapshot of the FIRST park. Since #2908
the block is write-authorizing — the converge loop bands the editor on it, and one dropped bullet flips the gate
(`['size']` → editor on; `['size','blast-radius']` → review-only —
we:scripts/workflows/review-parked-prs.mjs:393) — so a stale-LOW block is a fail-open.

**Observed, live, on the PR the #2908 ruling is built on.** PR #1018's body block lists ONE reason —
`blast-radius (…)` — while the drain's park comment on the same PR lists
`[blast-radius (…); size (602 ≥ 400 changed lines)]`. Parsed deterministically the block bands `elevated`;
the comment's set bands `high`. The live run's own log recorded `care: elevated`, i.e. it acted on the stale
block. (Both are review-only, so #1018 took no harm — the general shape is what matters.)

Surfaced at the PR #1106 review while closing F2 (the loop now shells the deterministic parser instead of
LLM-reading the bullets, we:scripts/fetch-parked.mjs). That closed the *reading* hole and left this *writing*
one open — the block is now parsed exactly, and exactly parsing a stale list still yields a stale band.

**Fresh evidence (2026-08-13/14).** A session ran four PRs through multiple review rounds and hit this class
repeatedly at the PR-BODY-DESCRIPTION level (not this exact block, but the same "stamped once, never
re-derived" failure mode): PR #1203's body still advertised a field the head had since deleted; PR #1222's body
claimed `main` was red after the fix had already landed independently. Both were only caught because a human
read the body. The escalation-reason block is the machine-consumed instance of the same class, and it is
we:scripts/workflows/review-parked-prs.mjs:393 that consumes it for a live gating decision, not just prose a
human might catch.

## Scope

Every file a builder touches to close this, `we:`-qualified, decided consumer-by-consumer:

- **we:scripts/lib/review-escalation.mjs** — home of `ESCALATION_REASON_MARKER` (:1511),
  `buildEscalationReasonBlock` (:1562), `buildPolicyStampMarker`/`parsePolicyStamp` (:1525/:1541),
  `blankQuotedRegions` (:1619), `bodyAlreadyCarriesReasonBlock` (:1671), `bodyHasEscalationReason`
  (:1679). Add the new pure reconcile function here (see Interface below) — this module already owns every
  primitive it needs.
- **we:scripts/pr-land.mjs** — the producer writer, `applyReviewEscalationLabel`'s body-write branch
  (:881-885). Swap the guard-then-append for a call to the new reconcile function.
- **we:scripts/merge-ai-prs.mjs** — the drain writer, the `gate.humanRequired` body-write branch
  (:3342-3372), including the `durableRecorded`/verify bookkeeping that branch already does. Same swap,
  bookkeeping semantics preserved (see Tasks).
- **we:scripts/__tests__/review-escalation.test.mjs** — new unit tests for the reconcile function. This is
  the PRIMARY correctness gate: the write logic in both call sites is otherwise embedded in large, `gh`-shelling
  CLI functions with no existing direct test coverage of this branch (a search for `Escalation reason` /
  `reasonBlock` in we:scripts/__tests__/merge-ai-prs.test.mjs and we:scripts/__tests__/pr-land.test.mjs
  both return zero hits today — verified while preparing this card).
- **we:scripts/__tests__/pr-land.test.mjs**, **we:scripts/__tests__/merge-ai-prs.test.mjs** — listed
  because the call-site edit could break an existing assertion incidentally; likely a no-op touch given the
  zero-hits finding above, confirmed only by running the suite (see Tasks).

**Excluded, with reasons:**
- we:scripts/fetch-parked.mjs, we:scripts/review-detail.mjs (the `parseEscalationReason` reader) — they
  read the block's existing SHAPE (marker + bullets + trailing policy stamp), which this item does not change;
  only the block's freshness changes, invisibly to these readers. **Not edited here.** (A separate, pre-existing
  parse-boundary bug in this reader is noted under Observed-but-out-of-scope below — real, but a different bug
  class from this item's staleness fix.)
- we:scripts/workflows/review-parked-prs.mjs (the converge loop that actually bands on this block, :393) —
  consumes `escalationReason: string[]` via we:fetch-parked.mjs's JSON contract, a subprocess boundary, not an ES
  import of anything changed here. The contract's shape is unchanged; it becomes correct automatically once the
  writers stop going stale. **Not edited here** — it's the beneficiary, not a consumer that needs code changes.
- we:scripts/pr-body-edit.mjs — cited below as prior art for preserving the `authored-by-actor` stamp across
  a body rewrite; not edited by this item (it does a WHOLESALE body replace, a different operation from the
  surgical block-region replace this item builds — see Observed-but-out-of-scope).
- Every other file that shells we:scripts/pr-land.mjs / we:scripts/merge-ai-prs.mjs as an opaque CLI (skills,
  we:scripts/lane-drain.mjs, we:scripts/wait-green.mjs, dozens of other backlog cards referencing them, etc. —
  roughly 100 files, found by a repo-wide search for callers while preparing this card) — excluded as a block:
  none of them import the changed functions, and the CLI's flags/exit codes/stdout contract are unchanged. The
  internal body-write logic is the only thing moving.

## Size: 5

Fibonacci basis: one shared-lib module gets a genuinely new pure function (not a signature tweak) — forgery-safe
block-region location (reusing `blankQuotedRegions`, not the raw guard), an order-insensitive reason-set diff,
a growth-AND-shrink replace, and a fail-safe no-op path for an unexpected trailing-content shape — each of which
needs its own test case, so the test file is the bulk of the real work. Two mechanical call-site swaps follow
once the function exists. Single coherent behavior change, no cross-repo spread (WE-only), no new consumer
contract (the body's marker/shape and the `escalationReason` JSON field are both unchanged — only their
freshness). That combination is bigger than a 2 or 3 (there's real edge-case logic, not a one-line diff) but
doesn't clear an 8: there's no natural seam to slice on — the reconcile function is dead weight without both
call sites updated in the same change, and neither call site is independently valuable without it.

## Decided design — the (a)/(b)/(c) fork from the original card, resolved

**(a): re-derive-and-replace the block, content-diffed against the current reason set (not fired blind).**
Rejecting the alternatives named in the original card, on evidence gathered while preparing this item:

- **(b) leave the block as first-park history; point consumers at the drain's latest park comment instead** —
  rejected because the one consumer that actually gates on this (we:scripts/workflows/review-parked-prs.mjs:393,
  the #2908 editor-enablement band) already reads the BODY block via we:fetch-parked.mjs's `escalationReason`
  field, not the comment; redirecting it means rewiring that whole contract, a strictly bigger and riskier
  change than fixing the write side. It also has no fallback for the highest-risk class:
  we:scripts/merge-ai-prs.mjs:3298-3301 deliberately posts NO park comment for a `review:human` park ("the body
  already carries it") — so for exactly the PRs where a stale block matters most, there is no comment to
  redirect to.
- **(c) move the authoritative reason set off the body onto a jury-ledger/manifest field** — rejected for this
  item as structural rework (new field, new plumbing through we:pr-land.mjs, we:merge-ai-prs.mjs, we:fetch-parked.mjs,
  we:review-parked-prs.mjs, possibly the #2641 jury ledger) that doesn't fix staleness so much as relocate where it
  could recur. The body block is already the durable, human-visible record by design
  (we:scripts/lib/review-escalation.mjs:1509-1511, #2324's whole point); worth a separate item if ever pursued,
  not bundled here.

(a) is smallest, targets the actual write sites, and reuses primitives (`blankQuotedRegions`,
`buildEscalationReasonBlock`) this module already has.

## Interface and protocol

The block's on-body shape, unchanged (`buildEscalationReasonBlock`, we:scripts/lib/review-escalation.mjs:1562-1568):

```
\n\n## Escalation reason\n\n- <reason 1>\n- <reason 2>\n\n<!-- policy-set: v<version> <digest> -->\n
```

It is always the LAST thing appended to the body by both writers today (`liveBody + buildEscalationReasonBlock(...)`
at we:scripts/pr-land.mjs:884 and `newBody = liveBody + reasonBlock` at we:scripts/merge-ai-prs.mjs:3350), and
the `authored-by-actor` stamp (we:scripts/pr-land.mjs:160,176-180) is always written earlier, at PR-create time,
so it always sits BEFORE where the escalation marker later lands. That ordering is what makes a marker-onward
region-replace safe without any special stamp-carrying logic: everything before the marker is untouched by
construction. This is a narrower operation than we:scripts/pr-body-edit.mjs's wholesale
body-replace-plus-carry-forward (:21-35) — that script exists because a FULL replace has no idea what stamps
were in the old body and must explicitly re-append them (`withCarriedStamps`); a surgical from-the-marker splice
never removes what came before it, so there is nothing to carry forward.

New pure export, we:scripts/lib/review-escalation.mjs:

```js
/**
 * reconcileEscalationReasonBlock(body, reasons) → {body, changed}
 *
 * - No REAL (non-quoted, via blankQuotedRegions) marker present, reasons non-empty → APPEND
 *   (today's behavior, unchanged): body + buildEscalationReasonBlock(reasons), changed:true.
 * - No marker, reasons empty → no-op, changed:false (buildEscalationReasonBlock([]) === '', today's behavior).
 * - Marker present, recorded reason SET === reasons (Set equality, order-insensitive) → no-op, changed:false.
 *   THE FIX'S CORE: a re-park that scored nothing new writes nothing.
 * - Marker present, sets differ, reasons non-empty → REPLACE the block region — the marker line through its
 *   end boundary (next `##` heading, or end of body) — with a freshly built block (fresh reasons + a FRESH
 *   policy stamp). Handles growth AND shrink identically (this is what fixes the card's PR #1018 example).
 * - Marker present, sets differ, reasons EMPTY (full de-escalation) → no-op, changed:false. Mirrors existing
 *   precedent (see below) — a stale-but-non-empty block is left as first-park history, never blanked. (Whether
 *   a body should ever LOSE a record it once carried is a legitimate future question; not decided or built
 *   here — today's writers already never blank it, so this is continuity, not a new choice.)
 * - Marker present but non-blank content follows the block's end boundary (in practice: never, today — both
 *   writers only ever append) → FAILS SAFE: no-op, changed:false, so an unexpected shape can never delete
 *   content a human added. Callers log a best-effort warning on this path, the same idiom
 *   we:scripts/merge-ai-prs.mjs already uses for a write/verify miss (:3352, :3357).
 */
export function reconcileEscalationReasonBlock(body, reasons) { … }
```

The "mirrors existing precedent" note above is we:scripts/merge-ai-prs.mjs:3343-3345 ("a DE-ESCALATED human
park has no fresh reasons... records NOTHING here").

The reason-set comparison reads the block using `blankQuotedRegions` (forgery-safe — a documented example in a
fenced code block is never mistaken for the real block, same reasoning as `bodyHasEscalationReason`), and stops
at the trailing `<!-- policy-set: … -->` line as well as the next `##` heading — this is a NEW, correct
boundary this item needs for the comparison to work; we:review-detail.mjs's existing `parseEscalationReason`
does NOT stop there today (see Observed-but-out-of-scope) and is deliberately not reused or touched by this
item. `bodyAlreadyCarriesReasonBlock` and `bodyHasEscalationReason` stay exported and in use elsewhere
(`bodyHasEscalationReason` still does the post-write verify read in we:merge-ai-prs.mjs); only the two call sites'
write-decision branches change what they call.

## Tasks

1. In we:scripts/lib/review-escalation.mjs, add the block-boundary reader (quoted-aware marker location,
   bullet extraction stopping at the policy-stamp line or next `##` heading) as an internal helper.
2. Add and export `reconcileEscalationReasonBlock(body, reasons)` per the contract above, including the
   trailing-content fail-safe.
3. Update we:scripts/pr-land.mjs:881-885 — replace the `bodyAlreadyCarriesReasonBlock` guard-then-append with
   a call to `reconcileEscalationReasonBlock`; only shell `gh pr edit --body` when `.changed` is true.
4. Update we:scripts/merge-ai-prs.mjs:3342-3372 — same swap. Preserve the existing `durableRecorded`/`verified`
   bookkeeping: a no-op because content is already current still counts as durably recorded (mirrors today's
   `else if (reasonBlock)` branch at :3363-3371); an actual write is still verified via `bodyHasEscalationReason`
   on the read-back, unchanged.
5. Add unit tests in we:scripts/__tests__/review-escalation.test.mjs covering: append-when-absent,
   no-op-when-same-set (order-insensitive), replace-on-growth, replace-on-shrink, no-op-when-fresh-reasons-empty
   (both with and without an existing marker), forged/quoted-marker safety (appends fresh rather than replacing
   quoted text), preserves-content-before-marker (include an `authored-by-actor`-stamped fixture), and the
   trailing-non-blank-content fail-safe.
6. Run the unit suite and `npm run check:standards`; fix any incidental fallout in
   we:scripts/__tests__/pr-land.test.mjs / we:scripts/__tests__/merge-ai-prs.test.mjs.

## Done when

- A unit test asserts `reconcileEscalationReasonBlock` REPLACES the block when the recorded and fresh reason
  sets differ (both a growth case, e.g. `['blast-radius (…)']` → `['blast-radius (…)', 'size (602 ≥ 400
  changed lines)']`, reproducing the PR #1018 shape from this card, and a shrink case) — the resulting body's
  block, re-parsed, equals the fresh set.
- A unit test asserts a re-park scoring the SAME set (any order) returns `changed:false` and a byte-identical
  body — proving a routine re-park with nothing new writes nothing.
- A unit test asserts content before the marker (title, human text, an `authored-by-actor` stamp fixture)
  survives a replace byte-for-byte.
- A unit test asserts a quoted/fenced example of the marker is never mistaken for a real block to replace.
- A unit test asserts non-blank trailing content after the block's end boundary leaves the body untouched
  (`changed:false`) rather than deleting it.
- we:scripts/pr-land.mjs and we:scripts/merge-ai-prs.mjs both call `reconcileEscalationReasonBlock` at their
  existing write sites (a search confirms `bodyAlreadyCarriesReasonBlock` no longer gates either body-write
  branch).
- `npm run check:standards` is 0 errors and the full unit suite (`vitest`/`npm run test:unit`) is green.

## Delivery shape

One piece, single PR: the shared reconcile function plus both call-site swaps plus tests. There's no safe
incremental slice — shipping the function without updating a call site leaves it unused, and updating only one
of the two writers leaves PR-open-time and re-park-time diverging on exactly the behavior this item exists to
unify (a producer-labelled PR would reconcile; a drain-re-parked one wouldn't, or vice versa). Both call sites
are small mechanical swaps once the function exists, so bundling costs little.

## Observed but out of scope (footnoted, not filed as a separate item here)

- **`parseEscalationReason` (we:scripts/review-detail.mjs:29-45) has its own, pre-existing parse-boundary
  bug**, found while grounding this card: it reads every non-blank line after the marker up to the next `##`
  heading, which includes the trailing `<!-- policy-set: … -->` HTML comment as a bogus extra "reason."
  Reproduced directly: `parseEscalationReason(body)` on a real `buildEscalationReasonBlock(['blast-radius
  (…)'])`-produced body returns `['blast-radius (…)', '<!-- policy-set: v1 08da26b668de -->']`. Downstream,
  `assembleReviewDetail` (we:scripts/review-detail.mjs:78-81) calls the STRICT `deriveReviewDisposition`
  directly and wraps it in try/catch — `deriveReviewDisposition` throws on ANY unrecognized token
  (we:scripts/lib/review-core.mjs:584-587), so this stray token nulls the Plateau Loop console's `disposition`
  field on essentially every parked PR that carries a policy stamp (i.e. every one, since
  `buildEscalationReasonBlock` always appends it when reasons are non-empty). The converge loop itself is
  unaffected — it goes through the LENIENT bridge (we:scripts/lib/review-core.mjs:598, "an unrecognized reason
  contributes nothing rather than crashing") — so this is a different, narrower bug than #3044's staleness bug,
  with a different blast radius (the review console's disposition display, not the editor-enablement gate).
  Not fixed here — this item's reconcile function defines its own correct boundary reader rather than reusing
  or fixing this one, to avoid scope creep. Worth its own card if the Plateau Loop console's disposition
  display is confirmed broken in practice.
- **we:scripts/pr-body-edit.mjs does a wholesale body replace and only carries the `authored-by-actor` stamp
  forward** (:21-35) — it has no awareness of the `## Escalation reason` block at all, so calling it on a PR
  that already carries one would silently drop the block. Not this item's writers (which only ever append/
  splice, never wholesale-replace), so out of scope here, but worth knowing if we:pr-body-edit.mjs's
  carry-forward set is ever revisited.
