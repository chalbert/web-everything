---
kind: story
size: 3
parent: "1002"
status: open
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
tags: []
---

# webvalidation plug to the coverage bar — both mirrors (unit + dedicated e2e)

The named first per-plug slice of #1002 (webvalidation is 0 tests in FUI, no dedicated e2e in either mirror). Add the FUI `fui:plugs/webvalidation/__tests__/` unit suite (mirror the 6 WE units), add `we:plugs/__tests__/e2e/webvalidation.spec.ts` exercising the plugged `<validity-merge-field>`/`<async-validator-field>` through `we:plugs/bootstrap.ts`, and assert plugged↔unplugged parity. Files: `we:plugs/webvalidation/` (index, CustomValidityMergeRegistry, ValidityMergeField, CustomValidatorResolutionRegistry, AsyncValidatorField, applyMergedValidity). Align to the bar #1009 codifies. Independent of #1009/#1011.

## Progress (batch-2026-06-18)

Closed webvalidation's both-mirror coverage gap (was 0 tests in FUI, no dedicated e2e in either mirror):
- **FUI unit suite** — mirrored the 6 WE units into `fui:plugs/webvalidation/__tests__/` (AsyncValidatorField,
  CustomValidatorResolutionRegistry, CustomValidityMergeRegistry, ValidityMergeField, applyMergedValidity +
  `fui:plugs/webvalidation/__tests__/unit/webvalidation.unplugged.test.ts`). FUI source is byte-identical to WE, so they port cleanly;
  **50 tests green** in `../frontierui` (happy-dom).
- **WE dedicated e2e** — `we:plugs/__tests__/e2e/webvalidation.spec.ts` (Playwright/Chromium, 3 tests green):
  drives the plugged `<validity-merge-field>` (source collapse → native `ElementInternals.setValidity` /
  `:invalid`) and `<async-validator-field>` (feeds the async source) under the full `we:plugs/bootstrap.ts`,
  and asserts **plugged↔unplugged parity** (the standalone `createDefaultValidityMergeRegistry()` and the
  bootstrap-installed `window.customValidityMerge` both resolve the `source-reduction` native-first default).
  Verified against the running dev server on :3000.

## Reopened 2026-09-06 — the promised coverage does not exist today

Delivered, then deleted, and never ported. Verified during the 2026-09-06 resolved-card sweep:

- The e2e spec landed in WE commit `5513a7d3` (a +102-line Playwright spec).
- It was deleted with the whole `we:plugs/` tree by **#1047** (`e702bebe`, 215 files / 32,741 deletions)
  under the ratified "WE holds zero executable" rule (#1282 / #1771).
- The **plugged** seam was never re-created in FUI. `frontierui:plugs/webvalidation/__tests__/` holds the
  six unit mirrors, but its `frontierui:plugs/webvalidation/__tests__/unit/webvalidation.unplugged.e2e.test.ts` is an UNPLUGGED vitest test from #1857 —
  the opposite seam.

So the acceptance clause "plugged `<validity-merge-field>` / `<async-validator-field>` through
`frontierui:plugs/bootstrap.ts` in a real browser" has **no artifact in either mirror**. The deletion was
correct architecture; whether the coverage should have moved with the code was never decided. Reopened so
that decision is made rather than assumed — see #3523. The card stays `open` pending that call; if the
answer is "intentionally retired", resolve it with that recorded rather than silently.
