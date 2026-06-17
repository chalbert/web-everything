---
type: idea
workItem: story
size: 5
parent: "777"
status: open
blockedBy: ["881"]
dateOpened: "2026-06-17"
tags: []
---

# Migrate WE-docs site chrome to FUI components (header/nav/footer/shell)

Replace the hand-written base.njk header/nav (the #645 reveal-nav), footer, and page-shell with FUI component impl mounted in-document via the mode-C DI-mount SDK (#786, resolved). Gate cleared: #765 (relax) and the #786 mode-C build both resolved. Core chrome migration slice.

## Prior #870 block cleared, re-blocked on a design fork (2026-06-17, batch-2026-06-17)

The earlier re-block — must-build FUI chrome blocks (C1 app-shell, C5 sectioned-nav, C6/C7 button) — is **cleared**: **#870 is resolved** and shipped all three blocks in `frontierui/blocks/{app-shell,sectioned-nav,button}/`, each satisfying the mode-C `EmbedMountModule` contract (`mountInDocument(root)` + a `mount*(root, config)` factory).

But working it this batch surfaced a **buried design fork one layer below**: the mode-C SDK (`frontierui/embed/in-document.ts`) calls `mountInDocument(root: ShadowRoot)` with **only the shadow root** — there is no channel for WE to pass its nav tree / brand / footer (WE-owned content) to the FUI-rendered chrome. WE owns the site IA, FUI owns the components, and the boundary forbids baking WE's IA into a FUI module — so **how** the host config crosses the WE↔FUI mode-C boundary is an undecided, reusable cross-repo convention. #870 explicitly left that transport to this card; #778 is silent on it; no precedent exists (the one mode-C demo is self-contained).

Filed the fork as **#881** (decide the WE→FUI mode-C host-config transport; parent #777) and set this item `blockedBy: ["881"]`. Released to `open`; cascade-frees once #881 ratifies the transport (bold default: WE writes `data-chrome-config` JSON on the mount point, a generic FUI module reads `root.host` and renders via #870's `mount*` factories). Then this card builds: generic FUI chrome mount module(s) + base.njk mount points with a progressive-enhancement SSR fallback.
