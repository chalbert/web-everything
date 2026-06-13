---
type: idea
workItem: story
size: 5
parent: "315"
status: resolved
dateStarted: "2026-06-12"
dateOpened: "2026-06-12"
dateResolved: "2026-06-12"
graduatedTo: block:dialog
tags: []
---

# Author the abstract dialog block (dialog family substrate)

Author the abstract dialog block — the substrate every dialog-based surface conforms to (centered modal, edge drawer, bottom sheet), owning the shared modal-surface machinery: focus containment, escape/outside/backdrop dismissal, scroll-lock, and the native-first top-layer mount (`<dialog>.showModal` / Popover API). Implements the Modal Intent (placement center/top/bottom/start/end/fill). The droplist-family pattern applied to dialogs (droplist:dropdown :: dialog:drawer). Resolves the finding that WE has a Modal intent + native `<dialog>` but no dialog block. Decided in #360. Concrete members (drawer, sheet, modal) extend it.

## Outcome (2026-06-12)

Authored the abstract `dialog` block — the dialog family substrate (status `draft`, type Component,
`implementsIntent: modal`, composes focus-containment/surface/motion, events `dialog-opened`/`-closed`).
The droplist-family pattern applied to dialogs: it owns the shared modal-surface machinery (focus
containment, escape/outside/backdrop dismissal, scroll-lock, modal/non-modal mode, native-first top-layer
mount on `<dialog>.showModal()` + Popover API) so concrete members never re-implement it. 5 design
decisions (family-substrate-not-widget · family-vs-members · native `<dialog>`-first · mode owned here ·
implementsIntent convention). `blocks.json` + `block-descriptions/dialog.njk` (member table, Web Standards
table, what-the-substrate-owns, contract, family-vs-members) + semantics term *Dialog (family substrate)*.
Coverage data: `dialog` highlight now cites block:dialog. `check:standards` green; page at `/blocks/dialog/`.
**Unblocks #360** (drawer = the edge-placement concrete member).
