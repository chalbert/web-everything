---
kind: decision
size: 2
status: resolved
blockedBy: ["134", "684"]
dateOpened: "2026-06-15"
dateStarted: "2026-06-15"
dateResolved: "2026-06-15"
graduatedTo: none
codifiedIn: "one-off"
relatedProject: webintents
tags: [background-task, durability, background-fetch, service-worker, verification, demo]
---

# Background Task durable tier — live-browser/SW end-to-end verification

Verify the #134 durability:reload tier end-to-end in a real browser: register a service worker, arm a Background Fetch transfer, hard-reload, and assert the surface re-hydrates the in-flight task (and that the navigation guard re-arms when Background Fetch is unavailable). The unit harness (happy-dom/Playwright) cannot exercise a real SW + Background Fetch, so this is the SW-registered demo page that closes the durability claim #134 deliberately did not assert.

**Blocked on its test harness (#684).** Per the agent-runnable-verification rule (`we:docs/agent/testing.md`), this verification cannot be *correctly tested* until the real-Chromium SW + Background Fetch E2E lane exists — `blockedBy: ["684"]`. Build the demo page against that lane so the rehydration assertion is a reproducible green, not an eyeballed claim.

## Surfaced fork — verification approach (2026-06-15, batch-2026-06-15; refined 2026-06-15)

Claimed in a batch, released unworked on an approach fork; re-examined against the now-resolved #684 lane.
The fork is **narrower than first framed** — two verified facts collapse the original A/B/C into a clean
2-way, and a third fact pins down a piece that's irreducible in *every* option:

- **#684 already proved the generic SW-rehydrate mechanism.** `we:service-worker-rehydrate.sw.spec.ts` drives
  register → arm → hard-reload → rehydrate green, but against a **plain-JS fixture** (`sw-fixtures/public/
  we:index.html`) that *re-implements* the durable contract — it never runs the real TS. So #675's **only**
  distinct job is to make the real `reloadDurabilityAdapter` the unit under test. (This kills the old
  option B — re-implementing the contract in JS just re-does #684 — and demotes old option C, which is real
  but proves little past the existing unit tests.)
- **The Background-Fetch double is irreducible in both branches.** Background Fetch *is* present in Chromium
  (`'backgroundFetch' in ServiceWorkerRegistration.prototype` is `true` on `:3210`), but a real network
  transfer surviving reload is non-deterministic in automation — which is exactly why #684 used a Map-backed
  SW, and why this adapter's own "NOTE ON VERIFICATION" lists true-network survival as a manual residual.
  So a deterministic spec **must** double the `getRegistration().backgroundFetch` manager regardless of
  origin. True-network-transfer survival stays the documented manual residual in every option.
- **The #684 static server can't transform TS.** `we:sw-fixtures/serve.mjs` is a zero-dep `node:http` static
  server — to run the *real* adapter on it you must compile-emit the adapter into `public/` first.

**The fork (pick where the real adapter runs — the Background-Fetch double is thin and identical in both):**

- **A′ — Real adapter on a Vite origin (recommended).** New SW-registered page under `demos/` (Vite :3000)
  imports the *real* `reloadDurabilityAdapter`; register a SW at the page's scope; double **only** the
  `getRegistration().backgroundFetch` manager. Everything else is the real adapter against real browser
  primitives: real SW registration, real `navigator.serviceWorker.ready` via `defaultGetRegistration`, real
  `isBackgroundFetchAvailable()` against the real prototype, real forced-unavailable fallback re-arm. Assert
  `registerDurableTransfer` → hard-reload → `rehydrateDurableTasks` + the guard re-arm. Runs under the
  existing `chromium-sw` capability (`serviceWorkers: 'allow'`) — that Playwright *project*, not the static
  origin, is the reusable lane; the spec targets :3000. The adapter's own NOTE already points verification
  at "the block's demo (a SW-registered page exercised in a live browser)", so a `demos/` page is its natural
  home and doubles as living documentation, with zero build machinery (Vite serves the real TS).

- **D — Build the real adapter onto the #684 static lane.** esbuild/tsc the real adapter into the existing
  fixture's `public/`, reuse `we:sw.js` + `we:rehydrate-helper.ts` unchanged. Honours "against that [#684] lane"
  literally and keeps one SW surface. Cost: a compile-emit step + the emitted-JS tree-pollution footgun (cf.
  `build:plugs` shadow-emit). Same thin Background-Fetch double as A′.

**Recommendation: A′.** Both make the real adapter the unit under test and both keep the true-network piece
as the documented manual residual — so the call is "Vite-origin demo page (no build step, doubles as docs)"
vs "compile onto the static lane (literal 'against that lane', one surface)". A′ wins on no build machinery,
no tree-pollution footgun, and landing the adapter in its documented demo home. The only thing to relax from
the original premise: "against that [#684] *static origin*" → "under the #684 SW-e2e *capability*, on a Vite
origin". Ratify A′ before building.

## Ruling (2026-06-15) — A′

**Ratified: A′ — verify the real `reloadDurabilityAdapter` on a Vite origin.** Build a SW-registered demo
page under `demos/` (Vite :3000) that imports the *real* adapter; double **only** the
`getRegistration().backgroundFetch` manager; drive everything else against real browser primitives (real SW
registration, real `navigator.serviceWorker.ready` via `defaultGetRegistration`, real
`isBackgroundFetchAvailable()`, real forced-unavailable fallback re-arm). The `.sw.spec.ts` runs under the
existing `chromium-sw` Playwright capability (`serviceWorkers: 'allow'`), targeting :3000 — the project, not
the static `:3210` origin, is the reusable lane.

Premise relaxed as agreed: "against that [#684] *static origin*" → "under the #684 SW-e2e *capability*, on a
Vite origin". The true Background-Fetch network transfer surviving reload stays the **documented manual
residual** (per this adapter's NOTE + #684's spec comment) — not asserted by the spec.

Build is now agent-ready → carved to **#708** (`blockedBy: 675`, now satisfied). This decision item is
resolved.
