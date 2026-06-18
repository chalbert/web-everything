---
type: issue
workItem: story
size: 3
status: resolved
dateOpened: "2026-06-16"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
parent: "800"
tags: []
---

# Rendered /backlog/ page content smoke test (Playwright) — assert tier badges & readiness counts match the loader

The tier rubric (we:src/_data/backlog.js deriveTier) is unit-pinned (we:tier.test.ts), but the rendered /backlog/ Prioritisation tab — the surface a human reads — has no Playwright content assertion. A loader→template wiring regression (wrong badge, wrong tier count, a 'ready to ratify' chip on a blocked decision) renders silently green: check:standards skips the 11ty build, and the only docs-site spec (we:rendered-site-a11y.spec.ts, :8080) checks axe a11y, not content. Add a Playwright spec on /backlog/ asserting the tier filter counts and at least one item's badge against the loader projection. Caught after a real bug where a blocked decision showed as ready to ratify.

## Scope & homing — a slice of a greater rendered-site regression capability

Don't build this as a one-off WE spec. It is the *content-correctness* sibling of the rendered-site
a11y gate (#763 → #770, `we:tests/a11y/rendered-site-a11y.spec.ts`), and both are early slices of a
broader **rendered-site regression-tooling** capability: a11y, content/data-binding correctness, and
(later) visual regression over the live docs site, run as one harness rather than scattered specs.

Per the managed-offering constellation pattern, that capability likely **homes in plateau-app as a
service the WE project consumes** (tooling that operates a running site is impl/product, not a WE
standard) — cf. the resolved #168 plateau in-browser Playwright harness as precedent. Open question to
settle before/at build: does the rendered-site regression harness live in WE (sibling to the existing
a11y spec, simplest now) or graduate to a plateau-hosted service the WE CI calls (the end-state the
user wants)? Build this slice so it ports cleanly to the latter — assert against the loader projection
via a stable, extractable contract, not hard-coded fixtures.

Relates to #763/#770 (rendered-site a11y gate, same harness), #168 (plateau Playwright harness
precedent), #777 (dogfood WE docs on FUI — the rendered surface this guards).

## Progress (resolved 2026-06-16)
- Added [`we:tests/content/rendered-backlog-content.spec.ts`](../tests/content/rendered-backlog-content.spec.ts) (sibling lane to the a11y spec, hits the real `:8080` docs page) wired into `we:playwright.config.ts` `testMatch` via a new `tests/content/**/*.spec.ts` glob.
- **Contract = the loader itself**, not fixtures: the spec `require`s `we:src/_data/backlog.js` (the same projection 11ty renders from) and asserts the rendered Prioritisation table against it — ports cleanly to a future plateau-hosted rendered-site harness (#800), nothing baked in.
- Three assertions catch the loader→template wiring regressions that render silently green today: (1) rendered row set is 1:1 with the loader's open(+active-decision) set; (2) **each** row's `data-readiness` badge equals the loader-derived bucket (a single mis-badged item — e.g. a 'ready to ratify' chip on a blocked decision — fails here); (3) per-readiness counts + the `batchable` filter-chip count equal the loader tally.
- Verified green against live data (75 rows, per-row readiness matched); `check:standards` green.
