/**
 * renderStatusIndicator — reference render for the Status Indicator intent (#354), the visual member
 * of the Web Lifecycle protocol. Projects an entity's current lifecycle state onto a semantic status
 * token (the intent's `tone` / `shape` / `affordance` dimensions).
 *
 * It owns the DISPLAY, not the rules: which states exist and which moves are legal belong to the
 * lifecycle definition; whether an actor may fire one belongs to Web Guards. This render only fixes
 * how the state is shown and announced — so a status stops being a hand-coloured <span> per screen.
 *
 * Accessibility: never colour-only — the label text carries the state. `role="status"` marks the
 * standing indicator; a *transition* announcement composes the Live Region Status intent (not here).
 */

export type StatusTone = 'neutral' | 'info' | 'progress' | 'positive' | 'caution' | 'critical';
export type StatusShape = 'badge' | 'pill' | 'dot' | 'text';

export interface StatusIndicatorOptions {
  /** The visible state label (e.g. "Underwriting"). Carries the meaning — not colour-only. */
  label: string;
  /** Semantic severity → drives the theme token, never a bespoke hex. */
  tone?: StatusTone;
  /** Visual metaphor for the token. */
  shape?: StatusShape;
  /** The available next transitions, surfaced as the `actionable` affordance (else display-only). */
  actions?: string[];
}

/** A11y-safe value-position class names + attributes shared by the element and string variants. */
function classes(tone: StatusTone, shape: StatusShape): string {
  return `status-indicator status-${shape} tone-${tone}`;
}

/** Render the status token as a detached element (the canonical form). */
export function renderStatusIndicator(o: StatusIndicatorOptions): HTMLElement {
  const tone = o.tone ?? 'neutral';
  const shape = o.shape ?? 'badge';
  const el = document.createElement('span');
  el.className = classes(tone, shape);
  el.dataset.tone = tone;
  el.setAttribute('role', 'status');
  el.setAttribute('aria-label', o.label);
  if (shape === 'dot') {
    const dot = document.createElement('span');
    dot.className = 'status-dot';
    dot.setAttribute('aria-hidden', 'true');
    el.append(dot, document.createTextNode(o.label));
  } else {
    el.textContent = o.label;
  }
  if (o.actions?.length) el.dataset.actions = o.actions.join(',');
  return el;
}

/** String form, for template-literal contexts (table cells, innerHTML). Label is HTML-escaped. */
export function statusIndicatorHTML(o: StatusIndicatorOptions): string {
  return renderStatusIndicator(o).outerHTML;
}

/** A default lifecycle-state → tone mapping a definition can override per state via `states[s].tone`. */
export const DEFAULT_TONE: Record<string, StatusTone> = {
  draft: 'neutral',
  pending: 'info',
  active: 'progress',
  approved: 'positive',
  declined: 'critical',
  suspended: 'caution',
};
