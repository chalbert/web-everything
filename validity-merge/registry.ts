/**
 * `CustomValidityMergeRegistry` + the auto-stamping orchestrator (#212).
 *
 * The registry is the swap point: named merge strategies register here, a scope resolves the one it
 * wants, and the orchestrator runs it over the live source results. It is the sibling of the async
 * `CustomValidatorResolution` plane and a peer of `CustomPositioningRegistry` /
 * `CustomTranslationProviderRegistry` — one shared, injectable service every control delegates to,
 * rather than each control baking its own merge math. Like the capability provider (#204) this is a
 * standalone, dependency-free model: the runtime plug fulfils the same API (`define`/`get`/`resolve`).
 */
import type {
  CustomValidityMergeStrategy,
  MergedValidity,
  SourceResult,
  SourceState,
} from './contract.js';
import { assertMergedValidity } from './provider.js';

/** A scope asked for a strategy name that was never registered. */
export class UnknownStrategyError extends Error {
  constructor(key: string, known: string[]) {
    super(`Unknown merge strategy "${key}" — registered strategies: ${known.join(', ') || 'none'}`);
    this.name = 'UnknownStrategyError';
  }
}

/**
 * Registry of named merge strategies. Mirrors the `CustomRegistry` API the runtime plug extends
 * (`localName` + `define`/`get`/`has`/`keys`), kept self-contained here. A `default` key marks the
 * strategy a control uses when its scope names none — the native-first source-reduction, by
 * convention. Re-registering a key overrides it (nearest-scope-wins is the runtime plug's job; this
 * standalone model just owns the table).
 */
export class CustomValidityMergeRegistry {
  readonly localName = 'customValidityMerge';
  readonly #strategies = new Map<string, CustomValidityMergeStrategy>();
  #defaultKey: string | null = null;

  /** Register a strategy under its `key`; the first registered (or one passed `asDefault`) is the default. */
  define(strategy: CustomValidityMergeStrategy, asDefault = false): void {
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
  get(key: string): CustomValidityMergeStrategy | undefined {
    return this.#strategies.get(key);
  }

  /**
   * Resolve a strategy by name, falling back to the registered default when `key` is omitted. Throws
   * `UnknownStrategyError` when the named (or default) strategy is absent — the registry never
   * silently substitutes a different merge math.
   */
  resolve(key?: string): CustomValidityMergeStrategy {
    const wanted = key ?? this.#defaultKey;
    if (wanted === null) throw new UnknownStrategyError('default', this.keys());
    const strategy = this.#strategies.get(wanted);
    if (!strategy) throw new UnknownStrategyError(wanted, this.keys());
    return strategy;
  }
}

/** What a control hands the orchestrator for a source — its result minus the auto-stamped bookkeeping. */
export type SourceUpdate = { state: SourceState; message?: string; version?: number };

/**
 * Holds the live `SourceResult` per named source and runs the resolved strategy over them. Its job
 * is the **auto-stamping** of generation tokens: a dev calling `set('manual', { state: 'invalid',
 * message })` for a server error never hand-authors an id — the orchestrator stamps a monotonically
 * increasing `version`. A `pending` async result keeps the token it was stamped with; an explicit
 * `version` is honoured only for deliberate stale-control. Every merged result is run through
 * `assertMergedValidity`, so a custom strategy that breaks the surface contract is caught here (the
 * #004 OP-1 "vary computation, never the surface" guarantee).
 */
export class ValiditySourceOrchestrator {
  readonly #sources = new Map<string, SourceResult>();
  #version = 0;
  #strategy: CustomValidityMergeStrategy;

  constructor(strategy: CustomValidityMergeStrategy) {
    this.#strategy = strategy;
  }

  /** Swap the active merge strategy (e.g. a scope re-resolved to a different one). */
  useStrategy(strategy: CustomValidityMergeStrategy): void {
    this.#strategy = strategy;
  }

  /** Set (or replace) a named source's result and return the recomputed merged validity. */
  set(source: string, update: SourceUpdate): MergedValidity {
    const version = update.version ?? ++this.#version;
    this.#sources.set(source, { source, state: update.state, message: update.message, version });
    return this.merged();
  }

  /** Drop a source entirely (e.g. a cleared async check) and return the recomputed merged validity. */
  clear(source: string): MergedValidity {
    this.#sources.delete(source);
    return this.merged();
  }

  /** The current source results, in insertion order. */
  sources(): SourceResult[] {
    return [...this.#sources.values()];
  }

  /** Run the active strategy over the live sources, enforcing the surface contract on its output. */
  merged(): MergedValidity {
    return assertMergedValidity(this.#strategy.key, this.#strategy.merge(this.sources()));
  }
}
