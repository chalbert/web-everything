/**
 * Guard protocol — the provider+predicate seam (#288, graduated `guard`).
 *
 * A predicate/policy is attached to a *region* (document / route / modal / element) and evaluated at a
 * region *lifecycle event* (entering it, or trying to leave it), resolved by a **swappable**
 * `CustomGuardProvider` — default → project override → custom plug. This module ships the surface
 * types, the decision guard, and the **native-first default provider**; the registry that swaps
 * providers lives in `./registry.ts`, the default wiring in `./index.ts`. Like the validity-merge and
 * validator-resolution planes this is a standalone, dependency-free model of the contract — the runtime
 * `customGuards` plug (`plugs/webguards/`) fulfils the same shape as a core `CustomRegistry`.
 *
 * Three #288 rulings shape the contract and are encoded here, not redecided downstream:
 *  - The provider contract is **the only lock**: `evaluate` is **async** (a decision can require a
 *    server round-trip), the front-end is a **UX mirror, never enforcement** (the back end is
 *    authoritative), and a grant is **revocable** — `subscribe` lets a provider signal that a
 *    previously-allowed region must re-evaluate (session expired, flag flipped).
 *  - **Deny-outcomes are NOT unified.** The base `GuardDecision` carries only `allow` + an optional
 *    `reason`; each *member* intent owns its own denial family (exit guard → user-mediated confirm;
 *    access control → `hide | redirect | forbid | cloak`). Members layer their outcome on top of this
 *    seam — they do not redefine it.
 *  - The native-first default is **permissive** (no policy ⇒ allow), and *exit* leans on the platform's
 *    own cancelable primitives (`beforeunload`, the Navigation API `navigate` intercept, a dialog
 *    `cancel`) rather than inventing a blocking mechanism.
 */

/** What is being guarded. Opaque to the seam — a provider keys policy off `kind`/`id`, never the node. */
export type GuardRegionKind = 'document' | 'route' | 'modal' | 'element';

/** A region descriptor: its kind plus an optional stable id (route path, modal name, element id). */
export interface GuardRegion {
  readonly kind: GuardRegionKind;
  /** A stable identifier within the kind — e.g. the route path or modal name. Optional for `document`. */
  readonly id?: string;
}

/**
 * The region lifecycle event a guard fires at. `enter` is the *entry* mirror (access control — may I
 * reach this region?); `leave` is the *exit* mirror (exit guard — may I abandon this region?). The two
 * member intents (#178 access control, #273 exit guard) each own one.
 */
export type GuardEvent = 'enter' | 'leave';

/** An opaque per-evaluation context bag (the navigation event, the candidate user, flags…). */
export type GuardContext = Record<string, unknown>;

/**
 * The terminal answer a provider resolves to. **Intentionally minimal** — `allow` plus an optional
 * human-facing `reason`. The denial *strategy* (confirm vs hide/redirect/forbid/cloak) is the member
 * intent's concern, layered on top; the seam never unifies it (#288).
 */
export interface GuardDecision {
  readonly allow: boolean;
  /** Why the region was denied (or allowed-with-warning). Surfaced by the member's deny-outcome. */
  readonly reason?: string;
}

/** Notified when a previously-resolved decision for a region is revoked and must be re-evaluated. */
export type GuardRevocationListener = (region: GuardRegion) => void;

/**
 * The injectable contract every guard provider satisfies — one interface, swappable impls (the
 * native-first default, a project override, a custom plug). `key` names it for registration.
 * `evaluate` is **async** and **trust-crossing**: it may consult the server, and its answer is a UX
 * mirror of the authoritative back-end decision, never the enforcement point. `subscribe` is the
 * optional revocation signal — a provider that can have a grant withdrawn (auth expiry, flag flip)
 * implements it; a static provider omits it.
 */
export interface CustomGuardProvider {
  readonly key: string;
  /** Resolve whether `event` on `region` is allowed, given `context`. Async by contract (#288). */
  evaluate(region: GuardRegion, event: GuardEvent, context?: GuardContext): Promise<GuardDecision>;
  /** Watch for revocation of a region's standing decision; returns an unsubscribe. Optional. */
  subscribe?(region: GuardRegion, onRevoke: GuardRevocationListener): () => void;
}

/** A provider returned something that is not a conformant `GuardDecision` (the only-lock contract broken). */
export class GuardDecisionError extends Error {
  constructor(key: string, why: string) {
    super(`Guard provider "${key}" broke the GuardDecision contract: ${why}`);
    this.name = 'GuardDecisionError';
  }
}

/**
 * Enforce the decision contract at the trust boundary: every answer crossing back from a provider is
 * validated here, so a misbehaving (or hostile) custom provider is caught at the seam rather than
 * silently allowing a region. Returns the decision typed when valid; throws `GuardDecisionError`
 * otherwise.
 */
export function assertGuardDecision(key: string, decision: unknown): GuardDecision {
  if (decision === null || typeof decision !== 'object') {
    throw new GuardDecisionError(key, `expected an object, got ${decision === null ? 'null' : typeof decision}`);
  }
  const { allow, reason } = decision as Record<string, unknown>;
  if (typeof allow !== 'boolean') {
    throw new GuardDecisionError(key, `\`allow\` must be a boolean, got ${typeof allow}`);
  }
  if (reason !== undefined && typeof reason !== 'string') {
    throw new GuardDecisionError(key, `\`reason\` must be a string when present, got ${typeof reason}`);
  }
  return reason === undefined ? { allow } : { allow, reason };
}

/** A decision that allows the region — the native-first default's answer. */
export const ALLOW: GuardDecision = { allow: true };

/**
 * The native-first default provider: **permissive** (no policy ⇒ allow), for both entry and exit. It
 * does not invent a blocking mechanism — *exit* members lean on the platform's own cancelable
 * primitives (`beforeunload`, the Navigation API `navigate` intercept, a dialog `cancel`), and *access*
 * is allowed by default until a project override or custom provider says otherwise. Being static it
 * exposes no `subscribe` — nothing can revoke "allow".
 */
export class NativeGuardProvider implements CustomGuardProvider {
  readonly key = 'native';

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async evaluate(_region: GuardRegion, _event: GuardEvent, _context?: GuardContext): Promise<GuardDecision> {
    return ALLOW;
  }
}
