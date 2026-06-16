/**
 * @file blocks/renderers/module-service/definitionRegistry.ts
 * @description MaaS id→definition resolver + registry + caching — backlog #311, spun out of #081.
 *
 * MaaS v1 resolves a component id by **linear-scanning the component-cases fixtures and regex-matching
 * `name="…"` on every request** (see `tools/maas/vite-plugin.ts` `resolveDefinition`). That is fine for
 * a demo and wrong for a service: O(n) per request, re-parsed every time, with no place for a real
 * production source to plug in. This module hardens that seam into three pieces, in the MaaS registry
 * idiom (`CustomCompilerRegistry`, `CustomChangeDetectorRegistry`):
 *
 *   1. **`CustomDefinitionRegistry`** — an indexed `id → <component> source` table (O(1) lookup), with
 *      an optional `fallback` resolver so an in-memory registry can front a production source (a CDN /
 *      published manifest) without the caller knowing which answered.
 *   2. **`DefinitionCache`** — a memoizing resolver wrapper (positive AND negative caching) with
 *      observable hit/miss stats, so "resolved once, served many" is real and measurable.
 *   3. **`ServedArtifactCache`** — caches the *served artifact* by `(id, form, target)`, since `serve()`
 *      is a pure function of `(definition, opts)`: the same request never re-runs the transform twice.
 *
 * Browser-safe + dependency-free (no fs, no fixture import at module scope): the fixtures are passed in
 * via {@link indexDefinitions}, so this core never hard-codes the v1 source it replaces.
 */
import { serve, type ServeOptions, type ServeResult } from './moduleService';

/** The element name declared by a `<component name="…">` definition, or null if absent. Centralizes v1's regex. */
export function componentName(definition: string): string | null {
  const m = definition.match(/<component[^>]*\bname="([^"]+)"/);
  return m ? m[1] : null;
}

/** The resolution contract: an id (element name) in, its authored `<component>` source out (or null). */
export interface DefinitionResolver {
  resolve(id: string): string | null;
}

/** Thrown by {@link indexDefinitions} when a definition carries no `name=` to key it by. */
export class UnnamedDefinitionError extends Error {
  constructor(snippet: string) {
    super(`Cannot index a <component> with no name="…": ${snippet.slice(0, 60)}…`);
    this.name = 'UnnamedDefinitionError';
  }
}

/**
 * An indexed id→definition registry — the production replacement for v1's linear scan. Lookups are O(1)
 * Map reads; an optional `fallback` resolver is consulted on a miss, so an in-memory registry can sit in
 * front of a remote/production source and the caller asks one `resolve()` regardless of which answers.
 */
export class CustomDefinitionRegistry implements DefinitionResolver {
  readonly localName = 'customComponentDefinition';
  readonly #byId = new Map<string, string>();
  readonly #fallback: DefinitionResolver | null;

  constructor(fallback?: DefinitionResolver) {
    this.#fallback = fallback ?? null;
  }

  /** Register (or override) the source for `id`. */
  define(id: string, source: string): this {
    this.#byId.set(id, source);
    return this;
  }
  has(id: string): boolean {
    return this.#byId.has(id);
  }
  keys(): string[] {
    return [...this.#byId.keys()];
  }
  /** O(1) local lookup; on a miss, defer to the fallback resolver (if any), else null. */
  resolve(id: string): string | null {
    const local = this.#byId.get(id);
    if (local !== undefined) return local;
    return this.#fallback ? this.#fallback.resolve(id) : null;
  }
}

/**
 * Build a registry by indexing a set of `<component>` definitions by their declared name — the O(1)
 * replacement for v1's per-request `componentCases` scan. Pass `{ skipUnnamed: true }` to drop a nameless
 * definition instead of throwing (e.g. a partial fixture); default is strict.
 */
export function indexDefinitions(
  definitions: Iterable<string>,
  opts: { fallback?: DefinitionResolver; skipUnnamed?: boolean } = {},
): CustomDefinitionRegistry {
  const registry = new CustomDefinitionRegistry(opts.fallback);
  for (const def of definitions) {
    const name = componentName(def);
    if (name === null) {
      if (opts.skipUnnamed) continue;
      throw new UnnamedDefinitionError(def);
    }
    registry.define(name, def);
  }
  return registry;
}

/** One pre-built trait chunk to expose over MaaS: its attribute name and its final ES-module source. */
export interface TraitModule {
  /** The trait attribute token, e.g. `'sortable'` — the `<name>` segment of `/_maas/<name>.js`. */
  readonly name: string;
  /** The trait's final module source (already built JS) — served verbatim, not lowered. */
  readonly source: string;
}

/**
 * Build a registry that resolves a **trait** name to its pre-built module source — the trait-side half
 * of the #743 union. Unlike {@link indexDefinitions} (which keys `<component>` definitions by their
 * declared `name=`), a trait module carries no `<component>` tag, so its name is supplied explicitly.
 * Compose this as the `fallback` of the component registry so one `resolve()` answers for both: a
 * `/_maas/<trait>.js` fetch resolves to the trait's bytes instead of 404ing, while component names keep
 * resolving locally. The served bytes pass through `serve()` verbatim (a non-`<component>` source is a
 * pre-built module — see `moduleService.isComponentDefinition`).
 */
export function indexTraitModules(modules: Iterable<TraitModule>): CustomDefinitionRegistry {
  const registry = new CustomDefinitionRegistry();
  for (const { name, source } of modules) registry.define(name, source);
  return registry;
}

/** Observable cache counters — proves "resolved once, served many" rather than asserting it. */
export interface CacheStats {
  hits: number;
  misses: number;
  /** Entries currently held (a negative/null result counts as an entry). */
  size: number;
}

/**
 * A memoizing {@link DefinitionResolver} wrapper. Caches BOTH hits and misses (a null result is cached
 * too — a negative cache, so a missing id isn't re-scanned on every request) and exposes hit/miss stats.
 * `invalidate()` drops one id or the whole table when the underlying source changes.
 */
export class DefinitionCache implements DefinitionResolver {
  readonly #inner: DefinitionResolver;
  readonly #cache = new Map<string, string | null>();
  #hits = 0;
  #misses = 0;

