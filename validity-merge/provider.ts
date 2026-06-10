/**
 * Validity-merge strategy plane — the swappable concern behind a control's merged validity
 * (#212, falls out of #004's OP-1 ruling).
 *
 * #004 OP-1 mandates the **surface protocol** — the `MergedValidity` hand-off shape (plus the four
 * observable interaction regions and stable-id events tracked by the broader validation work) —
 * **not** the merge math. *How* a control reduces several independent `SourceResult`s into one
 * `MergedValidity` is a swappable concern: a `CustomValidityMergeStrategy` resolved through a
 * `CustomValidityMergeRegistry` (sibling to the async `CustomValidatorResolution` plane). Custom
 * strategies are first-class — the **only** constraint is they must emit the surface contract
 * (`assertMergedValidity` enforces it): vary the computation, never the surface, else L1
 * swappability (#004 OP-11) breaks.
 *
 * This module ships the surface types, the surface guard, and the two registered strategies:
 * **source-reduction** (the native-first default) and **last-write-wins** (the degenerate
 * single-source reduction — the old "flat flag"). The registry + auto-stamping orchestrator live in
 * `./registry.ts`; the default wiring in `./index.ts`. Like the capability provider (#204) this is a
 * standalone, dependency-free model of the contract — the runtime plug fulfils the same shape.
 */

/** The state a single named validity source reports. `pending` carries a generation `version`. */
export type SourceState = 'idle' | 'valid' | 'invalid' | 'pending';

export const SOURCE_STATES: readonly SourceState[] = ['idle', 'valid', 'invalid', 'pending'];

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

/** A strategy returned a value that is not a conformant `MergedValidity` (surface contract broken). */
export class SurfaceContractError extends Error {
  constructor(key: string, why: string) {
    super(`Merge strategy "${key}" broke the MergedValidity surface contract: ${why}`);
    this.name = 'SurfaceContractError';
  }
}

/** Narrow an unknown value to `MergedValidity` — the runtime shape of the #004 OP-1 surface. */
export function isMergedValidity(v: unknown): v is MergedValidity {
  if (typeof v !== 'object' || v === null) return false;
  const m = v as Record<string, unknown>;
  return (
    typeof m.state === 'string' &&
    (SOURCE_STATES as readonly string[]).includes(m.state) &&
    typeof m.valid === 'boolean' &&
    typeof m.pending === 'boolean' &&
    Array.isArray(m.messages) &&
    m.messages.every(
      (x) =>
        typeof x === 'object' &&
        x !== null &&
        typeof (x as ValidityMessage).source === 'string' &&
        typeof (x as ValidityMessage).message === 'string',
    ) &&
    (m.blocking === null || typeof m.blocking === 'string') &&
    typeof m.version === 'number'
  );
}

/**
 * Enforce the surface contract on a strategy's output (the OP-1 constraint, in code): a custom
 * strategy may vary the computation freely, but if it does not emit a conformant `MergedValidity`
 * it forfeits L1 swappability — so the orchestrator throws rather than hand a malformed surface on.
 * Returns the value (typed) when valid; throws `SurfaceContractError` otherwise.
 */
export function assertMergedValidity(key: string, v: unknown): MergedValidity {
  if (!isMergedValidity(v)) throw new SurfaceContractError(key, 'output is not a MergedValidity');
  // Internal consistency the shape check alone can't catch — keeps the convenience flags honest.
  if (v.valid !== (v.state === 'valid')) throw new SurfaceContractError(key, '`valid` disagrees with `state`');
  if (v.pending !== (v.state === 'pending')) throw new SurfaceContractError(key, '`pending` disagrees with `state`');
  if (v.state !== 'invalid' && v.blocking !== null)
    throw new SurfaceContractError(key, '`blocking` must be null unless the merged state is invalid');
  return v;
}

/** The native-first default precedence over the standard named sources. */
export const DEFAULT_PRECEDENCE: readonly string[] = ['native', 'schema', 'async', 'manual'];

/** Latest generation token across a set of sources — the merged result inherits it (stable-id). */
function maxVersion(sources: SourceResult[]): number {
  return sources.reduce((max, s) => Math.max(max, s.version ?? 0), 0);
}

/** Order a source set by a declared precedence; unknown sources sort after known ones, input-stable. */
function byPrecedence(precedence: readonly string[]): (a: SourceResult, b: SourceResult) => number {
  const rank = (s: string) => {
    const i = precedence.indexOf(s);
    return i === -1 ? precedence.length : i;
  };
  return (a, b) => rank(a.source) - rank(b.source);
}

/**
 * **Source-reduction** — the native-first default strategy. Reduces named sources by *kind*, not by
 * arrival order:
 *   - any source `pending` → merged `pending` (a value still being checked is not yet valid);
 *   - else any source `invalid` → merged `invalid`, `blocking` = the highest-precedence invalid
 *     source, `messages` = every invalid source's message in precedence order;
 *   - else any source `valid` → merged `valid`;
 *   - else (all idle / empty) → merged `idle`.
 *
 * This is the "strictest-wins" answer to the webvalidation merge-strategy open question: any source
 * failing fails the field; declared precedence only orders which message leads and which source is
 * named as blocking. Precedence is injectable (defaults to `DEFAULT_PRECEDENCE`).
 */
export class SourceReductionStrategy implements CustomValidityMergeStrategy {
  readonly key = 'source-reduction';
  readonly #precedence: readonly string[];

  constructor(precedence: readonly string[] = DEFAULT_PRECEDENCE) {
    this.#precedence = precedence;
  }

  merge(sources: SourceResult[]): MergedValidity {
    const version = maxVersion(sources);

    if (sources.some((s) => s.state === 'pending'))
      return { state: 'pending', valid: false, pending: true, messages: [], blocking: null, version };

    const invalid = sources
      .filter((s) => s.state === 'invalid')
      .sort(byPrecedence(this.#precedence));
    if (invalid.length) {
      const messages = invalid
        .filter((s) => s.message)
        .map((s) => ({ source: s.source, message: s.message as string }));
      return { state: 'invalid', valid: false, pending: false, messages, blocking: invalid[0].source, version };
    }

    if (sources.some((s) => s.state === 'valid'))
      return { state: 'valid', valid: true, pending: false, messages: [], blocking: null, version };

    return { state: 'idle', valid: false, pending: false, messages: [], blocking: null, version };
  }
}

/**
 * **Last-write-wins** — the degenerate single-source reduction (the old "flat flag"). The merged
 * validity is just the most recently written source (highest generation token; input order breaks a
 * tie), so independent sources clobber rather than combine. It still emits a conformant
 * `MergedValidity`, so it conforms (L1) and stays swappable — which is the whole point of codifying
 * it as a registered strategy rather than a special case.
 */
export class LastWriteWinsStrategy implements CustomValidityMergeStrategy {
  readonly key = 'last-write-wins';

  merge(sources: SourceResult[]): MergedValidity {
    if (!sources.length)
      return { state: 'idle', valid: false, pending: false, messages: [], blocking: null, version: 0 };

    const last = sources.reduce((latest, s) => ((s.version ?? 0) >= (latest.version ?? 0) ? s : latest));
    const version = last.version ?? 0;
    const messages =
      last.state === 'invalid' && last.message ? [{ source: last.source, message: last.message }] : [];
    return {
      state: last.state,
      valid: last.state === 'valid',
      pending: last.state === 'pending',
      messages,
      blocking: last.state === 'invalid' ? last.source : null,
      version,
    };
  }
}
