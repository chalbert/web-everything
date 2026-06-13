/**
 * @file guard/accessControl.ts
 * @description Access-control member — the **entry** member of the Guard protocol (#288), authored from
 *   the #178 ruling (Forks A–D) and the prior-art survey in
 *   `reports/2026-06-11-access-control-authorization-gate.md`. It is the settled entry mirror of the
 *   exit guard (#273): built **on** the provider+predicate seam in `./provider.ts`, never a new
 *   enforcement contract. This module restates the ratified design; it does not re-decide it.
 *
 * **Two surfaces, one provider (Fork A).** Authorization is universally factored into a *route guard*
 * (navigation entry — deny → a navigation outcome) and a *render gate* (render time — deny → render or
 * hide a subtree). They are not the same control; they share only the predicate — one
 * {@link CustomGuardProvider} feeds both. Both evaluate the seam's `enter` event.
 *
 * **Deny-outcome family — UX names it, the provider owns 403-vs-404 (Fork B).** The author picks from
 * `hide | redirect | forbid | cloak`. But the security-sensitive **existence-disclosure** call —
 * `forbid` (403, "you may not", confirms the resource exists) vs `cloak` (404, "it isn't here", hides
 * existence) — is **not** a UX-author dimension: RFC 9110 sanctions answering 404 to hide a forbidden
 * resource, and leaking existence enables enumeration. So {@link resolveDenyOutcome} applies a
 * provider/project-owned `disclosure` (default `conceal` — the secure default) that downgrades a
 * requested `forbid` to `cloak`. The UX layer never forces existence disclosure.
 *
 * **Feature-flags = an authority kind, not separate machinery (Fork C).** A flag source is just one
 * `CustomGuardProvider`; it inherits the identical trust boundary. The authority taxonomy is the open
 * set `authorization | feature-flag | process | validity`, default `authorization`, and new kinds are
 * additive (most-permissive — an unknown authority is allowed to exist).
 *
 * **Trust boundary — restated, not re-decided.** Every evaluation is async and the **back end is
 * authoritative**; this member is a **UX mirror, never the enforcement point**, and a grant is
 * revocable (the seam's `subscribe`). A client-side gate — including a feature-flag one — is never a
 * sufficient control on its own. The native route-guard substrate is the Navigation API `navigate`
 * intercept (composed by the Navigation Intent), not a blocking mechanism invented here.
 */

import {
  type CustomGuardProvider,
  type GuardRegion,
  type GuardContext,
  assertGuardDecision,
} from './provider.js';

/** The UX-facing deny-outcome family (#178 Fork B). `forbid`=403 (acknowledge), `cloak`=404 (hide existence). */
export type AccessDenyOutcome = 'hide' | 'redirect' | 'forbid' | 'cloak';

/** Why access is gated — the open authority taxonomy (#178 Fork C); default `authorization`, additive. */
export type AuthorityKind = 'authorization' | 'feature-flag' | 'process' | 'validity';

/** The two surfaces the member spans (#178 Fork A): the route guard and the render gate. */
export type AccessSurface = 'route' | 'render';

/**
 * The provider/project-owned existence-disclosure policy (#178 Fork B). `conceal` (the secure default,
 * RFC 9110) hides a forbidden resource's existence by downgrading `forbid` → `cloak`; `reveal` keeps a
 * requested `forbid` as a 403. This is a security call behind the provider, never a UX-author dimension.
 */
export type DisclosurePolicy = 'conceal' | 'reveal';

/** The access policy an author declares on a region. The member is opt-in: no policy ⇒ the seam's permissive default allows. */
export interface AccessControlPolicy {
  readonly surface: AccessSurface;
  /** What to do when the provider denies. Must be valid for `surface` (see {@link OUTCOMES_BY_SURFACE}). */
  readonly denyOutcome: AccessDenyOutcome;
  /** The authority kind gating this region. Defaults to `authorization`. */
  readonly authority?: AuthorityKind;
}

/** Which deny outcomes each surface can express. `redirect` is route-only; `hide` is render-only; both can `forbid`/`cloak`. */
export const OUTCOMES_BY_SURFACE: Readonly<Record<AccessSurface, readonly AccessDenyOutcome[]>> = {
  route: ['redirect', 'forbid', 'cloak'],
  render: ['hide', 'forbid', 'cloak'],
};

/** Thrown when a policy pairs a deny outcome with a surface that cannot express it (a config error). */
export class AccessControlConfigError extends Error {
  constructor(surface: AccessSurface, outcome: AccessDenyOutcome) {
    super(`Access-control: deny outcome "${outcome}" is not valid for the ${surface} surface (allowed: ${OUTCOMES_BY_SURFACE[surface].join(', ')})`);
    this.name = 'AccessControlConfigError';
  }
}

/** True when `outcome` is expressible on `surface`. */
export function isOutcomeForSurface(surface: AccessSurface, outcome: AccessDenyOutcome): boolean {
  return OUTCOMES_BY_SURFACE[surface].includes(outcome);
}

/**
 * Resolve the **effective** deny outcome from the author's request and the provider/project disclosure
 * policy (#178 Fork B): under `conceal` (default) a requested `forbid` becomes `cloak` to hide
 * existence; everything else passes through. Pure.
 */
export function resolveDenyOutcome(requested: AccessDenyOutcome, disclosure: DisclosurePolicy = 'conceal'): AccessDenyOutcome {
  if (requested === 'forbid' && disclosure === 'conceal') return 'cloak';
  return requested;
}

/** The access-control member's decision: allow, or deny with the effective outcome + authority + reason. */
export type AccessDecision =
  | { readonly allow: true }
  | { readonly allow: false; readonly outcome: AccessDenyOutcome; readonly authority: AuthorityKind; readonly reason?: string };

export interface EvaluateAccessOptions {
  /** The existence-disclosure policy for a deny (security, behind the provider). Default `conceal`. */
  readonly disclosure?: DisclosurePolicy;
  /** The per-evaluation context handed to the provider (the navigation event, candidate user, flags…). */
  readonly context?: GuardContext;
}

/**
 * Evaluate the access-control member for a region on the **entry** event, using the shared seam
 * provider. Validates the policy fits its surface, asks the provider (async, server-authoritative),
 * and on a deny layers the member's deny-outcome family on top of the base decision — applying the
 * provider/project existence-disclosure so the 403-vs-404 call is never the UX author's. The provider's
 * answer is run through {@link assertGuardDecision}, so a hostile provider is caught at the trust
 * boundary, not silently honoured.
 */
export async function evaluateAccess(
  provider: CustomGuardProvider,
  region: GuardRegion,
  policy: AccessControlPolicy,
  options: EvaluateAccessOptions = {},
): Promise<AccessDecision> {
  if (!isOutcomeForSurface(policy.surface, policy.denyOutcome)) {
    throw new AccessControlConfigError(policy.surface, policy.denyOutcome);
  }
  const decision = assertGuardDecision(provider.key, await provider.evaluate(region, 'enter', options.context));
  if (decision.allow) return { allow: true };
  return {
    allow: false,
    outcome: resolveDenyOutcome(policy.denyOutcome, options.disclosure),
    authority: policy.authority ?? 'authorization',
    reason: decision.reason,
  };
}
