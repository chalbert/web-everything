/**
 * review-core.mjs — the shared "read a diff, judge it" contract (#2325, under epic #2285).
 *
 * WHY: the same judge-a-diff logic used to exist as duplicated PROSE in two places — the `/code-review`
 * model (Claude Code's built-in review skill; a human/agent asks it to review a diff and it renders
 * findings) and the drain's inline auto-review subagent (described in `we:skills-src/drain/SKILL.md`,
 * spawned as a raw `Agent` call that sees only the diff + PR body and returns accept/changes). A future
 * `/review` human-verdict skill (`#2326`) is a third. This module is the ONE canonical shape + derivation
 * every caller renders into, so the contract is defined once, tested once, and never re-invented per caller.
 *
 * SCOPE (important): `/code-review` is a Claude Code product surface with no source living in this repo —
 * this module cannot "call into" it. What it DOES do is define the canonical `Finding`/`verdict` contract
 * that `/code-review`'s own output already matches (see the `ReportFindings` tool shape it renders through:
 * file, summary, failure_scenario, category, line, verdict, outcome) and that this repo's own docs
 * (`we:docs/agent/platform-decisions.md`, the pre-PR review rider) and skills point reviewers at. The
 * JUDGEMENT itself (spawning a subagent, reading a diff, deciding what's wrong) is never done here — like
 * `we:scripts/lane-review.mjs`, this module is the mechanical/derivation half; judging stays the caller's
 * action. `#2326` wires the drain auto-review + the new `/review` skill to this contract; this item (`#2325`)
 * lands the contract itself.
 *
 * The core JUDGES ONLY. It never knows about labels, the merge-anyway window, `review:human`, or who is
 * allowed to clear what — that policy stays with each caller (the drain owns its leash; see
 * `we:scripts/lib/review-escalation.mjs`'s `decideReviewGate`, which is unaffected by this module).
 *
 * Pure, unit-tested in `we:scripts/lib/__tests__/review-core.test.mjs`.
 */

/**
 * @typedef {Object} Finding
 * @property {string} [file] - repo-relative path the finding is anchored to.
 * @property {string} summary - one-sentence statement of the defect.
 * @property {string} [failure_scenario] - concrete inputs/state → wrong output/crash.
 * @property {string} [category] - short kebab-case slug, e.g. "correctness", "simplification".
 * @property {number} [line] - 1-indexed line the finding anchors to.
 * @property {'CONFIRMED'|'PLAUSIBLE'} [verdict] - set when a verify pass ran; absent on inline-only reviews.
 * @property {'fixed'|'skipped'|'no_change_needed'} [outcome] - set only when RE-reporting after fixes were applied.
 */

/** The three review dispositions (#2325) — a superset of what `/code-review` computes today (which renders
 *  findings only, no accept/changes call). `needs-human` is the #2285 conflict-of-interest escalation:
 *  humanRequired ALWAYS wins over any finding-derived disposition (see `deriveVerdict`). */
export const VERDICTS = Object.freeze({
  ACCEPT: 'accept',
  CHANGES: 'changes',
  NEEDS_HUMAN: 'needs-human',
});

const VALID_VERDICT_TAGS = new Set(['CONFIRMED', 'PLAUSIBLE']);
const VALID_OUTCOMES = new Set(['fixed', 'skipped', 'no_change_needed']);

/**
 * Coerce a raw finding-like object into the canonical `Finding` shape. Pure. Never throws — an unusable raw
 * value (not an object, no summary) normalizes to `null` so callers can `.filter(Boolean)` a mixed list.
 * @param {*} raw
 * @returns {Finding|null}
 */
export function normalizeFinding(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const summary = raw.summary ?? raw.finding ?? '';
  if (!String(summary).trim()) return null;
  /** @type {Finding} */
  const out = { summary: String(summary).trim() };
  if (raw.file) out.file = String(raw.file);
  if (raw.failure_scenario) out.failure_scenario = String(raw.failure_scenario);
  if (raw.category) out.category = String(raw.category);
  if (raw.line != null && Number.isFinite(Number(raw.line))) out.line = Number(raw.line);
  if (raw.verdict && VALID_VERDICT_TAGS.has(String(raw.verdict))) out.verdict = String(raw.verdict);
  if (raw.outcome && VALID_OUTCOMES.has(String(raw.outcome))) out.outcome = String(raw.outcome);
  return out;
}

