/**
 * Phase S4 — save-and-resume drafts + last-writer-wins co-edit (#388).
 *
 * The loan's mutable working state (documents, conditions, the issued decision) autosaves on every change
 * and resumes to the exact state across sessions; a second editor is detected and the UI shows an "X also
 * editing" banner with a last-writer-wins reconciliation (the settled co-edit decision).
 *
 * Pure domain — no `localStorage`, no DOM, no `Date`. app.ts owns the storage I/O (a thin `localStorage`
 * adapter today) and the `storage`-event wiring; this module owns the snapshot shape + the conflict math so
 * both are testable. PLATFORM-GAP: #648 — WE has no durable-persistence runtime (per #011 the durable
 * store is an unbuilt facet of `webstates`), so the storage adapter is hand-rolled per that future contract.
 */
import type { Application, Condition, Decision, LoanDocument } from './types';

/** The resumable snapshot of a loan's working state. `editor`/`savedAt` drive last-writer-wins co-edit. */
export interface DraftSnapshot {
  loanNumber: string;
  documents: LoanDocument[];
  conditions: Condition[];
  decision?: Decision;
  /** A per-tab editor token (random, assigned once per session) — identifies who last wrote. */
  editor: string;
  /** ISO timestamp the snapshot was taken (caller-stamped — this module is Date-free). */
  savedAt: string;
}

/** Capture the loan's working state into a snapshot (caller supplies the editor token + timestamp). */
export function snapshotDraft(app: Application, editor: string, savedAt: string): DraftSnapshot {
  return {
    loanNumber: app.loanNumber,
    documents: app.documents,
    conditions: app.conditions,
    decision: app.decision,
    editor,
    savedAt,
  };
}

/** Restore a snapshot onto the application (mutates the working-state fields back to the saved values). */
export function applyDraft(app: Application, snap: DraftSnapshot): void {
  app.documents = snap.documents;
  app.conditions = snap.conditions;
  app.decision = snap.decision;
}

/**
 * Last-writer-wins reconciliation: given the snapshot we hold and one that just arrived (e.g. via a
 * `storage` event from another tab), decide what to do.
 *   - `incoming` is from US (same editor) → ignore.
 *   - `incoming.savedAt` is newer → the other editor won; adopt it (last-writer-wins) and flag the conflict.
 *   - otherwise → ours is current; keep ours.
 */
export type CoEditResolution =
  | { action: 'ignore' }
  | { action: 'adopt'; from: string; conflict: true }
  | { action: 'keep' };

export function reconcile(local: DraftSnapshot, incoming: DraftSnapshot): CoEditResolution {
  if (incoming.editor === local.editor) return { action: 'ignore' };
  if (incoming.savedAt > local.savedAt) return { action: 'adopt', from: incoming.editor, conflict: true };
  return { action: 'keep' };
}

/** The "X also editing" banner message, or null when this editor is alone. */
export function coEditMessage(local: DraftSnapshot | undefined, incoming: DraftSnapshot | undefined): string | null {
  if (!local || !incoming || incoming.editor === local.editor) return null;
  return `Another session (editor ${incoming.editor.slice(0, 6)}) is also editing this loan — last save wins.`;
}
