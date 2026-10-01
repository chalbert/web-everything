---
bornAs: xf1cldc
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/lib/pr-limit.mjs", "we:scripts/readiness/dispatch-plan.mjs", "we:scripts/readiness/already-done-refresh.mjs", "we:scripts/lib/child-failure.mjs", "we:scripts/lib/__tests__/pr-limit.test.mjs", "we:scripts/readiness/__tests__/dispatch-plan.test.mjs", "we:scripts/readiness/__tests__/already-done-refresh.test.mjs", "we:scripts/lib/__tests__/child-failure.test.mjs"]
dateOpened: "2026-09-30"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3176's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/lib/pr-limit.mjs:131` — Add a planner CLI test that enables the pr-limit check with a cold or stale snapshot. It should assert either a logged 'pr-limit unavailable' state or a conservative hold, not silent under-count.
2. `we:scripts/readiness/dispatch-plan.mjs:752` — Add a dispatch-plan CLI test with a low-headroom budget fixture asserting the deferred shape. Require the card to state any removed guard.
3. `we:scripts/readiness/already-done-refresh.mjs:130` — Keep the existsSync(cache) === false assertion in the bypass test, and pass the flag in the worker payload.
4. `we:scripts/lib/child-failure.mjs:7` — Give childFailure a max-bytes cap (tail-keep) and a secret-pattern scrub, plus a unit test for each; a lint flagging raw `.stderr` interpolation into log sinks would catch the class.
5. `we:scripts/readiness/already-done-refresh.mjs:64` — Reuse the existing scope-lease/admission lock primitive, or add an mtime-expiry on live pids plus an atomic rename-based takeover. A test with a live unrelated pid in the lock would redden.
6. `we:scripts/readiness/dispatch-plan.mjs:753` — Add a dispatch-plan CLI test with a low-budget admission fixture asserting the deferred output, so removing the guard fails a named test.
7. `we:scripts/readiness/already-done-refresh.mjs:51` — Add a deterministic integration test with complete but stale local refs and a newer implementation merge on the remote; require bounded background verification to remain eligible.
8. `we:scripts/readiness/dispatch-plan.mjs:929` — Restore an independent CLI bypass test using default cooldowns that asserts no verdict cache is created, while separately testing zero cooldown.
9. `we:scripts/lib/pr-limit.mjs:182` — A deterministic unit test in `we:pr-limit.test.mjs` verifying that `countOpenPrsForRepo` with `localOnly: true` fails safe (returns `unavailable: true`) when it encounters an unfetched PR branch, rather than silently misclassifying it as human.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3176@230098d70c6e0e3cdd602f1268c8610f2a416f46

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
