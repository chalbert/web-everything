/**
 * @file scripts/operations/review-pr.mjs
 * @description THE `review-pr` DECLARATION — the first real operation on the engine (#3035, under epic #3029).
 *
 * ONE DECLARATION, DERIVED CALLERS. Per the statute
 * [#operations-declared-once-callers-generated](../../docs/agent/platform-decisions.md#operations-declared-once-callers-generated)
 * (#3031), the review operation is declared HERE, once, and every caller is generated from it:
 * {@link ./cli-adapter.mjs} is the command-line one (#3035), the HTTP one is #3036 (**open**, not built here).
 *
 * IT RE-DECLARES; IT DOES NOT RE-IMPLEMENT. Every step below delegates to a script that already owns its logic:
 *
 *   | step      | kind      | the implementation behind it                                                     |
 *   |-----------|-----------|----------------------------------------------------------------------------------|
 *   | `read`    | `compute` | `we:scripts/review-detail.mjs#assembleReviewDetail` (park context) + the NET-basis |
 *   |           |           | `computeNetDiffText`/`computeNetDiffPaths` (`we:scripts/merge-ai-prs.mjs`, #2450)  |
 *   | `judge`   | `judge`   | `buildPanelMandate` (`we:scripts/lib/review-core.mjs`) shaping a `judgeSpawn`      |
 *   |           |           | request (`we:scripts/lib/judge-spawn.mjs`, #3028) — DECLARED, never spawned here   |
 *   | `reduce`  | `compute` | `deriveVerdict` (`we:scripts/lib/review-core.mjs`); `humanRequired` off the LABELS |
 *   | `confirm` | `confirm` | the engine SUSPENDS — this is the human stop, as machinery instead of prose        |
 *   | `record`  | `effect`  | `decideSetLabel` (`we:scripts/review-set-label.mjs`) + `renderPanelComment`        |
 *   |           |           | (`we:scripts/lib/review-render.mjs`) + `renderReviewNotice` — DECLARED, not applied |
 *
 * If a reader finds review LOGIC in this file rather than a call into one of those, that is the bug.
 *
 * ── THE TWO PROPERTIES THIS SLICE EXISTS FOR ────────────────────────────────────────────────────────────────
 *
 * 1. **THE DIFF ARRIVES ON THE NET BASIS.** `read` names its net changed-file list `netChangedFiles` and marks
 *    `gh`'s own file list `ghDiffStat` — *not* ground truth, display only. Only `netChangedFiles` reaches
 *    `buildPanelMandate({ netChangedFiles })`, which states it to the juror AS ground truth (#2450). The
 *    console showing a diff stat where the agent sees real files (#2901) is therefore not a discipline the
 *    caller must keep: the two lists have different names in the finding, and the one a caller could mistake
 *    for authority is the one this step marks non-authoritative. The skill's `reason: 'exec-contract'` rule —
 *    *"a bug in YOUR wrapper to fix, not license to fall back"* — is enforced here as a REFUSAL, so a
 *    mis-shaped `exec` can no longer degrade quietly into `gh pr diff`'s inflated three-dot list.
 *
 * 2. **THE LABEL GUARD STAYS IN THE PURE CORE.** `record` asks `decideSetLabel` (#2470/#2644) what the swap is
 *    and REFUSES to declare any effect when it says `allowed: false`. INVARIANT 2 — a `review:human` (gate-self)
 *    PR is never machine-cleared — therefore binds this generated caller exactly as it binds the hand-written
 *    one, because it is the same pure function and this file does not reimplement it. `decideSetLabel` is
 *    IMPORTED, never injected: a caller that could substitute the decider is the hole the invariant exists to
 *    close. And the check here is the EARLY refusal only — `we:scripts/review-set-label.mjs` re-observes the
 *    live labels and re-runs the same decider at write time, so a label that changed between `read` and
 *    `record` is caught by the authoritative copy.
 *
 * ── WHAT THIS REPLACES IN `we:skills-src/review/SKILL.md` ───────────────────────────────────────────────────
 *
 *   - *"This is a stop point … Do not auto-proceed."* → the `confirm` step. The engine suspends; there is no
 *     way for the caller to answer a question that has not been asked (see the adapter's `--resume`).
 *   - *"A non-zero exit means re-run the same command"* → keyed effect replay. Each effect below is classified
 *     for idempotency INDIVIDUALLY at its declaration site, with the reason, because the executor's
 *     indeterminate-attempt refusal is only as good as those flags.
 *
 * ── IO IS INJECTED, AND THAT IS DELIBERATE ──────────────────────────────────────────────────────────────────
 *
 * `read` is a `compute` step and reading a PR is io. The vocabulary is closed at four kinds and *"an operation
 * that appears to need a fifth kind is a signal to change the model"* (#3031), so the answer is NOT a `read`
 * kind: the io is INJECTED into the declaration as `readPr` and the real binding lives in
 * {@link ./review-pr-io.mjs}. The engine still performs no io of its own, the step's SHAPE-CHECKING half stays
 * pure and unit-testable with a stub reader, and the declaration composes the same way #3036's HTTP caller will
 * need it to. What is honestly true and worth saying: the fn the engine calls is not pure — it is a pure
 * validator wrapped around one injected read.
 *
 * PURE apart from that injected reader: no fs, no clock, no process, no network in this file.
 */

import { op } from './registry.mjs';
// Aliased on import so the STEP NAMES below can be the card's own words (`judge`, `confirm`) without shadowing
// the builders.
import { compute, confirm as confirmStep, effect as effectStep, judge as judgeStep } from './step-kinds.mjs';
import { LEDGER_EFFECT_TYPE } from './effect-executor.mjs';
import {
  IMPACT_LEVELS,
  MANDATORY_LENSES,
  PANEL_LENSES,
  buildPanelMandate,
  deriveVerdict,
  deriveLoopOutcome,
  normalizeFindings,
  renderReviewNotice,
} from '../lib/review-core.mjs';
import { DISPOSITIONS, VERDICTS } from '../lib/jury-core.mjs';
import { renderPanelComment } from '../lib/review-render.mjs';
// #xwp8ioh — the SAME predicate `we:scripts/review-set-label.mjs` enforces at the write side (#2953), imported
// rather than restated, so the read side and the write side cannot drift into two answers (#2644).
import { classifyPrLiveness, inertPrMessage } from '../lib/pr-liveness.mjs';
// THE GUARD, IMPORTED NOT INJECTED — see property 2 in the header.
import { decideSetLabel, presentRemoveLabels } from '../review-set-label.mjs';

