/**
 * Phase S6 — renewals & cancellation, backlog #417.
 *
 * The pure domain core of the end-of-term + termination flows on an in-force policy:
 *   - RENEWAL: re-rate for the next term; accept (carry into a new term, stays in-force) or non-renew
 *     (→ expired).
 *   - CANCELLATION: record a reason (non-pay / insured-request / underwriting) and the PRORATED unearned
 *     refund; this is the cancel-reason guard input that gates in-force → cancelled.
 *   - REINSTATEMENT: lapsed → in-force (the reinstate guard).
 *
 * Reuses shipping standards at the app layer: re-rating is the Rating engine (#411); the cancel /
 * reinstate transitions are GUARDED Web Lifecycle edges (the guard predicates here are the Web Guards
 * stand-in, PLATFORM-GAP #289); every step is appended to the Web Audit trail. Proration reuses the S5
 * `remainingFraction` helper so endorsement and cancellation share one earned/unearned basis.
 */

import type { Policy, Role, CancellationReason, Cancellation, Renewal } from './types';
import { rate } from './rating';
import { remainingFraction } from './endorsement';

const addMonths = (iso: string, months: number): string => {
  const d = new Date(iso);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString();
};

/** The current term's end (= the next term's effective date). */
export const termEnd = (p: Policy): string => addMonths(p.term.start, p.term.months);

// ── Cancellation ────────────────────────────────────────────────────────────────
/** The cancel-reason guard: in-force → cancelled is allowed once a cancellation reason is recorded. */
export const cancellationRecorded = (p: Policy | undefined): boolean => !!p?.cancellation;

/**
 * Record a cancellation: compute the earned/unearned split of the term premium and the refund. A
 * pro-rata refund of the unexpired term is returned for insured-request / underwriting; non-pay is
 * short-rate (no refund — the carrier keeps the earned premium and waives the unearned). Stamps the
 * record the cancel-reason guard then reads; does NOT itself fire the lifecycle transition.
 */
export function recordCancellation(p: Policy, reason: CancellationReason, at: string, actor: Role): Cancellation {
  const termPremium = rate(p).premium;
  const earnedFraction = 1 - remainingFraction(p, at);
  const unexpired = Math.round(termPremium * (1 - earnedFraction));
  const cancellation: Cancellation = {
    reason,
    effective: at,
    termPremium,
    earnedFraction,
    unearnedRefund: reason === 'non-pay' ? 0 : unexpired, // short-rate on non-pay
    at,
    actor,
  };
  p.cancellation = cancellation;
  p.audit.push({
    at,
    actor,
    action: `cancellation.recorded — ${reason} · refund ${cancellation.unearnedRefund} (earned ${Math.round(earnedFraction * 100)}% of term)`,
  });
  return cancellation;
}

// ── Renewal ─────────────────────────────────────────────────────────────────────
/** Re-rate the policy for the next term (the renewal offer) without mutating it. */
export function renewalOffer(p: Policy): { oldPremium: number; newPremium: number; effective: string } {
  const oldPremium = rate(p).premium;
  // Re-rate the next term on the same factors (a real plan would age drivers / refresh symbols).
  const newPremium = rate(p).premium;
  return { oldPremium, newPremium, effective: termEnd(p) };
}

/**
 * Accept the renewal: carry the policy into a new term (start = current term end), reset the per-term
 * issuance + payment so the next term binds cleanly, record the renewal, and audit. Stays in-force.
 */
export function acceptRenewal(p: Policy, at: string, actor: Role): Renewal {
  const offer = renewalOffer(p);
  const renewal: Renewal = { offeredAt: at, oldPremium: offer.oldPremium, newPremium: offer.newPremium, effective: offer.effective, decision: 'accepted', at, actor };
  p.term = { start: offer.effective, months: p.term.months };
  p.payment = undefined;
  p.issued = undefined;
  (p.renewals ??= []).push(renewal);
  p.audit.push({ at, actor, action: `renewal.accepted — new term ${offer.effective.slice(0, 10)} · premium ${offer.newPremium}` });
  return renewal;
}

/** Non-renew: record the decision (the lifecycle transition in-force → expired fires separately). */
export function recordNonRenewal(p: Policy, at: string, actor: Role): Renewal {
  const offer = renewalOffer(p);
  const renewal: Renewal = { offeredAt: at, oldPremium: offer.oldPremium, newPremium: offer.newPremium, effective: offer.effective, decision: 'non-renewed', at, actor };
  (p.renewals ??= []).push(renewal);
  p.audit.push({ at, actor, action: `renewal.non-renewed — expires ${offer.effective.slice(0, 10)}` });
  return renewal;
}

// ── Reinstatement ─────────────────────────────────────────────────────────────
/** The reinstate guard: a lapsed policy may return to in-force (demo: always eligible). */
export const reinstateEligible = (p: Policy | undefined): boolean => p?.state === 'lapsed';

/** Audit a reinstatement (the lapsed → in-force transition fires separately). */
export function recordReinstatement(p: Policy, at: string, actor: Role): void {
  p.cancellation = undefined; // a reinstated policy is no longer pending cancellation
  p.audit.push({ at, actor, action: 'policy.reinstated — lapsed → in-force' });
}
