---
type: idea
locus: exercise-app
workItem: story
size: 5
status: resolved
parent: "314"
dateOpened: "2026-06-11"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: reports/2026-06-14-exercise-app-telecom-cpq-requirements.md (scoped + sliced; build = follow-on phase cards under #319)
tags: [exercise-app, telecom, cpq, configurator, requirements]
relatedReport: reports/2026-06-14-exercise-app-telecom-cpq-requirements.md
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

## Progress

Resolved 2026-06-14 (batch). Derived the full telecom service-plan CPQ requirement
set as `we:reports/2026-06-14-exercise-app-telecom-cpq-requirements.md` (matching the
loan/insurance PRD format), wired via `relatedReport`. Covers: a synthesized mobile-carrier
catalog; the **dependency-constraint model** (requires/excludes/implies/cardinality/eligibility)
as the headline Technical-Configurator + NL-to-config exercise; a configuration-derived pricing
engine (decision-trace); quote (persistence) and order (two lifecycles) capture; rep-assist
bounded overrides (permissions/audit); a role × resource permission model; a platform-surface
map; settled decisions (proposed telco-commerce visual register); and 8 proposed build slices
(S0–S7) that become the follow-on functional-phase cards.

Requirements-derivation only — no app code, no standard bypassed (nothing to GAP-tag). Story
ends at a scoped, sliced requirement set per its own acceptance. check:standards green;
app-conformance compliant (the lone GAP is the pre-existing `notification` draft). Per #314 candidate G.
