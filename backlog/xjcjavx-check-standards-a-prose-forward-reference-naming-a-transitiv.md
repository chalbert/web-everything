---
kind: task
status: open
dateOpened: "2026-08-02"
tags: [check-standards, review-integrity]
---

# check:standards — a prose forward-reference naming a transitive blockedBy descendant is an error (prose mirror of the cycle detector)

Add a `check:standards` rule that errors when a **prose forward-reference** in a backlog body — `slice N`, "defined in", or a `#<id>` cross-ref — names an item that is a transitive `blockedBy` **descendant** of the citing item. A definitional prerequisite must not be a forward-reference: if item A's prose leans on something "defined in" B, but B `blockedBy`-depends (directly or transitively) on A, then A ships first and finds its own premise undefined. This is the prose mirror of the existing `blockedBy` cycle detector in [we:scripts/check-standards.mjs](scripts/check-standards.mjs) / [we:scripts/check-standards-rules.mjs](scripts/check-standards-rules.mjs).

## Prevents (PR #998 finding 3)

In #998, slices 1 and 3 scoped themselves to "the tier predicate defined in slice 4," but the chain was slice-1 → slice-2 → slice-3 → slice-4 (predicate last), and slice 1 carried no `blockedBy` — so it loaded as agent-ready Tier A while the thing defining which files it measures shipped three slices later. The fix pulled the predicate into a new first slice; this rule would have caught the inverted dependency mechanically.

## Acceptance

- A body whose prose names (via `slice N` / "defined in" / `#<id>`) an item that is a transitive `blockedBy` descendant of the citing item errors, naming both items.
- A backward/sibling reference (a prerequisite the item actually `blockedBy`-depends on) passes.
- Unit fixtures for the inverted case, a valid backward case, and green on the current tree.
