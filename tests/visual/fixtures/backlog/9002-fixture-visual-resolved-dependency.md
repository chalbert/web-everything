---
kind: task
status: resolved
dateOpened: "2026-01-01"
dateStarted: "2026-01-01"
dateResolved: "2026-01-02"
tags: [fixture, visual-regression]
---

# Fixture — resolved dependency

A frozen, resolved fixture item (backlog item 2236) that exists only to give the detail-target fixture
item (9001) a resolved `blockedBy` edge to render, so the visual-regression snapshot exercises the
"blocked by (resolved)" badge path deterministically.

This item is part of the checked-in visual-fixture set at `we:tests/visual/fixtures/backlog/` — it is
never read by the live docs build, only by the dedicated fixture build (`WE_VISUAL_FIXTURES=1`, see
`we:src/_data/backlog.js`). Do not "resolve" it again or otherwise edit it — it is intentionally frozen.
