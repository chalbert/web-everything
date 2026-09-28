---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/lease-reaper.mjs", "we:scripts/conveyor/__tests__/lease-reaper.test.mjs"]
dateOpened: "2026-09-28"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2835's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/conveyor/lease-reaper.mjs` — Add a deterministic real-Git regression with unique merge-resolution content and require the containment check to reject it; conservatively reject unaccounted-for merge commits.
2. `we:scripts/conveyor/lease-reaper.mjs` — Add a deterministic real-Git test that squashes two distinct feature commits into one upstream commit and verifies safe reclamation using aggregate containment evidence.
3. `we:scripts/conveyor/lease-reaper.mjs:392` — A `check:standards` rule requiring git-integration tests that verify branch-level equivalence to operate on N>1 commit cardinality, preventing trivial single-commit false proofs.
4. `we:scripts/conveyor/lease-reaper.mjs:380` — A review lens or lint ensuring every explicit defensive parsing claim in prose is paired with a negative test case exercising the malformed input.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2835@b0da85e383921e3024cb8711605df3a3d4f49535

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
