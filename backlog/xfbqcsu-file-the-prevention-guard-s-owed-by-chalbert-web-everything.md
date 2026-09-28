---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/health-smells/ghost-sessions-inflate-cap.mjs", "we:scripts/operations/deliver-item-wrapper.mjs", "we:scripts/conveyor/health-smells/__tests__/ghost-sessions-inflate-cap.test.mjs", "we:scripts/operations/__tests__/deliver-item-wrapper.test.mjs"]
dateOpened: "2026-09-27"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2818's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/conveyor/health-smells/ghost-sessions-inflate-cap.mjs` — Add a deterministic parameterized unit test covering both PID and sessionId identities against unavailable, empty, matching, and nonmatching process snapshots.
2. `we:scripts/operations/deliver-item-wrapper.mjs:2162` — A unit test asserting the exact arguments passed to `execFileSync` for `openPr` without relying on overly-permissive mocks that ignore the base path.
3. `we:scripts/conveyor/health-smells/ghost-sessions-inflate-cap.mjs:46` — A unit test asserting that `isProcessAlive({ pid: 123 }, null)` returns `null`.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2818@78eade7a73094426fe5d79e5bd2f0911cc9f69c4

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
