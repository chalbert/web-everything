---
type: decision
workItem: story
size: 2
status: open
dateOpened: '2026-06-02'
tags:
  - backlog
  - meta
  - lifecycle
---

# Confirm backlog graduation vocabulary (graduatedTo)

Backlog items end two ways: an issue resolves (archives) or an idea graduates into a real entity (intent/block/protocol). Modeled here as status:resolved + graduatedTo:"intent:droplist" so the trail closes instead of forking. Confirm this is the lifecycle we keep.

## Progress
- **Status:** open — *decision is the user's to confirm*; the mechanism is already live. Verified 2026-06-06: `check:standards` enforces it (warns when a `status:resolved` item lacks `graduatedTo`), and ~30 resolved items already carry `graduatedTo` (e.g. `protocol:render-strategy`, `block:droplist`, file-path forms). So the lifecycle is de-facto adopted and in active use; only the explicit "keep this" sign-off is outstanding.
