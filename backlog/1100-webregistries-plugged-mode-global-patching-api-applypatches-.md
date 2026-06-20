---
kind: task
parent: "1088"
status: resolved
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "we:plugs/webregistries/index.ts"
tags: []
---

# webregistries plugged-mode global-patching API: applyPatches/removePatches/isPatched

Implement the three TODO stubs at we:plugs/webregistries/index.ts:48-90 (applyPatches/removePatches/isPatched): save originals, swap window.CustomElementRegistry + window.customElements to the scoped class, patch Element.prototype.attachShadow for scoped registries, and restore/detect. Mirrors the sibling patches applyWebInjectorsPatches/applyWebComponentsPatches at we:plugs/index.ts:60-63. Slice A of #1088 (we:reports/2026-06-19-backlog-split-analysis.md). Demo: a unit test toggling isPatched(), or a page calling applyPatches() and resolving a scoped element on real DOM.

## Progress

Implemented the three plugged-mode global-patching stubs in `we:plugs/webregistries/index.ts`:
- `applyPatches()` — saves originals (`window.CustomElementRegistry`, `window.customElements`,
  `Element.prototype.attachShadow`), swaps `window.CustomElementRegistry` to the scoped class + installs a
  root scoped `CustomElementRegistry`, and patches `attachShadow` so a shadow created with a scoped-registry
  option (`attachShadow({ customElements })`, + `registry`/`customElementRegistry` aliases) associates it
  with the host via `applyScopedRegistryToHost` (resolvable by `getScopedRegistryOf`). Idempotent (warns +
  no-ops). Uses a `redefine` helper (`Object.defineProperty`) so the getter-only `window.customElements`
  can be reassigned.
- `removePatches()` — restores the three originals (idempotent), clears saved state.
- `isPatched()` — returns the live flag.

Mirrors the save/restore shape of the sibling Node patches (`applyWebInjectorsPatches`/
`applyWebComponentsPatches`, `we:plugs/index.ts:60-63`). Unit test
`we:plugs/webregistries/__tests__/unit/globalPatching.test.ts` — 5 green (isPatched toggle, global swap +
restore, attachShadow scoped-registry association, no-registry leaves host unassociated + attachShadow
restored, idempotency). Full webregistries suite 48 pass / 1 skip; WE `check:standards` 0 errors.
