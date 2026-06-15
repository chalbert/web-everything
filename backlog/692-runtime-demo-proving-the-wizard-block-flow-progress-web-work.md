---
type: issue
workItem: story
size: 3
parent: "651"
status: resolved
blockedBy: ["691"]
dateOpened: "2026-06-15"
dateStarted: "2026-06-15"
dateResolved: "2026-06-15"
graduatedTo: demos/wizard-flow-demo.html
tags: []
---

# Runtime demo proving the wizard Block + Flow Progress + Web Workflows compose end-to-end in a browser (webworkflows)

Slice B of #651 (blockedBy #691, slice A). Build the runtime demo proving the Web Workflows protocol + Flow Progress intent compose end-to-end. NEW demo page under demos/ mounting slice A's wizard Block (blocks/wizard/) against a real CustomWorkflowEngine graph; register in src/_data/demos.json (id/path/entry); add dev-server fallback; add an e2e/render check asserting step advance + back + aria-current. new-demo-class work (see /new-demo). Demoable: /demos/… renders a working wizard in a browser. Unblocks once #691 ships the Block element.

## Progress

- **2026-06-15 — built + verified.** New `demos/wizard-flow-demo.{html,ts,css}` mounts the `<wizard-flow>`
  Block (#691) against a real `CustomWorkflowEngine` 4-step checkout graph (cart → shipping → payment →
  review-final), with authored per-step content via `<template data-step-id>` and `setPlaygroundReady(1)`.
  Registered in `src/_data/demos.json` (id `wizard-flow-demo`, `path` + `liveUrl`, kind playground,
  projects webworkflows/webintents/webblocks, epic 651).
- **e2e:** `blocks/__tests__/e2e/wizard-flow-demo.spec.ts` drives the live page on :3000 — asserts the
  demoable claim end-to-end: initial `aria-current="step"` + "Step 1 of 4" + Back disabled; Next advances
  the engine (step 1→finish, step 2→process, current moves, "Step 2 of 4"); Back walks the engine history;
  run-to-completion lands on the final step and disables Next (engine `done`). **Passes.**
- **Dev-server fallback:** not applicable — this is a single static-file demo (`/demos/wizard-flow-demo.html`)
  with no client-side routing, so it is served directly; the `routerDemoFallback` plugin only rewrites
  deep links for base-path router-backed demos. Noted rather than added.
- **Gate:** `npm run check:standards` 0 errors; `eleventy --dryrun` build smoke clean (the demos.json
  edit renders); wizard unit suite already green from #691.

Unblocks once #691 ships the Block element — done; #691 resolved.
