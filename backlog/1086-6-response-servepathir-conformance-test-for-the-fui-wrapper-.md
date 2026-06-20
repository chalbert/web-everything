---
kind: task
parent: "912"
status: resolved
blockedBy: ["1029"]
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: blocks/renderers/module-service/__tests__/servePathConformance.test.ts
tags: []
---

# 6-response servePathIR conformance test for the FUI wrapper-serve endpoint

Assert all 6 enumerated servePathIR responses (200 hash-pin+ETag+SRI+producer / 302 floating->pin / 304 If-None-Match / 400 unknown-form / 404 / 500) against SERVE_PATH + maas-versioning, FUI-side. Demo: conformance suite green.
