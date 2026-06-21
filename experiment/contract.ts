/**
 * Experiment (variant-assignment) protocol — the **pure-contract half** (#1479, ratified #1414 Fork 2).
 *
 * Types and interfaces only: this module is fully **compile-erased** (no runtime emit) so it can become
 * the `@webeverything/contracts/experiment` entry (#872/#874) that FUI depends on (the FUI→WE arrow),
 * superseding byte-replication — exactly like `guard/contract.ts`. The runtime half — the native-first
 * default provider (always the control arm), any bucketing/SDK-backed provider, the swap registry — is
 * impl and lives in FUI; only the contract crosses the seam.
 *
 * This **reuses the Guard seam pattern** (#1414): a declarative concern (which arm renders) resolved by
 * a **swappable** `CustomEvaluationProvider` — native-first default → project override → custom plug —
 * NOT a redefinition of it. The deliberate divergences from Guard, ruled in #1414, are encoded here:
 *  - **No security semantics.** A variant arm is *not* an authorization verdict — `EvaluationResult`
 *    carries `{ value, variant, reason }` (which arm + why), never `allow`. A boolean access-control
 *    gate is the separate Guard concern (#1481); same provider *shape*, different outcome family
 *    (pick-one-of-N vs allow/deny) and trust boundary.
 *  - **OpenFeature vocabulary, borrowed verbatim.** `variant` + `reason` and the {@link EvaluationReason}
 *    enum are the OpenFeature evaluation-details surface; WE adopts the upstream vocab rather than
 *    inventing one (standards-bodies-are-upstream).
 *  - **Bucketing stays impl behind the provider.** *How* a unit is assigned to an arm (hash-bucket,
 *    server SDK, sticky override) is the provider's concern; the contract sees only the resolved arm.
 *  - **`evaluate` is async** (an assignment may need a server round-trip) and the front-end is a UX
 *    mirror, never the source of truth — mirroring Guard's trust-crossing rule.
 */

/** The OpenFeature evaluation `reason` enum, borrowed verbatim — why the provider returned this arm. */
export type EvaluationReason =
  | 'STATIC'
  | 'DEFAULT'
  | 'TARGETING_MATCH'
  | 'SPLIT'
  | 'CACHED'
  | 'DISABLED'
  | 'UNKNOWN'
  | 'ERROR';

/**
 * The targeting context for an assignment — the unit being bucketed (user / session / device) plus
 * arbitrary attributes a provider may target on. Opaque to the seam; OpenFeature's "evaluation context".
 */
export interface EvaluationContext {
  /** The stable assignment unit — the key a deterministic provider buckets on (e.g. user/session id). */
  readonly targetingKey?: string;
  /** Arbitrary targeting attributes (country, plan, cohort…). A provider keys arm assignment off these. */
  readonly attributes?: Record<string, unknown>;
}

/**
 * The resolved assignment — OpenFeature's evaluation-details shape. `variant` is the assigned arm's
 * name; `value` is the arm's payload (the experiment's typed value); `reason` is why. **No `allow`** —
 * an arm is not an authz verdict (#1414).
 */
export interface EvaluationResult<T = unknown> {
  /** The assigned arm's name within the experiment's open variant set (e.g. "control", "treatment-b"). */
  readonly variant: string;
  /** The arm's payload value (flag value / config). May be any type the experiment declares. */
  readonly value: T;
  /** Why this arm was returned (OpenFeature reason). `DEFAULT` ⇒ the native-first control fallback. */
  readonly reason: EvaluationReason;
}

/** Notified when a standing assignment is invalidated (flag flipped, experiment ended) and must re-resolve. */
export type AssignmentRevocationListener = (flagKey: string) => void;

/**
 * The injectable contract every variant-assignment provider satisfies — one interface, swappable impls
 * (the native-first control-arm default, a project override, a custom SDK-backed plug). `key` names it
 * for registration. `evaluate` is **async** and **trust-crossing**: it may consult a server, and its
 * answer is a UX mirror of the authoritative assignment, never the source of truth. `subscribe` is the
 * optional revocation signal — a provider whose assignment can change at runtime (flag flip, ramp)
 * implements it; a static provider omits it.
 */
export interface CustomEvaluationProvider {
  readonly key: string;
  /**
   * Resolve the arm assigned to `context` for experiment `flagKey`, falling back to `defaultVariant`
   * (the control arm, `reason: 'DEFAULT'`) when the experiment is absent/disabled. Async by contract.
   */
  evaluate<T = unknown>(
    flagKey: string,
    defaultVariant: string,
    context?: EvaluationContext,
  ): Promise<EvaluationResult<T>>;
  /** Watch for invalidation of a standing assignment; returns an unsubscribe. Optional. */
  subscribe?(flagKey: string, onRevoke: AssignmentRevocationListener): () => void;
}