/** The operation's stable id. Adapters resolve it by this name. */
export const REVIEW_PR_OP = 'review-pr';

/**
 * THE SURFACE this operation's verdicts come through, as `review-set-label.mjs --channel` renders it (#2898).
 *
 * Declared HERE, beside the footer that says the same thing, because the two sentences appear in ONE comment
 * and drifting apart is the defect: the first live run (PR #1146) posted a comment whose attribution credited
 * the Plateau Loop review console — the CLI's old hardcoded constant — three lines above its own footer saying
 * it came through this operation. Same comment, two provenances.
 */
export const REVIEW_PR_CHANNEL = `the declared \`${REVIEW_PR_OP}\` operation (#3035)`;

/** The default lens a single juror judges under. `correctness` is `MANDATORY_LENSES[0]` — the floor, not a pick. */
export const DEFAULT_LENS = MANDATORY_LENSES[0];

/**
 * The juror's model / effort / budget. LITERALS, deliberately — never sourced from an input field.
 *
 * THE FOOTGUN THIS CLOSES (#3028, just fixed there): an option *value* shaped like a flag (`model: '--bare'`)
 * reaches `buildJudgeArgv`'s argv guard. Nothing in the run's INPUT can reach these three: the one input field
 * that DOES reach the judge request is `lens`, and `buildPanelMandate` refuses anything outside `PANEL_LENSES`
 * before it can become argv (it lands in the mandate TEXT, never in a flag position, either way).
 *
 * WHAT CHANGED, AND WHAT DID NOT (#3151). This comment used to add that a fat-fingered `--model=--bare` on the
 * command line "has no path to the juror's argv at all". That is no longer true as written: `--model` is now a
 * real CONTROL flag of the derived command line, so the value has a path — it is refused ON it, twice, rather
 * than having none. The parse rejects a `-`-leading value before a run record exists, and
 * `assertSafeJudgeRequest` rejects it again on the merged request the spawn will actually use. The property
 * that survives untouched is the one this file is responsible for: a run's INPUT still cannot reach argv, and
 * these three stay LITERALS for exactly that reason.
 */
/** What a reviewing juror may do. Read and search, plus Bash for gates, reproduction and mutation probes. */
export const REVIEW_JUROR_TOOLS = Object.freeze(['Bash', 'Read', 'Grep', 'Glob']);

export const JUDGE_MODEL = 'sonnet';
export const JUDGE_EFFORT = 'high';
/**
 * NO SPEND CEILING (operator ruling, 2026-08-18 — `#xvkjndx`). `null` omits `--max-budget-usd` entirely.
 *
 * The ceiling was never a cost control here; it was a silent TRUNCATION of the review. A tool-bearing juror
 * that hits it is killed mid-run and reports `stop_reason: "tool_use"`, which reads like a crash — so the
 * failure costs a misdiagnosis on top of the lost review. Four measured runs on 2026-08-18 spent $0.6152,
 * $0.6597, $0.6997 and $0.9042; the old inherited default of 0.5 would have killed all four, and between them
 * they found ten defects a green suite and check:standards both missed. A truncated review is worth less than
 * its own price.
 *
 * The bound that remains is `judgeSpawn`'s 10-minute `timeoutMs` kill, which is a bound on RUNAWAY rather than
 * on thoroughness — the right shape for this. Measured wall times were 167-312s, so it is real headroom, not a
 * fig leaf.
 */
export const JUDGE_BUDGET_USD = null;

/** What the `confirm` step records as the actor. `human` on a gate-self PR, `agent` otherwise. */
export const CONFIRM_ACTORS = Object.freeze({ HUMAN: 'human', AGENT: 'agent' });

/** The closed answer set for the `confirm` step. `abstain` is the non-mutating exit: it declares NO effects. */
export const CONFIRM_OPTIONS = Object.freeze(['accept', 'changes', 'abstain']);

/** The four effect types `record` declares. `verdict-ledger.append` is #3032's reserved seam for #3007. */
export const REVIEW_EFFECTS = Object.freeze({
  WRITE_UP: 'review.write-up',
  LABEL: 'review.label-swap',
  LEDGER: LEDGER_EFFECT_TYPE,
  NOTICE: 'review.notice',
});

/**
 * The JSON Schema the juror's answer is FORCED to satisfy (`--json-schema`, #3028). Its finding fields are the
 * canonical `Finding` shape `normalizeFinding` (`we:scripts/lib/jury-core.mjs`) reads, so the juror's structured
 * output flows into `deriveVerdict` with no adapter layer in between — and the enums are taken FROM the enums
 * (`IMPACT_LEVELS`, `DISPOSITIONS`) rather than retyped, so a fifth impact level cannot silently be unaskable.
 */
export const REVIEW_JUDGE_SHAPE = Object.freeze({
  type: 'object',
  additionalProperties: false,
  // `summary` IS REQUIRED, and #x0p5k2q is why. It was optional, so a juror could answer exactly
  // `{findings: []}` — having said nothing about what it looked at — and `deriveVerdict` reduced that to
  // `accept`. Observed twice on PR #1513: two independent jurors, 13 turns and ~$0.79 each over a 48.5k-char
  // diff, both returning an empty array and no summary. PR #1510's juror returned the same empty array
  // alongside a 548-character account of what it had verified, so the field's absence is NOT a property of a
  // clean review.
  //
  // `record-verdict` already refuses such a run ("staged no write-up to carry"), which is what caught this and
  // means nothing false was ever recorded. But refusing THERE only deadlocks the pipeline: the operator has
  // been told the PR was accepted and the verdict can never be carried. Requiring it here refuses at the step
  // that produced the emptiness, which is the only place it can still be re-asked.
  //
  // A JUROR THAT JUDGED MUST SAY WHAT IT JUDGED. Zero findings stays a perfectly good answer — this asks only
  // that it be an answer rather than a silence, the same line drawn between `unrun` and `pass` everywhere else.
  required: ['findings', 'summary'],
  properties: {
    summary: {
      type: 'string',
      description: 'REQUIRED. One sentence on the diff as a whole — what you examined and what you concluded. '
        + 'Zero findings is a fine verdict; saying nothing is not one, and an empty summary is refused.',
    },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['summary'],
        properties: {
          summary: { type: 'string' },
          file: { type: 'string' },
          line: { type: 'number' },
          category: { type: 'string' },
          failure_scenario: { type: 'string' },
          verdict: { type: 'string', enum: ['CONFIRMED', 'PLAUSIBLE'] },
          impactIfUnfixed: { type: 'string', enum: Object.values(IMPACT_LEVELS) },
          disposition: { type: 'string', enum: Object.values(DISPOSITIONS) },
          introduced: { type: 'boolean' },
          worseThanBase: { type: 'boolean' },
          parallelizable: { type: 'boolean' },
          rootCause: { type: 'string' },
          prevention: { type: 'string' },
          preventionCaptured: { type: 'boolean' },
        },
      },
    },
  },
});

