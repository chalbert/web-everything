/**
 * `<validity-merge-field>` (#215) — a form-associated custom control that delegates its validity to
 * the `customValidityMerge` plug, proving the strategy plane drives a *real* control.
 *
 * It owns no merge math: it resolves the page's strategy **per-scope** through the injector chain
 * (`InjectorRoot.getProviderOf` — nearest-scope-wins, #207 D6; falling back to the global registry),
 * feeds the four named sources (`native`/`schema`/`async`/`manual`) into a
 * `ValiditySourceOrchestrator`, and pushes every merged result onto `ElementInternals.setValidity`
 * via `applyMergedValidity`. Because the merged state flows through `setValidity`, the control gets
 * native `:invalid` / `:user-invalid` styling and form-submission blocking for free — the answer to
 * the webvalidation `:user-invalid` open question (the UA tracks the user-interaction gate; the
 * control never re-exposes touched/dirty).
 *
 * Swapping the strategy (`strategy="last-write-wins"` or `.useStrategy()`) re-resolves and recomputes
 * with zero source-feeding edits — the whole point of the plane.
 *
 * #218 — the `native` source is **auto-derived** from the inner form control's `ValidityState`
 * (`required`/`type=email`/`pattern`/… ): on connect and on the control's `input`/`change`/`invalid`
 * events the control's validity is mapped to the `native` source, so a dev only wires the *non-native*
 * sources. An explicit `setSource('native', …)` still wins (the auto-derive backs off until the
 * manual source is `clearSource`d) — explicit over inferred, the native-first default in practice.
 */
import type { SourceUpdate, ValiditySourceOrchestrator } from '../../validity-merge/registry.js';
import { ValiditySourceOrchestrator as Orchestrator } from '../../validity-merge/registry.js';
import type { MergedValidity } from '../../validity-merge/provider.js';
import InjectorRoot from '../webinjectors/InjectorRoot';
import CustomValidityMergeRegistry from './CustomValidityMergeRegistry';
import { applyMergedValidity } from './applyMergedValidity';

declare global {
  interface Window {
    customValidityMerge?: CustomValidityMergeRegistry;
  }
}

/** Resolve the merge registry for an element: nearest injector-chain scope first, then the global. */
function resolveRegistry(node: Node): CustomValidityMergeRegistry | undefined {
  const scoped = InjectorRoot.getProviderOf(node, 'customValidityMerge');
  if (scoped instanceof CustomValidityMergeRegistry) return scoped;
  return typeof window !== 'undefined' ? window.customValidityMerge : undefined;
}

/** The inner form control whose `ValidityState` feeds the auto-derived `native` source (#218). */
type NativeControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

export default class ValidityMergeField extends HTMLElement {
  static formAssociated = true;
  static observedAttributes = ['strategy'];

  readonly #internals: ElementInternals;
  #orchestrator: ValiditySourceOrchestrator | null = null;
  #last: MergedValidity | null = null;

  /** Once `native` is fed by hand, the auto-derive backs off until it is `clearSource`d (explicit wins). */
  #nativeManual = false;
  /** The native source stays `idle` until the user touches the control — no premature failure. */
  #nativeInteracted = false;
  /** The control we have listeners on (re-synced when the light DOM swaps it). */
  #controlEl: NativeControl | null = null;

