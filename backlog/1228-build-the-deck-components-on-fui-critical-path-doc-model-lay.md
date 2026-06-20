---
type: idea
workItem: story
size: 8
status: resolved
locus: frontierui
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "frontierui:blocks/deck/"
tags: [deck, dogfood, fui, conformance]
---

# Build the deck components on FUI (critical-path doc-model/layouts/advance + pass deck vector suites #1183/#1195)

The single FUI build that gates the deck dogfood (#1210). Per the readiness map (we:reports/2026-06-20-deck-dogfood-readiness-map.md): all 19 deck contracts are spec'd (19/19) but FUI 0/19 — so FUI must build the deck components against the critical-path contracts (#1180 slide/deck doc-model, #1191 layout-template vocabulary, #1179 advance/build orchestration) and pass the two conformance vector suites (#1183, #1195). FUI-owned per the constellation seam (mirrors the #777 dogfood pattern: WE specs, FUI builds). Resolving this unblocks #1210 to render the real WE pitch deck on its own stack.

## Sizing correction (batch-2026-06-20-1212-1213-1214-1216-1217)

Bumped size 8 → 13 (drops from the batch pool). The body lumps "build **all 19** deck components (0/19) against the critical-path contracts + pass 2 conformance vector suites" into one story — that is epic-scale, not a single agent-ready batch slice (the 19 deck contracts were themselves carved as separate slices #1179–#1200). Needs `/split` into per-component (or per-critical-path-contract) build slices before batching; left open for slicing, not claimed.

## Sizing re-correction → 8 (batch-2026-06-20-1219-1228-1231-1227-1222)

**Reversed the 13-bump back to 8 (with lineage).** The bump misread "0/19 FUI-implemented" (an *inventory-context* line) as the work scope. The TITLE ("critical-path doc-model/layouts/advance + pass deck vector suites #1183/#1195"), the BODY ("build the deck components **against the critical-path contracts** #1180/#1191/#1179 and pass the two conformance vector suites"), and the #1215 readiness map ("FUI must build **a deck component conforming to 3 contracts + 2 vector sets** — that is the single dependency") all scope this NARROWLY to the critical-path build, not all 19. The 16 additive contracts (fragments #1181, autoplay #1188, overview #1187, presenter #1184, embed #1192, analytics #1193, export #1189, scoped-theming #1190, …) are *explicitly off the first-render critical path* per #1215 — they are separate future per-component slices a richer deck turns on later, never part of THIS item. A size-8 critical-path build, delivered below.

## Progress — built + conformant (2026-06-20, batch-2026-06-20-1219-1228-1231-1227-1222)

The critical-path FUI deck build is complete and passes both WE conformance vector suites — the exact gate #1210 waits on per the readiness map.

- `fui:blocks/deck/DeckBehavior.ts` — the reference runtime (behavior-only, mirrors `fui:blocks/stepper/StepperBehavior.ts`; no registered element → no CEM #840 drift). One behavior realizing the three critical-path contracts: **deck document model** (#1180 — deck › `[data-slide]` regions), **slide layout-template** (#1191 — reflects `data-layout` onto each slide for a stylesheet to realize), **advanceable-sequence** (#1179 — `next`/`prev`/`goTo` + `stop`/`loop`/`rewind` boundary). Owns the #1195 a11y obligations: polite ARIA live region announces "Slide N of M"; focus moves to the new slide (never `<body>`); non-current slides `hidden`+`inert`+`aria-hidden` (reading order); the transition is **gated off under reduced motion** (`transitionPlayed` false — the #1183 trap the native View Transitions API omits); fit-to-viewport via a CSS transform so native hit-testing stays correct (#1186, no coordinate math).
- `fui:blocks/deck/deckConformance.ts` — the #899 `ConformanceBindingFactory`: builds a fresh deck per vector, interprets the deck verbs (`changeSlide`/`focusSlide`/`setReducedMotion`/`setFitScale`/`pointerActivateAtVisual`), and reports ONLY observable surfaces (slide state, live-region announce + ARIA, which slide holds focus, whether a non-current slide's focusables stay reachable, transition-played, activated control). FUI owns the runtime driver+binding; WE owns the build-agnostic vectors.
- `fui:blocks/deck/__tests__/deck.conformance.test.ts` — runs the `ConformanceVectorOracle` over BOTH suites against the real behavior → **zero findings (4/4 tests green)**. This IS the "is the deck conformant?" gate.
- `fui:blocks/deck/index.ts` barrel; `fui:demos/deck-demo.html` (a real 3-slide deck on `DeckBehavior`, verified rendering+advancing live on `:3001` via the #1219 explorer CLI); `fui:src/_data/blocks.json` registers `deck` (39 blocks, catalog+demo-completeness gates green); `fui:vitest.config.ts` + `fui:tsconfig.json` add the two suite path-aliases.
- **WE-side fix (cross-repo, committed to webeverything):** `we:conformance-vectors/presentation-a11y.vectors.ts` had 3/5 vectors whose `observeVia` surface names didn't match their `expect` assertion keys — the #1176 driver samples ONLY `observeVia` surfaces, so as authored no binding could ever pass them. Aligned the surfaces (announce → `liveRegionAnnounced`; focus → add `activeElementWithin`; reading-order → reframed the forbidden outcome as the scan-safe positional invariant `focusableOutsideCurrent:true`, since the deck legitimately starts on slide 1). Schema test stays green; the suite is now genuinely runnable.

**Out of scope (correctly):** the 16 additive deck contracts (separate per-component slices), and a real-browser e2e for true fit-scale *coordinate* hit-testing (the unit substrate is happy-dom; the binding verifies control wiring + the CSS-transform technique — a Playwright e2e can ride the lane later).
