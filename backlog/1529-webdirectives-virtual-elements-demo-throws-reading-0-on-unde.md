---
kind: task
status: resolved
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: "we:demos/webdirectives-virtual-elements-demo.ts"
tags: []
---

# webdirectives-virtual-elements demo throws 'reading 0' on undefined this.captured

`we:demos/webdirectives-virtual-elements-demo.ts` accesses `this.captured[0]` (line ~96) where `this.captured`
can be undefined (only set in one branch), throwing `Cannot read properties of undefined (reading '0')` at
runtime. The webdirectives plug files are byte-identical WE-local vs FUI, so this is a demo-internal bug
independent of the #1234 plug repoint that surfaced it. Fix: init `this.captured` or guard the access.
