---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/lib/probation-launcher.mjs", "we:skills-src/conveyor/__tests__/prepare-brief-contract.test.mjs", "we:scripts/lib/__tests__/probation-launcher.test.mjs"]
dateOpened: "2026-09-30"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3178's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/lib/probation-launcher.mjs:208` — Add a runner-side check after the worker run that rejects a prepared `scope:` containing statute-tier paths, wildcard or root entries, or entries that widen a non-empty lease. Add a test that it refuses such a scope. A lint or contract rule could also require any frontmatter key that feeds an envelope or gate check to be validated by value, not only by key name.
2. `we:skills-src/conveyor/__tests__/prepare-brief-contract.test.mjs:52` — Parse all declared permission keys independently of the runner constant, then compare the complete sets; add a negative fixture containing an unauthorized key to ensure the contract checker rejects it.
3. `we:skills-src/conveyor/__tests__/prepare-brief-contract.test.mjs:49` — Perform an exact-match array comparison on the extracted key list without filtering out unrecognized words, or parse the explicit allowed list strictly.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3178@cb127566c336b851114215ca592d99df2a087662

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
