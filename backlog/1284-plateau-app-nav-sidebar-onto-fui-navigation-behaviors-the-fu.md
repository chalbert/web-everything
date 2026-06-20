---
kind: story
size: 3
parent: "1254"
status: resolved
locus: plateau-app
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "plateau:src/main.ts"
tags: []
---

# plateau-app nav/sidebar onto FUI navigation behaviors — the FUI-block integration-seam pilot

Migrate plateau-app's hand-rolled nav/sidebar (we:plateau:index.html marked 'workaround: no NavMenu'; we:plateau:src/main.ts:521 upgrades route:link today) onto FUI's navigation block behaviors (fui:blocks/navigation/registerNavigation.ts — nav:list / nav:section / nav:menubar). This is the integration-seam PILOT: plateau already bootstraps @frontierui/plugs/bootstrap but wires zero FUI block behaviors; this proves the plugs-registry -> FUI-behavior seam end-to-end so every later surface rides a proven pattern. Demoable: sidebar renders + navigates via FUI behaviors at :4000.

## Progress

Wired the plugs-registry → FUI-behavior seam (the integration pilot):

- `plateau:src/main.ts` — `import { registerNavigation } from '@frontierui/blocks/navigation'` and
  `registerNavigation(attributes)` immediately after the bootstrap exposes `window.attributes`, before
  any `attributes.upgrade(...)`. Registers `nav:list` / `nav:section` / `nav:menubar` on the shared
  `CustomAttributeRegistry` plateau already bootstraps via `@frontierui/plugs/bootstrap`.
- `plateau:index.html` — sidebar `<nav class="sidebar-nav">` now carries `nav:list aria-label="Main"`
  (replacing the "Workaround: no NavMenu" comment). NavListBehavior discovers the flat `<a route:link>`
  items directly (`a[href], a[route\:link], button:not([nav\:section])`) — no `<ul>` restructure needed.
- `plateau:vite.config.mts` — added `@frontierui/blocks` → sibling FUI `blocks/` alias (same pattern as
  the existing `@frontierui/plugs`), so the deep import resolves to FUI source dev-time.

**Verified at :4000 (Playwright):** `nav.sidebar-nav[nav:list]` upgraded — all 19 items have a roving
tabindex (`0` on the active/first, `-1` on the rest), zero console errors (the `@frontierui/blocks`
alias resolved; Vite auto-restarted on the config-file change). The seam is proven end-to-end:
`@frontierui/plugs/bootstrap` registry → `registerNavigation` → live FUI behavior on the sidebar.
`nav:section`/`nav:menubar` are registered and available for later surfaces; the sidebar is a vertical
list so it rides `nav:list`. Fixed `locus` (was `webeverything`) → `plateau-app` (all edits + the :4000
verify live there).