/** A full 40-hex object name, or `null`. Nothing shorter counts: an abbreviation is not a pin. */
function pinnedSha(value) {
  return typeof value === 'string' && /^[0-9a-f]{40}$/i.test(value) ? value.toLowerCase() : null;
}

/**
 * SHAPE-CHECK one `readPr` result and turn it into the `read` finding. PURE — separated from the injected read
 * so the refusal below is testable without touching `gh` or `git`.
 *
 * THE REFUSAL: an `exec-contract` net-diff miss THROWS. `we:skills-src/review/SKILL.md` used to carry this as a
 * paragraph the model had to remember (*"This is a bug in YOUR wrapper to fix, not license to fall back"*, #2952).
 * Falling back there ships `gh pr diff`'s inflated three-dot list as if it were the PR's content — the exact
 * false positive #2450/#2901 exist to prevent. The other two misses (`ref-unresolved`, `diff-failed`) are
 * genuinely unfixable from here, so they DEGRADE: the finding carries `degraded` + the reason and every surface
 * that renders it says the basis is degraded, which is what the skill asked a human to remember to write down.
 *
 * @param {object} raw - what {@link ./review-pr-io.mjs}'s `readPr` returns.
 * @param {{pr: number, repo: string}} asked - what the run asked for, so a mismatched read is caught here.
 * @returns {object} the `read` finding.
 */
export function shapeReadFinding(raw, { pr, repo } = {}) {
  if (!raw || typeof raw !== 'object') {
    throw new Error(`review-pr.read: the injected reader returned ${typeof raw}, not a PR context object`);
  }
  const detail = raw.detail && typeof raw.detail === 'object' ? raw.detail : {};
  const net = raw.net && typeof raw.net === 'object' ? raw.net : {};
  const diff = raw.diff && typeof raw.diff === 'object' ? raw.diff : {};

  // #xwp8ioh — THE LIVENESS REFUSAL, FIRST on purpose: before the net-diff contract check, before any
  // shaping, and — because this is the `read` step — before `judge` spends a juror. `we:scripts/review-set-
  // label.mjs` has refused an inert PR since #2953, but only at the WRITE side, so the cost was already sunk
  // by the time it fired. On 2026-08-20 that meant three correctness rounds (~$4) against PR #1503, which had
  // merged two hours before round 1 began; every refusal was right and every one of them was too late.
  //
  // `unknown` refuses too. A read that could not report the state has not told us the PR is live, and
  // reviewing on "we couldn't tell" is the absence-of-evidence-as-evidence move this engine refuses
  // everywhere else (`verify`'s `unrun`, #3203's killed-vs-crashed juror).
  const liveness = classifyPrLiveness({ state: raw.state });
  if (liveness.outcome !== 'reviewable') {
    throw new Error(
      `review-pr.read: ${inertPrMessage({ pr: `${repo}#${pr}`, state: liveness.state, phase: 'read' })}`,
    );
  }

  if (net.scored !== true && net.reason === 'exec-contract') {
    throw new Error(
      `review-pr.read: the net-diff basis reported \`exec-contract\` for ${repo}#${pr} — the injected \`exec\` is `
      + 'not `(cmd, args, opts) => execFileSync(cmd, args, opts)`-shaped. That is a bug in the CALLER to fix, not '
      + 'license to fall back to `gh pr diff`, whose three-dot output lists sibling-lane files this PR does not '
      + 'touch (#2952/#2450). Refusing to review on an inflated basis.',
    );
  }

  const netChangedFiles = Array.isArray(net.paths) ? net.paths.map(String) : [];
  const degradedReason = net.scored === true ? '' : String(net.reason || 'unscored');

  return {
    priorRounds: Number(raw?.priorRounds) || 0,
    pr: Number(detail.pr) || Number(pr) || 0,
    repo: String(detail.repo || repo || ''),
    title: String(detail.title || ''),
    url: String(detail.url || ''),
    headRefName: String(raw.headRefName || ''),
    body: String(raw.body || ''),
    labels: Array.isArray(detail.labels) ? detail.labels.map(String) : [],
    // FROM THE LABELS, per the card — never inferred from the diff or from what the PR touches.
    humanRequired: detail.humanRequired === true,
    reviewClass: String(detail.reviewClass || 'none'),
    disposition: detail.disposition ?? null,
    escalationReason: Array.isArray(detail.escalationReason) ? detail.escalationReason.map(String) : [],
    advisoryComment: detail.advisoryComment ?? null,
    humanComment: detail.humanComment ?? null,
    // ── GROUND TRUTH ──────────────────────────────────────────────────────────────────────────────────────
    netChangedFiles,
    // THE BASIS IS PINNED TO COMMITS, NOT REFS. `base` is already a merge-base SHA. `rev` used to be
    // `computeNetDiffPaths`'s `candidate`, i.e. `origin/<headRefName>` — a ref that moves the moment the lane
    // pushes again, so the recorded basis stopped describing the diff that was actually judged. The io shell
    // resolves that candidate to a commit (`revSha`) and the REF is kept separately for the reader.
    // `pinnedSha` refuses anything that is not a full 40-hex object name rather than pinning a shorter thing
    // that only looks like one — `rev: null` is a legible "unpinned", a half-pinned ref is not.
    netBasis: {
      base: net.base ?? null,
      rev: pinnedSha(net.revSha) ?? pinnedSha(net.rev),
      revRef: net.rev ? String(net.rev) : null,
      scored: net.scored === true,
    },
    diffText: String(diff.text || ''),
    diffScored: diff.scored === true,
    // ── NOT GROUND TRUTH: `gh`'s own file list, three-dot and inflated. Carried for DISPLAY only; nothing
    //    downstream of here may hand it to a juror. (#2901 — the console diff stat that disagreed with what the
    //    agent saw is this list, and naming it differently is what stops the two being confused.)
    ghDiffStat: Array.isArray(detail.diffStat) ? detail.diffStat : [],
    degraded: degradedReason !== '',
    degradedReason,
  };
}

