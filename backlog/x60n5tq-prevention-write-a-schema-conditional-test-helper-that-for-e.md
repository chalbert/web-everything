---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:contracts/plateau-progress-view.test.ts", "we:contracts/plateau-progress-view.schema.json", "we:contracts/plateau-progress-view.examples.json"]
dateOpened: "2026-10-01"
tags: []
---

# Prevention — Write a schema-conditional test helper that, for each nullable field on an 'observed' row, nulls it and… (from chalbert/web-everything#3386 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:contracts/plateau-progress-view.test.ts:151` — Write a schema-conditional test helper that, for each nullable field on an 'observed' row, nulls it and expects rejection. Optionally add a mutation-testing step for contract schemas to a check:standards rule.
2. `we:contracts/plateau-progress-view.schema.json:2900` — Either state in the description that this is a consumer rule, or add a negative test (desiredMode 'stop' plus a running state plus status 'observed' must be rejected, or explicitly documented as accepted). A lint that flags guarantee phrases in schema descriptions without a matching negative test would catch this class.
3. `we:contracts/plateau-progress-view.examples.json` — Add a deterministic example-consistency test, or a check:standards rule, that lints every health-* example against the documented invariants. Those are expired reset implies stale, stop requested with running jobs implies pending or conflict, and completion older than staleAfterMs implies stale. Alternatively, fix the three fixtures.
4. `we:contracts/plateau-progress-view.test.ts:158` — Add table-driven validation tests rejecting reason: null for non-fresh statuses, paired with a fresh-evidence case accepting null; use these as a deterministic regression gate.
5. `we:contracts/plateau-progress-view.test.ts` — A deterministic lint rule for schema test files that forbids mutating nullable fields to format-invalid values (like empty strings) when testing conditional presence constraints.
6. `we:contracts/plateau-progress-view.test.ts` — A deterministic JSON Schema test coverage gate that verifies each conditional `anyOf` trigger in an `allOf` block is independently exercised from a neutral baseline.
7. `we:contracts/plateau-progress-view.schema.json` — A semantic contract linter that parses prose comments in schema definitions for invariant language ('remains', 'cannot') and requires a corresponding `if/then` validation block or an explicit exemption.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3386@e2667789e8948aa08d72630ad7b31111667ac3f0

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
