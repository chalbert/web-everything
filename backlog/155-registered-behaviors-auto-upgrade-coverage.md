---
type: idea
workItem: task
parent: "131"
status: resolved
dateOpened: "2026-06-07"
dateStarted: "2026-06-07"
dateResolved: "2026-06-07"
graduatedTo: "Bootstrap auto-upgrade e2e coverage for nav:list + type-ahead (Frontier UI, extends the #144 data-grid pattern)"
tags: [bootstrap, e2e, behavior, registration, testing, nav-list, type-ahead, coverage]
relatedProject: webblocks
crossRef: { url: /backlog/144-data-grid-behavior-auto-upgrade-e2e/, label: "#144 data-grid auto-upgrade e2e" }
---

# Prove `nav:list` and `type-ahead` auto-upgrade via bootstrap (like the grid)

[#144](/backlog/144-data-grid-behavior-auto-upgrade-e2e/) closed the loop for `grid:cell-navigation`:
a bootstrapped fixture page (`demos/data-grid-bootstrap-fixture.html`) + an e2e
(`blocks/__tests__/e2e/data-grid-bootstrap.spec.ts`) that proves a plain authored
`<table role="grid" grid:cell-navigation>` upgrades through the live `CustomAttributeRegistry` — i.e.
that `registerDataGrid(window.attributes)` in `plugs/bootstrap.ts` actually fires.

The exact same gap remains for the other behaviors registered the same way in `bootstrap.ts`:

- **`nav:list`** (`registerNavigation`) — the navigation demo's `navigation-demo.html` does call
  `window.attributes.upgrade(document.body)`, so the registry path is arguably exercised there, but
  there is no focused assertion that the *registration line* is what wires it (the demo would still
  "look right" with roving tabindex authored in). Pin it with a fixture whose roving `tabindex="0"`
  can only come from the behavior, mirroring #144.
- **`type-ahead`** (`registerTypeAhead`) — only exercised via manual attach in its demo; no
  bootstrap-path e2e at all.

Close the loop for both with the #144 pattern (authored markup with no pre-seeded active state →
assert the behavior-produced state appears + a keystroke drives it), **or** fold all three into one
*"registered block behaviors auto-upgrade via bootstrap"* coverage spec so a new `attributes.define`
in `bootstrap.ts` that never fires can't slip through for any behavior. Prefer the single shared spec
if the fixtures are cheap to co-locate.
