---
kind: story
size: 5
status: active
blockedBy: []
dateOpened: "2026-07-01"
dateStarted: "2026-07-01"
tags: [testing, playwright, coverage, audit, quality]
---

# Review all the WE-website test-coverage harnesses

Audit the whole WE-website test setup (`we:tests/`) end-to-end: what each lane is meant to guard, where it's thin, and whether the harness structure is still right. This came out of noticing the suite is **real but thin** — only the backlog page's filters have genuine interaction coverage; most of the site gets a single smoke/a11y/visual pass, and one lane is skipped.

## The lanes today
- `we:tests/smoke/` — one render pass over a page list.
- `we:tests/content/` — backlog content assertions, **currently `describe.skip`'d** (dead coverage — decide: fix or delete).
- `we:tests/visual/` — screenshot snapshots (committed baselines).
- `we:tests/a11y/` — one axe pass.
- `we:tests/interaction/` — the deterministic fixture lane (mock FUI chip on :3137); the ONLY real behaviour coverage, and only for the backlog page.
- Also: `we:playwright.config.ts` projects, the vitest unit lane, and the block/plug e2e suites under `we:blocks/__tests__/` — confirm they're wired to CI and not silently skipped.

## Scope (produce a findings report + file follow-ups)
- Map every lane → what it actually asserts vs. what it's assumed to guard; flag dead/skip'd specs (start with the skipped content lane).
- Identify the highest-value coverage gaps across the site (not just backlog): which interactive pages/components have zero behaviour tests.
- Assess the harness itself: is the smoke page-list current? are visual baselines stale/committed correctly? is the interaction-fixture pattern the right default, or should more run against a built site? Relate to the interim visual-regression guard tracked under epic #800 / decision #799.
- Output: a prioritised gap list filed as child items (e.g. #2060 for the backlog residuals), and any harness fixes that are quick wins done inline.

## Boundaries
- This is the REVIEW/audit + triage. Large new suites become their own items. Don't rewrite lanes wholesale under this story.

## Lineage
Surfaced 2026-07-01 after extending backlog interaction coverage 6→25 tests and the user asking to review all the website's coverage harnesses. Anchored by the standing rule that every UI change must land a committed suite test (ui-change memory rule) — this audit checks the suite is actually able to carry that load.
