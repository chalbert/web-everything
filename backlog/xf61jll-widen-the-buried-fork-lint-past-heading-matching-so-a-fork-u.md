---
kind: story
size: 3
status: open
dateOpened: "2026-08-02"
relatedTo: ["2884", "2883"]
tags: [gate, backlog, fork, check-standards, hookable]
scope:
  - we:scripts/check-standards-rules.mjs
  - we:scripts/__tests__/check-standards-rules.test.mjs
---

# Widen the buried-fork lint past heading matching so a fork under a narrative heading is caught

`findBuriedForkSections` keys on a fixed nine-phrase heading list, so a fork written under a narrative heading passes the gate invisibly — which is how #2884 shipped `batchable` with three options and no default.

## The blind spot

[we:scripts/check-standards-rules.mjs](scripts/check-standards-rules.mjs#L434-L455) matches a section
against `FORK_HEADING_TERMS`
([we:scripts/check-standards-rules.mjs](scripts/check-standards-rules.mjs#L414-L417)) — nine fixed phrases:
`open design`, `open decision`, `open question`, `open fork`, `open sub-decision`, `design tension`,
`forks to settle`, `decisions to settle`, `tensions to settle`. The predicate is HEADING-keyed only; the
body is never examined.

So the lint catches a fork only when the author already labelled it as one. An author who writes the fork up
honestly under an analytic heading trips nothing.

## The instance that proves it

[we:backlog/2884-acceptance-coverage-keys-on-head-sha-identity-so-a-no-op-reb.md](backlog/2884-acceptance-coverage-keys-on-head-sha-identity-so-a-no-op-reb.md)
carries a live three-option fork with no default, under the headings "This is a ratified tradeoff, not an
oversight" / "The evidence — PR #983" / "The obvious fix is not free". None matches `FORK_HEADING_TERMS`.
`findNonBatchableMarkers` ([we:scripts/check-standards-rules.mjs](scripts/check-standards-rules.mjs#L537-L546))
does not fire either. `npm run check:standards` exits 0 with zero lines mentioning #2884, and the item
computes `tier: A, batchable: true`.

The failure mode is perverse: the *better* the fork is written up — sober, analytic, no "open question"
banner — the less likely the gate is to see it. #2883 has the same shape in milder form ("it should be a
deliberate call, not a side effect").

[we:src/_data/backlog.js](src/_data/backlog.js#L443-L444) already states the gap plainly: "The one
non-structural guard the batch skill adds — no buried design fork in the body — can't be decided from
fields … selection still skims the body for a fork." This item is about moving that skim from model recall
into a deterministic gate (#51: script-decidable becomes a hook).

## Shape of the widening

Two tells worth detecting, both mechanical and both present in #2884:

- **Option enumeration** — a section carrying two or more bullets that open with a bolded or lettered option
  label (`- **X** — …`, `(a)`/`(b)`) on a non-`decision`, non-`resolved` item with no `blockedBy` edge to a
  `kind: decision`. That is the shape a carved fork has and a build story does not.
- **Deferred-choice phrasing** — the wordings that appear in a body when the author knows the call is open:
  "a deliberate call, not a side effect", "options worth weighing", "whichever option is taken", "the
  tension to resolve", "cross-check with the sibling". Fits `NON_BATCHABLE_MARKERS` rather than the fork
  detector.

Both self-clear the moment the fork is carved, so neither becomes a nag. The false-positive risk is real —
a story legitimately listing implementation notes as bullets — so the rule should warn before it errors, and
the first pass over the existing 2858 items should be inspected before the severity is set.

## Definition of done

- The buried-fork detection no longer depends solely on heading vocabulary: at least the option-enumeration
  tell is detected from the body.
- Deferred-choice phrasings are covered, whether in the fork detector or `NON_BATCHABLE_MARKERS`.
- #2884 and #2883 are both flagged by the widened rule (the regression fixtures), and a story that merely
  lists implementation bullets is not.
- The full-corpus false-positive count is reported and the severity (warn vs error) is set from it, not
  assumed.
- Unit-pinned in `we:scripts/__tests__/check-standards-rules.test.mjs`.
