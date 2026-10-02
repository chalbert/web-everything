---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/reconcile-pass.mjs", "we:scripts/conveyor/__tests__/reconcile-pass.test.mjs"]
dateOpened: "2026-10-01"
tags: []
---

# Prevention — Add a regression test that runs with source 'fallback' required checks and several PRs lacking a requir… (from chalbert/web-everything#3432 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/conveyor/reconcile-pass.mjs:985` — Add a regression test that runs with source 'fallback' required checks and several PRs lacking a required name, asserting a bounded number of REST reads. Also add a cross-tick negative TTL cache for heads already hydrated as incomplete. The card already files a post-deployment cost review.
2. `we:scripts/conveyor/reconcile-pass.mjs:1005` — Add a reconcile-pass test where the snapshot already contains a failing required check and the hydration read throws, asserting an explicit chosen outcome (heal or hold). Make the policy a documented invariant in the hydrateChecks header.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3432@2498e55c6b57f30b629e1477e55366138ef724d6

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
