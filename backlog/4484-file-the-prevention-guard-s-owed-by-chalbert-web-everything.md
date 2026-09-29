---
bornAs: x4mfp16
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/lib/verify-lane-gate.mjs", "we:scripts/lib/__tests__/verify-lane-gate.test.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2937's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/lib/verify-lane-gate.mjs:268` — Add a lint or check:standards rule requiring `--no-renames` on `git diff --name-only` used for set-membership logic. Also add a real-git test where a lane renames a file and then reverts the rename.
2. `we:scripts/lib/verify-lane-gate.mjs:260` — File a follow-up to intersect the overlap with resolveDefaultGate's `vitest related` targets. Add a test pinning that an upstream-only dependency change is currently carried forward, so the behaviour is deliberate and visible.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2937@71a77e4bfb1f9db122e4690e9801a06a0419ea1c

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
