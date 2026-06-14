/**
 * Phase S11 — event-driven notifications (backlog #387).
 *
 * Pure domain mapping from a loan event to the notification it raises: WHO it goes to (the relevant
 * actor), its severity, and its message. The three events the phase specifies — a lifecycle state
 * change, a condition added, a document rejected — each route to the actor who must act next.
 *
 * PLATFORM-GAP: #358 — Web Everything has a `notification` standard (the presentation-agnostic transient
 * in-page message block) but it is still `draft`, with no shipping runtime to consume. So the app hand-
 * rolls a minimal notification region + store (app.ts) against this domain mapping, tagged as a GAP: the
 * exercise app is the forcing function that drives #358 to an active, consumable block.
 */

import type { Role, Condition, LoanDocument, ApplicationState } from './types';

export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error';

export interface AppNotification {
  id: string;
  to: Role;
  severity: NotificationSeverity;
  message: string;
  at: string;
  loanNumber: string;
  read: boolean;
}

/** The actor a freshly-entered state most concerns — who owns the next move. */
const STATE_OWNER: Record<ApplicationState, Role> = {
  draft: 'borrower',
  submitted: 'processor',
  processing: 'processor',
  underwriting: 'underwriter',
  'approved-with-conditions': 'borrower',
  suspended: 'processor',
  'clear-to-close': 'loan-officer',
  declined: 'borrower',
  withdrawn: 'loan-officer',
};

const STATE_SEVERITY: Partial<Record<ApplicationState, NotificationSeverity>> = {
  'clear-to-close': 'success',
  declined: 'error',
  suspended: 'warning',
};

/** The unrouted core of a notification — `to`/`severity`/`message`, before it gets an id + timestamp. */
export interface NotificationDraft {
  to: Role;
  severity: NotificationSeverity;
  message: string;
}

export function stateChangeNotification(loanNumber: string, to: ApplicationState): NotificationDraft {
  return {
    to: STATE_OWNER[to],
    severity: STATE_SEVERITY[to] ?? 'info',
    message: `${loanNumber} moved to ${to.replace(/-/g, ' ')}.`,
  };
}

export function conditionAddedNotification(loanNumber: string, condition: Condition): NotificationDraft {
  return {
    to: condition.assignedTo,
    severity: 'warning',
    message: `${loanNumber}: new ${condition.type} condition — ${condition.description}`,
  };
}

export function docRejectedNotification(loanNumber: string, doc: LoanDocument): NotificationDraft {
  return {
    to: 'borrower',
    severity: 'error',
    message: `${loanNumber}: document "${doc.label}" was rejected${doc.rejectionReason ? ` — ${doc.rejectionReason}` : ''}. Please re-upload.`,
  };
}

/** A native-first, in-memory notification store. The draft `notification` block (#358) will replace this. */
export class NotificationStore {
  private items: AppNotification[] = [];
  private seq = 0;
  private listeners = new Set<() => void>();

  push(loanNumber: string, draft: NotificationDraft, at: string): AppNotification {
    const n: AppNotification = { id: `n${++this.seq}`, loanNumber, ...draft, at, read: false };
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
