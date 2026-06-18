---
type: idea
workItem: story
size: 5
parent: "777"
status: resolved
blockedBy: ["881"]
dateOpened: "2026-06-17"
dateStarted: "2026-06-18"
dateResolved: "2026-06-18"
graduatedTo: src/_data/chrome.js
tags: []
---

# Migrate WE-docs site chrome to FUI components (header/nav/footer/shell)

Replace the hand-written we:base.njk header/nav (the #645 reveal-nav), footer, and page-shell with FUI component impl mounted in-document via the mode-C DI-mount SDK (#786, resolved). Gate cleared: #765 (relax) and the #786 mode-C build both resolved. Core chrome migration slice.

## Progress — built + browser-verified (2026-06-18)

#881 ratified the transport (A: `data-chrome-config` on the mount point). Built across both repos and
verified end-to-end against the live dev servers (:8080 WE + :3001 FUI).

**FUI (`../frontierui`):**
- `fui:frontierui/embed/chrome-in-document.ts` — the **generic** mode-C chrome module: reads a
  JSON-serializable `ChromeConfig` off `root.host` (a `<script type="application/json" data-chrome-config>`
  sidecar preferred — carries the deep nav tree + footer HTML without attribute entity-encoding, the #881
  survey refinement — with a `data-chrome-config` attribute fallback), rebuilds nav/footer/header-controls
  via the #870 factories (`createSectionedNav`/`createButton`), and mounts `app-shell`. Computes the
  current-page nav link client-side from `location.pathname` (so the config is static + cacheable).
  Graceful degradation to the app-shell default on absent/invalid config.
- `fui:frontierui/blocks/app-shell/AppShell.ts` — added `slotMain` so the shell renders `<slot name="main">`
  and the host's SSR page body projects in (the PE path; #881-A one-mount shape).
- Tests: `fui:frontierui/embed/__tests__/chrome-in-document.test.ts` (5 passing); `fui:vitest.config.ts`
  now includes `embed/`.

**WE (`.`):**
- `we:src/_data/chrome.js` — the WE-owned IA as `ChromeConfig` data (brand / 3-section nav / GitHub control
  / footer). WE owns content, FUI owns rendering (#765 boundary).
- `we:src/_layouts/base.njk` — wrapped the chrome in a `#we-chrome-shell` mount point (`data-embed-mode`,
  `data-embed-src` → FUI host, the config sidecar), marked `<main slot="main">`, and loads the FUI mode-C
  SDK (`setTrustedOrigins([FUI])` per the #765 WE↔FUI sanction, then `mountAllInDocument()`). The
  hand-written reveal-nav/header/footer stay the **progressive-enhancement SSR baseline** (shown
  before/without JS; hidden once the FUI shell mounts; SDK load-failure → SSR chrome remains).

**Verified (Playwright on the live site):** the FUI shell mounts (brand "Web Everything", `<nav aria-label="Main">`
with the Intents/Blocks/… sections, footer, skip-link), the page body projects via the slot, the current-page
link is marked on subpages (`/blocks/` → "Blocks" `aria-current="page"`), **0 axe violations** (WCAG A/AA — the
#770 gate engine over the mounted result), no console errors. Both loci `check:standards` green.

## Prior #870 block cleared, re-blocked on a design fork (2026-06-17, batch-2026-06-17)

The earlier re-block — must-build FUI chrome blocks (C1 app-shell, C5 sectioned-nav, C6/C7 button) — is **cleared**: **#870 is resolved** and shipped all three blocks in `frontierui/blocks/{app-shell,sectioned-nav,button}/`, each satisfying the mode-C `EmbedMountModule` contract (`mountInDocument(root)` + a `mount*(root, config)` factory).

But working it this batch surfaced a **buried design fork one layer below**: the mode-C SDK (`fui:frontierui/embed/in-document.ts`) calls `mountInDocument(root: ShadowRoot)` with **only the shadow root** — there is no channel for WE to pass its nav tree / brand / footer (WE-owned content) to the FUI-rendered chrome. WE owns the site IA, FUI owns the components, and the boundary forbids baking WE's IA into a FUI module — so **how** the host config crosses the WE↔FUI mode-C boundary is an undecided, reusable cross-repo convention. #870 explicitly left that transport to this card; #778 is silent on it; no precedent exists (the one mode-C demo is self-contained).

Filed the fork as **#881** (decide the WE→FUI mode-C host-config transport; parent #777) and set this item `blockedBy: ["881"]`. Released to `open`; cascade-frees once #881 ratifies the transport (bold default: WE writes `data-chrome-config` JSON on the mount point, a generic FUI module reads `root.host` and renders via #870's `mount*` factories). Then this card builds: generic FUI chrome mount module(s) + we:base.njk mount points with a progressive-enhancement SSR fallback.
