---
kind: story
size: 3
status: resolved
dateOpened: "2026-06-28"
dateStarted: "2026-06-28"
dateResolved: "2026-06-28"
graduatedTo: "intent:document-title"
tags: []
---

# Author the document-title standard (browser/page title intent + layered title registry, routing-driven)

A Document Title intent + `CustomTitleRegistry` / `CustomTitleContributor` plugs for the browser/page title (`document.title` / the `<title>` element). The title is treated as a **composed, layered** value (`base → template → decoration → transient`) written once by a single owner, so the route base title, the site template, the Notification Marker count prefix, and transient overrides **compose instead of clobbering** one another. The base is **routing-driven**: the `router` block gains `route:title`, registering a `base`-layer contribution resolved on `route-change`, with a WCAG 2.4.2 announce-on-SPA-nav contract.

## Resolved 2026-06-28

Authored the standard across three layers (the website files are the spec):

- **Intent** — [`document-title`](../src/_data/intents/document-title.json). Dimensions: `source` (`static` / `route` / `dynamic`), `template` (`template` / `absolute` / `default`, mirroring the Next.js metadata title model), `announce` (`live` / `off`, WCAG 2.4.2 on client-side nav). UX-contract only; the layering mechanism is named but lives in the plugs.
- **Plug (registry)** — [`customtitleregistry`](../src/_data/plugs/customtitleregistry.json) (`window.customTitleContributors`): the single owner of the `document.title` write; folds ordered layers into one string, keeps `<title>` in sync, announces base changes via a live region.
- **Plug (contract)** — [`customtitlecontributor`](../src/_data/plugs/customtitlecontributor.json): the one interface every title source implements (`layer`, `priority`, `contribute(current)`); `null` = abstain.
- **Routing wire-up** — [`router`](../src/_data/blocks/router.json) block gains the `route:title` template attribute + `documentTitle` design decision + `consumesIntent: document-title`. The router never writes `document.title` directly — it registers a `base` contribution and refreshes on `route-change`.
- **Composition** — [`notification-marker`](../src/_data/intents/notification-marker.json) updated so its `title` surface is explicitly a `decoration` contributor (no longer a competing writer).
- **Semantics** — `Document Title Intent`, `title contributor`, `title layer`.

**Forks settled inline** (the website files are the plan of record): title-only scope now (head/metadata composes later) · `route:title` on the router (not a separate behavior) · notification-marker refactored to a decoration · layered-contributor registry (not last-writer-wins) · `webrouting` ownership.

**Status note** — intent is `draft`, both plugs `concept` (spec-only contracts; the runtime impl lands in Frontier UI). `npm run check:standards` green (0 errors).
