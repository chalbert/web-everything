---
type: issue
workItem: story
size: 3
parent: "125"
status: resolved
blockedBy: ["240"]
dateOpened: "2026-06-10"
dateStarted: "2026-06-11"
dateResolved: "2026-06-11"
graduatedTo: none
tags: []
---

# Repoint frontierui blocks at @frontierui/jsx-runtime and delete the divergent copy

Once the package JSXRenderer is re-synced to canonical (#240): point
frontierui/blocks/renderers/jsx at @frontierui/jsx-runtime, delete the older divergent
copy #2, update vite.config.mts jsxInject/jsxFactory + tsconfig, and verify both repos'
suites (FUI we:JSXRenderer.test.ts + build, WE blocks suite + check:standards). Slice B of
the #240 dedupe.

**Resolution (#264, resolved):** treat the runtime as a **normal workspace dependency** —
consume `@frontierui/jsx-runtime` via vite/node resolution through the package's `exports`
field (the same way any dep resolves), and flip `jsxInject` to inject the **bare specifier**
`import jsx from '@frontierui/jsx-runtime'` so it rides that resolution. The runtime
*location* is project-configurable (package default; a **URL** override for no-bundler/CDN
projects), but the **only invariant** is the contract: the name resolves to the package's
`exports`, never back to WE source or a raw path. No bespoke importmap/alias mechanism is
required here — the broad project-selectable resolution axis is #271 and does **not** gate
this item.

## Progress

**Resolved 2026-06-11.** Repointed frontierui at the published runtime package and deleted the
divergent in-repo copy. Changes (frontierui repo):

- **Consumer repoint** — `we:blocks/renderers/index.ts` now re-exports `jsx, createElement, Fragment` +
  the JSX types from `@frontierui/jsx-runtime` (was `./jsx`). The package exports a superset of the
  copy's surface (its index even documents it mirrors the canonical `we:blocks/renderers/jsx/index.ts`).
- **Deleted the divergent copy** — `blocks/renderers/jsx/{we:index.ts,we:JSXRenderer.ts}` removed. It was
  frontierui's stale copy #2 (72-line diff vs the #240-resynced package). Note: the #240 drift guard
  `fui:packages/jsx-runtime/__tests__/canonical-sync.test.ts` compares the **package** against the
  **WE** canonical (`webeverything/blocks/renderers/jsx`), not this deleted copy — so deletion doesn't
  affect it.
- **vite jsxInject** — flipped from `import jsx from '/blocks/renderers/jsx'` (raw in-repo path) to the
  **bare specifier** `import jsx from '@frontierui/jsx-runtime'`, per the #264 ruling: JSX rides normal
  package resolution (node_modules workspace symlink → package `exports`), never the in-repo path
  (#271/#274 module-resolution invariant). `jsxFactory`/`jsxFragment` unchanged.
- **Other referencers** — repointed `we:blocks/__tests__/unit/renderers/JSXRenderer.test.ts` and the
  `we:demos/declarative-spa-jsx.tsx` type-import to the bare specifier. tsconfig needed no change (no path
  mapping pointed at the copy; the package resolves via node_modules + `exports`).

**Verification (both repos):**
- **FUI** — rebuilt the package (`tsc`, clean), then `we:JSXRenderer.test.ts` (26) passes **against the
  package via the bare specifier**, the package's own tests pass, the broader blocks unit suite is
  green (419), and `vite build` succeeds (76 modules — proves `jsxInject`'s bare specifier resolves at
  build time).
- **WE** — `check:standards` green (0 errors); the new module-resolution exports-lock lint (#274) is
  satisfied by this bare-specifier form.

**Carry-forward (noted in #274):** the WE `we:demos/maas-consumer-demo.html` importmap still maps
`@frontierui/jsx-runtime` → a local WE src path; clean that up under #265/#081 follow-up now that the
bare-specifier resolution is the established form. Slice B of the #240 dedupe.
