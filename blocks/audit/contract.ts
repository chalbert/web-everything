/**
 * Web Audit protocol — the **pure-contract half** (webaudit / #357, graduated `audit`).
 *
 * Types and interfaces only: this module is fully **compile-erased** (no runtime emit) so it can become
 * the `@webeverything/contracts/audit` entry (#872/#879) that FUI depends on (the FUI→WE arrow),
 * superseding byte-replication. The runtime half — the native-first `DefaultAuditProvider`, the
 * `CustomAuditRegistry`, and the `auditLifecycle()` composition — lives next door in `./AuditProvider.ts`,
 * which re-exports this surface (`export type * from './contract'`) so existing importers keep one site.
 *
 * Append-only is a CONTRACT guarantee — a recorded event is never mutated or deleted (the property
 * regulated audit depends on). `before`/`after` reuse the Web States `ChangeRecord` shape (`AuditChange`)
 * rather than redefining one.
 */

/** A single before/after change — the Web States ChangeRecord shape (RFC 6902 vocabulary). */
export interface AuditChange {
  path: string;
  op: 'add' | 'remove' | 'replace';
  oldValue?: unknown;
  newValue?: unknown;
}

/** The normalized audit record. */
export interface AuditEvent {
  target: { type: string; id: string };
  action: string;
  actor: { id?: string; role: string };
  at: string; // ISO timestamp
  before?: AuditChange[];
  after?: AuditChange[];
  correlationId?: string;
}

export interface AuditQuery {
  action?: string;
  since?: string; // ISO; inclusive lower bound on `at`
}

/** The provider seam — the only lock. Append-only by contract. */
export interface CustomAuditProvider {
  append(event: AuditEvent): Promise<void>;
  queryByEntity(id: string, query?: AuditQuery): Promise<AuditEvent[]>;
  subscribe?(id: string, onAppend: (e: AuditEvent) => void): () => void;
}
