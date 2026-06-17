/**
 * AuditProvider — reference runtime for the Web Audit protocol (webaudit / #357).
 *
 * A domain entity's immutable, actor-attributed history. This module ships the protocol's seam:
 *
 *   - `AuditEvent` — the normalized record `{ target, action, actor, at, before?, after?, correlationId? }`.
 *     `before`/`after` reuse the Web States `ChangeRecord` shape (`AuditChange` here) rather than
 *     redefining one.
 *   - `CustomAuditProvider` — the swappable contract: `append()` (immutable) + `queryByEntity()` +
 *     optional `subscribe()`.
 *   - `DefaultAuditProvider` — a native-first, in-memory, append-only reference; an event-sourced store or
 *     an OSCAL backend plugs in behind the same interface.
 *   - `CustomAuditRegistry` (`window.customAudit`) — named providers a project selects/overrides.
 *   - `auditLifecycle()` — the headline composition: subscribe a Web Lifecycle provider so every
 *     transition becomes one AuditEvent automatically.
 *
 * Append-only is a CONTRACT guarantee — a recorded event is never mutated or deleted (the property
 * regulated audit depends on). The reference freezes each appended event.
 */

import type { LifecycleEvent } from '../lifecycle/LifecycleProvider';
import type { AuditEvent, AuditQuery, CustomAuditProvider } from './contract';

// Re-export the pure-contract surface so existing `./AuditProvider` importers reach the types and the
// runtime from one site (the split is at the file seam — see ./contract.ts, the future
// `@webeverything/contracts/audit` entry).
export type * from './contract';

/** Native-first, in-memory, append-only reference. The log is never mutated after append. */
export class DefaultAuditProvider implements CustomAuditProvider {
  private readonly log: AuditEvent[] = [];
  private readonly listeners = new Map<string, Set<(e: AuditEvent) => void>>();

  async append(event: AuditEvent): Promise<void> {
    const frozen = Object.freeze({ ...event }) as AuditEvent;
    this.log.push(frozen); // append-only — no mutation, no delete
    for (const l of this.listeners.get(frozen.target.id) ?? []) l(frozen);
  }

  async queryByEntity(id: string, query?: AuditQuery): Promise<AuditEvent[]> {
    return this.log
      .filter((e) => e.target.id === id)
      .filter((e) => (query?.action ? e.action === query.action : true))
      .filter((e) => (query?.since ? e.at >= query.since : true))
      .slice()
      .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0)); // chronological
  }

  subscribe(id: string, onAppend: (e: AuditEvent) => void): () => void {
    const set = this.listeners.get(id) ?? new Set();
    set.add(onAppend);
    this.listeners.set(id, set);
    return () => set.delete(onAppend);
  }
}

/** Named registry of audit providers — the project selects/overrides via the injector chain. */
export class CustomAuditRegistry {
  private readonly map = new Map<string, CustomAuditProvider>();
  define(name: string, provider: CustomAuditProvider): CustomAuditProvider {
    this.map.set(name, provider);
    return provider;
  }
  get(name: string): CustomAuditProvider | undefined {
    return this.map.get(name);
  }
  has(name: string): boolean {
    return this.map.has(name);
  }
}

/** Install (idempotently) the global `customAudit` registry and return it. */
export function registerAudit(): CustomAuditRegistry {
  const w = globalThis as unknown as { customAudit?: CustomAuditRegistry };
  return (w.customAudit ??= new CustomAuditRegistry());
}

/**
 * The headline composition — wire a Web Lifecycle provider's transitions straight into an audit log.
 * Every `LifecycleEvent` becomes one `AuditEvent`. Returns an unsubscribe.
 */
export function auditLifecycle(
  lifecycle: { subscribe?(fn: (e: LifecycleEvent) => void): () => void },
  audit: CustomAuditProvider,
  targetType: string,
): () => void {
  return (
    lifecycle.subscribe?.((ev) => {
      void audit.append({
        target: { type: targetType, id: ev.entity },
        action: 'lifecycle.transition',
        actor: { role: ev.actor },
        at: ev.at,
        after: [{ path: '/state', op: 'replace', oldValue: ev.from, newValue: ev.to }],
      });
    }) ?? (() => {})
  );
}
