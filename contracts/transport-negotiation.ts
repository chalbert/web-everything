// @webeverything/contracts/transport-negotiation — the Transport-Negotiation protocol's pure-contract
// surface (#1025/#1067/#1068). Type-only re-export (zero runtime emit); the runtime impl (native
// negotiating provider + customTransport registry) is FUI's. The FUI→WE arrow, like ./guard, ./analytics.
export type * from '../realtime/contract';
