// @webeverything/contracts/repro-bundle — the repro-bundle's pure-contract surface (#1664, epic #1663).
// Type-only re-export (zero runtime emit) of the canonical contract module. WE owns ONLY this shape; the
// capture mechanism that produces a bundle is plateau (#1667), the viewer that reads one is FUI, and the
// serializer (#1666) maps a captured trace onto it — the structural validator / serializer / JSON schema
// live in the runtime sibling `repro-bundle/schema.ts` (the build-agnostic contract runtime, not the
// type-only published surface). The FUI/plateau→WE arrow imports it exactly like `./reproduction-parity`.
export type * from '../repro-bundle/contract';
