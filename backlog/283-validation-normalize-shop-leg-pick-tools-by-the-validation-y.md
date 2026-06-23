---
kind: story
locus: plateau-app
size: 5
status: parked
parkedReason: maturityGated
maturityTrigger: "adoptionSignal: Technical Configurator matured past POC"
dateOpened: "2026-06-11"
tags: [dev-experience, devtools, validation, adapters, normalization, technical-configurator, dev-surface, no-lock-in]
parent: "236"
---

# Validation-normalize: shop leg (pick tools by the validation you want)

Third leg of the adapter-as-normalization-hub (spun out of #236). Browse which tools cover which concerns and choose tools by the validation you want, foregrounding the no-equivalent cells as the shopping signal. This is a Technical Configurator domain (#150 Q6 — the [project-protocol-bar](docs/agent/platform-decisions.md#project-protocol-bar) rule) — GATED on the configurator evolving well past its current POC, so directional, not an immediate build. Comparative model + knowledge base already exist in scripts/validation-normalize/.

> **Parked 2026-06-14 (batch housekeeping).** Mis-flagged Tier-A: the loader saw no `blockedBy` and ranked
> it batchable, but the body's own gate ("GATED on the configurator evolving well past its current POC,
> directional, not an immediate build") makes it not-yet-actionable. Parked so it stops surfacing in the
> ready pool; unpark once the Technical Configurator (#150/#236) matures past POC.
