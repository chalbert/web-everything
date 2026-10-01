---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:contracts/plateau-progress-view.test.ts", "we:contracts/plateau-progress-view.schema.json", "we:package-lock.json"]
dateOpened: "2026-10-01"
tags: []
---

# Prevention — Add a generic negative-case generator to the contract test that mutates each const/enum/required/anyOf… (from chalbert/web-everything#3330 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:contracts/plateau-progress-view.test.ts:65` — Add a generic negative-case generator to the contract test that mutates each `const`/`enum`/`required`/`anyOf` and asserts rejection. Alternatively, add a check:standards rule requiring each constraint keyword in contracts/*.schema.json to have a named negative test.
2. `we:contracts/plateau-progress-view.schema.json` — Add a contract-schema lint that flags any property named `url` or `*Url` that lacks a `pattern` or `format` restricting it to https. Also add a negative test per URL field.
3. `we:contracts/plateau-progress-view.test.ts:47` — Add parameterized single-violation negative tests for each comparable-window constraint and each window; require those tests to fail when their corresponding schema constraint is removed.
4. `we:package-lock.json:25` — A deterministic CI gate that runs `npm ci` (or `npm i --package-lock-only` and checks for a dirty tree) on all PRs to validate lockfile integrity.
5. `we:contracts/plateau-progress-view.test.ts:22` — A test coverage standard requiring every semantic `const` or specific rejection rule in a schema to have a corresponding negative snapshot test.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3330@40725023ccb98b76cb079e6121b1947186a8648f

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
