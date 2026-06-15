---
type: decision
workItem: story
size: 2
status: open
blockedBy: ["134", "684"]
dateOpened: "2026-06-15"
relatedProject: webintents
tags: [background-task, durability, background-fetch, service-worker, verification, demo]
---

# Background Task durable tier — live-browser/SW end-to-end verification

Verify the #134 durability:reload tier end-to-end in a real browser: register a service worker, arm a Background Fetch transfer, hard-reload, and assert the surface re-hydrates the in-flight task (and that the navigation guard re-arms when Background Fetch is unavailable). The unit harness (happy-dom/Playwright) cannot exercise a real SW + Background Fetch, so this is the SW-registered demo page that closes the durability claim #134 deliberately did not assert.

**Blocked on its test harness (#684).** Per the agent-runnable-verification rule (`docs/agent/testing.md`), this verification cannot be *correctly tested* until the real-Chromium SW + Background Fetch E2E lane exists — `blockedBy: ["684"]`. Build the demo page against that lane so the rehydration assertion is a reproducible green, not an eyeballed claim.

## Surfaced fork — verification approach (2026-06-15, batch-2026-06-15)

Claimed in a batch; surfaced an approach fork during pre-flight and released unworked. The item's premise
("build the demo page *against that [#684] lane* so the rehydration assertion is a reproducible green") is
in tension with three verified facts:

- **The #684 lane is a static server.** `plugs/__tests__/e2e/sw-fixtures/serve.mjs` is a zero-dep
  `node:http` static file server (no Vite/TS transform). It **cannot serve the real TS
  `reloadDurabilityAdapter.ts`** — a fixture *on that lane* can only re-implement the adapter's calls in
  plain JS (a double of the contract, not the real unit), which largely duplicates #684's generic fixture.
- **Background Fetch *is* present in the lane** (verified: `'backgroundFetch' in
  ServiceWorkerRegistration.prototype` is `true` on `http://localhost:3210` in Playwright's Chromium) — so
  `isBackgroundFetchAvailable()` returns true; this is **not** the blocker first assumed.
- **A real Background-Fetch network transfer surviving reload is already the documented manual residual**
  (#684's spec comment + this adapter's own "NOTE ON VERIFICATION"). Headless Chromium won't reliably
  complete + rehydrate a real transfer, which is why #684 used a Map-backed SW.

**The fork (pick the verification fidelity + origin):**
- **A — Real adapter on a Vite origin + deterministic Background-Fetch double.** SW-registered page under
  `demos/` (Vite :3000) imports the *real* `reloadDurabilityAdapter`; register a SW at `/demos/` scope;
  inject a SW-backed `getRegistration` whose `.backgroundFetch` is a deterministic manager double; assert
  the real `registerDurableTransfer` → hard-reload → `rehydrateDurableTasks` cycle + the forced-unavailable
  guard re-arm. Deviates from "against that [#684] lane"; tests the real unit; true network-transfer
  survival stays the documented manual residual.
- **B — Plain-JS fixture on the #684 static lane.** A `public/` fixture calling the real
  `backgroundFetch.fetch/getIds/get` API directly (mirroring the adapter's contract in JS) + the
  `__forceNoBgFetch` fallback, driven by the existing `rehydrate-helper`. Honours "against that lane" but
  does **not** execute the real TS adapter — close to re-doing #684.
- **C — Scope to fallback-only + residual.** Assert only the real adapter's fallback re-arm (real, no
  doubles) as the reproducible green; declare durable-survival the (already-documented) manual residual.

**Recommendation: A** — the only option that makes the *real* adapter the unit under test while keeping a
reproducible green, with the irreducible true-network piece staying the documented manual residual. Needs a
ratify before building (relax "against that lane" → "in the SW-e2e capability, on a Vite origin").
