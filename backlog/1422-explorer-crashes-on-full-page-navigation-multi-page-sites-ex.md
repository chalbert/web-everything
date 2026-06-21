---
kind: story
size: 3
locus: frontierui
status: resolved
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: "fui:tools/explorer/cli.ts"
tags: []
---

# Explorer crashes on full-page navigation (multi-page sites): execution context destroyed on link-click nav — blocks the docs-site sweep against the WE docs (:8080)

Reproduced 2026-06-21: `npm run explore -- http://localhost:8080/` (the live WE docs) dies with `page.evaluate: Execution context was destroyed, most likely because of a navigation`. Root cause is a **wiring bug in the CLI, not the engine**: `fui:tools/explorer/cli.ts` routes the default EXPLORE profile through `stressTestComponent` (the workbench harness), which assumes in-place SPA state — so a link click on a multi-page site tears down the execution context. The nav-aware path **already exists** (`fui:tools/explorer/docsSiteHarness.ts` `sweepSite`, #1171, whose smoke crawls `:8080` across navigations) — the CLI just never calls it. Seed-only works and flags the overflow; any real CLI exploration crashes.

## Scope

1. **Route the CLI to the right harness for the target.** When pointed at a multi-page site, the CLI should use the nav-aware `sweepSite` (#1171) rather than `stressTestComponent`. Either auto-detect (component/workbench URL vs site URL) or add an explicit `--site` flag. This is the minimal fix — the nav-aware crawl logic already exists.
2. **Optionally unify**: make `stressTestComponent` itself navigation-tolerant (wait for the new document + re-acquire context after a navigating click) so the workbench path degrades gracefully instead of throwing, without regressing in-place SPA state changes.
3. Add a multi-page fixture to the #1421 self-regression suite so a CLI/harness mis-wire can't silently return.

## Notes

- FUI-owned explorer (epic #1167); `locus: frontierui`. CLI is #1219; nav-aware sweep is #1171.
- Surfaced while validating the explorer against the WE-site overflow (#1412) at the user's request. The engine *can* sweep a multi-page site (#1171); the runnable CLI wires the wrong harness, so `npm run explore <site-url>` crashes today.

## Progress

- Scope 1 (the minimal fix): fui:tools/explorer/cli.ts now routes multi-page sites to the existing
  nav-aware `sweepSite` (#1171) instead of `stressTestComponent`. Routing decision factored into a pure
  fui:tools/explorer/cliRouting.ts `shouldSweepSite(url, siteFlag)` — true on an explicit `--site` flag
  OR when the target is a site root (`/`), since a component stress-test always points at a specific
  component path, never the bare root. So `npm run explore -- http://localhost:8080/` (the exact repro)
  now sweeps instead of crashing on the first navigating link click.
- Also fixed an adjacent bug: the CLI built `profile` with `undefined` maxStates/maxDepth, which on
  spread would clobber `SITE_SWEEP_PROFILE`'s defaults — now only defined overrides are passed.
- Scope 3 (regression guard): fui:tools/explorer/__tests__/cliRouting.test.ts pins the routing (site
  root → sweep, component path → workbench, `--site` override, malformed-URL safety). 4/4 green; FUI gate
  0 errors. (The multi-page *fixture* for the #1421 self-regression gallery is folded into #1421, the
  next slice, which builds that suite.)
- Scope 2 (make stressTestComponent itself navigation-tolerant) deliberately NOT done — it is the
  optional hardening; the minimal correct fix is the routing, and over-broadening the workbench harness
  risks regressing in-place SPA-state detection. Left for a follow-up if the workbench ever needs to
  tolerate a navigating click.
</content>
