---
bornAs: xzecxns
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:src/wip/wip-read.ts", "we:src/wip/wip-read.test.ts", "we:scripts/operations/delivery-report-record.mjs", "we:scripts/operations/delivery-report-store.mjs", "we:src/wip/__tests__/wip-read.test.mjs", "we:scripts/operations/__tests__/delivery-report-record.test.mjs", "we:scripts/operations/__tests__/delivery-report-store.test.mjs"]
dateOpened: "2026-09-30"
tags: []
---

# File the prevention guard(s) owed by chalbert/plateau-app#188's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:src/wip/wip-read.ts:321` — Add a wip-read test that points the real `we:queue-store.mjs` at a corrupt queue file and asserts the intended degraded or healthy outcome. That pins the contract either way.
2. `we:src/wip/wip-read.test.ts:473` — Add a `null` addedAt case to the wip-read test. A review-lens note is enough; this is not gate-decidable.
3. `we:scripts/operations/delivery-report-record.mjs:159` — Add explicit terminal-state validation and a table-driven test gate covering omitted, null, empty, and valid outcome/files combinations, including transitions from a default newDeliveryReport record.
4. `we:scripts/operations/delivery-report-record.mjs:132` — A test asserting that a `done` status report with a missing (null) outcome fails validation.
5. `we:scripts/operations/delivery-report-record.mjs:137` — A test asserting that `outcome: 'done'` with a null or empty `filesTouched` array is rejected by the validator.
6. `we:scripts/operations/delivery-report-store.mjs:1` — A check:standards rule requiring that every new `.mjs` module added to the operations directory must be accompanied by a `.test.mjs` file.

Idempotency key (do not edit): approval-prevention-key:chalbert/plateau-app#188@7ca974e7c2fb04f5e7ca26dd8a0ffefabdf3a306

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
