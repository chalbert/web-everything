---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:skills-src/conveyor/build-dispatch-daemon.mjs", "we:backlog/xddlvn0-split-build-dispatch-concurrency-cap-by-provider-claude-vs-c.md", "we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2991's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this PR's latest advisory review named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:skills-src/conveyor/build-dispatch-daemon.mjs:268` — Add a daemon/policy test where the same num appears in both `listClaims` and `listRunStoreInFlight` and assert the merged `plan.inFlight` entry keeps `executor`. Then fix the merge, for example `{...f, ...prev}` with executor taken as `prev.executor ?? f.executor`. A lint or contract test cannot catch this class, so a test is the cheapest guard.
2. `we:backlog/xddlvn0-split-build-dispatch-concurrency-cap-by-provider-claude-vs-c.md:19` — Add a parameterized build-dispatch-policy test asserting that each provider dispatches below its cap and holds at or above its cap, including when the other provider is full.
3. `we:skills-src/conveyor/build-dispatch-daemon.mjs` — A JSON Schema or snapshot test for the daemon's stdout tick line that enforces output shape stability, preventing silent mutation of existing field types.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2991@e829553edb1b8ab621ccf4df8fdef4f86286c134

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
