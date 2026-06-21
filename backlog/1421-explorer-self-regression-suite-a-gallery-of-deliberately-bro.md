---
kind: story
size: 8
locus: frontierui
status: open
dateOpened: "2026-06-21"
tags: []
---

# Explorer self-regression suite: a gallery of deliberately-broken + known-good UI fixtures the explorer runs against continuously, asserting each oracle fires on its defect and stays silent on clean pages

The explorer is the thing that catches UI defects — but nothing continuously verifies that *it still catches them*. As oracles and heuristics change (e.g. #1412 refines `no-broken-layout`, #1418 adds gesture probing), a regression could silently blind an oracle and we'd never know until a real defect shipped. Build a **self-regression suite**: a gallery of small HTML fixtures, each a *deliberately-broken* UI exercising exactly one defect class, plus *known-good* twins; a test runs the explorer over every fixture and asserts the broken ones produce the expected finding and the clean ones produce none. This tests the tester.

## Why now (concrete evidence, 2026-06-21)

Running the explorer against the live WE docs (`npm run explore -- http://localhost:8080/`) produced two findings worth locking into a suite:
- It **correctly flagged** `no-broken-layout` on the home page (horizontal overflow) — proof the oracle works, exactly the behavior a fixture should pin.
- It **false-positived**: the overflow was already fixed for users (`overflow-x:hidden`), yet the warn still fired because the heuristic reads raw `scrollWidth` (#1412). A clean-fixture in the suite would have caught this as a false positive.
- Separately it **crashed** on a real link-click navigation (#1422) — a robustness gap a fixture run would surface immediately.

## Scope

1. **Fixture gallery** under the explorer tool (e.g. `fui:tools/explorer/fixtures/`): one minimal page per defect class — horizontal overflow (unclipped), intentionally-clipped off-canvas (clean control), console error on load, unhandled rejection, HTTP 5xx resource, a11y violation, focus trap, and (post-#1418) scroll-only-reachable content + drag-exposed overflow.
2. **Expectation manifest**: each fixture declares the oracle(s) it MUST trigger (broken) or MUST NOT trigger (clean control), so the suite is data-driven, not hardcoded asserts.
3. **A test** (`fui:tools/explorer/fixtures.test.ts` or similar) that serves the fixtures, runs the EXPLORE profile over each, and asserts findings == expectation. Runs in the existing `check:standards` / unit-test lane so it's continuous, not manual.
4. **Negative coverage is first-class**: the clean controls (no findings) matter as much as the broken ones — they pin against false positives like the #1412 case.
5. Keep fixtures **minimal and deterministic** (no network flakiness, bounded states) so the suite is fast and CI-stable.

## Notes

- FUI-owned explorer (epic #1167); `locus: frontierui`.
- Directly supports #1412 (the clipped-off-canvas clean control is its regression test) and #1418 (gesture fixtures land as those gestures ship). File those defect fixtures alongside each feature.
- A "full regression suite" may outgrow one story — if so, slice per defect-class family via /split. Sized 8 as the umbrella build.
</content>
