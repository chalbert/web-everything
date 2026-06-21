// @webeverything/contracts/experiment — the Experiment (variant-assignment) protocol's pure-contract
// surface (#1479, ratified #1414 Fork 2). Type-only re-export (zero runtime emit) of the canonical
// contract module; the runtime impl is FUI's (the native-first control-arm default provider, any
// bucketing/SDK-backed provider, and the swap registry all live in FUI). This is the FUI→WE arrow over
// which the standard resolves: any provider satisfies `CustomEvaluationProvider` by returning the
// semantic `EvaluationResult` ({ value, variant, reason }) without any runtime crossing the seam,
// exactly like `./guard`. Reuses the Guard seam PATTERN with NO security semantics (an arm is not an
// authz verdict — the boolean access-control gate is the separate Guard concern, #1481).
export type * from '../experiment/contract';
