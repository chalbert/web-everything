---
kind: decision
parent: "1994"
status: open
dateOpened: "2026-07-01"
tags: []
---

# Parity-wiring seam: how customTemplateTypes activation reaches parity with the attributes upgrade path

Fork extracted from #1994 (chunk 4 of the Custom Type Registry family, #1990) on 2026-07-01. Blocks the
for-each activation-wiring slice #2012; #2012 → for-each migration #2013. See
`we:reports/2026-07-01-backlog-split-analysis.md`.

## The question

Migrated for-each *is* a typed `<template>` registered on `CustomTemplateTypeRegistry` — but
**`CustomTemplateTypeRegistry` is instantiated and driven NOWHERE in the app today** (only in its unit
test). Dropping for-each's `CustomAttribute` define without wiring `customTemplateTypes` activation
silently breaks live for-each, and it is **gate-invisible**: unit/integration suites drive their own
local `registry.upgrade(root)` and stay green, so `check:standards` would NOT catch the live break. How
should `customTemplateTypes.upgrade` reach parity with the `CustomAttribute` upgrade path, which spans
**two boot models**?

- **Unplugged** (`fui:plugs/bootstrapUnplugged.ts`) — a unified `register(plug)` + `upgrade(document)`
  cascade (`fui:plugs/unplugged.ts:126-142`); `attributes` is a registered `Plug` (`fui:plugs/unplugged.ts:217`).
  `CustomTemplateTypeRegistry` is already `Plug`-shaped (`localName` + `upgrade` + `downgrade`), so here
  it is a clean one-line `register(customTemplateTypes)`.
- **Plugged** (`fui:plugs/bootstrap.ts`) — patches globals, **no central upgrade**; each consumer +
  insertion cascade drives `window.attributes.upgrade(root)` itself: demos, the loan/insurance apps
  (`fui:demos/loan-origination/app.ts:661`, `fui:demos/auto-insurance/app.ts:740`), the nav blocks
  (`SectionedNav`/`DisclosureNav`), and — load-bearing — the dynamic-insertion cascades that make
  for-each work inside inserted HTML (`fui:plugs/webexpressions/ExplicitHTMLInsertion.patch.ts:89,103,130`,
  `fui:plugs/webinjectors/InjectorRoot.ts:289,332`). For migrated for-each to keep working,
  `window.customTemplateTypes.upgrade(root)` must run in parity at **every** one of those ~15 sites.

## Candidate resolutions

- **(a)** Ride the unplugged Plug-cascade + add per-site `customTemplateTypes.upgrade` across the ~15
  plugged sites. Most explicit; largest surface (may hold the wiring slice at size·5).
- **(b)** Introduce a shared "upgrade the value-space registries alongside `attributes`" seam so one call
  drives both — fewer sites, new abstraction.
- **(c)** Have `CustomAttributeRegistry.upgrade` also drive the sibling template-type registry — couples
  the two families, in tension with the #1986 rule-1 split that deliberately separated behavior vs
  directive registries.

This is real architecture, not a mechanical rename — do not force. `/prepare` before deciding.
