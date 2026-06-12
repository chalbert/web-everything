---
type: idea
workItem: story
size: 3
parent: "089"
status: open
dateOpened: "2026-06-06"
tags: [monetization, business-model, consultancy, services, migration, adoption, accessibility, training, open-source]
crossRef: { url: /backlog/089-monetization-product-ideas/, label: "Product ideas (#089)" }
---

# Consultancy & services revenue — the human-delivered side of the standard

> **Reclassified `decision` → `idea` (2026-06-11).** This item carries **no open fork** — it enumerates a service catalog (six engagement types) under the open-source flywheel, as a strategy/reference companion to the products in #089. There is nothing to ratify here; it's reference material that informs go-to-market work, not a decision. Kept `status: open` so it stays visible as the consultancy reference.

The services revenue stream for the Web Everything ecosystem: **human-delivered
engagements** (vs. the licensed *products* in [#089](/backlog/089-monetization-product-ideas/)).
This is the classic open-source flywheel — the open standard drives adoption,
adoption surfaces enterprises that need help, and the products and consultancy
feed each other (a product flags a gap → a services engagement fixes it; an
engagement reveals a repeatable need → it gets productized). Captured separately
because the original product-ideas brief excluded it, but it is likely the
**largest near-term revenue** while the products mature.

## Boundary with the products (#089)

The line is **tool vs. labour**: shipping an open tool or a licensed hosted
service is a *product*; applying expertise to a specific client's codebase is
*consultancy*. The two are deliberately paired — e.g. the **migration tooling**
(idea 3 in #089) is the productized front-end; **performing the migration for a
client** is the engagement below. Same for verification: the hosted check is the
product, **remediating the failures it reports** is the engagement.

## The engagements

### 1. Framework migration & interop engagements — *highest willingness-to-pay*
Productized in #089 as tooling; as a service it's the high-value work enterprises
already pay dearly for: **migrating a component library/app off or onto a
framework** (React ⇄ Web Components ⇄ functional ⇄ …), powered by the open
adapters. The tool does the mechanical conversion; the engagement owns the risky
parts — edge cases, reactivity/render-strategy decisions, validation, rollout.
- **Pitch:** "we *prevent* lock-in" — the cleanest story for this project's premise.

### 2. Adoption / integration engagements
Help an enterprise stand up the standard in a real app: wire providers through
the registries/injectors, set up the conformance pipeline, establish cross-team
contracts (webevents/webcontexts). Natural lead-in to the #089 verification
license.

### 3. Conformance & a11y remediation
When the continuous-verification product (#089 idea 1) flags interop or
WCAG / EN 301 549 gaps, the **remediation** is billable services — paired with a
recurring product subscription and an existing regulatory budget.

### 4. Custom standard authoring
Author client-specific intents, protocols, adapters, or providers that don't
belong in the open standard — using the canonical `/new-standard` method. Output
can be private to the client or contributed back.

### 5. Training & enablement
Workshops and certification of *developers* (distinct from certifying libs):
teach teams the protocols, the registry/injector model, and the authoring
method. Recurring, scales with org size.

### 6. Support / SLA retainers
Priority support, upgrade-path guarantees, and architecture review retainers for
enterprises betting an app on the standard.

## Flywheel note

Keep the standard, suite, and tooling fully open — that is what generates the
adoption that creates demand for all of the above. Consultancy is funded *by* the
openness, not in tension with it.
