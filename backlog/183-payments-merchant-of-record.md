---
type: idea
workItem: story
size: 3
parent: "181"
status: open
blockedBy: ["182"]
dateOpened: "2026-06-08"
tags: [monetization, payments, merchant-of-record, lemon-squeezy, paddle, tax, infrastructure, solo-founder]
crossRef: { url: /backlog/181-commercialization-infrastructure/, label: "Commercialization infrastructure (#181)" }
---

# Payments via merchant-of-record → license issuance

Lean to a **merchant-of-record (Lemon Squeezy / Paddle)** over raw Stripe: it
handles global VAT/sales-tax, which is a real solo-founder time sink, and offloads
some compliance. The flow is **webhook → license-key issuance**
([#182](/backlog/182-license-key-issuance-validation/)).

Scope: pick the MoR, wire checkout, handle the issuance webhook, map
products/tiers to keys, and the refund/expiry paths. Pricing *shape* (per-seat /
per-repo, subscription vs. perpetual+updates) is decided alongside the strategy in
[#097](/backlog/097-roadmap-to-mvp/) as the MVP emerges; this story implements
whatever shape is chosen.
