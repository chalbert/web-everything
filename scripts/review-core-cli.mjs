#!/usr/bin/env node
/**
 * review-core-cli.mjs — a thin impure CLI over the PURE review-verdict core in
 * `we:scripts/lib/review-core.mjs` (#2435, slice of epic #2418).
 *
 * NOTE ON THE NAME: this file is deliberately NOT named `review-core.mjs`. That basename belongs to the
 * policy-tier trust-chain member `we:scripts/lib/review-core.mjs` (see `scripts/lib/gate-config.mjs`
 * TRUST_CHAIN, which matches by BASENAME, not path). A CLI wrapper over pure fns is engine-tier, not
 * policy-tier, so it must keep a distinct basename — otherwise pr-land mis-stamps `review:human` (gate-self)
 * on it. The `-cli` suffix keeps it engine-tier and matches the backlog slug `2435-review-core-cli`.
 *
 * WHY: the drain's review loop (`we:skills-src/drain/SKILL.md`) reduced a review round the same handful of
 * ways over and over — normalize findings → verdict, reduce a panel's per-lens verdicts to one, derive the
 * next negotiation/plan step, derive the escalation disposition, render the per-lens verdict table — each done
 * as a throwaway inline `node -e` that re-imports the lib and re-hand-rolls the glue. Five of them. That glue
 * was untested (you can't unit-test a `node -e` string) and drifted per caller. This CLI is the ONE place that
 * glue lives: a `reduce` subcommand that combines those pure fns into one machine object, and a `mandate`
 * subcommand that emits the reviewer/editor/validator mandate text. The CLI does I/O (read stdin/--file, print);
 * the REDUCTION itself is the pure `reduceReview` / `buildMandateText` layer below, unit-tested without spawning.
 *
 * This module NEVER re-implements any derivation — it only imports from `./lib/review-core.mjs`. The judgment
 * (spawning a subagent, reading a diff, deciding `conflict`/`humanRequired`) stays with the caller, exactly as
 * the lib documents; this is the mechanical half.
 *
 * SCOPE (#2435): `reduce` + `mandate`. #2432 adds the `comment` subcommand — the full PR-comment body rendered
 * from a panel's structured result via `renderPanelComment` (`we:scripts/lib/review-render.mjs`, a SEPARATE
 * engine-tier module so the pure renderer stays off the policy-tier `review-core.mjs` and agent-clearable). The
 * dispatch below stays easy to extend.
 *
 * Usage:
 *   node scripts/review-core-cli.mjs reduce --file=findings.json          # human: verdict/disposition/outcome + table
 *   cat round.json | node scripts/review-core-cli.mjs reduce --json       # machine object on stdout
 *   node scripts/review-core-cli.mjs reduce --file=r.json --round=2        # also derive the negotiation outcome
 *   node scripts/review-core-cli.mjs reduce --file=r.json --round=2 --phase=plan   # ...the plan-handshake outcome
 *   node scripts/review-core-cli.mjs mandate --lens=correctness           # a panel reviewer mandate for one lens
 *   node scripts/review-core-cli.mjs mandate --validator --lens=security  # the independent-validator mandate
 *   cat findings.json | node scripts/review-core-cli.mjs mandate --editor --round=2   # the editor-round mandate
 *   cat result.json | node scripts/review-core-cli.mjs comment            # the full PR-comment markdown body
 *   node scripts/review-core-cli.mjs comment --file=result.json --json     # { markdown } on stdout
 *   node scripts/review-core-cli.mjs rigor --reasons='blast-radius (x),size (500 …)'  # care-level + panel rigor (#2567)
 *
 * `reduce` input (JSON, from --file or stdin) is the option bag `reduceReview` consumes — any subset of:
 *   { findings, humanRequired, lensVerdicts, mandatoryLenses, conflict, reason, reasons, round, roundCap, phase }
 * Flags `--round` / `--roundCap` / `--phase` / `--reason` / `--reasons` (comma-sep) override the JSON's fields.
 *
 * `comment` input (JSON, from --file or stdin) is `{ findings, verdict, disposition }` (plus optional
 * `lensVerdicts` / `mandatoryLenses` / `lenses` / `heading` for the embedded verdict table). When `verdict` or
 * `disposition` is absent it is DERIVED from the findings (`deriveVerdict` / `deriveReviewDisposition` when a
 * `reason`/`reasons` set is supplied) — matching how `reduce` reads its input. Flags `--reason` / `--reasons`
 * (comma-sep) override the JSON's fields, same as `reduce`.
 *
 * Exit codes: 0 = ok; 2 = usage error (unknown subcommand / bad flags / no input); 1 = a derivation threw
 * (e.g. an unknown escalation reason, a missing mandatory-lens verdict) — the message is printed as `{error}`.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  normalizeFindings,
  deriveVerdict,
  deriveReviewDisposition,
  derivePanelVerdict,
  renderPanelVerdictTable,
  deriveNegotiationOutcome,
  derivePlanOutcome,
  buildPanelMandate,
  buildEditorMandate,
  buildValidatorMandate,
  careLevelFromReasons,
  panelRigorFromReasons,
} from './lib/review-core.mjs';
import { renderPanelComment } from './lib/review-render.mjs';

// ── tiny flags parser (matches push-if-green.mjs) ─────────────────────────────────────────────────────
/**
 * Parse `--k=v` / bare `--flag` argv into a plain object. Pure. Non-flag positionals are ignored (the
 * subcommand is `argv[0]`, dispatched separately). `--flag` with no `=` is `true`.
 * @param {string[]} argv
 * @returns {Object<string, string|true>}
 */
