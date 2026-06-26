---
kind: story
size: 5
parent: "142"
status: open
locus: plateau-app
humanGate: { kind: review, short: "Interactively verify named-state load + live-state capture round-trip in the running dev-browser app.", what: "Acceptance is 'one-click load named app states into the RUNNING app and capture the live state as a new named scenario (round-trippable)' — a live dev-browser surface whose verification is hands-on interaction in the running app, not a headless unit check a serial batch can perform. The data blocker is clear: the capture/snapshot substrate #1667 (trace/replay) is now RESOLVED (the body's 'blocked by #1667' note is stale), so the snapshot capability is available — the residual is the interactive build-and-verify in a dev-browser session driving the running app." }
dateOpened: "2026-06-23"
tags: []
---

# Named seed and scenario loader (dev browser)

Build story for the named seed/scenario loader (#1647, ratified go — high debug value). One-click load named app states into the running app via the declared introspectable state model, and capture the live state as a new named scenario (round-trippable). Blocked by the capture/snapshot substrate (#1667 trace/replay); webstates is persistence, not the snapshot/restore-of-declared-state capability. Home plateau:dev-browser.
