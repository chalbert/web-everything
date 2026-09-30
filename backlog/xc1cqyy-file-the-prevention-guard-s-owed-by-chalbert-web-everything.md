---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/operations/probation-build-run.mjs", "we:scripts/operations/__tests__/probation-build-run-isolation.test.mjs", "we:scripts/operations/__tests__/probation-build-run.test.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3044's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/operations/probation-build-run.mjs:563` — When the preflight checks a blocker, it should run a bounded `git fetch origin main` first and fail closed if the fetch fails. Add a stale-ref fixture test. A lint that flags `origin/main` reads with no fetch in the same function would gate the whole class.
2. `we:scripts/operations/__tests__/probation-build-run-isolation.test.mjs:164` — Add a test case for each documented guarantee: missing blocker, mixed blockers, and unparseable frontmatter. A review lens that asks for a named test per prose guarantee would also catch this class.
3. `we:scripts/operations/__tests__/probation-build-run-isolation.test.mjs:163` — When a doc or comment states a fail-closed guarantee, require a paired test that reddens when the guarded branch is removed. A review lens item is enough; no deterministic gate exists for this.
4. `we:scripts/operations/probation-build-run.mjs:573` — Add a deterministic isolation test with blockedBy pointing to a missing main card, asserting outcome `blocked`, the blocker ID, and no lane or claim calls.
5. `we:scripts/operations/probation-build-run.mjs:568` — A static linter with standard rules like ESLint's `no-undef` wired into a `check:standards` gate would flag the undefined variable reference before execution.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3044@12ea45325ea4c938311740d4c1d7d4f62f42fc4e

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
