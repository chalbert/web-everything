---
type: idea
workItem: story
size: 5
parent: "1018"
status: resolved
blockedBy: ["1048"]
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "we:contracts/positioning.ts"
tags: []
---

# webpositioning provider — finish and surface the WE seam over the FUI runtime

Slice B of webpositioning impl epic #1018 (blockedBy slice A contract). Complete and surface the WE-side seam over the existing FUI anchor-positioning runtime (fui:blocks/droplist/positioning/) so the standard resolves through the contract; runtime stays FUI (boundary). This is finish/surface, not build-from-scratch.

## Progress

Surfaced the seam as the published **FUI→WE arrow**, the same way every other shipped provider seam is
surfaced — there is no WE-side runtime to add (the `we:positioning/contract.ts` ruling already homes the native CSS-anchor
strategy, the JS fallback, the feature-detected resolver, and the `customPositioning` swap registry in FUI,
so a WE-side runtime provider module would violate the boundary). Two changes:

- `we:contracts/positioning.ts` — the `@webeverything/contracts/positioning` subpath entry, a type-only
  re-export (`export type * from '../positioning/contract'`, zero runtime emit) of the slice-A contract
  module. Mirrors `we:contracts/analytics.ts` / `we:contracts/guard.ts`. This is the specifier over which an
  independent positioning engine satisfies `PositioningStrategy` without any runtime crossing the seam.
- `we:contracts/package.json` — registered `./positioning` in `exports` (after `./guard`) and listed
  positioning among the surfaced provider seams in the package description.

The conformance demo (#1050, sibling slice) imports the contract via the relative `we:positioning/contract.ts`
path, so it is unaffected. The JSON discovery surfaces (`we:src/_data/projects/webpositioning.json`,
`we:src/_data/protocols/anchor-positioning.json`) already describe the protocol and match the
`status: concept` convention used by the equally-shipped `guard` protocol, so no JSON change was needed.
