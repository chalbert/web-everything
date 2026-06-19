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
import CustomCommitmentPolicyRegistry from './CustomCommitmentPolicyRegistry';
import type { CommitmentPolicy } from '../../commitment-policy/index.js';
import { applyMergedValidity } from './applyMergedValidity';
import { InteractionStateTracker } from '../../interaction-state/model';

declare global {
  interface Window {
    customValidityMerge?: CustomValidityMergeRegistry;
    customCommitmentPolicy?: CustomCommitmentPolicyRegistry;
  }
}

/** Resolve the merge registry for an element: nearest injector-chain scope first, then the global. */
function resolveRegistry(node: Node): CustomValidityMergeRegistry | undefined {
  const scoped = InjectorRoot.getProviderOf(node, 'customValidityMerge');
  if (scoped instanceof CustomValidityMergeRegistry) return scoped;
  return typeof window !== 'undefined' ? window.customValidityMerge : undefined;
}

/** Resolve the commitment-policy registry per-scope (#1113), mirroring {@link resolveRegistry}. */
function resolveCommitmentRegistry(node: Node): CustomCommitmentPolicyRegistry | undefined {
  const scoped = InjectorRoot.getProviderOf(node, 'customCommitmentPolicy');
  if (scoped instanceof CustomCommitmentPolicyRegistry) return scoped;
  return typeof window !== 'undefined' ? window.customCommitmentPolicy : undefined;
}

/** The inner form control whose `ValidityState` feeds the auto-derived `native` source (#218). */
type NativeControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

export default class ValidityMergeField extends HTMLElement {
  static formAssociated = true;
  static observedAttributes = ['strategy', 'commitment'];

  readonly #internals: ElementInternals;
  #orchestrator: ValiditySourceOrchestrator | null = null;
  #last: MergedValidity | null = null;

  /** Once `native` is fed by hand, the auto-derive backs off until it is `clearSource`d (explicit wins). */
  #nativeManual = false;
  /** The native source stays `idle` until the user touches the control — no premature failure. */
  #nativeInteracted = false;
  /** The control we have listeners on (re-synced when the light DOM swaps it). */
  #controlEl: NativeControl | null = null;

  /** Interaction state (dirty/touched/focused/submitted) — orthogonal to validity, reflected as data-*. */
  readonly #interaction = new InteractionStateTracker();
  #unsubInteraction: (() => void) | null = null;

  /** Prior focus/validity, to fire the stable-id transition events (#1111) only on a real crossing. */
  #prevFocused = false;
  #prevValidity: string | null = null;

  /** The resolved commitment policy (#1113) — `full` (eager) or `deferred` (buffered), per-scope. */
  #commitment: CommitmentPolicy | null = null;
  /** This field's stable id for the policy's per-field staleness bookkeeping. */
  readonly #fieldId = `vmf-${Math.random().toString(36).slice(2)}`;

