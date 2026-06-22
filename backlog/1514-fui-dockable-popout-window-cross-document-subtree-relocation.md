---
kind: story
size: 3
parent: "1485"
locus: frontierui
status: resolved
blockedBy: ["1512"]
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: "@frontierui/blocks/dockable/popoutDockable.ts"
tags: []
---

# FUI dockable popout: window — cross-document subtree relocation

Slice of #1485 (locus:frontierui, deferred/highest-risk — #1437 Fork 3a popout=window): relocate a live panel/stack subtree into a separate OS window via window.open() + adoptedStyleSheets. Breaks moveBefore (cannot move across documents) and the single-document live-region/roving-tabindex wiring — the irreducible reason this is the last, riskiest dimension. blockedBy #1512 (drag-to-dock).

## Resolved (batch-2026-06-22-1545-1549)

`fui:blocks/dockable/popoutDockable.ts` — `popoutToWindow` / `popoutPanel` relocate a panel/stack subtree
into a separate OS window. The irreducible hard parts are handled: `document.adoptNode` does the
cross-document move `moveBefore` can't (#1437); a comment placeholder holds the original slot for exact
re-dock; constructed stylesheets are re-created in the popout doc from cssText; and the per-window
custom-element registry (a relocated `we-tabs` loses its definition) is re-hydrated by the host via an
`onDocument` hook (#809 separation). `window.open` is an injectable seam so the relocation mechanics are
unit-tested (7 tests green, `fui:blocks/__tests__/unit/dockable/popoutDockable.test.ts`); the literal OS
popup is environmental and not gate-verifiable. frontierui `check:standards` 0 errors. Exported from the
dockable barrel.
