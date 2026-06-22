---
kind: story
size: 3
parent: "181"
blockedBy: ["097"]
status: parked
dateOpened: "2026-06-11"
tags: [monetization, payments, merchant-of-record, lemon-squeezy, license-issuance, checkout, solo-founder]
crossRef: { url: /backlog/183-payments-merchant-of-record/, label: "MoR ruling (#183 → Lemon Squeezy)" }
---

# Implement Lemon Squeezy MoR checkout + webhook→license issuance

Wire the ruled payments stack (#183: merchant-of-record via Lemon Squeezy — the [monetization](docs/agent/platform-decisions.md#monetization) rule). Set up the LS store + products mapped to tiers, embed/redirect checkout, and handle the order webhook by calling LS's native license-key API to issue a key (folding into #182 license issuance/validation). Cover the refund and expiry/revoke paths and map products→tiers→keys. Pricing shape (per-seat/per-repo, subscription vs perpetual+updates) comes from #097 as the MVP firms up; implement whatever shape is chosen. The MoR/vendor fork is decided and #182 is resolved.

## Parked 2026-06-16 (batch-2026-06-16)
`status: parked` — kept surfacing as "batchable" because its only `blockedBy` (#097) resolved, but #097 resolved as *"the product is too in flux to commit a scope; let the MVP emerge"* — there is **deliberately no chosen pricing shape** to implement and no single backlog node to wait on. Compounded by the deliverable being **external infra** (a live Lemon Squeezy store + deployed webhook + secrets) an agent can't provision. Park reflects the real state; unpark when an emerging MVP fixes a concrete pricing shape.

## Note (2026-06-11)
Re-flagged as **blocked on #097**, not agent-ready. Two reasons: (1) its own input — the pricing shape (per-seat/per-repo, subscription vs perpetual+updates) — is **undecided**; #097 (roadmap-to-mvp) is still open, so there is no chosen shape to "implement whatever shape is chosen." (2) The deliverable is **external infrastructure** (provisioning a live Lemon Squeezy store + products, a deployed webhook endpoint, secrets) that a code-session agent cannot stand up. Unblocks once #097 fixes the pricing shape; even then the provisioning is a human-in-the-loop build, not a pure-code batch item.
