---
kind: task
status: open
parent: "2232"
blockedBy: [2233]
dateOpened: "2026-07-04"
tags: [ci, visual-regression, determinism, fixtures]
---

# Render visual specs against frozen fixtures, not live backlog content

The visual specs screenshot real docs pages (`/`, a backlog-detail card, a capability-adapter card) built
from live `backlog/*.md` + spec data. That content changes on almost every commit, so a "visual" baseline
would legitimately mismatch constantly for reasons that have nothing to do with the *look* — making the
gate un-greenable without perpetual baseline churn. Best practice: point visual specs at **frozen fixture
data** so a screenshot only changes when the actual styling/layout changes.

## Scope

- Introduce a fixture build mode for the visual target pages (a pinned, checked-in data set the visual
  build uses instead of the live cascade) — analogous to the deterministic interaction lane's fixture
  server (we:tests/interaction/serve.mjs).
- Choose visual targets that exercise *layout/tokens/components*, not content volume: a representative
  page per template (home, a detail card, a grid) rendered from the frozen fixture.
- Keep the live docs build untouched — this is a test-only render path.
- Document how to add a new visual target against the fixture set.

Blocked by the platform decision #2233. Independent of #2234/#2235 (can proceed in parallel). Feeds #2239.
