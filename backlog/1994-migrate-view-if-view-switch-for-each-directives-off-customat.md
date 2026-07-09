---
kind: epic
status: resolved
blockedBy: []
dateOpened: "2026-06-30"
dateStarted: "2026-07-01"
dateResolved: "2026-07-09"
graduatedTo: none
relatedReport: reports/2026-07-01-backlog-split-analysis.md
tags: []
---

# Migrate view:if/view:switch/for-each directives off CustomAttribute onto CustomTemplateTypeRegistry

**Storied epic (split from story·13 on 2026-07-01 — see `we:reports/2026-07-01-backlog-split-analysis.md`).**
Chunk 4 of the Custom Type Registry family (#1990). Migrates the three structural directives off
`CustomAttribute` onto the minted `CustomTemplateTypeRegistry` (each directive now IS a typed `` <template> ``). Split into: the dead-on-site
view:if/view:switch migration (independent, batchable now); the parity-wiring **decision** (how
`customTemplateTypes` activation reaches parity with the `attributes` upgrade path); the wiring slice
gated on that decision; and the live for-each migration gated on the wiring. Slices carry the points.

## Original scope (now decomposed across children)

Chunk 4 of the Custom Type Registry family (#1990, chunks 1-3 delivered). Migrate the three structural directives (fui:blocks/view/ViewIfDirective.ts, fui:blocks/view/ViewSwitchDirective.ts, fui:blocks/for-each/ForEachBehavior.ts) off CustomAttribute onto the minted CustomTemplateTypeRegistry: the directive now IS the typed template (extends CustomTemplateType), authored as a typed `<template>`, registered by type VALUE not attribute name. Drop the registry-define calls for the directives in fui:blocks/view/registerViewDirectives.ts (view:show stays a behavior). NOTE the re-prototype constraint proven in chunk 2: upgrade() re-prototypes the existing node and runs NO constructor, so the directives must NOT use private instance fields with initializers (those throw on access for a re-prototyped node) — move marker/state init into connectedCallback. Blocked on #1993 (the option-attribute spelling — where the if-condition / switch-selector expression lives now that type= carries the identity) — now **resolved** (`condition` / `match` / fused `items="… as …"` + bare `key`).

## Grounding — outgrew story·3 + surfaced activation-wiring design fork (batch-2026-06-30, resized 3→13, released not resolved)

The class-migration half is clean and ready (spelling ratified by #1993; the re-prototype/no-`#private`-fields pattern is proven by chunk 2's stub). But a faithful, **non-regressing** chunk 4 is materially larger than the mechanical rename the body scopes, and it carries an unmade **design call** — so it is not serial-batchable as a story·3.

**The regression the item's own mandate creates.** The item says "drop the registry-define calls for the directives." Today `for-each` is the **only one of the three that is live** — `registerForEach(window.attributes)` (`fui:plugs/bootstrap.ts:295`, `fui:plugs/bootstrapUnplugged.ts:193`); `registerViewDirectives` (which defines `view:if`/`view:switch`) is **never called in either bootstrap**, so those two are dead-on-site today (tested only). Live for-each activates via consumer upgrade calls against the behavior registry — e.g. `fui:demos/for-each-demo.html:131` `window.attributes.upgrade(document.body)` (the demo loads the **plugged** `fui:plugs/bootstrap.ts`, auto-injected by `fui:vite.config.mts:28-30`). **`CustomTemplateTypeRegistry` is instantiated and driven NOWHERE in the app** (only in its unit test). So dropping for-each's `CustomAttribute` define **without** wiring `customTemplateTypes` activation silently breaks live for-each — and it is **gate-invisible**: the unit/integration suites can drive their own local `registry.upgrade(root)` and stay green, so `check:standards` would NOT catch the live break.

**The design fork (needs a call — do not force).** How to drive `customTemplateTypes` activation in parity with the `CustomAttribute` upgrade path (two boot models, ~15 plugged sites) is now its own decision card — see **#2010**. It blocks the wiring slice #2012, which blocks the for-each migration #2013.

## Children (split 2026-07-01)

- **#2011** (story·3) — migrate view:if + view:switch onto CustomTemplateType. Dead-on-site, no blockers → **batchable now**.
- **#2010** (decision) — parity-wiring seam (a/b/c). `/prepare` then ratify.
- **#2012** (story·5) — wire `customTemplateTypes` activation. `blockedBy #2010`.
- **#2013** (story·3) — migrate for-each onto CustomTemplateType (live). `blockedBy #2012`.
