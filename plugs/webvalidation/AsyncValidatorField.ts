/**
 * `<async-validator-field>` (#224) — the async sibling of #215's `<validity-merge-field>`. It drives an
 * `AsyncValidationRunner` under a per-scope `customValidatorResolution` strategy and feeds the surviving
 * answer into the `async` source of a target `<validity-merge-field>`, so a stale in-flight check is
 * reconciled (dropped/aborted by the strategy) and only the current answer ever reaches the platform.
 *
 * It owns no stale-answer policy: it resolves the page's resolution strategy **per-scope** through the
 * injector chain (`InjectorRoot.getProviderOf` — nearest-scope-wins, #207 D6; falling back to the global
 * registry), builds a runner, and wires the runner's `emit` sink to the target field's
 * `setSource('async', …)`. Because the runner emits `pending{version}` → `valid|invalid` (the cross-plane
 * contract `assertResolvedSource` enforces), the merge plane shows pending while a check is in flight and
 * the terminal answer lands on `ElementInternals.setValidity` for free.
 *
 * The form association lives on the `<validity-merge-field>` this control feeds — this element is the
 * async *driver*, the merge field is the form-associated control whose validity it contributes to.
 */
import type { SourceUpdate } from '../../validity-merge/registry.js';
import type {
  AsyncValidator,
  ResolvedSource,
  SourceSink,
  ValidationInput,
} from '../../validator-resolution/index.js';
import { AsyncValidationRunner } from '../../validator-resolution/index.js';
import InjectorRoot from '../webinjectors/InjectorRoot';
import CustomValidatorResolutionRegistry from './CustomValidatorResolutionRegistry';

declare global {
  interface Window {
    customValidatorResolution?: CustomValidatorResolutionRegistry;
  }
}

/** The minimal surface this control needs of its target — the `async` source sink of a merge field. */
export interface AsyncSourceTarget {
  setSource(source: string, update: SourceUpdate): unknown;
  clearSource(source: string): unknown;
}

/** Resolve the resolution registry for an element: nearest injector-chain scope first, then the global. */
function resolveRegistry(node: Node): CustomValidatorResolutionRegistry | undefined {
  const scoped = InjectorRoot.getProviderOf(node, 'customValidatorResolution');
  if (scoped instanceof CustomValidatorResolutionRegistry) return scoped;
  return typeof window !== 'undefined' ? window.customValidatorResolution : undefined;
}

function isAsyncSourceTarget(el: unknown): el is AsyncSourceTarget {
  return (
    !!el &&
    typeof (el as AsyncSourceTarget).setSource === 'function' &&
    typeof (el as AsyncSourceTarget).clearSource === 'function'
  );
}

/** The inner form control whose edits trigger an async check (when a validator is assigned). */
type NativeControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

let nextAutoId = 0;

export default class AsyncValidatorField extends HTMLElement {
  static observedAttributes = ['strategy', 'for'];

  #runner: AsyncValidationRunner | null = null;
  #validator: AsyncValidator | null = null;
  #explicitTarget: AsyncSourceTarget | null = null;
  #controlEl: NativeControl | null = null;
  #autoId: string | null = null;
  /** Monotonic run counter — the `version` carried by the #1111 validate-start/validate-end events. */
  #runVersion = 0;

  /** A control edit supersedes any in-flight check and starts a fresh one (when a validator is set). */
  readonly #onControlInput = (): void => {
    const control = this.#findControl();
    if (!control || !this.#validator) return;
    void this.validate(control.value);
  };

