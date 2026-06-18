---
type: idea
workItem: story
size: 13
parent: "315"
status: open
blockedBy: ["359", "735"]
locus: frontierui
dateOpened: "2026-06-16"
tags: []
---

# temporal block impl — variant traits + build-chunk assertion (re-slice)

Slice C of the picker work (/split 359, 2026-06-15) — the greenfield temporal IMPL track. Author `calendar-grid` / `clock` / `range-coordination` as separate CustomAttribute trait modules, register each in traitMap (lazy), have each named preset declare only the traits it binds, + the build-chunk assertion (#713: a time-only fixture pulls no calendar chunk). **Ownership ruled FUI-locus end-to-end (#779).** Re-slice with `locus: frontierui` into per-trait FUI tasks + the build-chunk dogfood — the pattern to slice against is FUI's existing `traits` family, so the old "no WE trait-impl pattern yet" block is gone.

History: deferred at /split 359 because WE had zero authored traits and no `blocks/temporal/`; the 2026-06-16 /split 736 re-slice attempt found the precondition still unmet — slices A (#359) and B (#735) graduated to standards-layer blocks.json contracts only (no trait/impl dir). That precondition is now moot. Ownership fork RULED (#779, ratified + resolved 2026-06-17): **FUI-locus, end-to-end.** WE is contracts-only and cannot hold code; the manifest format was further ruled an FUI-shaped IR, so the trait IMPL (`calendar-grid`/`clock`/`range-coordination` modules), the traitMap wiring, the build-chunk assertion, AND the trait-enforcer itself all sit in FUI — against already-shipping FUI infra (FUI's own `tools/trait-enforcer/`, `blocks/traits` family, lazy-trait demos). So the "no WE trait-impl pattern yet" precondition above is moot: the pattern to slice against is FUI's existing `traits` family, not a not-yet-existent WE one. **Re-slice this card with `locus: frontierui`** into per-trait FUI tasks + the build-chunk dogfood assertion (generic chunk-isolation conformance is separately owned by #720/#722). See #779 ruling + reports/2026-06-16-backlog-split-analysis.md. (Related: #894 relocates WE's misplaced enforcer copy out — independent of this card.)
