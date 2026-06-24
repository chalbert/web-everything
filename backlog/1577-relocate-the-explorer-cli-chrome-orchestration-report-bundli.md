---
kind: story
size: 8
status: resolved
blockedBy: []
dateOpened: "2026-06-22"
dateStarted: "2026-06-24"
dateResolved: "2026-06-24"
graduatedTo: "plateau:tools/explorer"
tags: [explorer, devtools-placement, plateau, frontierui]
---

# Relocate the WHOLE explorer (engine + CLI + oracles) FUI → Plateau as a closed product

## Re-scope (2026-06-24, per ratified #1747)

#1747 ruled the explorer is a **closed Plateau product** — engine included, not just the CLI chrome. This is
now a **wholesale relocation** of `fui:tools/explorer/*` (all ~24 non-test files, ~2,680 LOC: `playwrightDriver`,
oracles incl. `fui:tools/explorer/oracles/genericInvariants.ts`, harnesses, `fui:tools/explorer/stateFlowGraph.ts`,
`fui:tools/explorer/gate.ts`, CLI, report-bundling) → plateau-app, plus its tests. FUI keeps **no** copy; it
dogfoods by running the Plateau tool against its dev server (point-at-URL, no source dependency). The earlier
"cross-repo `@frontierui` public API" problem is **gone** — the engine moves too and imports nothing from FUI,
so there is no FUI↔Plateau seam. The `genericInvariants` home question is **resolved**: it travels with the
engine. The explorer's `reportBundle` output must conform to the WE result/output-format schema (#1769).
Unblocked: #1747 resolved.

---

## Done (2026-06-24)

Wholesale relocation executed per #1747 — the entire explorer tree (engine + CLI + oracles + harnesses +
report-bundling, 51 files) now lives at `plateau:tools/explorer/`; FUI keeps **no** copy.

- **plateau-app (added):** copied the tree; inlined the lone out-of-tree coupling (`WCAG_TAGS`) into a local
  `plateau:tools/explorer/wcagTags.ts` (drops the `fui:tests/a11y/sitemap-routes` import at 2 sites); repointed
  `plateau:src/explorer-runs/executor.ts` `defaultRunner` + `plateau:vite.config.mts` to drive the LOCAL CLI
  (`cwd` = plateau root); dropped the now-dead `@frontierui/tools*` aliases (tsconfig + vite + vitest);
  repointed `plateau:src/conformance-engine/conformanceVectors.ts`'s `Finding` import to the local sibling;
  added `@axe-core/playwright` + `vite-node` deps + `explore`/`explore:gate` scripts; prepended `:4000` to the
  CLI probe list. Tests wired: vitest `include` + playwright `testMatch` broadened; `fixtures.smoke` repointed
  `:3001`→`:4000`. **Verified:** 95 explorer unit tests + 9 fixtures smoke pass; CLI runs end-to-end (bundle
  written); plateau full suite 552/552 green.
- **FUI (removed):** `git rm` the whole tree; removed `explore`/`explore:gate` scripts; fixed the stale
  `fui:blocks/deck/deckConformance.ts` doc-link. FUI `check:standards` green (0 errors); no dangling refs.
- **Skills:** moved `stress-test` + `improve-explorer` FUI → `plateau:.claude/skills/`, repointed
  `fui:tools/explorer`→`plateau:tools/explorer`, dev port `:3001`→`:4000`, `locus: frontierui`→`plateau`.
- **Dropped coverage tracked:** the 3 FUI-host-specific browser smokes (workbench/gate/docs-sweep) were
  non-portable (hardcoded FUI surfaces); filed **#1773** (blocked by this) to re-establish fixture-based
  live-path smoke for `runGate` + `stressTestComponent`.
- **Out of scope (own cards):** `reportBundle` → WE result/output-format schema conformance is #1769; the
  end-state placement audit is #1770.

## Original framing (superseded by the re-scope above)

Per #1565 Fork 3 (we:docs/agent/platform-decisions.md#devtools-placement): move the explorer's operated product surface — fui:tools/explorer/cli.ts, fui:tools/explorer/cliRouting.ts, fui:tools/explorer/routeDiscovery.ts, fui:tools/explorer/reportBundle.ts (the 'point it at any URL' orchestration + report-bundling) — to plateau-app. It consumes the WE conformance engine (#1576) + the target implementer's binding + Plateau vision (Layer-3, #475) as services. Also decide here the home of Layer-1 fui:tools/explorer/oracles/genericInvariants.ts (app-agnostic no-crash/no-a11y) — the #1565 residual: Plateau product-engine vs a shared platform-UX lib. Unblocked 2026-06-24: #1576 (engine's WE home) resolved — the engine's `ConformanceBinding` interface now lives in WE (#1596) and the runner/judge impl in Plateau (#1597), so this CLI-chrome move can proceed.

## Re-scope finding (batch-2026-06-23-1725-1665) — blocked-in-fact + embedded fork; `blockedBy: 1747`

Claimed and ground the move: it is **not** the mechanical FUI→Plateau file move the card implies. The four product-surface files import ~10 FUI explorer-**engine** internals (`fui:tools/explorer/stateFlowGraph.ts`, `fui:tools/explorer/oracles/observation.ts`, `fui:tools/explorer/workbenchHarness.ts`, `fui:tools/explorer/routeSweep.ts`, `fui:tools/explorer/gate.ts`, `fui:tools/explorer/gateRunner.ts`, `fui:tools/explorer/docsSiteHarness.ts`, `fui:tools/explorer/authRecipe.ts`, …) that stay in FUI under #1565 — and **plateau-app has no `@frontierui` dependency** (verified absent in `plateau:package.json`). So the move needs a Plateau→FUI package boundary + a curated explorer-engine public API stood up first (a design call), plus the explicit #1565 residual decision on the `genericInvariants` home. The stated "unblocked by #1576" was a **false edge** — #1576 landed the *conformance* engine, a different engine than the explorer engine the CLI orchestrates.

Filed the coupled decision as **#1747** and re-pointed `blockedBy: 1747`; set back to `open`. Not pure-agent buildable until that settles; `/batch` declined it as blocked-in-fact (fork) and released the claim.
