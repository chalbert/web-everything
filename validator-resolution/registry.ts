/**
 * `CustomValidatorResolutionRegistry` + the async validation runner (#214).
 *
 * The registry is the swap point: named resolution strategies register here, a scope resolves the one
 * it wants, and the runner drives an async validator under that strategy — emitting the
 * `pending{version}` → `valid|invalid` source results the validity-merge plane (#212) consumes. It is
 * the sibling of the `CustomValidityMerge` registry and a peer of `CustomPositioningRegistry` /
 * `CustomTranslationProviderRegistry` — one shared, injectable service every control delegates to,
 * rather than each control baking its own stale-answer policy. Like the merge plane this is a
 * standalone, dependency-free model: the runtime plug fulfils the same API (`define`/`get`/`resolve`).
 */
import type {
  AsyncResult,
  CustomValidatorResolution,
  ResolvedSource,
  ValidationInput,
} from './contract.js';
import { assertResolvedSource } from './provider.js';

/** A scope asked for a resolution strategy that was never registered. */
export class UnknownResolutionError extends Error {
  constructor(key: string, known: string[]) {
    super(`Unknown resolution strategy "${key}" — registered strategies: ${known.join(', ') || 'none'}`);
    this.name = 'UnknownResolutionError';
  }
}

/**
 * Registry of named resolution strategies. Mirrors the `CustomRegistry` API the runtime plug extends
 * (`localName` + `define`/`get`/`has`/`keys`), kept self-contained here. A `default` key marks the
 * strategy a control uses when its scope names none — the native-first versioning, by convention.
 * Re-registering a key overrides it (nearest-scope-wins is the runtime plug's job; this standalone
 * model just owns the table).
 */
export class CustomValidatorResolutionRegistry {
  readonly localName = 'customValidatorResolution';
  readonly #strategies = new Map<string, CustomValidatorResolution>();
  #defaultKey: string | null = null;

  /** Register a strategy under its `key`; the first registered (or one passed `asDefault`) is the default. */
  define(strategy: CustomValidatorResolution, asDefault = false): void {
    this.#strategies.set(strategy.key, strategy);
    if (asDefault || this.#defaultKey === null) this.#defaultKey = strategy.key;
  }

  has(key: string): boolean {
    return this.#strategies.has(key);
  }

  keys(): string[] {
    return [...this.#strategies.keys()];
  }

  /** The strategy registered under `key`, or `undefined`. */
  get(key: string): CustomValidatorResolution | undefined {
    return this.#strategies.get(key);
  }

  /**
   * Resolve a strategy by name, falling back to the registered default when `key` is omitted. Throws
   * `UnknownResolutionError` when the named (or default) strategy is absent — the registry never
   * silently substitutes a different policy.
   */
  resolve(key?: string): CustomValidatorResolution {
    const wanted = key ?? this.#defaultKey;
    if (wanted === null) throw new UnknownResolutionError('default', this.keys());
    const strategy = this.#strategies.get(wanted);
    if (!strategy) throw new UnknownResolutionError(wanted, this.keys());
    return strategy;
  }
}

/** Performs the actual async check — given the input (and an abort signal, for cancellation), resolves valid|invalid. */
export type AsyncValidator = (input: ValidationInput, signal?: AbortSignal) => Promise<AsyncResult>;

/** A sink the runner pushes each source update to — typically wired to the merge plane's orchestrator (`set('async', …)`). */
export type SourceSink = (source: ResolvedSource) => void;

/**
 * Drives an async validator under a resolution strategy. `validate` opens a generation, emits a
 * `pending{version}` source immediately (so the merge plane shows pending while the check is in
 * flight), runs the validator, and applies the terminal `valid|invalid` answer **only** when the
 * strategy says it is still current — a stale or aborted answer is dropped and `validate` resolves to
 * `null`. Every emitted source is run through `assertResolvedSource`, so a custom strategy that breaks
 * the cross-plane contract is caught here (the #004 OP-1 "vary policy, never the surface" guarantee).
 */
export class AsyncValidationRunner {
  #strategy: CustomValidatorResolution;
  readonly #sourceName: string;
  readonly #emit?: SourceSink;

  constructor(strategy: CustomValidatorResolution, opts: { sourceName?: string; emit?: SourceSink } = {}) {
    this.#strategy = strategy;
    this.#sourceName = opts.sourceName ?? 'async';
    this.#emit = opts.emit;
  }

  /** Swap the active resolution strategy (e.g. a scope re-resolved to a different one). */
  useStrategy(strategy: CustomValidatorResolution): void {
    this.#strategy = strategy;
  }

  /** The input changed while a check may be in flight — let the strategy supersede/abort the prior generation. */
  onInputChange(fieldId: string, newInput: ValidationInput): void {
    this.#strategy.onInputChange(fieldId, newInput);
  }

  /**
   * Run `validator` for a field's current input under the active strategy. Emits `pending`, then the
   * resolved source iff it is still current; resolves to that source, or `null` when the generation was
   * superseded/aborted. An aborted request that *rejects* (e.g. `fetch` on an aborted signal) is treated
   * as a dropped generation, not a failure.
   */
  async validate(fieldId: string, input: ValidationInput, validator: AsyncValidator): Promise<ResolvedSource | null> {
    const handle = this.#strategy.startValidation(fieldId, input);
    this.#push({ source: this.#sourceName, state: 'pending', version: handle.version });

    let result: AsyncResult;
    try {
      result = await validator(input, handle.signal);
    } catch (err) {
      if (handle.signal?.aborted) return null; // aborted request — a dropped generation, not a failure
      throw err;
    }

    if (!this.#strategy.shouldApplyResult(handle, result)) return null; // stale/superseded — drop
    return this.#push({ source: this.#sourceName, state: result.state, message: result.message, version: handle.version });
  }

  /** Enforce the cross-plane contract, emit to the sink, and return the (typed) source. */
  #push(source: ResolvedSource): ResolvedSource {
    const checked = assertResolvedSource(this.#strategy.key, source);
    this.#emit?.(checked);
    return checked;
  }
}