/**
 * Normalize a raw findings list. Pure. Drops anything that doesn't survive `normalizeFinding` (never throws
 * on a malformed entry — a broken record must not crash the review).
 * @param {*} rawList
 * @returns {Finding[]}
 */
export function normalizeFindings(rawList) {
  const arr = Array.isArray(rawList) ? rawList : [];
  return arr.map(normalizeFinding).filter(Boolean);
}

/**
 * Derive the overall verdict from a normalized findings list + the #2285 conflict-of-interest flag. Pure —
 * the SAME derivation every caller (a `/code-review`-shaped renderer, the drain auto-review, `/review`) uses
 * so "what does this set of findings mean" is decided once:
 *
 *   - `humanRequired` → `needs-human`, ALWAYS (checked first — a gate-self edit is never agent-cleared no
 *     matter how clean the findings look; mirrors `we:scripts/lib/review-escalation.mjs`'s `decideReviewGate`).
 *   - otherwise: any finding still OUTSTANDING (no `outcome`, or `outcome: 'skipped'`) → `changes`.
 *     A first-pass review has no `outcome` yet, so ANY finding present outstands it; a RE-report after fixes
 *     (`outcome: 'fixed'|'no_change_needed'`) resolves that finding, leaving only genuinely unaddressed ones.
 *   - no outstanding findings → `accept`.
 *
 * @param {{findings?: Finding[]|Array<object>, humanRequired?: boolean}} [o]
 * @returns {'accept'|'changes'|'needs-human'}
 */
export function deriveVerdict({ findings = [], humanRequired = false } = {}) {
  if (humanRequired) return VERDICTS.NEEDS_HUMAN;
  const list = normalizeFindings(findings);
  const outstanding = list.filter((f) => f.outcome !== 'fixed' && f.outcome !== 'no_change_needed');
  return outstanding.length > 0 ? VERDICTS.CHANGES : VERDICTS.ACCEPT;
}

/** Default review mandate — correctness bugs are the floor every caller shares. Pure data (a tuning knob). */
export const DEFAULT_MANDATE = 'correctness';

/**
 * Build the canonical judge-only mandate text handed to a review subagent (the "read a diff, judge it"
 * instructions) — single-sourced so `/code-review`-shaped callers and the drain auto-review (`#2326`) stop
 * hand-rolling their own prose copy of the same mandate. Pure — returns the instruction string; SPAWNING the
 * subagent and reading its answer remains the caller's action (this module never calls a model, same split
 * `we:scripts/lane-review.mjs` documents for the pre-PR review seam).
 * @param {{contextIsolation?: string, mandate?: string|string[]}} [o]
 * @returns {string}
 */
export function buildMandate({ contextIsolation = 'diff-only', mandate = DEFAULT_MANDATE } = {}) {
  const mandates = (Array.isArray(mandate) ? mandate : [mandate]).filter(Boolean);
  const mandateLine = mandates.length ? mandates.join(', ') : DEFAULT_MANDATE;
  const isolationLine = contextIsolation === 'diff-only'
    ? 'You see ONLY the diff (and, if supplied, the PR description) — no author framing, no prior session context.'
    : `Context isolation: ${contextIsolation}.`;
  return [
    `You are reviewing a diff against this mandate: ${mandateLine}.`,
    isolationLine,
    // #2336 — a review subagent runs inside the drain's shared primary checkout; it must NEVER `git checkout`
    // the PR branch there (that moves the shared HEAD and violates the never-branch-a-shared-checkout guard).
    'Work from the diff text alone — do NOT `git checkout`, `git switch`, `git fetch`+checkout, or otherwise',
    'move HEAD onto the PR branch: you are running inside a shared checkout and that would derail the drain. If',
    'you genuinely must run the code (tests, a repro), do it in a throwaway `git clone` under a temp dir, never here.',
    'Judge only: report concrete findings (file, one-sentence summary, the failure scenario it causes) and',
    'nothing about labels, merge policy, or who may clear this change — that is the caller\'s decision, not yours.',
    'Report an empty findings list if nothing survives scrutiny; do not pad with stylistic nitpicks.',
  ].join(' ');
}
