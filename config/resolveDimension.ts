/**
 * Per-dimension config resolver (#1702, ratifying #1662) — the runtime that turns a dimension's
 * declared entry into its **resolved value/registry** via ordered nearest-wins composition over a
 * platform-flavor chain.
 *
 * The kernel this generalizes is `CustomAutoDefineRegistry`: a default-less core plus a value that
 * extends a platform flavor through an ordered nearest-wins chain. An *open-set* dimension (autoDefine,
 * renderStrategy) realizes the chain as `new Registry({ extends: [flavorA, flavorB] })` and lets the
 * core `CustomRegistry` walk own→extended for both the strategy table and the default. A *scalar/mode*
 * dimension (codegenSoT mode, theme tokens) realizes the SAME ordered nearest-wins lookup over plain
 * config objects. Either way: **lazy, no merged blob is materialized** (#1662).
 *
 * Cross-dimension semantics: there is **NO merge across dimensions** (#1662 Fork 1). {@link resolveConfig}
 * resolves each dimension independently and returns the values side by side — the step-5 *discovery
 * view*, which is non-authoritative.
 *
 * See `docs/agent/platform-decisions.md#config-extends-platform-default`.
 *
 * @module config
 */
import {
  type DimensionEntry,
  type ExtendsFlavorDescriptor,
  type WebEverythingConfig,
  isExtendsFlavorDescriptor,
  isDimensionPointer,
} from './defineConfig';

/**
 * A dimension's plug-in to the generic resolver. Each dimension provides exactly this so every
 * dimension resolves *identically* — the resolver core has no per-dimension knowledge.
 *
 * @typeParam Flavor   the dimension's flavor-id union
 * @typeParam Resolved the dimension's resolved value type (a registry for open-set dims, a config
 *                     object for scalar/mode dims)
 */
export interface DimensionResolver<Flavor extends string = string, Resolved = unknown> {
  /** Dimension name, used only for diagnostics. */
  readonly dimension: string;

  /**
   * Build the resolved value from an **ordered, nearest-first** chain of base flavor ids plus an
   * optional local override. For open-set dimensions this is `new Registry({ extends: flavors.map(byName) })`
   * (the `CustomRegistry.extends` mechanism does the nearest-wins lookup). For scalar/mode dimensions
   * this performs an analogous ordered nearest-wins pick over the flavors' plain values.
   *
   * Implementations MUST treat `flavors[0]` as nearest (after `override`) and apply nearest-wins; they
   * MUST NOT deep-merge a blob.
   *
   * @param flavors  ordered base flavor ids, nearest-first
   * @param override the descriptor's local `overrides` (the absolute nearest top), or `undefined`
   */
  fromExtends(flavors: readonly Flavor[], override?: unknown): Resolved;

  /**
   * Accept a plain inline value the project supplied directly (no flavor chain). Optional — when a
   * dimension has no meaningful "inline value" form it may omit this and the resolver will throw if an
   * inline value is encountered.
   */
  fromInline?(value: unknown): Resolved;
}

/** Thrown when a dimension entry cannot be resolved by its {@link DimensionResolver}. */
export class UnresolvableDimensionError extends Error {
  constructor(dimension: string, reason: string) {
    super(`Cannot resolve config dimension "${dimension}": ${reason}`);
    this.name = 'UnresolvableDimensionError';
  }
}

/**
 * Resolve ONE dimension's entry to its value/registry via the dimension's resolver.
 *
 * The string-pointer (extract-to-own-file) case is the **loader's** job, not the resolver's: loading
 * the pointed file and substituting its export is a follow-on (out of scope for #1702). So a raw
 * pointer here is an error — callers pass the *already-loaded* value/descriptor. (The loader, once
 * built, would read the file and hand us the loaded `DimensionEntry`.)
 *
 * @typeParam Flavor   the dimension's flavor-id union
 * @typeParam Resolved the dimension's resolved type
 */
export function resolveDimension<Flavor extends string, Resolved>(
  entry: DimensionEntry<Flavor> | undefined,
  resolver: DimensionResolver<Flavor, Resolved>,
): Resolved {
  if (entry === undefined) {
    throw new UnresolvableDimensionError(resolver.dimension, 'no entry declared');
  }

  if (isDimensionPointer(entry)) {
    throw new UnresolvableDimensionError(
      resolver.dimension,
      `entry is an unresolved file pointer ("${entry}") — the loader must read & substitute the ` +
        `pointed file before resolution (a #1702 follow-on; out of scope here)`,
    );
  }

  if (isExtendsFlavorDescriptor(entry)) {
    const descriptor = entry as ExtendsFlavorDescriptor<Flavor>;
    return resolver.fromExtends(descriptor.flavors, descriptor.overrides);
  }

  // A plain inline value the project supplied directly.
  if (resolver.fromInline) return resolver.fromInline(entry);
  throw new UnresolvableDimensionError(
    resolver.dimension,
    'entry is a plain inline value but the resolver provides no fromInline()',
  );
}

/**
 * The **discovery view** (#1662 step 5): resolve every declared dimension *independently* and return
 * the values side by side. There is deliberately **NO cross-dimension merge** — resolving `autoDefine`
 * never reads or touches `theme`. The unified object is a non-authoritative read-model over the
 * per-dimension SoTs.
 *
 * Only dimensions present in BOTH `config` and `resolvers` are resolved; an unconfigured dimension is
 * simply absent from the result (lazy — the platform default applies elsewhere).
 *
 * @param config    the author surface (already loaded; pointers already substituted by the loader)
 * @param resolvers a map of dimension name → its {@link DimensionResolver}
 * @returns a map of dimension name → its independently-resolved value
 */
export function resolveConfig(
  config: WebEverythingConfig,
  resolvers: Record<string, DimensionResolver<string, unknown>>,
): Record<string, unknown> {
  const view: Record<string, unknown> = {};
  for (const [dimension, resolver] of Object.entries(resolvers)) {
    const entry = config[dimension];
    if (entry === undefined) continue; // unconfigured — leave absent (lazy).
    view[dimension] = resolveDimension(entry as DimensionEntry<string>, resolver);
  }
  return view;
}
