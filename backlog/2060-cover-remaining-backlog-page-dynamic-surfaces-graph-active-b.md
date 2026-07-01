---
kind: story
size: 3
status: resolved
blockedBy: []
dateOpened: "2026-07-01"
dateStarted: "2026-07-01"
dateResolved: "2026-07-01"
tags: [backlog-ui, testing, playwright, interaction, coverage]
---

# Cover the remaining backlog-page dynamic surfaces (Graph, Active-work poller, burndown render)

The interaction lane now covers the three filter/nav surfaces of the backlog page (Prioritisation table, Items-tab filters, tabs). Three **dynamic** surfaces are still only smoke-covered — they run real client JS with no behaviour test:

- **Graph tab** (`we:src/assets/js/backlog-graph.js`) — the dependency graph render + any node/zoom interaction.
- **Active-work live poller** (`we:src/assets/js/backlog-active.js`) — polls the active-progress JSON endpoint, groups claimed work by operation, expands step streams. Needs a mocked poll fixture (deterministic JSON), not live data.
- **Burndown chart render** (`we:src/assets/js/backlog-burndown.js`, the chart half) — the tab logic is covered; the SVG render for a given `#burndown-data` payload + granularity toggle is not.

## Scope
- Add deterministic fixtures under `we:tests/interaction/fixtures/` (mock data embedded, private :3137 port — never :3000/:8080), mirroring the pattern in `we:tests/interaction/backlog-priority-filters.spec.ts`, `we:tests/interaction/backlog-items-filters.spec.ts`, and `we:tests/interaction/backlog-tabs.spec.ts`.
- One spec per surface asserting the observable behaviour (nodes rendered / poll digest grouped / SVG paths + granularity switch), not pixels.
- Keep each spec guarding the REAL shipped script (loaded from the repo tree), so it locks the actual file.

## Boundaries
- Behaviour, not visual snapshots (that lane exists separately). No app-code changes unless a test surfaces a real bug.

## Lineage
Surfaced 2026-07-01 while adding the backlog-page filter interaction coverage (Hide-low-priority work). The filter/tab surfaces went 6→25 interaction tests; these three remained smoke-only and were called out as the residual. Governed by the standing rule that UI changes must land a committed suite test (see the ui-change memory rule).