  /** Push the runner's surviving source into the target field's `async` source (the cross-plane hand-off). */
  readonly #emit: SourceSink = (source: ResolvedSource): void => {
    this.#targetField()?.setSource('async', {
      state: source.state,
      message: source.message,
      version: source.version,
    });
  };

  connectedCallback(): void {
    this.#resolveRunner();
    this.#syncControlListeners();
  }

  disconnectedCallback(): void {
    this.#detachControlListeners();
  }

  attributeChangedCallback(name: string): void {
    if (name === 'strategy') this.#resolveRunner();
    // `for` is resolved lazily on emit, so a late-set target id is picked up without rewiring.
  }

  /** Assign the async check this control runs (the app's server/remote validator). */
  useValidator(validator: AsyncValidator | null): void {
    this.#validator = validator;
  }

  /** Set the merge field this control feeds directly (overrides DOM resolution — handy for tests/programmatic use). */
  useTargetField(target: AsyncSourceTarget | null): void {
    this.#explicitTarget = target;
  }

  /**
   * Run the assigned validator for `input` under the active resolution strategy. Emits `pending`, then
   * the resolved source into the target field's `async` source **iff** the strategy says it is still
   * current; resolves to that source, or `null` when the generation was superseded/aborted.
   */
  validate(input: ValidationInput): Promise<ResolvedSource | null> {
    const validator = this.#validator;
    if (!validator) {
      throw new Error('<async-validator-field>: no validator assigned — call .useValidator(fn) first');
    }
    // Stable-id observables (#1111): a run is initiated → `validate-start`; on completion → `validate-end`,
    // where a superseded/aborted generation (the runner returned null) surfaces as a `stale` result.
    const version = (this.#runVersion += 1);
    this.#emitControl('validate-start', { source: 'async', version });
    return this.#ensureRunner()
      .validate(this.#fieldId(), input, validator)
      .then((resolved) => {
        this.#emitControl('validate-end', {
          source: 'async',
          version: resolved?.version ?? version,
          result: resolved ? resolved.state : 'stale',
        });
        return resolved;
      });
  }

  /** Dispatch a bubbling `validation.control.*` stable-id event (#1111, spec njk:184-196). */
  #emitControl(name: string, detail: Record<string, unknown>): void {
    this.dispatchEvent(new CustomEvent(`validation.control.${name}`, { detail, bubbles: true }));
  }

  /** The input moved on without starting a new check (e.g. the field was cleared) — supersede/abort in-flight. */
  notifyInputChange(input: ValidationInput): void {
    this.#runner?.onInputChange(this.#fieldId(), input);
  }

  /** Swap the active resolution strategy by name (re-resolved through scope). */
  useStrategy(key?: string): void {
    if (key) this.setAttribute('strategy', key);
    else this.removeAttribute('strategy');
    this.#resolveRunner();
  }

  /** Resolve (or re-resolve) the strategy from scope and (re)build the runner, preserving its emit sink. */
  #resolveRunner(): void {
    const registry = resolveRegistry(this);
    if (!registry) return; // not bootstrapped yet — validate() will resolve lazily
    const key = this.getAttribute('strategy') || undefined;
    const strategy = registry.resolve(key);
    if (!this.#runner) this.#runner = new AsyncValidationRunner(strategy, { emit: this.#emit });
    else this.#runner.useStrategy(strategy);
  }

  #ensureRunner(): AsyncValidationRunner {
    if (!this.#runner) this.#resolveRunner();
    if (!this.#runner) {
      throw new Error(
        '<async-validator-field>: no customValidatorResolution registry in scope or on window — bootstrap the plug first',
      );
    }
    return this.#runner;
  }

  /** The merge field whose `async` source this control feeds: explicit target → `for` id → closest → descendant. */
  #targetField(): AsyncSourceTarget | null {
    if (this.#explicitTarget) return this.#explicitTarget;
    const forId = this.getAttribute('for');
    if (forId) {
      const root = this.getRootNode() as Document | ShadowRoot;
      const byId =
        (root as Document | ShadowRoot).getElementById?.(forId) ??
        (typeof document !== 'undefined' ? document.getElementById(forId) : null);
      if (isAsyncSourceTarget(byId)) return byId;
    }
    const closest = this.closest('validity-merge-field');
    if (isAsyncSourceTarget(closest)) return closest;
    const descendant = this.querySelector('validity-merge-field');
    if (isAsyncSourceTarget(descendant)) return descendant;
    return null;
  }

  /** A stable per-field id for the runner's generation tracking — the element's `id`, or an auto one. */
  #fieldId(): string {
    if (this.id) return this.id;
    this.#autoId ??= `async-validator-field-${++nextAutoId}`;
    return this.#autoId;
  }

  #findControl(): NativeControl | null {
    return this.querySelector('input, select, textarea');
  }

  #syncControlListeners(): void {
    const control = this.#findControl();
    if (control === this.#controlEl) return;
    this.#detachControlListeners();
    this.#controlEl = control;
    if (!control) return;
    control.addEventListener('input', this.#onControlInput);
    control.addEventListener('change', this.#onControlInput);
  }

  #detachControlListeners(): void {
    const control = this.#controlEl;
    if (!control) return;
    control.removeEventListener('input', this.#onControlInput);
    control.removeEventListener('change', this.#onControlInput);
    this.#controlEl = null;
  }
}
