import type {
  CustomRenderStrategy,
  RenderHandle,
  RenderInput,
  RenderScope,
} from './CustomRenderStrategy';
import { DeclarativeStaticStrategy } from './DeclarativeStaticStrategy';

/**
 * Name-keyed registry of render strategies, resolved per scope.
 *
 * A child registry may declare a `parent`; resolution walks child → parent so
 * **nearest-scope wins** — the same rule CustomChangeStrategyRegistry uses, letting different
 * subtrees of one app render with different strategies simultaneously. Full injector-chain
 * resolution composes later; the `parent` pointer is the minimal honouring of the scope rule
 * for the seam (backlog #077).
 */
export class CustomRenderStrategyRegistry {
  readonly #strategies = new Map<string, CustomRenderStrategy>();
  #defaultName: string | undefined;

  constructor(readonly parent?: CustomRenderStrategyRegistry) {}

  /**
   * Register a strategy. In a root registry (no parent), the first one registered becomes the
   * default until {@link setDefault} overrides it.
   */
  register(strategy: CustomRenderStrategy): this {
    this.#strategies.set(strategy.name, strategy);
    if (this.#defaultName === undefined && this.parent === undefined) {
      this.#defaultName = strategy.name;
    }
    return this;
  }

  /** Set the default strategy name for this scope. Must be resolvable from here. */
  setDefault(name: string): this {
    if (!this.has(name)) {
      throw new Error(`Unknown render strategy: ${name}`);
    }
    this.#defaultName = name;
    return this;
  }

  /** The default strategy name in effect for this scope (nearest-scope wins). */
  get defaultName(): string | undefined {
    return this.#defaultName ?? this.parent?.defaultName;
  }

  /** Whether a strategy is resolvable from this scope (this registry or an ancestor). */
  has(name: string): boolean {
    return this.#strategies.has(name) || (this.parent?.has(name) ?? false);
  }

  /**
   * Resolve a strategy by name, or the scope default when `name` is omitted. Walks to the
   * parent registry if not found locally (nearest-scope wins).
   */
  resolve(name?: string): CustomRenderStrategy {
    const target = name ?? this.defaultName;
    if (target === undefined) {
      throw new Error('No render strategy registered and no default set.');
    }
    const local = this.#strategies.get(target);
    if (local) return local;
    if (this.parent) return this.parent.resolve(target);
    throw new Error(`Unknown render strategy: ${target}`);
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
 * The default app-level registry, pre-seeded with the native-first declarative-static
 * strategy. JSX mounts go through this unless a nearer scope overrides it.
 */
export const renderStrategyRegistry = new CustomRenderStrategyRegistry().register(
  new DeclarativeStaticStrategy()
);

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
