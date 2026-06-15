---
type: issue
workItem: story
size: 3
status: open
blockedBy: ["675"]
dateOpened: "2026-06-15"
relatedProject: webintents
tags: [background-task, durability, background-fetch, service-worker, verification, demo, e2e]
---

# Build the A′ durable-tier verification demo — real reloadDurabilityAdapter on a Vite origin under chromium-sw

Implement the A′ ruling from #675: a SW-registered demo page under demos/ (Vite :3000) that imports the real reloadDurabilityAdapter and a .sw.spec.ts running under the existing chromium-sw Playwright capability (serviceWorkers: 'allow', targeting :3000). Double ONLY the getRegistration().backgroundFetch manager; drive everything else against real browser primitives — real SW registration, real navigator.serviceWorker.ready via defaultGetRegistration, real isBackgroundFetchAvailable(), real forced-unavailable fallback re-arm. Assert registerDurableTransfer → hard-reload → rehydrateDurableTasks + the guard re-arm as a reproducible green. The true Background-Fetch network transfer surviving reload stays the documented manual residual (not asserted).
