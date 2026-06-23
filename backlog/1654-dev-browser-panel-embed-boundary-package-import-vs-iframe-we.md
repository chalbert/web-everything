---
kind: decision
status: resolved
locus: plateau-app
dateOpened: "2026-06-23"
dateStarted: "2026-06-23"
dateResolved: "2026-06-23"
graduatedTo: none
codifiedIn: "docs/agent/platform-decisions.md#devtools-placement"
preparedDate: "2026-06-22"
relatedReport: reports/2026-06-22-1391-split-analysis.md
crossRef: { url: /backlog/141-dev-browser-vision/, label: "#141 Fork 4-A (panel embed seam)" }
tags: [dev-browser, plateau, panel-embed, decision]
---

# Dev-browser panel-embed boundary — package import vs iframe/web-component mount for plateau-app panels (#141 Fork 4-A)

## Digest

Resolves #141 Fork 4-A — how the dev-browser **shell chrome** mounts plateau-app's Technical Configurator / Intent Configurator / Profiles **config panels** — and unblocks slicing the #1391 shell epic (the panel-embed slice currently buries this fork). **Ruling: direct package import / `mount*(el)` call** (confidence: High). The seam is narrower than the original title suggests: it is *only* the chrome-to-config-panel boundary. The "loaded app under test" surface — which the prep mistakenly folded in as a second fork — is **not in scope here**: #141 already committed the runtime form (a **Chromium desktop browser, extension-first**), so the loaded app is a real privileged browser page, not a web iframe, and its introspection boundary is **already owned by [#562](/backlog/562-dev-browser-source-awareness-ide-bridge-map-deployed-dom-bac/) + [#410](/backlog/410-dev-browser-deployed-app-live-patch-gated-capability-safety-/)** (both resolved). That correction is recorded below, not re-decided.

## Axis-framing

Per the resolved [#141 vision](/backlog/141-dev-browser-vision/), the dev-browser is a **Chromium desktop app (extension-first → full browser later)** whose chrome lights up against a standard-conformant app — the DevTools model: the inspected app is a *real top-level page*, the dev tooling is *privileged chrome docked beside it* (resizes the viewport, reaches the live runtime directly, no iframe wall). Two distinct surfaces follow, and only the first is this item's question:

1. **The shell's own config panels** (this seam). The three panels ship in the **same plateau-app repo** as plain DOM mount functions with no framework — `mountTechnicalConfigurator(root: HTMLElement)` (`plateau:src/technical-configurator/configurator.ts:639`), `mountIntentConfigurator(root)` (`plateau:src/intent-configurator/configurator.ts`), `mountProfiles(el)` (`plateau:src/profiles/profiles-page.ts`) — one Vite bundle (`plateau:package.json` declares no react/vue), already called same-bundle from the SPA at `plateau:src/main.ts:437/481/527`. The shell directory `plateau:src/dev-browser/` already exists. These panels are part of the **chrome**, in the same context/bundle as the shell — so the mount is a synchronous in-process call, never crossing the WE→FUI→plateau DAG.
2. **The loaded app under test** (NOT this seam). A real Chromium-navigated page — yours *or* an arbitrary external URL — introspected via **browser-privileged** mechanisms (extension/CDP), which is *why* #141 chose a browser over a web page. Mapping its rendered DOM back to source and acting on it is the resolved substrate of **#562** (source-awareness + IDE bridge) and **#410** (deployed live-patch). A web iframe + postMessage (the `fui-embed` bus of #788/#887) is at most a *degraded web-only fallback*, not the control path, and not a #1654 decision.

## Ruling — direct package import for the config-panel seam

**Direct package import / `mount*(el)` call.** The shell chrome imports and calls the existing mount functions in-process. The panels are trusted first-party plateau-app code in the same bundle and context as the shell (`plateau:src/technical-configurator/configurator.ts:639`, `plateau:src/main.ts:437/481/527`) — none of the drivers the iframe branch exists to serve (untrusted content, independent deploy, CSS/JS encapsulation) are present.

Decisively, **direct import is what *enables* the DevTools-style experience**: because the panels are same-context chrome, they can dock around and resize the rendered app the way DevTools docks against a page. An iframe boundary would *forbid* that control while buying isolation no one needs — the worst of both. Constellation-DAG clean: an intra-repo import inside the product layer is not a backward edge.

**Rejected — iframe / web-component boundary for the config panels.** Imposes the postMessage/marshalling/duplication tax of the #788/#887 cross-origin embeds where none of their forcing conditions (cross-origin, untrusted, runtime-authored) hold for the shell's own trusted panels.

*Skeptic:* if a panel were later extracted into its own deployable package or a second origin, direct import would have to become a boundary — but that extraction is itself the trigger that flips the origin/trust property; nothing here forecloses it.

## Correction — the "loaded third-party app" is not an iframe fork (and not this item)

The prep framed a second fork ("reuse the `fui-embed` iframe bus vs. mint a Protocol") for the loaded app's surface. That framing is **withdrawn**: it pre-supposes the dev-browser is a *web page* embedding an app via iframe, but #141 ruled it a **Chromium/extension browser** with first-level (privileged) control over real pages — exactly the DevTools model. The loaded-app boundary is therefore:

- **owned elsewhere and already resolved** — #562 (map deployed DOM → source, resolver + IDE-bridge chains) and #410 (deployed live-patch), both `blockedBy: 141`;
- **a privileged-introspection boundary, not a web iframe** — the `fui-embed` bus (#788/#887) remains only as a degraded fallback for a non-privileged web embed, with no decision owed here.

Net: #1654 decides the chrome↔config-panel seam only (direct import). No new Protocol is minted.

## Context

- **Lineage:** resolves #141 Fork 4-A, whose #141 resolution explicitly deferred the embed seam ("package vs. iframe/web-component is a build detail, deferred"). Filed as a standalone decision per the [#1391 split analysis](reports/2026-06-22-1391-split-analysis.md), which could-not-split #1391 because this fork (and the free/paid line, filed separately) was buried in its panel-embed slice.
- **Sequencing:** ratifying #1654 unblocks the #1391 `S5` panel-embed slice (`blockedBy: S1 shell scaffold + this decision`). It does not block `S1` (the shell scaffold itself), which can proceed independently.
- **Constellation:** the shell is Plateau-owned ([#1565](/backlog/1565-dev-tool-placement-across-the-constellation-devtools-belong-/)); the config-panel import is intra-repo (no DAG edge); the loaded-app boundary is a runtime privileged/cross-origin boundary owned by #562/#410 (also no backward code edge). The ruling keeps the WE→FUI→plateau DAG clean.
