---
kind: story
size: 3
parent: "2346"
status: resolved
blockedBy: ["2341"]
dateOpened: "2026-07-09"
dateStarted: "2026-07-09"
dateResolved: "2026-07-09"
graduatedTo: "plateau:packages/extensions/"
tags: []
---

# Extract packages/extensions — pull the chrome-extension up into its own workspace package

Promote the browser-extension production out of plateau:src/dev-browser/chrome-extension/ into a top-level plateau:packages/extensions as @plateau/extensions. It currently sits nested under dev-browser but is a distinct deliverable with its own manifest, build, and packaging story; lifting it up gives it an independent package boundary while still depending on @plateau/core for the conformance probe.
