# Reference-retirement convention (#584)

> Tier-1 reference. Read when marking an external reference dead or replaced, or when adding a new
> structured reference home. Data-governance over *this repo's* reference data — **not** a
> project-facing Web Everything standard (the platform-strategy setting is epic #583's later layer).

The project cites external URLs in several **structured JSON homes**. When a cited reference dies or is
replaced, we **keep it and mark it** — never silently delete it — so a re-run (#192 freshness) can see
*why* it left. One uniform field-set covers every home: the homes differ in **container**, not in the
retirement **concept** (the same way W3C/IETF apply one retirement vocabulary across every document
type). Resolved by [#584](/backlog/584-general-reference-retirement-convention-generalize-the-corpu/);
prior art in [/research/reference-retirement-convention/](/research/reference-retirement-convention/).

## The field-set — two orthogonal, opt-in markers

Death and supersession are **distinct, independently-optional facts** (a reference can be either, both,
or neither). They are two markers, not one `status` enum — an enum is mutually exclusive and so can't
represent the "dead **and** superseded" case (e.g. FAST: docs 404 **and** folded into Fluent).

| Marker | Fields | Meaning | From |
|---|---|---|---|
| **Death** (triplet, all-or-nothing) | `retired: true` + `retiredDate: "YYYY-MM-DD"` + `retiredReason: "…"` | this reference is dead / kept-for-audit | #546 |
| **Supersession** (pointer) | `supersededBy: <id \| id[]>` (+ optional `supersedes`) | a newer canonical replaces this | #192 |

Rules (enforced by the shared validator):

- The death triplet is **all-or-nothing**: `retired:true` requires both `retiredReason` (the
  keep-not-delete record) and an ISO `retiredDate`; neither field may appear without `retired:true`.
- `retired` must be a boolean.
- `supersededBy` is **resolution-checked only where the home has an id space** (the corpus → a sibling
  source id). Homes whose references are URLs, not ids, carry the pointer un-resolved.
- Everything is **opt-in** (most-permissive default): a home entry with no markers passes vacuously.

## Where it lives — one shape, one validator

The convention is documented here once and enforced by a **single shared helper**,
`validateRetirementShape(entry, { label, resolveSupersededBy })` in
[scripts/check-standards-rules.mjs](../../scripts/check-standards-rules.mjs), called from
[scripts/check-standards.mjs](../../scripts/check-standards.mjs) (§6a-ter) over each structured home.
A shape change touches one place. The covered homes:

- `benchmarkCorpus.json` sources (the seed home, #546) — `supersededBy` resolves to a source id;
- `references.json` links;
- `designSystemResearch[]` refs on `blocks.json` + `intents.json`;
- `benchmarkCapabilityPresence.json` rows.

`researchTopics.json` keeps its own **bidirectional** `supersedes`/`supersededBy` rule (#441 Fork 1) —
its pointer space is topic ids, a richer relationship than a plain reference pointer, so it is not
folded into this helper.

## Freeform prose — documented style, not enforced

`reports/*.md` and `src/_includes/research-descriptions/*.njk` carry references as freeform prose that a
validator can't enforce. Recommended style: **annotate a dead link in place** (note it's retired and
why / what replaced it) rather than deleting it — same keep-not-delete spirit. Structured *extraction*
of prose citations into a retire-able form is deferred to
[#597](/backlog/597-reference-registry-substrate-index-the-structured-reference-/) (the reference
registry substrate), not done here.
