---
bornAs: xozdam8
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/lib/verify-lane-gate.mjs", "we:scripts/lib/__tests__/verify-lane-gate.test.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2982's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/lib/verify-lane-gate.mjs:225` — Document the ignored-file blind spot in the `computeWorkingTreeHash` docstring. If this matters, add a test that pins the behaviour, or fold a cheap signature of well-known ignored inputs (e.g. the lockfile plus the node_modules mtime) into the key. A review lens on 'cache key ⊇ gate inputs' would catch this class.
2. `we:scripts/lib/verify-lane-gate.mjs` — Add a deterministic real-git integration test that retargets an untracked symlink between identical-content files while keeping the gate command fixed, and require a cache miss; encode readlink output in the key.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2982@971268a5ac57929dd698984981fec4fd66c11f45

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
