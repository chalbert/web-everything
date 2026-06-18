---
type: idea
workItem: story
size: 5
parent: "746"
status: resolved
dateOpened: "2026-06-18"
dateStarted: "2026-06-18"
dateResolved: "2026-06-18"
graduatedTo: frontierui/workbench/ingestPanel.ts
locus: frontierui
relatedProject: webdocs
tags: [webdocs, block-explorer, adapters, polyglot]
---

# Polyglot panel — reverse-ingest paste demo (incumbent → neutral CEM → WE block)

Block Explorer polyglot-panel slice (e), sibling of #753 (independent root — uses the WE ingest adapter, not genWrapper). Paste an incumbent component (e.g. a MUI button) → run the #851 ingest adapter (we:scripts/ingest-adapter/ingestComponent.mjs) → show the neutral CEM pivot → re-emit as a WE block, demonstrating normalization-hub value in one move. Scope includes vendoring the WE ingest adapter FUI-side (the mechanical #892-analog, settled by the #855/#892 contracts-only precedent — not a new fork). Panel UI is FUI. Home fui:workbench/. locus:frontierui.

## Built (batch-2026-06-18)

Shipped in **frontierui** — the polyglot panel slice (e), reverse-ingest direction:

- **Vendored the #851 ingest adapter** FUI-side at `tools/ingest-adapter/ingestComponent.mjs` —
  **byte-identical** copy of `we:scripts/ingest-adapter/ingestComponent.mjs` (the #892-analog
  vendoring, contracts-only precedent #855/#892), plus `ingestComponent.d.ts` for a typed import
  (mirrors the gen-wrapper vendoring used by #753).
- **`workbench/ingestPanel.ts`** — `mountIngestPanel(host)` (paste textarea seeded with a MUI-ish
  sample + Sample/Ingest buttons + three-stage output) and the testable `runIngest(source)` helper.
  Paste an incumbent → vendored `ingest()` → neutral CEM pivot + WE block draft; dropped React-isms
  (`sx`, render props) are shown, never faked ("flag, don't fake"); parse failures surfaced.
- **`vitest.config.ts`** — added a `workbench/**/__tests__/**/*.test.ts` unit glob (e2e specs are
  `*.spec.ts`, untouched).

Home `fui:workbench/`; FUI-owned panel. Gate: `check:standards` green (0 errors), full vitest
1903 pass (5 new), `tsc` clean.
