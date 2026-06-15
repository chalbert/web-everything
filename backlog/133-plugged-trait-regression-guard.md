---
type: idea
workItem: task
status: resolved
dateOpened: "2026-06-06"
dateStarted: "2026-06-07"
dateResolved: "2026-06-07"
graduatedTo: frontierui/plugs/__tests__/e2e/plugged-traits.spec.ts
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

## Progress
- **Status:** resolved — the standing guard exists and is green; it re-homed the whole e2e suite too.
- **Branch:** frontierui working tree (webeverything on docs/standard-authoring-workflow).
- **Done (all in `/Users/nicolasgilbert/workspace/frontierui`):**
  - `demos/lazy-traits-plugged.html` + `demos/lazy-traits-plugged.ts` — a plugged demo whose
    `<ul sortable>` is upgraded through the **global `window.attributes`** that bootstrap creates and
    onto which it ran `registerTraits(window.attributes, traitManifest)`. Deliberately uses no own
    registry (contrast `demos/lazy-traits.ts`), so it exercises the real app-wide lazy path.
  - `plugs/__tests__/e2e/plugged-traits.spec.ts` — asserts `data-sortable-ready` /
    `data-sort-direction` appear and the list sorts. An empty/disconnected manifest fails it.
  - `playwright.config.ts` — there was **none** in frontierui (e2e specs were carried in by the
    consolidate commit but never runnable). Added it (vite :3001, reuses the running dev server),
    which re-homes the whole suite.
- **Verified:** `npx playwright test plugged-traits` green; full `playwright test` = **140 passed**;
  `npm run check:standards` (frontierui) green.
- **Notes / gotcha:** Vite `bootstrapPatches()` skips injecting bootstrap into any demo HTML that
  already contains the literal string `/plugs/bootstrap.ts` — so don't write that exact path in a
  plugged demo's prose/comments (it silently disables the trait path). Documented inline in the demo.

**Graduated to** `frontierui/plugs/__tests__/e2e/plugged-traits.spec.ts` — + demos/lazy-traits-plugged.* + playwright.config.ts — standing app-wide lazy-trait regression guard.
