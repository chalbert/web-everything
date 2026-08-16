---
bornAs: x1l80ae
kind: story
size: 5
parent: "1650"
status: open
locus: plateau-app
dateOpened: "2026-08-15"
tags: [dev-browser, safe-edit, sandbox, epic-1650, live-preview, unprepared]
---

# Safe-edit sandbox: live preview against a running instance

Epic #1650 promised the developer can "see the effect immediately" — apply a proposed edit to an isolated, running instance before choosing discard/emit. None of the epic's 3 build slices (#3139 buffer, #3140 verify-gate, #3141 emit) ever applies buffer content to a live instance: the buffer is fs/DOM-free, the gate only checks conformance, and emit only writes the file post-gate. Tracked here rather than left implicit (flagged during #1355's review) so the epic isn't marked fully satisfied while live-preview is unshipped.

Needs its own prep pass — the mechanism is unscoped (likely a postMessage/HMR channel from the buffer to a running sandboxed instance) — before it is build-ready; the size above is a rough placeholder, not a prepared estimate.
