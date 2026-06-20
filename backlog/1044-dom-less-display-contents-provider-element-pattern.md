---
kind: story
size: 3
status: resolved
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "we:demos/dom-less-di-host-demo.ts"
tags: []
---

# dom-less display:contents provider-element pattern

Surfaced by the #1037 deep-reports sweep (audit §13): a provider/host element that renders display:contents so it participates in the injector/provider tree without affecting layout — a dom-less wrapper for DI scoping. Distinct from the scoped-registration items (#854 et al.), which are about registries not the layout-neutral host. Confirm the pattern + a demo; relates to webinjectors provider scoping.

## Progress

Confirmed the pattern + shipped a demo. The `display:contents` DI-host works: the element stays in the
DOM tree (so the injector chain — which walks DOM ancestors — still resolves a provider declared on it)
but contributes no layout box (so a flex/grid ancestor lays out its children as direct children).
- `we:demos/dom-less-di-host-demo.{html,ts,css}` — a `<di-scope>` custom element (ensures an injector +
  `injector.set(theme)`, sets `display:contents`). 5 conformance invariants + a visual side-by-side and a
  load-bearing control (a `display:block` wrapper breaks the same flex row). Registered in
  `we:src/_data/demos.json` (project: webinjectors).
- **Browser-verified** (Playwright, live :3000): 5/5 invariants hold, 0 console errors. Checks are
  frame-settled because the plugged webcomponents Element-insertion patch defers `connectedCallback` off
  the synchronous insertion (found + fixed during verification — a same-tick read saw the pre-upgrade box).

Relates to the `/research/dom-less-composition/` topic; distinct from the scoped-registration items
(#854) — this is the layout-neutral host, not a registry.
