---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/lib/pr-limit.mjs", "we:scripts/readiness/dispatch-plan.mjs", "we:skills-src/conveyor/build-dispatch-daemon.mjs", "we:scripts/lib/__tests__/pr-limit.test.mjs", "we:scripts/readiness/__tests__/dispatch-plan.test.mjs", "we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs"]
dateOpened: "2026-10-02"
tags: []
---

# Prevention — Add a test in we:pr-limit.test.mjs where the first N PRs' commits reads throw. Assert that later PRs st… (from chalbert/web-everything#3215 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this PR's latest advisory review named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/lib/pr-limit.mjs:232` — Add a test in we:pr-limit.test.mjs where the first N PRs' commits reads throw. Assert that later PRs still get resolved, or that a failed PR is negatively cached or rotated.
2. `we:scripts/readiness/dispatch-plan.mjs:938` — Pass `--no-track-attempts` only when the planning snapshot env is set. Alternatively, add a test that pins the dispatch-plan scope-collect arguments and names the breach counter's owner.
3. `we:skills-src/conveyor/build-dispatch-daemon.mjs:222` — Guard with `if (error && typeof error === 'object')`, and add a test that throws a string from an effect.
4. `we:scripts/lib/pr-limit.mjs:194` — Add a deterministic regression test that keeps the head fixed, changes the base and returned commit range, and requires the authorship verdict to be recomputed; include base identity and movement in cache invalidation.
5. `we:scripts/lib/pr-limit.mjs:202` — Add a deterministic multi-round test with three persistently failing leading PRs and resolvable trailing PRs; require bounded calls and eventual attempts for every trailing entry, using persisted rotation or retry cooldowns.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3215@531fca7854e9f4c433d8d9d0ca7703f27cb7bfd8

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
