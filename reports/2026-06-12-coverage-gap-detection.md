# Coverage & gap detection — what Web Everything is missing

**Date:** 2026-06-12
**Backlog:** #347 (phase 3 of epic #315)
**Research topic:** [/research/benchmark-coverage/](/research/benchmark-coverage/)
**Data:** `we:src/_data/benchmarkCoverage.json` · joins `we:benchmarkCapabilities.json` (#346) against the WE inventory

## What this is

Phase 3: every extracted capability (#346) mapped onto a Web Everything entity
(block/intent/plug/protocol/project) and labelled **covered / partial / missing / native-covered**, weighed
**native-first**. This is the artifact that answers the epic's question.

## Headline result (96 capabilities)

| Label | Count |
|---|---|
| covered | 52 |
| native-covered | 9 |
| partial | 24 |
| missing | 11 |
| **fileable gaps (un-tracked partial/missing)** | **11** |
| already tracked | 5 |

WE's coverage is strongest where it has invested: the **droplist/selection family** (select, combobox,
multi-select, listbox, type-ahead), **overlays** (dialog, popover, tooltip via anchor-positioning protocol),
**forms/validation** (validation protocol + intent), **data** (data-table/grid, pagination, windowed
collection), and the **cross-cutting behavior intents** (focus-containment, focus-delegation, live-region,
breakpoint/density/motion, locale/translation). Many capabilities other libraries ship as components are
**native-covered** in WE by design (link, checkbox, radio, switch, divider, focus-visible) — counted as
covered, not gaps, per native-first.

## The 11 fileable gaps (ranked → input to #348)

1. **menu / menubar** — action menu (role=menu/menuitem); droplist is selection-oriented, intent:command has no impl block.
2. **notification-toast** — feedback/message/live-region intents cover UX; no toast block (queue, timeout, stack).
3. **date-time-picker** — intent:temporal defines UX; no calendar/date/time/range picker block.
4. **design-tokens-theming** — no unified token system (spacing/radius/elevation/semantic color/dark); relates to #010.
5. **command-palette** — intent:command exists; no searchable launcher block.
6. **drawer-sheet** — modal/surface intents cover behavior; no edge-anchored drawer block.
7. **range-slider** — block:slider is single-thumb; two-thumb range unsupported (extends the block).
8. **accordion** — disclosure intent covers one region; no multi-section accordion block.
9. **breadcrumb** — navigation primitives exist; no breadcrumb block.
10. **context-menu** — no right-click/long-press trigger (composes with menu, gap 1).
11. **carousel** — no carousel block (APG carousel pattern); scroll-snap anchor.

## Dedup (5 already tracked, not re-filed)

file-upload → #028 · async-pagination → #018 · tree-select → #064/#296 · color-tokens/dark-mode → #010 ·
drag-and-drop → #022. Phase 4 must not re-open these.

## Skipped low-value (logged, not filed)

split-button, fab, color-picker, rating, tags-input, pin-input, rich-text-editor, avatar, badge, tag-chip,
timeline, code-block, scroll-area, resizable-splitter, card, radius, elevation, spacing-scale, touch-target,
color-contrast, tree-view — pure styling idioms, native-covered, folded into a filed gap, or trivially
composed. Logged so the omission is explicit, not silent.

## Caveats

- Labels reflect the **first-pass** capability matrix (#346); they sharpen as per-source extraction (#352)
  fills exact presence. A "partial" often means "the UX intent exists but no implementation block" — a
  legitimately different gap from "missing entirely," which the label preserves.
- Native-first weighing is a judgement per row; the `nativeAnchor` field records the basis so it's auditable.

## Next

#348 (gap → backlog) files the 11 ranked gaps as candidate items under #315, re-checking dedup against the
live backlog at file time.
