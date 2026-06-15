---
type: idea
workItem: story
size: 2
parent: "479"
status: open
dateOpened: "2026-06-15"
tags: []
---

# web-features-backed BaselineLookup for the edge venue

Back the edge venue's injected BaselineLookup (capabilities/edge-io.ts:69) with real Baseline data: add the web-features npm package (data-only dep, no runtime lock-in), map a browser brand+version to the Baseline epoch (year) it meets, and unit-test the impl against the injection seam (mirror capabilities/__tests__/edge-io.test.ts:47). The impl direction is settled (edge-io.ts:20 names web-features; capability ids already borrow Baseline keys per #204) — no fork, just the install + mapping. Carved from #479.
