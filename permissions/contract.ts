/**
 * webpermissions — the declared role / permission-scope authorization model, **pure-contract half**
 * (#1699; ruled by #178 + #379).
 *
 * Types and interfaces only: fully **compile-erased** (no runtime emit) so it can become the
 * `@webeverything/contracts/permissions` entry (#872/#874) that consumers depend on — exactly like
 * `identity/contract.ts` (webidentity, #1060) and `guard/contract.ts`. webidentity supplies the identity
 * shapes; **this supplies the role/scope half**: the declared authorization model the permission/identity
 * simulator (#1645/#1695) enumerates and the access-control gate consults. The runtime authorization gate
 * and the dev-browser RACI lens (#1636) *consume* this; they do not own it.
 *
 * This is **app RBAC** — roles, permission scopes, and the affordances each scope gates — and is distinct
 * from the cross-cutting browser **Permissions-API** `permission` intent (#009/#457, which models
 * Permissions-API *state*, a different concern; #379's split note). The model is the one #379 ratified for
 * exercise-app A: roles (borrower / loan-officer / processor / underwriter / admin) with **field-,
 * action-, state-, and ownership-scoped** permissions.
 */

/** A declared role an identity can hold — the subject side of an authorization decision. */
export interface Role {
  /** Stable role id (e.g. `loan-officer`). */
  readonly id: string;
  readonly label?: string;
  readonly description?: string;
}

/**
 * The dimension a permission scope gates (#379): a `field` (a walled-off datum, e.g. an HMDA field), an
 * `action` (a decision authority, e.g. approve), a `state` (a lifecycle-state-scoped edit right), or
 * `ownership` (a row/record-ownership-scoped right, e.g. only your own pipeline).
 */
export type PermissionScopeKind = 'field' | 'action' | 'state' | 'ownership';

/** One affordance a scope gates — a target of the given kind, addressed by id. */
export interface Affordance {
  readonly kind: PermissionScopeKind;
  /** The target id (a field name, action id, state id, or ownership-relation id). */
  readonly id: string;
  readonly label?: string;
}

/**
 * A declared permission scope — a named capability that gates one or more affordances of its `kind`. The
 * unit a grant references and the gate evaluates; introspectable so the simulator can enumerate every
 * scope in force.
 */
export interface PermissionScope {
  /** Stable scope id (e.g. `edit-hmda-fields`). */
  readonly id: string;
  readonly kind: PermissionScopeKind;
  readonly label?: string;
  readonly description?: string;
  /** The affordances this scope is declared to gate (all of its own `kind`). */
  readonly gates: readonly Affordance[];
}

/** A grant — a role holds a set of scopes (by id). The edges of the model the gate walks. */
export interface RoleGrant {
  /** The role id this grant is for ({@link Role.id}). */
  readonly role: string;
  /** The scope ids granted to the role ({@link PermissionScope.id}). */
  readonly scopes: readonly string[];
}

/**
 * The complete declared authorization model — what the permission/identity simulator (#1645/#1695)
 * enumerates and the access-control gate consults. Pure data: roles, the scopes in force, and which roles
 * hold which scopes. Self-describing and introspectable; the runtime evaluator is impl, not here.
 */
export interface PermissionModel {
  readonly roles: readonly Role[];
  readonly scopes: readonly PermissionScope[];
  readonly grants: readonly RoleGrant[];
}

/** A point the gate evaluates: does some role's grants include a scope gating this affordance? */
export interface PermissionQuery {
  readonly role: string;
  readonly affordance: Pick<Affordance, 'kind' | 'id'>;
}

/** The gate's verdict for a {@link PermissionQuery}. `deny` is the safe default when no scope grants it. */
export type PermissionDecision = 'allow' | 'deny';