export function parseFlags(argv) {
  const flags = {};
  for (const a of argv) {
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq === -1) flags[a.slice(2)] = true;
    else flags[a.slice(2, eq)] = a.slice(eq + 1);
  }
  return flags;
}

// ── PURE reduction layer (the testable core the 5× inline node -e calls collapse into) ────────────────
/**
 * Reduce one review round's raw inputs into the derived contract, combining the pure fns from
 * `./lib/review-core.mjs` in the ONE order the drain loop needs. Pure — no I/O, no spawning. Each derived
 * field is computed only when the input supports it, so a partial input (just findings, or just a reason set)
 * yields a partial result rather than throwing.
 *
 *   - `findings`/`findingsCount` — always: the normalized findings list (empty when none supplied).
 *   - `verdict` — `derivePanelVerdict` when per-lens `lensVerdicts` are supplied (the v3 panel reduction),
 *     else `deriveVerdict` over the findings (+ `humanRequired`, which always wins).
 *   - `verdictTable` — the per-lens markdown table, only when `lensVerdicts` are supplied.
 *   - `disposition` — `deriveReviewDisposition` when a `reason`/`reasons` escalation set is supplied.
 *   - `careLevel` / `rigor` — the advisory care-level and the panel rigor it dials (#2567), also only when a
 *     `reason`/`reasons` set is supplied (same trigger as `disposition`).
 *   - `outcome` — the next negotiation step (`deriveNegotiationOutcome`) or, when `phase: 'plan'`, the
 *     plan-handshake step (`derivePlanOutcome`), only when a `round` is supplied — derived from `verdict`.
 *
 * @param {{findings?: Array<object>, humanRequired?: boolean, lensVerdicts?: Object<string,string>,
 *   mandatoryLenses?: string[], conflict?: boolean, reason?: string, reasons?: string[],
 *   round?: number, roundCap?: number, phase?: 'negotiation'|'plan'}} [input]
 * @returns {{findings: object[], findingsCount: number, verdict: string, verdictTable?: string,
 *   disposition?: {mode: string, autoLand: boolean}, outcome?: string}}
 */
export function reduceReview(input = {}) {
  const {
    findings,
    humanRequired = false,
    lensVerdicts,
    mandatoryLenses,
    conflict = false,
    reason,
    reasons,
    round,
    roundCap,
    phase = 'negotiation',
  } = input || {};

  const normalized = normalizeFindings(findings);
  /** @type {any} */
  const out = { findings: normalized, findingsCount: normalized.length };

  const hasPanel = lensVerdicts && typeof lensVerdicts === 'object';
  if (hasPanel) {
    out.verdict = derivePanelVerdict({ lensVerdicts, humanRequired, conflict, mandatoryLenses });
    out.verdictTable = renderPanelVerdictTable({ lensVerdicts, mandatoryLenses });
  } else {
    out.verdict = deriveVerdict({ findings: normalized, humanRequired });
  }

  const hasReasons = reason != null || (Array.isArray(reasons) && reasons.length > 0);
  if (hasReasons) {
    out.disposition = deriveReviewDisposition({ reason, reasons });
    // #2567 — the advisory care-level + the panel rigor it dials, from the SAME reason set (lenient: never throws).
    const reasonList = Array.isArray(reasons) ? reasons : (reason != null ? [reason] : []);
    out.careLevel = careLevelFromReasons(reasonList);
    out.rigor = panelRigorFromReasons(reasonList);
  }

  if (round != null) {
    const args = { verdict: out.verdict, round: Number(round), roundCap };
    out.outcome = phase === 'plan' ? derivePlanOutcome(args) : deriveNegotiationOutcome(args);
  }

  return out;
}

/**
 * Build the mandate text for one review role, dispatching on `kind` (the pure half of the `mandate`
 * subcommand). Pure — the lib builders it calls are pure; this only routes to the right one. `lens` mandates
 * seed a panel reviewer or the independent validator; `editor` seeds the negotiation-round editor.
 * @param {{kind: 'lens'|'editor'|'validator', lens?: string, findings?: Array<object>, round?: number,
 *   roundCap?: number}} o
 * @returns {string}
 */
