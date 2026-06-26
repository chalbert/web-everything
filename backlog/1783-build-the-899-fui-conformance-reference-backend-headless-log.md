---
kind: story
size: 8
status: open
dateOpened: "2026-06-26"
tags: []
---

# Build the #899 FUI conformance reference backend + headless-logic surface path (the #1294 un-park foundation)

The #899 behavioral-conformance decision (resolved 2026-06-18) ratified that runnable backends live in FUI and the WE site runs vectors against them — but never opened a build story, so the FUI reference backend and the headless-logic surface path the WE-website demo would repoint to do not exist. This is the foundation that un-parks #1294 (relocating the WE-resident logic reference runtimes): build the FUI conformance reference backend (mount/dispatch + clock impl per #899) and a mode-C / vector-runner path by which a WE-website conformance demo surfaces FUI headless logic with no build-time @frontierui import.
