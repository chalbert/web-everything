/**
 * renderAuditTimeline — reference render for the Audit Timeline intent, the visual member of the Web
 * Audit protocol. Renders an entity's `AuditEvent[]` history as a chronological, filterable feed.
 *
 * It owns the DISPLAY, not the record: append-only semantics, actor attribution, and before/after belong
 * to the protocol; this render only standardizes how that history is shown and scanned — so an audit log
 * stops being a bespoke table per screen.
 */

import type { AuditEvent } from '../../audit/AuditProvider';

export type TimelineDensity = 'compact' | 'comfortable';
export type TimelineGrouping = 'flat' | 'by-day' | 'by-actor';
export type TimelineDetail = 'summary' | 'expanded';

export interface AuditTimelineOptions {
  density?: TimelineDensity;
  grouping?: TimelineGrouping;
  detail?: TimelineDetail;
}

const day = (iso: string): string => iso.slice(0, 10);
const time = (iso: string): string => (iso.length >= 16 ? iso.slice(11, 16) : iso);

function changeLine(c: { path: string; op: string; oldValue?: unknown; newValue?: unknown }): string {
  const from = c.oldValue === undefined ? '' : `${String(c.oldValue)} → `;
  return `<span class="audit-change"><code>${c.path}</code> ${from}${String(c.newValue ?? '')}</span>`;
}

function eventLi(e: AuditEvent, detail: TimelineDetail, showActor: boolean): string {
  const changes =
    detail === 'expanded' && (e.after?.length || e.before?.length)
      ? `<div class="audit-detail">${[...(e.before ?? []), ...(e.after ?? [])].map(changeLine).join('')}</div>`
      : '';
  const actor = showActor ? `<span class="audit-actor">${e.actor.role}</span>` : '';
  return `<li class="audit-item">
    <time datetime="${e.at}">${time(e.at)}</time>
    ${actor}<span class="audit-action">${e.action}</span>
    ${changes}
  </li>`;
}

/** Render the timeline as a detached element (the canonical form). */
export function renderAuditTimeline(events: AuditEvent[], o: AuditTimelineOptions = {}): HTMLElement {
  const density = o.density ?? 'comfortable';
  const grouping = o.grouping ?? 'flat';
  const detail = o.detail ?? 'summary';
  const ordered = events.slice().sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));

  const root = document.createElement('div');
  root.className = `audit-timeline density-${density} group-${grouping}`;
  root.setAttribute('role', 'list');
  root.setAttribute('aria-label', 'Audit history');

  if (!ordered.length) {
    root.innerHTML = `<p class="audit-empty">No recorded history.</p>`;
    return root;
  }

  if (grouping === 'flat') {
    root.innerHTML = `<ol class="audit-list">${ordered.map((e) => eventLi(e, detail, true)).join('')}</ol>`;
    return root;
  }

  // by-day / by-actor: partition into labelled sections.
  const keyOf = (e: AuditEvent) => (grouping === 'by-day' ? day(e.at) : e.actor.role);
  const groups: Array<{ key: string; items: AuditEvent[] }> = [];
  for (const e of ordered) {
    const k = keyOf(e);
    const last = groups[groups.length - 1];
    if (last && last.key === k) last.items.push(e);
    else groups.push({ key: k, items: [e] });
  }
  root.innerHTML = groups
    .map(
      (g) =>
        `<section class="audit-group"><h4 class="audit-group-key">${g.key}</h4>` +
        `<ol class="audit-list">${g.items.map((e) => eventLi(e, detail, grouping !== 'by-actor')).join('')}</ol></section>`,
    )
    .join('');
  return root;
}

/** String form, for template-literal / innerHTML contexts. */
export function auditTimelineHTML(events: AuditEvent[], o: AuditTimelineOptions = {}): string {
  return renderAuditTimeline(events, o).outerHTML;
}
