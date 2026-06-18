// Pure capacity-estimate helpers for the points-budgeted batch (backlog #553, building on the
// context-weighted-mean estimator). Kept in a pure module — no argv, no file I/O — so it's
// unit-testable without triggering backlog.mjs's CLI dispatch on import.
//
// The estimator is a context-weighted mean over the retained sample window, but a context weight alone
// can't fix one bias: a session that stopped for a NON-capacity reason (the work-list ran dry, a design
// fork surfaced, the gate went red, a manual abort) never measured how much a session *fits* — its
// `points ÷ context-fraction` is an extrapolation from an arbitrary early cutoff, biased low by fixed
// startup overhead. Folding those in just drags the budget. So only **capacity-bound** sessions
// (stopped because the points budget or the context window was the binding constraint) train the estimate.

// Stop reasons that did NOT exhaust budget/context — these never train the estimate.
//   empty-pool/empty — no eligible item left;  fork — a design decision surfaced;
//   gate — a red gate halted the run;           manual/abort — the operator stopped early;
//   outgrew — an item outgrew its estimate mid-work (the rule-4 stop). All measure an arbitrary
//   early cutoff, not how much a session fits, so folding them in just drags the budget low (#968).
export const NON_TRAINING_STOPS = new Set(['empty-pool', 'empty', 'fork', 'gate', 'manual', 'abort', 'outgrew']);

// Capacity-bound stops that DO train: the budget filled, or the context window was the limit.
export const TRAINING_STOPS = new Set(['budget', 'context']);

// Every stop reason the calibrate CLI recognises. A `--stop-reason` token outside this set is a typo
// or an un-listed reason — the CLI rejects it (fail-closed) rather than letting it silently train and
// corrupt the estimate (#968): a stray `outgrew`-class token once dragged capacityPoints 147→43.
export const KNOWN_STOP_REASONS = new Set([...TRAINING_STOPS, ...NON_TRAINING_STOPS]);

/** Is this a stop reason the calibrate CLI recognises? (Empty/absent is allowed — see calibrate.) */
export function isKnownStopReason(stopReason) {
  return KNOWN_STOP_REASONS.has(stopReason);
}

/**
 * Does a session with this stop reason train the capacity estimate? Capacity-bound (`budget`/`context`)
 * → yes; a known non-capacity stop → no. An absent reason defaults to YES — backward compatible with
 * old samples and callers that don't record a reason (the context weighting still de-risks a low-signal
 * one). An *unknown non-empty* token must never reach here from the CLI (it's rejected upstream by
 * `isKnownStopReason`); if one does, we still fail-open for backward compat, but the CLI is the guard.
 */
export function trainsEstimate(stopReason) {
  if (typeof stopReason !== 'string' || stopReason === '') return true;
  if (NON_TRAINING_STOPS.has(stopReason)) return false;
  return true; // 'budget'/'context' train; an unrecognised token fails-open here but is gated by the CLI
}

/**
 * Context-weighted mean of `impliedCapacity` over the samples that train the estimate (those not
 * `excluded`): Σ(impliedᵢ·ctxᵢ) / Σ(ctxᵢ). Returns null when no training sample carries positive
 * weight, so the caller can fall back to the prior estimate.
 */
export function capacityFromSamples(samples) {
  const training = (Array.isArray(samples) ? samples : []).filter((s) => s && !s.excluded);
  const wsum = training.reduce((sum, x) => sum + (Number(x.contextPct) || 0), 0);
  if (wsum <= 0) return null;
  const acc = training.reduce((sum, x) => sum + (Number(x.impliedCapacity) || 0) * (Number(x.contextPct) || 0), 0);
  return Math.round(acc / wsum);
}
