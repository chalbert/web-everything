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
 * #2311 (v2, under epic #2285) adds the editor↔reviewer NEGOTIATION LOOP that replaces v1's author-bounce:
 * `buildEditorMandate()` seeds a fresh-context editor subagent with the reviewer's findings + the diff-only,
 * no-checkout isolation `buildMandate()` already established, and `deriveNegotiationOutcome()` is the ONE
 * deterministic round-cap decision (`continue` / `land` / `escalate`) every caller derives from — the
 * hookable half of the loop (#51: script-decidable stays a pure function; the judgment — proposing a fix,
 * critiquing it — stays with the subagents). The round cap itself (`NEGOTIATION_ROUND_CAP`) is a tuning knob,
 * not a magic number scattered per caller.
 *
 * #2310 (v3, under epic #2285) fans v2's single reviewer out into a MULTI-MANDATE PANEL — distinct mandated
 * reviewers (correctness / security / simplicity / standards-conformance, the `/code-review` lenses) each judge
 * the diff independently (`buildPanelMandate()`, `MANDATE_LENSES`/`MANDATORY_LENSES`/`ADVISORY_LENSES`), and
 * `derivePanelVerdict()` reduces their per-lens verdicts to the ONE combined verdict `deriveNegotiationOutcome`
 * already consumes — the round loop itself is unchanged, v3 only adds the many-verdicts-to-one reduction.
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

/**
 * The negotiation round cap (#2311, v2 under epic #2285) — settled at spec: 3 rounds. Bounded so a
 * non-converging editor↔reviewer cycle costs at most 3 review passes before it escalates to `review:human`,
 * not an unbounded loop. A tuning knob (exported, not hardcoded per caller) — raise it if 3 proves too tight
 * in practice, but any caller that needs a DIFFERENT cap should say so explicitly, not silently drift.
 */
export const NEGOTIATION_ROUND_CAP = 3;

/**
 * Build the canonical mandate handed to the EDITOR subagent in the v2 negotiation loop (#2311) — the
 * counterpart to `buildMandate()` (which seeds the reviewer). Same diff-only, no-checkout isolation and the
 * same #2336 constraint (never move HEAD in the shared tree — the editor does its writing in an isolated
 * throwaway clone of the PR branch, then pushes back to that SAME branch so the existing PR is what updates,
 * not a new one). The editor sees the reviewer's findings from the round that just ran and must either fix
 * each one or explicitly dismiss it with a stated reason (the same dismissedFindings audit-trail shape used
 * elsewhere in this repo) — it may not silently drop a finding.
 * @param {{findings?: Array<object>, round?: number, roundCap?: number}} [o]
 * @returns {string}
 */
export function buildEditorMandate({ findings = [], round = 1, roundCap = NEGOTIATION_ROUND_CAP } = {}) {
  const list = normalizeFindings(findings);
  const findingLines = list.length
    ? list.map((f, i) => `  ${i + 1}. ${f.file ? `${f.file}: ` : ''}${f.summary}${f.failure_scenario ? ` — ${f.failure_scenario}` : ''}`).join('\n')
    : '  (none — the reviewer reported no findings; this mandate should not be built in that case)';
  return [
    `You are the EDITOR in round ${round}/${roundCap} of a bounded editor↔reviewer negotiation over a PR diff.`,
    'A reviewer subagent (independent of you and of the PR\'s original author) reported these findings:',
    findingLines,
    'Revise the diff to address each finding: either fix it, or if you judge it not a real problem, state your',
    'dismissal reason explicitly in your reply (never drop a finding silently — it becomes the audit trail).',
    'Do your writing in an ISOLATED THROWAWAY CLONE of the PR branch, never in the drain\'s shared checkout',
    '(the #2336 never-move-shared-HEAD constraint applies to you too) — commit there and push back to the SAME',
    'PR branch so this PR updates in place rather than a new one being opened.',
    'A fresh-context reviewer will re-review your revised diff next round; you will not see their internal',
    'reasoning, only their next findings list (or acceptance).',
  ].join(' ');
}

/** The three negotiation-loop outcomes deriveNegotiationOutcome() can return (#2311). */
export const NEGOTIATION_OUTCOMES = Object.freeze({
  CONTINUE: 'continue',
  LAND: 'land',
  ESCALATE: 'escalate',
});

