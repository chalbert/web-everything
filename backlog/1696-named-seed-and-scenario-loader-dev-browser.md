---
kind: story
size: 5
parent: "142"
status: open
locus: plateau-app
blockedBy: ["1667"]
dateOpened: "2026-06-23"
tags: []
---

# Named seed and scenario loader (dev browser)

Build story for the named seed/scenario loader (#1647, ratified go — high debug value). One-click load named app states into the running app via the declared introspectable state model, and capture the live state as a new named scenario (round-trippable). Blocked by the capture/snapshot substrate (#1667 trace/replay); webstates is persistence, not the snapshot/restore-of-declared-state capability. Home plateau:dev-browser.
