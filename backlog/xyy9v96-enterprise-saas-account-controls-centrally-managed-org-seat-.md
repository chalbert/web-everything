---
kind: story
size: 13
parent: "1848"
status: open
dateOpened: "2026-07-10"
tags: []
---

# Enterprise SaaS account controls — centrally-managed org/seat/role policy

Centrally-managed org / seat / role / account policy that overrides per-user settings on org-owned Plateau accounts — the SaaS analog of #2372's server-based precedence layer. Home: plateau-app hosted control-plane (alongside #091/#092). Under-specified: needs a /prepare on the account-model + control-plane surface, then /slice, on pickup. Second of #1848's three named enterprise shapes (fleet policy shipped via #2372).

## Next

Not yet batchable — the concrete deliverable (account model, org/seat/role schema, control-plane surface,
per-user override precedence) isn't scoped. On pickup: `/prepare` the account-model + control-plane
decision, then `/slice` this into buildable stories. Reuse the #2372 `DevMetricsPolicy` precedence pattern
(server-based policy overriding per-actor settings) as the shape.
