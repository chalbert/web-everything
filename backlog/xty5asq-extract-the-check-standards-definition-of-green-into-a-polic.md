---
kind: story
size: 3
parent: "2625"
status: open
dateOpened: "2026-07-28"
scope: ["we:scripts/check-standards.contract.json", "we:scripts/lib/gate-config.mjs", "we:scripts/lib/__tests__/check-standards.conformance.test.mjs"]
tags: [plateau-loop, governance, gate, trust-chain]
---

# Extract the check:standards definition-of-green into a policy-tier contract

Execute the #2625 contract-split ruling (fork (d)): the `check:standards` gate keeps its
implementation in the ENGINE tier (agent-clearable) while its *definition of green* moves into a
POLICY-tier contract, so a real weakening of the gate forces `review:human` but routine lint/rule
churn does not. #2625 ratified the **approach**; this item is the **code**.

## Do

1. **Mint [we:scripts/check-standards.contract.json](../scripts/check-standards.contract.json)** — a
   small data file holding the *definition of green* (the semantic thresholds / rule-set that decide
   pass-vs-fail), extracted out of the impl, mirroring
   [we:scripts/lib/review-policy.contract.json](../scripts/lib/review-policy.contract.json).
2. **Register the tiers in [we:scripts/lib/gate-config.mjs](../scripts/lib/gate-config.mjs)** — the new
   contract as `tier: 'policy'`, and BOTH engine files
   ([we:scripts/check-standards.mjs](../scripts/check-standards.mjs) +
   [we:scripts/check-standards-rules.mjs](../scripts/check-standards-rules.mjs)) as `tier: 'engine'`
   (the fork-(b) floor — always escalate, agent-clearable, anchored by an explicit roster entry rather
   than the incidental `^scripts\/` regex).
3. **Add a conformance suite** (e.g.
   `we:scripts/lib/__tests__/check-standards.conformance.test.mjs`, modelled on
   [we:scripts/lib/__tests__/review-policy.conformance.test.mjs](../scripts/lib/__tests__/review-policy.conformance.test.mjs))
   that pins impl↔contract, so a behaviour-preserving impl refactor stays green/agent-clearable while
   a definition change goes red → forces a contract edit → `review:human`.

## Done when

- A definition-weakening diff (edit the contract) trips the policy path → `review:human`; a
  behaviour-preserving impl edit does not.
- The conformance suite fails if the impl and the contract diverge.
- `npm run check:standards` is green.

Ratified approach + full grounding: #2625. Precedent: the
[we:scripts/lib/review-policy.contract.json](../scripts/lib/review-policy.contract.json) / loader split
(#2566/#2564). Statute:
[we:docs/agent/platform-decisions.md#contract-split-for-tier-ownership](../docs/agent/platform-decisions.md#contract-split-for-tier-ownership).