/**
 * Derive what the v2 negotiation loop (#2311) does next after a reviewer round. Pure — the ONE deterministic
 * round-cap decision every caller shares (mirrors `deriveVerdict`'s single-sourcing of the verdict itself):
 *
 *   - the round's verdict is `needs-human` → `escalate`, ALWAYS (a revision that itself touches the
 *     auto-review trust chain is the v1 conflict-of-interest case — no round budget saves it).
 *   - `accept` → `land` (the invariant holds: the final diff was accepted by a non-author reviewer).
 *   - `changes` and `round < roundCap` → `continue` (another editor↔reviewer round).
 *   - `changes` and `round >= roundCap` → `escalate` (non-convergence; surfaced to `review:human` same as v1's
 *     conflict-of-interest path, so the operator sees ONE escalation shape regardless of why it escalated).
 *
 * @param {{verdict: 'accept'|'changes'|'needs-human', round: number, roundCap?: number}} o
 * @returns {'continue'|'land'|'escalate'}
 */
export function deriveNegotiationOutcome({ verdict, round, roundCap = NEGOTIATION_ROUND_CAP }) {
  if (verdict === VERDICTS.NEEDS_HUMAN) return NEGOTIATION_OUTCOMES.ESCALATE;
  if (verdict === VERDICTS.ACCEPT) return NEGOTIATION_OUTCOMES.LAND;
  return round < roundCap ? NEGOTIATION_OUTCOMES.CONTINUE : NEGOTIATION_OUTCOMES.ESCALATE;
}

/**
 * #2310 (v3, under epic #2285) — the MULTI-MANDATE REVIEWER PANEL. v2's single reviewer fans out into distinct
 * mandated lenses (the `/code-review` dimensions), each judging the SAME diff independently via `buildMandate`
 * (one subagent per lens, seeded with `buildPanelMandate`). The panel's combined verdict then drives the SAME
 * `deriveNegotiationOutcome` round loop v2 already established — v3 only adds the "many lens verdicts → one
 * panel verdict" reduction; the negotiate/land/escalate machinery is unchanged and single-sourced.
 *
 * Settled at spec (#2310): which lenses are MANDATORY (must unanimously accept to land) vs. ADVISORY
 * (surfaced, never blocking) is a judgment call about what already has a deterministic backstop (#51 — hookable
 * vs. judgment). `correctness` and `security` are genuine invariants with no other gate: a landed diff must not
 * be broken or exploitable, so they are MANDATORY. `standards-conformance` already has a deterministic backstop
 * (`npm run check:standards`, run as its own lane gate before every PR — #2199) — the panel's lens is a semantic
 * second opinion on top of that mechanical gate, not the only line of defense, so it is ADVISORY. `simplicity`
 * is a genuine stylistic judgment call (reasonable reviewers can disagree without the diff being unsafe to
 * land), so it is ADVISORY too. Advisory findings are ALWAYS surfaced (never silently dropped) but never block
 * the unanimous-accept land path on their own.
 */
export const MANDATE_LENSES = Object.freeze({
  CORRECTNESS: 'correctness',
  SECURITY: 'security',
  SIMPLICITY: 'simplicity',
  STANDARDS: 'standards-conformance',
});

/** Lenses that must UNANIMOUSLY accept for the panel to land the PR (#2310). A tuning knob (exported, not
 *  hardcoded per caller) — see the module doc above for why correctness/security are the mandatory pair. */
export const MANDATORY_LENSES = Object.freeze([MANDATE_LENSES.CORRECTNESS, MANDATE_LENSES.SECURITY]);

/** Lenses that are ALWAYS surfaced but never block the unanimous-accept land path (#2310) — see the module doc
 *  above for why standards-conformance/simplicity are advisory. */
export const ADVISORY_LENSES = Object.freeze([MANDATE_LENSES.SIMPLICITY, MANDATE_LENSES.STANDARDS]);

/** Every panel lens, mandatory first — the full fan-out set a v3 panel round spawns one reviewer per. */
export const PANEL_LENSES = Object.freeze([...MANDATORY_LENSES, ...ADVISORY_LENSES]);

/**
 * Build the mandate handed to ONE lens reviewer in the v3 panel (#2310) — wraps `buildMandate({ mandate: lens
 * })` (same diff-only, no-checkout #2336 isolation every reviewer shares) with the panel framing: this
 * reviewer judges its OWN lens only and must not soften its verdict to pre-empt another lens's concern — a
 * genuine cross-mandate tradeoff is for a human to resolve, never for one reviewer to compromise away.
 * @param {{lens: string, contextIsolation?: string}} o
 * @returns {string}
 */
export function buildPanelMandate({ lens, contextIsolation = 'diff-only' } = {}) {
  if (!PANEL_LENSES.includes(lens)) {
    throw new Error(`buildPanelMandate: unknown lens "${lens}" — must be one of ${PANEL_LENSES.join(', ')}`);
  }
  const base = buildMandate({ contextIsolation, mandate: lens });
  return [
    base,
    `You are ONE of several independent mandate reviewers on this diff, each judging a single lens`,
    `(the full panel: ${PANEL_LENSES.join(', ')}).`,
    'Judge ONLY your own lens — do not comment on concerns outside it, and do not soften or withhold your',
    'verdict to accommodate what you guess another lens\'s reviewer might want. A genuine tradeoff BETWEEN',
    'mandates (e.g. security wants X, simplicity wants not-X) is human judgment by definition — surface your',
    'honest verdict for your own lens and let the panel reduction detect the conflict; do not resolve it yourself.',
  ].join(' ');
}

