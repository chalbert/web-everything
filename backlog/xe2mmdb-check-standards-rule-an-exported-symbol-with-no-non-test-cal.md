---
bornAs: xe2mmdb
kind: task
status: open
dateOpened: "2026-08-03"
tags: [review-integrity, check-standards, drain, gate]
scope: ["we:scripts/check-standards.mjs"]
relatedTo: ["xc7p3q9"]
---

# check-standards rule — an exported symbol with no non-test caller (and an unused import) is a smell

review-integrity guard for the xc7p3q9 R11/R12 class: a "shared seam" that no
production code actually calls, and imports pulled in but never used.

## Why

The round-1 couple-join PR exported `planDrainPass` as "the ONE shared pass
composition runCli and the tests both go through" — but `runCli` never called it
(it re-typed its own `planLabelDrain` wiring), so a grep for `planDrainPass`
found ONLY the test file. Every mutation of the real wiring passed because the
tested function was a parallel, unreached copy (R4). The same round also left
three test imports (`prepareDrainVerdicts`, `buildDrainVerdicts`,
`narrowPrsByRepo`) unused — two only in a prose comment — and exported
`buildDrainVerdicts` for a consumer that did not exist (R12, the B10 class
recurring three times in the round that fixed it).

A deterministic lint would have caught both the instant they were introduced,
before a reviewer had to run the mutation table by hand to discover the seam was
unreached.

## The guard (decidable, no reachability trace needed)

Two `check:standards` rules over `we:scripts/*.mjs`:

1. **Exported symbol with no non-test caller.** For each `export function` /
   `export const` NAME in a `scripts/*.mjs` module, grep the whole repo for
   `NAME` outside `**/__tests__/**` and outside its own definition line. Zero
   hits → WARN ("exported but only referenced from tests — either it has a
   production caller that is missing, or it should not be exported"). An
   allow-list handles deliberately test-facing exports.
2. **Unused import.** For each name in an `import { … }` binding, require at
   least one use in the module body (a plain identifier scan, ignoring the
   import line and comments). Zero uses → WARN. Catches the B10 class directly.

Both are syntactic (identifier presence/absence), not data-flow — an explicit,
maintained allow-list is the escape hatch, never a taint analysis.

## Acceptance

- Rule 1 fires on a reintroduced `export function planDrainPass` that `runCli`
  never calls, and passes now (runCli calls it).
- Rule 2 fires on a reintroduced unused test import, and passes on the cleaned
  import list.
- 0 new errors on the `check:standards` gate for the existing tree (WARN-level so
  it does not break the gate on day one; promote to error after a sweep).
