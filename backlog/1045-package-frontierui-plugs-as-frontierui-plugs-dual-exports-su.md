---
type: issue
workItem: story
size: 3
parent: "170"
status: resolved
locus: frontierui
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "fui:plugs/package.json"
tags: [plugs, dedup, migration, frontierui]
---

# Package frontierui/plugs as @frontierui/plugs (dual exports + subpaths)

Add fui:plugs/package.json: '.' = unplugged library entry, '/bootstrap' = plugged POC, plus the subpath exports WE/plateau-app consume (core, webregistries, webinjectors, webcomponents, webcontexts, webbehaviors, webstates, webexpressions). Keep FU-only `fui:globals.d.ts`/`we:virtual-trait-manifest.d.ts`/`we:webbehaviors/traitManifest.ts` off the public surface. Foundational slice of #449 (per #606: plugs is FUI's, WE consumes as a no-leakage client). FUI build + vitest + e2e green against the package entry.

## Progress

Added `fui:plugs/package.json` (`@frontierui/plugs`, source-distributed `.ts`): `.` → unplugged
`index.ts`, `/unplugged`, `/bootstrap` → plugged POC, plus the 8 subpath exports WE/plateau consume
(core, webregistries, webinjectors, webcomponents, webcontexts, webbehaviors, webstates, webexpressions).
FU-only `globals.d.ts` / `virtual-trait-manifest.d.ts` / `webbehaviors/traitManifest.ts` kept off the
public surface (excluded from both `exports` and `files`). Verified: FUI vitest 763 pass, FUI
`check:standards` 0 errors, all 11 export targets resolve. The manifest is inert (no consumer imports the
package name yet — cross-repo alias wiring is a later #449 slice), so build/e2e behavior is unchanged by
construction; full Playwright e2e not separately run for a resolution-only change. Foundational slice of
#449 (per #606: plugs is FUI's, WE consumes as a no-leakage client).
