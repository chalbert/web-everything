---
kind: story
size: 2
parent: "181"
status: open
humanGate: { kind: review, what: "Pre-sale legal & business-protection review (entity, trademark registration, commercial license, EULA, E&O, DPA) — a professional/human action, not agent-doable; required before charging money. The free-deploy hygiene half was split to #2363." }
dateOpened: "2026-06-08"
tags: [monetization, legal, trademark, entity, eula, insurance, compliance, solo-founder]
crossRef: { url: /backlog/098-licensing-strategy/, label: "Licensing strategy (#098)" }
---

# Legal & business-protection review — the pre-sale professional pass (charging-money half)

Not a product phase but a **prerequisite to charging money**: the subset of legal
protection gated by **first paid sale**, sequenced before revenue. Keep it
low-bottleneck — a one-off professional review, not ongoing.

> **Scope split (2026-07-09).** This item used to lump together *everything* legal.
> The half gated by **any public deploy** (privacy notice, LICENSE present, name
> *clearance*) — which a free WE-only deploy needs and which is agent-draftable — was
> split out to [#2363](/backlog/2363-public-deploy-legal-hygiene-what-a-free-we-only-deploy-actua/),
> homed under the public-rollout epic ([#1104](/backlog/1104-publish-the-website-publicly-gated-controlled-rollout/)).
> What stays here is only the **paid-sale professional review** below — genuinely
> deferred human professional-services work, kept parked behind product maturity.

Checklist to review and settle (all gated by charging money):

- **Legal entity** — form one before taking payment (liability shield, clean IP
  + revenue ownership). Jurisdiction/type TBD.
- **Trademark registration** — file our own marks ("Web Everything" / "Plateau" /
  Frontier UI) + secure domains + handles. (Non-infringement *clearance* — the cheap
  pre-branding knock-out — lives in #2363.)
- **OSS + commercial license split** — the policy is its own decision in
  [#098](/backlog/098-licensing-strategy/) (the [monetization](docs/agent/platform-decisions.md#monetization) rule); settle before launch and label tiers
  honestly. (A LICENSE merely *being present* is #2363.)
- **ToS / EULA (product)** — required to sell a licensed tool. A merchant-of-record
  ([#183](/backlog/183-payments-merchant-of-record/)) offloads some compliance here.
  (The free-site privacy notice is #2363.)
- **Insurance** — professional liability / E&O; revisit as deal size grows.
- **Data processing / DPA** — ready if any customer data touches our systems
  (license endpoint, telemetry); minimise data to minimise this.

## Note (2026-06-11, updated 2026-07-09)
**Parked** — not agent-ready. Every line item here (form a legal entity, file
trademarks, retain counsel for the product EULA + commercial license, buy E&O
insurance, DPA) is a **human professional-services action**, not code a batch agent
can execute; the body itself frames it as *"a one-off professional review."* Deferred
to the pre-launch window (sequence alongside the rest of the #181 infra once #097 picks
the MVP). Resurface when launch is actually near. **The near-term, agent-doable hygiene
that a free public deploy needs is no longer trapped in here — it's #2363.**
