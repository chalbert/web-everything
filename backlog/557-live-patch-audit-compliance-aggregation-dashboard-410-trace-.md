---
kind: story
size: 5
status: open
blockedBy: ["410", "554"]
dateOpened: "2026-06-14"
tags: [dev-browser, live-patch, deployed-app, saas, audit, compliance, soc2, hosted]
---

# Live-patch audit & compliance aggregation dashboard — #410 trace records across apps

#410 emits every deployed live-patch as an audit record into the app's trace substrate (who · action · timestamp · affected resource · diff · evidence · revert). This story aggregates those records across apps and teams in the hosted SaaS into a SOC2-style compliance dashboard: every live-patch ever applied, by whom, reverted or promoted to a PR, with break-glass elevations and expiries surfaced — the compliance view that makes the capability enterprise-credible. Blocked on #410 (defines the audit record) and #554 (the SaaS shell).

## Scope

- **Aggregate** the per-app trace-substrate audit records #410 Fork 4-A emits — no new audit *sink*, this
  reads the substrate that already exists (no new lock-in).
- **Cross-app / cross-team rollup** — every live-patch across the org's apps in one view.
- **SOC2-shaped fields** — user · action · timestamp · affected resource · justification + the patch diff,
  before/after evidence, and revert; break-glass **elevations and expiries** surfaced as first-class.
- **Lifecycle status** per record — applied-and-reverted vs. promoted-to-PR vs. merged.

Read-only governance/compliance surface; it consumes #410's audit output and does not change patch
behaviour. Sibling hosted work: the collaboration epic (#555) and the policy console (#556).
