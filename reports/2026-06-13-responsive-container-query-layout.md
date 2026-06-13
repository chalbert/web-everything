# Responsive / container-query layout — placement prep (#467)

**Date:** 2026-06-13 · **Item:** [#467](../backlog/467-responsive-container-query-layout-placement-new-project-vs-i.md) · **Research topic:** [`responsive-container-query-layout`](/research/responsive-container-query-layout/) · **Parent epic:** [#111](../backlog/111-book-further-candidate-standards.md)

## Why

`#111` triage flagged the book candidate *"constraint-based / container-query responsive layout"* (FlexRow, ResizeObserver, container vs media queries) as the one gap with no obvious home, and promoted it to decision `#467`: new `weblayout` project vs new intent vs fold into `webpositioning`. This prep runs the prior-art survey ahead of the call.

## What the survey changed

The framing collapsed. Two existing intents already model most of the concern:

- **`breakpoint`** (draft) — `strategy` (mobile-first/desktop-first/strict-range) + semantic `steps` (compact/medium/expanded), description already says steps map to "media/container queries".
- **`layout`** (concept) — app-shell regions (shell/pane/dock, push/overlay/rail).

So two of the three original options fall out immediately:
- **Not a project** — no provider seam / interchange schema / vendor-interop contract; pure UX composition. Same `#409` "not every gap is a project" discipline.
- **Not `webpositioning`** — that anchors floating elements to a reference; orthogonal.

Web-platform grounding (2026): CSS container size queries Baseline since 2023 (`container-type: inline-size`, `@container`, `cqi`/`cqw`); style queries Chrome-only; scroll-state queries Chrome Dec 2025; ResizeObserver = imperative substrate. Industry: Material 3 Window Size Classes (compact/medium/expanded/large/extra-large) + Canonical Layouts = the vocabulary `breakpoint` already borrows.

## Recommendation carried into #467

1. **No new project, no new intent** — extend `breakpoint`, leave `layout` as-is.
2. **Add `scope: viewport | container`** dimension to `breakpoint` (same steps + `change` event; only the reference frame differs → a dimension, not a split).
3. **Defer a FlexRow `webblocks` block** — intrinsic auto-flow container realizing `breakpoint scope:container`; `@container`/`flex-wrap` native-first default, ResizeObserver as impl substrate.

The one genuine judgment fork the decider owns: **Fork 2 (scope as a dimension of `breakpoint` vs a separate intent)** — recommended as a dimension (medium confidence).
