---
bornAs: xzsm1vx
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:skills-src/conveyor/build-dispatch-daemon.mjs", "we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs"]
dateOpened: "2026-09-30"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3053's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:skills-src/conveyor/build-dispatch-daemon.mjs:693` — When a diff adds a catch-branch recovery, require a test whose injected dependency throws. A review-lens checklist item is enough; a deterministic gate is not practical here.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3053@843f1c1f8838490ea0026bce17542cc4a6cd7fd4

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
