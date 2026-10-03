---
bornAs: xcux0gb
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/lib/gh-throttle.mjs", "we:scripts/lib/__tests__/gh-throttle.personal-route.test.mjs", "we:scripts/lib/__tests__/gh-throttle.test.mjs"]
dateOpened: "2026-10-03"
tags: []
---

# Prevention — Add a runGhSync test that sets WE_GH_THROTTLE_GH_BIN in throttle.env (no throttle.bin) and asserts that… (from chalbert/web-everything#3669 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/lib/gh-throttle.mjs:1533` — Add a runGhSync test that sets WE_GH_THROTTLE_GH_BIN in throttle.env (no throttle.bin) and asserts that the personal-token lookup shells out to that binary. A mutation-testing gate on we:scripts/lib/gh-throttle.mjs would catch this class of untested branch.
2. `we:scripts/lib/__tests__/gh-throttle.personal-route.test.mjs:451` — Use `vi.stubEnv('GH_TOKEN', '')` and `vi.stubEnv('GITHUB_TOKEN', '')` (with an afterEach `unstubAllEnvs`) in every test that relies on an inherited default login. A lint or test helper that scrubs credential env vars for the whole file would cover the class.
3. `we:scripts/lib/gh-throttle.mjs:1525` — Add a deterministic credential-precedence test matrix covering conflicting process.env, throttle.env, and explicit execOpts.env credentials, asserting both the executed credential and logged identity.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3669@ec82645223eaa731473694ae77005c87e18d9157

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
