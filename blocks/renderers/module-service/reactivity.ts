/**
 * @file blocks/renderers/module-service/reactivity.ts
 * @description Module-as-a-Service reactivity model — backlog #310, spun out of #081 (MaaS v1 close-out).
 *
 * MaaS `serve()` renders a component ONCE — it owns no update model, by design (#081). This module adds
 * the reactivity layer **beside** MaaS, not inside it: lifecycle callbacks, effects, and change
 * detection, with the change-detection strategy behind the SAME inject-a-provider seam as the compiler
 * (`CustomCompilerRegistry`) and render strategies — a `CustomChangeDetectorRegistry`. The point of the
 * #310 split is that reactivity is a swappable *strategy*, not a baked-in mechanic: a consumer composes
 * `ReactiveController` over a served form and picks (or registers) the detector; MaaS stays a pure
 * one-shot resolver. This folds into the render-strategy Protocol (#052/#078) when that lands; until
 * then it is a standalone, dependency-free model (browser-safe — no DOM, no fs).
 *
 * Three pieces, mirroring the MaaS registry idiom:
 *   1. **`ChangeDetector`** — the swappable contract: given previous + next state, which keys changed?
 *   2. **`CustomChangeDetectorRegistry`** — empty-by-default, native-first; the reference `dirty-check`
 *      detector is registered as the default. A signal/proxy-based detector is a sibling `register()`.
 *   3. **`ReactiveController`** — ties state → detection → effects → lifecycle into one update cycle.
 */

/** The set of state keys a detector found changed between two snapshots (stable, deduped order). */
export type ChangedKeys = readonly string[];

/**
 * The swappable change-detection contract — the reactivity analogue of `CustomCompiler`. Pure: given
 * the previous and next state object, return which top-level keys changed. A detector owns ONLY the
 * comparison policy (referential, shallow, deep, signal-tracked); it never mutates or renders.
 */
export interface ChangeDetector {
  /** Stable id surfaced in diagnostics + registry keys (e.g. `dirty-check`). */
  readonly id: string;
  /** Which keys of `next` differ from `prev` under this detector's policy. */
  detect(prev: Readonly<Record<string, unknown>>, next: Readonly<Record<string, unknown>>): ChangedKeys;
}

/**
 * The reference detector (native-first default): a shallow per-key dirty check using `Object.is`. Keys
 * present in either snapshot are compared; the union covers added + removed + mutated keys. Good enough
 * for the walking skeleton and the common case; a deep or signal-based detector drops in as a sibling.
 */
export const dirtyCheckDetector: ChangeDetector = {
  id: 'dirty-check',
  detect(prev, next) {
    const keys = new Set<string>([...Object.keys(prev), ...Object.keys(next)]);
    const changed: string[] = [];
    for (const k of keys) if (!Object.is(prev[k], next[k])) changed.push(k);
    return changed;
  },
};

/** Thrown by {@link CustomChangeDetectorRegistry.resolve} when the named (or default) detector is absent. */
export class UnknownChangeDetectorError extends Error {
  constructor(id: string, known: string[]) {
    super(`Unknown change detector "${id}" — registered: ${known.join(', ') || 'none'}`);
    this.name = 'UnknownChangeDetectorError';
  }
}

/**
 * Name-keyed change-detector registry — the reactivity sibling of `CustomCompilerRegistry`. Unlike the
 * compiler registry (empty by default, because no transform ships in the browser core), this one
 * preloads the reference `dirty-check` detector as the native-first default, mirroring the validity-merge
 * registry which ships strategies. Re-registering an id overrides it; the first registered (or one
 * passed `asDefault`) is what `resolve()` returns with no argument.
 */
export class CustomChangeDetectorRegistry {
  readonly localName = 'customChangeDetector';
  readonly #byId = new Map<string, ChangeDetector>();
  #defaultId: string | null = null;