  /** A control `input`/`change`/`invalid` marks interaction and re-derives the `native` source. */
  readonly #onControlEvent = (event: Event): void => {
    this.#nativeInteracted = true;
    // A value edit is the `validation.control.value-input` observable (a user/programmatic value change).
    if (event.type === 'input' || event.type === 'change') {
      this.#emitControl('value-input', { type: event.type });
      // Commitment staleness (#1113): an `input` bumps the generation and marks the displayed validation
      // `stale` (a new value the result hasn't caught up to); a `change` (a commit event) marks it
      // `current` again — reflected as data-validation-generation/-sync/-timestamp.
      if (this.#commitment && event.type === 'input') {
        const control = this.#findControl();
        this.#commitment.onValueInput(this.#fieldId, control?.value);
        // The auto-derive that immediately follows must NOT mark the field current — for a deferred
        // policy the displayed validation only catches up on a real validation feed (setSource), not on
        // the synchronous native re-derive triggered by the same keystroke.
        this.#suppressCommitReconcile = true;
        this.#reflectStaleness();
      }
    }
    this.#deriveNative();
    this.#suppressCommitReconcile = false;
  };

  /** Guards the one synchronous auto-derive after an `input` from prematurely marking the field current. */
  #suppressCommitReconcile = false;

  /**
   * Mark the commitment field `current` (validation has caught up to the value) by driving the policy's
   * settled decision (`validationPending:false` → reconcile). Called when a real validation result settles.
   */
  #markCommitmentCurrent(merged: MergedValidity): void {
    if (!this.#commitment) return;
    const control = this.#findControl();
    this.#commitment.shouldCommit(this.#fieldId, control?.value, {
      fieldId: this.#fieldId,
      event: 'input',
      value: control?.value,
      validity: merged,
      interaction: this.#interaction.state,
      submitted: this.#interaction.state.submitted,
      validationPending: false,
    });
  }

  /**
   * Dispatch a `validation.control.*` stable-id event (#1111, spec njk:184-196). Bubbling so a form/host
   * above can observe the whole field tree; the legacy `validity-merge` event is kept alongside.
   */
  #emitControl(name: string, detail: Record<string, unknown> = {}): void {
    this.dispatchEvent(new CustomEvent(`validation.control.${name}`, { detail, bubbles: true }));
  }

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
    this.#resolveCommitment();
    this.#syncControlListeners();
    this.#deriveNative();
  }

  disconnectedCallback(): void {
    this.#detachControlListeners();
  }

  attributeChangedCallback(name: string): void {
    if (name === 'strategy') this.#resolveOrchestrator();
    if (name === 'commitment') this.#resolveCommitment();
  }

  /**
   * Resolve (or re-resolve) the commitment policy from scope (#1113): the `commitment="deferred|full"`
   * attribute names it, falling back to the registry default (`full`). Reflects `data-committed` (the
   * resolved policy key) and seeds the staleness observables. A no-op when no commitment registry is in
   * scope (the field still works as a pure validity-merge control).
   */
  #resolveCommitment(): void {
    const registry = resolveCommitmentRegistry(this);
    if (!registry) {
      this.#commitment = null;
      return;
    }
    const key = this.getAttribute('commitment') || undefined;
    this.#commitment = registry.resolve(key);
    this.setAttribute('data-committed', this.#commitment.key);
    this.#reflectStaleness();
  }

  /**
   * Reflect the commitment staleness observables (#1113, spec njk:198-206): `data-validation-sync`
   * (current|stale), `data-validation-generation` (opaque integer, bumps on input), and
   * `data-validation-timestamp` (ISO of last validation completion).
   */
  #reflectStaleness(): void {
    if (!this.#commitment) return;
    this.setAttribute('data-validation-sync', this.#commitment.getValidationSync(this.#fieldId));
    this.setAttribute('data-validation-generation', String(this.#commitment.getValidationGeneration(this.#fieldId)));
    this.setAttribute('data-validation-timestamp', this.#commitment.getValidationTimestamp(this.#fieldId));
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
    // Track interaction state off the same control and reflect it as data-dirty/touched/focused.
    this.#interaction.attach(control);
    this.#unsubInteraction = this.#interaction.subscribe(() => this.#reflectInteraction());
    this.#reflectInteraction();
  }

  #detachControlListeners(): void {
    const control = this.#controlEl;
    if (!control) return;
    control.removeEventListener('input', this.#onControlEvent);
    control.removeEventListener('change', this.#onControlEvent);
    control.removeEventListener('invalid', this.#onControlEvent);
    this.#unsubInteraction?.();
    this.#unsubInteraction = null;
    this.#interaction.detach();
    this.#controlEl = null;
  }

  /** Reflect the interaction flags as `data-dirty` / `data-touched` / `data-focused` (L1 observables). */
  #reflectInteraction(): void {
    const { dirty, touched, focused } = this.#interaction.state;
    this.setAttribute('data-dirty', String(dirty));
    this.setAttribute('data-touched', String(touched));
    this.setAttribute('data-focused', String(focused));
    // Focus crossing → the `validation.control.focus` / `.blur` interaction-state observables.
    if (focused !== this.#prevFocused) {
      this.#emitControl(focused ? 'focus' : 'blur');
      this.#prevFocused = focused;
    }
  }

  /** Reflect merged validity as `data-validity` + `data-severity` (L1 observables, beyond-native). */
  #reflectValidity(merged: MergedValidity): void {
    const validity = merged.state === 'idle' ? 'unknown' : merged.state; // unknown | pending | valid | invalid
    this.setAttribute('data-validity', validity);

    // Commitment staleness (#1113): a settled validity (valid/invalid) from a real validation feed means
    // the displayed result has caught up → mark the field `current`. Suppressed for the synchronous
    // auto-derive that follows an `input` keystroke (a deferred field stays stale until a real feed).
    if (this.#commitment && !this.#suppressCommitReconcile && (merged.state === 'valid' || merged.state === 'invalid')) {
      this.#markCommitmentCurrent(merged);
      this.#reflectStaleness();
    }

    // No per-message severity in the contract yet (#1112); derive the coarse signal from state.
    if (merged.state === 'invalid') this.setAttribute('data-severity', 'error');
    else if (merged.state === 'pending') this.setAttribute('data-severity', 'info');
    else this.removeAttribute('data-severity');

    // Validity transition → the stable-id observables (#1111): `validity-changed` on any transition, plus
    // `became-valid` / `became-invalid` when crossing the valid/invalid boundary.
    if (validity !== this.#prevValidity) {
      this.#emitControl('validity-changed', { merged });
      if (validity === 'valid') this.#emitControl('became-valid', { merged });
      else if (validity === 'invalid') this.#emitControl('became-invalid', { merged });
      this.#prevValidity = validity;
    }
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
    this.#reflectValidity(merged);
    this.dispatchEvent(
      new CustomEvent<MergedValidity>('validity-merge', { detail: merged, bubbles: true }),
    );
    return merged;
  }
}
