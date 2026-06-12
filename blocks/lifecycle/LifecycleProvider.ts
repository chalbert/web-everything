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

export type StatusTone = 'neutral' | 'info' | 'progress' | 'positive' | 'caution' | 'critical';

/** A reference to the entity being moved. `state` is its CURRENT status (the provider reads it). */
export interface EntityRef<S extends string = string> {
  id: string;
  state: S;
}

/** Who is attempting the move. `role` is matched against an edge's permitted `actor` (a UX hint). */
export interface ActorRef {
  id?: string;
  role: string;
}

export interface LifecycleTransition<S extends string = string> {
  from: S;
  to: S;
  /** Names a guard predicate the GuardResolver evaluates (delegated to Web Guards). Omit = unguarded. */
  guard?: string;
  /** The role permitted to fire it. Omit = any actor / automatic. The guard is the real gate. */
  actor?: string;
}

export interface LifecycleStateMeta {
  terminal?: boolean;
  label?: string;
  /** Canonical severity for the Status Indicator intent — tone, not bespoke colour. */
  tone?: StatusTone;
}

/** The transition map — data-defined, so it is portable across engines. The only lock. */
export interface LifecycleDefinition<S extends string = string> {
  initial: S;
  states: Record<S, LifecycleStateMeta>;
  transitions: LifecycleTransition<S>[];
}

/** Emitted on every applied transition — the audit / reporting composition seam. */
export interface LifecycleEvent<S extends string = string> {
  entity: string;
  from: S;
  to: S;
  actor: string;
  at: string; // ISO timestamp
}

/** Resolves an edge's guard predicate. Async + server-authoritative for a real authz provider. */
export type GuardResolver<S extends string = string> = (
  guard: string,
  ctx: { entity: EntityRef<S>; to: S; actor: ActorRef },
) => boolean | Promise<boolean>;

/** The provider seam — the only lock. Satisfied by the default and every plugged engine alike. */
export interface CustomLifecycleProvider<S extends string = string> {
  /** Which transitions are currently available to this actor (actor + guard pre-evaluated). */
  available(entity: EntityRef<S>, actor: ActorRef): Promise<S[]>;
  /** Fire one. Rejects on an unknown/forbidden edge. On success applies it and emits the event. */
  transition(entity: EntityRef<S>, to: S, actor: ActorRef): Promise<LifecycleEvent<S>>;
  /** Observe applied transitions (audit seam). Returns an unsubscribe. */
  subscribe?(fn: (e: LifecycleEvent<S>) => void): () => void;
}

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
