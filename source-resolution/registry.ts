/**
 * `CustomSourceResolverRegistry` + the precedence-ordered resolve chain (#575).
 *
 * The registry is the swap point: named resolvers register here in **precedence order**, and the chain
 * consults them in that order, returning the first non-`null` location and degrading to **inert**
 * (`null`) when every resolver misses. It mirrors the `CustomRegistry` API the runtime plug extends
 * (`localName` + `define`/`get`/`has`/`keys`/`resolve`), kept self-contained here, and is the sibling
 * of the validator-resolution (#214) registry. Unlike a single-strategy registry, resolution is a
 * **chain, not a pick**: the dev-browser doesn't choose one resolver — it tries the cold-deployed
 * anchor first, then degrades. Like the other planes this is a standalone, dependency-free model: the
 * runtime plug fulfils the same API.
 */
import type { CustomSourceResolver, SourceLocation } from './provider.js';

/** A consumer asked for a resolver key that was never registered. */
export class UnknownSourceResolverError extends Error {
  constructor(key: string, known: string[]) {
    super(`Unknown source resolver "${key}" — registered resolvers: ${known.join(', ') || 'none'}`);
    this.name = 'UnknownSourceResolverError';
  }
}

/**
 * Registry of named source resolvers, **insertion-ordered** (registration order *is* precedence). A
 * `Map` preserves insertion order, so `chain()` walks resolvers in the order they were `define`d —
 * register anchor → framework-debug → source-map and the chain tries them in that sequence.
 * Re-registering a key overrides the resolver but **keeps its original precedence slot**.
 */
export class CustomSourceResolverRegistry {
  readonly localName = 'customSourceResolvers';
  readonly #resolvers = new Map<string, CustomSourceResolver>();

  /** Register a resolver under its `key`. First registration sets its precedence slot; re-register overrides in place. */
  define(resolver: CustomSourceResolver): void {
    this.#resolvers.set(resolver.key, resolver);
  }

  has(key: string): boolean {
    return this.#resolvers.has(key);
  }

  /** Registered keys in precedence (insertion) order. */
  keys(): string[] {
    return [...this.#resolvers.keys()];
  }

  /** The resolver registered under `key`, or `undefined`. */
  get(key: string): CustomSourceResolver | undefined {
    return this.#resolvers.get(key);
  }

  /**
   * The resolver registered under `key`. Throws `UnknownSourceResolverError` when absent — a named
   * lookup never silently substitutes a different resolver. (For node→source use {@link resolve}, the
   * degrading chain; this is the by-name accessor.)
   */
  require(key: string): CustomSourceResolver {
    const resolver = this.#resolvers.get(key);
    if (!resolver) throw new UnknownSourceResolverError(key, this.keys());
    return resolver;
  }

  /** The resolvers in precedence order — the chain {@link resolve} walks. */
  chain(): CustomSourceResolver[] {
    return [...this.#resolvers.values()];
  }

  /**
   * Resolve a node to its source location by walking the precedence chain: the first resolver to yield
   * a non-`null` location wins; if every resolver misses, the plane is **inert** and returns `null`
   * (the deployed-without-anchors case — never an error). A resolver that throws is treated as a miss
   * so one misbehaving provider can't break the chain.
   */
  resolve(node: Element): SourceLocation | null {
    for (const resolver of this.#resolvers.values()) {
      let loc: SourceLocation | null = null;
      try {
        loc = resolver.resolve(node);
      } catch {
        loc = null; // a resolver fault degrades to a miss, never a chain failure
      }
      if (loc !== null) return loc;
    }
    return null;
  }
}
