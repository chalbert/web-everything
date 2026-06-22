---
kind: story
size: 3
parent: "1483"
status: open
locus: frontierui
blockedBy: ["1593"]
humanGate: { kind: setup, what: "Re-enables the root `window.customElements` swap that previously white-paged the plateau site; acceptance requires live-verifying plateau-app (:4000) + WE site (:3000) + FUI demos render with no upgrade crash while OWNING the dev-server lifecycle. A concurrent batch can't restart/recover the user's running :3000/:4000 (don't-kill-dev-server). Needs a focused session that owns the servers — the reason 4 prior batch pre-flights declined it." }
dateOpened: "2026-06-22"
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
