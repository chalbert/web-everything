---
kind: decision
parent: "1684"
status: open
dateOpened: "2026-06-23"
dateStarted: "2026-06-23"
preparedDate: "2026-06-23"
locus: webeverything
tags: [webrouting, routing, technical-config, configurator, constellation-placement]
relatedReport: reports/2026-06-23-webrouting-technical-config-home.md
---

# webrouting technical-config home — schema in webrouting vs a plateau Configurator domain

Home the technical routing knobs the Navigation Intent punts as non-UX — base path, history mode, lazy/code-split, prerender, scroll policy, 404 fallback. **Recommended: (c) WE owns a route-config *schema* as the source-of-truth; a plateau Configurator *domain* is optional downstream tooling over it** (med-high). The standing test collapses "schema vs Configurator" to support-both — contract → WE, developer-operated decision tool → plateau — so the two coexist and are not a decision. The one genuine fork is *which knobs* the unified schema adds, since the `router` block already owns most of the route-config vocabulary as scattered attributes. Grounded in [/research/webrouting-technical-config-home](/research/webrouting-technical-config-home/).

## Axis framing

Three things travel under "technical-config home", and only **one** is a genuine fork:

- **Contract home — schema vs Configurator** (support-both, not a fork). Per [constellation-placement](/backlog/) (code that *defines a contract* → WE; a *developer-operated tool against your own build* → plateau, the devtools-placement consumer test) and [config-extends-platform-default](/backlog/), the SCHEMA is the contract source-of-truth in WE and a Configurator DOMAIN is downstream tooling over it. They compose; "schema vs Configurator" is not an either/or. → **Supported by default.**
- **Which knobs the schema adds** (the genuine fork). WE already owns route-config vocabulary scattered as block attributes — the `router` block declares `base`, `scroll`, `transition`, `keep-alive`, `lazy` on `<we-route-view>` / child `<template>` (`we:src/_data/blocks/router.json`). So the schema is not greenfield: the choice is *which net-new knobs it adds* and *which already-owned attributes it unifies*. → **Fork 1.**
- **Whether the plateau Configurator domain is built at all** (settled by the converse-guard, not a fork). The [intents-UX-only converse-guard](/backlog/) (#499) gates it: a domain that merely re-homes the schema's enums is redundant cross-layer duplication. So it's a separately-prioritized build-when-it-earns-its-keep concern, one card per documented technical setting. → **Supported by default (build deferred).**

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
| --- | --- | --- | --- |
| Fork 1 — which knobs the unified schema adds | **net-new serializable knobs (history mode, prerender, 404 fallback) + unify the already-owned attributes (base, scroll, lazy) into a named vocabulary** | (a) adopt every router knob seen in prior art, incl. code-shaped ones | Med-high (~75%) |

## Fork 1 — which knobs does the unified route-config schema declare?

**Fork-existence:** a real choice because WE is *not greenfield* — the `router` block already declares `base`, `scroll`, `transition`, `keep-alive`, `lazy` (`we:src/_data/blocks/router.json`), so the schema cannot just "add all routing knobs": it must pick what is genuinely net-new declarable config vs what is already an authored block attribute or a code-shaped concern. Over-including (a code-shaped `scrollBehavior` function, a per-route `import()`) drags non-serializable, author-in-the-markup concerns into a config schema that exists to be *read without a running app*.

**Crux (real-tree refs):** the Navigation Intent owns the UX axes and its `history` is the UX *contribution* (push/replace/none), **not** the technical *history mode* (browser/hash/memory) (`we:src/_data/intents/navigation.json`). The router block already owns `base` (base path), `scroll` (restoration mode), `keep-alive`, and `lazy` as attributes (`we:src/_data/blocks/router.json`). The net-new *declarable, serializable* knobs neither the intent nor the block names are **history mode**, **prerender**, and **404 fallback**. Prior art (see research topic) confirms the cut: base / prerender / trailing-slash / 404-fallback are declared CONFIG in Next & SvelteKit; history-mode / scroll / lazy lean CODE (constructor args, render fns, per-route imports).

**Options:**

- **(a) Adopt every router knob seen in prior art** — including the code-shaped ones (a `scrollBehavior` function, per-route `import()` lazy). Most "complete", but pulls non-serializable, markup/code concerns into a config schema whose whole purpose is to be read without a running app, and *duplicates* the `scroll` / `lazy` the block already authors. *Rejected:* a config schema is for serializable deploy-shaped facts; a render function and an import statement are author-in-the-markup, already homed on the block — re-declaring them violates single-SoT and config-vs-code.
- **(b) Net-new serializable knobs + unify the already-owned attributes** — the schema declares the genuinely new declarable knobs (**history mode** browser/hash/memory, **prerender**, **404 fallback**), and gives the already-scattered block attributes (`base`, `scroll`, `lazy`) a single named vocabulary entry each so the config is one coherent surface, not split between the schema and per-element attributes. Follows config-extends-platform-default: one key per dimension in `webeverything.config.*`, default-less core, native-first/most-permissive defaults, each `extends` a platform flavor.

**Recommended default: (b) net-new serializable knobs + unify the already-owned attributes.** Homes exactly what is genuinely new + declarable, unifies the scattered vocabulary, and keeps the code-shaped concerns (scroll fn, lazy import) where the block/markup already owns them. The serializable schema is the form a non-DOM consumer (config tooling, a Configurator domain, prerender) reads.

**Skeptic:** SURVIVES-WITH-AMENDMENT — an adversarial pass (2026-06-23) confirmed (b) over (a). The "adopt-all is more complete" attack failed: completeness that drags a `scrollBehavior` function into a serializable config schema is a config-vs-code violation and double-counts the block's `scroll`/`lazy`. Amendment baked in: the schema *unifies* (references), it does not *re-declare*, the already-owned block attributes — single-SoT holds because the named vocabulary and the block attribute are one declaration surfaced two ways, not two authoring homes.

## Supported by default (not decisions)

These coexist under the platform rules; recording them, not deciding them, is the ruling:

- **Schema (WE) + Configurator domain (plateau) compose** — the schema is the contract SoT; a Configurator domain is downstream tooling over it (constellation-placement + devtools-placement consumer test). Not an either/or.
- **The plateau Configurator domain is a deferred, separately-prioritized build** — mechanically one seed file + one provider line (`plateau:src/technical-configurator/provider.ts`), mirroring `plateau:src/technical-configurator/seed-render-strategy.ts` / `plateau:src/technical-configurator/seed-file-upload.ts`. Gated by the #499 converse-guard: built only if it adds outcome-framing value over the schema's enums, not if it merely re-homes them. **One Configurator card per documented technical setting** on graduation.
- **Native-first / most-permissive defaults** — each knob defaults to the platform-native value (browser history, no forced prerender, scroll `auto`), restriction is the author's opt-in (config-extends-platform-default).

---

## Context

- **WE already owns the vocabulary, scattered:** the `router` block declares `base` / `scroll` / `transition` / `keep-alive` / `lazy` as `<we-route-view>` / child-`<template>` attributes + properties (`we:src/_data/blocks/router.json`). The schema unifies these into a named surface and adds the net-new declarable knobs (history mode, prerender, 404 fallback).
- **Configurator precedent:** `plateau:src/technical-configurator/seed-render-strategy.ts` (over WE's #079 Render Strategy Protocol) and `plateau:src/technical-configurator/seed-file-upload.ts` are the live "WE schema + downstream plateau domain" pattern — a domain walks a dev through *outcomes* and emits config; add one via a seed file + a `plateau:src/technical-configurator/provider.ts` entry, no UI change.
- **Converse-guard (#499):** a Configurator domain over axes the config already carries is redundant cross-layer duplication; the #499 credential-enrollment domain was dissolved for exactly this. So the routing domain is justified only by genuine outcome-framing value, and is build-when-it-earns-its-keep.
- **Foundational ordering:** reads the canonical route form [#1685](/backlog/1685-webrouting-route-format-source-of-truth-declarative-dom-temp/) settles (the serializable route-map projection is the form config tooling consumes), and is sibling to [#1686](/backlog/1686-webrouting-url-as-state-seam-one-shared-serialize-sync-provi/) and [#1688](/backlog/1688-webrouting-sitemap-derivation-scope-which-artifact-set-ships/).
- **Graduation:** on ratification this carves under [#1684](/backlog/1684-scaffold-the-webrouting-standard-route-format-profile-url-as/) via `/slice 1684` — the route-config schema (per-dimension, the unified named vocabulary + the net-new knobs) + its conformance vectors in WE; the plateau Configurator domain spun out as **one card per documented technical setting** per the #499 converse-guard, build deferred.
- **Research:** [/research/webrouting-technical-config-home](/research/webrouting-technical-config-home/) — the full knob → prior-art (config-vs-code) survey and the constellation-placement reasoning.
