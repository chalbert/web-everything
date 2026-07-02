---
kind: decision
status: open
dateOpened: "2026-07-02"
relatedTo: ["907"]
tags: [npm, publishing, naming, constellation, plateau]
---

# npm scope naming: one scope per audience, differentiate products by package name

Six npm orgs exist (`@frontier-ui`, `@frontierui`, `@plateauapp`, `@plateaudev`, `@plateaujs`,
`@webeverything`). Before the first Plateau/FUI publishes, ratify how scopes map to the constellation so the
naming is a cite-able rule, not an ad-hoc call per package. The pull is to reach for a *new org per product*
(app vs compliance-suite vs …); the counter-principle is that an npm **org is heavyweight** (own billing,
membership, 2FA/trusted-publisher policy) and gives no isolation a package **name** doesn't — same audience +
same publish policy → same scope, different package name.

## Settled inputs (not forks)

- **`@webeverything`** → WE standard packages; `@webeverything/contracts` is **public + provenance** ([[907]]).
- **`@frontier-ui` vs `@frontierui`** → self-collision; code imports `@frontierui/*` (no hyphen). Select
  `@frontierui`, publish nothing to `@frontier-ui` (defensive hold only).

## Fork A — how many scopes for Plateau

- **Default (bold): two scopes on an audience boundary.** `@plateaujs` = all customer-facing installable
  products (`@plateaujs/compliance-suite`, siblings); `@plateaudev` = internal/dev-only packages with a
  distinct access policy. `@plateauapp` = brand/defensive hold — the SaaS/browser app is *deployed, not
  npm-published*, so it distributes nothing.
- Alt: one scope (`@plateaujs`) for everything, `private: true` for internal — fewer surfaces, no access
  boundary.
- Reject: a scope per product line (app / compliance / …) — heavyweight, no isolation benefit.

## Fork B — private-until-go default per scope

- **Default (bold): private-until-go for impl/product scopes** (`@frontierui/*`, `@plateaujs/*` publish
  `--access restricted`, no provenance, on the paid plan); **public for the WE contract surface**
  (`@webeverything/*`). Consumer-pinning of any *private* dep is deferred to go-public to avoid distributing
  read tokens across the constellation.

_Not prepared — no `preparedDate`. Bold options are starting defaults, not ratified._
