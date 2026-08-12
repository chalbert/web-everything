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
import { DISPOSITIONS } from '../lib/jury-core.mjs';
import { renderPanelComment } from '../lib/review-render.mjs';
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
 * reaches `buildJudgeArgv`'s argv guard. Nothing in the run's input can reach these three, so a hostile or
 * fat-fingered `--model=--bare` on the command line has no path to the juror's argv at all. The one input field
 * that DOES reach the judge request is `lens`, and `buildPanelMandate` refuses anything outside `PANEL_LENSES`
 * before it can become argv (it lands in the mandate TEXT, never in a flag position, either way).
 */
/** What a reviewing juror may do. Read and search, plus Bash for gates, reproduction and mutation probes. */
export const REVIEW_JUROR_TOOLS = Object.freeze(['Bash', 'Read', 'Grep', 'Glob']);

export const JUDGE_MODEL = 'sonnet';
export const JUDGE_EFFORT = 'high';
export const JUDGE_BUDGET_USD = 1.5;

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
  required: ['findings'],
  properties: {
    summary: { type: 'string', description: 'One sentence on the diff as a whole.' },
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
 * The durable verdict write-up posted as the PR comment. EXTENDS `renderPanelComment`
 * (`we:scripts/lib/review-render.mjs`, #2432) rather than hand-rolling markdown — the operation adds only the
 * three lines that are ITS business: who decided, on what basis, and whether that basis was degraded.
 * PURE.
 */
export function renderVerdictWriteUp({ read, verdict, answer, actor, lens }) {
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
      reads: ['input.lens', 'findings.read'],
      request: (view) => {
        const read = view.findings.read;
        const lens = view.input.lens;
        return {
          // GROUND TRUTH goes in as the NET list, never `ghDiffStat` (#2450).
          mandate: buildPanelMandate({ lens, netChangedFiles: read.netChangedFiles, goal: read.title }),
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
          summary: String(answer.summary || ''),
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
      reads: ['input.pr', 'input.repo', 'input.actor', 'verdict', 'findings.read', 'findings.confirm'],
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
        const body = renderVerdictWriteUp({ read, verdict, answer, actor, lens: verdict.lens });

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
