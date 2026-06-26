---
kind: story
size: 5
parent: "912"
status: resolved
dateOpened: "2026-06-24"
dateStarted: "2026-06-26"
dateResolved: "2026-06-26"
graduatedTo: 912
locus: frontierui
relatedProject: webdocs
tags: [webdocs, block-explorer, workbench, polyglot, functional-adapter]
---

# Functional live-mount producer — produceFunctionalBytes emits a self-contained mountable module (jsx-runtime + DOM renderer + error boundary + mount/unmount)

The functional sibling of #1518 (the wrapper live producer). Today fui:tools/maas/functionalAuthoringForm.mjs is transform-only — it leaves a bare import of @frontierui/jsx-runtime and its own header says "the self-contained/live variant is a later slice. No bundle." This slice adds a functional-live form (its own author-form id-space, NOT a wrapper-catalog member per #1619) where produceFunctionalBytes esbuild-BUNDLES @frontierui/jsx-runtime + its DOM renderer + an ErrorBoundary into a self-contained ESM module exporting mount(el, props?) => {update, unmount} and unmount(). Foundational head of the #1746-GO realization chain that makes the functional author-mode form live-runnable, not just source-displayed.

## Progress

Done (resolved 2026-06-26). Added the `live` variant to the functional producer, mirroring `produceWrapperBytes`' `'wrapper'|'live'` (#1518):

- `fui:tools/maas/functionalAuthoringForm.mjs` — `FUNCTIONAL_VARIANTS = ['functional','live']`; `produceFunctionalBytes(caseId, source, variant='functional')` (back-compat default unchanged) now returns a `variant` field. New `buildFunctionalLiveModule(code)` esbuild-**bundles** `@frontierui/jsx-runtime` + the captured component + a mount harness into a self-contained ESM exporting `mount(el, props?) => {update, unmount}` + module-level `unmount()`. `captureDefaultComponent` rebinds the source's `export default` to a local binding (throws clearly if absent). Key correctness point: the jsx-runtime treats a bare `function` JSX *type* as a constructor, so the functional component is **called directly** (`Component(props)` → DOM node), not passed through `jsx.createElement`. A render throw is caught and reported into the host (`data-maas-error`), never a blank mount (#1518 ErrorBoundary parity). `PRODUCER_VERSION` → '2'.
- `fui:tools/maas/__tests__/functionalLiveProducer.test.mjs` — 6 tests on an **injected fixture** (independent of the `we:src/_data/authorModeSource.json` artifact, whose wiring is #1618): bundle contract (exports, runtime bundled-in, JSX lowered), error-boundary, no-default-export throw, render-only default unchanged, and a **real happy-dom mount/update/unmount** of the bundled module (proves the emitted bytes actually render). 6/6 green.

**Pre-existing FUI gate state (not this changeset):** `npm run check:standards` in ../frontierui reports 34 errors, all in `fui:blocks/renderers/upgrader/*`, `fui:blocks/resource-loader/*`, `fui:attributes/*` (registration-drift / hard-coded-tag debt) — **none names `fui:tools/maas/`**; pre-existing, independent of this change (step-over per the batch stop rule). Separately, the existing `fui:tools/maas/__tests__/functionalAuthoringForm.test.mjs` wire-half is red because `we:src/_data/authorModeSource.json` is absent — that artifact is **#1618**'s job; this producer is pure data-in/bytes-out and is proven via the injected fixture. Live end-to-end (a real workbench mount over the served :3002 module) lands once #1618 emits the artifact.
