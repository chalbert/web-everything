---
bornAs: x464p6l
kind: task
parent: "2822"
status: open
dateOpened: "2026-08-02"
tags: [conveyor, prevention, oracle, gate-config, anti-test-gaming]
---

# Register acceptance-oracle test files as spec-tier and require a non-author signal on the oracle diff

A slice that authors or relaxes its own acceptance oracle can weaken the very test that clears it, with no gate visibility and no independent sign-off. Register acceptance-oracle test files as spec-tier paths in `we:scripts/lib/gate-config.mjs` so weakening one becomes gate-visible, and require a non-author signal on the oracle diff. This is the mechanized form of the #2398 anti-test-gaming guard.

## Gap

Acceptance-oracle test files are not tiered in `we:scripts/lib/gate-config.mjs`, so a diff that loosens an oracle looks like ordinary test churn — nothing marks the change as touching a clearance mechanism, and nothing requires a second party to sign it.

## Why it matters

The `#deterministic-oracle-clears-slice` anchor rests on the oracle being trustworthy: a green oracle clears its slice. If the slice that *authors or relaxes* the oracle can also be cleared by that oracle's own green, the guarantee is circular — the exact anti-test-gaming case #2398 rejects. Making oracle files spec-tier plus a non-author signal restores independence mechanically.

## Mechanical fix

1. Register acceptance-oracle test files as **spec-tier** paths in `we:scripts/lib/gate-config.mjs`, so weakening one becomes gate-visible (the gate-self / policy-spec surface treats it as a clearance mechanism, not free test churn).
2. Require a **non-author signal** on any diff that modifies an oracle file — the slice that writes or relaxes the oracle is never cleared by that oracle's own green.

## Provenance

Outstanding prevention **M2** from the human `/review` on **PR #982** (`we:backlog/xzc1sc5-stop-the-line-conveyor-governance-the-orchestrator-never-abs.md`), captured per the prevention-introspection discipline (#2823). Composes with `#agent-convergence-independent-validation` (#2398). Enforcement belongs on the open conveyor-mechanization line (#2840 / #2785); this item does not reopen the resolved decision.