export function buildMandateText({ kind, lens, findings, round, roundCap } = {}) {
  switch (kind) {
    case 'lens':
      return buildPanelMandate({ lens });
    case 'validator':
      return buildValidatorMandate({ lens });
    case 'editor':
      return buildEditorMandate({ findings, round: round != null ? Number(round) : undefined, roundCap });
    default:
      throw new Error(`buildMandateText: unknown mandate kind "${kind}" — must be one of lens, editor, validator`);
  }
}

/**
 * Build the full PR-comment markdown from a panel's structured result (the pure half of the `comment`
 * subcommand, #2432). Pure — no I/O, no dates. `verdict` and `disposition` are used as supplied; when either is
 * absent it is DERIVED from the same core fns `reduceReview` uses (so a raw findings dump renders a complete
 * comment): `verdict` from `deriveVerdict({findings, humanRequired})`, and `disposition` from
 * `deriveReviewDisposition` ONLY when a `reason`/`reasons` escalation set is supplied (there is no disposition
 * without one — it is left absent and the comment simply omits that line). Delegates the markdown to the pure
 * `renderPanelComment` (`./lib/review-render.mjs`).
 * @param {{findings?: Array<object>, verdict?: string, disposition?: object|string, humanRequired?: boolean,
 *   reason?: string, reasons?: string[], lensVerdicts?: Object<string,string>, mandatoryLenses?: string[],
 *   lenses?: string[], heading?: string}} [input]
 * @returns {string} the markdown PR-comment body.
 */
export function buildComment(input = {}) {
  const {
    findings,
    verdict,
    disposition,
    humanRequired = false,
    reason,
    reasons,
    lensVerdicts,
    mandatoryLenses,
    lenses,
    heading,
  } = input || {};

  const normalized = normalizeFindings(findings);
  const resolvedVerdict = verdict != null && verdict !== ''
    ? verdict
    : deriveVerdict({ findings: normalized, humanRequired });

  let resolvedDisposition = disposition;
  if (resolvedDisposition == null) {
    const hasReasons = reason != null || (Array.isArray(reasons) && reasons.length > 0);
    if (hasReasons) resolvedDisposition = deriveReviewDisposition({ reason, reasons });
  }

  return renderPanelComment({
    findings: normalized,
    verdict: resolvedVerdict,
    disposition: resolvedDisposition,
    lensVerdicts,
    mandatoryLenses,
    lenses,
    heading,
  });
}

// ── thin impure CLI ───────────────────────────────────────────────────────────────────────────────────
const IS_CLI = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (IS_CLI) main(process.argv.slice(2));

/** Read the JSON input for a subcommand — from `--file=<path>` or, absent that, piped stdin. Returns `null`
 *  when neither is present (a TTY with no pipe is treated as "no input", never a hang). */
function readJsonInput(flags) {
  if (typeof flags.file === 'string') return JSON.parse(readFileSync(flags.file, 'utf8'));
  if (!process.stdin.isTTY) {
    const raw = readFileSync(0, 'utf8').trim();
    if (raw) return JSON.parse(raw);
  }
  return null;
}

function fail(msg, code) {
  process.stdout.write(`${JSON.stringify({ error: msg })}\n`);
  process.exit(code);
}

function main(argv) {
  const subcommand = argv[0];
  const flags = parseFlags(argv.slice(1));
  const asJson = !!flags.json;

  if (subcommand === 'reduce') return runReduce(flags, asJson);
  if (subcommand === 'mandate') return runMandate(flags, asJson);
  if (subcommand === 'comment') return runComment(flags, asJson);
  if (subcommand === 'rigor') return runRigor(flags, asJson);
  return fail(
    'usage: review-core-cli.mjs <reduce|mandate|comment|rigor> [flags] — see the header for options',
    2,
  );
}

function runReduce(flags, asJson) {
  let json;
  try {
    json = readJsonInput(flags);
  } catch (e) {
    return fail(`could not read/parse findings JSON: ${String(e && e.message || e)}`, 2);
  }
  if (json == null) return fail('reduce: no input — pass --file=<path> or pipe JSON on stdin', 2);

  // Flag overrides on top of the JSON option bag (round/phase/reasons are often ergonomic to pass as flags).
  const input = { ...json };
  if (flags.round != null) input.round = Number(flags.round);
  if (flags.roundCap != null) input.roundCap = Number(flags.roundCap);
  if (typeof flags.phase === 'string') input.phase = flags.phase;
  if (typeof flags.reason === 'string') input.reason = flags.reason;
  if (typeof flags.reasons === 'string') input.reasons = flags.reasons.split(',').map((s) => s.trim()).filter(Boolean);

  let result;
  try {
    result = reduceReview(input);
  } catch (e) {
    return fail(String(e && e.message || e), 1);
  }

  if (asJson) {
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return process.exit(0);
  }

  const summary = [`verdict: ${result.verdict}`];
  if (result.disposition) summary.push(`disposition: ${result.disposition.mode} (autoLand=${result.disposition.autoLand})`);
  if (result.outcome) summary.push(`outcome: ${result.outcome}`);
  summary.push(`findings: ${result.findingsCount}`);
  const lines = [summary.join('   ')];
  if (result.verdictTable) lines.push('', result.verdictTable);
  process.stdout.write(`${lines.join('\n')}\n`);
  return process.exit(0);
}

