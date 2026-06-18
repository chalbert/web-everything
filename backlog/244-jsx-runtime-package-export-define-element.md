---
type: issue
workItem: task
parent: "125"
status: resolved
dateOpened: "2026-06-09"
dateStarted: "2026-06-09"
dateResolved: "2026-06-09"
tags: [jsx, adapters, packaging, auto-define, frontier-ui]
relatedReport: reports/2026-06-06-adapter-real-project-integration.md
relatedProject: webadapters
crossRef: { url: /adapters/jsx-adapter/, label: JSX Adapter }
---

# `@webeverything/jsx-runtime` package must export `defineElement` (served functional form imports it)

Surfaced closing out #241 (Auto-Define contract). The functional-component generator now emits

```js
import jsx, { defineElement } from '@webeverything/jsx-runtime';
…
defineElement('user-card', UserCardElement);
```

so a *served* functional module self-registers idempotently (HMR-safe) instead of a bare
`customElements.define`. In-repo this resolves — the canonical jsx surface
(`we:blocks/renderers/jsx/index.ts`) now re-exports `defineElement` + the `AutoDefineStrategy` contract
from `blocks/renderers/auto-define/`.

**The gap:** the published **package copy** `fui:frontierui/packages/jsx-runtime/src/index.ts` exports only
`default` / `jsx` / `createElement` / `Fragment` — **not** `defineElement`. A real consumer that
`npm install`s `@webeverything/jsx-runtime` and imports a served functional module would fail to resolve
the named `defineElement` import at runtime.

**What to do:**

- Add `defineElement` (and re-export the `AutoDefineStrategy` / `RegistryScope` / `DefiningModule`
  contract types) from `fui:frontierui/packages/jsx-runtime/src/index.ts`, mirroring the canonical
  webeverything surface — i.e. carry an `auto-define` source into the package the same way the
  `JSXRenderer` was carried (see #240's dedupe topology / #125's copy-vs-import decision).
- A package-level check that the package's named exports match the canonical surface (so a future
  added export doesn't silently miss the package again).

Pairs with #240 (JSXRenderer dedupe onto the package) and #239 (publish topology) — same question of
where the canonical package source lives. No in-repo behaviour breaks today; this is the
real-consumer / publish gate for the functional served form.

## Progress
- **Status:** resolved — package now exports `defineElement` + the auto-define contract, with a parity check.
- **Branch:** docs/standard-authoring-workflow
- **Done:**
  - Carried `fui:frontierui/packages/jsx-runtime/src/auto-define.ts` (verbatim copy of canonical
    `we:blocks/renderers/auto-define/defineElement.ts` — self-contained, no imports).
  - `fui:packages/jsx-runtime/src/index.ts` now re-exports `defineElement`, `explicitAutoDefine`, and the
    `AutoDefineStrategy`/`AutoDefineTrigger`/`RegistryScope`/`DefiningModule` types.
  - `fui:packages/__tests__/extraction-smoke.test.ts` adds 3 cases: idempotent `defineElement`, the
    `explicit` baseline strategy, and a **parity drift-guard** asserting every carried auto-define
    value export is re-exported from the package root.
  - Rebuilt `dist/` (tsc clean); smoke test 14/14 green; `check:standards` 0 errors.
- **Notes:** scope kept to auto-define only — the broader package-surface dedupe (dialect/directives/
  render-strategy carries, copy-vs-import topology) stays with #240/#239.
