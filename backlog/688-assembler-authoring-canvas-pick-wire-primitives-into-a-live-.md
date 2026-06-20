---
kind: story
size: 3
parent: "646"
status: resolved
blockedBy: ["669"]
locus: plateau-app
relatedProject: webdocs
dateOpened: "2026-06-15"
dateStarted: "2026-06-15"
dateResolved: "2026-06-15"
graduatedTo: plateau-app/src/component-assembler/authoring.ts
tags: [devtools, composition, assembler, authoring, served-surface, plateau-app]
---

# Assembler authoring canvas — pick + wire primitives into a live composition

Slice B of the #646 composition assembler (sibling of #669 slice A). Adds the build-your-own authoring half to the plateau-app assembler shell: a primitive palette read cross-locus from fui:blocks.json + we:intents.json (same import pattern as intent-configurator), letting an author select and assemble primitives into composed markup with live preview. Canvas UX is POC-mode latitude (the emit format + home were settled by #652). Demoable: pick nav-list + disclosure + anchor(strategy=escape) + hover-intent and see the composed widget render live. Blocked on #669 (the read-only shell). If it re-estimates above size 3 in plateau-app context, sub-slice into palette+select and compose+preview.

## Progress

- **2026-06-15 — built + verified.** New `plateau:plateau-app/src/component-assembler/authoring.ts` (+ CSS appended
  to `plateau:assembler.css`), mounted by `mountComponentAssembler` above the read-only preset catalog. The
  palette reads `fui:blocks.json` (69) + `we:intents.json` (56) cross-locus via the same relative import the
  read-only shell + Intent Configurator use — fully data-driven, no parallel copy. Selecting primitives
  toggles them into the composition; each selected intent's dimensions surface as registry-derived
  `<select>`s; the scaffold generator lowers blocks → nested custom-element tags and intents → boolean
  attrs + `<intent>-<dimension>="<value>"` attrs (HTML-first, intent-as-attribute). Live preview renders
  the composition in an isolated shadow root + a composed-markup source pane.
- **Verified live** (headless browser, plateau-app :4000 `/component-assembler`): the exact demoable —
  pick `nav-list` + `disclosure` + `anchor` (strategy = escape) + `hover-intent` — emits
  `<div class="composed-widget" disclosure anchor anchor-strategy="escape" hover-intent>…` and renders
  `.composed-widget` live; zero page/console errors.
- **Gate:** plateau-app `vitest run` green (154/154); my files `tsc --noEmit`-clean. (The repo's tsc shows
  a pre-existing baseline red in untouched `../webeverything/plugs/webvalidation/*` and other un-touched
  `src/*` files from concurrent work — not this changeset; vitest, the locus gate, is green.)
- **Metadata:** added the missing `locus: plateau-app` + `relatedProject: webdocs` (the loader had
  defaulted it to the WE locus), mirroring sibling #669. Stayed within size 3 — did not need the
  palette/compose sub-slice.

Scope held to size 3 — the canvas generator is a representative POC scaffold (per #652-ratified latitude),
not a full composition compiler; ejection of the authored recipe is the later #689 slice.
