---
type: idea
workItem: story
size: 3
parent: "350"
status: resolved
dateOpened: "2026-06-12"
dateStarted: "2026-06-15"
dateResolved: "2026-06-15"
graduatedTo: scripts/lib/buildReport.mjs
tags: []
---

# Migrate check:standards onto the report model + author the shared buildReport() helper

**Slice A of the reporter-migration fan-out** (split 2026-06-15, see
[reports/2026-06-15-backlog-split-analysis.md](../reports/2026-06-15-backlog-split-analysis.md)).
Point `check:standards` at the report model as a producer and author the shared `buildReport()` helper
that the sibling reporter slices reuse. Phase 5 of #350; needs the model (#431 ✓) and the v1 renderers
(#432 ✓) — both resolved.

## Scope (this slice)

- NEW `scripts/lib/buildReport.mjs` — a plain-object constructor matching the #431 report-model contract
  ([blocks/renderers/report/renderReport.ts](../blocks/renderers/report/renderReport.ts) — `sources` /
  `sections` / `findings` / `scores` / `series`). Pure JS, **no TS import** (the model is a plain-object
  contract; the TS renderers/adapters are downstream JSON consumers).
- Extend [scripts/check-standards.mjs](../scripts/check-standards.mjs) `--json` to emit a `Report`:
  `sources` + a findings `section` built from its existing `{message, descriptor}` error/warn entries
  ([:45](../scripts/check-standards.mjs#L45), #089/#095/#196). The **terminal/ANSI path stays bespoke** —
  only the structured `--json` shape migrates.

**Demoable state:** `check:standards --json` emits a model-valid report that pipes through the #432
findings-table renderer and the #434 `toSarif`/`toJUnit` adapters.

## Sibling slices (fan-out under #350, each blockedBy this item for the shared helper)

- **B** — `check:readiness` → model (ranked selection + batch pack as a `section` with `scores[]`).
- **C** — `check:app-conformance` (+ the `--burndown` **series**, [check-app-conformance.mjs:170](../scripts/check-app-conformance.mjs#L170)) → model (coverage-matrix `section` + `series[]`).
- **D** — capability-manifest adherence ([capability-manifest/report.ts:27](../capability-manifest/report.ts#L27)) → model `section`.

**Split note:** the original umbrella's "standalone burndown" was a mis-framing — `--burndown` lives
inside `check:app-conformance`, so the 5-reporter umbrella collapses to **4 real homes** (A + B/C/D),
the burndown series folded into C.

## Progress (2026-06-15, batch-2026-06-15)

- **Authored `scripts/lib/buildReport.mjs`** — the shared producer-side constructor: `buildReport()` +
  `source()`/`finding()`/`section()`/`score()`/`series()` factories matching the #431 contract
  (`blocks/renderers/report/renderReport.ts`). Pure JS, no TS import. Drops `undefined` optional keys and
  asserts the model's required fields (incl. a dangling-`source`-ref guard the export adapters rely on).
- **Migrated `check:standards --json`** ([scripts/check-standards.mjs](../scripts/check-standards.mjs)) to
  also emit a model-valid `report` (one `validator` source + a `findings` section mapping each
  `{message, descriptor}` entry → a `Finding`: descriptor `kind`→`ruleId`, `file`→`location`). The
  existing `errors`/`warnings`/`ok`/`summary` keys stay for the #196 auto-fix feed; the terminal/ANSI
  path is untouched (only the structured `--json` shape migrated, per scope).
- **Regression guard** `blocks/__tests__/unit/lib/buildReport.test.ts` proves the helper's output pipes
  unchanged through the #432 `renderFindingsTable` and the #434 `toSarif`/`toJUnit` adapters, and that the
  invariants reject malformed producer input (6 tests green).
- **Demoable state met:** `node scripts/check-standards.mjs --json` emits a model-valid report
  (verified: 1 source, 1 section, findings = errors+warnings) that the #432 renderer + #434 adapters consume.
- **Sibling slices B/C/D** (`check:readiness`, `check:app-conformance`, capability-manifest) now reuse
  this helper — left open, each `blockedBy` this item for the shared constructor (now landed).
