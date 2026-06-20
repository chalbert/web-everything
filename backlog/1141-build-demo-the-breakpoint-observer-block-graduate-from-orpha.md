---
kind: story
size: 5
status: resolved
dateOpened: "2026-06-19"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "@frontierui/blocks/breakpoint-observer/index.ts"
tags: []
---

# Build + demo the breakpoint-observer block (graduate from orphan)

Owner for the orphan breakpoint-observer block (#1041, audit §9): build the runtime impl of the breakpoint intent — map semantic step names (compact/medium/expanded) to concrete media OR container queries, expose a reactive matches({up,only,down}) query API, with the four declared traits (mobile-first/desktop-first/strict-range/container-queries). Pairs with flex-row (#508, container-scope) at the viewport scope. Own + demo, then status concept->active. Block: we:src/_data/blocks/breakpoint-observer.json.

## Resolution (batch-2026-06-19)

Built the canonical impl in FUI (WE blocks are specs, impl lives in `@frontierui/blocks/…`):

- `fui:blocks/breakpoint-observer/index.ts` — `BreakpointObserver`: maps semantic steps (`compact`/`medium`/`expanded`) to concrete CSS queries and exposes a reactive `matches({ up, only, down })` API over the active step (computed from injected `matchMedia`, reactive via MQL `change`). The four declared traits are the query-generation strategies of `queries()`: `mobile-first` (accumulative min-width), `desktop-first` (subtractive max-width), `strict-range` (isolated buckets), `container-queries` (same ranges as `@container`). `UnknownBreakpointStepError` for an undeclared step; degrades to the lowest step with no platform.
- `fui:demos/breakpoint-observer-demo.html` + `fui:demos/breakpoint-observer-demo.ts` — live demo: active step + the `matches()` table + all four strategy query strings, updating on resize. Registered in `fui:src/_data/blocks.json` (`demoFile`).
- Graduated the WE spec `we:src/_data/blocks/breakpoint-observer.json` `concept`→`active` + `implementedBy: @frontierui/blocks/breakpoint-observer/index.ts`.

Covered by `fui:blocks/breakpoint-observer/__tests__/breakpoint-observer.test.ts` (9 tests). FUI `check:standards` green (38 blocks, demo completeness passes). Verified live on the FUI dev server (Playwright, `:3001`): at 700px the active step is `medium` and the `matches()` table + four strategy tables render with no errors. Pairs with `flex-row` (#508) at viewport scope.
