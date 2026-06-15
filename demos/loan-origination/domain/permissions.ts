/**
 * Loan-origination permissions — slice S1b of #379 (consume the Guard protocol #272/#178).
 *
 * Maps the loan app's permission scopes onto the shipping **Guard protocol** access-control member
 * (`guard/provider.ts`, intent #178): a `LoanGuardProvider` implementing the swappable
 * {@link CustomGuardProvider} seam, resolving `enter` (access) decisions for three scopes, plus the
 * `ownsApplication` ownership predicate. Per the #288 contract the front end is a **UX mirror, never the
 * enforcement point** (the back end stays authoritative), and deny *strategy* (hide vs forbid) is the
 * member's concern layered on top of the minimal `{ allow, reason }` decision — exposed here via
 * {@link denyOutcomeFor} so the pipeline UI that *applies* this (slice S10, out of scope) can hide a field
 * but forbid an action.
 *
 * The three scopes (S1b):
 *  - **state-scoped editing** — a borrower edits only in `draft`; once submitted the application is
 *    read-only to them. Each staff role edits only in the states it works.
 *  - **field-scoped HMDA wall-off** — the borrower `demographic` block (fair-lending self-id) is visible
 *    to Underwriter/Admin (and the borrower entering their own), hidden from the Loan-Officer pricing
 *    view, and **never an input to the rules engine** ({@link isEngineReadableField}).
 *  - **action-scoped authority** — Underwriter-only decision + condition-clear, Admin-only threshold
 *    edit, Loan-Officer may quote but not approve.
 *
 * No state-machine work: lifecycle state is read from the shape shipped by #380 (`Application.state`).
 */
import type {
  CustomGuardProvider,
  GuardRegion,
  GuardEvent,
  GuardContext,
  GuardDecision,
} from '../../../guard/provider';
import { ALLOW } from '../../../guard/provider';
import type { Application, ApplicationState } from './types';
import { TERMINAL_STATES } from './types';
import type { LoanRole } from './identity';

/** The acting actor (role + identity) a decision is evaluated for. */
export interface LoanActor {
  role: LoanRole;
  id: string;
}

// ── Ownership ──────────────────────────────────────────────────────────────────

/**
 * Does `actor` own `app` for the purpose of scoping? A borrower owns an application they are a borrower
 * on; staff own by assignment (the loan officer of record, the assigned processor/underwriter); Admin has
 * oversight of all. Ownership gates *their own* draft-editing + self-entered HMDA, never authority.
 */
export function ownsApplication(actor: LoanActor, app: Application): boolean {
  switch (actor.role) {
    case 'borrower':
      return app.borrowers.some((b) => b.id === actor.id);
    case 'loan-officer':
      return app.loanOfficerId === actor.id;
    case 'processor':
      return app.assignedProcessorId === actor.id;
    case 'underwriter':
      return app.assignedUnderwriterId === actor.id;
    case 'admin':
      return true;
    default:
      return false;
  }
}

// ── State-scoped editing ─────────────────────────────────────────────────────────

/** The lifecycle states in which each role may edit the application (empty ⇒ never via this scope). */
const EDITABLE_STATES: Record<LoanRole, ApplicationState[]> = {
  borrower: ['draft'],
  'loan-officer': ['draft', 'submitted'],
  processor: ['processing'],
  underwriter: ['underwriting', 'approved-with-conditions', 'suspended'],
  admin: [], // admin handled below (all non-terminal)
};

/**
 * Whether `actor` may edit `app` right now, given its lifecycle state. A borrower edits only their own
 * draft (read-only once submitted); staff edit only in the states they work; Admin edits any non-terminal
 * application. Terminal applications are read-only to everyone.
 */
export function editability(actor: LoanActor, app: Application): 'editable' | 'read-only' {
  if (TERMINAL_STATES.includes(app.state)) return 'read-only';
  if (actor.role === 'admin') return 'editable';
  if (!EDITABLE_STATES[actor.role].includes(app.state)) return 'read-only';
  // A borrower must own the application to edit their draft.
  if (actor.role === 'borrower' && !ownsApplication(actor, app)) return 'read-only';
  return 'editable';
}

// ── Field-scoped HMDA wall-off ─────────────────────────────────────────────────────

/** Field ids walled off as HMDA fair-lending self-identification (never a pricing/eligibility input). */
export const HMDA_FIELDS: ReadonlySet<string> = new Set(['demographic']);

/** Roles allowed to *view* an HMDA field (besides the borrower entering their own). */
const HMDA_VIEW_ROLES: ReadonlySet<LoanRole> = new Set(['underwriter', 'admin']);

export function isHmdaField(fieldId: string): boolean {
  return HMDA_FIELDS.has(fieldId);
}

/**
 * Whether the rules engine may read a field. HMDA fields are **never** an engine input (fair-lending) —
 * the engine guards its inputs against this, so a demographic value can never influence a decision.
 */
