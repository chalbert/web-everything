---
type: decision
workItem: story
size: 3
parent: "181"
status: resolved
codifiedIn: docs/agent/platform-decisions.md#monetization
blockedBy: ["182"]
dateOpened: "2026-06-08"
dateStarted: "2026-06-11"
dateResolved: "2026-06-11"
graduatedTo: none
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

## Ruling (2026-06-11)

**MoR via Lemon Squeezy.** Both forks decided: (a) merchant-of-record over raw Stripe — the global
VAT/sales-tax offload is the whole point for a solo founder; (b) Lemon Squeezy over Paddle — its
native license-key API collapses most of [#182](/backlog/182-license-key-issuance-validation/) into a
thin webhook wrapper, it's built for selling developer tools, and the 2024 Stripe acquisition removes
the longevity risk. Paddle stays the documented fallback if Stripe-independence or subscription/
enterprise depth ever outweighs the built-in license layer. Implementation tracked in the follow-on
build item below.

## Options & tradeoffs

Two forks: **(a) MoR vs raw Stripe** and **(b) which MoR**.

- **MoR vs raw Stripe** — MoR (Paddle/Lemon Squeezy) is the *reseller of record*, so it
  registers/remits global VAT & sales tax for you; raw Stripe leaves you liable to register
  and file per-jurisdiction (or bolt on Stripe Tax + a filing service). For a solo founder the
  tax offload is the whole point → **MoR, settled.** Cost is the premium (~5% + 50¢ vs Stripe's
  ~2.9% + 30¢) — acceptable rent for not owning global tax.
- **Lemon Squeezy** — developer-product focused; ships a **native license-key API**
  (generate/activate/validate), which largely *is* [#182](/backlog/182-license-key-issuance-validation/),
  shrinking that story to a thin wrapper. Acquired by Stripe (2024), so longevity is now
  de-risked (the historical indie-tool concern). Fees ~5% + 50¢.
- **Paddle (Billing)** — more mature subscription/enterprise tooling and long independent track
  record; also MoR with strong tax handling. **No turnkey license-key system** — you'd build
  #182 yourself. Independent of Stripe.

**Recommendation: MoR via Lemon Squeezy.** Its license-key API collapses most of #182 into
"webhook → call LS issuance," it's purpose-built for selling developer tools, and the Stripe
acquisition removes the longevity risk. Fall back to **Paddle** only if subscription/enterprise
maturity or Stripe-independence outweighs losing the built-in license layer.
