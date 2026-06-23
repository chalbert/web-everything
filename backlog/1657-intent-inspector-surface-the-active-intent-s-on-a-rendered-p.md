---
kind: story
size: 3
status: resolved
locus: plateau-app
dateOpened: "2026-06-23"
dateStarted: "2026-06-23"
dateResolved: "2026-06-23"
graduatedTo: "plateau:src/dev-browser/intent-inspector/"
tags: []
---

# Intent inspector — surface the active intent(s) on a rendered page

A dev-tool overlay that shows which intent(s) a page's elements were resolved under, by READING attributes already in the DOM — the webintents standard emits the active profile as data-intent-* on the root/scope (data-intent-density/-motion/-mode) and elements carry semantic intents (action-intent=...). Inert, near-zero cost: it stamps nothing, just surfaces what is there. Carved from #947 sibling (3) (read-only intent surfacing). The overlay UI is dev-tooling (FUI/Plateau dev-browser); the attribute contract is WE's. Wanted feature, not a parked residual.

## Progress (resolved 2026-06-23, batch-2026-06-23-1689-1500)

Built the inspector as a Plateau dev-browser module `plateau:src/dev-browser/intent-inspector/` (locus set
to plateau-app — the overlay is dev-tooling per the body; the attribute contract it reads is WE's webintents
emit):

- **`plateau:src/dev-browser/intent-inspector/types.ts`** — `IntentProfile` (density/mode/motion),
  `ElementIntent` (action-intent + locator + label), `IntentInspection` (profile + elements) — the shape the
  overlay UI renders.
- **`plateau:src/dev-browser/intent-inspector/inspect.ts`** — `inspectIntents(root)`: a **pure read** (no
  mutation) of the active `data-intent-*` profile from the scope root (or its nearest `[data-intent-*]`
  ancestor — the resolved scope) + every `action-intent` element in document order with a locator. Exposes
  the WE attribute-contract names it reads (`INTENT_PROFILE_ATTRS` = `data-intent-density`/`-mode`/`-motion`,
  `ACTION_INTENT_ATTR` = `action-intent`).
- **`plateau:src/dev-browser/intent-inspector/intent-inspector.test.ts`** — 7 tests (profile read, null-axis,
  ancestor-scope resolution, document-order collection, root-self inclusion, **inert/no-mutation**, the
  exposed attribute-contract names).

Inert and near-zero cost — it stamps nothing. The overlay's visual layer (a dev-browser panel) renders an
`IntentInspection`; this slice ships the read. The `data-intent-*`/`action-intent` vocabulary is the
WE-owned webintents emit; documented here as the constants the tool reads against.
