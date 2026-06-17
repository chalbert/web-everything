/**
 * LifecycleProvider — reference runtime for the Web Lifecycle protocol (weblifecycle / #353).
 *
 * A domain entity's lifecycle is a declared status set + a transition map (each edge: from → to, an
 * optional guard predicate, and the permitted actor/role). This module ships the protocol's seam:
 *
 *   - `LifecycleDefinition` — the data-defined status set + transition map (the ONLY lock; portable).
 *   - `CustomLifecycleProvider` — the swappable contract: `available()` + `transition()`.
 *   - `DefaultLifecycleProvider` — a native-first, in-memory reference satisfying that contract; a
 *     workflow engine (XState, a BPM server) plugs in behind the same interface.
 *   - `CustomLifecycleRegistry` (`window.customLifecycles`) — named definitions/providers a project
 *     selects or overrides via the injector chain.
 *
 * Two concerns are NOT owned here, by design:
 *   - Authorization — *whether* this actor may fire an edge is a guard predicate, delegated to a
 *     `GuardResolver` (the Web Guards seam). The default resolver is permissive (there is no native
 *     authorization primitive); a real authz provider is async + server-authoritative.
 *   - Persistence — the entity's storage is its own concern; the provider only computes/applies moves.
 *
 * Every applied transition emits a `LifecycleEvent` — the composition seam for audit-trail (#357).
 */

import type {
  ActorRef,
  CustomLifecycleProvider,
  EntityRef,
  GuardResolver,
  LifecycleDefinition,
  LifecycleEvent,
  LifecycleStateMeta,
  LifecycleTransition,
} from './contract';

// Re-export the pure-contract surface so existing `./LifecycleProvider` importers reach the types and the
// runtime from one site (the split is at the file seam — see ./contract.ts, the future
// `@webeverything/contracts/lifecycle` entry).
export type * from './contract';

const permit: GuardResolver = () => true;

/**
 * Native-first, in-memory reference provider. Pure aside from the entity mutation it applies and the
 * `clock` it reads — both injectable, so it is deterministic under test.
 */
export class DefaultLifecycleProvider<S extends string = string> implements CustomLifecycleProvider<S> {
  private listeners = new Set<(e: LifecycleEvent<S>) => void>();

  constructor(
    private readonly def: LifecycleDefinition<S>,
    private readonly guard: GuardResolver<S> = permit,
    private readonly clock: () => string = () => new Date().toISOString(),
  ) {}

  /** The definition's state metadata (label/tone/terminal) for the Status Indicator intent. */
  meta(state: S): LifecycleStateMeta {
    return this.def.states[state] ?? {};
  }

  private edgesFrom(from: S): LifecycleTransition<S>[] {
    return this.def.transitions.filter((t) => t.from === from);
  }

  async available(entity: EntityRef<S>, actor: ActorRef): Promise<S[]> {
    const out: S[] = [];
    for (const t of this.edgesFrom(entity.state)) {
      if (t.actor && t.actor !== actor.role) continue;
      if (t.guard && !(await this.guard(t.guard, { entity, to: t.to, actor }))) continue;
      out.push(t.to);
    }
    return out;
  }

  async transition(entity: EntityRef<S>, to: S, actor: ActorRef): Promise<LifecycleEvent<S>> {
    const edge = this.edgesFrom(entity.state).find((t) => t.to === to);
    if (!edge) throw new Error(`illegal lifecycle transition: ${entity.state} → ${to}`);
    if (edge.actor && edge.actor !== actor.role)
      throw new Error(`actor role "${actor.role}" may not fire ${entity.state} → ${to}`);
    if (edge.guard && !(await this.guard(edge.guard, { entity, to, actor })))
      throw new Error(`guard "${edge.guard}" denied ${entity.state} → ${to}`);
    const ev: LifecycleEvent<S> = { entity: entity.id, from: entity.state, to, actor: actor.role, at: this.clock() };
    entity.state = to; // apply the move
    for (const l of this.listeners) l(ev);
    return ev;
  }

  subscribe(fn: (e: LifecycleEvent<S>) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}

/** Named registry of lifecycle providers — the project selects/overrides via the injector chain. */
export class CustomLifecycleRegistry {
  private readonly map = new Map<string, CustomLifecycleProvider>();
  define(name: string, provider: CustomLifecycleProvider): CustomLifecycleProvider {
    this.map.set(name, provider);
    return provider;
  }
  get(name: string): CustomLifecycleProvider | undefined {
    return this.map.get(name);
  }
  has(name: string): boolean {
    return this.map.has(name);
  }
}

/** Install (idempotently) the global `customLifecycles` registry and return it. */
export function registerLifecycle(): CustomLifecycleRegistry {
  const w = globalThis as unknown as { customLifecycles?: CustomLifecycleRegistry };
  return (w.customLifecycles ??= new CustomLifecycleRegistry());
}
