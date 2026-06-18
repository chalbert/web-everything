---
type: issue
workItem: story
size: 3
status: resolved
blockedBy: ["675"]
dateOpened: "2026-06-15"
dateStarted: "2026-06-15"
dateResolved: "2026-06-15"
graduatedTo: "block:background-task-surface"
relatedProject: webintents
tags: [background-task, durability, background-fetch, service-worker, verification, demo, e2e]
---

# Build the A′ durable-tier verification demo — real reloadDurabilityAdapter on a Vite origin under chromium-sw

Implement the A′ ruling from #675: a SW-registered demo page under demos/ (Vite :3000) that imports the real reloadDurabilityAdapter and a .sw.spec.ts running under the existing chromium-sw Playwright capability (serviceWorkers: 'allow', targeting :3000). Double ONLY the getRegistration().backgroundFetch manager; drive everything else against real browser primitives — real SW registration, real navigator.serviceWorker.ready via defaultGetRegistration, real isBackgroundFetchAvailable(), real forced-unavailable fallback re-arm. Assert registerDurableTransfer → hard-reload → rehydrateDurableTasks + the guard re-arm as a reproducible green. The true Background-Fetch network transfer surviving reload stays the documented manual residual (not asserted).

## Progress (2026-06-15, batch-2026-06-15) — A′ landed, both asserts green

- **Demo** `demos/durable-tier-verification/` — `we:index.html` hosts the real `<background-tasks durability="reload">`;
  `we:durable-tier-verification.ts` imports the **real** `reloadDurabilityAdapter`
  (`registerDurableTransfer`/`rehydrateDurableTasks`/`isBackgroundFetchAvailable`) and exposes a small
  `window.__durable` surface the spec drives. The **only** double is a `backgroundFetch` manager shadowed
  onto the real registration via `Object.defineProperty`, backed by `we:durable-sw.js` (a real classic SW that
  outlives the page, so a transfer survives the hard reload). `getRegistration` mirrors the adapter's own
  `defaultGetRegistration` (`navigator.serviceWorker.ready`) — it is not exported, so the one line is replicated.
- **Spec** `we:blocks/__tests__/e2e/durable-tier-verification.sw.spec.ts` (runs under the `chromium-sw`
  project, absolute :3000 URLs per the relaxed premise). **Green (2/2, real Chromium):**
  (1) real `bgFetchSupported === true` → `registerDurableTransfer` (`durable:true`) → `page.reload()` →
  `rehydrateDurableTasks` recovers `task-export` as a determinate entry; (2) forced-unavailable
  (`delete ServiceWorkerRegistration.prototype.backgroundFetch` via `addInitScript`) → real
  `isBackgroundFetchAvailable()===false` → adapter degrades (`durable:false, fallbackReason:'unsupported'`),
  the element re-arms via the `data-durability-fallback` observable.
- **Wiring/gate:** registered in `we:src/_data/demos.json` (check:demos green); `check:standards` 0 errors;
  the /demos/ 11ty index renders the new card.
- **Manual residual** (unchanged): a real Background-Fetch *network* transfer surviving reload — non-deterministic
  in automation — stays documented, not asserted.

## Migrated to FUI (2026-06-17, #697 WE-side cutover)

The durable-tier verification demo (`demos/durable-tier-verification/`) and its `.sw.spec.ts` were
**block-impl** artifacts of `background-task-surface` (a moved family). Per #791/#812/#813 they migrated UP
to Frontier UI: #813 hosts the demo on FUI, #816 added the FUI `chromium-sw` e2e lane. WE's local copies
were deleted in #697 and the durable surface is now surfaced in WE via the **`background-task-surface`
block's `fuiDemo`** iframe — hence `graduatedTo: block:background-task-surface` (the WE home that now
embeds the FUI-hosted durable demo), replacing the removed `demo:durable-tier-verification` target.
