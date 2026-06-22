---
kind: task
parent: "170"
status: resolved
locus: webeverything
blockedBy: []
dateOpened: "2026-06-19"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: none
tags: [plugs, dedup, migration, webeverything, frontierui]
---

# Delete webeverything/plugs and relocate #726 unplugged tests to FUI

After WE repoints onto `@frontierui/plugs` (#449): delete the 156 files under `we:plugs/`; relocate the two #726 unplugged tests (`we:plugs/webguards/__tests__/unit/webguards.unplugged.test.ts` + the webvalidation equivalent) to the FUI canonical home (`fui:plugs/webguards/` + `fui:plugs/webvalidation/`, adjusting the `guard/`→`fui:blocks/guard/` and `validity-merge/`/`validator-resolution/` import paths) so coverage is not dropped; verify no `../plugs/` or `@we/plugs/*` reference survives in any repo. All gates green. Bounded cleanup slice of #449.

## Grounding (2026-06-22, session 1047) — repoint landed (#1234); scope is bigger than the body claims

The #1234 repoint LANDED + live-verified, so the 2026-06-19 "blocked-in-fact" note below is **stale**.
`blockedBy: 1234` cleared. Measured the live tree at claim:

- **Deleting the non-test plug source is now safe.** ZERO relative `../plugs/` importers remain in
  `we:blocks/`/`we:src/`/`we:demos/`/`we:test-pages/` (block runtime on `@frontierui/plugs`;
  demos/test-pages/bootstrap on the `/plugs`→FUI alias). The body's "156 files / 207 files / 2 tests" is
  stale: **212 files** under `we:plugs/`, **96 test files**.
- **The real work is coverage preservation, not the delete.** FUI lacks **18** of WE's plug test files
  (not 2). Of these: ~17 relocate cleanly (FUI has the SUT — same relative tree layout, so a copy resolves;
  the 3 FUI-lacked #726 unplugged tests are webguards/webanalytics/webcontexts, and webguards+webanalytics
  need the repo-root-provider → FUI-co-located-provider import adaptation, same as the #1234 TrackAttribute
  port; webcontexts is a clean copy). **One** is a genuine #1250 residual:
  `we:plugs/webstates/VersionedStorageStrategy.ts` exists only WE-side, FUI lacks it, and nothing live
  consumes it.

### Done (2026-06-22) — coverage relocated, `we:plugs/` deleted

- **Relocated all 18 FUI-lacked tests to FUI** (the user chose the full relocation, not the minimal 3).
  14 were verbatim copies (identical relative tree layout); 4 needed import adaptation: 3 provider imports
  (`we:` repo-root analytics/guard → FUI's co-located `../provider` / `fui:blocks/guard/provider`), and
  `CustomCommitmentPolicyRegistry.test` repointed to `@webeverything/commitment-policy` (its `export *`
  re-exports `UnknownCommitmentPolicyError`). **Ported the orphan module**
  `we:plugs/webstates/VersionedStorageStrategy.ts` (+ index export) into `fui:plugs/webstates/` — the #1250
  residual. All **18 relocated tests pass against FUI's impl** (98 assertions), validating both the
  relocation and the #1234 TrackAttribute port.
- **Deleted `we:plugs/`** (212 files) + the vestigial `we:tsconfig.plugs.json` and the orphan
  `build:plugs` npm script (invoked by nothing). Trimmed `we:vitest.config.ts`: dropped the `plugs/**`
  test+coverage globs and the now-dead local-plugs sub-aliases (`@core`/`@webregistries`/… +
  `virtual:trait-manifest`) — every consumer lived inside the deleted tree; only `@frontierui/plugs`
  remains (block tests use it).
- **Verified:** zero surviving `../plugs/`/`@we/plugs` references in WE; `check:standards` 0 errors; WE
  vitest 2388 pass (the 1 fail — `we:capabilities/__tests__/worked-example-artifact.test.ts` — reads no
  plugs and isn't in this changeset, a concurrent/pre-existing staleness); live demos + test-pages still
  200 (the `/plugs`→FUI alias is unchanged by the delete). FUI's full plug suite: the relocated 18 pass;
  its 1 fail (`fui:plugs/webregistries/__tests__/unit/globalPatching.test.ts`) is a concurrent FUI
  session's edit to `fui:plugs/webregistries/index.ts`, not this work.

The 2026-06-19 "blocked-in-fact" note below is **superseded** by the #1234 repoint + this delete.

Although #449 is marked `status: resolved`, the WE tree has **not** repointed onto `@frontierui/plugs`: that package is absent from `we:package.json` and `we:node_modules`, and `we:blocks/*` + `we:src/*` still import heavily from the local `we:plugs/` (207 files present, including the actively-built webportals slices #1148/#1149/#1150). Deleting `we:plugs/` now would break the entire WE build. The real prerequisite (a working `@frontierui/plugs` consumed by WE) is verified absent, so this stays blocked regardless of #449's status. **Surfaced for the user: reconcile #449 — it appears resolved-on-paper but the repoint is incomplete.** Do not run this deletion until WE genuinely imports plugs from FUI.