export function isEngineReadableField(fieldId: string): boolean {
  return !isHmdaField(fieldId);
}

/**
 * Field visibility for a role. Non-HMDA fields are visible (this scope only walls off HMDA). An HMDA field
 * is visible to Underwriter/Admin, to the borrower entering their *own* (when `ownsApp`), and hidden from
 * everyone else — notably the Loan-Officer pricing view.
 */
export function fieldVisibility(
  role: LoanRole,
  fieldId: string,
  opts: { ownsApp?: boolean } = {},
): 'visible' | 'hidden' {
  if (!isHmdaField(fieldId)) return 'visible';
  if (HMDA_VIEW_ROLES.has(role)) return 'visible';
  if (role === 'borrower' && opts.ownsApp) return 'visible';
  return 'hidden';
}

// ── Action-scoped authority ────────────────────────────────────────────────────────

/** The roles authorized to fire each gated action. An action not listed here is allowed (un-gated). */
export const ACTION_AUTHORITY: Record<string, LoanRole[]> = {
  decision: ['underwriter'], // the UW credit decision (approve/suspend/decline)
  'clear-condition': ['underwriter'], // clearing/waiving a PTD/PTC condition
  'edit-threshold': ['admin'], // editing a rules/pricing threshold
  quote: ['loan-officer', 'admin'], // a loan officer may quote a price…
  approve: ['underwriter'], // …but only an underwriter may approve
};

/** Whether `role` may fire `action`. Unknown (un-gated) actions are allowed. */
export function actionAllowed(role: LoanRole, action: string): boolean {
  const authorized = ACTION_AUTHORITY[action];
  return authorized === undefined || authorized.includes(role);
}

// ── Guard-protocol provider (the #178 access-control member) ───────────────────────

/** A loan permission scope, parsed from a guard region id (`field:…` / `action:…` / `edit`). */
export type PermissionScope =
  | { scope: 'field'; fieldId: string }
  | { scope: 'action'; action: string }
  | { scope: 'edit' }
  | { scope: 'unknown' };

/** Parse a guard region into the loan permission scope it addresses. */
export function scopeFor(region: GuardRegion): PermissionScope {
  const id = region.id ?? '';
  if (id.startsWith('field:')) return { scope: 'field', fieldId: id.slice('field:'.length) };
  if (id.startsWith('action:')) return { scope: 'action', action: id.slice('action:'.length) };
  if (id === 'edit' || id === 'edit:application') return { scope: 'edit' };
  return { scope: 'unknown' };
}

/** The member deny-outcome (#288: each member owns its denial family) the UI should apply for a region. */
export function denyOutcomeFor(region: GuardRegion): 'hide' | 'forbid' {
  return scopeFor(region).scope === 'field' ? 'hide' : 'forbid';
}

interface LoanGuardEvalContext extends GuardContext {
  actor?: LoanActor;
  app?: Application;
}

/**
 * The loan app's access-control provider. Maps each region (`field:<name>`, `action:<name>`, `edit`) at
 * the `enter` event onto the S1b scopes; `leave` (the exit-guard member) is not this provider's concern
 * and is always allowed. A missing actor denies (safe: no decision without a subject), mirroring the
 * lifecycle guard resolver's deny-on-unknown stance.
 */
export class LoanGuardProvider implements CustomGuardProvider {
  readonly key = 'loan-permissions';

  async evaluate(region: GuardRegion, event: GuardEvent, context?: GuardContext): Promise<GuardDecision> {
    if (event !== 'enter') return ALLOW; // exit-guard member owns `leave`
    const ctx = (context ?? {}) as LoanGuardEvalContext;
    const actor = ctx.actor;
    if (!actor) return { allow: false, reason: 'no acting identity' };

    const parsed = scopeFor(region);
    switch (parsed.scope) {
      case 'field': {
        const ownsApp = ctx.app ? ownsApplication(actor, ctx.app) : false;
        const visible = fieldVisibility(actor.role, parsed.fieldId, { ownsApp }) === 'visible';
        return visible ? ALLOW : { allow: false, reason: `field "${parsed.fieldId}" hidden from ${actor.role}` };
      }
      case 'action': {
        const allowed = actionAllowed(actor.role, parsed.action);
        return allowed ? ALLOW : { allow: false, reason: `${actor.role} may not "${parsed.action}"` };
      }
      case 'edit': {
        if (!ctx.app) return { allow: false, reason: 'no application in context' };
        const editable = editability(actor, ctx.app) === 'editable';
        return editable
          ? ALLOW
          : { allow: false, reason: `${actor.role} cannot edit in state "${ctx.app.state}"` };
      }
      default:
        return ALLOW; // un-scoped region — not gated by loan permissions
    }
  }
}

/** Build the loan permission guard provider (consumed by the app; registered in app.ts). */
export function createLoanGuardProvider(): LoanGuardProvider {
  return new LoanGuardProvider();
}
