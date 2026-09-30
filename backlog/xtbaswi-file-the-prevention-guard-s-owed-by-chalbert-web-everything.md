---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/operations/prepare-stamp-land.mjs", "we:skills-src/conveyor/build-dispatch-daemon.mjs", "we:scripts/conveyor/prepare-result.mjs", "we:scripts/operations/__tests__/prepare-stamp-land.test.mjs", "we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs", "we:scripts/conveyor/__tests__/prepare-result.test.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3046's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/operations/prepare-stamp-land.mjs:36` — Add a unit test that runs the worker on a `status: preparing` card with sections. It should either stamp it or fail with an explicit reason.
2. `we:skills-src/conveyor/build-dispatch-daemon.mjs:198` — Add a tick test with a live prepare row plus a non-prepare hold on the same num. It should assert the in-flight count still includes the row, or state the intended behaviour explicitly.
3. `we:skills-src/conveyor/build-dispatch-daemon.mjs:847` — Add a failing-spawn case to the 'prepare stamp detached worker wiring' describe block, and a small test of the worker's exit and route-release behaviour. Review lens: every comment that promises retry or backoff needs a named test.
4. `we:scripts/operations/prepare-stamp-land.mjs:34` — Use `git diff --name-status --no-renames`, or `--raw`, and require exactly one entry that is a modification (`M`) of a regular file (mode 100644) at the card path. Add rename and symlink cases to the unit test. Longer term, a shared helper for 'PR touches only path X' would help every daemon path that runs PR-head scripts.
5. `we:scripts/conveyor/prepare-result.mjs:21` — Add a deterministic regression test requiring empty fenced blocks to fail section validation while retaining acceptance of populated fenced commands.
6. `we:scripts/operations/__tests__/prepare-stamp-land.test.mjs:20` — Add a deterministic test with a stamped filesystem card and an unstamped git-show result, asserting rejection before open-pr.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3046@39beb43707d40ecb22c516f67bdceed582f7e84e

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
