---
kind: decision
size: 2
status: resolved
dateOpened: "2026-06-15"
dateStarted: "2026-06-15"
dateResolved: "2026-06-15"
graduatedTo: none
codifiedIn: "one-off"
tags: []
---

# Date/time picker scope — single-value pickers as #359 variants vs. their own blocks

Open scope fork delegated from [#468](/backlog/468-form-control-block-inventory-datepicker-timepicker-input-fam/) (resolved 2026-06-13, which handed the datepicker/timepicker scope to #359 "to settle in #359's own split"). [#359](/backlog/359-date-time-range-picker-block/) is blocked on this call — its slice shape can't be drawn until the fork is ruled, so it surfaced as *could-not-split* in the 2026-06-15 split analysis (we:reports/2026-06-15-backlog-split-analysis.md).

## The fork

**Are single-value date and time pickers variants of the #359 picker block, or their own blocks?** The answer determines #359's entire decomposition: under A the slices are `task`s configuring one block; under B they are separate `story`s (a datepicker block + a timepicker block + a range block), each with its own registry entry, demo, and fixtures.

### A — one temporal block, variants by dimension only (no named blocks)

A date picker is `point`+`media` (calendar grid), a time picker is `point`+`linear`/`media` (clock), range is `granularity: range` — `intent:temporal` already models all three as **one protocol** (`presentation: media|linear|input` × `granularity: point|range|multi`, we:src/_data/intents.json:1389-1411). One block consuming temporal, configured by `granularity`/`presentation` over the native `input[type=date|time|datetime-local]` anchor, mirrors the **slider precedent**: single + dual-thumb is one block over `input[type=range]`, not two (fui:src/_data/blocks.json:3175-3192). Native-first, one machinery (calendar grid / keyboard / i18n) shared across variants.

### B — separate datepicker / timepicker blocks

Distinct registry entries, matching #468's original inventory listing and several design-system catalogs (which ship `DatePicker` and `TimePicker` as separate components). Cost: duplicates the calendar-grid / keyboard / i18n machinery across blocks and diverges from `intent:temporal`'s single-protocol model.

### C — one abstract block + named shallow preset blocks *(synthesis — recommended)*

Keep **one abstract `temporal` block** holding the shared machinery (`intent:temporal` protocol, native-input anchoring, locale formatting, keyboard, popover), **and** ship **named shallow blocks** (`date-picker`, `time-picker`, `datetime-picker`, `date-range-picker`) as thin presets that pin `granularity`/`presentation` and bind their native anchor. The named blocks give DX/catalog discoverability and design-system parity (satisfying #468's inventory) **without** duplicating machinery — they're presets over one core, not re-implementations. This dissolves the A/B fork: A's single-machinery core + B's named, discoverable entries.

## Code-splitting finding — a single core block does *not* force unused downloads

The fork's implicit worry — "does one block make a time-only user download the calendar grid?" — is answered by the architecture: **the unit of code-splitting is the trait, not the block.** The Trait Enforcer scans templates for trait attributes and emits each used trait as its own chunk; `CustomAttributeRegistry.defineLazy` dynamic-imports them on first DOM appearance (frontierui `we:plugs/webbehaviors/traitManifest.ts`, `we:tools/trait-enforcer/vite-plugin.ts:132-193`). Precedent: droplist composes `anchor`/`filter`/`selection`/`live-status` as separate split traits — an autocomplete needing only `selection`+`filter` ships only those. So if calendar-grid, clock, and range-coordination are authored as **separate traits**, a time-only page downloads **zero** calendar bytes.

It is **usage-scanned code-splitting, not tree-shaking** — which is stronger. The Enforcer regex-scans templates for trait attributes (`collectUsedTraits`, `we:vite-plugin.ts:219-237`) and emits a manifest entry **only** for traits actually used; an unused trait produces **no chunk at all** (not "dead code shaken from a chunk" — it's never in the build). Lazy is the default (`() => import(specifier)` thunk → Vite auto-splits each into its own chunk, no `manualChunks` needed); eager traits are static-imported into main but **only if scanned as used**. Shared base (`CustomAttribute`) and shared internals are deduped by Rollup into a common chunk, counted once, not per-trait.

**Both #448 (manifest wiring) and [#484](/backlog/484-port-the-trait-enforcer-tool-into-web-everything-real-manife/) (Enforcer port → `project:webtraits`) are resolved (2026-06-13)** — WE is at full parity with FU's Enforcer; `vite.config.mts:104` ships `traitEnforcer({ traitMap: {} })` with an empty map only because no traits are authored yet. So the bundle isolation is **not gated on any open infra item** — it's gated on #359's own build doing three things: (1) author calendar-grid / clock / range-coordination as **separate `CustomAttribute` trait modules** (not one monolithic temporal behavior); (2) register each in `traitMap` (lazy by default); (3) have each named preset block **declare only the traits it binds as HTML attributes** so the scanner sees the usage. Do those and a time-only page downloads zero calendar bytes — verifiable from the build's chunk list.

**Limits to respect (else the claim degrades):** no barrel `we:index.ts` re-exporting all traits (collapses them into one graph); keep trait modules side-effect-free with no top-level `customElements.define`; a trait applied **only at runtime via JS** (never present as an attribute in any scanned template) won't enter the manifest and so won't be registered — variants toggled dynamically must be declared somewhere the scanner reaches, or marked eager/preload.

## Why C over A/B

The temporal intent was authored as a single protocol spanning all granularities, so the shared machinery must live in one place (rules out B's fully-separate blocks, which fragment calendar/keyboard/i18n and contradict the intent's shape). But there's also a **concrete platform reason** to expose named blocks that the slider precedent lacks: slider's single + dual-thumb both ride **one** `input[type=range]`, whereas temporal variants ride **three different** native anchors (`input[type=date|time|datetime-local]`). Different native element = a genuinely different block surface, not merely a config flag — exactly the "standalone datepicker/timepicker is genuinely a different block" condition A's caveat reserved. C honours both: one machinery, multiple native-anchored named presets, bundle kept honest by traits.

## Consequence for #359's split

Under C, #359 decomposes as: **one `temporal` core block** (story) + **N shallow preset blocks** `date-picker`/`time-picker`/`datetime-picker`/`date-range-picker` (tasks configuring the core) + the **variant traits** (calendar-grid, clock, range-coordination) registered in `traitMap`. Per-variant bundle isolation is a build property of authoring the variants as separate traits (the Enforcer is already live) — not blocked on any infra item; #359 should carry a slice that asserts it (a build-chunk check that a time-only fixture pulls no calendar chunk).

## Ruling (2026-06-15) — C ratified

**Option C is ratified:** one abstract `temporal` core block (owns `intent:temporal`, native-input anchoring, locale, keyboard, popover) **plus** named shallow preset blocks (`date-picker`, `time-picker`, `datetime-picker`, `date-range-picker`) that pin `granularity`/`presentation` and bind their native anchor. The bundle concern that could have justified B is fully handled by the trait layer (usage-scanned code-splitting; infra already shipped via #448 + #484), so named presets cost nothing in bundle terms — and the three distinct native anchors (`input[type=date|time|datetime-local]`) give the concrete platform reason for named blocks that the single-anchor slider precedent lacked.

**#359 re-`/split`s against C:** one `temporal` core block (story) + N named preset blocks (tasks) + variant traits (calendar-grid, clock, range-coordination) in `traitMap`, plus a build-chunk assertion slice (time-only fixture pulls no calendar chunk).

**Spawned the cross-cutting trait tree-shaking goal as epic [#715](/backlog/715-webtraits-tree-shakable-trait-composition-across-all-major-b/):** the discussion surfaced that the Enforcer's tree-shaking is Vite-only today. #715 captures making it real across all major build tools + MaaS + public docs — keystone contract [#716], baseline multi-bundler [#717], SWC/Babel deferred [#718], MaaS serving [#719], authoring construct + build assertion [#720], public FUI docs [#721], cross-bundler conformance [#722]. Plus two cross-cutting hygiene cards: all FUI content public on FUI's site [#723], all Plateau content public on Plateau's site [#724].