  register(detector: ChangeDetector, opts?: { default?: boolean }): void {
    this.#byId.set(detector.id, detector);
    if (opts?.default || this.#defaultId === null) this.#defaultId = detector.id;
  }
  has(id: string): boolean {
    return this.#byId.has(id);
  }
  keys(): string[] {
    return [...this.#byId.keys()];
  }
  get defaultId(): string | null {
    return this.#defaultId;
  }
  /** Resolve a detector by id, falling back to the default; throws (never substitutes) when absent. */
  resolve(id?: string): ChangeDetector {
    const wanted = id ?? this.#defaultId;
    if (wanted === null) throw new UnknownChangeDetectorError('default', this.keys());
    const detector = this.#byId.get(wanted);
    if (!detector) throw new UnknownChangeDetectorError(wanted, this.keys());
    return detector;
  }
}

/** A registry preloaded with the reference `dirty-check` detector as the native-first default. */
export function createDefaultChangeDetectorRegistry(): CustomChangeDetectorRegistry {
  const registry = new CustomChangeDetectorRegistry();
  registry.register(dirtyCheckDetector, { default: true });
  return registry;
}

// ── The reactive controller — state → detection → effects → lifecycle ────────────

/** Lifecycle callbacks a consumer opts into; all optional. `onUpdate` receives the changed keys. */
export interface ReactiveLifecycle<S extends Record<string, unknown>> {
  onMount?(state: Readonly<S>): void;
  onUpdate?(changed: ChangedKeys, state: Readonly<S>): void;
  onUnmount?(state: Readonly<S>): void;
}

/** An effect: a callback re-run whenever one of its declared dependency keys changes. */
export interface Effect {
  /** State keys this effect depends on; an effect with `[]` runs only at mount. */
  readonly deps: readonly string[];
  /** Run the effect; may return a cleanup called before the next run + at unmount. */
  run(): void | (() => void);
}

export interface ReactiveControllerOptions<S extends Record<string, unknown>> {
  readonly initialState: S;
  readonly lifecycle?: ReactiveLifecycle<S>;
  readonly effects?: readonly Effect[];
  /** Change detector; defaults to the native-first `dirty-check`. */
  readonly detector?: ChangeDetector;
}

/**
 * The reactivity model a served component composes (it does NOT live inside `serve()`). Holds state,
 * runs the change detector on every `setState`, fires the lifecycle `onUpdate` + any effect whose deps
 * intersect the changed keys, and runs effect cleanups before re-running / at unmount. A one-shot served
 * form becomes reactive by wrapping it in one of these — proving reactivity is an opt-in strategy layered
 * over MaaS, not a mechanic baked into it.
 */
export class ReactiveController<S extends Record<string, unknown>> {
  #state: S;
  readonly #lifecycle: ReactiveLifecycle<S>;
  readonly #effects: readonly Effect[];
  readonly #detector: ChangeDetector;
  readonly #cleanups = new Map<number, () => void>();
  #mounted = false;

  constructor(opts: ReactiveControllerOptions<S>) {
    this.#state = { ...opts.initialState };
    this.#lifecycle = opts.lifecycle ?? {};
    this.#effects = opts.effects ?? [];
    this.#detector = opts.detector ?? dirtyCheckDetector;
  }

  get state(): Readonly<S> {
    return this.#state;
  }

  /** Run mount lifecycle + every effect once (mount runs all effects regardless of deps). Idempotent. */
  mount(): void {
    if (this.#mounted) return;
    this.#mounted = true;
    this.#lifecycle.onMount?.(this.#state);
    this.#effects.forEach((effect, i) => this.#runEffect(effect, i));
  }

  /**
   * Merge a partial update, detect what changed, and — only if something did — fire `onUpdate` and the
   * effects whose deps intersect the change. A no-op update (nothing changed) fires nothing: the change
   * detector is the gate, so an effect never runs on an unrelated state write.
   */
  setState(patch: Partial<S>): ChangedKeys {
    const next = { ...this.#state, ...patch };
    const changed = this.#detector.detect(this.#state, next);
    if (changed.length === 0) return changed;
    this.#state = next;
    if (this.#mounted) {
      this.#lifecycle.onUpdate?.(changed, this.#state);
      const changedSet = new Set(changed);
      this.#effects.forEach((effect, i) => {
        if (effect.deps.some((d) => changedSet.has(d))) this.#runEffect(effect, i);
      });
    }
    return changed;
  }

  /** Run mount cleanups for every effect, then the unmount lifecycle. Idempotent. */
  unmount(): void {
    if (!this.#mounted) return;
    this.#mounted = false;
    for (const cleanup of this.#cleanups.values()) cleanup();
    this.#cleanups.clear();
    this.#lifecycle.onUnmount?.(this.#state);
  }

  /** Run one effect, calling its previous cleanup first and storing the new one (if any). */
  #runEffect(effect: Effect, index: number): void {
    this.#cleanups.get(index)?.();
    this.#cleanups.delete(index);
    const cleanup = effect.run();
    if (typeof cleanup === 'function') this.#cleanups.set(index, cleanup);
  }
}
