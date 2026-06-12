---
type: idea
workItem: story
size: 5
status: open
parent: "314"
dateOpened: "2026-06-11"
tags: [exercise-app, telecom, cpq, configurator, requirements]
crossRef: { url: /backlog/314-flagship-exercise-apps/, label: "Flagship exercise apps (#314)" }
---

# Exercise app G — Telecom CPQ (configure-price-quote): derive requirements & scope the build

Candidate **G** from the flagship-exercise-apps epic ([#314](/backlog/314-flagship-exercise-apps/)).
Derive a full, complex requirements set for a **telecom service-plan CPQ** app — a **configure →
price → quote → order** flow with a product configurator that has **dependency constraints** between
options (plans, add-ons, devices, bundles), pricing computed from the configuration, and order
capture. This is the most direct exercise of the **Technical Configurator** and **NL-to-configurator**
paradigms. Fidelity to a real carrier's catalog is optional. This story ends when the requirements
are documented well enough to scope the build.

## What to derive

- **Product catalog & configuration model:** plans, add-ons, devices, bundles; the option dependency / constraint graph (requires / excludes / implies).
- **Pricing:** price derived from the chosen configuration (base + add-ons + promotions + term).
- **Quote → order:** quote generation, customer details, order capture & submission.
- **Validation:** invalid configurations blocked or auto-resolved; constraint feedback to the user.
- **Actors & roles:** sales rep vs. self-serve customer (+ permissions).

## Surfaces it stresses (per #314 matrix)

Technical Configurator / NL-to-config (primary — dependency constraints), validation +
requirement-as-code (constraint rules), collection-ops / pagination (catalog), persistence (saved
quotes), nav blocks / view-transitions (stepped flow).

## Requirements source strategy

Derive from first principles using a generic telecom catalog (mobile plans + devices + add-ons) —
synthesize the constraint graph; complexity comes from the dependencies, not real carrier data.

## Done when

A requirements doc exists (catalog & constraint model, pricing rules, quote/order flow, role map)
detailed enough to break the build into agent-ready slices.
