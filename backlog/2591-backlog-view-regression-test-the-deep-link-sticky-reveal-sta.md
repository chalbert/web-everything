---
bornAs: xza531q
kind: task
parent: "2505"
status: open
dateOpened: "2026-07-20"
locus: plateau-app
tags: [plateau-loop, console, backlog-ui, test-coverage]
---

# Backlog-view: regression-test the deep-link sticky-reveal state machine (#2524)

#2524 fixed the deep-link scroll bug — a far-down selected row now survives the live overlay
re-render, and a user scroll/selection is never overridden by a later re-render. The fix is correct
on inspection but has **no regression test**: the state machine (`revealSelected`, `revealActiveRow`,
the `programmaticRailScroll` guard) lives inside `mount()`'s closure in
`plateau-app:src/backlog-view/backlog-view.ts`, and `plateau-app:src/backlog-view/backlog-view.test.ts`
only exercises pure render/helper exports — so the sticky-reveal behaviour rests on code-read, not a
guard. This task adds that missing coverage so the fix can't silently regress.

## Scope (plateau-app)
- Cover the re-reveal path: after a deep link to a far-down item, a background rail re-render (the
  overlay arriving) must **re-reveal** the active row, not reset `scrollTop` to 0.
- Cover the release paths: a manual rail scroll **and** a new selection each drop the sticky reveal
  (`revealSelected=false`), and a later re-render then **preserves** the reader's scroll position.
- Cover the self-scroll guard: the reveal's own programmatic scroll must not be mistaken for a user
  scroll (the `programmaticRailScroll` flag) and self-cancel.
- Do it without a heavy browser harness if the `mount()` seam allows — either extract the small
  reveal decision into a testable pure helper, or drive it through the existing jsdom mount. Extraction
  (if chosen) must not change behaviour.

## Acceptance
`plateau-app:src/backlog-view/backlog-view.test.ts` (or a sibling) exercises the three behaviours above
and fails if the #2524 fix is reverted; the suite stays green. No behaviour change to the shipped fix.

## Not in scope
- No new scroll/reveal behaviour — this is coverage for the shipped #2524 fix only.
- No virtualization work (#2513) — the reveal is independent of it.
