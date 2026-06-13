/**
 * Phase S9 — disclosures + e-sign + TRID clock (backlog #386).
 *
 * On submit, an originator owes the borrower an initial disclosure package (incl. a mock Loan Estimate)
 * within a TRID-style 3-business-day clock; the borrower must e-sign before the file advances; a changed
 * circumstance forces a re-disclosure. This module is the pure domain core of that flow — date math +
 * package generation + the signature gate — kept app-side because it is loan-origination policy, not a
 * reusable Web Everything standard. The reusable surfaces it EXHIBITS (e-signature capture, a
 * business-day deadline clock, document/disclosure generation) have no governing WE standard yet and are
 * tagged as Layer-2 candidates in conformance.json — the proactive feed for /new-standard.
 *
 * It deliberately reuses shipping standards for everything that already has one: the lifecycle gate
 * (advance is blocked until the package is signed), the audit trail (every generate/sign is an
 * AuditEvent), and the status indicator (each disclosure's state is a semantic chip in the UI layer).
 */

import type { Application, Disclosure } from './types';

/** TRID counts BUSINESS days — weekends don't tick. (Federal holidays are out of scope for the demo.) */
export function addBusinessDays(start: Date, n: number): Date {
  const d = new Date(start.getTime());
  let added = 0;
  while (added < n) {
    d.setUTCDate(d.getUTCDate() + 1);
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) added++;
  }
  return d;
}

/** Business days remaining until `due` from `now` (negative ⇒ overdue). Weekends excluded. */
export function businessDaysRemaining(due: Date, now: Date): number {
  const sign = due.getTime() >= now.getTime() ? 1 : -1;
  const [a, b] = sign === 1 ? [now, due] : [due, now];
  const cur = new Date(a.getTime());
  let count = 0;
  while (cur.getTime() < b.getTime()) {
    cur.setUTCDate(cur.getUTCDate() + 1);
    const day = cur.getUTCDay();
    if (day !== 0 && day !== 6) count++;
  }
  return sign * count;
}

export interface TridClock {
  due: string; // ISO date the signed package is owed by
  businessDaysRemaining: number;
  overdue: boolean;
}

/** The TRID clock for an application's initial package, evaluated at `now`. */
export function tridClock(app: Application, now: Date = new Date(0)): TridClock | null {
  const pkg = app.disclosures.find((d) => d.type === 'initial-package');
  if (!pkg) return null;
  const generated = new Date(pkg.generatedAt);
  const due = addBusinessDays(generated, pkg.dueWithinBusinessDays);
  const remaining = businessDaysRemaining(due, now);
  return { due: due.toISOString(), businessDaysRemaining: remaining, overdue: remaining < 0 && !pkg.signedAt };
}

/**
 * Generate the initial disclosure package on submit: a Loan Estimate + the initial-package envelope,
 * each owed within 3 business days. Idempotent — re-running on an app that already has an initial
 * package returns the existing disclosures untouched (so a re-inspect never duplicates the package).
 */
export function generateInitialDisclosures(app: Application, now: Date = new Date(0)): Disclosure[] {
  if (app.disclosures.some((d) => d.type === 'initial-package')) return app.disclosures;
  const at = now.toISOString();
  const pkg: Disclosure[] = [
    { type: 'loan-estimate', generatedAt: at, dueWithinBusinessDays: 3 },
    { type: 'initial-package', generatedAt: at, dueWithinBusinessDays: 3 },
  ];
  app.disclosures = [...app.disclosures, ...pkg];
  return app.disclosures;
}

/** E-sign a disclosure: stamp signer + timestamp. The caller records the matching AuditEvent. */
export function signDisclosure(disclosure: Disclosure, signedBy: string, now: Date = new Date(0)): void {
  disclosure.signedAt = now.toISOString();
  disclosure.signedBy = signedBy;
}

/** The lifecycle gate: the file may not advance past submission until the initial package is signed. */
export function initialPackageSigned(app: Application): boolean {
  const pkg = app.disclosures.find((d) => d.type === 'initial-package');
  return !!pkg?.signedAt;
}

/**
 * Changed-circumstance re-disclosure: append a fresh `redisclosure` (its own 3-business-day clock),
 * which re-opens the signature gate for that revision. Records nothing itself — the caller audits it.
 */
export function addRedisclosure(app: Application, now: Date = new Date(0)): Disclosure {
  const redisclosure: Disclosure = { type: 'redisclosure', generatedAt: now.toISOString(), dueWithinBusinessDays: 3 };
  app.disclosures = [...app.disclosures, redisclosure];
  return redisclosure;
}

/** Human label for a disclosure kind — UI convenience. */
export const DISCLOSURE_LABEL: Record<Disclosure['type'], string> = {
  'loan-estimate': 'Loan Estimate',
  'initial-package': 'Initial disclosure package',
  'redisclosure': 'Re-disclosure (changed circumstance)',
};
