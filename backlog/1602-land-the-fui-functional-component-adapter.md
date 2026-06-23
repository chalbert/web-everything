---
kind: story
size: 5
parent: "081"
status: resolved
blockedBy: []
locus: frontierui
dateOpened: "2026-06-22"
dateStarted: "2026-06-23"
dateResolved: "2026-06-23"
graduatedTo: "fui:tools/maas/functionalAuthoringForm.mjs"
tags: []
---

> **Blocked on a design fork (2026-06-22, batch-2026-06-22-764-1602 pre-flight/work).** Surfaced as
> mis-flagged Tier-A: reads as "register a FORMS entry" but landing it forces three unprepared design
> calls — (1) the FUI MaaS catalog **ratified-retired `functional`** (#974/#977 resolved), so the
> authoring form's catalog identity is undecided; (2) the #700 boundary means FUI MaaS never imports
> WE's `serve()`, yet WE already emits the functional source — so FUI re-emit vs consume-WE-data-emit
> (#954 axis) is undecided; (3) the plan is a brain-dump, not a buildable contract. Filed
> **[#1619](/backlog/1619-decide-the-fui-functional-component-adapter-shape-catalog-id/)**
> (`blockedBy: 1619`). #313 stays blocked behind this. The `@frontierui/jsx-runtime` runtime already
> exists; this is the adapter/emit layer around it.

# Land the FUI functional-component adapter

Build the Frontier UI functional-component adapter described in `we:plans/functional-component-adapter.md`
as a real, shipped FORMS source — the prerequisite that #313 (MaaS — add the adapter as a FORMS entry) has
been waiting on. The MaaS provider epic #081 resolved without this adapter being delivered as its own
artifact, so it is carved out here as the concrete blocker.

This card exists so #313 is **blocked by a real edge**, not a prose "once it lands" note (parking is not a
prioritisation escape — 2026-06-22 parked-item sweep).

## Scope

- Implement the functional-component adapter per `we:plans/functional-component-adapter.md` (the FUI
  functional/render-prop authoring form that lowers to the standard).
- Register it as a FORMS entry the MaaS `?form=…` catalog can serve.
- Then #313 (`blockedBy: 1602`) wires it into the MaaS demo and the polyglot panel.

## Blocks

- #313 — MaaS: add the Frontier UI functional-component adapter as a FORMS entry.

## Progress (resolved 2026-06-23, batch-2026-06-23-1689-1500)

Built at the scope #1619 ratified — **wire the WE artifact + own the served-module transpile**, NOT a FUI
functional emitter (WE's `serve()` already emits the functional source; the "build a FUI emitter" reading
the original Scope assumed was the mis-flag #1619 corrected). Landed as
`fui:tools/maas/functionalAuthoringForm.mjs`:

- **Wire** — `readAuthorModeSource()` reads the committed WE artifact
  `we:src/_data/authorModeSource.json` (the #954 data-emit channel) over the sibling `../webeverything`
  read (the #1618 transport default), and `functionalSourceFor(caseId)` surfaces a case's `functional` JSX
  form as WE emitted it. Data only — never imports WE's `serve()`/`moduleService` (the #700 boundary).
- **Transpile** — `transpileFunctionalSource()` lowers the functional JSX to importable ESM via esbuild
  (the same transpile seam `fui:tools/maas/produceWrapperBytes.mjs` uses), with the project's JSX factory
  config (`jsx.createElement`/`jsx.Fragment`, per `fui:tsconfig.json`), leaving the `@frontierui/jsx-runtime`
  import intact — render-only v1 (#1619 forced invariant; bundle/live-mount is a later slice, mirroring the
  wrapper producer's #1085 transform → #1501 bundle path). `produceFunctionalBytes(caseId)` serves both
  halves: importable JS bytes + the original source for display.
- **Test** — `fui:tools/maas/__tests__/functionalAuthoringForm.test.mjs` (5 tests, all green): reads the
  real committed artifact, surfaces the functional form, and proves the transpile (no raw JSX survives,
  `jsx.createElement` emitted, runtime import preserved).

Distinct from the consume-mode wrapper catalog (#1619 Fork 1: the authoring `functional` id is wholly
separate from FUI's retired `functional`→react-wrapper alias, dropped next by #1681). **#313 unblocks** —
it now wires this adapter into the MaaS demo + polyglot panel (`blockedBy: 1602`). FUI gate green
(0 errors). The `@frontierui/jsx-runtime` runtime already existed; this is the adapter/emit-wiring layer.
