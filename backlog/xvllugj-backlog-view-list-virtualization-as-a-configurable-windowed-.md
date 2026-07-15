---
kind: story
size: 8
status: open
dateOpened: "2026-07-15"
tags: [plateau-loop, console, backlog-ui, standards]
---

# Backlog-view list virtualization as a configurable windowed-collection strategy

Make list virtualization a **configurable strategy**, not a single baked-in choice. #2513 shipped the native default — `content-visibility: auto`, which skips layout/paint of off-screen rows while keeping every row in the DOM (so selection, count, in-page find, and keyboard focus behave as if the whole list were present). That default is correct for lists in the thousands, but it still holds N DOM nodes and does O(N) style/box work; a list in the tens of thousands wants **true JS windowing** (render only the visible slice, sized spacer), which trades those native behaviors for a tiny node count and must re-implement focus / find / scroll-to to compensate.

This is the shape the constellation already models: the `windowed-collection` capability (see `we:reports/2026-06-21-progressive-load-composition.md` and `we:reports/2026-06-03-pagination-standard-research.md`) owns virtualization + end-of-list a11y as a **dimension** of `pagination`. So the two approaches are the native-first default and an opt-in strategy of one axis, resolved per project — the `config-extends-platform-default` pattern, not an arbitrary code fork.

Scope: define the virtualization strategy as a selectable dimension in WE (native `content-visibility` default + a `js-windowing` strategy), implement the windowing strategy in Frontier UI, and let a project select it — without the product surface re-deciding. The backlog console keeps the native default; this is the standards-layer work that makes the second strategy reachable when scale demands it.

**Acceptance:** the virtualization strategy is a named dimension with a native-first (`content-visibility`) default and a reachable `js-windowing` strategy; the windowing strategy is implemented in FUI and preserves the windowed-collection acceptance behaviors (row selection, whole-list count, keyboard focus, scroll-to); a surface selects the strategy via config, not a code change to the list itself.
