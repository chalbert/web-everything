---
bornAs: xcu7t44
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/operations/probation-build-run.mjs", "we:scripts/operations/__tests__/probation-build-run-isolation.test.mjs", "we:scripts/operations/__tests__/probation-build-run.test.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3027's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/operations/probation-build-run.mjs:484` — Snapshot `git ls-tree`/hash-object of the lane's launcher-executed scripts before the worker runs, and refuse post-worker mutations if they differ. Alternatively add a guard rejecting `git ls-files -v` entries with lowercase/`S` flags. Cheapest is a check in the launcher plus a test that plants skip-worktree.
2. `we:scripts/operations/__tests__/probation-build-run-isolation.test.mjs:113` — When a guard is an OR of conditions, the test fixture needs one case per disjunct. Add a review lens or table-driven test convention for this.
3. `we:scripts/operations/__tests__/probation-build-run-isolation.test.mjs:117` — Add a deterministic isolation test using a second registered daemon clone; require it to fail when the registry rejection condition is removed.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3027@10fedba67afc9550fb9a6592282603117284c0c2

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
