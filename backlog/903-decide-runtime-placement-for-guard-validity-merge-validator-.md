---
type: decision
workItem: story
size: 3
status: open
dateOpened: "2026-06-18"
tags: []
---

# Decide runtime placement for guard/validity-merge/validator-resolution given WE plugs consume the runtime (#817 B1 premise false)

#893 pre-flight (batch-2026-06-17) found #817 B1's premise false: it claims 'no check.ts gate, so nothing WE-side consumes the runtime' for guard/validity-merge/validator-resolution, but WE's own webguards + webvalidation plugs import RUNTIME values from these planes (NativeGuardProvider/assertGuardDecision/ALLOW/UnknownGuardProviderError from guard/provider+registry; SourceReductionStrategy/LastWriteWinsStrategy/UnknownStrategyError from validity-merge; VersioningResolution/CancellationResolution from validator-resolution). Moving the runtime to FUI (B1) breaks these plugs, and WE may not import FUI (npm-scope-mirrors-layer). The plugs are WE-only (not duplicated in FUI). Forks: (A) move the consuming webguards/webvalidation plugs to FUI too (big scope; re-opens plug placement); (B) keep the runtime in WE for these three planes as #817 exceptions — a WE plug consuming the runtime is the same keep-it-WE trigger that capability-manifest #730/#814 honored for its check.ts consumer (the placement test is 'does a WE-side artifact consume it', and a plug qualifies); (C) byte-replicate runtime to FUI (#170/#694 interim) so both copies exist. Lean B (~70%): the consuming-artifact test already kept capability-manifest WE; a plug is a legitimate WE consumer. Reconsiders #817 B1 for these planes (reversible per ratified-decisions-are-reversible). Blocks #893.
