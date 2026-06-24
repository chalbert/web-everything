---
kind: decision
parent: "1684"
status: resolved
dateOpened: "2026-06-23"
dateStarted: "2026-06-24"
dateResolved: "2026-06-24"
graduatedTo: 1684
codifiedIn: "docs/agent/platform-decisions.md#configurability-partition"
preparedDate: "2026-06-23"
locus: webeverything
tags: [webrouting, routing, technical-config, configurator, constellation-placement]
relatedReport: reports/2026-06-23-webrouting-technical-config-home.md
---

# webrouting technical-config home — schema in webrouting vs a plateau Configurator domain

Home the technical routing settings the Navigation Intent punts as non-UX — base path, history mode, prerender, scroll/404 policy, redirects, locale-prefix routing, and more. **Recommended: (c) WE owns a route-config *schema* as the source-of-truth; a plateau Configurator *domain* is optional downstream tooling over it** (med-high). The standing test collapses "schema vs Configurator" to support-both — contract → WE, developer-operated decision tool → plateau. Per the project principle **allow everything that has merit and is used in real apps**, "which settings" is *not* an exclusion fork either: every routing setting real apps use is supported — the lone judgment is *placement by serializability* (serializable deploy-shaped setting → the config schema; author-in-markup code form → the `router` block, not dropped). Grounded in [/research/webrouting-technical-config-home](/research/webrouting-technical-config-home/).

## Axis framing

Three things travel under "technical-config home"; under the project's standing tests **none** remains a genuine either/or fork — each resolves to support-both or a derivable placement ruling:

- **Contract home — schema vs Configurator** (support-both, not a fork). Per [constellation-placement](/backlog/) (code that *defines a contract* → WE; a *developer-operated tool against your own build* → plateau, the devtools-placement consumer test) and [config-extends-platform-default](/backlog/), the SCHEMA is the contract source-of-truth in WE and a Configurator DOMAIN is downstream tooling over it. They compose; "schema vs Configurator" is not an either/or. → **Supported by default.**
- **Which settings the schema declares** (a placement ruling, not an exclusion fork). WE already owns route-config vocabulary scattered as block attributes — the `router` block declares `base`, `scroll`, `transition`, `keep-alive`, `lazy` on `<we-route-view>` / child `<template>` (`we:src/_data/blocks/router.json`). Per **allow-everything-with-merit**, every routing setting real apps use is supported; the only judgment is *placement by serializability* (serializable → the config schema, code form → the block, both supported). → **See the ruling below.**
- **Whether the plateau Configurator domain is built at all** (settled by the converse-guard, not a fork). The [intents-UX-only converse-guard](/backlog/) (#499) gates it: a domain that merely re-homes the schema's enums is redundant cross-layer duplication. So it's a separately-prioritized build-when-it-earns-its-keep concern, one card per documented technical setting. → **Supported by default (build deferred).**

## The ruling — support every setting with merit, place by serializability

**Ratified 2026-06-23** (support-both for schema+Configurator; Fork-1 reframed by the *allow-everything-with-merit* principle into a placement ruling, not an exclusion). Carves under #1684 via `/slice 1684`.

Per the project principle **allow everything that has merit and is used in real apps**, the old "which settings" question is **not an exclusion fork**. (a) "adopt every router setting" was right to be inclusive and wrong only in pushing *code-shaped* forms into a *serializable* schema; (b) was right that the schema is serializable-only but **under-inclusive** — it seeded just history-mode/prerender/404 and silently dropped trailing-slash and the un-surveyed settings (redirects/aliases, locale-prefix routing, case-sensitive matching), all of which have merit and real-app use. The synthesis honors both: **support every routing setting real apps use; place each by serializability** — a derivable test, not a cut.

| Home | Test | Settings |
| --- | --- | --- |
| **Config schema (WE)** | serializable, deploy-shaped, read without a running app | base path · history mode (browser/hash/memory) · prerender · 404 fallback · trailing-slash · redirects/aliases · locale-prefix routing · case-sensitive matching — **plus** a named-vocabulary entry unifying the block's already-owned `base` / `scroll`-enum / `lazy` |
| **Block / markup** | author-in-code form | `scrollBehavior` function · per-route `import()` lazy — homed where they are authored, **not dropped** |

A setting with *both* a serializable and a code form (scroll: enum + fn; lazy: flag + import) is supported in **both** homes — the merit principle forbids dropping either. Settings enter the schema as **WE's own capability vocabulary** (a capability, not a framework's idiosyncratic shape — impl-is-not-a-standard), per config-extends-platform-default (one key per dimension in `webeverything.config.*`, default-less core, native-first/most-permissive defaults, each `extends` a platform flavor). The enumerated set is **open by design** — new serializable settings are added as real apps surface them, not frozen here.

