import CustomRegistry, { type CustomRegistryOptions } from '@frontierui/plugs/core/CustomRegistry';
import type {
  CustomRenderStrategy,
  RenderHandle,
  RenderInput,
  RenderScope,
} from './CustomRenderStrategy';
import { DeclarativeStaticStrategy } from './DeclarativeStaticStrategy';

/**
 * Name-keyed registry of render strategies, resolved per scope — built the **config-extends-platform**
 * way (#243): it extends the core `CustomRegistry` (own → extended chain) so it is injector-chain
 * resolvable and inheritable, and it carries **no tool-baked default**. This replaces the old bespoke
 * shape (a private `Map` + `#defaultName` seeded by "first registered wins" + a hand-rolled `parent`
 * pointer) — the anti-pattern this item fixes. The default-strategy selection now lives in a platform
 * config *flavor* a project extends ({@link createDeclarativeStaticFlavor} / {@link renderStrategyRegistry}),
 * resolved through the same `extends` chain that resolves strategies. Nearest-config-wins replaces the
 * old nearest-`parent`-wins, with identical semantics.
 *
 * Spec: /projects/webcomponents/#protocol-render-strategy
 */
export class CustomRenderStrategyRegistry extends CustomRegistry<CustomRenderStrategy> {
  localName = 'customRenderStrategy';
  /** Default set ONLY explicitly (a flavor/config via {@link setDefault}), never by registration order. */
  #ownDefaultName: string | null = null;
  /** Extended configs, kept for default resolution (core `CustomRegistry` keeps its own copy private). */
  readonly #configs: CustomRenderStrategyRegistry[];

  constructor(options: CustomRegistryOptions<CustomRenderStrategy> = {}) {
    super(options);
    this.#configs = (options.extends ?? []) as CustomRenderStrategyRegistry[];
  }

  /**
   * Register a strategy under its `name`. Unlike the old shape this does **not** seed a default — a bare
   * registry stays default-less; the default comes from an extended flavor or an explicit {@link setDefault}.
   */
  register(strategy: CustomRenderStrategy): this {
    this.set(strategy.name, strategy);
    return this;
  }

  /** Set the default strategy name for this scope (per-scope override). Must be resolvable from here. */
  setDefault(name: string): this {
    if (!this.has(name)) {
      throw new Error(`Unknown render strategy: ${name}`);
    }
    this.#ownDefaultName = name;
    return this;
  }

  /**
   * The default strategy name in effect for this scope: this registry's own default if set, else the
   * nearest extended config's default (nearest-config-wins). `undefined` when nothing in the chain
   * declares one — a bare tool with no platform config extended has no default, by design.
   */
  get defaultName(): string | undefined {
    if (this.#ownDefaultName !== null) return this.#ownDefaultName;
    for (const config of this.#configs) {
      const inherited = config.defaultName;
      if (inherited !== undefined) return inherited;
    }
    return undefined;
  }

  /**
   * Resolve a strategy by name, or the scope default when `name` is omitted. Walks the extended config
   * chain (nearest-scope wins) via the core `CustomRegistry`.
   */
  resolve(name?: string): CustomRenderStrategy {
    const target = name ?? this.defaultName;
    if (target === undefined) {
      throw new Error('No render strategy registered and no default set.');
    }
    const strategy = this.get(target);
    if (!strategy) {
      throw new Error(`Unknown render strategy: ${target}`);
    }
    return strategy;
  }

  /** Convenience: resolve a strategy (by name or default) and mount in one call. */
  render(
    tree: RenderInput,
    host: ParentNode,
    options: { strategy?: string; scope?: RenderScope } = {}
  ): RenderHandle {
    return this.resolve(options.strategy).mount(tree, host, options.scope);
  }
}

/**
 * The native-first platform-config flavor: a fully-defined registry with the declarative-static
 * strategy registered and set as its default. A project extends this (rather than the tool baking the
 * default) — the config-extends-platform model. Sibling of the auto-define `strict-explicit` flavor (#242).
 */
export function createDeclarativeStaticFlavor(): CustomRenderStrategyRegistry {
  return new CustomRenderStrategyRegistry()
    .register(new DeclarativeStaticStrategy())
    .setDefault('declarative-static');
}

/**
 * The default app-level registry — a project config that **extends** the native-first flavor, so the
 * declarative-static default comes from config, not from the tool. JSX mounts go through this unless a
 * nearer scope overrides it.
 */
export const renderStrategyRegistry = new CustomRenderStrategyRegistry({
  extends: [createDeclarativeStaticFlavor()],
});

/**
 * Mount a tree through the default registry. The canonical, registry-backed mount path — the
 * declarative-static behaviour is now an explicit resolved provider, not an assumption.
 */
export function render(
  tree: RenderInput,
  host: ParentNode,
  options?: { strategy?: string; scope?: RenderScope }
): RenderHandle {
  return renderStrategyRegistry.render(tree, host, options);
}
