/**
 * Web Lifecycle protocol — the **pure-contract half** (weblifecycle / #353, graduated `lifecycle`).
 *
 * Types and interfaces only: this module is fully **compile-erased** (no runtime emit) so it can become
 * the `@webeverything/contracts/lifecycle` entry (#872/#879) that FUI depends on (the FUI→WE arrow),
 * superseding byte-replication. The runtime half — the native-first `DefaultLifecycleProvider` and the
 * `CustomLifecycleRegistry` — lives next door in `./LifecycleProvider.ts`, which re-exports this surface
 * (`export type * from './contract'`) so existing importers keep one site.
 *
 * The `LifecycleDefinition` (status set + transition map) is the ONLY lock — data-defined and portable
 * across engines. Authorization (the edge `guard`) is delegated to a `GuardResolver` (the Web Guards
 * seam), and persistence is the entity's own concern; neither is owned here.
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
