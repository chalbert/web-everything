/**
 * Loan-origination identity — slice S1a of #379 (#686).
 *
 * Realizes the **web-identity intent** shape (the UX-only seam graduated in #012/#482) for
 * the demo: a real signed-in user carrying a role set, plus the intent's `WebIdentitySignal`
 * (`authState` + identity descriptor) the chrome renders from — never ad-hoc local session.
 * The intent is provider-less by design (no ceremony / protocol), so the app *consumes the
 * shape* here; it does not import a runtime that doesn't exist. This replaces the hardcoded
 * `ACTOR = { role: 'underwriter' }` placeholder and feeds the lifecycle's per-edge actor check.
 */

// --- The consumed web-identity shape (intents.json#web-identity Interface Protocol) ---------
export type AuthState = 'unknown' | 'signed-out' | 'pending' | 'signed-in';
export interface IdentityDescriptor {
  /** Opaque, UX-level identity label (name / handle) — never the raw credential. */
  label: string;
  avatarUrl?: string;
}
export interface WebIdentitySignal {
  /** Reflected auth-state the consumer renders from. */
  readonly state: AuthState;
  /** Present only when state === 'signed-in'. */
  readonly identity?: IdentityDescriptor;
}

// --- The loan demo's role model on top of the identity descriptor ---------------------------
export type LoanRole = 'borrower' | 'loan-officer' | 'processor' | 'underwriter' | 'admin';
export const LOAN_ROLES: LoanRole[] = ['borrower', 'loan-officer', 'processor', 'underwriter', 'admin'];
export const ROLE_LABEL: Record<LoanRole, string> = {
  borrower: 'Borrower',
  'loan-officer': 'Loan Officer',
  processor: 'Processor',
  underwriter: 'Underwriter',
  admin: 'Admin',
};

export interface LoanUser extends IdentityDescriptor {
  id: string;
  /** Every role this user may act as. */
  roles: LoanRole[];
  /** The role currently being acted as (the act-as switcher target). */
  activeRole: LoanRole;
}

// The signed-in user — carries the full role set; defaults to acting as underwriter (the prior
// hardcoded actor), now switchable at runtime.
const USER: LoanUser = {
  id: 'u-okafor',
  label: 'D. Okafor',
  roles: [...LOAN_ROLES],
  activeRole: 'underwriter',
};

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/**
 * The app-wide identity signal. Exposes the web-identity `WebIdentitySignal` shape
 * (`state` + `identity`) plus the demo's role model and the act-as switcher.
 */
export const identitySignal = {
  // WebIdentitySignal — the shape the chrome renders signed-in/out from.
  get state(): AuthState {
    return 'signed-in';
  },
  get identity(): IdentityDescriptor {
    return { label: USER.label, avatarUrl: USER.avatarUrl };
  },

  // Demo role model.
  get user(): LoanUser {
    return USER;
  },
  get activeRole(): LoanRole {
    return USER.activeRole;
  },
  /** Switch the acting role (act-as). No-op for a role the user doesn't hold. */
  setActiveRole(role: LoanRole): void {
    if (USER.roles.includes(role) && role !== USER.activeRole) {
      USER.activeRole = role;
      emit();
    }
  },
  /** Subscribe to identity changes (role switch); returns an unsubscribe. */
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

/** The acting actor in the lifecycle / audit shape, derived live from the signal. */
export function currentActor(): { role: LoanRole; id: string; label: string } {
  return { role: USER.activeRole, id: USER.id, label: USER.label };
}
