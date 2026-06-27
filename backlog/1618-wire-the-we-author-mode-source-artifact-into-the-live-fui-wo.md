---
kind: story
size: 5
parent: "746"
status: open
blockedBy: []
dateOpened: "2026-06-22"
dateStarted: "2026-06-27"
locus: frontierui
relatedReport: reports/2026-06-27-fui-workbench-author-mode-source-home.md
tags: [block-explorer, workbench, author-mode, maas, fui]
---

# Wire the author-mode-source into the live FUI workbench (declarative-component blocks)

> **Retyped decision → story (prepare-all 2026-06-27).** This was briefly retyped to a `decision` because two
> design sub-calls (form-set, generation-home) gated the build. **Both are now resolved** — carved to
> [#1865](/backlog/1865-author-mode-source-form-set-generation-home-for-the-fui-work/) and **ratified**
> (`graduatedTo: 1618`, `codifiedIn` `we:docs/agent/platform-decisions.md#workbench-inert-data-static-slot`):
> Fork 1 = ship the 3 faithfully-emitted forms (carve `html`/`jsx`); Fork 2 = static `authorSource` registry
> slot like `cem`, dev freshness via the existing `/_maas/data/` HMR re-fetch. The attachment contract was
> settled by #1701 (source-only `WorkbenchBlock`) and the transport premise by #1730/#1752 (the WE artifact is
> gone; generation is a FUI concern). **No open fork remains — this is a clean FUI wiring build.**

## What to build

Following #1865's ratified shape, register FUI's declarative `<component>` cases as **source-only**
`WorkbenchBlock`s carrying a static `authorSource`, and let the existing author-mode panel render them.

1. **Generate author-source data from FUI's fixtures.** Lower each case in
   `fui:blocks/renderers/component/__fixtures__/component-cases.ts` to the 3 faithfully-emitted forms —
   `declarative` (the def text), `wc-class` (`fui:blocks/renderers/component/declarativeComponent.ts`
   `generateClassSource`), `functional` (`fui:blocks/renderers/functional/functionalComponent.ts`
   `generateFunctionalSource`) — into the `{code, language, lossy, diagnostics}` shape the panel consumes
   (`fui:workbench/authorMode.ts:21-24`).
2. **Carry it as a static registry slot.** Populate the inert `authorSource?: AuthorModeSource` slot already
   declared beside `cem?` on the descriptor registry (`fui:workbench/registry.ts:143-147`) — read directly for
   first render, no fetch (the #1865 Fork-2 ruling: author-source is inert display data in the `cem` class, not
   a live module).
3. **Wire dev freshness via the existing `cem` loop.** Editing a fixture re-emits the data manifest; the
   workbench demo re-fetches `/_maas/data/<tag>.json` and calls `handle.refresh()` — the same file-watch → HMR
   → data-route path `cem` already rides (`fui:vite.config.mts` `cemHotReload`, `fui:demos/workbench.ts`). No
   new transport; `/_maas/`'s transpile/serve role stays reserved for live modules.
4. **Render unchanged.** The panel is form-count-agnostic — one tab per `source.forms` entry
   (`fui:workbench/authorMode.ts:98-110`) under "flag, don't fake" (`fui:workbench/authorMode.ts:12`), so a
   3-form source renders 3 tabs with no empty/faked tabs.

Only rendered text + diagnostics cross the #700 seam (FUI never imports `serve()`).

## Note for the #1883 / html-jsx follow-up (prep-skeptic finding, 2026-06-27)

A prep skeptic attacking #1865's "scope to 3" found the `html`/`jsx` forms are **nearly free**, so **#1883 may
be over-scoped** — it should likely be narrowed to *only* the lossy/diagnostics engine, not "build html/jsx
emitters":

- **`html` needs no emitter** — `def.templateHTML` is the raw `innerHTML` of the `<component>` definition
  (`fui:blocks/renderers/component/declarativeComponent.ts:123`); the `html` form *is* that string verbatim
  (`code: def.templateHTML, language: 'html', lossy: false`).
- **`jsx` already has a faithful substrate** — `htmlToJsx` (`fui:packages/component-compiler/src/htmlToJsx.ts`)
  is the production HTML→JSX converter the **already-shipping** `functional` form is built on
  (`fui:blocks/renderers/functional/functionalComponent.ts:47`). A `jsx` form is `code:
  htmlToJsx(def.templateHTML), language: 'jsx'` — one line reusing a shipped, tested function.

This does **not** override #1865 (ratified) — it's a flag for the #1883 builder (or a cheap #1865 revisit):
5-form parity is ~2 lines beyond 3-form, with the only genuinely-missing piece being the `lossy/diagnostics`
computation for the hard cases (e.g. `htmlToJsx` silently dropping non-directive HTML comments). Decide there
whether to ship 5 forms now or keep them carved.

## Lineage

Follow-up to #818 (author-mode emit foundation, placement #954) under workbench epic #746. Design sub-calls
resolved by #1865 (form-set + generation-home), #1701 (source-only `WorkbenchBlock`), #1730/#1752 (transport —
WE artifact deleted, FUI `/_maas/` loader + thin-descriptor registry). FUI-locus.
