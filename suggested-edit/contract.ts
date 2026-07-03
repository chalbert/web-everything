/**
 * Suggested-Edit contract — the **pure-contract half** (#2145, ratified #2029 Fork 1 standalone split).
 *
 * Types and interfaces only: this module is fully **compile-erased** (no runtime emit) so it can become
 * the `@webeverything/contracts/suggested-edit` entry — the propose→accept/reject state machine both
 * `annotation` (suggestion body) and the Editor Engine protocol (apply) compose.  The runtime half —
 * apply dispatch, CRDT integration, optimistic-revert — is impl and lives in FUI; only the contract
 * crosses the seam.
 *
 * The genuinely hard, recurring, *unowned* problem this standardizes: a `suggestion` motivation
 * (WAI-ARIA 1.3 `role=suggestion`) wraps an insertion+deletion pair that rides on an annotation until
 * the viewer **accepts or rejects it** — a mutation that annotation (UX-only) cannot own.  The lifecycle
 * needs exactly one home.  That home is this contract, composed by both parties:
 *   • annotation: the `suggestion` motivation's **body** (`SuggestedEdit`, state `proposed`)
 *   • Editor Engine protocol: the **transaction to apply** (when the host is editable; record-only when
 *     read-only — PDF / foreign HTML / no engine present)
 *
 * The `SuggestedEditTarget` composes the #1471 `RangeAnchor` contract (the durable range-anchor seam):
 * this contract declares the *what* (the propose→accept/reject lifecycle), range-anchor declares the
 * *where* (re-resolvable after document edits).
 *
 * WAI-ARIA 1.3 grounding: `role=suggestion` (editor's draft Feb 2026) scopes the pattern to editable
 * documents and wraps one insertion and one deletion inside the suggestion element.  The `proposed`
 * field below directly models that insertion+deletion wrap.
 *
 * @module @webeverything/contracts/suggested-edit
 */

export type { SelectorBundle } from '../range-anchor/contract';
import type { SelectorBundle } from '../range-anchor/contract';

/**
 * The durable location of a suggestion in the host document — composes the #1471 RangeAnchor contract.
 * The `key` is the stable identity string from {@link RangeAnchor}; `bundle` is the W3C selector bundle
 * the range-anchor serializer captures.  Using a named interface keeps the `SuggestedEdit` type clean
 * and makes the composition seam explicit.
 */
export interface SuggestedEditTarget {
  /** Stable opaque identity — forwarded from {@link RangeAnchor.key}. */
  readonly key: string;
  /** The W3C selector bundle — forwarded from the range-anchor serialize step. */
  readonly bundle: SelectorBundle;
}

/**
 * The lifecycle state of a suggested edit.
 *
 * - `proposed`  — the author has proposed a change; no mutation has occurred yet.
 * - `accepted`  — the reviewer accepted the change; the Editor Engine applied (or will apply) it.
 * - `rejected`  — the reviewer rejected the change; the original text stands.
 */
export type SuggestedEditState = 'proposed' | 'accepted' | 'rejected';

/**
 * The payload the author proposes — models WAI-ARIA 1.3 `role=suggestion`'s insertion+deletion wrap.
 * At least one of `insert` or `deleteRange` must be present (a pure deletion, a pure insertion, or
 * both — a replacement).
 *
 * - `insert`      — text to insert at the start of `target` (the ARIA insertion element's text content).
 * - `deleteRange` — `true` when the entire anchored range is proposed for deletion (the ARIA deletion
 *   element); the actual bytes are implied by `target`.
 */
export interface SuggestedPayload {
  /** Text to insert at the start of the target range (ARIA insertion element). */
  readonly insert?: string;
  /** Whether the anchored range itself is proposed for deletion (ARIA deletion element). */
  readonly deleteRange?: true;
}

/**
 * A single **suggested edit** — the propose→accept/reject state machine that annotation and the Editor
 * Engine protocol both compose.
 *
 * annotation composes it as the `suggestion` motivation's body:  the `state` is always `proposed` at
 * annotation time; `accepted` and `rejected` are set by the apply step.
 *
 * The Editor Engine protocol composes it as the **transaction to apply** — present when the host is
 * editable; the engine dispatches an existing operation and flips `state` to `accepted`.  Over a
 * read-only host (no engine), `ApplyEdit` returns `'record-only'` and state remains `proposed`.
 */
export interface SuggestedEdit {
  /** The current lifecycle state. */
  readonly state: SuggestedEditState;
  /**
   * The durable location of the suggestion in the host document — a {@link SuggestedEditTarget} that
   * composes the #1471 RangeAnchor contract.  The anchor survives document re-fetches and light edits
   * via the W3C selector bundle + fuzzy fallback + first-class orphan.
   */
  readonly target: SuggestedEditTarget;
  /**
   * The proposed mutation — what the author wants to insert and/or delete.  At least one field must be
   * present.
   */
  readonly proposed: SuggestedPayload;
}

/**
 * The result of an apply attempt.
 *
 * - `'applied'`     — the host is editable; the Editor Engine dispatched the transaction and the
 *   mutation is in effect (the `SuggestedEdit.state` should be updated to `'accepted'`).
 * - `'record-only'` — the host is read-only (no engine, PDF, foreign HTML); the proposal is recorded
 *   but no mutation occurred.  `SuggestedEdit.state` remains `'proposed'`.
 */
export type ApplyResult = 'applied' | 'record-only';

/**
 * The injectable apply step — the Editor Engine protocol's seam for dispatching a suggested-edit
 * transaction.
 *
 * Present only when the host is editable.  Over a read-only host, consumers call this as `undefined`
 * (or supply the no-op default that returns `'record-only'`).
 *
 * @param edit   - The suggested edit to apply.  Must be in state `'proposed'`.
 * @param engine - The Editor Engine instance, when available.
 * @returns      `'applied'` if the engine dispatched the transaction; `'record-only'` otherwise.
 */
export type ApplyEdit = (edit: SuggestedEdit, engine?: unknown) => ApplyResult;

/**
 * The initial state when a suggestion is first created — a named constant so callers that
 * only ever produce proposals can reference the literal without hard-coding the string.
 * (Analogous to {@link DEFAULT_ANCHOR_STRATEGY} in the range-anchor contract.)
 */
export const SUGGESTED_EDIT_INITIAL_STATE: SuggestedEditState = 'proposed';
