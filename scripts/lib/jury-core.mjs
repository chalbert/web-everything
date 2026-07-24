/**
 * jury-core.mjs — the subject-agnostic JURY ENGINE core (#2653, foundational slice of epic #2649).
 *
 * WHY: this is the subject-NEUTRAL method core lifted out of `we:scripts/lib/review-core.mjs` — the pure
 * derivations that judge "a set of findings / verdicts" WITHOUT knowing what is being judged (a PR diff, a
 * plan, any future subject). `review-core.mjs` re-exports every symbol defined here so its existing callers
 * (review-core-cli, review-parked-prs, review-render, the drain) stay byte-stable: this extraction is a pure
 * MOVE + re-export, never a behaviour change. New subject-agnostic consumers import from HERE directly.
 *
 * What lives here (the four method pieces epic #2649 names):
 *   • the FINDING CONTRACT — `normalizeFinding` / `normalizeFindings` / `deriveVerdict` + the `VERDICTS` enum.
 *   • the ROUND LOOP — `NEGOTIATION_ROUND_CAP` + `deriveNegotiationOutcome` (+ `NEGOTIATION_OUTCOMES`).
 *   • the DIVERSITY-SELECTION reduction — `derivePanelVerdict` + `buildPanelFindings` +
 *     `AGGREGATION.DIVERSITY_SELECTION`, over the lens vocabulary (`MANDATE_LENSES` / `MANDATORY_LENSES` /
 *     `ADVISORY_LENSES` / `PANEL_LENSES`).
 *   • the CARE→RIGOR dial — `panelRigorForCareLevel` over the advisory `CARE_LEVELS` enum.
 *   • the JURY-LEDGER EVENT VOCABULARY (#2654, S2 of epic #2649) — `JURY_EVENT_TYPES` + `JUROR_STATUSES` and
 *     the pure `validateJuryEvent` / `normalizeJuryEvent` schema-validator. The append-only shape #2641's durable
 *     on-disk log appends and the #2642 console serializes; this slice is the SHAPE ONLY — the on-disk log and
 *     the fold that replays it into a live ledger are #2641, not here.
 *
 * What STAYS in `review-core.mjs`: everything that knows it is judging a PR DIFF — the mandate builders, the
 * plan-phase handshake, the escalation REASON→disposition policy, and the operator-facing renderers.
 *
 * The advisory CARE-LEVEL enum is single-sourced in `review-escalation.mjs` (a leaf that imports only
 * gate-config + review-policy), so `jury-core → review-escalation` is acyclic. jury-core stays label-free /
 * leash-free — a care-level is advisory review-RIGOR information (how hard to look), never a route/land policy
 * (that stays with review-escalation's `decideReviewGate`).
 *
 * Pure, unit-tested through `review-core.mjs`'s re-exports in `we:scripts/lib/__tests__/review-core.test.mjs`.
 */
import { CARE_LEVELS } from './review-escalation.mjs';

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

/**
 * The negotiation round cap (#2311, v2 under epic #2285) — raised to 5 (operator call, 2026-07-13) from the
 * original spec of 3. Bounded so a non-converging editor↔reviewer cycle costs at most this many review passes
 * before it escalates to `review:human`, not an unbounded loop — but the operator's aim is fewer hand-offs to a
 * human, so the panel gets more room to converge on its own before a deadlock is declared. A tuning knob
 * (exported, not hardcoded per caller) — any caller that needs a DIFFERENT cap should say so explicitly, not
 * silently drift.
 */
export const NEGOTIATION_ROUND_CAP = 5;

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
 * How the panel's per-lens/per-juror verdicts are AGGREGATED (#2567 / #2563 Fork 2). The panel is aggregated by
 * diversity-SELECTION, **never** by naive majority vote: the most critical (strictest) verdict wins — one lens or
 * juror wanting `changes`/`needs-human` carries the whole panel there. Majority voting hits the "popularity trap"
 * — LLMs share failure modes, so a vote amplifies the shared-WRONG output that most models happen to agree on
 * (`we:reports/2026-07-18-human-vs-ai-review-cognitive-science.md`). `derivePanelVerdict` ALREADY implements this
 * (strictest-reason-wins, not a count), so this constant only NAMES the contract the care-level rigor dial scales
 * up; it does not introduce a second reducer. A single label so every consumer says "diversity-selection" the
 * same way and no caller quietly re-derives a majority vote.
 */
