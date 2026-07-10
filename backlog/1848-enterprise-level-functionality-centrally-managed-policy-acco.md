---
kind: epic
status: open
dateOpened: "2026-06-27"
tags: []
---

# Enterprise-level functionality (centrally-managed policy, account controls)

Umbrella epic for enterprise-grade, centrally-managed functionality across the constellation — fleet policy distribution (e.g. telemetry consent override), SaaS account controls, and dev-browser enterprise configuration. The common shape is a low-cost server-based policy/precedence layer that overrides per-developer settings on machines an organization owns. Concrete enterprise features roll under this epic via parent; each is judged on merit and sized independently. Born from #1797 (anonymized dev-action metrics), whose enterprise-policy precedence layer for telemetry consent was the first concrete instance to need a home that did not yet exist.

## Slices (three named enterprise shapes)

The umbrella resolves only when all three shapes land — not when the first slice closes (the #1167/#1210
"resolved over uncarved scope" trap).

1. **Fleet policy distribution / telemetry consent override** — ✅ **delivered** via #2372 (WE
   `DevMetricsPolicy` contract + FUI three-tier resolver), the first concrete instance (from #1797). The
   locus fork was #1850.
2. **Enterprise SaaS account controls** — org/seat/role/account policy on the hosted control-plane, the SaaS
   analog of #2372's precedence layer. Carved 2026-07-09; needs `/prepare` + `/slice` on pickup.
3. **Dev-browser enterprise configuration** — managed policy over per-developer dev-browser settings; carved
   2026-07-09, `blockedBy` the dev-browser shell build (#1391).

*(Sliced 2026-07-09 by `/slice 1848` — carved the two remaining named shapes as story children after the
telemetry shape shipped. See `we:reports/2026-07-09-backlog-split-analysis.md`.)*
