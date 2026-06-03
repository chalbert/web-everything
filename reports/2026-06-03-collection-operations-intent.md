# Collection Operations Intent — researching gap #10 (filter / sort / page / group)

**Date**: 2026-06-03
**Point**: There is no sorting (or filter/page/group) standard yet; this is the research that feeds gap #10. Finding: model the four operations as one *Collection Operations Intent* with four pipeline-stage dimensions, anchoring sort to the native semantics the platform already standardizes.
**Plan file**: — (initiated from `backlog/gap-10-collection-ops-intent.md`, no `plans/` inbox file)
**Research page**: `/research/collection-operations/`

---

## Question

"What standard do we have around sorting?" — expecting the flow UX intent → traits → blocks. Answer: none exists. Sorting is logged only as triage stub [gap-10](../backlog/gap-10-collection-ops-intent.md) ("filter/sort/page/group; no single native API; vocabulary standardization play"), with no research topic, no report, and no intent. The trait layer has `withSortable` purely as an illustrative mixin; no block implements it. So the top layer of the chain (the intent) is undecided, which is why nothing below it is anchored. This research does the missing first step: investigate the design space so gap-10's open call ("confirm intent shape and dimensions") can be answered.

## Recommendation

**One `Collection Operations Intent` whose dimensions are the four pipeline stages — `filter · sort · group · page` — with a *configurable* pipeline order (default `filter → sort → group → paginate`) and `sort` given a structured sub-shape (ordered keys, direction, collation/case/numeric *preference*, empty-value placement) rather than a flat value list.**

Rationale:
- The four ops always travel together and compose as an *ordered, optional-stage transform pipeline* — the architecture every headless table library independently converged on (TanStack Table's row-model chain is the clearest statement). One multi-axis intent fits this repo's convention (Selection, Focus Delegation) better than four siblings.
- Sort is the only operation with real internal depth, so it is the dimension that earns a sub-object; filter/page/group are mostly on/off.
- Resolution splits across the **two-channel rule**: ambient defaults (collation/locale *preference*, page size) ride the Intent DI channel; structural choices (which columns sort, multi-sort on/off) are Trait Selection.

## Decisions applied (2026-06-03, per project owner)

These convert gap-10's open call into settled positions; the research page now reflects them:

1. **Scope: one intent for now** — not a dedicated Sort Intent. Revisit only if sort's depth proves unmanageable.
2. **Everything configurable** — the intent must be able to *describe any UX preference*, so nothing is hard-coded — the pipeline order included (it is data, not a constant).
3. **Intent is UX-only** — it carries **no technical references**: no comparator functions, no client/server execution flag, no registries. Comparison is expressed as a UX *preference* (locale-aware? case? numeric?), never an implementation.
4. **Server mode: front-end only** — the standard models the client; delegating a sort/filter to a backend (the `ORDER BY` / sort-query-param wire format) is documented as out of scope and app-owned. (Residual: whether to still *recommend* a canonical serialization.)
5. **Terminology** — the research page avoids "anchor" for native-grounding (renamed to "Native Grounding / native primitive") to prevent collision with the positioning **Anchor Intent**.

**Technical half materialised as a decision tool.** Because the intent is UX-only, the *technical* sorting choices were given a concrete home: a new **Sorting Strategy** domain in Plateau's Technical Configurator (`plateau-app`, `/technical-configurator`), modelling 7 web-platform strategies (default sort, numeric comparator, `Intl.Collator`, `localeCompare`, multi-key, decorate-sort-undecorate, server delegation) across 8 outcome axes (data-type, language correctness, natural-number order, stability, mutation, keys, key-cost, execution) with per-strategy advantages/disadvantages and 5 use-case presets.

## Key Findings

1. **Sort is NOT ungrounded** — sharpening gap-10's "no single native API." The platform standardizes sort *semantics and primitives*, just not the *operation*:
   - `aria-sort` → the state vocabulary `ascending | descending | none | other`, one header at a time (`none` = sortable-but-unsorted; `other` = custom algorithm). [MDN]
   - `Intl.Collator` → locale-aware comparison (`sensitivity`, `numeric`, `caseFirst`, `ignorePunctuation`, `usage`). The standard collation strategy. [MDN]
   - `Array.prototype.sort` → guaranteed **stable** since ES2019; `toSorted()` (ES2023) non-mutating. 
   - Open UI `<th sortable>` (#800) is a proposal/discussion (Aug 2023), not shipped. W3C APG "Sortable Table" = `aria-sort` + button-wrapped header is the accessible-today recipe.
2. **Filter / page / group ARE pure vocabulary plays** — no native operation API and no semantics primitive comparable to `aria-sort`. This asymmetry argues for sort's richer sub-shape.
3. **The row-model pipeline is the architectural precedent.** Operations are ordered, independent, optional transforms; default order `filter → sort → group → paginate` (now configurable). Client-vs-server is a *technical* axis — pushed out of the UX intent and into the Technical Configurator's Sorting Strategy domain.
4. **Cross-cutting paradigms harvested:** (a) the row-model pipeline as a reusable narrowing pattern; (b) comparator/collation as one pluggable primitive shared with Change Tracking's `custom comparators` and Web Intl's `Intl.Collator` — a candidate shared comparison primitive, tracked in the technical layer, **not** in the UX intent; (c) pagination *selects* a slice vs. windowing *renders* a slice — adjacent to `windowed-collection` + `loader`, compose don't merge.

## Files Created/Modified

| File | Action |
|---|---|
| `src/_data/intents.json` | **Authored the `collection-operations` intent** (status `concept`, 11 dimensions, initial vocabulary) — pending owner review |
| `src/_data/researchTopics.json` | Added `collection-operations` registry entry |
| `src/_includes/research-descriptions/collection-operations.njk` | New full research write-up |
| `reports/2026-06-03-collection-operations-intent.md` | This report |
| `backlog/gap-10-collection-ops-intent.md` | Added `relatedReport` + recorded decisions in the open call |
| `AGENTS.md` | Regenerated inventory (`npm run gen:inventory`) for new topic count |
| `plateau-app: src/technical-configurator/seed-sorting-strategy.ts` | New — Sorting Strategy domain (8 axes, 7 strategies) |
| `plateau-app: .../provider.ts` | Registered `sortingStrategyDomain` |
| `plateau-app: .../presets.ts` | Added `sortingStrategyPresets` (5 use-case presets) |
| `plateau-app: .../configurator.ts` | Wired presets + requirement axes for `sorting-strategy` |

Build verified (`npx @11ty/eleventy` wrote `/research/collection-operations/`); `npm run check:standards` passes with 0 errors. plateau-app: `tsc --noEmit` reports 0 new errors in the four touched files; the live dev server (`:4000`) serves the new module (HMR reload surfaces the domain at `/technical-configurator`).
