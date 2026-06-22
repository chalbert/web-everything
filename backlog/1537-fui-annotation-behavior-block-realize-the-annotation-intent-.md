---
kind: story
size: 5
parent: "1472"
status: resolved
blockedBy: ["1536"]
locus: frontierui
dateOpened: "2026-06-22"
dateResolved: "2026-06-22"
tags: []
---

# fui: annotation behavior block — realize the annotation intent over the anchor contract

FUI behavior block realizing the #1536 annotation intent: compose the resolved we:range-anchor/contract.ts, attach/render the 4 motivations (highlighting|commenting|tagging|suggestion) + overlay disposition, in-model mark when editable, anchor+popover surface, highlight-api path, and orphaned-annotation handling. Imports the anchor contract; WE holds zero impl (locus: frontierui).

## Progress

- `fui:blocks/annotation/AnnotationBehavior.ts` — the annotation runtime. UX-only: it owns the *what* (motivation payload + disposition + surface + orphan handling) and **delegates** the *where* to an injected `RangeAnchor` (the #1471 contract) — `annotate(range, spec)` serializes via the anchor, `resolveAll()` re-resolves each bundle.
  - **4 motivations** (`AnnotationPayload` discriminated by `motivation`): highlighting (no body), commenting (`comment`), tagging (`tags`), suggestion (`suggestion`).
  - **Disposition dispatch**: `highlight` paints via the CSS Custom Highlight API (reuses rich-text's `paintHighlight`, guarded — no-op where absent; the read-only overlay default); `inline-mark` wraps the range in a `<mark data-annotation-id data-motivation>` (in-model/editable surface only, composing rich-text marks); `popover`/`margin` mount an anchored `role=note` surface positioned off the range rect.
  - **Surface**: `overlay` (default `highlight`) vs `in-model` (default `inline-mark`).
  - **Orphan handling (first-class)**: `resolveAll` routes each bundle to `anchored` / `fuzzy` (with confidence) / `orphaned`; an orphan stops painting + drops its surface but is **retained and surfaced** via `orphans()` (the Hypothesis orphans-tray precedent), never an error or silent drop.
  - Scope boundary honoured: no anchor machinery (delegated), no positioning math (minimal rect placement; the anchor/positioning provider refines), no comment-thread product UI.
- Wired `@webeverything/contracts/range-anchor` into FUI `fui:tsconfig.json` paths + `fui:vitest.config.ts` alias. Registered the `annotation` block in `fui:src/_data/blocks.json`; added to `DEMO_PENDING` (a live demo needs a real browser — Custom Highlight API + range/popover geometry — and a `RangeAnchor` impl to anchor against; that interactive demo is a later slice).
- Unit tests `fui:AnnotationBehavior.test.ts` (8, stub anchor): serialize-via-anchor + anchored store, the 4 motivation bodies, inline-mark `<mark>` wrap, popover surface mount, orphan routing (retained/surfaced/un-painted), fuzzy + confidence, remove/destroy teardown, onChange. All green; FUI `check:standards` 0 errors.
