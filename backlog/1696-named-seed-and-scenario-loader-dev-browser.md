---
kind: story
size: 5
parent: "142"
status: open
locus: plateau-app
humanGate: { kind: review, short: "Spot-check debug UX + state-coverage after the automated round-trip test passes.", what: "The functional round-trip — load named state into the RUNNING app via the declared introspectable state model → mutate → capture as a new named scenario → reload → assert reproduced state — IS automatable as a Playwright conformance test, and should be built that way as the durable regression guard (that is the bulk of the work, not a human gate). The residual human judgment is narrow: (1) is the one-click loader ACTUALLY useful mid-debug (the item's whole justification is 'high debug value' — subjective, untestable); (2) does the declared state model capture the RIGHT surface — a round-trip assertion only checks the fields it was told about, so a human confirms nothing meaningful is silently dropped (scroll/focus/in-flight timers/un-introspected provider context); (3) perceptual 'loaded state looks right on screen'. So the gate shrinks to a ~2-minute spot-check on top of a green automated test, not a from-scratch manual verification. Data blocker is clear: the capture/snapshot substrate #1667 (trace/replay) is now RESOLVED (the body's 'blocked by #1667' note is stale)." }
dateOpened: "2026-06-23"
tags: []
---

# Named seed and scenario loader (dev browser)

Build story for the named seed/scenario loader (#1647, ratified go — high debug value). One-click load named app states into the running app via the declared introspectable state model, and capture the live state as a new named scenario (round-trippable). The capture/snapshot substrate (#1667 trace/replay) it needs is now RESOLVED — no longer blocked; webstates is persistence, not the snapshot/restore-of-declared-state capability. Home plateau:dev-browser.
