---
type: idea
workItem: story
size: 3
parent: "181"
status: open
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
  [#098](/backlog/098-licensing-strategy/); settle before launch and label tiers
  honestly.
- **ToS / EULA + Privacy Policy** — required to sell; privacy policy states the
  telemetry stance ("no source code leaves the machine") and is GDPR-compliant. A
  merchant-of-record ([#183](/backlog/183-payments-merchant-of-record/)) offloads
  some compliance here.
- **Insurance** — professional liability / E&O; revisit as deal size grows.
- **Data processing / DPA** — ready if any customer data touches our systems
  (license endpoint, telemetry); minimise data to minimise this.
