---
kind: story
size: 3
parent: "181"
status: open
humanGate: { kind: review, what: "Pre-sale legal & business-protection review (entity, licensing/ToS, trademark, liability) — a professional/human action, not agent-doable; required before charging money." }
dateOpened: "2026-06-08"
tags: [monetization, legal, trademark, entity, eula, privacy, gdpr, insurance, compliance, solo-founder]
crossRef: { url: /backlog/098-licensing-strategy/, label: "Licensing strategy (#098)" }
---

# Legal & business-protection review — a single pre-launch checklist pass

Not a product phase but a **prerequisite to charging money**: sequence alongside
the rest of the infra, much of it before first sale. Keep it low-bottleneck —
likely a one-off professional review, not ongoing.

Checklist to review and settle:

- **Legal entity** — form one before taking payment (liability shield, clean IP
  + revenue ownership). Jurisdiction/type TBD.
- **Brand protection** — trademark the product/brand; secure domains + handles;
  clear the name before marketing spend ("Web Everything" / "Plateau" / Frontier
  UI clearance).
- **OSS + commercial license split** — the policy is its own decision in
  [#098](/backlog/098-licensing-strategy/) (the [monetization](docs/agent/platform-decisions.md#monetization) rule); settle before launch and label tiers
  honestly.
- **ToS / EULA + Privacy Policy** — required to sell; privacy policy states the
  telemetry stance ("no source code leaves the machine") and is GDPR-compliant. A
  merchant-of-record ([#183](/backlog/183-payments-merchant-of-record/)) offloads
  some compliance here.
- **Insurance** — professional liability / E&O; revisit as deal size grows.
- **Data processing / DPA** — ready if any customer data touches our systems
  (license endpoint, telemetry); minimise data to minimise this.

## Note (2026-06-11)
**Parked** — not agent-ready. Every line item (form a legal entity, file
trademarks, retain counsel for ToS/EULA + privacy policy, buy E&O insurance) is a
**human professional-services action**, not code a batch agent can execute; the body
itself frames it as *"a one-off professional review."* Deferred to the pre-launch
window (sequence alongside the rest of the #181 infra once #097 picks the MVP).
Resurface when launch is actually near.