/** The material a juror sees: the PR's description and the NET diff, and nothing else (#2336 context isolation). */
export function renderJudgeInput(read) {
  const lines = [
    `PR ${read.repo}#${read.pr} — ${read.title}`,
    '',
    '## PR description',
    '',
    read.body?.trim() || '_(no description)_',
    '',
    `## Net changed files (${read.netChangedFiles.length})`,
    '',
    read.netChangedFiles.length ? read.netChangedFiles.map((p) => `- ${p}`).join('\n') : '_(none resolved)_',
    '',
    '## Net diff vs current main',
    '',
    read.diffText?.trim() || '_(the net diff could not be resolved — see the degraded note)_',
  ];
  return lines.join('\n');
}

/**
 * DOES THE RECORDED DECISION ACTUALLY DISAGREE WITH THE JUROR? PURE.
 *
 * WHY IT EXISTS. `renderVerdictWriteUp` used to render its "Why this was overridden … the decision above
 * differs from them" section on `reason` being non-empty ALONE. `--reason` is accepted on every answer, so
 * `--answer=accept --reason="fyi"` — or a `changes` answer the juror itself asked for — posted a durable
 * claim of disagreement where there was none. The reason is the operator's, but the *disagreement* is a fact
 * about two verdicts, and only this predicate may assert it.
 *
 * WHAT IT IS *NOT*: co-extensive with the reasonless-bounce refusal in `record`. RETRACTED — this docblock used
 * to claim *"zero findings is exactly `deriveVerdict`'s `accept`, so every case it refuses is a case this returns
 * true for."* That is false, and the two predicates ask genuinely different questions:
 *   - `record`'s guard binds on the JUROR'S FINDING COUNT being zero;
 *   - this binds on the JUROR'S VERDICT.
 * `deriveVerdict` returns `needs-human` on `humanRequired` BEFORE it looks at findings at all, and
 * `prevention-outstanding` on a finding that blocks acceptance without earning a round. Either can come back
 * with zero outstanding findings, so a `changes` there is refused without a reason (the author lane still has
 * nothing to read) and is still NOT captioned an override — the juror did not say accept, so there is no
 * disagreement to claim. That asymmetry is deliberate: the guard protects the AUTHOR, this predicate protects
 * the RECORD. `abstain` writes nothing at all, so it can never be an override.
 *
 * @param {{verdict?: {verdict?: string}, answer?: string}} o the juror's verdict and the operator's answer.
 * @returns {boolean} true iff the operator's answer departs from what the juror's verdict called for.
 */
export function overridesJuror({ verdict, answer } = {}) {
  const juror = verdict?.verdict;
  if (answer === 'accept') return juror !== VERDICTS.ACCEPT;
  if (answer === 'changes') return juror === VERDICTS.ACCEPT;
  // `abstain` declares no effects, so there is no recorded decision to disagree with anything.
  return false;
}

/**
 * The durable verdict write-up posted as the PR comment. EXTENDS `renderPanelComment`
 * (`we:scripts/lib/review-render.mjs`, #2432) rather than hand-rolling markdown — the operation adds only the
 * three lines that are ITS business: who decided, on what basis, and whether that basis was degraded.
 * PURE.
 */
export function renderVerdictWriteUp({ read, verdict, answer, actor, lens, reason = '' }) {
  const overrode = overridesJuror({ verdict, answer });
  const body = renderPanelComment({
    findings: verdict.findings,
    verdict: verdict.verdict,
    disposition: read.disposition,
    lensVerdicts: { [lens]: verdict.verdict },
    // THE TABLE LISTS WHAT RAN, NOT WHAT EXISTS. `renderPanelComment` defaults `lenses` to the whole
    // `PANEL_LENSES` set, so the first live run (PR #1146) rendered `security | mandatory | (no verdict)`
    // directly under "✅ pass — no blocking findings": three mandatory lenses shown as unjudged beside a pass,
    // which reads as a hole in the review. It was not a hole — this operation declares ONE `judge` step and
    // therefore runs ONE juror. The honest render is a one-row table plus the note below saying so; the four
    // rows come back when the multi-lens panel (`we:scripts/lib/judge-panel.mjs`, #3050 — BUILT, and not yet
    // wired into this operation) substitutes behind the same step.
    lenses: [lens],
    heading: `Human review verdict — ${read.repo}#${read.pr}`,
  });
  const basis = read.degraded
    ? `⚠️ DEGRADED BASIS (\`${read.degradedReason}\`) — the net diff vs current main could not be resolved, so the `
      + 'file list below may be inflated by sibling-lane content this PR does not touch (#2450).'
    : `Net basis: \`${read.netBasis.base ?? '?'}..${read.netBasis.rev ?? '?'}\`${renderRevProvenance(read.netBasis)} — `
      + `${read.netChangedFiles.length} net changed file(s) vs current main (#2450), not \`gh pr diff\`'s three-dot list.`;
  return [
    body,
    '',
    '---',
    '',
    `**Decision:** \`${answer}\` — recorded by ${actor}.`,
    // THE OPERATOR'S OWN WORDS, rendered where the author lane reads the bounce. The panel body above is the
    // JUROR's output; when the operator disagrees with it, that disagreement is the actionable half and it
    // belongs beside the decision, not in a separate comment somebody has to go find.
    //
    // RETRACTED — this comment used to end *"Omitted entirely when there is no override, so an ordinary accept
    // is unchanged."* That was WRONG on both halves: the section rendered on `reason` being non-empty alone, so
    // `--answer=accept --reason="fyi"` rendered it, and rendered it claiming a disagreement that did not exist.
    // Which heading is used is now decided by `overridesJuror` — the fact — and never by reason-present.
    ...(reason
      ? ['', overrode
        ? `**Why this was overridden.** The \`${lens}\` juror's findings are rendered above; the decision `
          + 'above differs from them. The operator gave this reason:'
        // NOT AN OVERRIDE, SO IT MUST NOT SAY ONE. `--reason` is accepted on every answer; when the decision
        // agrees with the juror the operator's words are still worth carrying, but calling them an override
        // would be a false claim about the record (see `overridesJuror`).
        : `**Operator note.** The decision above agrees with the \`${lens}\` juror; this is not an override. `
          + 'The operator added:', '', `> ${reason.split('\n').join('\n> ')}`, '']
      : []),
    `**Lens:** \`${lens}\` — a SINGLE-LENS run. One \`judge\` step, one juror, one lens; the table above lists `
      + `only the lens that judged. The other ${Math.max(PANEL_LENSES.length - 1, 0)} panel lenses `
      + `(${PANEL_LENSES.filter((l) => l !== lens).join(', ')}) did NOT run and are not reported as unjudged.`,
    basis,
    '',
    `_Recorded through the declared \`${REVIEW_PR_OP}\` operation (#3035)._`,
  ].join('\n');
}

