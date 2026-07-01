---
kind: story
size: 5
status: resolved
blockedBy: []
dateOpened: "2026-07-01"
dateStarted: "2026-07-01"
dateResolved: "2026-07-01"
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

## Findings (audit output, 2026-07-01)

Lane-by-lane, what it actually asserts (verified against the on-disk specs + `we:playwright.config.ts`):

| Lane | File(s) | Asserts | Runs where |
|---|---|---|---|
| smoke | `we:tests/smoke/rendered-site-smoke.spec.ts` | per-route: HTTP <400, no uncaught pageerror, no failed doc/script/css request, primary content present; console.error warn-only. Scope = auto-derived `gatedRoutes()` from `/sitemap.xml` (no hand list). | live dev server :8080, `chromium` project |
| a11y | `we:tests/a11y/rendered-site-a11y.spec.ts` | one axe pass per gated route; also a vitest unit `we:tests/a11y/__tests__/sitemap-routes.test.ts` over the route-deriver. | live :8080 |
| visual | `we:tests/visual/rendered-site-visual.spec.ts` + `we:tests/visual/pages.json` (3 pages: home, one backlog detail, one adapter detail) | committed full-page PNG baselines, 1% maxDiffPixelRatio, per-page masks. Baselines platform-tagged (darwin). | live :8080 |
| content | `we:tests/content/rendered-backlog-content.spec.ts` | rendered /backlog/ Prioritisation table vs the live loader projection. **`describe.skip`'d** — sound only against a frozen tree (dev-render lags loader during churn). | (skipped) |
| interaction | 3 specs (items-filters, priority-filters, tabs) + fixtures + `we:tests/interaction/serve.mjs` | the ONLY real behaviour coverage — deterministic client-JS filter/tab behaviour on the private :3137 fixture server (mock FUI chip, no live data). Backlog page only. | `interaction` project, :3137 |
| block e2e | `we:blocks/__tests__/e2e/` (5 specs: on-event, router-demo, router-empty-clone, text-interpolation, source-toggle) | directive/block runtime behaviour on live :8080. `we:blocks/__tests__/e2e/source-toggle.spec.ts` is **`describe.skip`'d** (build-generated JSX pane absent on dev server). | live :8080, `chromium` |
| unit | vitest (`we:vitest.config.ts`, `test:unit`) | the broad unit lane (loader/tier/etc). | local vitest |

### Top findings (ranked by leverage)

1. **CI gates NONE of the browser/unit lanes.** Both workflows (`we:.github/workflows/cla.yml`, `we:.github/workflows/publish-contracts.yml`) run only the CLA check + `npm run check:standards` (`we:.github/workflows/publish-contracts.yml` line 45), which by design never renders a page or boots a browser. The entire smoke/a11y/visual/content/interaction/unit/block-e2e suite is a **developer-local gate only** — a regression a green local run would catch ships if the author skips it. This is the single biggest harness gap. → **filed as child #2068.**
2. **Two skipped specs cited a resolved tracking item.** `we:tests/content/rendered-backlog-content.spec.ts` and `we:blocks/__tests__/e2e/source-toggle.spec.ts` both said "Tracked by #1572" — but #1572 is `resolved`, so the skips pointed at a closed item. The live re-home target is the build-then-test rendered-site harness **#800** (open). **Fixed inline** (citations repointed to #800; noted #1572 is resolved). Both skips are legitimately parked (dev-render lag / build-time artifact), NOT dead-code to delete — they run green against a frozen `_site`, which is exactly #800's job.
3. **Interaction coverage is backlog-page-only.** The deterministic fixture lane is the right default pattern (private port, no live data, exercises real shipped JS) but only covers the backlog filters/tabs. The backlog page's remaining dynamic surfaces (graph, active-work poller, burndown render) are child **#2060**. Site-wide, no other interactive surface has behaviour coverage — worth a follow-up sweep once #2068/#2060 land, but out of this audit's scope.
4. **Smoke/a11y scope is self-maintaining** (derived from `/sitemap.xml` via `gatedRoutes()`, not a hand list) — no staleness risk there. **Visual baselines** are deliberately a small, stable 3-page set with masks; committed correctly and platform-tagged; the `we:tests/visual/pages.json` `_comment` documents the refresh discipline. No action.

### Inline quick-wins done under this item
- Repointed the two stale `#1572` skip citations → `#800` (see finding 2).

### Follow-ups filed
- **#2068** — gate the CI-safe lanes (interaction + vitest) in CI; live-render lanes home under #800.
- **#2060** (pre-existing) — remaining backlog-page dynamic surfaces.

## Lineage
Surfaced 2026-07-01 after extending backlog interaction coverage 6→25 tests and the user asking to review all the website's coverage harnesses. Anchored by the standing rule that every UI change must land a committed suite test (ui-change memory rule) — this audit checks the suite is actually able to carry that load.
