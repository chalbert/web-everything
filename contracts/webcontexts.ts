// @webeverything/contracts/webcontexts — webcontexts' declared per-seam value-contract, the pure-contract
// surface (#1700). Type-only re-export (zero runtime emit) of the canonical contract module. WE owns ONLY
// this declared per-seam value SHAPE (the missing piece the webcontexts runtime #1091 + introspection #400
// never declared); the live contract/data inspector (#1632/#1697) consumes it to validate actual-vs-declared
// and flag the offending path. The FUI/plateau→WE arrow imports it like `./credential-management`.
export type * from '../webcontexts/contract';
