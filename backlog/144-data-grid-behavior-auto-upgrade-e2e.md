---
type: idea
workItem: task
parent: "131"
status: resolved
dateOpened: "2026-06-07"
dateResolved: "2026-06-07"
tags: [data-grid, bootstrap, e2e, behavior, registration, testing]
relatedProject: webblocks
crossRef: { url: /blocks/data-grid/, label: Data Grid block }
---

# Prove `grid:cell-navigation` auto-upgrades an authored grid via bootstrap

[#131](/backlog/131-data-grid-cell-navigation-behavior/) built `DataGridBehavior`, registered it in
`plugs/bootstrap.ts` (`attributes.define('grid:cell-navigation', …)`), and proved the behavior drives
`auditDataGrid` green. But every place that exercises it — the unit test and the conformance demo's
live card — **attaches the behavior manually** (`new DataGridBehavior(); attach(); connectedCallback()`),
mirroring the `nav:list` / `type-ahead` demos. Nothing yet proves that a plain authored
`<table role="grid" grid:cell-navigation>` on a real, bootstrapped page **auto-upgrades** through the
live `CustomAttributeRegistry` — i.e. that the registration line actually fires.

Close the loop with a focused test:

- An integration or e2e test that mounts an authored grid (the documented HTML-usage markup) on a
  bootstrapped page and asserts the attribute upgrades: a roving `tabindex="0"` appears and an arrow
  key moves focus — without any manual `attach`.
- Decide the home: a Playwright e2e against a tiny bootstrapped fixture page (like
  `plugs/__tests__/e2e/navigation.spec.ts`), or a jsdom integration test that drives the real registry
  upgrade path.

Note: this gap is **not unique to the grid** — `nav:list` and `type-ahead` are registered the same way
and are only exercised via manual attach in their demos. Consider whether this becomes a single
*"registered block behaviors auto-upgrade via bootstrap"* coverage item spanning all three, rather than
one per behavior.

## Progress

- **Status:** resolved
- **Branch:** docs/standard-authoring-workflow
- **Done:**
  - Added bootstrapped fixture page `demos/data-grid-bootstrap-fixture.html` — plain authored
    `<table role="grid" grid:cell-navigation>` (all cells `tabindex="-1"`), upgraded ONLY via
    `window.attributes.upgrade(document.body)` (no manual `new DataGridBehavior()`).
  - Added e2e `blocks/__tests__/e2e/data-grid-bootstrap.spec.ts`: asserts (1) the behavior seeds a
    single roving `tabindex="0"` on the origin (only the registry-attached behavior can produce it),
    and (2) ArrowRight/ArrowDown rove focus + tabindex — both fail if the bootstrap registration line
    stops firing.
- **Next:** done — spec green (2/2), `check:standards` 0 errors, data-grid unit tests 46/46.
  Cross-cutting "nav:list / type-ahead auto-upgrade coverage" gap captured as
  [#155](/backlog/155-registered-behaviors-auto-upgrade-coverage/).
- **Notes:** Chose the Playwright-e2e home (over jsdom integration) — mirrors
  `plugs/__tests__/e2e/navigation.spec.ts` and proves the real bootstrapped path.
