---
type: idea
workItem: story
size: 8
parent: "135"
status: resolved
blockedBy: ["128", "135"]
dateOpened: "2026-06-06"
dateStarted: "2026-06-15"
dateResolved: "2026-06-15"
graduatedTo: "blocks/background-task-surface durability:reload tier — durability config dimension (types.ts) + withReloadDurability trait + reloadDurabilityAdapter.ts (Background Fetch + SW register/rehydrate) + observable guard re-arm in BackgroundTasksElement.ts; live-browser verification → #675"
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

Open questions → **resolved by decision [#450](/backlog/450-background-task-reload-durability-scope-beyond-fetches-navig/) (2026-06-13)**, which clears this item's `450` blocker edge. Rulings + build constraints this item must honor:

1. **Scope = transfer-backed durable *execution* only.** `durability: reload` is defined solely against Background Fetch + the SW adapter. Non-fetch long tasks stay route-only + the navigation guard. **Shipped config enum stays `route | reload`** — `durability: resumable` (durable *state*: checkpoint/resume) is a **reserved future term in docs, not a shipped value** (do not add it to the enum here).
2. **Guard relaxation.** Arming `durability: reload` relaxes `navigationGuard: warn` by default (author may force it on). Where Background Fetch is unavailable and the tier degrades to route-only, the guard **re-arms** (fixed mechanic). `durability` and `navigationGuard` stay independent dimensions — durability *derives* the guard default, never merges with it.
3. **Build constraint (from #450 amendment 2).** Because the re-arm depends on runtime availability, the surface must **feature-detect Background Fetch at arm-time** and make the re-arm **observable** (the guard visibly re-engages on the route-only fallback path).

Still owed before this is fully agent-ready: a real-browser/SW **verification strategy** for the durability claim (pre-flight point 2 below) — a build-harness concern, not a fork.

Spun off from #128 (implementing the Background Task surface as a block).

## Progress

- **2026-06-15 — built (in-harness slice) + adapter coded.** Shipped on the
  [Background Task Surface](/blocks/background-task-surface/) block (webintents):
  - **`durability` config dimension** (`route | reload`, default `route`) on `BackgroundTasksConfig` +
    `DEFAULT_CONFIG` ([we:types.ts](../blocks/background-task-surface/types.ts)); enum stays `route | reload`
    (`resumable` reserved in docs only, per #450 ruling 1). Read from the `durability` attribute; unknown
    values fall back to `route`.
  - **`withReloadDurability` trait** ([fui:traits/withReloadDurability.ts](../blocks/background-task-surface/traits/withReloadDurability.ts))
    wiring `route → reload`, with cleanup reverting to baseline.
  - **Guard derivation + observable fallback re-arm** in
    [fui:BackgroundTasksElement.ts](../blocks/background-task-surface/BackgroundTasksElement.ts): `durability`
    *derives* the navigation-guard default (relaxed when durable + available; author may force on) and the
    tier **feature-detects Background Fetch at arm-time** (#450 ruling 3), degrading to route-only and
    **re-arming the guard observably** (`data-durability-fallback`) when unavailable.
  - **Background Fetch + service-worker adapter**
    ([fui:reloadDurabilityAdapter.ts](../blocks/background-task-surface/reloadDurabilityAdapter.ts)):
    `isBackgroundFetchAvailable`, `registerDurableTransfer` (registers a Background Fetch transfer),
    `rehydrateDurableTasks` (recovers in-progress transfers on the next load and maps each to a surface
    register detail — the reconnect-to-surface-entry seam). All paths degrade gracefully (never throw on
    an unsupported browser).
  - **Tests:** 12 new in-harness tests
    ([fui:reloadDurability.test.ts](../blocks/__tests__/unit/background-task-surface/reloadDurability.test.ts)) —
    config dimension, trait, feature detection, the durability-derived guard + observable fallback, and
    adapter degradation/registration/rehydration with stubbed Background Fetch. 30/30 block tests green.
  - **Verification strategy (pre-flight point 2).** The trait/config/feature-detection/graceful-degradation
    layer is fully unit-verified here. The headline claim — work that *actually* survives a real reload —
    rides on a registered service worker + Background Fetch that neither vitest (happy-dom) nor the
    Playwright setup exercises; end-to-end durability is verified by a SW-registered live-browser demo,
    scaffolded as a follow-up (see below). Shipping the adapter without that path would overclaim, so it is
    explicitly carried, not asserted done.

## Pre-flight note (2026-06-10 — deferred from a batch, resized 5 → 8)

Claimed during a batch, then released on a closer read. The first reason has since been resolved;
one build concern remains:

1. ~~**Unresolved design fork (no lean).**~~ **Resolved by decision #450 (2026-06-13)** — the
   non-fetch fork is closed: the durable tier is bounded to transfers (Background Fetch), the enum
   stays `route | reload`, and the re-arm must feature-detect Background Fetch at arm-time (see the
   rulings block above). No design fork remains.
2. **Core claim is unverifiable in this harness.** The headline value — work that *actually* survives a
   full reload/close — rides on a service worker + the Background Fetch API, which neither the vitest
   (happy-dom) nor the Playwright setup here exercises. Only the trait/config/feature-detection/
   graceful-degradation layer is in-harness testable; shipping the durability adapter as "done" without
   a real-browser/SW verification path would overclaim.

To make it batchable: define a real-browser/SW verification strategy for the durability claim (the
non-fetch fork is already resolved by #450). The trait + `durability` config
dimension + degradation-to-route-only is the verifiable sub-slice if a smaller item is wanted.
