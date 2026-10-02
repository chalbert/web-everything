---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/lib/gh-throttle.mjs", "we:scripts/lib/__tests__/helpers/secret-absence.mjs", "we:scripts/lib/__tests__/gh-throttle.test.mjs"]
dateOpened: "2026-10-01"
tags: []
---

# Prevention — Add a runGhCliPassthrough case for a personal-route rate-limit 403 that asserts no fallback and the rat… (from chalbert/web-everything#3341 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/lib/gh-throttle.mjs:1753` — Add a runGhCliPassthrough case for a personal-route rate-limit 403 that asserts no fallback and the rate-limit retry/backoff path. A lens that asks for each exclusion in a predicate to have one wired-through test would catch this class.
2. `we:scripts/lib/__tests__/helpers/secret-absence.mjs:19` — A linter rule banning `.toContain()` on arrays of strings when checking for secrets, or requiring environment variables to be serialized to a string (e.g., `JSON.stringify`) before substring assertions.
3. `we:scripts/lib/gh-throttle.mjs:1307` — A strict coverage gate enforcing that all documented guarantees in docstrings map to an explicit, named integration test that exercises the runtime behavior.
4. `we:scripts/lib/gh-throttle.mjs:463` — A review standard or coverage tool that demands explicit test cases for edge-case behaviors highlighted in code comments (such as relying on empty array boolean resolution).

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3341@88de395bbed34e2e273ba9ce0c35230bb5a9c14d

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
