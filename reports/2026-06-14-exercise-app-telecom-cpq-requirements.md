# Telecom service-plan CPQ — exercise-app requirements (app G, #319)

**Point:** Full, complex requirements for a telecom **configure → price → quote → order** (CPQ) app whose
defining difficulty is a **dependency-constrained product configurator** — options (plans, add-ons,
devices, bundles) that *require / exclude / imply* one another, with price derived from the chosen
configuration. The most direct exercise of the **Technical Configurator** and **NL-to-configurator**
paradigms, and the seventh flagship exercise app (#319), a forcing function for Web Everything. Fidelity to
a real carrier's catalog is optional — requirements need only be full and complex enough to stress the
platform.

Tracked by epic [#314](/backlog/314-flagship-exercise-apps/) (candidate G). Companion to the loan-app
(`we:reports/2026-06-11-exercise-app-loan-origination-requirements.md`) and auto-insurance
(`we:reports/2026-06-12-exercise-app-auto-insurance-requirements.md`) PRDs. This story ends at a scoped,
sliced requirement set; the build is the follow-on functional-phase cards.

## Scope

One synthesized **mobile-carrier catalog** (plans + devices + add-ons + bundles) — generic enough to avoid
real-carrier fidelity, rich enough that the **constraint graph** is the hard part. The app spans a stepped
**configure → price → quote → order** flow, a self-serve and an assisted (sales-rep) path, saved/revisable
quotes, and order capture. Built **platform-first**: every UI/behavior need resolves against Web Everything
(consume active blocks/intents; where a surface is draft/uncodified, that gap *is* the WE work this app
drives — see [we:exercise-app-workflow.md](../docs/agent/exercise-app-workflow.md)).

**Visual register (proposed): consumer telco-commerce / carrier-retail** — a bright, storefront-style
register distinct from the enterprise-finance (loan) and modern-SaaS insurtech (auto) registers already
claimed, proving the platform reskins via a `theme-<register>` token layer. (Per the per-app-register
program rule; final register assignment defers to that program.)

## Actors & roles

- **Self-serve customer** — browses the catalog, configures a plan/bundle, sees live pricing, saves a quote,
  enters their details, submits an order. Constrained to their own quotes/orders.
- **Sales rep (assisted)** — configures on a customer's behalf, may apply bounded overrides (waive a fee,
  apply an eligible promotion, override a soft constraint with a reason), converts a quote to an order, sees
  the book of in-flight quotes.
- **(Optional) Catalog/pricing admin** — owns the catalog seed, constraint rules, and price book versions
  (read-only surfaced in-app; full editing is out of scope for the first slices).

### Permission model (the webpermissions / webidentity exercise)

Role × resource matrix. A self-serve customer may create/edit *their* quote but not another's, cannot apply
rep-only overrides, and cannot edit a *submitted* order (changes become an amendment). Only a rep may apply
a bounded override (each override is reason-coded + audited). Cross-customer quote/book visibility is
rep/admin-only. Transitions are role-scoped and guarded (composes **Web Guards** + **Web Lifecycle**); every
consequential action (override, submit, amend) is audited (**Web Audit**).

## Domain glossary

Catalog, Plan, Add-on (feature pack, data boost, international, insurance), Device, Bundle, Line (one
subscriber), Term/Contract, Promotion, Eligibility rule, Constraint (requires / excludes / implies /
at-most-N / at-least-N), Configuration, Price book (versioned), Charge (one-time / recurring / usage),
Quote, Quote line, Order, Amendment, Reason code.

## The constraint model (the headline exercise)

A configuration is a selection over catalog options bound by a **constraint graph** — the part that makes
this CPQ, not a form. Constraint kinds:

- **requires** — `5G-plan` requires a `5G-capable device`; `family-bundle` requires ≥ 2 lines.
- **excludes** — `prepaid` excludes `device-financing`; two `unlimited-*` plans on one line are mutually
  exclusive.
- **implies / auto-add** — selecting `international-roaming` implies (auto-adds, removable) a `passport data`
  add-on; a promotion implies a minimum term.
- **cardinality** — at-most-N add-ons of a category; at-least-1 plan per line.
- **eligibility** — a promotion gated by term, bundle size, new-vs-existing customer, or device tier.

Invalid configurations are either **blocked with constraint feedback** (which selection conflicts with
which, and why) or **auto-resolved** (auto-add an implied option; offer to drop a conflicting one) — the
choice per rule is itself a configurator policy. This drives the **Technical Configurator /
NL-to-configurator** constraint-graph paradigm directly; "I want unlimited data for two phones with
international" should resolve to a valid configuration or an explained set of choices.

## Lifecycle / state machine (the Web Lifecycle exercise)

**Quote lifecycle:** `configuring → priced → quoted → (saved ↔ configuring) → ordered`; a quote may expire
(`quoted → expired`) when its price book version lapses. **Order lifecycle:** `submitted → validating →
(accepted → provisioning → active) | rejected`; `active → (amended → provisioning → active) | cancelled`.
Guards: submit requires a *valid, complete* configuration + customer details + accepted terms; amend
requires an active order + role; a price-book change invalidates an un-ordered quote (re-price guard).

## Functional requirements by module

### M1 — Catalog browser (collection-ops exercise)
Browse/filter/search plans, devices, add-ons, bundles; category facets; compare; paginated device grid.
Drives **collection-ops** (data-table/grid + **pagination** + filtering) and **status-indicator** (stock,
"compatible with your plan").

### M2 — Configurator (Technical Configurator / NL-to-config — primary exercise)
The core: select plan(s), device(s), add-ons, bundle across one or more lines under the constraint graph
(§ constraint model). Live constraint feedback; auto-resolve vs block per rule; an NL entry box that maps a
plain-language request onto a valid configuration (constrained to the catalog vocabulary). **Stepped flow
with view-transitions.**

### M3 — Pricing engine (requirement-as-code / rules-as-code exercise)
Derive price from the configuration: base plan charge + add-ons + device (one-time or financed over term) +
bundle discount + promotions − credits, split into **one-time / recurring / usage** charges and per-line +
account rollups. Emits an explainable **DecisionRecord** (each line item → which rule/price-book entry
produced it). Versioned **price book** (reproducibility).

### M4 — Quote (persistence exercise)
Generate a quote from a priced configuration; save, name, revisit, and revise (back to configuring);
side-by-side quote compare; quote expiry on price-book lapse. Drives **webpersistence** (save-and-resume)
and **collection-ops** (the rep's quote book).

### M5 — Order capture & submission
Customer details, address/credit-style checks (synthesized), terms acceptance, submit. Validation gate
(complete + valid config); on submit, the quote converts to an order and the order lifecycle begins. Drives
**validation**, **lifecycle**, **guards**, **audit**.

### M6 — Order management & amendments
View order status (provisioning → active), amend an active order (add a line, change a plan → re-price +
re-validate under the same constraint graph), cancel. Drives **lifecycle**, **re-rating**, **audit**,
**master-detail**.

### M7 — Rep assist & overrides
Rep-only: configure on behalf, apply a bounded, reason-coded override (waive fee / force-apply promo /
override a soft constraint), convert quote → order, book-of-quotes dashboard. Drives **permissions**,
**decision-trace**, **audit**, **collection-ops**.

## Business-rule catalog (rules-as-code home)

- **Constraints:** requires / excludes / implies / cardinality / eligibility over catalog options (§ above).
- **Pricing:** base × term × bundle-discount + add-ons + device-financing − promotions/credits; one-time vs
  recurring vs usage classification.
- **Promotion eligibility:** term ≥ N, bundle size, new-vs-existing, device tier → eligible / ineligible +
  reason code.
- **Order validation:** configuration completeness + validity + terms + customer details → submit / block.

Each evaluation (constraint check, price line, promo eligibility) is a versioned, explainable
**DecisionRecord** (decision-trace standard).

## Data model (entities)

Catalog (Plan[], Device[], AddOn[], Bundle[], Promotion[], Constraint[]), PriceBook (versioned),
Configuration (Line[] → selections), PricingResult (DecisionRecord, charges[]), Quote (status, lines[],
priceBookVersion), Order (status, amendments[]), Amendment, Customer, AuditEvent[], ReasonCode[].

## Cross-cutting / non-functional

Save-and-resume (webpersistence) for long configurations; configurator responsiveness as the constraint
graph grows; a11y across the stepped flow; the telco-commerce theme-token layer; deterministic seed catalog
(no Math.random) so pricing and constraints are reproducible.

## Platform-surface mapping (what each module exercises)

| Module | WE surfaces driven |
|---|---|
| M1 catalog browser | collection-ops (data-table/grid + pagination), status-indicator, search/filter |
| M2 configurator | Technical Configurator / NL-to-config, constraint validation, view-transitions |
| M3 pricing engine | decision-trace, requirement-as-code |
| M4 quote | persistence, collection-ops, view-transitions |
| M5 order capture | validation, lifecycle, guards, audit |
| M6 order mgmt / amend | lifecycle, master-detail, re-rating, audit |
| M7 rep assist / overrides | permissions, decision-trace, audit, collection-ops |

Already-shipped standards the loan + insurance apps drove (lifecycle, status-indicator, audit,
decision-trace, master-detail, data-table, pagination, validation, persistence, view-transitions,
permissions, configurator) are **consumed** here — telecom CPQ is their next consumer, a cross-app
conformance check. The **dependency-constraint configurator** (requires/excludes/implies/cardinality as a
first-class graph, with auto-resolve-vs-block policy and NL-onto-constraints) is the surface this app most
pushes — the likely new WE work it drives.

## Settled decisions

- **Domain:** one synthesized mobile-carrier catalog (plans + devices + add-ons + bundles); fidelity
  optional, constraint complexity mandatory.
- **Visual register:** consumer telco-commerce (proposed; defers to the register program).
- **Headline exercise:** the dependency-constraint configurator + NL-to-config — the reason this app exists.
- **Two lifecycles:** quote + order, both on Web Lifecycle.
- **Build order:** catalog + constraint model + pricing first (proves the graph + rules), then the stepped
  configurator, then quote/persistence, then order capture & amendments, then rep assist.

## Proposed build slices (→ functional-phase cards under #319)

S0 catalog seed + constraint model + pricing engine · S1 catalog browser (collection-ops) · S2 configurator
+ constraint feedback (the headline) · S3 NL-to-configurator entry · S4 quote save/revise/compare
(persistence) · S5 order capture & submission · S6 order management & amendments · S7 rep assist &
bounded overrides.
