---
name: contract-split-for-tier-ownership-decisions
description: For "which trust tier owns a gate/definition" decisions, the ratified default is contract-split — engine-tier the impl code, policy-tier a *.contract.json for the definition; these are micro-decisions suited to on-card surfacing in the future UI
metadata:
  type: reference
---

When a decision asks "what trust tier should own X" — a gate, validator, or definition an agent could quietly weaken and then self-clear (the #809-class self-approval hole) — the ratified default path (WE #2625, mirroring the `review-policy.contract.json` split) is **contract-split**: keep the implementation code in the ENGINE tier (agent-clearable — often the hottest, most-churned files) and move the *definition* (what counts as green/valid) into a **policy-tier `*.contract.json`**. This closes the self-approval hole without stranding the hot impl files behind a human.

**Why:** an always-human/policy-tier promotion of the whole gate over-gates the churny impl and (per the #2625 skeptic) has no real review-clearance conflict-of-interest for a conformance gate; the split isolates exactly the part that must not be self-weakened.

**How to apply:** for the next "which tier owns this gate/definition" fork, propose contract-split first and cite #2625 + review-policy.contract.json as precedent — it resolves fast. Operator (2026-07-28): "this is exactly the path to take in similar decisions," and noted these are small, patterned rulings "easily brought forward as a micro decision on card in the future UI" — the future product should surface this class inline on the item card (tie-in: the decision-surface work #2577), not via a full prepare/preview cycle.
