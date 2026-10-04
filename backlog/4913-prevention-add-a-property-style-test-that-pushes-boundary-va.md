---
bornAs: xuh4gic
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:src/wip/progress-history.ts", "we:src/wip/wip-read.ts", "we:src/wip/progress-history.test.ts", "we:src/wip/__tests__/progress-history.test.mjs", "we:src/wip/__tests__/wip-read.test.mjs"]
dateOpened: "2026-10-03"
tags: []
---

# Prevention — Add a property-style test that pushes boundary values (empty cardRefs, 201-char mergeSha, oversized origin)… (from chalbert/plateau-app#199 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:src/wip/progress-history.ts:19` — Add a property-style test that pushes boundary values (empty cardRefs, 201-char mergeSha, oversized origin) through readConfirmedDeliveries and asserts assertConfirmedDeliveries accepts the result. Better, reject or normalize those values at batch ingest by sharing constraints with the relay contract.
2. `we:src/wip/wip-read.ts:516` — Hoist the default repo list to one constant used by both paths, and add a fallback test that omits deliveryRepos.
3. `we:src/wip/progress-history.ts:98` — Add a separate wire projection that keeps only an allowlist of evidence fields: source, observedAt, mergedAt, repo and number. Add a relay-contract test that fails when `raw` or other unrendered producer fields appear in the published payload. A standards-check rule against publishing `raw` fields would be the deterministic gate.
4. `we:src/wip/progress-history.test.ts:33` — Rename the test to 'detects corruption via checksum' and note in a comment that it gives no authenticity. Use an HMAC with an owner-held key if tamper resistance is actually needed.
5. `we:src/wip/progress-history.ts:133` — Add a deterministic replay regression asserting that repeated unreconciled batches cannot establish coverage, complete zeros, or comparable trends until reconciliation occurs.

Idempotency key (do not edit): approval-prevention-key:chalbert/plateau-app#199@d29605a8c3c3edc11714fe534008776d49a13a54

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
