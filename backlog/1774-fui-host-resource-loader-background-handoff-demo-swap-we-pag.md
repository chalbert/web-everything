---
kind: story
size: 5
parent: "1353"
status: resolved
dateOpened: "2026-06-24"
dateStarted: "2026-06-24"
dateResolved: "2026-06-24"
graduatedTo: frontierui/demos/loader-background-handoff-demo.html
relatedProject: webblocks
tags: [frontierui, demos, blocks, fui-build-gate]
---

# FUI-host resource-loader background-handoff demo, swap WE page to #701 iframe, delete we:blocks/resource-loader handoff

The FUI-build gate cleared: #1766 ported the producer-side handoff
(`backgroundLoad` + `ResourceLoaderHandle` + `reportProgress` + the reference
receiver + fixtures) into `fui:blocks/resource-loader/`, so FUI is now canonical
for the whole resource-loader family. This is the demo-swap+delete tail: build a
self-bootstrapping `fui:demos/loader-background-handoff-demo.html` (escalate /
fast / error+retry / determinate-progress scenarios over the reference receiver),
swap `we:demos/loader-background-handoff-demo.{html,ts}` to a #701 `fuiDemo`
iframe, then delete the WE runtime copies
`we:blocks/resource-loader/{backgroundHandoff,handoffContract}.ts` + the handoff
`__fixtures__` (WE keeps only the contract + conformance vectors). Mirrors the
#1355 / #1531 pattern under #1353.
