---
type: idea
workItem: task
parent: "912"
status: open
blockedBy: ["1029"]
dateOpened: "2026-06-19"
tags: []
---

# 6-response servePathIR conformance test for the FUI wrapper-serve endpoint

Assert all 6 enumerated servePathIR responses (200 hash-pin+ETag+SRI+producer / 302 floating->pin / 304 If-None-Match / 400 unknown-form / 404 / 500) against SERVE_PATH + maas-versioning, FUI-side. Demo: conformance suite green.
