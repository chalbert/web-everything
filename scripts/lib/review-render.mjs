/**
 * review-render.mjs — the PURE PR-comment renderer for a review panel's structured result (#2432, slice of
 * epic #2418). Defines `renderPanelComment({findings, verdict, disposition})`: it turns a panel's structured
 * verdict into the FULL PR review-comment body (markdown), EXTENDING `renderPanelVerdictTable` from the core.
 *
 * WHY A SEPARATE MODULE (not `review-core.mjs`, where #2432's item text literally asked for it):
 * `we:scripts/lib/review-core.mjs` is a POLICY-tier trust-chain member — `scripts/lib/gate-config.mjs`
 * matches the trust chain by BASENAME, so ANY edit to `review-core.mjs` auto-stamps `review:human` (gate-self).
 * A pure presentation renderer over already-derived data is ENGINE-tier: it decides no policy, judges nothing,
 * and must stay agent-clearable. Putting it on the policy file would drag a wording tweak through human review
 * every time — the opposite of the epic's "template the render, not the prose" lever. So this renderer lives in
 * its OWN engine-tier module and IMPORTS the pure pieces it needs from `review-core.mjs` (import only — this
 * module never edits it), per gate-config's "keep POLICY minimal" principle: only what genuinely gates trust
 * belongs on the policy file; a deterministic renderer does not.
 *
 * PURE: `renderPanelComment` is a pure function of its structured input — no I/O, no dates, no `Date.now()` /
 * `new Date()`. The same input always renders the same markdown (a renderer over structured data can't drift).
 * Tolerant of empty findings and missing fields. Unit-tested in
 * `we:scripts/lib/__tests__/review-render.test.mjs`; exposed as the `comment` subcommand of
 * `we:scripts/review-core-cli.mjs`.
 */
import {
  VERDICTS,
  REVIEW_DISPOSITIONS,
  normalizeFindings,
  renderPanelVerdictTable,
  MANDATORY_LENSES,
  PANEL_LENSES,
} from './review-core.mjs';

/** Human-readable label per overall verdict (`VERDICTS`). An unknown verdict falls back to its raw token so a
 *  new verdict never renders as a blank line. Pure data. */
const VERDICT_LABELS = Object.freeze({
  [VERDICTS.ACCEPT]: '✅ pass — no blocking findings',
  [VERDICTS.CHANGES]: '🔁 changes requested',
  [VERDICTS.NEEDS_HUMAN]: '🚦 human review required',
});

/**
 * Render one disposition into a human-readable line. Accepts EITHER the `{mode, autoLand}` object
 * `deriveReviewDisposition` (`review-core.mjs`) returns, OR a bare string (e.g. `merge` / `park` / `wait-author`
 * a caller already resolved). Pure; tolerant of a missing/oddly-shaped value. Returns `null` when there is
 * nothing to say (so the caller can omit the line entirely).
 * @param {{mode?: string, autoLand?: boolean}|string|null|undefined} disposition
 * @returns {string|null}
 */
function renderDisposition(disposition) {
  if (disposition == null) return null;
  if (typeof disposition === 'string') {
    const s = disposition.trim();
    return s || null;
  }
  if (typeof disposition !== 'object') return null;
  const { mode, autoLand } = disposition;
  if (mode === REVIEW_DISPOSITIONS.HUMAN) {
    return 'park for a human — no further convergence';
  }
  if (mode === REVIEW_DISPOSITIONS.CONVERGE) {
    return autoLand === false
      ? 'converge with an advisory fix — a human must still clear it before merge'
      : 'converge — an agent may land it on an accept verdict';
  }
  // Unknown/partial object: surface whatever mode token is present rather than silently dropping it.
  return mode ? String(mode) : null;
}

/**
 * Render ONE finding as a markdown bullet. Pure. Shows, when present: the `file:line` (or bare `file`) anchor,
 * the summary, the failure scenario (after an em-dash), and the verify tag (`CONFIRMED`/`PLAUSIBLE`). Tolerant
 * of a finding carrying only a summary.
 * @param {import('./review-core.mjs').Finding} f
 * @returns {string}
 */
function renderFindingLine(f) {
  const parts = [];
  if (f.file) parts.push(`\`${f.file}${f.line != null ? `:${f.line}` : ''}\``);
  parts.push(f.summary);
  let line = parts.join(' — ');
  if (f.failure_scenario) line += ` — ${f.failure_scenario}`;
  if (f.verdict) line += ` _[${f.verdict}]_`;
  return `- ${line}`;
}

/**
 * Render the full PR review-comment body from a review panel's structured result (#2432). Pure — a
 * deterministic function of its input, no I/O and no dates. EXTENDS `renderPanelVerdictTable`: the per-lens
 * table is embedded when per-lens verdicts are supplied. Composed of: a heading, the overall verdict, the
 * disposition (when supplied), the per-lens verdict table (when `lensVerdicts` supplied), and a findings
 * section grouped by `category` (the lens/lens-category tag `buildPanelFindings` stamps), each finding showing
 * severity/category, `file:line` when present, and its summary.
 *
 * Tolerant: empty/absent `findings` renders an explicit "no findings" line; a missing `disposition` or
 * `lensVerdicts` simply omits that section; an unknown `verdict` falls back to its raw token.
 *
 * @param {{findings?: Array<object>, verdict?: string, disposition?: {mode?: string, autoLand?: boolean}|string,
 *   lensVerdicts?: Object<string, string>, mandatoryLenses?: string[], lenses?: string[], heading?: string}} [o]
 * @returns {string} the markdown PR-comment body.
 */
export function renderPanelComment({
  findings,
  verdict,
  disposition,
  lensVerdicts,
  mandatoryLenses = MANDATORY_LENSES,
  lenses = PANEL_LENSES,
  heading = 'PR review',
} = {}) {
  const list = normalizeFindings(findings);
  const lines = [`## ${heading}`, ''];

  const verdictLabel = verdict != null && verdict !== ''
    ? (VERDICT_LABELS[verdict] ?? String(verdict))
    : '(pending)';
  lines.push(`**Verdict:** ${verdictLabel}`);

  const dispositionLine = renderDisposition(disposition);
  if (dispositionLine) lines.push(`**Disposition:** ${dispositionLine}`);

  // The per-lens table (extends renderPanelVerdictTable) — only when per-lens verdicts are supplied.
  if (lensVerdicts && typeof lensVerdicts === 'object') {
    lines.push('', '### Panel verdicts', '', renderPanelVerdictTable({ lensVerdicts, mandatoryLenses, lenses }));
  }

  // Findings section — grouped by category (the lens tag), in first-seen order; tolerant of none.
  lines.push('', `### Findings (${list.length})`, '');
  if (!list.length) {
    lines.push('_No findings._');
    return lines.join('\n');
  }

  /** @type {Map<string, import('./review-core.mjs').Finding[]>} */
  const groups = new Map();
  for (const f of list) {
    const key = f.category || 'general';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(f);
  }
  const sections = [];
  for (const [category, group] of groups) {
    sections.push([`**${category}** (${group.length})`, ...group.map(renderFindingLine)].join('\n'));
  }
  lines.push(sections.join('\n\n'));

  return lines.join('\n');
}
