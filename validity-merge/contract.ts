/**
 * Validity-merge strategy plane — the **pure-contract half** (#212, falls out of #004's OP-1 ruling).
 *
 * Types and interfaces only: this module is fully **compile-erased** (no runtime emit) so it can become
 * the `@webeverything/contracts/validity-merge` entry (#872/#874) that FUI depends on, superseding
 * byte-replication. The runtime half — the surface guard, the precedence default, and the two shipped
 * strategies — lives in `./provider.ts` (impl, → FUI); the registry + auto-stamping orchestrator in
 * `./registry.ts`; the default wiring in `./index.ts`.
 *
 * #004 OP-1 mandates the **surface protocol** — the `MergedValidity` hand-off shape — **not** the merge
 * math. *How* a control reduces several independent `SourceResult`s into one `MergedValidity` is a
 * swappable concern (a `CustomValidityMergeStrategy`). Custom strategies are first-class — the **only**
 * constraint is they must emit the surface contract (`assertMergedValidity` in `./provider.ts` enforces
 * it): vary the computation, never the surface, else L1 swappability (#004 OP-11) breaks.
 */

/** The state a single named validity source reports. `pending` carries a generation `version`. */
export type SourceState = 'idle' | 'valid' | 'invalid' | 'pending';

/**
 * One named source's current result — the merge input. `source` is a stable name
 * (`native`/`schema`/`async`/`manual`, or a custom one); `version` is the generation token the
 * orchestrator auto-stamps (so a dev setting a server error never hand-authors ids) and a `pending`
 * async result carries so a late, stale answer can be dropped.
 */
export interface SourceResult {
  source: string;
  state: SourceState;
  /** Human-facing message when `state === 'invalid'`. */
  message?: string;
  /** Generation token — auto-stamped by the orchestrator; hand-authored only for explicit staleness. */
  version?: number;
}

/** One message in a merged result, tagged with the source it came from. */
export interface ValidityMessage {
  source: string;
  message: string;
}

/**
 * The surface contract every strategy must emit (#004 OP-1). The hand-off shape a control hands to
 * its view layer: the reduced `state`, convenience `valid`/`pending` flags, the ordered `messages`
 * with their sources, which source `blocking`s the merged state (`null` when not invalid), and the
 * `version` generation token of this merged result (the stable id the broader surface events key on).
 */
export interface MergedValidity {
  state: SourceState;
  valid: boolean;
  pending: boolean;
  messages: ValidityMessage[];
  blocking: string | null;
  version: number;
}

/**
 * The injectable contract every merge strategy satisfies — one interface, swappable impls
 * (source-reduction, last-write-wins, custom). `key` names the strategy for registration; `merge`
 * reduces the named source results to the surface contract.
 */
export interface CustomValidityMergeStrategy {
  readonly key: string;
  merge(sources: SourceResult[]): MergedValidity;
}
