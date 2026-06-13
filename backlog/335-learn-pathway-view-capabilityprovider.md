---
type: idea
workItem: story
size: 3
status: resolved
locus: plateau-app
dateOpened: "2026-06-11"
dateStarted: "2026-06-13"
dateResolved: "2026-06-13"
tags: [development-guide, learn-pathway, capability-provider, configurator, docs, diataxis]
---

# Build the learn-pathway view + wire the shared CapabilityProvider content model (interim configurator-native render)

Build the development-guide learn-pathway view as a read-only second view over the configurator's existing `Domain` / `CapabilityProvider` content model (`domain → axes → options → rationale → recommendation`), with a free-browse floor plus a thin curated prev/next path layer. Authoring once and reading twice makes drift structurally impossible. The interim render is configurator-native; migrating onto `webdocs` is the follow-on (#336). Ratified in #109 (Forks 1, 2 & 4): one guide surface with two registers, the `Domain` type as the single source, and a wander-anywhere default with curation added as a layer, not a gate.


## Progress

Delivered (2026-06-13) — ratified #109 (Forks 1, 2, 4):
- New [src/development-guide/learn-pathway.ts](../../plateau-app/src/development-guide/learn-pathway.ts) + `.css` — a **read-only second view** over the Technical Configurator's `seedProvider` (`CapabilityProvider`), the single source. Renders `domain → axes (concepts/options with definitions) → strategies (rationale: tradeoffs + support/maturity)`. Free-browse floor (topic switcher → any domain) + a thin **curated prev/next path** layer (`CURATED_PATH`, non-gating — off-path domains still reachable). localStorage for last-read domain.
- Wired into [plateau-app/src/main.ts](../../plateau-app/src/main.ts) (import, `/learn` route case, `tryMountLearnPathway` robust-timing mount mirroring the 3 existing mounts, breadcrumb label, initial mount) and [index.html](../../plateau-app/index.html) (nav entry + `/learn` route template + `#learn-pathway-mount`).
- Interim render is configurator-native; the webdocs migration is the follow-on (#336).

**Verification (honest caveat):** TypeScript type-clean (zero errors in the new files), and the module transforms cleanly through Vite (valid JS, HTTP 200). **Live render was NOT observed** — the running plateau-app dev server is in a *pre-existing broken state* unrelated to this change: `Failed to resolve import "virtual:trait-manifest" from webeverything/plugs/bootstrap.ts` returns 500, which crashes the whole app (every route, incl. the root dashboard), so no route mounts. This is the stale-dev-server trait-manifest footgun. The formal `npm test` gate also can't run (vitest not installed in plateau-app). **To confirm:** restart the plateau-app dev server (clears the `virtual:trait-manifest` 500) and load `/learn`.