/**
 * The parenthetical after the net basis: which ref that pinned SHA came from, or a warning that nothing was
 * pinned. PURE.
 *
 * WHY IT EXISTS. The first live run recorded `netBasis.rev` as `origin/lane/3058-seed-encoding` — a MUTABLE
 * ref. The `reviewed-sha` marker compensates for the merge gate, but the "Net basis" line is the durable
 * statement of what the juror was shown, and a branch name does not state it: the branch moves, and the line
 * then describes a diff nobody can reproduce. The reader now gets the commit, plus the ref it resolved from.
 */
function renderRevProvenance(netBasis) {
  if (netBasis?.rev) return netBasis.revRef ? ` (rev \`${netBasis.revRef}\` at review time)` : '';
  return netBasis?.revRef
    ? ` (⚠️ UNPINNED — \`${netBasis.revRef}\` is a mutable ref that could not be resolved to a commit)`
    : '';
}

/**
 * BUILD THE DECLARATION. `readPr` is the injected reader (see the header); {@link ./review-pr-io.mjs} supplies
 * the real one and tests supply a stub. Built per call so nothing leaks between registries.
 *
 * @param {{readPr: (o: {pr: number, repo: string}) => object}} deps
 * @returns {object} the frozen declaration from `op()`.
 */
export function reviewPrOperation({ readPr } = {}) {
  if (typeof readPr !== 'function') {
    throw new TypeError(
      'review-pr: needs a `readPr({pr, repo})` reader — the io is INJECTED so the declaration stays testable '
      + 'without `gh`; the real binding is `we:scripts/operations/review-pr-io.mjs`.',
    );
  }

  return op(REVIEW_PR_OP, {
    input: {
      pr: 'number',
      repo: 'string',
      // Which single lens judges. The value set is DECLARED (`enum`), so `validateInput` refuses an unknown
      // lens before a run record exists and the derived `--help` lists the four by name instead of `<string>`.
      // `buildPanelMandate` still refuses anything outside `PANEL_LENSES` in the `judge` step — belt and
      // braces, and it is the one that binds a caller who builds a run record by hand.
      // THE MULTI-LENS PANEL IS NOT THIS SLICE. A `judge` step declares ONE request; fanning it out to N
      // jurors under one budget is #3050, which is now RESOLVED and SHIPPED as `we:scripts/lib/judge-panel.mjs`
      // — but it is NOT wired into this operation, which still declares and spawns exactly one juror. (This
      // comment said "NOT built" until #3050 landed; the correction matters, because the verdict write-up
      // renders a ONE-ROW panel table on that basis and would be lying if the panel were actually running.)
      // Wiring it substitutes behind this same step — the request already carries `lens` — and no other step
      // changes.
      lens: { type: 'string', required: false, default: DEFAULT_LENS, enum: [...PANEL_LENSES] },
      // WHAT TO HUNT (#3094) — the caller's hypothesis about where the defect is, surfaced as `--aim=<string>`.
      // THE REASON THIS INPUT EXISTS: over one session driving four PRs to merge, every review that found a real
      // defect was a HAND-ROLLED mandate naming the shape to look for, and none went through this operation —
      // because there was no way to tell it what to hunt. `goal` could not carry it: `goal` is the PR TITLE, i.e.
      // what the diff is TRYING to do, and a juror needs both (context AND instruction), so `aim` is passed
      // ALONGSIDE it, never in its place.
      // IT IS A HYPOTHESIS, NOT A VERDICT. `buildPanelMandate` renders it under a heading saying the caller
      // stated it and nothing has established it, and instructs the juror to report the named defect ABSENT when
      // it is absent — an aim that tells a juror its conclusion buys a reviewer who confirms it either way.
      // Free text with no `enum`, unlike `lens`: naming a search cannot be a closed vocabulary. It reaches the
      // juror only inside the mandate TEXT and inside a #2438 data fence — never a flag position in argv (the
      // `JUDGE_MODEL` note above is the general form of that property).
      aim: { type: 'string', required: false },
      // A CONFIRM-TIME INPUT (`atConfirm`, #3035) — a declared field of this operation, but one that rides the
      // `--resume` that answers the confirm rather than the call that starts the run. Every other field here
      // describes the SUBJECT and is known before a step has run; this one qualifies the operator's DECISION,
      // which does not exist until `judge` has returned and `confirm` has asked. See `atConfirm` in
      // `we:scripts/operations/registry.mjs` for the marker, and `record`'s `reads` below for the half that
      // makes it visible to the step that needs it.
      //
      // RETRACTED, TWICE, because each attempt shipped and each was unreachable:
      //   1. PR #1569 declared it `{ type: 'string', required: false }` — an ORDINARY input. `--resume` refuses
      //      input flags (correctly: the run record already holds them), so the flag could only ride the
      //      opening call, before the override it describes was knowable. The SKILL documented a command that
      //      errored.
      //   2. PR #1572's first attempt removed it from the schema entirely and made `--reason` an adapter
      //      CONTROL flag, merged onto `run.input` at resume. That parsed — and `record` still never saw it,
      //      because `projectReads` builds `view.input` from the leaves a step NAMES in `reads`, and a step may
      //      only name a declared field. The comment that stood here read *"The `reason` field … is NOT an
      //      input … It is a CONFIRM-TIME control flag"*; the second half was the bug and the first half was
      //      the reason the bug could not be fixed without putting the field back.
      //
      // THE REASON THIS INPUT EXISTS. `confirm` records one of a closed answer set and nothing else, so an
      // operator who bounces a PR the juror ACCEPTED had no channel to say why. The write-up is composed from
      // `verdict.findings` — the JUROR's — while `Decision:` comes from `findings.confirm`, so the PR received
      // a comment reading "✅ pass — no blocking findings" directly above "Decision: `changes`", and the author
      // lane was bounced with no stated reason. A bounce the author cannot act on buys another round by
      // construction, which is why this is the cheapest round to delete.
      //
      // HOW OFTEN, COUNTED. Swept 2026-08-26 over PRs #1428–#1567 (140 PRs, 479 issue comments), matching the
      // shape `renderVerdictWriteUp` emits and nothing else — the line `**Decision:** `x` — recorded by`:
      //   - 106 structured verdict comments, across 59 PRs. None below #1456: the operation did not exist
      //     yet, so the swept window is wider than the window that can contain a hit.
      //   - 44 of the 106 recorded `changes`, across 15 PRs;
      //   - 18 of those 44, across 8 PRs (#1556–#1567), recorded `changes` over `### Findings (0)` — ZERO
      //     juror findings, the exact case the guard below refuses;
      //   - 34, across 11 PRs (#1556–#1567), recorded `changes` under the juror's own verdict line
      //     "✅ pass — no blocking findings" — the wider reading, since a `pass` can carry cosmetic findings.
      //
      // RETRACTED — every number in this block has been wrong at least once, so here is what it said and why
      // each was wrong. All three corrections come from re-running the sweep, not from re-reading a card.
      //   - *"Across PRs #1428–#1567 that happened ELEVEN times."* Eleven was the count of PRs in the WIDER
      //     set, not of occurrences; and neither set reaches below #1556, so quoting the whole range implied
      //     128 PRs of history that contain none of them.
      //   - *"(108 of them, across 62 PRs) … 45 recorded `changes` … 17 of those … 33, across 11 PRs."* The
      //     true figures are 106 / 59 / 44 / 18 / 34. The 108 came from a looser match that also swept up 7
      //     HAND-WRITTEN operator comments carrying a `**Decision:**` line with no `— recorded by` — those are
      //     an operator's prose, not this operation's output, and counting them inflated the denominator.
      //   - *"The corpus replay it cited does not support 11 either: it holds 13 such cases"*, and the guard
      //     below pointed a reader at `we:scripts/review-corpus/` for corroboration. THAT PATH DOES NOT EXIST
      //     in this repo — `ls` finds no such directory and nothing under `we:scripts/` imports one — so the
      //     figure was uncheckable and the citation sent the reader nowhere. Both are dropped rather than
      //     re-derived: the live sweep above is the whole basis, and it is reproducible from `gh` alone.
      //
      // It is free text with no `enum` for the same reason `aim` is: stating a reason cannot be a closed
      // vocabulary. `record` REFUSES a reasonless override — see the guard there — so this is not advisory.
      reason: { type: 'string', required: false, atConfirm: true },
      // Who the durable comment is attributed to. Free text, exactly like `review-set-label.mjs --actor`.
      actor: { type: 'string', required: false, default: 'operator' },
    },
    // The reduction IS the run's verdict — declared, not inferred by a caller reading findings.
    verdictFrom: 'reduce',

    // ── 1. read ─────────────────────────────────────────────────────────────────────────────────────────────
    // The park context (`assembleReviewDetail`) plus the NET-basis diff and file list. See `shapeReadFinding`
    // for the `exec-contract` refusal and for why `ghDiffStat` is named apart from `netChangedFiles`.
    read: compute({
      reads: ['input.pr', 'input.repo'],
      fn: (view) => shapeReadFinding(
        readPr({ pr: view.input.pr, repo: view.input.repo }),
        { pr: view.input.pr, repo: view.input.repo },
      ),
    }),

    // ── 2. judge ────────────────────────────────────────────────────────────────────────────────────────────
    // DECLARES the tool-free juror call in `judgeSpawn`'s option shape (#3028) and spawns NOTHING: the engine
    // suspends and the caller does the spawn between two `advance` calls. `--tools ""` is what makes the
    // mandate's "never check the branch out in a shared tree" (#2336) a thing the juror cannot do.
    judge: judgeStep({
      reads: ['input.lens', 'input.aim', 'findings.read'],
      request: (view) => {
        const read = view.findings.read;
        const lens = view.input.lens;
        // #3094 — the caller's aim rides in the MANDATE, beside the goal. `input.aim` is DECLARED in `reads`
        // above: a step that consumes an input without declaring it is reading state the run record does not
        // record it as depending on.
        const aim = typeof view.input.aim === 'string' ? view.input.aim : '';
        return {
          // GROUND TRUTH goes in as the NET list, never `ghDiffStat` (#2450).
          // `fenced: true` (#2967) — `read.title` is the PR title straight off `gh pr view`, written by whoever
          // opened the PR, so it goes to the juror inside the #2438 labelled data fence rather than in
          // instruction position. What that fixes is caller-supplied text reaching the mandate unfenced; whether
          // a crafted title could actually move a verdict is UNMEASURED, so this is hygiene, not a patched hole.
          mandate: buildPanelMandate({
            lens, netChangedFiles: read.netChangedFiles, goal: read.title, fenced: true, aim,
          }),
          input: renderJudgeInput(read),
          shape: REVIEW_JUDGE_SHAPE,
          lens,
          model: JUDGE_MODEL,
          effort: JUDGE_EFFORT,
          budget: JUDGE_BUDGET_USD,
          // TOOL-BEARING. A juror that can only read a diff finds none of the defects the hand-run reviews found
          // this week — a gh flag bypass proven by firing the command, a guard hole reproduced on the parent
          // commit, four decorative tests found by mutating source. The tools ARE the finding mechanism.
          // Isolation is structural instead: `assertLaneCwd` refuses the spawn unless the cwd is a lane of the
          // juror's OWN — not the primary checkout, and not the driver's lane. It cannot lean on
          // `guard-lane`, because `--safe-mode` disables hooks inside the juror; see
          // `we:scripts/lib/judge-spawn.mjs`
          // and its sessionId is derived, so the self-clear refusal holds against the author.
          allowedTools: REVIEW_JUROR_TOOLS,
        };
      },
    }),

    // ── 3. reduce ───────────────────────────────────────────────────────────────────────────────────────────
    // `deriveVerdict` decides; this step only feeds it. `humanRequired` comes off the LABELS the `read` step
    // observed, which is what makes a gate-self PR's verdict `needs-human` no matter how clean the findings are.
    reduce: compute({
      reads: ['findings.read', 'findings.judge', 'input.lens'],
      fn: (view) => {
        const read = view.findings.read;
        const answer = view.findings.judge && typeof view.findings.judge === 'object' ? view.findings.judge : {};
        const findings = normalizeFindings(answer.findings);
        // #x0p5k2q — REFUSE A SILENT JUROR, here as well as in the shape. `required` in JSON Schema only
        // asserts the KEY is present, so `{findings: [], summary: ""}` satisfies it and arrives as the same
        // nothing. Checked at the reduce step because this is where an empty answer would otherwise become
        // `accept`: `deriveVerdict` reads only the findings array, so silence and a clean bill are the same
        // input to it. Zero findings remains a fine verdict — this asks only that it be an ANSWER.
        const summary = String(answer.summary ?? '').trim();
        if (!summary) {
          throw new Error(
            'review-pr.reduce: the juror returned no summary — it reported nothing about what it examined, '
            + `which is \`unrun\`, not an accept (${findings.length} finding(s) returned). A juror that judged `
            + 'must say what it judged. Re-run the review; do not record a verdict on this run.',
          );
        }
        const humanRequired = read.humanRequired === true;
        const verdict = deriveVerdict({ findings, humanRequired });
        return {
          verdict,
          // WHERE THE LOOP STANDS, distinct from what this round decided. "converged" and "exhausted" both end
          // the loop and mean opposite things, so a caller must never have to infer one from the other. The
          // round comes from the durable ledger, so it needs no new state and survives a dead session.
          loop: deriveLoopOutcome({ verdict, round: read.priorRounds + 1 }),
          humanRequired,
          lens: view.input.lens,
          findings,
          summary,
        };
      },
    }),

    // ── 4. confirm ──────────────────────────────────────────────────────────────────────────────────────────
    // THE STOP POINT, AS MACHINERY. The engine suspends here and records what is asked and OF WHOM; the run is
    // resumable from any surface. `of` is `human` on a gate-self PR and `agent` otherwise, so the record itself
    // says which tier of actor was owed — the skill no longer has to.
    confirm: confirmStep({
      reads: ['verdict', 'findings.read'],
      asks: (view) => {
        const read = view.findings.read;
        const v = view.verdict || {};
        const n = Array.isArray(v.findings) ? v.findings.length : 0;
        return `${read.repo}#${read.pr} — the \`${v.lens}\` juror returned ${n} finding(s); `
          + `\`deriveVerdict\` reduced them to \`${v.verdict}\`${v.humanRequired ? ' (gate-self: review:human)' : ''}. `
          + `Record which verdict? (${CONFIRM_OPTIONS.join(' | ')}; \`abstain\` writes nothing)`;
      },
      of: (view) => (view.findings.read.humanRequired ? CONFIRM_ACTORS.HUMAN : CONFIRM_ACTORS.AGENT),
      options: [...CONFIRM_OPTIONS],
    }),

    // ── 5. record ───────────────────────────────────────────────────────────────────────────────────────────
    // DECLARES four effects and applies NONE. See the per-effect idempotency notes below — each is decided on
    // its own, because the executor's refusal to replay an indeterminate attempt is only as strong as the flag.
    //
    // ORDER IS THE SAFETY PROPERTY (the #2964 rule, now declared instead of hand-maintained). Effects apply
    // strictly ascending and the executor HALTS at the first that does not land, so:
    //   0 stages the write-up LOCALLY (inert — nothing but effect 1 reads it),
    //   1 makes the one REMOTE write (the single home posts the comment AND swaps the label, itself #2964-ordered),
    //   2 appends the durable ledger row only AFTER the swap actually landed — an orphan row in the merge
    //     authority is NOT inert, so it must never precede the label it vouches for,
    //   3 reports to the operator last, when there is something true to report.
    record: effectStep({
      // `input.reason` IS NAMED HERE OR THE GUARD BELOW CANNOT FIRE (PR #1572 round 5, the blocking finding).
      // `projectReads` builds `view.input` from exactly these leaves — "an undeclared path is absent, so the
      // declaration is the actual boundary" — so a `reason` sitting on the run record under a name this array
      // omits is stripped before `effects` runs, and the guard refuses a correctly-supplied reason as though
      // none had been given. RETRACTED: this array used to end `…, 'findings.confirm'],` with no
      // `input.reason`, which made the entire feature unreachable through the documented CLI.
      reads: ['input.pr', 'input.repo', 'input.actor', 'input.reason', 'verdict', 'findings.read', 'findings.confirm'],
      effects: (view) => {
        const answer = view.findings.confirm;
        // THE NON-MUTATING EXIT. The operator looked and chose not to record: zero effects, which the engine
        // resolves in the same `advance` rather than suspending. This is how a run is exercised end to end
        // against a real PR without touching it.
        if (answer === 'abstain') return [];

        const read = view.findings.read;
        const verdict = view.verdict || {};
        const pr = view.input.pr;
        const repo = view.input.repo;
        const actor = view.input.actor;
        const to = answer === 'accept' ? 'accepted' : 'changes';

        // ── THE PURE-CORE GUARD (property 2 in the header) ────────────────────────────────────────────────
        // INVARIANT 2 lives in `decideSetLabel`, imported, unbypassable. On a `review:human` PR `to:'accepted'`
        // comes back `allowed:false` and this step THROWS — no effect entry is created, so there is nothing to
        // apply, nothing to replay and nothing half-done. The generated caller therefore cannot clear a
        // gate-self PR any more than the hand-written one could, and for the same reason: the decision is not
        // its to make. The sanctioned clearance (`--to=clear-human`, #2895) is DELIBERATELY not reachable from
        // here — it demands an operator instruction quoted verbatim, which is judgment, not a declared step.
        // ── THE REASONLESS-BOUNCE REFUSAL (#3035) ─────────────────────────────────────────────────────────
        // A `changes` recorded over a juror that raised NOTHING is an override, and an override with no stated
        // reason ships a comment that reads "✅ pass — no blocking findings" beside "Decision: `changes`". The
        // author lane is then bounced with nothing to act on and comes back for another round having changed
        // whatever it guessed at. Refuse it here, in the pure core, so no caller can post one: either the juror
        // named findings, or the operator names a reason.
        //
        // The check is deliberately narrow. A bounce that CARRIES juror findings needs no `--reason` — the
        // findings are the reason, and they are already rendered. This only binds the empty case.
        const overrideReason = typeof view.input.reason === 'string' ? view.input.reason.trim() : '';
        const jurorFindings = Array.isArray(verdict.findings) ? verdict.findings.length : 0;
        if (answer === 'changes' && jurorFindings === 0 && overrideReason === '') {
          throw new Error(
            `review-pr.record: refusing to record \`changes\` on ${repo}#${pr} with no stated reason — the `
            + `\`${verdict.lens}\` juror returned 0 findings, so this is an OPERATOR OVERRIDE and the write-up `
            + 'would post "no blocking findings" above "Decision: `changes`". The author lane cannot act on '
            + 'that, so it buys another round. Pass `--reason="<what must change>"` on this same --resume, or '
            + 'record `abstain` to write nothing. (18 bounces across 8 PRs, #1556–#1567, were reasonless in '
            + 'exactly this way — see the counted sweep and its retractions at the `reason` input above.)',
          );
        }

        const decision = decideSetLabel({ to, currentLabels: read.labels });
        if (!decision.allowed) {
          throw new Error(
            `review-pr.record: refusing to record \`${to}\` on ${repo}#${pr} — ${decision.reason}. `
            + 'The refusal is `decideSetLabel` in `we:scripts/review-set-label.mjs` (INVARIANT 2, #2470/#2644); '
            + 'this operation does not carry a route around it. A gate-self PR is cleared only by the human '
            + 'ceremony `review-set-label.mjs --to=clear-human --actor=… --reason="<the operator instruction>"` '
            + '(#2895), which quotes an instruction and is therefore not a declarable step.',
          );
        }

        const bodyFile = `${repo.replace(/[^\w.-]+/g, '-')}-${pr}-verdict.md`;
        const body = renderVerdictWriteUp({ read, verdict, answer, actor, lens: verdict.lens, reason: overrideReason });

        return [
          // 0 — THE COMMENT (its body). IDEMPOTENT: TRUE. It writes bytes that are a pure function of the run
          //     record to one deterministic path in the operation's own sidecar. Re-writing produces a
          //     byte-identical file, there is no remote side and nothing accumulates, so an attempt whose
          //     outcome is unknown is safe to simply redo. Flagging it false would wedge the run on a crash
          //     that cost nothing.
          //     The name below is keyed by PR, NOT by run — the io shell stages it under `<runId>/`
          //     (`reviewBodyPath` in `we:scripts/operations/review-pr-io.mjs`) so two runs on the same PR in
          //     one checkout cannot cross-stage. That scoping does not weaken the property above: the run id
          //     belongs to the RECORD, not to the attempt, so a replay of this entry resolves the same path.
          {
            type: REVIEW_EFFECTS.WRITE_UP,
            payload: { pr, repo, bodyFile, body },
            idempotent: true,
          },
          // 1 — THE LABEL SWAP, via `decideSetLabel` and through the SINGLE HOME (`review-set-label.mjs`), which
          //     posts the write-up above with the `reviewed-sha` / `reviewed-diff` / `reviewed-contribution`
          //     markers and applies the label in the #2964-correct order. Splitting the comment and the label
          //     into two effects with two sinks would re-implement that script and lose those markers, which is
          //     precisely the re-implementation this slice forbids.
          //     IDEMPOTENT: FALSE — and this is THE one that matters. Adding a label twice is the same label,
          //     but the comment is not: a second run posts a SECOND durable comment. So an attempt whose outcome
          //     is unknown must stop the run for a person rather than guess, which is exactly the acceptance
          //     clause "a replayed `record` step produces no duplicate comment": an entry already `applied` is
          //     skipped, and an entry left `pending` is refused.
          {
            type: REVIEW_EFFECTS.LABEL,
            payload: {
              pr,
              repo,
              to,
              actor,
              // #2898 — the single home renders WHAT IT IS GIVEN. Told, not guessed: this operation is the
              // only thing that knows a run came through it, and the comment's own footer already says so.
              channel: REVIEW_PR_CHANNEL,
              bodyFile,
              addLabel: decision.addLabel,
              removeLabels: presentRemoveLabels(decision.removeLabels, read.labels),
              reason: decision.reason,
            },
            idempotent: false,
          },
          // 2 — THE LEDGER ROW (#3007's reserved seam, `verdict-ledger.append`).
          //     #3007 PHASE 1 has now registered a writer behind this type, and the declaration did not have to
          //     move — which is what the reserved seam was for. The sink is a RECONCILER, not a second writer:
          //     effect 1 shells `we:scripts/review-set-label.mjs`, the single home, which appends the row, so
          //     the sink reads it back and only writes when that fail-soft append missed
          //     (`we:scripts/operations/review-pr-io.mjs`).
          //     IDEMPOTENT: STILL FALSE, deliberately. Reconciliation makes a replay harmless in practice, but
          //     the flag asserts a property of the SINK CONTRACT, and the honest answer while #3007 is still
          //     shadow-only (Phase 2 — the drain reading the ledger — is unbuilt) is to keep the executor's
          //     fail-closed refusal: a stalled run asks a person, a duplicate row in a merge authority silently
          //     vouches twice. Flip this when Phase 2 lands and the dedupe is load-bearing rather than incidental.
          {
            type: REVIEW_EFFECTS.LEDGER,
            payload: {
              pr,
              repo,
              to,
              actor,
              verdict: verdict.verdict,
              lens: verdict.lens,
              humanRequired: verdict.humanRequired === true,
              findings: verdict.findings,
              netChangedFiles: read.netChangedFiles,
              netBasis: read.netBasis,
              degraded: read.degraded === true,
            },
            idempotent: false,
          },
          // 3 — THE EVENT: the operator-facing notice, rendered by the SAME `renderReviewNotice` the drain uses
          //     for its `escalated` event, so both directions of a PR's review outcome are reported in one
          //     wording (#2433).
          //     IDEMPOTENT: TRUE. It reports; it records nothing and nothing reads it back. The whole cost of a
          //     replay is a line printed twice, which is strictly cheaper than stalling the run to ask.
          {
            type: REVIEW_EFFECTS.NOTICE,
            payload: {
              pr,
              repo,
              notice: renderReviewNotice({
                event: 'cleared', pr, repo, outcome: to, actor, findings: verdict.findings,
              }),
            },
            idempotent: true,
          },
        ];
      },
    }),
  });
}

/** The lens set a caller may pass. Re-exported so an adapter can list it in `--help` without a second copy. */
export { PANEL_LENSES };
