/**
 * The bridge from a merged validity result to the platform (#215): drive native
 * [`ElementInternals.setValidity`](https://developer.mozilla.org/en-US/docs/Web/API/ElementInternals/setValidity)
 * from a `MergedValidity`, so a custom control's merged state participates in `:invalid` /
 * `:user-invalid` and form submission for free — the platform tracks the user-interaction gate, the
 * control never re-exposes touched/dirty.
 *
 * Kept as a pure function over a minimal `ValiditySink` (the slice of `ElementInternals` it uses) so
 * the merge → setValidity mapping is unit-testable without a live form-associated element — the
 * element wiring lives in `ValidityMergeField`, the demo proves the native styling.
 */
import type { MergedValidity } from '../../validity-merge/provider.js';

/** The slice of `ElementInternals` this sink drives — lets tests pass a fake without a real element. */
export interface ValiditySink {
  setValidity(flags: ValidityStateFlags, message?: string, anchor?: HTMLElement): void;
}

/**
 * Map a `MergedValidity` onto a validity sink:
 *   - `valid` / `idle` → `setValidity({})` — the control is valid (idle is "nothing said yet", which
 *     the platform treats as valid until a constraint reports otherwise);
 *   - `invalid` → `setValidity({ customError: true }, blockingMessage)` — the blocking source's
 *     message leads (falling back to the first message, then a generic string);
 *   - `pending` → `setValidity({ customError: true }, 'Validating…')` — an unresolved async check must
 *     block submission, so pending is surfaced as a (transient) custom error rather than silently valid.
 *
 * Returns the message handed to the sink (or `''` when cleared) so callers can mirror it elsewhere.
 */
export function applyMergedValidity(
  internals: ValiditySink,
  merged: MergedValidity,
  anchor?: HTMLElement,
): string {
  if (merged.state === 'valid' || merged.state === 'idle') {
    internals.setValidity({});
    return '';
  }

  if (merged.state === 'pending') {
    const message = 'Validating…';
    internals.setValidity({ customError: true }, message, anchor);
    return message;
  }

  // invalid
  const blockingMessage =
    merged.messages.find((m) => m.source === merged.blocking)?.message ??
    merged.messages[0]?.message ??
    'Invalid';
  internals.setValidity({ customError: true }, blockingMessage, anchor);
  return blockingMessage;
}
