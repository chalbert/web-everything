---
bornAs: xiqj3w9
kind: task
parent: "2527"
status: open
dateOpened: "2026-08-02"
tags: []
---

# check:standards gate — DISCOVER every table total over VERDICTS and fail-loud on any that isn't

Add a deterministic `check:standards` rule that fails loudly when any `VERDICTS`
(`we:scripts/lib/jury-core.mjs`) member is missing from a structure that must be
TOTAL over the verdict enum. The spec is **derive-based, not a hand-list**: the
gate must **DISCOVER** the structures it covers by scanning the enum's consumers
in the codebase, so the NEXT `VERDICTS` member cannot regress a table nobody
thought to list.

## Why derive, not enumerate (the round-2 meta-finding)

The first cut of this item carried a HAND-WRITTEN list of covered tables
(`VERDICT_STRICTNESS` in disposition-judge, `VERDICT_MARKERS`, `VERDICT_LABELS`,
plus the `derivePanelVerdict` / `deriveNegotiationOutcome` handled sets). That is
the SAME failure mode as the defect the item exists to prevent: it enumerated
from memory. It omitted `we:scripts/lib/jury-ledger.mjs`'s hand-copied
`VERDICT_STRICTNESS` twin AND `combineValidatedVerdict`'s handled set — both of
which were real misses present in the very commit that filed it. A gate that
carries a hand list would pass green over exactly the tables nobody remembered to
add. So a hand list is the WRONG SHAPE for this gate: the gate must derive its
own coverage.

## What "derive the coverage" means (the discovery spec)

The rule scans the repo for the shapes that are, by construction, expected to be
total over `VERDICTS`, and checks each is total — rather than trusting a
maintained list:

1. **Enum-keyed object literals.** Any `Object.freeze({ ... })` (or plain object
   literal) whose keys are `VERDICTS.*` members or the verdict string values
   (`'accept'`, `'changes'`, …) — e.g. a strictness/marker/label map. Discover
   them by scanning for object literals keyed by two-or-more `VERDICTS` members /
   verdict strings and assert every member is a key. This catches a strictness or
   glyph or label table wherever it lives, including a future new one.
2. **Exhaustive `switch`/if-chains over a verdict.** A function that branches on a
   verdict value (`=== VERDICTS.X` / `case VERDICTS.X`) and must handle every
   member — e.g. `derivePanelVerdict`, `deriveNegotiationOutcome`,
   `combineValidatedVerdict`. Discover these by finding functions that compare a
   parameter against ≥2 `VERDICTS` members and flag any that omit a member from
   its handled set (allowing a documented default/fallthrough branch).

The exact discovery mechanism (AST walk vs. a disciplined regex + an
allow-annotation for intentional partials) is the item's implementation call;
the SPEC constraint is that coverage is **discovered from the enum's consumers**,
never a static list in the rule.

## Note — finding 1's single-source reduces the surface

Round-2 finding 1 SINGLE-SOURCED the strictness table: `VERDICT_STRICTNESS` +
`verdictStrictness()` now live once in `we:scripts/lib/jury-core.mjs` and both
`we:scripts/lib/disposition-judge.mjs` and `we:scripts/lib/jury-ledger.mjs`
import them. There is no longer a `VERDICT_STRICTNESS` twin to drift — the class
of "a second copy went stale" is removed by construction for THAT table. The gate
still matters for every OTHER verdict-total structure (markers, labels, the
branch handled-sets) and for any future table an author introduces without
single-sourcing it.

## Context

Filed as the captured prevention for the #2823 gate-self review (PR #976). The
blocking findings across rounds all reduced to one root class: an enum member was
added to `VERDICTS` without updating a structure total over it, so the new
verdict was dropped or compared against `undefined`. Runtime assertions now guard
the strictness table (module-load totality + `verdictStrictness()` fail-loud);
this item generalizes that into ONE derive-based deterministic gate over ALL
verdict-total structures so the next enum addition cannot regress any of them —
including one no one has listed.

## Acceptance

- The `check:standards` rule DISCOVERS the structures total over `VERDICTS` by
  scanning the enum's consumers (object literals keyed by verdicts + functions
  branching exhaustively on a verdict), and errors (not warns) if any enum member
  is absent from a discovered structure.
- Coverage is derived, NOT a hand-maintained list in the rule. A structure added
  in a future PR is covered automatically by the scan.
- The rule names the missing member + the structure (file + symbol) in its error.
- Green on the current tree (every discovered structure is total after #976).
- A unit test proves it errors when a member is removed from any covered
  structure, AND when a NEW verdict-keyed table is added partial (the discovery,
  not just the listed tables, is what fails it).
