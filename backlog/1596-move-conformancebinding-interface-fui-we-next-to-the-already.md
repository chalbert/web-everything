---
kind: story
size: 3
parent: "1576"
status: resolved
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: "we:conformance-vectors/binding.ts"
tags: []
---

# Move ConformanceBinding interface FUI→WE, next to the already-WE vector schema

Move the ConformanceBinding + ConformanceBindingFactory interfaces from fui:tools/explorer/oracles/conformanceVectors.ts to a new we:conformance-vectors/binding.ts (@webeverything/conformance-vectors/binding type sub-path, next to the already-WE schema+corpus); re-point importers (fui:tools/explorer/oracles/conformanceVectors.ts, fui:blocks/deck/deckConformance.ts, fui:tools/explorer/oracles/index.ts + tests). Type-only, no fork. Root slice of #1576. WE→FUI per #1566/#700/#872.

## Progress

Done (batch-2026-06-22-1596-1593):
- New `we:conformance-vectors/binding.ts` holds the type-only contract: `ConformanceBinding`,
  `ConformanceBindingFactory`, **and** `ConformanceClock`. The clock-verb *interface* had to co-move (forced,
  not a fork): `ConformanceBinding.clock: ConformanceClock` would otherwise force a forbidden WE→FUI back-edge.
  Per #1576-(1) the clock contract is part of the declarative conformance definition; the runnable
  `VirtualClock` **impl** stays FUI for now and relocates to the neutral runner home via #1597.
- `fui:tsconfig.json` adds the `@webeverything/conformance-vectors/binding` path map (type-only; no vite alias
  needed since the import is erased at build).
- Re-pointed importers to the WE sub-path: `fui:tools/explorer/oracles/virtualClock.ts` (imports the
  `ConformanceClock` type, `implements` it), `fui:tools/explorer/oracles/conformanceVectors.ts` (drops the 3
  local interface defs), `fui:tools/explorer/oracles/index.ts` barrel,
  `fui:blocks/deck/deckConformance.ts`, and the conformance test. FUI's concrete
  `DeckConformanceBindingFactory` class correctly stays FUI.
- Verified: `tsc --noEmit` clean for the changeset (2 pre-existing errors in unrelated `plugs/` files);
  conformance + deck-conformance vitest suites green (10/10).
