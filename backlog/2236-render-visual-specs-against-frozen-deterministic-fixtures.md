---
kind: task
status: resolved
parent: "2232"
blockedBy: [2233]
dateOpened: "2026-07-04"
dateStarted: "2026-07-09"
dateResolved: "2026-07-09"
graduatedTo: none
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

## Outcome

Introduced a small, checked-in, frozen backlog fixture set (`we:tests/visual/fixtures/backlog/*.md`, 3
items) and a `WE_VISUAL_FIXTURES` env override in `we:src/_data/backlog.js` that swaps its input directory
to the fixture set instead of the live `backlog/`; the loader's dev-only reservations-file read is also
skipped in this mode so the fixture output is a pure function of the checked-in fixtures. The visual
snapshot spec (`we:tests/visual/rendered-site-visual.spec.ts`) now targets a DEDICATED Eleventy
build+serve — its own `WE_VISUAL_FIXTURE_PORT` (default `:8099`), a new `webServer` entry in
`we:playwright.config.ts` — fully decoupled from the developer's live `:3000`/`:8080` dev server (never
booted or touched), mirroring the interaction lane's dedicated fixture server (`we:tests/interaction/serve.mjs`)
but as a real Eleventy render (the targets are templated pages, not static fixtures). All three curated
targets in `we:tests/visual/pages.json` (home, the backlog-detail card, the capability-adapter card) now
render off this fixture build — home and the capability-adapter page render byte-identical to the live
build (neither reads the backlog collection) — and the backlog-detail target points at the frozen fixture
item instead of a live backlog page. How-to-add-a-target is documented in `we:tests/visual/pages.json`'s
header comment; `we:docs/agent/testing.md`'s lane-testing section is updated to match (the old "hardcodes
:8080" note was already stale). New regression test: `we:src/_data/__tests__/backlog-visual-fixture-mode.test.ts`.
