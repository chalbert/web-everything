---
type: idea
workItem: task
status: resolved
dateOpened: "2026-06-06"
dateStarted: "2026-06-06"
dateResolved: "2026-06-06"
graduatedTo: frontierui/plugs/bootstrap.ts
tags: [webtraits, lazy-loading, bootstrap, enforcer, integration]
relatedReport: reports/2026-06-02-lazy-traits-loading.md
relatedProject: webtraits
crossRef: { url: /projects/webtraits/, label: Web Traits project }
---

# Wire global bootstrap to the Enforcer's `virtual:trait-manifest`

The Web Traits lazy path is built and proven end-to-end (Map + `defineLazy` + Enforcer; see the
`fui:/demos/lazy-traits.html` demo in Frontier UI), but only the **self-contained demo** consumes the
Enforcer-generated manifest — it builds its own `CustomAttributeRegistry`, calls
`registerTraits(registry, traitManifest)`, then `upgrade()`. The **global** `we:plugs/bootstrap.ts`
still calls `registerTraits(window.attributes)` with the *static* (empty) manifest, so a
`<… sortable>` anywhere in a real app does **not** lazy-load yet.

Wire bootstrap to consume the Enforcer's manifest so traits work app-wide:
`import { traitManifest } from 'virtual:trait-manifest'; registerTraits(window.attributes, traitManifest)`.

**The gotcha that made this a follow-up, not part of the demo:** `defineLazy` must run *before* the
first `upgrade()` (the MutationObserver's attribute filter is fixed at upgrade time), but
`virtual:trait-manifest` is a Vite virtual module — importing it is async, and the global upgrade is
triggered by `InjectorRoot` (not from bootstrap), so the timing is not obviously safe. Resolve the
ordering: either a static `import` of the virtual module (synchronous in the bundled output, but the
module only exists under Vite — breaks non-Vite/unplugged/vitest contexts), or make registration
`await` the manifest before any upgrade fires. Confirm the demo's behavior holds when driven through
the real bootstrap, and that vitest/unplugged paths (which have no Enforcer) still work via a
fallback to the static manifest.

## Progress

- **Status:** resolved — bootstrap consumes the Enforcer manifest app-wide; verified plugged +
  standalone + vitest + tsc. Persistent regression guard split out to #133.
- **Branch:** (frontierui working tree)
- **Ordering decision (settled):** **static `import`**, not dynamic `import().then()`. The
  attribute observer's `attributeFilter` is fixed when `window.attributes.upgrade()` first runs;
  `registerTraits`/`defineLazy` must precede it. A static import is synchronous (the virtual module
  has no side effects — just a table of `import()` thunks), so `registerTraits` at the end of
  `we:bootstrap.ts` still runs before any upgrade. A dynamic import would race the first upgrade →
  rejected.
- **Resolution for non-Vite contexts** (make the specifier resolve everywhere):
  - Vite dev/build → the Enforcer plugin (already wired in `vite.config.mts`) serves the real
    generated manifest.
  - tsc (`build:plugs`, include = `plugs/**`) → add an ambient `declare module
    'virtual:trait-manifest'` inside `plugs/` (the existing one under `tools/` is outside the tsc
    project).
  - vitest → `resolve.alias` `'virtual:trait-manifest'` → the static empty
    `we:plugs/webbehaviors/traitManifest.ts` (this *is* the documented fallback).
  - unplugged → never imports `we:bootstrap.ts`, so unaffected.
- **Done (Frontier UI):**
  - `we:plugs/bootstrap.ts` — static `import { traitManifest } from 'virtual:trait-manifest'`;
    `registerTraits(window.attributes, traitManifest)` (was the empty static manifest).
  - `we:plugs/virtual-trait-manifest.d.ts` (new) — ambient `declare module` so `build:plugs` (tsc,
    include = `plugs/**`) resolves the specifier; the existing `we:tools/.../virtual.d.ts` is outside
    that project.
  - `we:vitest.config.ts` — `resolve.alias` `'virtual:trait-manifest'` → `/plugs/webbehaviors/traitManifest`
    (the empty static manifest = the documented non-Vite fallback).
- **Verified:**
  - **Plugged** (we:declarative-spa.html → we:bootstrap.ts, Playwright on :3001): no console errors;
    `<ul sortable>` driven through `window.attributes` → `data-sortable-ready`, sorted — proves the
    *real* Enforcer manifest reached bootstrap (empty manifest would never load).
  - **Standalone** fui:lazy-traits.html still loads the trait on demand, no errors.
  - **vitest** `vitest run` — 1168 pass / 7 skipped, alias resolves.
  - **tsc** `build:plugs` — 0 new errors (54 pre-existing baseline unchanged), ambient we:d.ts resolves.
  - **check:standards** (WE) — 0 errors.
- **Notes:** Unplugged never imports `we:bootstrap.ts` (the `bootstrapPatches` Vite plugin skips
  `-unplugged`; `we:unplugged.ts` doesn't touch the manifest) → unaffected by construction. Ordering
  resolved via **static import** (sync, runs before first `upgrade()`); dynamic `import().then()`
  rejected (would race the observer's fixed attribute filter). Pre-existing (not from this item):
  Frontier UI `build:plugs` has 54 unrelated tsc errors.

**Graduated to** `fui:frontierui/plugs/bootstrap.ts` — static import of virtual:trait-manifest (app-wide lazy traits) + we:plugs/virtual-trait-manifest.d.ts + vitest alias.
