---
bornAs: x0alreb
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/health-watch.mjs", "we:scripts/conveyor/health-smells/drain-merge-rate-drop.mjs", "we:scripts/conveyor/__tests__/health-watch.test.mjs", "we:scripts/conveyor/health-smells/__tests__/drain-merge-rate-drop.test.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2915's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/conveyor/health-watch.mjs:572` — Add a fixture test that puts a corrupt line in the drain history file. Or have the probe parse the tail line by line in a try/catch instead of relying on readJsonlTail.
2. `we:scripts/conveyor/health-watch.mjs` — A test asserting that a fixture `tick()` with `--lock-root` performs zero filesystem reads outside the lock root, or a strict mock of `REPO_ROOT` that throws when accessed during tests.
3. `we:scripts/conveyor/health-smells/drain-merge-rate-drop.mjs:58` — A review lens checking for exact alignment between metric counting conditions and the string interpolation that describes them to the user.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2915@26057325f18d0fdbda7d2c1bb7ae0efd94d67fa6

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
