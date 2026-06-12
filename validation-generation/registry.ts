/**
 * The standalone `customValidationAdapter` registry — the table the per-language adapter slices
 * (#305–#308) and the Mode-2 service (#309) register into and resolve from. It mirrors the standalone
 * `validity-merge/registry.ts` table (`localName` + `define`/`get`/`has`/`keys`/`resolve` + a
 * native-first-by-convention default), kept dependency-free here so the generation vocabulary has one
 * home and cannot drift. Generation is a build / service-time concern, so — unlike the live
 * `customValidityMerge` plug — there is no injector-chain element; this table is re-exported from the
 * `webvalidation` plug directly (the capability-manifest #266 precedent).
 */
import {
  type CustomValidationAdapter,
  type ValidationIntentId,
  assertValidationAdapter,
} from './provider.js';

/** Thrown by {@link CustomValidationAdapterRegistry.resolve} when the named (or default) adapter is absent. */
export class UnknownValidationAdapterError extends Error {
  constructor(key: string, known: string[]) {
    super(`Unknown validation adapter "${key}" — registered adapters: ${known.join(', ') || 'none'}`);
    this.name = 'UnknownValidationAdapterError';
  }
}

/**
 * Registry of named validation-generation adapters, keyed by each adapter's own `key`. The first
 * registered (or one passed `asDefault`) is the adapter `resolve()` returns when called with no
 * argument. `adaptersFor(intent)` exposes the #085 "which adapters comply with this intent" query.
 */
export class CustomValidationAdapterRegistry {
  readonly localName = 'customValidationAdapter';
  readonly #adapters = new Map<string, CustomValidationAdapter>();
  #defaultKey: string | null = null;

  /**
   * Register an adapter under its `key`; the first registered (or one passed `asDefault`) becomes the
   * default. Re-registering a key overrides it. The adapter is contract-checked on the way in
   * ({@link assertValidationAdapter}), so a malformed adapter is rejected at registration, not at emit.
   */
  define(adapter: CustomValidationAdapter, asDefault = false): void {
    assertValidationAdapter(adapter);
    this.#adapters.set(adapter.key, adapter);
    if (asDefault || this.#defaultKey === null) this.#defaultKey = adapter.key;
  }

  has(key: string): boolean {
    return this.#adapters.has(key);
  }

  keys(): string[] {
    return [...this.#adapters.keys()];
  }

  /** The adapter registered under `key`, or `undefined`. */
  get(key: string): CustomValidationAdapter | undefined {
    return this.#adapters.get(key);
  }

  /** The key {@link resolve} returns when called with no argument, or `null` when the registry is empty. */
  get defaultKey(): string | null {
    return this.#defaultKey;
  }

  /**
   * Resolve an adapter by key, falling back to the registered default when `key` is omitted. Throws
   * {@link UnknownValidationAdapterError} when the named (or default) adapter is absent — the registry
   * never silently substitutes a different emitter.
   */
  resolve(key?: string): CustomValidationAdapter {
    const wanted = key ?? this.#defaultKey;
    if (wanted === null) throw new UnknownValidationAdapterError('default', this.keys());
    const adapter = this.#adapters.get(wanted);
    if (!adapter) throw new UnknownValidationAdapterError(wanted, this.keys());
    return adapter;
  }

  /** The registered adapters that declare compliance with `intent`, in registration order. */
  adaptersFor(intent: ValidationIntentId): CustomValidationAdapter[] {
    return [...this.#adapters.values()].filter((a) => a.intents.includes(intent));
  }
}

/**
 * An empty registry — the foundation slice (#304) ships **no** concrete adapter; the native-HTML
 * (#305), Zod (#306), Pydantic (#307), JSON-Schema (#308) and Mode-2 service (#309) slices each
 * `define()` their adapter into one. Provided as the canonical constructor seam so every consumer
 * builds the same shape (parallel to `createDefaultValidityMergeRegistry`, which preloads its shipped
 * strategies because it has some to ship).
 */
export function createValidationAdapterRegistry(): CustomValidationAdapterRegistry {
  return new CustomValidationAdapterRegistry();
}