export const AGGREGATION = Object.freeze({ DIVERSITY_SELECTION: 'diversity-selection' });

/**
 * The panel RIGOR each advisory care-level dials (#2567, codified `#blast-radius-advisory-care-not-a-gate`). Pure,
 * total over `CARE_LEVELS`. Care-level scales HOW HARD the AI panel looks — `rounds` (editor↔reviewer negotiation
 * passes), `lenses` (which `PANEL_LENSES` fan out), and `jurorsPerLens` (independent reviewers per lens; >1 is the
 * diverse JURY that a high-care change earns) — never the ROUTE (a high-care change still gets an agent review, it
 * is not handed to a human) and never a cap on the WORK. Aggregation is ALWAYS diversity-selection, never a vote.
 *   • `none`     → no panel (the PR did not escalate; nothing to review).
 *   • `low`      → 1 round, full lens set, 1 juror per lens — the baseline panel a routine spot-check earns.
 *   • `elevated` → 2 rounds — a system-machinery / dismissed-finding change gets a second negotiation pass.
 *   • `high`     → 3 rounds + 2 jurors per lens — the maximum scrutiny (a gate-self/statute change, or several
 *                  stacked scored signals); the extra jurors are the diverse jury against shared blind spots.
 * `rounds` never exceeds `NEGOTIATION_ROUND_CAP` (the loop's own hard budget). Tuning knobs — loose to start,
 * tighten from data; kept here so a re-dial is one edit + a test.
 * @param {'none'|'low'|'elevated'|'high'} careLevel
 * @returns {{careLevel: string, rounds: number, lenses: string[], jurorsPerLens: number, aggregation: string}}
 */
