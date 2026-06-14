/**
 * Phase S10 — event-driven notifications (backlog #421).
 *
 * Pure domain mapping from a policy / claim event to the notification it raises: WHO it concerns (the
 * relevant actor), its severity, and its message. The events this phase specifies — a policy lifecycle
 * change (bound, referred, …) and a claim status change — each route to the actor who owns the next move.
 * The notifications auto-feed off the SAME lifecycle transitions the audit trail already records, so the
 * two surfaces stay consistent.
 *
 * PLATFORM-GAP: #358 — Web Everything has a `notification` standard (the presentation-agnostic transient
 * in-page message block) but it is still `draft`, with no shipping runtime to consume. So the app hand-
 * rolls a minimal notification region + store (app.ts) against this domain mapping, tagged as a GAP: the
 * exercise app is the forcing function that drives #358 to an active, consumable block. (Same call the
 * loan app A made for its S11 notifications — a second consumer reinforcing the same gap.)
 */

import type { Role, PolicyState, ClaimState } from './types';

export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error';

export interface AppNotification {
  id: string;
  kind: 'policy' | 'claim';
  ref: string; // policy or claim number
  to: Role;
  severity: NotificationSeverity;
  message: string;
  at: string;
  read: boolean;
}

/** The unrouted core of a notification — `to`/`severity`/`message`, before it gets an id + timestamp. */
export interface NotificationDraft {
  to: Role;
  severity: NotificationSeverity;
  message: string;
}

/** The actor a freshly-entered policy state most concerns — who owns the next move. */
const POLICY_OWNER: Record<PolicyState, Role> = {
  quote: 'agent',
  referred: 'underwriter',
  quoted: 'agent',
  bound: 'policyholder',
  'in-force': 'policyholder',
  cancelled: 'policyholder',
  expired: 'agent',
  lapsed: 'policyholder',
};

const POLICY_SEVERITY: Partial<Record<PolicyState, NotificationSeverity>> = {
  referred: 'warning',
  bound: 'success',
  'in-force': 'success',
  cancelled: 'warning',
  lapsed: 'warning',
};

/** The actor a freshly-entered claim state most concerns. */
const CLAIM_OWNER: Record<ClaimState, Role> = {
  fnol: 'adjuster',
  triage: 'adjuster',
  investigating: 'adjuster',
  approved: 'policyholder',
  paying: 'policyholder',
  paid: 'policyholder',
  denied: 'policyholder',
  closed: 'adjuster',
};

const CLAIM_SEVERITY: Partial<Record<ClaimState, NotificationSeverity>> = {
  approved: 'success',
  paid: 'success',
  denied: 'error',
};

const human = (s: string) => s.replace(/-/g, ' ');

export function policyStateNotification(policyNumber: string, to: PolicyState): NotificationDraft {
  return {
    to: POLICY_OWNER[to],
    severity: POLICY_SEVERITY[to] ?? 'info',
    message: `Policy ${policyNumber} ${to === 'referred' ? 'was referred to underwriting' : `moved to ${human(to)}`}.`,
  };
}

export function claimStateNotification(claimNumber: string, to: ClaimState): NotificationDraft {
  return {
    to: CLAIM_OWNER[to],
    severity: CLAIM_SEVERITY[to] ?? 'info',
    message: `Claim ${claimNumber} status: ${human(to)}.`,
  };
}

/** A native-first, in-memory notification store. The draft `notification` block (#358) will replace this. */
export class NotificationStore {
  private items: AppNotification[] = [];
  private seq = 0;
  private listeners = new Set<() => void>();

  push(kind: 'policy' | 'claim', ref: string, draft: NotificationDraft, at: string): AppNotification {
    const n: AppNotification = { id: `n${++this.seq}`, kind, ref, ...draft, at, read: false };
    this.items.unshift(n);
    for (const l of this.listeners) l();
    return n;
  }
  list(): readonly AppNotification[] {
    return this.items;
  }
  unreadCount(): number {
    return this.items.filter((n) => !n.read).length;
  }
  markAllRead(): void {
    for (const n of this.items) n.read = true;
    for (const l of this.listeners) l();
  }
  subscribe(fn: () => void): void {
    this.listeners.add(fn);
  }
}
