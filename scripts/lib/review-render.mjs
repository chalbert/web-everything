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
// The null-prototype lookup builder lives in the subject-agnostic engine core; import it DIRECTLY (review-core
// re-exports only the review-shaped symbols, and this module is engine-tier like jury-core itself).
import { CITATION_SCOPES, frozenLookup } from './jury-core.mjs';

/** Human-readable label per overall verdict (`VERDICTS`). An unknown verdict falls back to its raw token so a
 *  new verdict never renders as a blank line. Pure data.
 *
 *  NULL-PROTOTYPE (#xdompzx round-2, finding 5) — this table is read with `VERDICT_LABELS[verdict] ?? String(verdict)`
 *  where `verdict` can arrive from free-form model JSON. `??` only fires on `null`/`undefined`, so on a normal object
 *  literal `renderPanelComment({ verdict: 'toString' })` rendered the INHERITED native function as the verdict label.
 *  A null-prototype table has nothing to inherit, so the raw-token fallback actually runs.
 *  @verdicts-total — every `VERDICTS` member must be a key (enforced by the `check:standards` verdict-totality gate). */
const VERDICT_LABELS = frozenLookup({
  [VERDICTS.ACCEPT]: '✅ pass — no blocking findings',
  [VERDICTS.CHANGES]: '🔁 changes requested',
  [VERDICTS.NEEDS_HUMAN]: '🚦 human review required',
  [VERDICTS.PREVENTION_OUTSTANDING]: '🚩 prevention outstanding — file the guard before accept',
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
 * the summary, the failure scenario (after an em-dash), the verify tag (`CONFIRMED`/`PLAUSIBLE`), the declared
 * `impactIfUnfixed`, and — as a nested sub-bullet — the named `prevention` guard with whether it is already
 * CAPTURED or still OWED. Tolerant of a finding carrying only a summary.
 *
 * This is the OUTPUT half of the compensating control that makes `PREVENTION_IMPACT_BAR` a scaling of the gate
 * rather than a silent loosening — see `blocksAcceptance` (`jury-core.mjs`) for why, stated once there. What this
 * renderer owes it: the declared impact and the owed guard must appear on every finding, because the drain's
 * auto-land branch posts THIS body when the bar is what un-blocked a guard.
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
  // #x6t2z6h — THE DISCLOSURE HALF of the off-scope-citation downgrade. The finding is still printed in full
  // (dropping it is the outcome the card refuses); what is added is that its cited path is not in this PR's net
  // changed-file set, so it did NOT reduce into the verdict. Without this line the downgrade is a silent one, and
  // a silent downgrade is a loss of information rather than a scaling of the gate — the same two-sided argument
  // `blocksAcceptance` (`jury-core.mjs`) makes for `PREVENTION_IMPACT_BAR`. Printed only when the field is
  // present, so every finding that never went through the scope gate renders byte-identically.
  if (f.citationScope === CITATION_SCOPES.UNVERIFIABLE) {
    line += ' _[⚠️ CITATION NOT IN THE NET DIFF — reported, but withheld from the verdict; re-cite it to block]_';
  }
  if (f.impactIfUnfixed) line += ` _[impact if unfixed: ${f.impactIfUnfixed}]_`;
  if (f.prevention) {
    const state = f.preventionCaptured === true ? 'captured' : 'OWED — file it';
    line += `\n  - _Prevention (${state}):_ ${f.prevention}`;
  }
  return `- ${line}`;
}

// ── #2447 — THE graduatedTo RESOLUTION BASIS ─────────────────────────────────────────────────────────────
// A lane that resolves an item via `graduatedTo` (the deliverable already landed in an earlier commit) opens a
// BACKLOG-ONLY PR: a status splice, with the "why no code" note living only in the PR body. A reviewer or
// label-lander scanning the changed-file list + `ready-to-merge` reads that as a HOLLOW resolve and strips a
// valid label (batch-2026-07-11, #2403 / PR #421). These pure helpers derive the basis from the data a surface
// already holds (the lane manifest, the resolve frontmatter in the diff, the PR body) and render it as a
// one-line banner every review/label surface can put UP FRONT.
//
// PRESENTATION ONLY: the basis never feeds a gate, a label, or a merge decision — it explains a diff, it does not
// clear one. That is why it lives here (engine tier) and why reading a body-sourced value is acceptable.

/** Frontmatter/body `graduatedTo` values that name no deliverable (an umbrella or no-graduation resolve). */
const NO_GRADUATION = new Set(['', 'none', 'null', '~']);
/** Cap on the rendered raw value — a free-text `graduatedTo` must not turn the one-line banner into a paragraph. */
const MAX_GRADUATED_TO_LEN = 160;

/**
 * Normalize one raw `graduatedTo` value → the trimmed, unquoted, single-line string, or `null` when it names no
 * deliverable (`none`, empty, a non-string). Backticks are stripped so the value renders safely inside a code
 * span; an over-long free-text value is truncated with an ellipsis. Pure.
 * @param {unknown} raw
 * @returns {string|null}
 */
export function normalizeGraduatedTo(raw) {
  if (typeof raw !== 'string') return null;
  let s = raw.replace(/[\r\n]+/g, ' ').replace(/`/g, '').trim();
  const quoted = s.match(/^(["'])(.*)\1$/);
  if (quoted) s = quoted[2].trim();
  if (NO_GRADUATION.has(s.toLowerCase())) return null;
  return s.length > MAX_GRADUATED_TO_LEN ? `${s.slice(0, MAX_GRADUATED_TO_LEN - 1)}…` : s;
}

/**
 * Read the `graduatedTo` a resolve commit ADDED to a backlog item's frontmatter, off a unified diff text
 * (`git diff` / `gh pr diff`). Only a `+graduatedTo:` line inside a `backlog/*.md` file section counts — the same
 * key quoted in a script, a doc, or a removed (`-`) line is ignored. First match wins. Pure; `null` when absent.
 * @param {string|null|undefined} diffText
 * @returns {string|null}
 */
export function graduatedToFromDiff(diffText) {
  if (typeof diffText !== 'string' || !diffText) return null;
  let inBacklogItem = false;
  for (const line of diffText.split('\n')) {
    // Every `diff --git` header resets the section, so a header this regex cannot parse (a quoted path) can
    // never leave a PREVIOUS backlog section open over a code file.
    if (line.startsWith('diff --git ')) { inBacklogItem = /\sb\/backlog\/[^/\s]+\.md$/.test(line); continue; }
    if (!inBacklogItem || line.startsWith('+++')) continue;
    const m = line.match(/^\+graduatedTo:\s*(.*)$/);
    if (m) {
      const value = normalizeGraduatedTo(m[1]);
      if (value) return value;
    }
  }
  return null;
}

/**
 * Read a `graduatedTo: <value>` resolution note from a PR BODY — the free-text carrier the #2403 incident used.
 * Matches a line whose content STARTS with the key (optionally bulleted, bolded, or code-spanned:
 * `- **graduatedTo:** 6b5874f7`, `` `graduatedTo: 6b5874f7` ``), and skips fenced code blocks and `>` quotes so a
 * pasted example never reads as this PR's basis. Pure; `null` when absent or `none`.
 * @param {string|null|undefined} body
 * @returns {string|null}
 */
export function graduatedToFromBody(body) {
  if (typeof body !== 'string' || !body) return null;
  let fenced = false;
  for (const line of body.split('\n')) {
    const t = line.trim();
    if (/^(```|~~~)/.test(t)) { fenced = !fenced; continue; }
    if (fenced || t.startsWith('>')) continue;
    const m = t.replace(/^[-*]\s+/, '').replace(/\*\*|__|`/g, '').match(/^graduatedTo\s*:\s*(.+)$/);
    if (m) {
      const value = normalizeGraduatedTo(m[1]);
      if (value) return value;
    }
  }
  return null;
}

/**
 * Derive the resolution basis a review/label surface should show up front, or `null` when there is none. Pure.
 *
 * Fires ONLY for a documented dedup-resolve, i.e. ALL of:
 *  - a `graduatedTo` names a deliverable (first non-`none` of `manifest` → resolve frontmatter in `diffText` →
 *    `body`, the most structured carrier first; a caller that does not keep the body may pass the value it already
 *    extracted with {@link graduatedToFromBody} as `bodyGraduatedTo`);
 *  - the changed-file list is KNOWN and non-empty (an unreadable diff never claims "no code change");
 *  - every changed file is under `backlog/` — a code resolve that ALSO sets `graduatedTo` (pointing at the file
 *    it just wrote) is a normal resolve, not "already landed", and gets no banner;
 *  - it is not a cross-repo couple (its impl half carries code even when the WE carrier is backlog-only).
 *
 * `ref` is the value's first token (`6b5874f7 (review-core …)` → `6b5874f7`); `isCommit` says whether that token is
 * shaped like a commit SHA, so a surface can phrase a path/item pointer differently if it wants to.
 * @param {{manifest?: {graduatedTo?: string, repos?: Array<object>}|null, diffText?: string|null,
 *   body?: string|null, bodyGraduatedTo?: string|null, graduatedTo?: string|null, changedFiles?: string[]|null,
 *   crossRepo?: boolean}} [o]
 * @returns {{graduatedTo: string, ref: string, isCommit: boolean, source: ('explicit'|'manifest'|'frontmatter'|'body')}|null}
 */
export function deriveResolutionBasis({ manifest = null, diffText = null, body = null, bodyGraduatedTo = null, graduatedTo = null, changedFiles = null, crossRepo = false } = {}) {
  if (!Array.isArray(changedFiles) || changedFiles.length === 0) return null;
  if (!changedFiles.every((f) => typeof f === 'string' && /^backlog\//.test(f))) return null;
  const manifestRepos = manifest && Array.isArray(manifest.repos) ? manifest.repos.length : 0;
  if (crossRepo === true || manifestRepos > 1) return null;
  const candidates = [
    ['explicit', normalizeGraduatedTo(graduatedTo)],
    ['manifest', normalizeGraduatedTo(manifest?.graduatedTo)],
    ['frontmatter', graduatedToFromDiff(diffText)],
    ['body', graduatedToFromBody(body) || normalizeGraduatedTo(bodyGraduatedTo)],
  ];
  const hit = candidates.find(([, value]) => value);
  if (!hit) return null;
  const [source, value] = hit;
  const ref = value.split(/\s+/)[0];
  return { graduatedTo: value, ref, isCommit: /^[0-9a-f]{7,40}$/i.test(ref), source };
}

/**
 * Render a resolution basis as the one-line banner a review/label surface puts UP FRONT, or `null` when there is no
 * basis (so the caller omits the line entirely and a normal code resolve renders byte-identically). Pure.
 * @param {{graduatedTo?: string, ref?: string}|null|undefined} basis — a {@link deriveResolutionBasis} result.
 * @returns {string|null}
 */
export function renderResolutionBasisBanner(basis) {
  const value = normalizeGraduatedTo(basis?.graduatedTo);
  if (!value) return null;
  const ref = normalizeGraduatedTo(basis?.ref) || value.split(/\s+/)[0];
  return `> 📦 **Resolution basis:** \`graduatedTo: ${value}\` — no code change — deliverable already landed in \`${ref}\`. `
    + 'A backlog-only diff here is a documented dedup-resolve, not a hollow one.';
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
 * #2447 — a `resolutionBasis` ({@link deriveResolutionBasis}) renders its banner directly under the heading, ahead
 * of the verdict, so a backlog-only graduatedTo resolve explains itself before anyone reads the file list. Absent
 * ⇒ no line, and the body is byte-identical to before.
 *
 * `lensProviders` (optional, `{ [lens]: providerName }`) NAMES a non-Claude juror's seat inline in the per-lens
 * table (#xqa9ttq) — e.g. a Codex advisory seat renders `simplicity (codex)` instead of a bare `simplicity`
 * indistinguishable from a Claude row. Threaded straight into `renderPanelVerdictTable`; omitted entirely, the
 * table renders exactly as it did before this param existed.
 * @param {{findings?: Array<object>, verdict?: string, disposition?: {mode?: string, autoLand?: boolean}|string,
 * @param {{findings?: Array<object>, verdict?: string, disposition?: {mode?: string, autoLand?: boolean}|string,
 *   lensVerdicts?: Object<string, string>, mandatoryLenses?: string[], lenses?: string[], heading?: string,
 *   resolutionBasis?: {graduatedTo: string, ref: string}|null, lensProviders?: Object<string, string>}} [o]
 * @returns {string} the markdown PR-comment body.
 */
export function renderPanelComment({
  findings,
  verdict,
  disposition,
  lensVerdicts,
  mandatoryLenses = MANDATORY_LENSES,
  lenses = PANEL_LENSES,
  lensProviders,
  heading = 'PR review',
  resolutionBasis = null,
} = {}) {
  const list = normalizeFindings(findings);
  const lines = [`## ${heading}`, ''];

  const basisBanner = renderResolutionBasisBanner(resolutionBasis);
  if (basisBanner) lines.push(basisBanner, '');

  const verdictLabel = verdict != null && verdict !== ''
    ? (VERDICT_LABELS[verdict] ?? String(verdict))
    : '(pending)';
  lines.push(`**Verdict:** ${verdictLabel}`);

  const dispositionLine = renderDisposition(disposition);
  if (dispositionLine) lines.push(`**Disposition:** ${dispositionLine}`);

  // The per-lens table (extends renderPanelVerdictTable) — only when per-lens verdicts are supplied.
  if (lensVerdicts && typeof lensVerdicts === 'object') {
    lines.push('', '### Panel verdicts', '', renderPanelVerdictTable({ lensVerdicts, mandatoryLenses, lenses, lensProviders }));
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