export function panelRigorForCareLevel(careLevel) {
  const rigorByLevel = {
    [CARE_LEVELS.NONE]:     { rounds: 0, lenses: [],           jurorsPerLens: 0 },
    [CARE_LEVELS.LOW]:      { rounds: 1, lenses: PANEL_LENSES, jurorsPerLens: 1 },
    [CARE_LEVELS.ELEVATED]: { rounds: 2, lenses: PANEL_LENSES, jurorsPerLens: 1 },
    [CARE_LEVELS.HIGH]:     { rounds: 3, lenses: PANEL_LENSES, jurorsPerLens: 2 },
  };
  const r = rigorByLevel[careLevel];
  if (!r) {
    throw new Error(`panelRigorForCareLevel: unknown care-level "${careLevel}" — must be one of ${Object.values(CARE_LEVELS).join(', ')}`);
  }
  return {
    careLevel,
    rounds: Math.min(r.rounds, NEGOTIATION_ROUND_CAP),
    lenses: [...r.lenses],
    jurorsPerLens: r.jurorsPerLens,
    aggregation: AGGREGATION.DIVERSITY_SELECTION,
  };
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
 * ============================================================================
 * THE JURY-LEDGER EVENT VOCABULARY (#2654, S2 of epic #2649) — SCHEMA ONLY.
 * ============================================================================
 *
 * The jury is made observable (#2641, F4 = logbook ruling) by writing an APPEND-ONLY event log to disk; a single
 * shared fold replays that log into the live ledger the conveyor's `/workflows`-style tree and the #2642 console
 * both render. This slice defines ONLY the durable event SHAPE those two consumers serialize + a pure validator —
 * it does NOT build the on-disk log or the fold (both are #2641). Keeping the vocabulary here, next to the verdict
 * / round / panel contracts it references (a `finding` event carries a `Finding`; a `verdict` event carries a
 * `VERDICTS` value), single-sources "what a jury event is" so the writer and every reader agree by construction.
 *
 * Five event types — the F4 logbook events named in #2641's body:
 *   • `roster-picked`   — the jury roster was chosen: the jurors (id / lens / charter, optional method).
 *   • `juror-running`   — a rostered juror started its pass (its lifecycle moved pending → running).
 *   • `finding`         — a juror reported one finding (the canonical `Finding` shape).
 *   • `verdict`         — a juror reported its current verdict (a `VERDICTS` value).
 *   • `round-advanced`  — the editor↔reviewer negotiation loop advanced to a new round.
 *
 * Every event carries `type` and an integer `round` (the round it belongs to; `round-advanced` names the NEW,
 * ≥1 round). `at` (an ISO-8601 timestamp) is OPTIONAL in the schema — the durable-log writer (#2641) stamps it;
 * the validator only checks it parses when present, so the pure schema never depends on a clock. The validator is
 * NORMALIZING: it returns a clean event built from KNOWN fields only, so no caller-junk is persisted to the log.
 */

/** The five append-only jury-ledger event types (#2654). A frozen enum so every writer/reader names them once. */
export const JURY_EVENT_TYPES = Object.freeze({
  ROSTER_PICKED: 'roster-picked',
  JUROR_RUNNING: 'juror-running',
  FINDING: 'finding',
  VERDICT: 'verdict',
  ROUND_ADVANCED: 'round-advanced',
});

/** Every jury-ledger event type, in lifecycle order — the membership set `validateJuryEvent` dispatches on. */
export const JURY_EVENT_TYPE_LIST = Object.freeze(Object.values(JURY_EVENT_TYPES));

/**
 * The juror lifecycle statuses the #2641 fold DERIVES from the event stream (#2641 lists "pending / running /
 * found"). These are ledger-STATE the fold reconstructs, NOT events themselves: a juror is `pending` once
 * `roster-picked` names it, `running` after its `juror-running` event, and `found` once it has emitted a
 * `finding` or `verdict`. Named here so the fold and the console label the derived status the same way.
 */
export const JUROR_STATUSES = Object.freeze({
  PENDING: 'pending',
  RUNNING: 'running',
  FOUND: 'found',
});

const VERDICT_VALUES = new Set(Object.values(VERDICTS));

/**
 * @typedef {Object} JurorSpec
 * @property {string} id - stable juror id, unique within the roster (the key later events reference via `jurorId`).
 * @property {string} lens - the review lens/dimension this juror judges under (e.g. a `MANDATE_LENSES` value, or a
 *   domain adapter's own lens — not constrained to the PR-diff set, since the jury is subject-agnostic).
 * @property {string} charter - the juror's charter / expectation (what it was asked to look for).
 * @property {string} [method] - optional method/model label (how this juror reviews).
 */

/**
 * @typedef {Object} JuryEvent
 * @property {'roster-picked'|'juror-running'|'finding'|'verdict'|'round-advanced'} type
 * @property {number} round - the negotiation round the event belongs to (0-based; `round-advanced` is ≥1).
 * @property {string} [at] - ISO-8601 timestamp; stamped by the #2641 log writer, absent in the pure schema.
 * @property {JurorSpec[]} [jurors] - `roster-picked` only: the chosen roster.
 * @property {string} [jurorId] - `juror-running`/`finding`/`verdict`: which rostered juror this is about.
 * @property {Finding} [finding] - `finding` only: the reported finding (canonical `Finding` shape).
 * @property {'accept'|'changes'|'needs-human'} [verdict] - `verdict` only: the juror's current verdict.
 */

/**
 * @typedef {Object} JuryEventValidation
 * @property {boolean} valid - true when `raw` is a well-formed jury event.
 * @property {string[]} errors - one message per schema violation (empty when valid).
 * @property {JuryEvent|null} event - the NORMALIZED event (known fields only) when valid, else null.
 */

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function requireRound(raw, event, errors, min) {
  if (!Number.isInteger(raw.round) || raw.round < min) {
    errors.push(`${raw.type} requires an integer round >= ${min}`);
  } else {
    event.round = raw.round;
  }
}

function requireJurorId(raw, event, errors) {
  if (!isNonEmptyString(raw.jurorId)) {
    errors.push(`${raw.type} requires a non-empty jurorId`);
  } else {
    event.jurorId = raw.jurorId.trim();
  }
}

/** Normalize one roster juror spec; pushes an error (and returns null) for each malformed field. */
function normalizeJurorSpec(raw, index, errors, seen) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    errors.push(`jurors[${index}] must be an object`);
    return null;
  }
  const spec = {};
  let ok = true;
  if (!isNonEmptyString(raw.id)) {
    errors.push(`jurors[${index}].id must be a non-empty string`);
    ok = false;
  } else {
    spec.id = raw.id.trim();
    if (seen.has(spec.id)) {
      errors.push(`jurors[${index}].id "${spec.id}" is duplicated in the roster`);
      ok = false;
    }
    seen.add(spec.id);
  }
  if (!isNonEmptyString(raw.lens)) {
    errors.push(`jurors[${index}].lens must be a non-empty string`);
    ok = false;
  } else {
    spec.lens = raw.lens.trim();
  }
  if (!isNonEmptyString(raw.charter)) {
    errors.push(`jurors[${index}].charter must be a non-empty string`);
    ok = false;
  } else {
    spec.charter = raw.charter.trim();
  }
  if (raw.method != null) {
    if (!isNonEmptyString(raw.method)) errors.push(`jurors[${index}].method must be a non-empty string when present`);
    else spec.method = raw.method.trim();
  }
  return ok ? spec : null;
}

/**
 * Validate + normalize one append-only jury-ledger event (#2654). Pure — never throws (a malformed record must
 * not crash the log writer or the fold). Returns a structured result: `{ valid, errors, event }`. When valid,
 * `event` is a CLEAN copy carrying only the fields the schema knows (so caller-junk is never persisted); when
 * invalid, `event` is null and `errors` lists every violation. The one validator BOTH #2641's writer (reject
 * before append) and the #2642 console (reject on read) share, so a bad event is caught the same way everywhere.
 *
 * @param {*} raw
 * @returns {JuryEventValidation}
 */
export function validateJuryEvent(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { valid: false, errors: ['event must be a non-null object'], event: null };
  }
  const { type } = raw;
  if (!JURY_EVENT_TYPE_LIST.includes(type)) {
    return {
      valid: false,
      // String(), not JSON.stringify(): the latter THROWS on a bigint type, breaking the never-throw contract.
      errors: [`unknown event type "${String(type)}" — must be one of ${JURY_EVENT_TYPE_LIST.join(', ')}`],
      event: null,
    };
  }

  const errors = [];
  /** @type {JuryEvent} */
  const event = { type };

  // Common envelope: `at` is optional; validate it parses as a date only when present (keeps the schema clock-free).
  if (raw.at != null) {
    if (typeof raw.at !== 'string' || Number.isNaN(Date.parse(raw.at))) {
      errors.push('at must be a parseable date string when present');
    } else {
      event.at = raw.at;
    }
  }

  switch (type) {
    case JURY_EVENT_TYPES.ROSTER_PICKED: {
      requireRound(raw, event, errors, 0);
      if (!Array.isArray(raw.jurors) || raw.jurors.length === 0) {
        errors.push('roster-picked requires a non-empty jurors array');
      } else {
        const seen = new Set();
        event.jurors = raw.jurors.map((j, i) => normalizeJurorSpec(j, i, errors, seen)).filter(Boolean);
      }
      break;
    }
    case JURY_EVENT_TYPES.JUROR_RUNNING: {
      requireRound(raw, event, errors, 0);
      requireJurorId(raw, event, errors);
      break;
    }
    case JURY_EVENT_TYPES.FINDING: {
      requireRound(raw, event, errors, 0);
      requireJurorId(raw, event, errors);
      const finding = normalizeFinding(raw.finding);
      if (!finding) errors.push('finding event requires a finding with a non-empty summary');
      else event.finding = finding;
      break;
    }
    case JURY_EVENT_TYPES.VERDICT: {
      requireRound(raw, event, errors, 0);
      requireJurorId(raw, event, errors);
      if (!VERDICT_VALUES.has(raw.verdict)) {
        errors.push(`verdict event requires a verdict of ${[...VERDICT_VALUES].join(', ')}`);
      } else {
        event.verdict = raw.verdict;
      }
      break;
    }
    case JURY_EVENT_TYPES.ROUND_ADVANCED: {
      // The NEW round the loop advanced to — ≥1 (advancing to round 0 is meaningless; round 0 is the initial roster).
      requireRound(raw, event, errors, 1);
      break;
    }
    // No default: JURY_EVENT_TYPE_LIST membership was already checked above.
  }

  return errors.length ? { valid: false, errors, event: null } : { valid: true, errors: [], event };
}

/**
 * Normalize one raw jury event to its clean `JuryEvent` shape, or `null` if it fails the schema. Pure. The
 * `.filter(Boolean)`-friendly form the #2641 fold maps a raw log over (mirrors `normalizeFinding`). Callers that
 * need the WHY of a rejection use `validateJuryEvent` for the `errors` list; this thin wrapper drops it.
 * @param {*} raw
 * @returns {JuryEvent|null}
 */
export function normalizeJuryEvent(raw) {
  return validateJuryEvent(raw).event;
}

/**
 * ============================================================================
 * THE STATELESS ROSTER-RECOMPUTE SPINE + MINIMAL LEDGER-TRAILED OVERRIDE (#2655, F3 of epic #2649).
 * ============================================================================
 *
 * The ratified F3 shape (jury-of-#2576, decision record 273a2dbd): the jury ROSTER is a STATELESS recompute from
 * `care-level + a touch-set signal` — deterministic and re-derivable, never persisted — and any deviation from
 * that recompute is a MINIMAL override layer ON TOP, trailed as an append-only ledger event (the #2654 S2 schema)
 * so the effective roster is always reconstructable as `recompute(care, touch) THEN overrides`. Keeping the base
 * a pure recompute is the whole point: nothing to migrate, nothing to drift — re-run it and you get the same
 * roster, and the persisted state is only the small override delta.
 *
 * This is the SUBJECT-AGNOSTIC spine the PR-diff resolver (`resolveJuryPlan` in review-core.mjs) and the future
 * per-domain adapters (#2656) build ON. It generalizes the PR-path-pattern touch-set (`classifyTouchSet`, which
 * reads UI file globs — a review-DIFF concern that STAYS in review-core) to an abstract `touchLenses` SIGNAL the
 * SUBJECT supplies: the spine merges the care band's static lenses with the subject's extra touch-set lenses,
 * de-duplicates (the care band wins any overlap), attaches each lens's grounding method(s) through a
 * caller-INJECTED resolver (so the UI method registry stays subject-specific), and carries provenance
 * (`attachedBy`) — knowing nothing about what is being judged. The care→RIGOR half (jurors-per-lens, rounds) is
 * reused from `panelRigorForCareLevel`, never re-derived; aggregation stays `DIVERSITY_SELECTION`.
 */

/**
 * @typedef {Object} RosterSeat
 * @property {string} lens - the review lens/perspective this seat judges under.
 * @property {string[]} methods - the grounding method id(s) for this lens (empty when no resolver was injected).
 * @property {'care'|'touch-set'|'override'} attachedBy - provenance: the care band's static set, the subject's
 *   touch-set signal, or a minimal override applied on top of the recompute.
 */

/**
 * @typedef {Object} RosterPlan
 * @property {string} careLevel - the `CARE_LEVELS` value the plan was recomputed for.
 * @property {number} jurorsPerLens - independent jurors per lens (the care band's rigor dial).
 * @property {number} rounds - editor↔reviewer negotiation rounds (the care band's rigor dial).
 * @property {string} aggregation - always `DIVERSITY_SELECTION`.
 * @property {RosterSeat[]} lenses - the resolved seats, static (care) lenses first, then touch-set lenses.
 */

/**
 * THE STATELESS ROSTER-RECOMPUTE SPINE (#2655) — `roster = f(care-level, touch-set)`. Pure, deterministic,
 * re-derivable: the same inputs always produce the same plan, so nothing about it is persisted. Subject-agnostic —
 * the SUBJECT supplies its extra lenses as the abstract `touchLenses` signal (the PR-diff subject derives that
 * signal from a file touch-set via `classifyTouchSet`; another subject derives it however it likes). The spine:
 *   • gets the care band's STATIC lens set + rigor dial from `panelRigorForCareLevel(careLevel)` — reused, never
 *     re-derived (throws on an unknown care-level, which is where that throw is single-sourced).
 *   • when the care band is `none` (no panel — nothing escalated) returns an EMPTY roster regardless of the
 *     touch-set: the touch-set only ADDS perspective lenses to an existing panel, it never conjures one.
 *   • otherwise merges the static lenses (first, in their care-band order) with the subject's `touchLenses`
 *     (after), de-duplicating so the care band wins any overlap, and attaches each lens's grounding method(s)
 *     via the injected `resolveMethods(lens)` (default: none — a subject-agnostic plan carries no methods until a
 *     caller grounds it). Each seat records `attachedBy` provenance.
 * @param {{careLevel: string, touchLenses?: string[], resolveMethods?: (lens: string) => string[]}} [o]
 * @returns {RosterPlan}
 */
export function resolveRoster({ careLevel, touchLenses = [], resolveMethods } = {}) {
  const rigor = panelRigorForCareLevel(careLevel); // throws on an unknown care-level; supplies base lenses + dial
  const methodsFor = typeof resolveMethods === 'function' ? resolveMethods : () => [];
  const attach = (lens, attachedBy) => {
    const m = methodsFor(lens);
    return { lens, methods: Array.isArray(m) ? [...m] : [], attachedBy };
  };
  const dial = { careLevel, jurorsPerLens: rigor.jurorsPerLens, rounds: rigor.rounds, aggregation: rigor.aggregation };
  if (!rigor.lenses.length) return { ...dial, lenses: [] };
  const seen = new Set();
  const entries = [];
  for (const lens of rigor.lenses) {                        // static care-band lenses first, in PANEL_LENSES order
    if (seen.has(lens)) continue;
    seen.add(lens);
    entries.push(attach(lens, 'care'));
  }
  for (const raw of (Array.isArray(touchLenses) ? touchLenses : [])) { // the subject's touch-set lenses, after
    if (!isNonEmptyString(raw)) continue;                   // reject falsy/whitespace lenses (same bar as the override path)
    const lens = raw.trim();
    if (seen.has(lens)) continue;                           // the care band wins any overlap
    seen.add(lens);
    entries.push(attach(lens, 'touch-set'));
  }
  return { ...dial, lenses: entries };
}

/** The two MINIMAL override operations on a recomputed roster (#2655, F3). Add or remove ONE lens — the smallest
 *  override surface that still lets an operator deviate from the stateless recompute. A frozen enum so every
 *  caller names them once. The overrides themselves are the ONLY persisted state (kept minimal by construction);
 *  the recompute is re-derivable, so the durable trail is `recompute(care, touch)` + this small delta. */
export const ROSTER_OVERRIDE_OPS = Object.freeze({ ADD: 'add', REMOVE: 'remove' });

/**
 * Apply a MINIMAL override list to a recomputed roster plan (#2655, F3) — the ledger-trailed override layer that
 * sits ON TOP of the stateless recompute. Pure — returns a NEW plan, never mutates its input (the recompute stays
 * canonical). Each override is `{ op: 'add'|'remove', lens }`:
 *   • `add`    — append `lens` (grounded via the injected `resolveMethods`, `attachedBy: 'override'`) if the plan
 *                does not already carry it; adding an already-present lens is a no-op (idempotent).
 *   • `remove` — drop the seat for `lens` if present; removing an absent lens is a no-op (idempotent).
 * A malformed override (not an object, empty `lens`, or an unknown `op`) throws loudly — an override is operator
 * config, and a silent mis-apply here is exactly the drift the stateless spine exists to avoid. The applied
 * effective roster is what `rosterPickedEvent` then records to the ledger, so the override is trailed there.
 * @param {RosterPlan} plan - a `resolveRoster` output.
 * @param {Array<{op: string, lens: string}>} [overrides]
 * @param {{resolveMethods?: (lens: string) => string[]}} [o]
 * @returns {RosterPlan}
 */
export function applyRosterOverrides(plan, overrides = [], { resolveMethods } = {}) {
  const methodsFor = typeof resolveMethods === 'function' ? resolveMethods : () => [];
  const entries = (Array.isArray(plan?.lenses) ? plan.lenses : []).map((e) => ({ ...e }));
  const indexOfLens = (lens) => entries.findIndex((e) => e.lens === lens);
  for (const ov of (Array.isArray(overrides) ? overrides : [])) {
    if (!ov || typeof ov !== 'object' || Array.isArray(ov)) {
      throw new Error('applyRosterOverrides: each override must be an object { op, lens }');
    }
    const { op, lens } = ov;
    if (!isNonEmptyString(lens)) {
      throw new Error(`applyRosterOverrides: override.lens must be a non-empty string (op "${String(op)}")`);
    }
    const cleanLens = lens.trim();
    if (op === ROSTER_OVERRIDE_OPS.ADD) {
      if (indexOfLens(cleanLens) === -1) {
        const m = methodsFor(cleanLens);
        entries.push({ lens: cleanLens, methods: Array.isArray(m) ? [...m] : [], attachedBy: 'override' });
      }
    } else if (op === ROSTER_OVERRIDE_OPS.REMOVE) {
      const i = indexOfLens(cleanLens);
      if (i !== -1) entries.splice(i, 1);
    } else {
      throw new Error(`applyRosterOverrides: unknown override op "${String(op)}" — must be one of ${Object.values(ROSTER_OVERRIDE_OPS).join(', ')}`);
    }
  }
  return { ...plan, lenses: entries };
}

/**
 * Materialize a roster plan into the concrete `JurorSpec[]` a `roster-picked` ledger event carries (#2655) —
 * expand each lens seat into `plan.jurorsPerLens` independent jurors (the diverse jury a high-care band earns).
 * Pure. Each juror gets a stable `id` (`lens#slot`, unique within the roster because the plan's lenses are
 * de-duplicated), the seat's `lens`, a `charter`, and — when the seat is grounded — the seat's first grounding
 * method as its `method`. The `charter` is subject-specific text, so it comes from the injected
 * `charterForLens(lens)` (an adapter supplies real charters); the default is a neutral placeholder so the spine
 * itself hardcodes no subject knowledge. A plan with `jurorsPerLens: 0` (care `none`) materializes to an empty
 * roster.
 * @param {RosterPlan} plan
 * @param {{charterForLens?: (lens: string) => string}} [o]
 * @returns {JurorSpec[]}
 */
export function materializeRoster(plan, { charterForLens } = {}) {
  const entries = Array.isArray(plan?.lenses) ? plan.lenses : [];
  const perLens = Number.isInteger(plan?.jurorsPerLens) && plan.jurorsPerLens > 0 ? plan.jurorsPerLens : 0;
  const charterOf = typeof charterForLens === 'function' ? charterForLens : (lens) => `judge the subject under the "${lens}" lens`;
  const jurors = [];
  for (const entry of entries) {
    const method = Array.isArray(entry.methods) && entry.methods.length ? entry.methods[0] : undefined;
    const charter = String(charterOf(entry.lens) || `judge the "${entry.lens}" lens`);
    for (let slot = 1; slot <= perLens; slot += 1) {
      const juror = { id: `${entry.lens}#${slot}`, lens: entry.lens, charter };
      if (method) juror.method = method;
      jurors.push(juror);
    }
  }
  return jurors;
}

/**
 * Build the `roster-picked` ledger event (the #2654 S2 schema) that RECORDS an effective roster plan (#2655) —
 * the append-only trail the F3 override layer leaves. Pure. Materializes the plan (`materializeRoster`) and wraps
 * the jurors in a schema-VALID `roster-picked` event, so what lands in the ledger is exactly the effective
 * (post-override) roster and nothing else. Returns `null` when the plan has no jurors (care `none`) — there is no
 * roster to record. The optional `at` (stamped by the #2641 log writer) and `charterForLens` pass straight
 * through. Throws only if the materialized roster somehow fails the S2 schema (a defensive self-check — the
 * materializer builds a valid roster by construction).
 * @param {RosterPlan} plan
 * @param {{round?: number, at?: string, charterForLens?: (lens: string) => string}} [o]
 * @returns {JuryEvent|null}
 */
export function rosterPickedEvent(plan, { round = 0, at, charterForLens } = {}) {
  const jurors = materializeRoster(plan, { charterForLens });
  if (!jurors.length) return null; // care `none` / no seats → no roster picked, nothing to record
  const raw = { type: JURY_EVENT_TYPES.ROSTER_PICKED, round, jurors };
  if (at != null) raw.at = at;
  const { valid, errors, event } = validateJuryEvent(raw);
  if (!valid) {
    throw new Error(`rosterPickedEvent: materialized roster failed the S2 schema: ${errors.join('; ')}`);
  }
  return event;
}
