---
bornAs: xrai0gj
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/lib/__tests__/antigravity-judge-spawn.test.mjs", "we:scripts/lib/antigravity-judge-spawn.mjs"]
dateOpened: "2026-09-28"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2891's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/lib/__tests__/antigravity-judge-spawn.test.mjs:141` — A unit test asserting that `Object.values(ANTIGRAVITY_MODEL_EFFORT_OVERRIDES[model]).every(v => Object.values(ANTIGRAVITY_EFFORT_MAP).includes(v))`.
2. `we:scripts/lib/antigravity-judge-spawn.mjs:225` — A lint rule or convention discouraging defensive normalizations within map lookups, preferring direct `Map[key]` to fail fast and ensure the key matches downstream usage.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2891@a27b4abeec766856aa69507e14fabf65eb918fea

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
