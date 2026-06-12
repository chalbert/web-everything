/**
 * renderDecisionTrace — reference render for the Decision Trace intent, the visual member of the Web
 * Decisions protocol (decision-record / #355). Renders a normalized `DecisionRecord` — "why did the
 * system decide this?" — as a criteria trace table plus an outcome badge.
 *
 * Schema-only standard: the `DecisionRecord` IS the contract (producers emit it, consumers read it; the
 * decision engine is out of scope — #093). This render owns the explanation UI, not the rules.
 *
 * Cross-standard composition: the outcome (and each criterion's outcome) is shown via the Status
 * Indicator block — one consistent status token, not a bespoke per-screen colour.
 */

import { statusIndicatorHTML, type StatusTone } from '../status-indicator/renderStatusIndicator';

/** One evaluated criterion: its input, operator, threshold, and the outcome it contributed. */
export interface DecisionCriterion {
  id: string;
  label: string;
  input: { name: string; value: string | number | boolean };
  operator: string;
  threshold: string | number;
  outcome: string;
  reasonCode?: string;
}

/** The normalized, reproducible record of a rules/criteria evaluation. */
export interface DecisionRecord {
  subject: { type: string; id: string };
  ruleSet: { id: string; version: string }; // reproducibility: the record carries what it ran against
  criteria: DecisionCriterion[];
  outcome: string;
  reasonCodes?: string[];
  at?: string;
}

export type DecisionLayout = 'table' | 'list';
export type DecisionEmphasis = 'all-criteria' | 'deciding';
export type DecisionDisclosure = 'inline' | 'expandable';

export interface DecisionTraceOptions {
  layout?: DecisionLayout;
  emphasis?: DecisionEmphasis;
  disclosure?: DecisionDisclosure;
  /** Map an outcome string → a Status Indicator tone. Defaults cover pass/refer/fail + approve/decline. */
  toneFor?: (outcome: string) => StatusTone;
}

/**
 * Default outcome→tone heuristic; overridable via opts.toneFor for domain-specific outcomes.
 * Order matters: negative patterns are tested FIRST so "ineligible" doesn't match "eligible".
 */
function defaultTone(outcome: string): StatusTone {
  const o = outcome.toLowerCase();
  if (/(fail|decline|deny|ineligible|reject|critical|error)/.test(o)) return 'critical';
  if (/(refer|caution|review|hold|pending|suspend)/.test(o)) return 'caution';
  if (/(pass|approve|eligible|clear|ok|positive)/.test(o)) return 'positive';
  return 'neutral';
}

const esc = (v: unknown): string =>
  String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** A non-deciding criterion is one whose outcome reads as a pass. */
const isDeciding = (c: DecisionCriterion): boolean => defaultTone(c.outcome) !== 'positive';

/** Render a DecisionRecord as a detached element (the canonical form). */
export function renderDecisionTrace(record: DecisionRecord, o: DecisionTraceOptions = {}): HTMLElement {
  const layout = o.layout ?? 'table';
  const emphasis = o.emphasis ?? 'all-criteria';
  const tone = o.toneFor ?? defaultTone;
  const criteria = emphasis === 'deciding' ? record.criteria.filter(isDeciding) : record.criteria;

  const root = document.createElement('section');
  root.className = `decision-trace layout-${layout}`;
  root.setAttribute('aria-label', `Decision for ${record.subject.type} ${record.subject.id}`);

  const outcomeChip = statusIndicatorHTML({ label: record.outcome, tone: tone(record.outcome), shape: 'pill' });
  const cChip = (c: DecisionCriterion) => statusIndicatorHTML({ label: c.outcome, tone: tone(c.outcome), shape: 'dot' });

  const head =
    `<header class="dt-head">${outcomeChip}` +
    `<span class="dt-ruleset muted">rule set ${esc(record.ruleSet.id)} v${esc(record.ruleSet.version)}</span></header>`;

  const body =
    layout === 'table'
      ? `<table class="dt-table"><thead><tr>` +
        `<th>Criterion</th><th class="num">Value</th><th>Op</th><th class="num">Threshold</th><th>Outcome</th>` +
        `</tr></thead><tbody>${criteria
          .map(
            (c) =>
              `<tr class="dt-row outcome-${esc(c.outcome)}">` +
              `<td>${esc(c.label)}</td><td class="num">${esc(c.input.value)}</td>` +
              `<td class="mono">${esc(c.operator)}</td><td class="num">${esc(c.threshold)}</td>` +
              `<td>${cChip(c)}</td></tr>`,
          )
          .join('')}</tbody></table>`
      : `<ul class="dt-list">${criteria
          .map(
            (c) =>
              `<li class="dt-item">${cChip(c)} <span class="dt-label">${esc(c.label)}</span> ` +
              `<span class="muted">${esc(c.input.value)} ${esc(c.operator)} ${esc(c.threshold)}</span></li>`,
          )
          .join('')}</ul>`;

  const reasons = record.reasonCodes?.length
    ? `<p class="dt-reasons muted">Reason codes: ${record.reasonCodes.map((r) => `<code>${esc(r)}</code>`).join(' ')}</p>`
    : '';

  root.innerHTML = head + body + reasons;
  return root;
}

/** String form, for template-literal / innerHTML contexts. */
export function decisionTraceHTML(record: DecisionRecord, o: DecisionTraceOptions = {}): string {
  return renderDecisionTrace(record, o).outerHTML;
}
