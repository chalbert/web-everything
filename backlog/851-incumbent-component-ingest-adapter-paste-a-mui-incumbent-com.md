---
kind: story
size: 5
status: resolved
dateOpened: "2026-06-17"
dateStarted: "2026-06-17"
dateResolved: "2026-06-17"
graduatedTo: scripts/ingest-adapter/ingestComponent.mjs
tags: []
---

# Incumbent-component ingest adapter — paste a MUI/incumbent component, normalize to the neutral CEM contract, re-emit as a WE block

The reverse/ingest half of the polyglot adapter story and the #753 reverse-ingest prerequisite (verified absent today). A forward generator exists (#821, CEM → React/Vue wrapper), but nothing ingests an INCUMBENT component (e.g. a MUI button): `htmlToJsx` is a JSX-pane mirror and the upgrader `ComponentIR` ingests the WE declarative form, not third-party components. Build the ingest adapter — parse an incumbent's API surface (props/events/slots) into the neutral CEM-shaped contract (the lossy internal pivot, never project-facing; the adapter-as-normalization-hub direction), then re-emit as a WE block. The substrate #753 criterion 3 round-trips through. WE-owned (normalization-hub / forward-adapter family, #463). Locus webeverything.

## Progress (2026-06-17, batch-2026-06-17) — built

- **Adapter** ([we:scripts/ingest-adapter/ingestComponent.mjs](../scripts/ingest-adapter/ingestComponent.mjs)) — three pure, composable stages, the inverse of the existing pipeline (gen-cem projects fui:blocks.json→CEM; gen-wrapper emits CEM→React/Vue; this ingests incumbent→CEM→fui:blocks.json):
  - `parseIncumbent(source)` — TS-compiler-API parse of the incumbent's **API surface** (the `interface XxxProps` / `type XxxProps` the React idiom uses), never the render body — same posture as react-docgen / the CEM analyzer. Classifies each prop: `on*`-function → DOM event (kebab, sans `on`); `children`/`ReactNode` (non-function) → slot; primitive or string/number-literal-union → attribute+property; object/array → property-only.
  - `normalizeToCem(surface)` — the **lossy neutral pivot** (CEM `custom-element` decl 2.1.0, the exact shape genWrapper consumes): primitive props → `attributes` (+ camel `fieldName`) + public field `members`; events; slots; prefixed kebab `tagName` (`we-button`).
  - `emitWeBlock(cem)` — project-facing re-emit as a `fui:blocks.json`-shaped **draft** block (`status:"draft"`, `x-ingest` provenance).
- **Lossiness is the value** ("flag, don't fake"): render-props / non-handler callbacks and `sx`/`className`/`style` escape-hatches are dropped, each recorded in `surface.dropped[]` with a reason and surfaced on the CLI; a source with no props type throws rather than fabricate one.
- **CLI** ([we:scripts/ingest-adapter/cli.mjs](../scripts/ingest-adapter/cli.mjs), `npm run ingest:component <we:file.tsx> --emit=block|cem|surface|all --source="MUI Button"`) — the headless substrate; the interactive paste workbench is #753 (locus:frontierui).
- **Verified:** 15 vitest cases ([we:__tests__/ingestComponent.test.mjs](../scripts/ingest-adapter/__tests__/ingestComponent.test.mjs)) green over a MUI-Button fixture (props/events/slots/drops + re-emit); **round-trip proven** — the ingested CEM feeds `gen-wrapper` (#821) to produce a working `<we-button>` React wrapper (the #753-criterion-3 round-trip). `check:standards` 0 errors for this changeset.
