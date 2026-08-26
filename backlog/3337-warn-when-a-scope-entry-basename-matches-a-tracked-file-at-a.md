---
bornAs: xtqsqeg
kind: story
size: 1
parent: "3318"
status: open
dateOpened: "2026-08-26"
scope:
  - we:scripts/check-standards-rules.mjs
tags: []
---

# Warn when a scope entry basename matches a tracked file at a different path

`scope:` is machine-read — `we:scripts/readiness/dispatch-plan.mjs` matches it by exact path through `coversFile`, so an entry naming a path that does not exist covers nothing and the file the work really touches goes undeclared. Nothing catches it today: `we:scripts/check-standards-rules.mjs` validates that an entry is repo-qualified and warns on a directory-level entry, but has no rule about whether the path resolves. Add a **warning** (not an error) when an entry's basename matches a tracked file at a different path — the shape that is provably a typo rather than a file the card will create.

Warning, not error, on purpose: an entry for a genuinely new file is legitimate and must not redden. #3307's `we:scripts/lib/claim-sweep.mjs` has no basename match anywhere in the repo and is correct as written; #3321's `we:scripts/lib/__tests__/lane-verify.test.mjs` had a match at `we:scripts/__tests__/lane-verify.test.mjs` and was wrong. The basename test separates the two.

The mis-scoped path is not exotic: **8** of the `we:scripts/lib/*.mjs` modules keep their test at the top-level `we:scripts/__tests__/` rather than the sibling `we:scripts/lib/__tests__/` (counted in the lane by pairing every `scripts/__tests__/*.test.mjs` against `scripts/lib/<base>.mjs`), so the wrong directory is the natural guess for any of them.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
