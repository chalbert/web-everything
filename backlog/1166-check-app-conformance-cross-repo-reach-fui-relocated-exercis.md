---
kind: task
parent: "377"
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "we:scripts/check-app-conformance.mjs"
tags: []
---

# check:app-conformance cross-repo: reach FUI-relocated exercise apps

#823 relocated the exercise apps to `fui:demos/loan-origination`, but `we:scripts/check-app-conformance.mjs` still resolved the app under the WE root and read its `fui:demos/loan-origination/conformance.json` from there — so it could not score the relocated apps (the loop's scan + verify steps were dead cross-repo). Fix: decouple the app-root from the standards-root — standards still load from the WE root (correct, that's what we validate against) while the app lives wherever it is. Added `--app-root=<path>` plus an automatic fallback to `../frontierui` so the loop works without the flag; manifest + display paths resolve against the app repo. Verified loan-origination scores 92%.
