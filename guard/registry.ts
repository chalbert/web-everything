/**
 * `CustomGuardRegistry` (standalone model, #289) — the swap point of the Guard protocol (#288).
 *
 * Named providers register here; a scope resolves the one it wants (default → project override →
 * custom), and a region's lifecycle event is evaluated under it. It is the sibling of the
 * `CustomValidatorResolution` / `CustomValidityMerge` registries and a peer of `CustomPositioningRegistry`
 * — one shared, injectable service every guarded region delegates to, rather than each member intent
 * baking its own provider. Like those planes this is a standalone, dependency-free model of the
 * contract: the runtime `customGuards` plug (`plugs/webguards/`) fulfils the same `define`/`resolve`
 * surface as a core `CustomRegistry`, so the resolution policy has one home and cannot drift.
 *
 * The contract is **async/trust-crossing** (#288): `evaluateRegion` runs a provider's `evaluate` and
 * passes the answer through `assertGuardDecision` so a misbehaving provider is caught at the seam.
 */
import {
  assertGuardDecision,
  type CustomGuardProvider,
  type GuardContext,
  type GuardDecision,
  type GuardEvent,
  type GuardRegion,
} from './provider.js';

/** A scope asked for a guard provider that was never registered. */
export class UnknownGuardProviderError extends Error {
  constructor(key: string, known: string[]) {
    super(`Unknown guard provider "${key}" — registered providers: ${known.join(', ') || 'none'}`);
    this.name = 'UnknownGuardProviderError';
  }
}

/**
 * Registry of named guard providers. Mirrors the `CustomRegistry` API the runtime plug extends
 * (`localName` + `define`/`get`/`has`/`keys`), kept self-contained here. A `default` key marks the
 * provider used when a scope names none — the native-first permissive default, by convention.
 * Re-registering a key overrides it (nearest-scope-wins is the runtime plug's job; this standalone
 * model just owns the table).
 */
export class CustomGuardRegistry {
  readonly localName = 'customGuards';
  readonly #providers = new Map<string, CustomGuardProvider>();
  #defaultKey: string | null = null;

  /** Register a provider under its `key`; the first registered (or one passed `asDefault`) is the default. */
  define(provider: CustomGuardProvider, asDefault = false): void {
    this.#providers.set(provider.key, provider);
    if (asDefault || this.#defaultKey === null) this.#defaultKey = provider.key;
  }

  has(key: string): boolean {
    return this.#providers.has(key);
  }

  keys(): string[] {
    return [...this.#providers.keys()];
  }

  /** The key `resolve()` returns when called with no argument. */
  get defaultKey(): string | null {
    return this.#defaultKey;
  }

  /** The provider registered under `key`, or `undefined`. */
  get(key: string): CustomGuardProvider | undefined {
    return this.#providers.get(key);
  }

  /**
   * Resolve a provider by name, falling back to the registered default when `key` is omitted. Throws
   * `UnknownGuardProviderError` when the named (or default) provider is absent — the registry never
   * silently substitutes a different policy (and, for a guard, never silently allows).
   */
  resolve(key?: string): CustomGuardProvider {
    const wanted = key ?? this.#defaultKey;
    if (wanted === null) throw new UnknownGuardProviderError('default', this.keys());
    const provider = this.#providers.get(wanted);
    if (!provider) throw new UnknownGuardProviderError(wanted, this.keys());
    return provider;
  }

  /**
   * Evaluate `event` on `region` under the resolved provider, validating the crossing answer through
   * `assertGuardDecision`. The single entry point a member intent calls — it never touches a provider's
   * `evaluate` directly, so the trust-boundary check can't be skipped.
   */
  async evaluateRegion(
    region: GuardRegion,
    event: GuardEvent,
    context?: GuardContext,
    providerKey?: string,
  ): Promise<GuardDecision> {
    const provider = this.resolve(providerKey);
    const decision = await provider.evaluate(region, event, context);
    return assertGuardDecision(provider.key, decision);
  }
}
