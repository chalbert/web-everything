// @webeverything/contracts/analytics — the Analytics protocol's pure-contract surface (#1003/#1012/#1013).
// Type-only re-export (zero runtime emit) of the canonical contract module; the runtime impl is FUI's.
// This is the FUI→WE arrow the reference vendor adapters (#1013: Segment/Mixpanel/GA4) import — they
// satisfy `CustomTracker` without a vendor SDK crossing the seam, exactly like `./guard`.
export type * from '../analytics/contract';
