---
type: issue
workItem: story
size: 3
parent: "170"
status: open
locus: frontierui
dateOpened: "2026-06-19"
tags: [plugs, dedup, migration, frontierui]
---

# Package frontierui/plugs as @frontierui/plugs (dual exports + subpaths)

Add fui:plugs/package.json: '.' = unplugged library entry, '/bootstrap' = plugged POC, plus the subpath exports WE/plateau-app consume (core, webregistries, webinjectors, webcomponents, webcontexts, webbehaviors, webstates, webexpressions). Keep FU-only `fui:globals.d.ts`/`we:virtual-trait-manifest.d.ts`/`we:webbehaviors/traitManifest.ts` off the public surface. Foundational slice of #449 (per #606: plugs is FUI's, WE consumes as a no-leakage client). FUI build + vitest + e2e green against the package entry.