  /** A control `input`/`change`/`invalid` marks interaction and re-derives the `native` source. */
  readonly #onControlEvent = (): void => {
    this.#nativeInteracted = true;
    this.#deriveNative();
  };

  constructor() {
    super();
    this.#internals = this.attachInternals();
  }

  /** The merged validity of the most recent recompute (`null` before the first source is set). */
  get merged(): MergedValidity | null {
    return this.#last;
  }

  connectedCallback(): void {
    this.#resolveOrchestrator();
    this.#syncControlListeners();
    this.#deriveNative();
  }

  disconnectedCallback(): void {
    this.#detachControlListeners();
  }

  attributeChangedCallback(name: string): void {
    if (name === 'strategy') this.#resolveOrchestrator();
  }

  /** Resolve (or re-resolve) the strategy from scope and rebuild the orchestrator, preserving sources. */
  #resolveOrchestrator(): void {
    const registry = resolveRegistry(this);
    if (!registry) return; // not bootstrapped yet — set() will resolve lazily
    const key = this.getAttribute('strategy') || undefined;
    const strategy = registry.resolve(key);
    if (!this.#orchestrator) {
      this.#orchestrator = new Orchestrator(strategy);
    } else {
      this.#orchestrator.useStrategy(strategy);
      this.#recompute(this.#orchestrator.merged());
    }
  }

  #ensureOrchestrator(): ValiditySourceOrchestrator {
    if (!this.#orchestrator) this.#resolveOrchestrator();
    if (!this.#orchestrator) {
      throw new Error(
        '<validity-merge-field>: no customValidityMerge registry in scope or on window — bootstrap the plug first',
      );
    }
    return this.#orchestrator;
  }

  /** Feed (or replace) a named source's result and push the recomputed validity to the platform. */
  setSource(source: string, update: SourceUpdate): MergedValidity {
    if (source === 'native') this.#nativeManual = true; // explicit native wins over the auto-derive
    return this.#recompute(this.#ensureOrchestrator().set(source, update));
  }

  /** Drop a named source (e.g. a cleared async check) and recompute. */
  clearSource(source: string): MergedValidity {
    const merged = this.#recompute(this.#ensureOrchestrator().clear(source));
    if (source === 'native') {
      this.#nativeManual = false; // hand-off released — resume auto-deriving from the control
      return this.#deriveNative() ?? merged;
    }
    return merged;
  }

  /**
   * Auto-derive the `native` source from the inner control's `ValidityState` (#218): `valid` when
   * `validity.valid`, else `invalid` carrying `validationMessage`, `idle` when the control is absent
   * or untouched. A no-op while a manual `native` source is in force (explicit wins) or before a
   * registry is in scope. Feeds the orchestrator directly so it never trips the manual flag.
   */
  #deriveNative(): MergedValidity | null {
    if (this.#nativeManual) return null;
    if (!this.#orchestrator) {
      this.#resolveOrchestrator();
      if (!this.#orchestrator) return null; // not bootstrapped yet — connect/set will re-derive
    }
    const control = this.#findControl();
    let update: SourceUpdate;
    if (!control || !this.#nativeInteracted) update = { state: 'idle' };
    else if (control.validity.valid) update = { state: 'valid' };
    else update = { state: 'invalid', message: control.validationMessage };
    return this.#recompute(this.#orchestrator.set('native', update));
  }

  #findControl(): NativeControl | null {
    return this.querySelector('input, select, textarea');
  }

  /** (Re)attach the interaction listeners to the current inner control, dropping any stale ones. */
  #syncControlListeners(): void {
    const control = this.#findControl();
    if (control === this.#controlEl) return;
    this.#detachControlListeners();
    this.#controlEl = control;
    if (!control) return;
    control.addEventListener('input', this.#onControlEvent);
    control.addEventListener('change', this.#onControlEvent);
    control.addEventListener('invalid', this.#onControlEvent);
  }

  #detachControlListeners(): void {
    const control = this.#controlEl;
    if (!control) return;
    control.removeEventListener('input', this.#onControlEvent);
    control.removeEventListener('change', this.#onControlEvent);
    control.removeEventListener('invalid', this.#onControlEvent);
    this.#controlEl = null;
  }

  /** Swap the active merge strategy by name (re-resolved through scope) and recompute. */
  useStrategy(key?: string): void {
    if (key) this.setAttribute('strategy', key);
    else this.removeAttribute('strategy');
    this.#resolveOrchestrator();
  }

  #recompute(merged: MergedValidity): MergedValidity {
    this.#last = merged;
    const anchor = (this.querySelector('input, select, textarea') as HTMLElement) ?? undefined;
    applyMergedValidity(this.#internals, merged, anchor);
    this.dispatchEvent(
      new CustomEvent<MergedValidity>('validity-merge', { detail: merged, bubbles: true }),
    );
    return merged;
  }
}
