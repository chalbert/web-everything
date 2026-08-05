---
kind: task
status: open
dateOpened: "2026-08-05"
tags: [review, jury, gate]
---

# Gate finding-CONTRACT parity: neither a new `Finding` field nor a new enum member can land without its producers

Adding a field to the canonical `Finding` shape takes three coordinated edits in three directories with **no
import edge between them**, and the omission is silent. `we:scripts/lib/jury-core.mjs` owns which keys
`normalizeFinding` accepts; `buildSubjectMandate` owns which keys are demanded in prose; and every producer
re-types its own `Return { … }` key list by hand — `we:scripts/workflows/review-parked-prs.mjs` (the drain panel
lens) and `we:skills-src/jury/subject-jury.workflow.js` (the juror + the red-team). Both producers are
Workflow-harness bodies that **cannot `import`**, so nothing links them to the contract they produce, and every
return schema is `additionalProperties: true`, so a missing field raises no error anywhere.

Observed on PR #1046 (`#xdompzx`): `impactIfUnfixed` was added to the `Finding` shape and demanded by the shared
mandate, but no producer prompt or schema asked for it. A juror got the mandate saying impact was required and a
later, more concrete key list that omitted it. An omitted impact fails closed, so the verdict was byte-identical
to pre-change — the whole mechanism shipped **inert**, with a green suite. #2823 hit the same seam and fixed it by
hand-editing the same three lines; the note at `we:scripts/lib/review-core.mjs` even writes the convention down
and names these exact files. A convention two changes have now missed is a gate, not a note.

## The parity owed is CONTRACT parity, not just FIELD parity

The fix for blocker 1 added the field to all three producers — and in doing so hand-copied the field's ENUM
into two of them as a bare array literal:

```js
const IMPACT_LEVEL_VALUES = ['cosmetic', 'degraded', 'broken', 'unrecoverable'];
```

in `we:scripts/workflows/review-parked-prs.mjs` and `we:skills-src/jury/subject-jury.workflow.js`, each feeding a
JSON-schema `enum:`. These twins are **undiscoverable**. The repo's enum-totality gate
(`we:scripts/lib/verdict-totality.mjs`) finds consumers two ways — a symbolic `IMPACT_LEVELS.MEMBER` reference,
or the enum's values in object-KEY position — and an array ELEMENT is neither. So a fifth impact level would land
with two stale producer schemas and a green gate, which is blocker 1 one level down: the level exists in the
contract, no producer offers it, and the model's schema rejects it if a reviewer tries.

So the rule must gate the whole CONTRACT a producer restates, not only the field names:

1. **Single-source the key list.** Export the accepted finding-field list once from `we:scripts/lib/jury-core.mjs`
   — the same constant `normalizeFinding` reads — and render the `Return { … }` line from it, so producers stop
   hand-typing it. The harness sandbox blocks `import`, so this needs a build/inline step or a generated literal,
   not a runtime import.
2. **Gate the coverage, discovery-based.** A `check:standards` rule in the style of
   `we:scripts/lib/verdict-totality.mjs`: mark each finding-producing file `@finding-producer` so coverage is
   DISCOVERED rather than hand-listed, then error when any marked producer omits an accepted field.
   The discovery half is the point — a hand list of the three producers we remember today is the same failure
   this rule exists to stop.
3. **Error on a mirrored enum literal that is not SET-EQUAL to the real exported enum.** In a file marked
   `@finding-producer`, any array/`enum:` literal of string values that overlaps a `Finding`-field enum must be
   set-equal to that enum's values. Not a subset, not a superset, not a re-ordering that hides a rename — the
   same set. This is what makes a hand-copied mirror safe to keep: it may exist (the harness cannot `import`),
   but it can no longer silently disagree.

**Prevention for:** PR #1046 review, blocker 1 and round-2 finding 2 (`#xdompzx`).

**Locus:** `we:scripts/lib/jury-core.mjs`, `we:scripts/check-standards.mjs`,
`we:scripts/workflows/review-parked-prs.mjs`, `we:skills-src/jury/subject-jury.workflow.js`
