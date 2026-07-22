---
bornAs: x66ywyw
shortTitle: "Proof-production backend"
kind: epic
size: 8
parent: "2527"
status: open
blockedBy: ["2561"]
tags: [plateau-loop, proof, verification, trust, provenance, epic]
dateOpened: "2026-07-18"
---

# Proof-production backend — provenance tiers + pre-PR harness re-run

The largest hole in G2. The console renders "spec-proven" fractions (two-track progress, the review modal's
evidence rows) but nothing PRODUCES trustworthy proof — the design's own core finding (§3f-C) is **"the agent
grades its own homework."** Without a real proof backend the green spec-proven bar is just the agent's
self-claim: G2's exact failure mode, dressed up as satisfied. This epic makes delivered = *proven*, not
claimed. Blocked on the spec-schema fork F3 ([#2561]).

## Scope
- **Provenance tiers** on every proven criterion: `harness-owned probe` > `agent-authored, harness-replayed`
  > `agent-asserted`. The review surface shows the tier; the launch/merge gate can require a minimum tier.
- **Pre-PR harness re-run** — the harness independently re-runs the checks before the PR opens; the agent's
  assertions are replayed, not trusted. A criterion that fails the replay never renders green.
- **Per-requirement proof bundle** — each requirement (R1..Rn, per the F3 schema) links to its evidence
  (test run / log / screenshot / trace); the review modal deep-links to the specific artifact.
- **Confidence source** wiring — feed the launch gate's confidence (F2, [#2561]) from real signals, not a
  fixture.

## Acceptance
A card's spec-proven fraction reflects harness-verified criteria only; each carries a provenance tier and a
deep-linked evidence artifact; agent-asserted-only criteria are visibly distinguished and cannot satisfy a
gate that requires a higher tier. The board's proof rows ([#2555]) consume this.
