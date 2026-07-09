---
kind: task
status: open
dateOpened: "2026-07-09"
tags: []
---

# plateau conformance build entry references an embed file deleted by #2341

plateau-app build entry plateau:conformance.html still loads plateau:src/conformance-engine/conformanceEmbed.ts, but #2341 (commit 1b78f55, conformance-engine extraction to core-shared) deleted that file and the whole plateau:src/conformance-engine/ dir. So a production vite build fails resolving plateau:src/conformance-engine/conformanceEmbed.ts (the build-html step) — plateau main is red at the build gate (dev server + other entries still work). Fix: repoint the entry at the extracted core-shared embed per #2341, or drop the stale entry. Found while working #640 (the build gate was unusable for verification, forcing dev-server runtime checks instead). Pre-existing, unrelated to #640.
