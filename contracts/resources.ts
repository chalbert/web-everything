// @webeverything/contracts/resources — the Resources protocol's pure-contract surface (#1027/#1074/#1075).
// Type-only re-export (zero runtime emit); the runtime impl (native client + pagination + customResources
// registry) is FUI's. The FUI→WE arrow, like ./guard and ./analytics.
export type * from '../resources/contract';
