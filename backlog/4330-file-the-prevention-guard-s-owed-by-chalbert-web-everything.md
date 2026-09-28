---
bornAs: xmms3vo
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/lib/pr-events.mjs", "we:scripts/conveyor/health-smells/pr-events-stale.mjs", "we:scripts/lib/__tests__/pr-events.test.mjs", "we:scripts/conveyor/health-smells/__tests__/pr-events-stale.test.mjs"]
dateOpened: "2026-09-27"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2812's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/lib/pr-events.mjs` — Add a deterministic lifecycle test delivering an event between the first GitHub snapshot and first sleep, and require prompt reconciliation; initialize the feed before discovery or reconcile immediately after initial cursor establishment.
2. `we:scripts/conveyor/health-smells/pr-events-stale.mjs:54` — Track delivery timestamps per repository and add a deterministic two-repository health test where only one repository receives deliveries.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2812@e4c7ad9e9313c51c01d96bec4fbd25b599420794

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
