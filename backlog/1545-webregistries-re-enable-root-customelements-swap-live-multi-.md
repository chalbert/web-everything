---
kind: story
size: 3
parent: "1483"
status: resolved
locus: frontierui
dateOpened: "2026-06-22"
dateResolved: "2026-07-09"
graduatedTo: "fui:plugs/webregistries/index.ts (root swap re-enabled)"
tags: []
---

# webregistries — re-enable root customElements swap + live multi-app verification

Uncomment the root redefine(window, 'customElements', new CustomElementRegistryImpl()) in fui:plugs/webregistries/index.ts (~line 95); live-verify plateau-app (:4000) + WE site (:3000) + FUI demos render with no *-is-not-a-function upgrade crash, owning the dev-server lifecycle (the reason 4 batch pre-flights declined it). WE-site clean read may need anchor bug #1503 fixed first. No we:plugs byte-replicate — #1047 deleted that copy; the fix is FUI-only now. Blocked by the #1544 determination path being implemented + unit-proven.

## Re-enable attempt 2026-06-22 — FAILED, blocked on a #1544 mechanism gap

Re-enabled the root swap wired to `setRootScope(document)` (#1544); FUI gate green (63/63
webregistries unit tests). Live-verified all three apps in a real browser (Playwright, fresh page
loads — the source-aliased plug needs no server restart):

- **WE site :3000** ✓ renders, no crash.
- **FUI demos :3001** ✓ renders, no crash.
- **plateau :4000** ❌ **blank page.** `route-view` *did* upgrade to the real `RouteViewElement`
  (the #1544 prototype-swap ran), then threw **`Cannot write private member #routes to an object
  whose class did not declare it`**. Proven causal: reverting the swap → plateau renders (body 816),
  zero errors.

**Root cause (not a wiring bug):** #1544's upgrade does `Object.setPrototypeOf(el, RealClass.prototype)`
+ copies *own keys* from a fresh instance. But `#`-private fields are installed only by the real
constructor — they are not own-keys, and `setPrototypeOf` never installs them. Any root element whose
class uses private fields (`RouteViewElement.#routes`) gets the real prototype but no private slots, so
its reaction crashes. The empty-stand-in + prototype-swap strategy cannot replicate native
upgrade-on-define for private-field classes.

**This blocks #1545 and is a defect in the #1544 approach, not #1545.** Recommended fix direction (a
decision for #1483/#1544): at the *root* document scope there is exactly one class per tag (no scope
conflict), so the root registry should **delegate `define()` to the native registry (define the REAL
class natively)** and let the browser's native upgrade install private fields correctly — reserving the
stand-in/determination path for genuinely-scoped (shadow) registries. Needs a card before #1545 can be
re-attempted.

## RESOLVED 2026-07-09 — root swap re-enabled (FUI PR #25, merged)

The recommended fix direction landed as **#1593** (native-delegate): at root scope the registry's
`define()` defines the REAL class natively, so the browser's native upgrade-on-define constructs
already-parsed autonomous elements with the real constructor (installing `#private` fields). With #1593
in `main`, this slice re-enabled the swap:

- **`fui:plugs/webregistries/index.ts`** — uncommented `applyPatches()` step 3: root `window.customElements`
  is now a `CustomElementRegistryImpl` in root-scope mode (`setRootScope(document)`).
- **`fui:plugs/webregistries/CustomElementRegistry.ts`** — made the `define()` instance-field-callback
  harvest (`new element()`) resilient (try/catch → prototype fallback): the swap now routes form-associated
  elements through this path, whose constructor calls `this.attachInternals()` — a real-browser API
  happy-dom lacks. Fixed the `patch-interaction` full-bootstrap stress test; real browsers are unaffected.
- **`fui:.../globalPatching.test.ts`** — updated to assert the root registry is now the root-scoped impl.

**Live-verified owning the dev-server lifecycle** (the humanGate — Playwright, real Chromium, primary FUI
checkout, then restored so the change rode the lane→PR):

- **plateau-app :4000** ✓ renders (body 824, `route-view` upgraded), **zero `#routes`/upgrade crashes** —
  the exact case that white-paged before.
- **WE site :3000** ✓ renders (body 7566).
- **FUI demos :6002** ✓ renders (body 25623).

FUI gate: 75/75 webregistries + patch-interaction unit tests green; `tsc` clean for the changeset. FUI-only
(no `we:plugs` byte-replica — #1047 deleted that copy). `humanGate` cleared. Stale-block follow-ups now
surfaced by the gate: **#1860** and **#640** are `blockedBy: #1545` (now resolved) — re-point or start them.
