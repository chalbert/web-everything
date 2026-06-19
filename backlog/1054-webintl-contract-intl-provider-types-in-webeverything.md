---
type: idea
workItem: story
size: 3
parent: "1020"
status: resolved
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "we:intl/contract.ts"
tags: []
---

# webintl contract — Intl provider types in @webeverything

Slice A of webintl impl epic #1020. Define the Intl.* provider contract (Collator / DateTimeFormat / NumberFormat / RelativeTimeFormat behind a swappable provider) in @webeverything per [the Project/Protocol bar](docs/agent/platform-decisions.md#project-protocol-bar). Type-only crosses the seam. Foundation slice — B and C build on it.

## Progress

Shipped `we:intl/contract.ts` — the pure-contract half (compile-erased, future
`@webeverything/contracts/intl`): `CustomIntlProvider` (swap seam over the four native formatters —
`getCollator`/`getDateTimeFormat`/`getNumberFormat`/`getRelativeTimeFormat`, each mirroring the native
`Intl.*` constructor signature + instance return type) and `IntlLocales`. Native-first: the platform
`Intl` is a conformant provider with zero adaptation — the contract adds the swap seam, never
re-implements formatting. Runtime default provider + `customIntl` registry stay impl (→ FUI, slice
#1055). Scoped to the four formatters; PluralRules/ListFormat/DisplayNames stay platform defaults.
