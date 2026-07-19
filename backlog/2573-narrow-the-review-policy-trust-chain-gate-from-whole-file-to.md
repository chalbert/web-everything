---
bornAs: xzcdvz7
kind: story
size: 5
status: open
blockedBy: ["2566"]
dateOpened: "2026-07-19"
tags: []
---

# Narrow the review-policy trust-chain gate from whole-file to spec-diff — impl refactors agent-clearable when conformance stays green

Payoff of #2566 (which built the review-escalation policy CONTRACT + conformance suite). Today
we:scripts/lib/review-core.mjs and we:scripts/lib/review-escalation.mjs are whole-file policy-tier: ANY edit
forces review:human. Narrow that so the human gate fires on a diff to the CONTRACT
(we:scripts/lib/review-policy.contract.json), while a behaviour-preserving refactor of the derivation code
that keeps the conformance suite green becomes agent-clearable — the #2563 Fork 1 / #2564 spec-based end
state. Deliberately deferred from #2566 (which fails safe to the whole-path gate until this lands). This is a
real policy loosening, so it needs its own human-reviewed change: keep the conformance suite + gate-invariants
as the backstop that turns any silent disposition change red.
