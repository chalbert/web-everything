---
type: idea
status: active
dateOpened: "2026-06-06"
dateStarted: "2026-06-07"
tags: [webtraits, lazy-loading, bootstrap, demo, e2e, regression, frontier-ui]
relatedReport: reports/2026-06-02-lazy-traits-loading.md
relatedProject: webtraits
crossRef: { url: /projects/webtraits/, label: Web Traits project }
---

# Add a persistent regression guard for traits-via-bootstrap (app-wide lazy path)

#116 wired Frontier UI's global `plugs/bootstrap.ts` to consume the Enforcer's
`virtual:trait-manifest`, so a `<… sortable>` anywhere in a real (plugged) app now lazy-loads
its trait through `window.attributes`. But the only persistent demo of the lazy path
(`demos/lazy-traits.html`) builds its **own** `CustomAttributeRegistry` and calls
`registerTraits(registry, traitManifest)` directly — it does *not* exercise the bootstrap path.
The bootstrap wiring was confirmed only by a throwaway Playwright check during #116, so there is
**no standing regression guard**: a future change to bootstrap ordering, the Enforcer plugin, or
the vitest alias could silently break app-wide traits and every existing test would still pass.

Add a persistent artifact that drives a trait through the real bootstrap and `window.attributes`:

- Either an **e2e test** (Playwright, alongside `plugs/__tests__/e2e/declarative-spa.spec.ts`) that
  loads a plugged demo, mounts `<ul sortable>`, and asserts `data-sortable-ready` /
  `data-sort-direction` appear — proving the Enforcer manifest reached `window.attributes` (an empty
  static manifest would fail it).
- And/or a small **plugged trait demo** page so the "traits work app-wide" outcome is visible, not
  just the standalone-registry teaching demo.

Surfaced closing out #116 (the bootstrap→manifest wiring). Low risk; lands in Frontier UI (the impl
repo), same place as the #116 change.
