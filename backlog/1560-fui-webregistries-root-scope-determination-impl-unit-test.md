---
kind: story
size: 5
parent: "1483"
status: resolved
locus: frontierui
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: none
tags: []
---

# FUI webregistries root-scope determination impl + unit test

Implement a root-scope determination path in fui:plugs/webregistries/CustomElementRegistry.ts: when the scoped registry is the root, define(name, RealClass) finds already-parsed root-document elements of that tag and upgrades them (prototype swap + re-run constructor-set state + connectedCallback), mirroring the native upgrade reaction the current upgrade() (delegating to the native upgrade ~line 166) misses. Cover with a unit test that defines an autonomous element AFTER its tag is already parsed in the body (the case #1387's suite skips). Byte-replicate the fix to we:plugs/webregistries/CustomElementRegistry.ts. Bounded, gate-verifiable, NO live re-enable. Slice A of #1483.

## Progress (resolved 2026-06-22, batch-2026-06-22-1556-1557-1559) — superseded by #1544

The impl + unit test had **already landed** in FUI via commit `fc9bb49` (#1544 — "root-scope upgrade-on-define
for already-parsed elements"), authored before this card. Verified the real state in
`fui:plugs/webregistries/CustomElementRegistry.ts`:

- **Impl present** — `markAsRootScope(node)` / `#rootScope`; `define()` calls `#upgradeAlreadyParsed(name,
  element, definition)` for an autonomous element when the registry is the root scope; `#upgradeElement()`
  does the prototype swap + constructor-state transfer + `attributeChangedCallback`/`connectedCallback`
  replay — exactly the native upgrade-on-define reaction the plain `upgrade()` misses.
- **Test present** — `fui:plugs/webregistries/__tests__/unit/CustomElementRegistry.test.ts` →
  "root-scope determination — upgrade-on-define for already-parsed elements (#1544)" →
  *"upgrades a root element parsed BEFORE define() — the case #1387 misses"*, which is precisely this card's
  acceptance. 3 root-scope tests pass.

The **we: byte-replication clause is obsolete**: the `we:plugs/` source tree was deleted by #1047 (WE no
longer holds the plug-impl copy — only a stale `_site/` build artifact remains), per the WE→FUI runtime
reconciliation. So there is no WE target to replicate into. No code change needed — closing as superseded by
#1544. `graduatedTo: none` (the entity is the FUI plug impl #1544 already graduated).
