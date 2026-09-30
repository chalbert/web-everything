---
kind: decision
status: open
dateOpened: "2026-09-30"
relatedTo: ["2626", "2742", "3038", "3255"]
tags: [review-ledger, product-design]
---

# Choose the review ledger product storage substrate and local development tier

Choose the unresolved backend under the accepted shared-state direction: files, local SQLite, or hosted SQL. Recommend SQLite for single-host development and SQLite-backed Durable Objects for Plateau authority, with portable exports and optional reporting projections. Design: we:docs/agent/review-state-ledger-target.md. Preserve the existing git-transport obligation until explicitly superseded.

## Decision to make

The shared-product direction is settled by we:docs/agent/platform-decisions.md#state-lives-where-its-nature-dictates; the database choice is not. Decide the backend and local tier without reopening placement (we:docs/agent/platform-decisions.md#constellation-placement).

| Option | Benefit | Cost |
| --- | --- | --- |
| A. Keep files plus git transport as the product authority | Existing tools and exports | Host coupling, awkward transactions and tenant queries |
| B. Local SQLite; hosted SQLite-backed Durable Objects; optional derived D1 reporting | Reuses existing webhook substrate, transactional event/outbox, separate tenants | Cloudflare operations and explicit cross-stream reporting |
| C. Local SQLite; hosted relational SQL service | General relational querying and deployment choice | Another service and migration beyond the existing feed |

Recommend **B**, subject to restore, tenant isolation and transaction probes. Files stay supported as legacy/import/export, not an obligatory rewrite. D1 reporting is rebuildable and cannot become a second authority. SQLite WAL must remain on one machine. The supporting vendor sources and comparisons are in we:docs/agent/review-state-ledger-target.md.

## Relationship to existing work

#2626 already accepts shared state at product. #2742 is its build; #3038 migrates the jury. #3214 already ruled git transport and #3255 is still owed: choosing a destination does not cancel that interim. Explicitly supersede the interim in a subsequent ruling only if a durable product service is delivered first. Generic store/fold implementations belong to Frontier UI; hosting, credentials and tenant operations to Plateau; WE owns definitions/conformance.

## Done when

Record the operator choice and rationale, define the acknowledged-write durability/backup promise and tested restore/export requirements, and route the build through #2742/#3038. Codify the ratified reusable rule under the named statute anchor. Do not mark the storage implementation done merely by resolving this card.
