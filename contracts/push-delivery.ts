// @webeverything/contracts/push-delivery — the Push-Delivery protocol's pure-contract surface
// (#1024/#1064/#1065). Type-only re-export (zero runtime emit) of the canonical contract module; the
// runtime impl (native Web Push provider + customPush registry) is FUI's. The FUI→WE arrow the
// push-delivery runtime imports, exactly like ./guard and ./analytics.
export type * from '../notifications/push-contract';
