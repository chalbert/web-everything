---
type: idea
workItem: story
size: 5
parent: "135"
status: open
dateOpened: "2026-06-06"
tags: [block, background-task, durability, background-fetch, service-worker, async, enhancement]
relatedProject: webintents
crossRef: { url: /blocks/background-task-surface/, label: Background Task Surface }
---

# Background Task Surface — reload-durable tier (durability:reload adapter)

The [Background Task Surface](/blocks/background-task-surface/) block (#128) ships a **route-only** baseline: a task survives SPA route changes (in-memory) but a full page reload or tab close loses in-flight work — the `navigationGuard: warn` prompt gates that loss rather than recovering from it.

This item is the **opt-in `durability: reload` tier**: work that genuinely survives a full reload/close, delegated to a service-worker adapter rather than baked into the baseline. Decided during #128 as native-first — the platform's durable answer is an enhancement, not the baseline dependency (the Background Task Intent borrows Background Fetch's vocabulary "without requiring a service worker").

Scope:
- The `withReloadDurability` trait wiring `durability: route → reload`.
- A [Background Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Background_Fetch_API) + service-worker adapter that registers the transfer, surfaces browser-provided progress, and re-hydrates the surface's entry on the next load.
- Rehydration: how a reload-surviving task reconnects to its surface entry and Loader state on the next page load (the handle that crossed the reload boundary).
- Graceful degradation where Background Fetch is unavailable (fall back to route-only + the navigation guard).

Open questions:
- Scope beyond fetches: the intent covers "any long task", but Background Fetch only durably models transfers. What is the durable story for non-fetch work (e.g. a long client-side computation)?
- Relationship to the navigation guard (#129): does arming `durability: reload` relax `navigationGuard: warn` (no need to warn if work survives the reload)?

Spun off from #128 (implementing the Background Task surface as a block).