  constructor(inner: DefinitionResolver) {
    this.#inner = inner;
  }

  resolve(id: string): string | null {
    if (this.#cache.has(id)) {
      this.#hits++;
      return this.#cache.get(id) ?? null;
    }
    this.#misses++;
    const resolved = this.#inner.resolve(id);
    this.#cache.set(id, resolved);
    return resolved;
  }

  /** Drop the cached entry for `id`, or the entire cache when called with no argument. */
  invalidate(id?: string): void {
    if (id === undefined) this.#cache.clear();
    else this.#cache.delete(id);
  }

  get stats(): CacheStats {
    return { hits: this.#hits, misses: this.#misses, size: this.#cache.size };
  }
}

/**
 * The cache key for a served artifact — a serve is pure in `(id, form, target, strategy)` AND the
 * producing compiler/core version. The `compilerVersion` is folded in so the in-process cache keys on
 * the *same* byte-determining inputs as the HTTP content-addressed id (#088/#461): a compiler bump
 * invalidates this cache exactly as it mints a new content hash, so the two layers never disagree on
 * identity (the bug this closes: a compiler bump that left the cache serving stale bytes).
 */
function artifactKey(id: string, opts: ServeOptions, compilerVersion: string): string {
  return `${id}|${opts.form}|${opts.transpileTarget ?? 'esnext'}|${opts.strategy ?? 'declarative-static'}|${compilerVersion}`;
}

/**
 * Caches the *served artifact*, not just the definition. `serve()` is a pure function of its definition
 * and options, so the same `(id, form, target)` request can return a memoized `ServeResult` without
 * re-running the transform — the request-level half of the #311 caching hardening (the #087
 * "every request re-runs serve()" cost, removed). Resolution goes through the injected resolver (use a
 * {@link DefinitionCache} to also cache the id→definition step).
 */
export class ServedArtifactCache {
  readonly #resolver: DefinitionResolver;
  readonly #serve: typeof serve;
  readonly #compilerVersion: string;
  readonly #cache = new Map<string, ServeResult>();
  #hits = 0;
  #misses = 0;

  /**
   * @param compilerVersion folded into the cache key so it tracks the same identity as the HTTP
   *   content hash (#461). Defaults to `'esnext'` (the v1 single-compiler baseline) when unspecified.
   */
  constructor(resolver: DefinitionResolver, serveFn: typeof serve = serve, compilerVersion = 'esnext') {
    this.#resolver = resolver;
    this.#serve = serveFn;
    this.#compilerVersion = compilerVersion;
  }

  /** Serve `id` in the requested form, memoized by `(id, form, target, strategy, compilerVersion)`. Null when the id is unknown. */
  serve(id: string, opts: ServeOptions): ServeResult | null {
    const key = artifactKey(id, opts, this.#compilerVersion);
    const cached = this.#cache.get(key);
    if (cached) {
      this.#hits++;
      return cached;
    }
    this.#misses++;
    const definition = this.#resolver.resolve(id);
    if (definition === null) return null;
    const result = this.#serve(definition, opts);
    this.#cache.set(key, result);
    return result;
  }

  invalidate(id?: string): void {
    if (id === undefined) {
      this.#cache.clear();
      return;
    }
    for (const key of this.#cache.keys()) if (key.startsWith(`${id}|`)) this.#cache.delete(key);
  }

  get stats(): CacheStats {
    return { hits: this.#hits, misses: this.#misses, size: this.#cache.size };
  }
}
