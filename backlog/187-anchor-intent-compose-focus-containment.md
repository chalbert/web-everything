---
type: idea
workItem: task
status: resolved
parent: "013"
dateOpened: "2026-06-08"
dateResolved: "2026-06-08"
graduatedTo: "src/_data/intents.json — reciprocal Anchor ↔ Focus-Containment cross-link (wording-only)"
tags: [intent, a11y, focus, anchor]
---

# Cross-link the Anchor intent to Focus Containment for modal-mode surfaces

The `focus-containment` intent (added in #013) names the [Anchor Intent](/intents/anchor/) as a
composer — a modal-mode popover or menu adopts containment (trap + `inert`) when it opens. That link
is currently **one-directional**: the Anchor intent's description doesn't mention focus containment.

Add a reciprocal reference in the Anchor intent's "Composition" prose (`src/_data/intents.json`,
`anchor` entry) pointing at `/intents/focus-containment/` for surfaces whose `mode` is modal, so the
relationship is discoverable from both pages. No new dimensions — wording only.

## Progress

- **Status:** resolved
- **Branch:** docs/standard-authoring-workflow
- **Done:** Added the reciprocal link in the Anchor intent's `modal` dismissal bullet
  (the section that owns modal-mode behavior — Anchor has no separate "Composition" section):
  it now states the trap + `inert` + focus-return mechanics are not redefined there and that a
  modal-mode surface composes the [Focus Containment Intent](/intents/focus-containment/). The
  relationship is now discoverable from both pages. `check:standards` green (0 errors).
- **Next:** —
- **Notes:** Wording-only, no new dimensions. No leftovers.
