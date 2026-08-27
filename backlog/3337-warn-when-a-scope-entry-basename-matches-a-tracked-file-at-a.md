---
bornAs: xtqsqeg
kind: story
size: 1
parent: "3318"
status: resolved
dateOpened: "2026-08-26"
dateResolved: "2026-08-27"
scope:
  - we:scripts/check-standards-rules.mjs
  - we:scripts/check-standards.mjs
  - we:scripts/__tests__/check-standards.test.mjs
tags: []
---

# Warn when a scope entry basename matches a tracked file at a different path

`scope:` is machine-read — `we:scripts/readiness/dispatch-plan.mjs` matches it by exact path through `coversFile`, so an entry naming a path that does not exist covers nothing and the file the work really touches goes undeclared. Nothing catches it today: `we:scripts/check-standards-rules.mjs` validates that an entry is repo-qualified and warns on a directory-level entry, but has no rule about whether the path resolves. Add a **warning** (not an error) when an entry's basename matches a tracked file at a different path — the shape that is provably a typo rather than a file the card will create.

Warning, not error, on purpose: an entry for a genuinely new file is legitimate and must not redden. #3307's `we:scripts/lib/claim-sweep.mjs` has no basename match anywhere in the repo and is correct as written; #3321's `we:scripts/lib/__tests__/lane-verify.test.mjs` had a match at `we:scripts/__tests__/lane-verify.test.mjs` and was wrong. The basename test separates the two.

The mis-scoped path is not exotic: **8** of the `we:scripts/lib/*.mjs` modules keep their test at the top-level `we:scripts/__tests__/` rather than the sibling `we:scripts/lib/__tests__/` (counted in the lane by pairing every `scripts/__tests__/*.test.mjs` against `scripts/lib/<base>.mjs`), so the wrong directory is the natural guess for any of them.

## Done when

1. **Executable** —
   `npx vitest run check-standards -t "#3337" | grep -qE "Tests +[0-9]+ passed"`
   (the `grep` is load-bearing: `vitest -t` exits 0 when the filter matches nothing, so on `origin/main`,
   where the `#3337` block does not exist, the run reports `Tests 0 passed | 403 skipped` and the grep fails.)

## How it was built

`scopeBasenameMismatches` (+ `buildTrackedPathIndex`, `scopeBasenameMismatchMessage`) in
`we:scripts/check-standards-rules.mjs`, called from a new §6d-septies WARN in `we:scripts/check-standards.mjs`
(the fs read — `git ls-files` — stays at the call site, the logic stays pure, per the #2751 pattern).

Four narrowing axes keep it out of the ~1438-warning pile: **(1)** `we:` entries only (a sibling repo's tree
is not visible, so "not found" there means "not checkable"); **(2)** FILE entries only — a subtree entry
(`isSubtreeEntry`) never names an exact path, and its shape is already the separate #2739 finding;
**(3)** candidates are ranked by longest shared TRAILING path segments and only the top tier is offered, so a
generic basename still yields ONE suggestion — `we:.claude/skills/review/SKILL.md` matches 27 tracked files by
basename, but only `we:skills-src/review/SKILL.md` shares its final two segments; **(4)** a top tier wider
than 3 is silence, not an unactionable warning.

Across the real tree it adds **4** warnings, all true positives, each naming exactly one probable path:
#2451 and #2952 point at the built `we:.claude/skills/` tree instead of the `we:skills-src/` source, #2906 at
`we:scripts/lib/check-standards-rules.mjs` (the module is at `we:scripts/check-standards-rules.mjs`), #3100 at
`we:scripts/lib/__tests__/citation-check.test.mjs` (the test is at
`we:scripts/__tests__/citation-check.test.mjs`).

**Greenfield stays silent, two ways.** A basename matching nothing anywhere is a genuine new file and never
warns — that covers 44 of the 46 currently-unresolved-path entries, #3307's `we:scripts/lib/claim-sweep.mjs`
among them. Static state cannot distinguish the residue (a to-be-created file whose basename happens to exist
elsewhere) from a typo, so that case gets the same escape the #2739 rule uses: a non-empty `scopeRationale:`
clears the flag, and the warning text says so.
