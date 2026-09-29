---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/lib/gh-throttle.mjs", "we:scripts/lib/__tests__/gh-throttle.test.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2918's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/lib/gh-throttle.mjs:770` — Add a fidelity test that feeds a truncated trace to `spawnWithGhDebugCapture` and asserts the settled error contains only gh's own error line. Also consider having `strip` drop everything after an unclosed `* Request at` block when the result is a signal or timeout kill.
2. `we:scripts/lib/gh-throttle.mjs:792` — A unit test explicitly asserting that a successful execFileSync emulation with stderr output does NOT leak that output to process.stderr.
3. `we:scripts/lib/gh-throttle.mjs:778` — A static analysis lint (e.g. ESLint's no-undef rule) enabled on all library files to statically catch undefined variable and function references before execution.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2918@28e088df7ee14f66ad9e5e4ce75556a21b4dd29f

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
