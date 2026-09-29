---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/operations/deliver-item-wrapper.mjs", "we:skills-src/conveyor/build-dispatch-daemon.mjs", "we:scripts/conveyor/infra-blocked.mjs", "we:scripts/operations/__tests__/deliver-item-wrapper.test.mjs", "we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs", "we:scripts/conveyor/__tests__/infra-blocked.test.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2899's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/operations/deliver-item-wrapper.mjs:566` — Have classifyOpenPrFailure/openPr return the pr-land `recorded` flag, and add a wrapper test where `recorded:false` falls through to `wrapper-threw`. A lens note would work too, but a test is cheaper.
2. `we:skills-src/conveyor/build-dispatch-daemon.mjs:389` — A check:standards rule that flags execFileSync/execSync calls without `timeout` in conveyor daemon files, or requires them to go through we:lib/bounded-child.mjs.
3. `we:scripts/conveyor/infra-blocked.mjs:641` — Give resumeOpen an injectable exec, as cliRetryInfraBlocked already has, and add a behavioural test per branch (fetch outage, sha-moved, refused reason, unknown reason). Prefer that to source-regex assertions.
4. `we:scripts/conveyor/infra-blocked.mjs:642` — A deterministic lint rule (e.g. ESLint no-undef) to catch undefined functions at commit/CI time.
5. `we:scripts/conveyor/infra-blocked.mjs:644` — A static analysis lint rule (e.g., ESLint's `no-undef`) to catch calls to undefined functions, or a unit test that explicitly exercises the `git fetch` failure path.
6. `(cited file withheld: not a plain path)` — A checklist step during PR creation to ensure described file changes are actually present in the diff.
7. `we:scripts/conveyor/infra-blocked.mjs:641` — A standard linter rule (e.g., `eslint` `no-undef`) would statically catch the undefined function reference. Unit tests simulating a `git fetch` failure in `resumeOpen` would expose both the crash and the logic error.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2899@2458ab6070db459dec91ef28a2c64f3cc78de726

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
