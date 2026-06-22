---
kind: story
size: 3
status: open
dateOpened: "2026-06-22"
blockedBy: [1565]
relatedItems: [1579]
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
