---
kind: story
size: 3
parent: "1002"
status: resolved
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "we:plugs/__tests__/e2e/webvalidation.spec.ts"
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
