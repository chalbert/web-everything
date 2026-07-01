// @webeverything/contracts/dev-metrics — the anonymized dev-metrics vocabulary's pure-contract surface
// (#1849, ratified #1797). Type-only re-export (zero runtime emit) of the canonical vocabulary module; the
// runtime impl — the reference emitter (salted install-id, opt-in consent, platform sink) — is FUI's
// (fui:plugs/webanalytics/devMetrics.ts), which imports this to satisfy `DevMetricsSink` without any
// runtime crossing the seam, exactly like `./analytics`.
export type * from '../analytics/dev-metrics';
