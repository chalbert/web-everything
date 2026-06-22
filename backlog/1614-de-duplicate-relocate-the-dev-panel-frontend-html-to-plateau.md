---
kind: story
size: 3
status: resolved
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: "plateau:tools/dev-panel/dev-panel.html (+ .css) served by devPanel() plugin"
relatedItems: [1579, 1565]
tags: []
---

# De-duplicate + relocate the dev-panel frontend HTML to Plateau

The dev-panel has two halves; #1579 de-duplicated the **backend** Vite plugin to a single
Plateau-owned copy, but the **frontend** page — the in-browser chat UI that talks to it — is still
copy-pasted across `we:demos/dev-panel.html` and `fui:demos/dev-panel.html`, and the two have now
**drifted** (no longer byte-identical: WE ~21.9 KB vs FUI ~20.6 KB, diverging ~line 79 as of
2026-06-22). Per #1565 (devtools-placement) this operated dev surface belongs in a single Plateau
home like the plugin. Relocate to one canonical copy, reconcile the drift (decide which divergences
are intended vs accidental), and keep both dev servers' panels working.

## Scope / open questions

- **Reconcile the drift first** — diff the two copies and classify each difference as an intended
  per-repo variation or an accidental fork before collapsing to one source.
- **Consumption mechanism** — the backend plugin is consumed via a sibling-path *import* (config
  code, can't use `resolve.alias`; see #1579). The frontend is an HTML page **served** by each dev
  server, so the constraint is different: a served static asset *can* go through a Vite alias / a
  served route. Pick the form that keeps `:3000` and `:3001` both serving the panel with zero
  lock-in (mirror the single-Plateau-copy outcome #1579 landed).
- **Acceptance:** one canonical `plateau:demos/dev-panel.html` in plateau-app; WE :3000 and FUI
  :3001 both still open a working dev panel against their own build; the WE/FUI copies are deleted.

Lineage: #1565 (devtools-placement) · #1579 (backend plugin, resolved).

## Resolution (2026-06-22, batch-2026-06-22-764-1602)

- **Drift reconciled** — WE's copy was the more-evolved one (per-page transcript scope, localStorage v3,
  richer send/stop UI; CSS `28px` gutters + extra rules); FUI's was an older session-scoped variant. WE's
  is the canonical base. The only *intended* per-repo difference was a hard-coded port in one diagnostic
  log line — **neutralized** (it now says "docs server :8080 instead of the dev server", origin already
  derived from `location.origin` everywhere else), so the single copy serves every dev server unchanged.
- **Consumption mechanism** — a **served route** off the existing Plateau-owned `devPanel()` Vite plugin
  (the frontend mirror of #1579's backend de-dup): the canonical `plateau:tools/dev-panel/dev-panel.html`
  + `plateau:tools/dev-panel/dev-panel.css` are co-located with the plugin, which serves them on the public
  `/demos/dev-panel` routes (the `.html` page + its `.css`). WE (:3000) and FUI (:3001) already consume
  `devPanel()`, so both get the panel with zero new lock-in and no copy. Verified end-to-end against real
  Vite config bundling (both assets serve 200 with correct types; `import.meta.url` resolves to the plugin
  dir through Vite's bundler).
- **Deleted** `we:demos/dev-panel.html`, `we:demos/dev-panel.css`, `fui:demos/dev-panel.html`,
  `fui:demos/dev-panel.css`.
- **Operational note** — a Vite *plugin* change is config-level (not HMR'd), so a **running** :3000/:3001
  picks up the relocated panel only after a dev-server restart; until then the deleted file 404s. Left the
  user's servers running (don't-kill-dev-server).
