---
kind: story
size: 3
parent: "1472"
status: resolved
blockedBy: ["1537"]
locus: frontierui
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: "@frontierui/demos/annotation-demo.html"
tags: []
---

# fui: annotation demo — highlight + comment over read-only HTML, live-verified

Fixture-driven demo for the #1537 annotation behavior block: select text in read-only HTML -> highlight + attach a comment, exercising the motivation payloads + overlay disposition. Live-verify on the FUI dev server (locus: frontierui).

## Resolved (batch-2026-06-22-1545-1549)

`fui:demos/annotation-demo.html` + `fui:demos/annotation-demo.ts` — drives the real `AnnotationBehavior`
(#1537) over a demo-local TextPosition+TextQuote durable anchor (no range-anchor impl ships yet). Select
read-only article text → highlight / comment / tag (the motivation payloads), painted via the CSS Custom
Highlight API (the `highlight` overlay disposition); `Re-resolve` surfaces anchored / fuzzy / first-class
orphaned. **Live-verified on :3001**: scripted self-test 4/4, `we-annotation` highlight painted in real
Chromium, interactive selection→highlight adds a row, 0 console errors. Auto-registers in `/demos/`.
frontierui `check:standards` 0 errors.