/**
 * Tag each lens's findings with their originating lens (so a merged findings list — the editor mandate, the
 * operator-facing summary — never loses provenance) and flatten into one list. Pure.
 * @param {Object<string, Array<object>>} lensFindings - `{ [lens]: rawFindings[] }`.
 * @returns {Finding[]}
 */
export function buildPanelFindings(lensFindings = {}) {
  return Object.entries(lensFindings).flatMap(([lens, findings]) =>
    normalizeFindings(findings).map((f) => ({ ...f, category: f.category ? `${lens}/${f.category}` : lens })),
  );
}

/**
 * Reduce the panel's per-lens verdicts to ONE combined verdict the existing `deriveNegotiationOutcome` round
 * loop consumes unchanged (#2310). Pure — mirrors `deriveVerdict`'s single-sourcing:
 *
 *   - `humanRequired` (the #2285 v1 conflict-of-interest flag) → `needs-human`, ALWAYS, same as `deriveVerdict`.
 *   - `conflict` → `needs-human`. Whether the mandatory lenses' findings are a genuine MUTUALLY-EXCLUSIVE
 *     tradeoff (not just "both want changes") is a semantic read of the findings text — judgment, not a thing
 *     this pure function can detect from verdict labels alone (#51: the derivation stays mechanical, the
 *     judgment stays with the caller/subagents reading the actual findings) — so the caller passes it in
 *     explicitly, the same pattern `deriveVerdict`'s `humanRequired` already establishes.
 *   - every MANDATORY lens verdict is `accept` → `accept` (the "unanimous accept lands" spec line — unanimity
 *     is scored over the mandatory lenses; an advisory lens's outstanding findings are surfaced, never blocking).
 *   - otherwise → `changes` (at least one mandatory lens wants changes; feeds the SAME round-cap loop v2 uses).
 *
 * @param {{lensVerdicts: Object<string, 'accept'|'changes'|'needs-human'>, humanRequired?: boolean,
 *   conflict?: boolean, mandatoryLenses?: string[]}} o
 * @returns {'accept'|'changes'|'needs-human'}
 */
export function derivePanelVerdict({ lensVerdicts = {}, humanRequired = false, conflict = false, mandatoryLenses = MANDATORY_LENSES } = {}) {
  if (humanRequired || conflict) return VERDICTS.NEEDS_HUMAN;
  if (!mandatoryLenses.length) {
    // Guard the `Array.prototype.every` vacuous-truth trap: an empty mandatory set must never silently read as
    // "everyone accepted" — a caller that misconfigures `mandatoryLenses` to `[]` gets a loud error, not a
    // free `accept` with zero verdicts actually checked.
    throw new Error('derivePanelVerdict: mandatoryLenses must be non-empty — an empty set would vacuously "accept"');
  }
  const mandatoryVerdicts = mandatoryLenses.map((lens) => lensVerdicts[lens]);
  const missing = mandatoryLenses.filter((lens) => !lensVerdicts[lens]);
  if (missing.length) {
    throw new Error(`derivePanelVerdict: missing verdict for mandatory lens(es): ${missing.join(', ')}`);
  }
  if (mandatoryVerdicts.some((v) => v === VERDICTS.NEEDS_HUMAN)) return VERDICTS.NEEDS_HUMAN;
  if (mandatoryVerdicts.every((v) => v === VERDICTS.ACCEPT)) return VERDICTS.ACCEPT;
  return VERDICTS.CHANGES;
}

/**
 * Render the per-lens verdict table the drain posts on escalation (#2310's "how a split verdict is surfaced to
 * the operator" spec line) — one row per lens, tagged mandatory/advisory, so a human reading the escalation
 * comment sees at a glance WHICH lens(es) disagreed and whether the disagreement was ever blocking. Pure.
 * @param {{lensVerdicts?: Object<string, string>, mandatoryLenses?: string[], lenses?: string[]}} [o]
 * @returns {string} a markdown table.
 */
export function renderPanelVerdictTable({ lensVerdicts = {}, mandatoryLenses = MANDATORY_LENSES, lenses = PANEL_LENSES } = {}) {
  const rows = lenses.map((lens) => {
    const verdict = lensVerdicts[lens] ?? '(no verdict)';
    const weight = mandatoryLenses.includes(lens) ? 'mandatory' : 'advisory';
    return `| ${lens} | ${weight} | ${verdict} |`;
  });
  return ['| lens | weight | verdict |', '| --- | --- | --- |', ...rows].join('\n');
}
