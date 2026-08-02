---
kind: task
parent: "2527"
status: open
dateOpened: "2026-08-02"
tags: []
---

# check:standards gate — every VERDICTS enum member must be present in every table total over the verdict enum

Add a deterministic `check:standards` rule that fails loudly when any `VERDICTS`
(`we:scripts/lib/jury-core.mjs`) member is missing from a table that must be
TOTAL over the verdict enum: `VERDICT_STRICTNESS`
(`we:scripts/lib/disposition-judge.mjs`), `VERDICT_MARKERS`
(`we:scripts/conveyor/jury-tree.mjs`), and `VERDICT_LABELS`
(`we:scripts/lib/review-render.mjs`), plus the `derivePanelVerdict` /
`deriveNegotiationOutcome` handled-verdict sets. This is the captured prevention
for #2823's own review: the PR added the `prevention-outstanding` member but
missed the strictness table (which then compared against `undefined` and dropped
a blocking verdict). "Added an enum member, missed a table total over it" is a
script-decidable defect class — exactly the kind #2823's mandate says earns a
deterministic gate rather than a review lens. Fail-loud on a missing member.

## Context

Filed as the prevention introspection for the #2823 gate-self review (PR #976).
The four blocking findings on that PR all reduced to one root class: an enum
member was added to `VERDICTS` without updating a table that is total over it, so
the new verdict was dropped or compared against `undefined`. Runtime assertions
were added at the two worst sites (`VERDICT_STRICTNESS` now asserts totality at
module load; `verdictStrictness()` throws on an unranked verdict). This item
generalizes that into a single deterministic gate over ALL verdict-total tables
so the next enum addition cannot regress any of them.

## Acceptance

- A `check:standards` rule enumerates every table/handled-set that must be total
  over `VERDICTS` and errors (not warns) if any enum member is absent.
- The rule names the missing member + the table in its error.
- Green on the current tree (every table is total after #2823/#976).
- A unit test proves it errors when a member is removed from any covered table.
