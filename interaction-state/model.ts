/**
 * Interaction-state model (#1110, webvalidation completion #1090).
 *
 * The L1 observable model of a control's **interaction** state — orthogonal to its *validity* (which
 * webvalidation's validity-merge owns). A field is `invalid` from the first keystroke, but a UI shows the
 * error only once the user has *touched* and *left* it; that gating needs interaction state, not validity.
 * Spec: `we:src/_includes/project-webvalidation.njk` (the InteractionState shape).
 *
 * Pure + framework-free: a {@link InteractionStateTracker} wires to a control's native events and derives
 * the four flags; it patches no global and a consumer (e.g. `<validity-merge-field>`) reflects them as
 * `data-dirty` / `data-touched` attributes.
 */

/** The four interaction flags. `dirty` = value changed from baseline; the rest follow native UX. */
export interface InteractionState {
  /** The value differs from the baseline (the value at construction / last `reset`). */
  dirty: boolean;
  /** The control has been interacted with (input or blur after focus). */
  touched: boolean;
  /** The control currently has focus. */
  focused: boolean;
  /** The owning form has been submitted at least once. */
  submitted: boolean;
}

/** Anything carrying a `value` and the native event surface a tracker listens to. */
interface ControlLike extends EventTarget {
  value?: string;
}

const IDLE: InteractionState = Object.freeze({ dirty: false, touched: false, focused: false, submitted: false });

/**
 * Derives {@link InteractionState} from a control's native events: `input` → dirty (vs baseline) +
 * touched; `focus`/`blur` → focused, and blur → touched; an external `markSubmitted()` (wired to the
 * form's `submit`) → submitted. `reset()` re-baselines (dirty clears). Subscribers are notified on every
 * change; `attach`/`detach` are idempotent so it composes with a custom element's connect/disconnect.
 */
export class InteractionStateTracker {
  #state: InteractionState = { ...IDLE };
  #baseline = '';
  #control: ControlLike | null = null;
  readonly #subscribers = new Set<(state: InteractionState) => void>();

  /** The current immutable snapshot. */
  get state(): InteractionState {
    return { ...this.#state };
  }

  /** Wire to a control, baselining its current value. Idempotent (re-attaching to the same control is a no-op). */
  attach(control: ControlLike): void {
    if (this.#control === control) return;
    this.detach();
    this.#control = control;
    this.#baseline = control.value ?? '';
    control.addEventListener('input', this.#onInput);
    control.addEventListener('focus', this.#onFocus);
    control.addEventListener('blur', this.#onBlur);
  }

  /** Unwire from the current control (idempotent). */
  detach(): void {
    const c = this.#control;
    if (!c) return;
    c.removeEventListener('input', this.#onInput);
    c.removeEventListener('focus', this.#onFocus);
    c.removeEventListener('blur', this.#onBlur);
    this.#control = null;
  }

  /** Re-baseline to the control's current value — `dirty` clears, the other flags persist. */
  reset(): void {
    this.#baseline = this.#control?.value ?? '';
    this.#patch({ dirty: false });
  }

  /** Mark the owning form submitted (wire to the form's `submit`). */
  markSubmitted(): void {
    this.#patch({ submitted: true });
  }

  /** Subscribe to state changes; returns an unsubscribe. */
  subscribe(listener: (state: InteractionState) => void): () => void {
    this.#subscribers.add(listener);
    return () => this.#subscribers.delete(listener);
  }

  readonly #onInput = (): void => {
    this.#patch({ dirty: (this.#control?.value ?? '') !== this.#baseline, touched: true });
  };
  readonly #onFocus = (): void => {
    this.#patch({ focused: true });
  };
  readonly #onBlur = (): void => {
    this.#patch({ focused: false, touched: true });
  };

  #patch(delta: Partial<InteractionState>): void {
    const next = { ...this.#state, ...delta };
    if (
      next.dirty === this.#state.dirty &&
      next.touched === this.#state.touched &&
      next.focused === this.#state.focused &&
      next.submitted === this.#state.submitted
    ) {
      return; // no change — don't notify
    }
    this.#state = next;
    for (const s of this.#subscribers) s(this.state);
  }
}
