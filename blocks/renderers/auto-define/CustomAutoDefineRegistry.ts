/**
 * Auto-Define registry (#242) — the open registry of {@link AutoDefineStrategy}s, built the
 * **config-extends-platform** way: the tool carries **no default**; the default-strategy selection
 * comes from a platform-config *flavor* a project extends, resolved through the core `CustomRegistry`
 * inheritance chain. This is deliberately NOT `CustomRenderStrategyRegistry`'s shape — that one rolls
 * its own `Map` + `#defaultName` ("first registered wins") + a bespoke `parent` pointer, baking a
 * default into the tool (the anti-pattern #243 fixes). Here the strategy table IS the core
 * `CustomRegistry` (own → extended chain) and the default is just another thing inherited from the
 * extended config, never seeded by the class.
 *
 * Spec: /projects/webcomponents/#protocol-auto-define-strategy
 *
 * @module blocks/renderers/auto-define
 */
import CustomRegistry, { type CustomRegistryOptions } from '../../../plugs/core/CustomRegistry';
import {
  type AutoDefineStrategy,
  explicitAutoDefine,
} from './defineElement';
import { lazyDomAutoDefine } from './lazyDomStrategy';
import { buildParsedAutoDefine } from './buildParsedStrategy';

/** A scope asked for a strategy (or the default) that is not resolvable from here or any extended config. */
export class UnknownAutoDefineError extends Error {
  constructor(key: string, known: string[]) {
    super(`Unknown auto-define strategy "${key}" — registered strategies: ${known.join(', ') || 'none'}`);
    this.name = 'UnknownAutoDefineError';
  }
}

/**
 * The open registry of auto-define strategies. Extends the core `CustomRegistry` (keyed by strategy
 * `key`) so it is injector-chain-resolvable and inheritable via `extends`. Unlike the render-strategy
 * registry it sets **no default of its own** — `defaultKey` is `null` on a bare registry and only
 * becomes non-null when a flavor/config sets it (`asDefault` / {@link setDefault}) or when an extended
 * config carries one. Resolution of the default walks the same extended chain the strategy table does.
 */
export default class CustomAutoDefineRegistry extends CustomRegistry<AutoDefineStrategy> {
  localName = 'customAutoDefine';
  /** Default set ONLY explicitly (a flavor/config), never by registration order — the #243 rule. */
  #ownDefaultKey: string | null = null;
  /** The extended configs, kept for default-resolution (core `CustomRegistry` keeps its own copy private). */
  readonly #configs: CustomAutoDefineRegistry[];

  constructor(options: CustomRegistryOptions<AutoDefineStrategy> = {}) {
    super(options);
    this.#configs = (options.extends ?? []) as CustomAutoDefineRegistry[];
  }

  /**
   * Register a strategy under its own `key`. `asDefault` is the ONLY way registration touches the
   * default — there is deliberately no first-registered-wins fallback (that bakes a default into the
   * tool). A flavor passes `asDefault: true` for the one strategy it wants as its default.
   */
  define(strategy: AutoDefineStrategy, asDefault = false): void {
    this.set(strategy.key, strategy);
    if (asDefault) this.#ownDefaultKey = strategy.key;
  }

  /** Set this scope's default strategy (per-scope override). Must be resolvable from here. */
  setDefault(key: string): this {
    if (!this.has(key)) throw new UnknownAutoDefineError(key, [...this.keys()]);
    this.#ownDefaultKey = key;
    return this;
  }

  /**
   * The default strategy key in effect for this scope: this registry's own default if set, else the
   * nearest extended config's default (nearest-config-wins). `null` when nothing in the chain declares
   * one — a bare tool with no platform config extended has no default, by design.
   */
  get defaultKey(): string | null {
    if (this.#ownDefaultKey !== null) return this.#ownDefaultKey;
    for (const config of this.#configs) {
      const inherited = config.defaultKey;
      if (inherited !== null) return inherited;
    }
    return null;
  }

  /**
   * Resolve a strategy by name, falling back to the chain's default when `key` is omitted. Throws
   * `UnknownAutoDefineError` when the named (or default) strategy is absent — the registry never
   * silently substitutes a different mechanism.
   */
  resolve(key?: string): AutoDefineStrategy {
    const wanted = key ?? this.defaultKey;
    if (wanted === null) throw new UnknownAutoDefineError('default', [...this.keys()]);
    const strategy = this.get(wanted);
    if (!strategy) throw new UnknownAutoDefineError(wanted, [...this.keys()]);
    return strategy;
  }
}

// ── Platform-config flavors ─────────────────────────────────────────────────────────────────────
// Each is a fully-defined registry a project extends (`new CustomAutoDefineRegistry({ extends: [flavor] })`)
// to inherit its strategies AND its default. A project picks one flavor; per-scope overrides via setDefault
// on a child registry in the chain.

/** `strict-explicit` — native baseline: registration only via the eager `explicit` strategy, no inference. */
export function createStrictExplicitFlavor(): CustomAutoDefineRegistry {
  const flavor = new CustomAutoDefineRegistry();
  flavor.define(explicitAutoDefine, true); // default = explicit
  return flavor;
}

/** `lazy-dom` — default to on-first-use DOM-presence (MutationObserver + dynamic import); explicit still available. */
export function createLazyDomFlavor(): CustomAutoDefineRegistry {
  const flavor = new CustomAutoDefineRegistry();
  flavor.define(explicitAutoDefine);
  flavor.define(lazyDomAutoDefine, true); // default = lazy-dom
  return flavor;
}

/** `build-parsed` — default to build-time registration (parse HTML usage / manifest); explicit still available. */
export function createBuildParsedFlavor(): CustomAutoDefineRegistry {
  const flavor = new CustomAutoDefineRegistry();
  flavor.define(explicitAutoDefine);
  flavor.define(buildParsedAutoDefine, true); // default = build-parsed
  return flavor;
}

/** The named flavors, for discovery (e.g. a configurator) — the list a project chooses from. */
export const AUTO_DEFINE_FLAVORS = {
  'strict-explicit': createStrictExplicitFlavor,
  'lazy-dom': createLazyDomFlavor,
  'build-parsed': createBuildParsedFlavor,
} as const;

export type AutoDefineFlavorName = keyof typeof AUTO_DEFINE_FLAVORS;
