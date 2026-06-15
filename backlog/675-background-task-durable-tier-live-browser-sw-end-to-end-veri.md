---
type: issue
workItem: task
status: open
blockedBy: ["134", "684"]
dateOpened: "2026-06-15"
relatedProject: webintents
tags: [background-task, durability, background-fetch, service-worker, verification, demo]
---

# Background Task durable tier — live-browser/SW end-to-end verification

Verify the #134 durability:reload tier end-to-end in a real browser: register a service worker, arm a Background Fetch transfer, hard-reload, and assert the surface re-hydrates the in-flight task (and that the navigation guard re-arms when Background Fetch is unavailable). The unit harness (happy-dom/Playwright) cannot exercise a real SW + Background Fetch, so this is the SW-registered demo page that closes the durability claim #134 deliberately did not assert.

**Blocked on its test harness (#684).** Per the agent-runnable-verification rule (`docs/agent/testing.md`), this verification cannot be *correctly tested* until the real-Chromium SW + Background Fetch E2E lane exists — `blockedBy: ["684"]`. Build the demo page against that lane so the rehydration assertion is a reproducible green, not an eyeballed claim.
