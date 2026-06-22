---
kind: story
size: 3
parent: "1483"
status: resolved
locus: frontierui
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
tags: []
---

# webregistries root-scope determination — upgrade root-parsed elements on define()

Implement the root-scope determination path in fui:plugs/webregistries/CustomElementRegistry.ts: when the scoped registry is the root, define(name, RealClass) finds already-parsed root-document elements still on the empty stand-in and upgrades them — swap prototype to the real class + run the upgrade reaction (constructor-set state + connectedCallback), mirroring native upgrade-on-define (the path the existing upgrade() skips). Cover with a unit test that defines an autonomous element AFTER a matching tag is already parsed in the body — the case #1387's suite misses. No root re-enable, no app server; gate-verifiable in FUI vitest.

## Progress

- `fui:plugs/webregistries/CustomElementRegistry.ts` — added `setRootScope(node = document)` + a `rootScope` getter (the registry's root-scope flag). When set, `define(name, RealClass)` runs a **root-scope determination** pass after registering the stand-in: `root.querySelectorAll(name)` finds already-parsed elements still on the empty stand-in (`getPrototypeOf(el) !== RealClass.prototype`) and upgrades each.
- The upgrade (`#upgradeElement`) mirrors native upgrade-on-define: `Object.setPrototypeOf(el, RealClass.prototype)` → transfer **constructor-set instance state** (harvested from a fresh `new RealClass()`, copying ONLY own keys not already own on `el`, so the element's DOM internals are never clobbered — verified happy-dom carries `_listeners`/symbol props as own) → run the reaction (`attributeChangedCallback` for each present observed attribute, then `connectedCallback` if connected).
- Autonomous-only (`!options?.extends`); a customized built-in is matched by its `is`, not its tag. This is the prerequisite the disabled root-registry swap (#1483 `applyPatches` step 3) needs before re-enable — implemented here, **not** re-enabled (per scope).
- Unit test (`CustomElementRegistry.test.ts`, new describe): defines an autonomous element AFTER its tag is parsed in the body and asserts prototype-swap + constructor-state transfer + observed-attr reaction + a single `connectedCallback` — the #1387-missed case. Plus a negative (non-root registry doesn't retroactively upgrade) and the `rootScope` accessor. 25/25 green. (Test re-queries the live node post-define — happy-dom re-materializes the node when the native stand-in registers; a real browser upgrades in place.)