**Scope tag (app-global vs per-route).** Each serializable setting also carries a *scope*: an **app-global** deploy-shaped setting (base path, history mode, trailing-slash, prerender, 404 fallback, redirects/aliases, locale-prefix strategy, case-sensitivity) is a field in `webeverything.config.*`; a **per-route** setting (this route is lazy, that route's scroll policy) is a field on the route entry in the #1685 route-map / `<we-route-view>` declaration, not the global file. One schema governs both shapes; the scope decides which surface the field lands on (the config file is the schema's *app-global projection*, not the whole schema).

**Crux (real-tree refs):** the Navigation Intent owns the UX axes and its `history` is the UX *contribution* (push/replace/none), **not** the technical *history mode* (browser/hash/memory) (`we:src/_data/intents/navigation.json`); its `persistence` (url/session/memory, #1686) is **not** the router transport either. The router block already owns `base`, `scroll` (enum), `keep-alive`, `lazy` as attributes (`we:src/_data/blocks/router.json`) — the schema unifies those (references, single-SoT) and adds the serializable settings neither names.

**Two placement boundaries to keep clean:**

- **locale-prefix routing ⊂ route-config**, but the broader translation/i18n system is a separate concern — the schema owns the *routing* setting (the URL prefix strategy), not the message catalog.
- **history mode (browser/hash/memory) ≠ URL-persistence (#1686)** (url/session/memory) — both spend a "memory" token, so the schema's history-mode entry carries the one-line disambiguation (router transport vs per-navigation persistence axis).

**Skeptic:** the prior pass (2026-06-23) defended the *narrow* (b) and is superseded by the merit principle — its config-vs-code insight survives as the **placement** test, but its *exclusion* of trailing-slash and the un-surveyed settings is overturned (they have merit and real-app use → supported). Re-attack target: does "support all serializable" admit a framework-idiosyncratic setting with no platform merit? Guard: each setting enters as a WE capability vetted by merit + real-app use and normalized to WE's vocabulary, not by copying a framework's surface — so idiosyncratic impl shapes are normalized or excluded at authoring, never blanket-admitted.

## Supported by default (not decisions)

These coexist under the platform rules; recording them, not deciding them, is the ruling:

- **Schema (WE) + Configurator domain (plateau) compose** — the schema is the contract SoT; a Configurator domain is downstream tooling over it (constellation-placement + devtools-placement consumer test). Not an either/or.
- **The plateau Configurator domain is a deferred, separately-prioritized build** — mechanically one seed file + one provider line (`plateau:src/technical-configurator/provider.ts`), mirroring `plateau:src/technical-configurator/seed-render-strategy.ts` / `plateau:src/technical-configurator/seed-file-upload.ts`. Gated by the #499 converse-guard: built only if it adds outcome-framing value over the schema's enums, not if it merely re-homes them. **One Configurator card per documented technical setting** on graduation.
- **Native-first / most-permissive defaults** — each setting defaults to the platform-native value (browser history, no forced prerender, scroll `auto`), restriction is the author's opt-in (config-extends-platform-default).

---

## Context

- **WE already owns the vocabulary, scattered:** the `router` block declares `base` / `scroll` / `transition` / `keep-alive` / `lazy` as `<we-route-view>` / child-`<template>` attributes + properties (`we:src/_data/blocks/router.json`). The schema unifies these into a named surface and adds the net-new declarable settings (history mode, prerender, 404 fallback).
- **Configurator precedent:** `plateau:src/technical-configurator/seed-render-strategy.ts` (over WE's #079 Render Strategy Protocol) and `plateau:src/technical-configurator/seed-file-upload.ts` are the live "WE schema + downstream plateau domain" pattern — a domain walks a dev through *outcomes* and emits config; add one via a seed file + a `plateau:src/technical-configurator/provider.ts` entry, no UI change.
- **Converse-guard (#499):** a Configurator domain over axes the config already carries is redundant cross-layer duplication; the #499 credential-enrollment domain was dissolved for exactly this. So the routing domain is justified only by genuine outcome-framing value, and is build-when-it-earns-its-keep.
- **Foundational ordering:** reads the canonical route form [#1685](/backlog/1685-webrouting-route-format-source-of-truth-declarative-dom-temp/) settles (the serializable route-map projection is the form config tooling consumes), and is sibling to [#1686](/backlog/1686-webrouting-url-as-state-seam-one-shared-serialize-sync-provi/) and [#1688](/backlog/1688-webrouting-sitemap-derivation-scope-which-artifact-set-ships/).
- **Graduation:** on ratification this carves under [#1684](/backlog/1684-scaffold-the-webrouting-standard-route-format-profile-url-as/) via `/slice 1684` — the route-config schema (per-dimension, the unified named vocabulary + the net-new settings) + its conformance vectors in WE; the plateau Configurator domain spun out as **one card per documented technical setting** per the #499 converse-guard, build deferred.
- **Research:** [/research/webrouting-technical-config-home](/research/webrouting-technical-config-home/) — the full setting → prior-art (config-vs-code) survey and the constellation-placement reasoning.
