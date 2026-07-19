---
bornAs: xjcvsh3
kind: story
size: 5
parent: "2527"
status: open
blockedBy: ["2558"]
dateOpened: "2026-07-19"
tags: [plateau-loop, console, adapter-seam, contracts, interlingua, mint]
---

# Mint @webeverything/contracts/backlog — the provider-agnostic interlingua package

Spin-off authorized by [#2558] Ruling B (ratified 2026-07-18, mint-now): the interchange-schema temporal rule
fires (N≥2 convergent public incumbents — Jira / Linear / GitHub / the WE backlog), so the shared domain schema
is minted **now**, not deferred to the first foreign adapter. This mints the **core** contract package that the
console read/write ports and every future provider adapter map into — the interlingua from #2558's definition.

## Scope
- Mint `@webeverything/contracts/backlog` — the domain-model interlingua as a versioned contract:
  `BacklogItemDTO`, `Status` (`open`/`active`/`resolved` + the transients), the kind ladder
  (program→epic→story→task), the connection edges (`parent`/`blockedBy`, lineage `graduatedTo`/`codifiedIn`,
  `bornAs`), and the read/write port shapes ([#2558] — the `/api/backlog/*` read contract + the
  `POST /api/backlog/write {id, verb, value}` write port that rides lane→PR).
- Add a **`providerExt` extension slot** so a later Jira/Linear/GitHub adapter maps INTO the core without
  forking it — the north-star (design-doc §6b) becomes "add an adapter," not "re-architect".
- Per WE-holds-zero-impl: the **contract/definitions live in WE**; the plateau console + FUI consume it.

## Acceptance
The package exists as the cite-able interlingua; the [#2558] read/write ports type against it; a later foreign
provider is a `providerExt` mapping, not a rewrite. Distinct from building a second provider (out of scope).
