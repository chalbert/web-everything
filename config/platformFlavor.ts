/**
 * The WE **platform flavor** (Layer 1) for each dimension (#1702, ratifying #1662) — the fully-defined,
 * most-permissive / native-first default value a project extends. Plus the dimension resolvers that
 * wire the generic {@link ./resolveDimension resolver} to each dimension's real flavor factories.
 *
 * Only `autoDefine` is wired end-to-end here, against the real `CustomAutoDefineRegistry` flavor
 * factories — it is the precedent #1662 generalizes and the concrete proof of the nearest-wins
 * composition. The other dimensions' registries are **owned elsewhere** (#080 renderStrategy, #798
 * codegenSoT, theme) — #1702 does NOT build or import them, so they are represented here only as
 * data/descriptor-level placeholder defaults that keep this module compiling standalone.
 *
 * See `docs/agent/platform-decisions.md#config-extends-platform-default`.
 *
 * @module config
 */
import CustomAutoDefineRegistry, {
  AUTO_DEFINE_FLAVORS,
  type AutoDefineFlavorName,
} from '../blocks/renderers/auto-define/CustomAutoDefineRegistry';
import type { DimensionResolver } from './resolveDimension';

// ── autoDefine dimension (the precedent, wired end-to-end) ────────────────────────────────────────

/**
 * Platform default flavor id for `autoDefine`: **`strict-explicit`** — the native baseline (explicit
 * registration only, no inference), per `native-first`. A project extends this and/or overrides it.
 */
export const PLATFORM_AUTO_DEFINE_FLAVOR: AutoDefineFlavorName = 'strict-explicit';

/**
 * Optional local overrides a project may pass to the autoDefine descriptor's `overrides`. Only the
 * default-key is overridable per-scope (the registry resolves a *named* default from its chain).
 */
export interface AutoDefineOverrides {
  /** Force this strategy key as the resolved registry's default (the absolute nearest-wins top). */
  defaultKey?: string;
}

/**
 * The autoDefine {@link DimensionResolver}. Realizes nearest-wins via the core `CustomRegistry.extends`
 * mechanism: it instantiates each named flavor factory and builds a child
 * `new CustomAutoDefineRegistry({ extends: [nearest, …, farthest] })`. The core registry then walks
 * own → extended for both the strategy table AND the default — exactly the kernel `CustomAutoDefineRegistry`
 * already implements. A local `overrides.defaultKey` is applied as `setDefault` on the child (the
 * absolute top of the nearest-wins order), which is strictly nearer than any extended flavor's default.
 *
 * `flavors[0]` is nearest; we pass the factory-built flavors to `extends` in the SAME order, and
 * `CustomAutoDefineRegistry.defaultKey` returns the first extended config that declares a default —
 * i.e. nearest-wins. NO merged registry blob is materialized; `extends` is a lazy lookup chain.
 */
export const autoDefineResolver: DimensionResolver<AutoDefineFlavorName, CustomAutoDefineRegistry> = {
  dimension: 'autoDefine',
  fromExtends(flavors, override) {
    const bases = flavors.map((name) => {
      const factory = AUTO_DEFINE_FLAVORS[name];
      if (!factory) {
        throw new Error(
          `Unknown autoDefine flavor "${name}" — known: ${Object.keys(AUTO_DEFINE_FLAVORS).join(', ')}`,
        );
      }
      return factory();
    });
    // The child registry carries no strategies of its own — it inherits the whole chain. `extends`
    // order is nearest-first; the core registry's own→extended walk yields nearest-wins for free.
    const resolved = new CustomAutoDefineRegistry({ extends: bases });
    const overrides = override as AutoDefineOverrides | undefined;
    if (overrides?.defaultKey !== undefined) {
      // Absolute nearest top: a project-scope explicit default beats any flavor's declared default.
      resolved.setDefault(overrides.defaultKey);
    }
    return resolved;
  },
};

// ── Other dimensions (registries owned elsewhere — descriptor-level placeholders only) ────────────

/**
 * Placeholder platform-default *values* for the dimensions whose real registries live in other homes.
 * These are data-level only (no registry construction) so this module compiles standalone and #1702
 * does not reach into #080/#798/theme. The most-permissive / native-first default is named per
 * dimension; the owning slice replaces the placeholder with its real flavor factory when built.
 */
export const PLATFORM_FLAVOR_DEFAULTS = {
  /** Theme tokens (#404 / theme): most-permissive = the base/native token set, fully overridable. */
  theme: 'base-tokens',
  /** Render strategy (#080): native-first = the eager/synchronous JSX render baseline. */
  renderStrategy: 'eager-sync',
  /** Codegen source-of-truth mode (#798): most-flexible = author-in-standard-form (no lowering). */
  codegenSoT: 'standard-form',
} as const;

/**
 * A minimal scalar/mode resolver factory for the placeholder dimensions: it realizes the SAME ordered
 * nearest-wins lookup as the registry path, but over plain string-id values rather than a registry —
 * the *scalar/mode* realization #1662 calls out. The resolved value is just the winning flavor id (or
 * the override), proving the chain semantics without owning the real registry.
 *
 * @param dimension the dimension name (diagnostics)
 */
export function createScalarFlavorResolver(
  dimension: string,
): DimensionResolver<string, string> {
  return {
    dimension,
    fromExtends(flavors, override) {
      // Nearest-wins: an explicit override beats the chain; else the nearest (first) flavor wins.
      if (typeof override === 'string' && override.length > 0) return override;
      const nearest = flavors[0];
      if (nearest === undefined) {
        throw new Error(`${dimension}: empty flavor chain`);
      }
      return nearest;
    },
    fromInline(value) {
      return String(value);
    },
  };
}