function runComment(flags, asJson) {
  let json;
  try {
    json = readJsonInput(flags);
  } catch (e) {
    return fail(`could not read/parse result JSON: ${String(e && e.message || e)}`, 2);
  }
  if (json == null) return fail('comment: no input — pass --file=<path> or pipe JSON on stdin', 2);

  // Flag overrides on top of the JSON option bag (reason/reasons mirror `reduce`, for the derived disposition).
  const input = { ...json };
  if (typeof flags.reason === 'string') input.reason = flags.reason;
  if (typeof flags.reasons === 'string') input.reasons = flags.reasons.split(',').map((s) => s.trim()).filter(Boolean);
  if (typeof flags.heading === 'string') input.heading = flags.heading;

  let markdown;
  try {
    markdown = buildComment(input);
  } catch (e) {
    return fail(String(e && e.message || e), 1);
  }

  if (asJson) {
    process.stdout.write(`${JSON.stringify({ markdown })}\n`);
    return process.exit(0);
  }
  process.stdout.write(`${markdown}\n`);
  return process.exit(0);
}

/**
 * #2567 — the `rigor` subcommand: given the escalation reasons, print the advisory care-level and the panel rigor
 * it dials (rounds / lenses / jurorsPerLens / aggregation). The review-parked-prs workflow (and the future
 * scheduled runner) call this BEFORE fanning out the panel — they hold the parked PR's reasons but no findings
 * yet, so they cannot use `reduce`. Reasons come from `--reasons` (comma-separated) or `--reason`, or a JSON
 * `{reasons}` / `{reason}` on --file/stdin. Never throws on an unknown reason (the dial is lenient/advisory).
 */
function runRigor(flags, asJson) {
  let reasons = [];
  if (typeof flags.reasons === 'string') reasons = flags.reasons.split(',').map((s) => s.trim()).filter(Boolean);
  else if (typeof flags.reason === 'string') reasons = [flags.reason];
  else {
    let json = null;
    try { json = readJsonInput(flags); } catch { json = null; }
    if (json && Array.isArray(json.reasons)) reasons = json.reasons;
    else if (json && typeof json.reason === 'string') reasons = [json.reason];
    else if (Array.isArray(json)) reasons = json;
  }

  const careLevel = careLevelFromReasons(reasons);
  const rigor = panelRigorFromReasons(reasons);

  if (asJson) {
    process.stdout.write(`${JSON.stringify({ careLevel, rigor })}\n`);
    return process.exit(0);
  }
  process.stdout.write(
    `care-level: ${careLevel}   rounds: ${rigor.rounds}   jurorsPerLens: ${rigor.jurorsPerLens}   `
    + `lenses: ${rigor.lenses.join(', ') || '(none)'}   aggregation: ${rigor.aggregation}\n`,
  );
  return process.exit(0);
}

function runMandate(flags, asJson) {
  const kind = flags.validator ? 'validator' : flags.editor ? 'editor' : flags.lens ? 'lens' : null;
  if (!kind) {
    return fail('mandate: pass --lens=<lens> (reviewer), --validator --lens=<lens>, or --editor', 2);
  }

  let findings;
  if (kind === 'editor') {
    let json;
    try {
      json = readJsonInput(flags);
    } catch (e) {
      return fail(`could not read/parse findings JSON: ${String(e && e.message || e)}`, 2);
    }
    // The editor mandate reads the reviewer's findings — an array, or an object carrying `{findings}`.
    findings = Array.isArray(json) ? json : (json && Array.isArray(json.findings) ? json.findings : []);
  }

  let text;
  try {
    text = buildMandateText({
      kind,
      lens: typeof flags.lens === 'string' ? flags.lens : undefined,
      findings,
      round: flags.round,
      roundCap: flags.roundCap != null ? Number(flags.roundCap) : undefined,
    });
  } catch (e) {
    return fail(String(e && e.message || e), 1);
  }

  if (asJson) {
    process.stdout.write(`${JSON.stringify({ kind, lens: typeof flags.lens === 'string' ? flags.lens : null, mandate: text })}\n`);
    return process.exit(0);
  }
  process.stdout.write(`${text}\n`);
  return process.exit(0);
}
