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

export default class ValidityMergeField extends HTMLElement {
  static formAssociated = true;
  static observedAttributes = ['strategy'];

  readonly #internals: ElementInternals;
  #orchestrator: ValiditySourceOrchestrator | null = null;
  #last: MergedValidity | null = null;

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
    return this.#recompute(this.#ensureOrchestrator().set(source, update));
  }

  /** Drop a named source (e.g. a cleared async check) and recompute. */
  clearSource(source: string): MergedValidity {
    return this.#recompute(this.#ensureOrchestrator().clear(source));
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
