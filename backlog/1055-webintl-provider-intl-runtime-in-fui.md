---
type: idea
workItem: story
size: 5
parent: "1020"
status: resolved
blockedBy: ["1054"]
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "we:intl/provider.ts"
tags: []
---

# webintl provider — Intl.* runtime in FUI

Slice B of webintl impl epic #1020 (blockedBy slice A contract). Implement the Intl.* provider runtime in FUI (native Intl.Collator/DateTimeFormat/NumberFormat/RelativeTimeFormat behind the WE contract, swappable). Default provider is the platform Intl (native-first).

## Progress

Shipped the Intl-formatting runtime half as the interim-replicated impl alongside the #1054 contract
(`we:intl/`), mirroring the landed `reliability/` provider precedent (#1052) — runtime stays impl
(`locus: frontierui`, future `@frontierui` package), the contract stays type-only in `@webeverything`:

- `we:intl/provider.ts` — `NativeIntlProvider` (+ `nativeIntlProvider` singleton): the native-first
  default that delegates each method verbatim to the platform `Intl.*` constructor (factory-not-value:
  a fresh formatter per `(locales, options)` call; never re-implements formatting). Re-exports the
  contract surface so importers reach types + runtime from one site (file-seam split, like
  `we:analytics/provider.ts`).
- `we:intl/registry.ts` — `CustomIntlProviderRegistry` (`localName: customIntl`): the swap point.
  Unlike the multi-handler `customRecovery` chain this is a **single active provider** slot
  (`set`/`current`/`reset`) — the whole subtree formats through one provider at a time, never a blend;
  most-recent-`set` wins (nearest-scope-wins is the injector chain's job across scopes). Seeded with the
  native-first default so formatting works with zero config.
- `we:intl/index.ts` — `createDefaultRegistry()` default wiring (seeded native-first, unlike the empty
  reliability default).
- `we:intl/__tests__/registry.test.ts` — 12 vitest cases (native delegation equals native output, fresh
  formatter per call, swap routes all four formatters, single-active-provider, reset). Added the
  `intl/**/__tests__` glob to `we:vitest.config.ts`.

`PluralRules`/`ListFormat`/`DisplayNames` stay platform defaults (out of the four-formatter swap scope,
per #1054). Conformance demo is slice #1056.
