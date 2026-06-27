---
name: project_frontierui_happydom_test_quirks
description: "FUI vitest uses happy-dom where instanceof is unreliable and DOM property setters don't reflect — branch on a boolean + use setAttribute"
metadata: 
  node_type: memory
  type: project
  originSessionId: 388f78ba-8b39-47e4-bd5a-e58805e18f86
---

frontierui vitest runs in `environment: 'happy-dom'` (vitest.config.ts), which has two quirks that silently break block code/tests that work in real browsers:

- **`instanceof HTMLAnchorElement` (and likely other subclasses) returns `true` for the WRONG element** — e.g. `document.createElement('button') instanceof HTMLAnchorElement` is `true`. Never branch element logic on `instanceof <SpecificHTMLElement>`; branch on a value you control (e.g. an `isLink = typeof href === 'string'` boolean).
- **DOM property setters don't reflect to attributes** — `button.type = 'button'` and `el.href = …` don't stick (getter returns the default). Use `el.setAttribute('type'|'href', …)` instead, and assert with `getAttribute(...)` in tests, not the property.

Hit while building the #870 chrome blocks (app-shell/sectioned-nav/button). Real browsers are unaffected, so the bug only shows up in the test env. See [[project_blocks_no_typecheck_gate]] for the related FUI-vs-WE block gate differences.
