---
bornAs: xn1vafn
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/wip-publish.ts", "we:scripts/__tests__/wip-publish.test.mjs"]
dateOpened: "2026-09-28"
tags: []
---

# File the prevention guard(s) owed by chalbert/plateau-app#187's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/wip-publish.ts:109` — Extract the live-agent option assembly (or the cadence choice) into a small pure function in `src/wip` and unit-test that it passes `PUBLISH_EVERY_MS` as `readEveryMs`. Alternatively, add a check:standards rule that any `createAgent(` call in scripts/ sets `readEveryMs` explicitly.
2. `we:scripts/wip-publish.ts:111` — A standard requiring that manually probed time-based behaviors (especially those fixing performance/churn issues) must be codified into fake-clock tests rather than relying entirely on manual verification.

Idempotency key (do not edit): approval-prevention-key:chalbert/plateau-app#187@c4b00de87f80f3b459211191d2a619b2026c87cd

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
