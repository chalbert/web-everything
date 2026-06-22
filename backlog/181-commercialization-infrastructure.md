---
kind: epic
status: open
dateOpened: "2026-06-08"
tags: [monetization, infrastructure, go-to-market, auth, licensing, payments, marketing, legal, solo-founder, product-agnostic]
crossRef: { url: /backlog/097-roadmap-to-mvp/, label: "Emergent MVP strategy (#097)" }
---

# Commercialization infrastructure — the product-agnostic scaffolding to charge money

The scaffolding required to **sell any product**, decoupled from *which* product
ships first. This was pulled out of the MVP roadmap ([#097](/backlog/097-roadmap-to-mvp/))
on purpose: the product is in flux and emergent, but the infrastructure to take
payment, license a tool, market it, and stay legal is **stable and well-defined**
regardless of which candidate becomes the MVP. So it gets its own epic, tracked
together, worked as discrete stories.

Everything here is sized for the **solo-founder tier-1 constraint**: lowest
operational burden, minimal always-on surface, no SLA. The only always-on
component is the tiny license endpoint (#182).

Child stories:

- **#182** — license-key issuance + validation endpoint (the one always-on surface) — under the [monetization](docs/agent/platform-decisions.md#monetization) rule.
- **#183** — payments via a merchant-of-record → license issuance.
- **#184** — marketing landing + pricing site (reuse webdocs).
- **#185** — go-to-market / marketing strategy.
- **#186** — legal & business-protection review (entity, trademark, ToS/EULA, privacy, insurance).

## Deferred behind product maturity (2026-06-11)

This whole epic is **deprioritized until the product is in a much better state** — we won't ship
until then, so none of the commercialization scaffolding is on the critical path. Selection should
**not** surface these children as live work yet. The design *shapes* are being settled cheaply as
decisions (e.g. [#182](/backlog/182-license-key-issuance-validation/) resolved its key-design forks)
so nothing is blocked on ambiguity, but the *builds* wait. Re-open the implementation stories when
the product is near first sale — the change-later cost stays near-zero until then (no keys issued,
no sales).
