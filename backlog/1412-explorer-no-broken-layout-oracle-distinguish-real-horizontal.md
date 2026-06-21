---
kind: story
size: 3
locus: frontierui
status: resolved
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: "fui:tools/explorer/oracles/layoutOverflow.ts"
tags: []
---

# Explorer no-broken-layout oracle: distinguish real horizontal overflow from intentionally-clipped off-canvas (WE-site 40px scroll use-case)

Real use-case captured 2026-06-21: the WE docs site (:8080) had a ~40px horizontal scroll on every page, from the dev-only Spec Explorer off-canvas panel (`position:fixed; right:0; transform:translateX(100%)`) extending past the viewport. The explorer's `no-broken-layout` oracle should catch this, but its `scrollWidth > clientWidth + 1` heuristic is too naive: the correct fix (`overflow-x:hidden` on `<html>`, clipping the panel) leaves `scrollWidth` at 1329 while the page is no longer user-scrollable, so the oracle would still report it red — a false positive. Refine it to flag *genuine* overflow, not raw `scrollWidth`, and name the offending element.

## What the episode revealed

- The oracle exists and is the right idea — contradicts the "tool not mature enough" assumption. Definition: `fui:tools/explorer/oracles/genericInvariants.ts` (`noBrokenLayout`); probe: `fui:tools/explorer/oracles/playwrightCollector.ts` (`el.scrollWidth > el.clientWidth + 1`).
- Raw `scrollWidth > clientWidth` cannot tell a *broken* layout (user can scroll to whitespace) from an *intentionally clipped* off-canvas drawer/menu (very common, not a defect). After clipping the WE panel with `overflow-x:hidden`, `scrollWidth` is unchanged (1329) but `window.scrollX` maxes at 0 and there's no scrollbar gutter — i.e. NOT broken. The current oracle would still report it red → false positive.
- The finding is not actionable: it says "layout overflows" but not *which* element. The diagnosis here required a manual widest-`getBoundingClientRect().right` sweep.

## Scope

1. Replace / augment the heuristic so it tests **actual user-scrollability**, not raw `scrollWidth`. Candidate signal: the document is only "broken" if it can actually be scrolled horizontally — e.g. `getComputedStyle(documentElement).overflowX` is not `hidden`/`clip` **and** `scrollWidth > clientWidth + 1`. (Programmatic `scrollWidth` alone is insufficient; a clipped overflow is intentional.)
2. Make the finding actionable: when overflow is real, include the widest offending element (tag + class + `right` edge) in the `Finding`, via the in-page probe in `fui:tools/explorer/oracles/playwrightCollector.ts`.
3. Add a regression fixture from this exact case: an off-canvas panel translated past the viewport with NO viewport clip = real overflow (flag it); the same with `overflow-x:hidden` on the root = clipped (do NOT flag).
4. Confirm the docs-site sweep consumer actually targets the live WE docs (this overflow was on :8080; verify the sweep's target port matches the WE docs server, not only the FUI demo server).

## Notes

- Underlying gap is in the FUI-owned explorer (epic #1167); this is a refinement story, `locus: frontierui`.
- The WE-site symptom itself was fixed separately in `we:src/css/style.css` (`html { overflow-x: hidden }`) — that fix is the very thing that exposes the oracle's false-positive, so it doubles as the test fixture above.

## Progress

- New pure decision module fui:tools/explorer/oracles/layoutOverflow.ts: `isGenuineOverflow` (overflow is
  real only if `scrollWidth > clientWidth+1` AND neither `<html>` nor `<body>` clips x via
  `overflow-x:hidden|clip`), `pickWidestCulprit` (widest element past the viewport), `describeCulprit`.
  The in-page probe now only READS metrics; the decision is pure TS, so the two can't drift.
- Refined fui:tools/explorer/oracles/playwrightCollector.ts `#domProbes`: gathers raw metrics
  (scrollWidth/clientWidth/computed overflow-x of html+body) + the spilling-element rects in-page, then
  applies the pure decision. `layoutOverflow` now means *genuine* overflow; threads `overflowCulprit`.
- Added `overflowCulprit?` to the Observation type (fui:tools/explorer/oracles/observation.ts); the
  `noBrokenLayout` oracle (fui:tools/explorer/oracles/genericInvariants.ts) now names the widest
  offending element (`tag.class @ right=Npx`) — actionable, not just "layout overflows".
- Regression fixtures (scope 3) as pure unit tests in
  fui:tools/explorer/oracles/__tests__/layoutOverflow.test.ts mirroring the exact WE-site case:
  translated off-canvas panel with NO clip = flagged; same with `overflow-x:hidden` (the shipped WE fix)
  = NOT flagged; body-clip variant; 1px rounding tolerance; culprit-naming. + an actionability assertion
  in fui:tools/explorer/oracles/__tests__/genericInvariants.test.ts. 37/37 explorer-oracle tests green;
  FUI gate 0 errors.
- Scope 4 (sweep target): the CLI `PROBE_BASES` was `[:3001 FUI-demo, :8082 FUI-docs]` — it did NOT
  include `:8080` (the WE Eleventy docs server where the overflow lived, and docsSiteHarness's stated
  target). Added `http://localhost:8080` to fui:tools/explorer/cli.ts PROBE_BASES so a relative docs
  sweep can actually reach the live WE docs.
</content>
</invoke>
