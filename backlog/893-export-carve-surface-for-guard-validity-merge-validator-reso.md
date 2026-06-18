---
type: issue
workItem: story
size: 3
status: open
dateOpened: "2026-06-17"
tags: []
---

# Export+carve surface for guard / validity-merge / validator-resolution (per #817 B1 ruling)

Implement #817's B1 split for the three planes guard/, validity-merge/, validator-resolution/ — the cut is the contract.ts file seam: only the contract (types) stays WE, all runtime moves to FUI. WE side: per plane, add a package.json + exports map scoped @webeverything/* (name == specifier, #239) exporting only contract.ts (pure types/interfaces, incl. any registry interface type). FUI side: lift the entire runtime half — provider.ts (error classes, assert*/is* guards, constant data ALLOW/DEFAULT_PRECEDENCE/SOURCE_STATES, native-default strategy classes NativeGuardProvider/SourceReductionStrategy/LastWriteWinsStrategy/VersioningResolution/CancellationResolution) and registry.ts (registry classes + the stateful engines ValiditySourceOrchestrator/AsyncValidationRunner) — plus the impl-coupled __tests__, into FUI beside the plug, re-pointed to import the contract from @webeverything/*. Add FUI tsconfig paths + vite alias mapping the three @webeverything/* specifiers to ../webeverything/<dir>. No implementation stays in WE (these planes have no check.ts gate, so nothing WE-side consumes the runtime — contrast capability-manifest #730/#814, which kept its whole plane WE because check.ts consumes its assert). Whole-file move, cleaner than #814's mid-file service.ts carve. Unblocks #725.
