---
bornAs: xv8uoiv
kind: story
size: 3
status: open
dateOpened: "2026-08-26"
scope:
  - we:scripts/lib/validate-rules-anchors.cjs
  - we:scripts/__tests__/rules-anchors.test.mjs
relatedTo: ["3118", "3281", "2844"]
tags: [statute, check-standards, decision-cards, backlog-hygiene]
---

# check:standards rule: a ratified statute clause may not assert a capability claim without a test or an owning verification card

A ratified clause in `we:docs/agent/platform-decisions.md` can assert that *the machine can do X* — resume a
session, honour a flag, reach an endpoint. When that assertion is the clause's own load-bearing hinge and it
rests on nothing but one unrepeated manual observation, the statute reads as settled while the evidence under
it is a single anecdote. Nothing detects that today. This item adds the detector, beside the two-exit
enforcer rule that already exists for operational invariants.

## The failure this closes — the case that produced it

PR #1583 ratified `#3118` as
[#conveyor-dispatch-calls-the-declared-operation](/docs/agent/platform-decisions.md#conveyor-dispatch-calls-the-declared-operation).
Its clause 3 (`we:docs/agent/platform-decisions.md:3133`) accepts **stop-then-resume** as the conveyor's
steering mechanism. That acceptance is the ruling's stated hinge.

The evidence was one manual run on 2026-08-25, recorded as a three-row table on the `#3118` card. The same
run produced two capability rows, and the card applied **opposite** evidentiary standards to them:

| row | claim | how the card treated it |
| --- | --- | --- |
| `claude --resume <sessionId>` | context survived the stop | promoted to ratified statute as settled fact |
| `--session-id` on a `--bg` spawn | **ignored** | *"one observation is not evidence"* — filed `#3331`, which requires the observation be repeated **at least three times** before it is believed |

The `correctness` juror found the asymmetry independently and marked it CONFIRMED; the operator overrode to
`changes` on the sharper version of it — the two rows are **coupled** (`--resume` addresses a session by its
id), so the promoted row depended on the distrusted one. Both were fixed on the review round, and the hinge
now has `#3331` as its owner. Nothing stopped it from landing that way in the first place, and the
prevention was written into the review as OWED. This card is it.

**Not a one-off.** `#3281` is the sibling prevention from the round before, on the same card, for the same
class of defect: a claim that a human re-read caught because no rule counted it.

## Where it goes — the two-exit shape already exists

`we:scripts/lib/validate-rules-anchors.cjs:249` (`validateInvariantEnforcers`, `#2844`) already enforces
exactly this shape one layer down: an operational invariant must **either** name an enforcing code path that
exists on disk, **or** carry `owedTo:` naming an **OPEN** backlog item that will build it. Neither exit ⇒
error, and the message says which exit is missing, because the fix differs.

The new rule is that rule applied to statute prose instead of catalogue JSON:

> A statute clause that asserts a machine capability must **either** cite a test/code path that exists,
> **or** cite an OPEN backlog item that owns verifying it.

It belongs in the same module (`runStatuteCheck`, `:520`), which
`we:scripts/check-statute.mjs` runs standalone and `we:scripts/check-standards.mjs:1678` folds into the
everyday gate — so one implementation covers both entry points. Fixtures go in
`we:scripts/__tests__/rules-anchors.test.mjs`, beside the `#2844` describe block at `:145`.

## Two things to settle while doing it — do not assume them away

**1. How a capability claim is recognised.** Statute prose is hand-written, so this is the hard half.
Two candidate triggers, and the second is the recommended one:

- *Detect capability verbs in prose* (`preserves`, `honours`, `is reachable`, `can resume`). Cheap, and
  almost certainly noisy enough to be turned off — this doc is ~3700 lines of exactly that vocabulary.
- **Detect the evidence tell instead** — a clause that cites a manual observation. The `#3118` clause names
  its own: *"one manual observation on 2026-08-25"*. A rule keyed on `manual observation` / `one manual run`
  / `observed once` / `not proven` inside a clause, requiring an item or path cite in the same clause, is
  narrow, has near-zero false-positive surface, and fires precisely where the standard is being lowered.
  **Recommended default.**

**2. Error or warning.** `#2844`'s neighbour errors, because catalogue JSON is machine-shaped. This one
parses hand-written prose. **Default: warning**, matching `#3281`'s reasoning, and revisit once it has run
clean for a while.

## Done when

1. **Executable** — `npx vitest run rules-anchors` passes with new cases asserting that a statute clause
   naming a manual observation with **no** item/path cite in the same clause is flagged; that the same clause
   with an OPEN-item cite is not; that a clause citing a **resolved** item still flags (a resolved item is not
   an owner, per `#2844`'s `isOpenItem` exit); and that a clause with no evidence tell at all is untouched.
   The new cases fail before the change and pass after. The existing `#2844` describe block
   (`we:scripts/__tests__/rules-anchors.test.mjs:145`) still passes.
2. `npm run check:standards` on current `main` gains no new error and no new warning from the rule — i.e. no
   existing statute clause trips it, or the ones that do are fixed in the same change. `#3118`'s clause 3
   must **pass**, since it now cites `#3331`; that is the rule's own regression fixture.
3. The two questions above are answered in this card or in the commit that closes it.

## Lineage

Filed 2026-08-26 as the prevention the `correctness` finding on PR #1583 recorded as **OWED** while bouncing
`#3118`'s ratification. Sibling of `#3281` (one default marker per fork), which came out of the previous
round on the same card. Extends `#2844`'s enforcer-or-owner shape
(`we:scripts/lib/validate-rules-anchors.cjs:249`) from the invariant catalogue to statute prose. `#3331`
is the verification card the `#3118` hinge now points at — the exit this rule would have required.
