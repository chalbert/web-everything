---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:skills-src/conveyor/build-dispatch-daemon.mjs", "we:scripts/operations/deliver-item-wrapper.mjs", "we:run.mjs", "we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs", "we:scripts/operations/__tests__/deliver-item-wrapper.test.mjs", "we:./__tests__/run.test.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2899's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:skills-src/conveyor/build-dispatch-daemon.mjs:385` — Add a lint or standards rule that every `execFileSync` in a daemon tick path passes an explicit `timeout`. Alternatively, run the retry pass async or detached with its own bound.
2. `we:skills-src/conveyor/build-dispatch-daemon.mjs:385` — Add a unit test that injects the exec function into `cliRetryInfraBlocked` and asserts env and parse behaviour. The house rule is that each prose guarantee gets a named test.
3. `we:skills-src/conveyor/build-dispatch-daemon.mjs:385` — Add a unit test asserting an explicitly set CONVEYOR_INFRA_FILE wins over the primary-checkout default. More generally, a lint or convention that env-derived overrides must honour an already-set value.
4. `we:skills-src/conveyor/build-dispatch-daemon.mjs:388` — A check:standards rule requiring `timeout` on execFileSync/spawnSync calls in daemon tick paths, and redaction of stderr before it is logged.
5. `we:scripts/operations/deliver-item-wrapper.mjs:2419` — Have pr-land or open-pr-io emit a structured reason code on the halted effect and match on that field, with a test where the token appears inside quoted content.
6. `we:skills-src/conveyor/build-dispatch-daemon.mjs:372` — A test asserting that an explicit env var is honored unconditionally even when the target file does not exist, or a lint rule against using existsSync to gate explicit configuration values.
7. `we:skills-src/conveyor/build-dispatch-daemon.mjs:384` — A unit test that explicitly verifies the CLI arguments passed to `execFileSync`, or an end-to-end integration test that asserts the exact JSON structure of the daemon's output.
8. `we:run.mjs:1` — A pre-merge CI gate that automatically runs all modified or newly introduced soak breaks end-to-end to guarantee they do not crash the harness.
9. `we:skills-src/conveyor/build-dispatch-daemon.mjs:370` — A central shared constant or utility for resolving the canonical repository path rather than duplicating hardcoded path strings across multiple daemon files.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2899@dd6d516d15e73978478133498ebb7fa81b36bbf9

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
