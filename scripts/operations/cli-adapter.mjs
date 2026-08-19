/**
 * @file scripts/operations/cli-adapter.mjs
 * @description THE COMMAND-LINE ADAPTER, DERIVED FROM A DECLARATION (#3035, under epic #3029).
 *
 * ONE DECLARATION, DERIVED CALLERS — this is the first derived caller. Per the statute
 * [#operations-declared-once-callers-generated](../../docs/agent/platform-decisions.md#operations-declared-once-callers-generated)
 * clause 1, *"a hand-written route or argv parser for an operation that could be declared is a defect, not a
 * style choice"*. So NOTHING in this file knows about reviewing a PR. It knows about **declarations**: it
 * derives the flag list, the usage text and the input validation from `declaration.input`, and it drives the
 * run loop over `declaration.steps`. Declaring a second operation buys its command line for free; #3036 does
 * the same thing for HTTP over the same declaration.
 *
 * WHAT "DERIVED" MEANS HERE, PRECISELY: no code generation, no build step. The caller is derived at RUN time
 * from the frozen declaration — which is strictly stronger than generated source, because generated source can
 * drift from its input and this cannot.
 *
 * ── THE FOUR SUSPENDS, AND WHO RESOLVES EACH ────────────────────────────────────────────────────────────────
 *
 *   | status             | this adapter                                                                        |
 *   |--------------------|-------------------------------------------------------------------------------------|
 *   | `running`          | `advance` again — no io                                                             |
 *   | `awaiting-judge`   | spawns ONE tool-free juror (`judgeSpawn`, #3028), resumes with its answer + its cost |
 *   | `awaiting-confirm` | **STOPS AND EXITS.** The question is printed; the run id is printed. Nothing else.   |
 *   | `awaiting-effect`  | applies the declared effects through the executor, then `advance` again              |
 *
 * THE CONFIRM STOP IS THE POINT. `we:skills-src/review/SKILL.md` used to carry it as prose — *"This is a stop
 * point … Do not auto-proceed"* — a rule the model had to hold. Here it is arithmetic: an `--answer` is REFUSED
 * unless it arrives on a `--resume=<id>` of a run that is actually suspended at a `confirm` step. **You cannot
 * answer a question that has not been asked**, and no amount of eagerness in the caller changes that.
 *
 * IDEMPOTENT REPLAY REPLACES "RE-RUN THE SAME COMMAND". A `--resume` on a run whose effects half-landed
 * re-enters the executor, which skips every `applied` entry and refuses to guess at an indeterminate
 * non-idempotent one. The skill's *"a non-zero exit means re-run the same command; it is safe"* stops being a
 * promise and becomes the mechanism.
 *
 * IMPURE: it spawns jurors, applies effects and writes run records — through INJECTED handles, so the whole
 * loop is testable with no subprocess at all. The PURE halves (`buildCliSpec`, `parseOperationArgv`) touch
 * nothing.
 */

import { advance, runStatus, startRun } from './engine.mjs';
import { applyPendingEffects, inFlightEntries } from './effect-executor.mjs';
import { totalJudgeSpend } from './run-record.mjs';
import { isReadOnlyOperation, validateInput } from './registry.mjs';
import { assertNoForbiddenArgv, EFFORT_LEVELS, judgeSpawn } from '../lib/judge-spawn.mjs';

/** Flags the adapter owns. A declaration may not name an input field that collides with one. */
export const CONTROL_FLAGS = Object.freeze(['help', 'json', 'resume', 'answer', 'run-id', 'cwd', 'model']);

/**
 * The control flags that mean something ONLY to a declaration with a `judge` step — the JUROR flags.
 *
 * THE GAP THEY CLOSE (#3151). `--cwd` is the juror's own lane, and a TOOL-BEARING juror cannot spawn without
 * one: `assertLaneCwd` (`we:scripts/lib/judge-spawn.mjs`) REFUSES the spawn rather than inheriting the driver's
 * directory, which is the isolation property, not a bug. But until this flag existed the only way to supply
 * that lane was `JUDGE_LANE_CWD` in the environment — a side channel no `--help` output mentioned, which
 * dispatch prompts threaded by hand and which at least three independent reviewers on 2026-08-17 each
 * rediscovered by reading those prompts instead of the tool. Every one of them fell back to a fully manual
 * review. A derived caller that silently requires an undocumented env var is precisely the hand-wiring gap
 * epic #3029 exists to eliminate, so the lane is now a FLAG: derived, documented in the usage text the
 * declaration generates, and validated before a run record exists.
 *
 * `--model` is the same divergence one field over: a dispatch prompt written with `--model=sonnet` failed
 * outright, because the juror's model was reachable from nowhere on the command line. It is a CONTROL flag and
 * deliberately NOT an input field — which is what keeps #3028's property exactly as strong as it was. Nothing
 * in the run's INPUT can reach the juror's argv (see `JUDGE_MODEL` in `we:scripts/operations/review-pr.mjs`);
 * an operator override arrives on a different path and is checked by {@link assertSafeJudgeRequest}, the same
 * guard every declaration-built request passes, before it can become a flag position.
 *
 * ADVERTISED AND ACCEPTED ONLY WHERE A JUROR EXISTS ({@link declaresJudgeStep}) — derived from the step kinds
 * exactly as the resume line already is. An operation whose every step is `compute` has no juror to point at a
 * lane and no model to pick, so accepting the flag there would be a silent no-op: the same "the flag did
 * nothing and nothing said so" failure this card is about, in the opposite direction.
 *
 * THE NAME IS `--cwd`, DELIBERATELY, AND #3137 MUST NOT REUSE IT. `--cwd` is the spelling the reviewers who hit
 * the refusal reached for from memory, and the card asked for it by name, so it is the one that closes the
 * discovery loop. But it is a GENERIC name for a JUROR-ONLY meaning, and the open #3137 wants a second cwd —
 * one for the `read` step, so a cross-repo review stops silently degrading to an empty diff. That flag must be
 * named for what it points at (`--read-cwd` / `--subject-cwd`), never as a rename or a widening of this one:
 * the two mean different directories and conflating them would hand a juror the repo under review. The help
 * text says which this is, in the negative, for the operator who types it from memory anyway.
 *
 * WHAT MAKES THE SHARED SPELLING SAFE, rather than merely documented: the two are RUNTIME-DISTINGUISHABLE in
 * opposite directions. `assertLaneCwd` → `laneRootOf` refuses any path that is not `<ws>/.lanes/<pool>/lane-N`,
 * so an operator who points THIS flag at a clone of the repo under review gets an explicit "not a lane clone"
 * refusal — never a silent pass on the wrong tree. #3137's flag will have the mirror-image requirement (a real
 * checkout, which is not a lane). A misdirected value therefore fails loudly on either side, which is why the
 * ambiguity stays a documentation matter and not a correctness one (PR review r2 withdrew the rename on this).
 */
export const JUROR_FLAGS = Object.freeze(['cwd', 'model']);

/**
 * The control flags that only mean something to a declaration that can SUSPEND — a run that cannot stop cannot
 * be resumed, and has no question to answer. Listed for the same reason {@link JUROR_FLAGS} is: the
 * unknown-flag message must name the flags that actually apply here, and no others.
 */
export const RESUME_FLAGS = Object.freeze(['resume', 'answer', 'run-id']);

/** Does this declaration declare a `judge` step? PURE — reads the step KINDS, never the operation's name. */
export function declaresJudgeStep(declaration) {
  return (declaration?.steps ?? []).some((s) => s?.step?.kind === 'judge');
}

/**
 * What `--help` says about the juror flags, for a declaration that has a `judge` step.
 *
 * IT NAMES THE REFUSAL IT PREVENTS, verbatim enough to be searchable: an operator who has already hit
 * `refusing to spawn a TOOL-BEARING juror` must be able to find the answer by running `--help` and matching the
 * words. That round trip — error text to flag — is the whole fix; a help line that only said "the juror's
 * working directory" would have left every reviewer exactly where #3151 found them.
 */
export const JUROR_FLAG_HELP = Object.freeze([
  'juror flags (this operation has a `judge` step):',
  '  --cwd=<lane>      the lane clone the juror runs in. REQUIRED when the declaration asks for a TOOL-BEARING',
  '                    juror, which refuses to spawn without one ("refusing to spawn a TOOL-BEARING juror —',
  '                    no `cwd` was supplied"). It must be a lane clone of its OWN — not the primary checkout,',
  '                    and not the lane you are driving from; acquire one with `scripts/lane-pool.mjs acquire`.',
  '                    Falls back to $JUDGE_LANE_CWD when the flag is omitted.',
  '                    NOT the checkout the subject is read FROM: the `read` step still runs against this',
  '                    repo, so pointing this at a clone of another repo does not make a cross-repo review',
  '                    work (that gap is its own open item, #3137). This flag only says where the juror runs.',
  '  --model=<alias>   override the juror model the declaration asks for (e.g. `sonnet`, `opus`). Omit to use',
  '                    the declared one. This is a control flag, not run input: it is never recorded as input',
  '                    and never reaches the mandate.',
]);

/**
 * DERIVE the command line from a declaration. PURE.
 * @param {object} declaration
 * @returns {{name: string, fields: Array<object>, usage: string}}
 */
export function buildCliSpec(declaration) {
  const fields = Object.entries(declaration.input).map(([name, spec]) => ({
    name, type: spec.type, required: spec.required, default: spec.default, enum: spec.enum ?? null,
  }));
  const collision = fields.find((f) => CONTROL_FLAGS.includes(f.name));
  if (collision) {
    throw new Error(
      `operations: \`${declaration.name}\` declares an input field \`${collision.name}\` that collides with the `
      + `adapter's own control flag — rename it (control flags: ${CONTROL_FLAGS.join(', ')}).`,
    );
  }
  // A field with a declared value set PRINTS THE SET, not its type: `--lens=<string>` tells the operator
  // nothing they can act on, and the four valid lenses were already declared — the help just never read them.
  // The default is shown alongside, so "what happens if I omit it" is answered in the same line.
  const placeholder = (f) => (f.enum ? f.enum.map(String).join('|') : `<${f.type}>`);
  const flagText = fields
    .map((f) => (f.required
      ? `--${f.name}=${placeholder(f)}`
      : `[--${f.name}=${placeholder(f)}${f.default !== undefined ? `, default ${f.default}` : ''}]`))
    .join(' ');
  const steps = declaration.steps.map((s) => `${s.name}(${s.step.kind})`).join(' → ');
  // THE RESUME LINE IS DERIVED TOO. A declaration whose every step is `compute` can never suspend, so there is
  // no run to resume and no question to answer — printing the line anyway documents a flag combination the
  // adapter would refuse. `isReadOnlyOperation` reads the step kinds; nothing here knows which operation it is.
  const resumable = !isReadOnlyOperation(declaration);
  // THE JUROR FLAGS ARE DERIVED THE SAME WAY (#3151). A declaration with no `judge` step has no juror, so
  // printing `--cwd` for it would document a flag the adapter refuses; a declaration WITH one requires the lane
  // whenever its request is tool-bearing, and that requirement was previously stated NOWHERE in this output —
  // the whole defect. `judged` decides both the usage line and `parseOperationArgv`'s refusal, from one fact.
  const judged = declaresJudgeStep(declaration);
  return {
    name: declaration.name,
    fields,
    usage: [
      `usage: run.mjs ${declaration.name} ${flagText} [--json]${judged ? ' [--cwd=<lane>] [--model=<alias>]' : ''}`,
      ...(resumable ? [`       run.mjs ${declaration.name} --resume=<run-id> [--answer=<option>] [--json]${judged ? ' [--cwd=<lane>] [--model=<alias>]' : ''}`] : []),
      '',
      `steps: ${steps}`,
      ...(judged ? ['', ...JUROR_FLAG_HELP] : []),
      ...(resumable ? [] : ['', 'read-only: every step is `compute` — this operation completes in one call, suspends at nothing and records no run.']),
    ].join('\n'),
  };
}

/**
 * Coerce one string token to a declared input type. Returns `undefined` when it does not fit.
 *
 * EXPORTED because a query parameter and a `--flag=value` are the same problem — a string that has to become
 * a declared type — and #3036's HTTP adapter must not grow a second answer to it. The `undefined` sentinel
 * (rather than a thrown error) is what lets each caller name the offending token in its own transport's
 * spelling while the coercion itself stays one implementation.
 */
export function coerceInputValue(type, raw) {
  if (type === 'string') return raw;
  if (type === 'number') { const n = Number(raw); return Number.isFinite(n) ? n : undefined; }
  if (type === 'boolean') {
    if (raw === '' || raw === 'true' || raw === '1') return true;
    if (raw === 'false' || raw === '0') return false;
    return undefined;
  }
  try { const v = JSON.parse(raw); return (type === 'array') === Array.isArray(v) && typeof v === 'object' ? v : undefined; }
  catch { return undefined; }
}

/**
 * PARSE argv against a declaration. PURE — no process, no env. Unknown flags are REFUSED (the declaration is
 * the whole surface, and `validateInput` already fails closed in both directions; this makes the message
 * arrive before a run exists).
 *
 * @param {object} declaration
 * @param {string[]} argv
 * @returns {{ok: boolean, input: object, control: object, errors: string[]}}
 */
export function parseOperationArgv(declaration, argv = []) {
  const spec = buildCliSpec(declaration);
  const known = new Set(spec.fields.map((f) => f.name));
  const judged = declaresJudgeStep(declaration);
  const errors = [];
  const raw = {};
  const control = { help: false, json: false, resume: '', answer: null, runId: '', cwd: '', model: '' };

  for (const token of argv) {
    if (!token.startsWith('--')) { errors.push(`unexpected positional argument ${JSON.stringify(token)} — every input is a --flag`); continue; }
    const eq = token.indexOf('=');
    const name = eq === -1 ? token.slice(2) : token.slice(2, eq);
    const value = eq === -1 ? '' : token.slice(eq + 1);
    if (name === 'help') { control.help = true; continue; }
    if (name === 'json') { control.json = true; continue; }
    if (name === 'resume') { control.resume = value; continue; }
    if (name === 'answer') { control.answer = value; continue; }
    if (name === 'run-id') { control.runId = value; continue; }
    // ── THE JUROR FLAGS (#3151) ────────────────────────────────────────────────────────────────────────────
    // Refused where there is no juror, because a flag that silently does nothing is the failure this card is
    // about; an empty value is refused here rather than downstream, where `assertLaneCwd`'s "no `cwd` was
    // supplied" would name a cause the operator can see they DID supply.
    if (JUROR_FLAGS.includes(name)) {
      if (!judged) {
        errors.push(
          `--${name} needs a \`judge\` step, and \`${declaration.name}\` declares none `
          + `(${declaration.steps.map((s) => s.step.kind).join(' → ')}) — there is no juror to `
          + `${name === 'cwd' ? 'point at a lane' : 'pick a model for'}.`,
        );
        continue;
      }
      // GIVEN TWICE IS A REFUSAL, not last-wins (PR review, finding G). Every other flag here silently takes
      // the last spelling, which is a fine default for a value that only shapes output — but `--cwd` decides
      // WHERE A TOOL-BEARING AGENT MAY WRITE, and a shell loop or a copy-paste that emits it twice should not
      // resolve that quietly in favour of whichever came last.
      if (control[name]) { errors.push(`--${name} was given more than once — pass it once, or the wrong one wins silently`); continue; }
      if (!value.trim()) { errors.push(`--${name} must not be empty — pass a value or omit the flag`); continue; }
      // A VALUE SHAPED LIKE A FLAG IS REFUSED BEFORE IT IS A VALUE (#3028's footgun, at the parse seam). The
      // juror's argv builder guards this too, but a refusal that arrives before a run record exists names the
      // TOKEN the operator typed instead of a request the adapter assembled.
      if (value.trim().startsWith('-')) {
        errors.push(`--${name}=${JSON.stringify(value)} looks like a flag, not a value — refusing it before it reaches the juror's argv (#3028)`);
        continue;
      }
      control[name] = value.trim();
      continue;
    }
    if (!known.has(name)) {
      // THE ACCEPTED LIST NAMES THE CONTROL FLAGS TOO. Listing only the declared inputs is what made
      // `unknown flag --cwd` a dead end: the message enumerated five fields, none of which was the answer, so a
      // reader concluded the operation could not take one. The list is the whole surface or it is a trap.
      // EVERY HALF OF THIS LIST IS DERIVED, not just the juror half. Naming `--resume`/`--answer`/`--run-id` on
      // a `compute`-only operation would advertise flags the usage text three lines below says cannot apply —
      // the same "listed as accepted, refused in practice" trap the juror flags are filtered for.
      const resumable = !isReadOnlyOperation(declaration);
      const accepted = [...known, ...CONTROL_FLAGS.filter((f) => {
        if (JUROR_FLAGS.includes(f)) return judged;
        if (RESUME_FLAGS.includes(f)) return resumable;
        return true;
      })];
      errors.push(`unknown flag --${name} — \`${declaration.name}\` accepts ${accepted.map((k) => `--${k}`).join(', ')}`);
      continue;
    }
    const field = spec.fields.find((f) => f.name === name);
    const coerced = coerceInputValue(field.type, value);
    if (coerced === undefined) { errors.push(`--${name} must be a ${field.type}, got ${JSON.stringify(value)}`); continue; }
    raw[name] = coerced;
  }

  // A resume carries no input — the run record already holds it. Passing both is a confusion worth refusing.
  if (control.resume && Object.keys(raw).length) {
    errors.push('a --resume carries no input: the run record already holds it. Drop the input flags.');
  }
  // THE STOP-POINT PROPERTY. You cannot answer a question that has not been asked.
  if (control.answer != null && !control.resume) {
    errors.push(
      '--answer requires --resume=<run-id>. The confirm step is a SUSPEND: the operation asks, exits, and is '
      + 'resumed with the decision in a second invocation. There is no way to pre-answer it.',
    );
  }
  if (!control.resume) {
    const validated = validateInput(declaration.input, raw);
    errors.push(...validated.errors);
    return { ok: errors.length === 0, input: validated.value, control, errors };
  }
  return { ok: errors.length === 0, input: {}, control, errors };
}

/**
 * REFUSE a judge request whose option values could reach a flag position in the juror's argv.
 *
 * #3028's recorded footgun, one layer out: an option *value* shaped like a flag (`model: '--bare'`) reaches
 * `buildJudgeArgv` and lands in argv as a flag. `assertNoForbiddenArgv` catches the one banned spelling; this
 * catches the CLASS, before the spawn, for every declaration — because a declaration is allowed to build its
 * request from run input and an adapter must not assume it validated it.
 *
 * @param {object} request
 */
export function assertSafeJudgeRequest(request) {
  for (const key of ['model', 'effort']) {
    const value = request?.[key];
    if (value === undefined) continue;
    if (typeof value !== 'string' || !value.trim() || value.trim().startsWith('-')) {
      throw new Error(
        `operations: refusing to spawn a juror with \`${key}\`=${JSON.stringify(value)} — an option value shaped `
        + 'like a flag reaches the juror\'s argv as a flag (#3028). Declarations must not build judge requests '
        + 'from unvalidated input.',
      );
    }
  }
  if (request?.effort !== undefined && !EFFORT_LEVELS.includes(request.effort)) {
    throw new Error(`operations: \`effort\` must be one of ${EFFORT_LEVELS.join('|')}, got ${JSON.stringify(request.effort)}`);
  }
  // `null` is the DECLARED "no ceiling", and it has to be spelled out HERE as well as in `judgeSpawn`. This
  // guard runs on the request BEFORE the spawn, in a file the budget change never touched, so a `budget: null`
  // that `judgeSpawn` accepts still threw right here — before a juror existed. "Remove the ceiling" would have
  // shipped as "no review runs at all". Two validations of one field is fine; two DIFFERENT rules for it is the
  // defect (review-pr correctness juror on #1472: CONFIRMED, `impactIfUnfixed: broken`, a blocker because
  // nothing downstream could recover from it).
  if (request?.budget !== undefined && request?.budget !== null
      && (typeof request.budget !== 'number' || !Number.isFinite(request.budget) || request.budget <= 0)) {
    throw new Error(`operations: \`budget\` must be a positive finite number of USD, or null for no ceiling, got ${JSON.stringify(request.budget)}`);
  }
  // A tool name reaches argv as a bare token, so the same flag-shaped-value hazard applies one field over.
  if (request?.allowedTools !== undefined) {
    if (!Array.isArray(request.allowedTools) || request.allowedTools.length === 0) {
      throw new Error('operations: `allowedTools` must be a non-empty array when present — omit it for a tool-free juror');
    }
    for (const t of request.allowedTools) {
      if (typeof t !== 'string' || !/^[A-Za-z][A-Za-z0-9_]*$/.test(t)) {
        throw new Error(`operations: refusing a juror tool name ${JSON.stringify(t)} — a non-identifier reaches argv as a flag`);
      }
    }
  }
  assertNoForbiddenArgv([request?.model, request?.effort, ...(request?.allowedTools ?? [])].filter((t) => typeof t === 'string'));
}

/**
 * THE BRAND on a judge return that carries telemetry alongside the answer.
 *
 * A judge is injected (`driveRun({ judge })`) and the ordinary implementation returns the juror's answer
 * directly — every test in the suite does. So the adapter has to tell "this IS the answer" from "this WRAPS
 * the answer", and sniffing for a `value` key would misread any future juror shape that happens to have one.
 * A registered symbol cannot appear in JSON a juror produced, so the test is exact rather than probable.
 * `Symbol.for` (not a bare `Symbol`) so two copies of this module in one process still agree.
 */
const JUDGE_OUTCOME = Symbol.for('we.operations.judgeOutcome');

/**
 * Wrap a juror answer with the SPAWN's telemetry, for a judge that has it. `driveRun` unwraps.
 * @param {*} value - the juror's answer, exactly as it would be returned bare.
 * @param {object|null} [telemetry] - `judgeSpawn`'s metered fields (see `normalizeJudgeTelemetry`).
 */
export function judgeOutcome(value, telemetry = null) {
  return { [JUDGE_OUTCOME]: true, value, telemetry };
}

/** Split a judge's return into `{ value, telemetry }`. A bare answer is the answer, with no telemetry. */
export function unwrapJudgeOutcome(returned) {
  return (returned && typeof returned === 'object' && returned[JUDGE_OUTCOME] === true)
    ? { value: returned.value, telemetry: returned.telemetry ?? null }
    : { value: returned, telemetry: null };
}

/**
 * The default judge: ONE tool-free juror per `judge` step, guarded by {@link assertSafeJudgeRequest}.
 *
 * IT RETURNS WHAT THE SPAWN COST, not only what the juror said. `judgeSpawn` reports `costUsd`, `sessionId`,
 * `usage`, `durationMs` and `wallMs`; the first cut returned `outcome.value` alone, so after #3035's first live
 * run against PR #1146 "what did that juror cost?" had no answer anywhere — the numbers existed for the length
 * of one expression and were dropped. The juror also runs `--no-session-persistence` (a #3028 isolation
 * property, deliberately unchanged here), so there is no transcript to reconstruct them from either. They ride
 * back through {@link judgeOutcome} onto the run record, which is where a completed run and `--json` read them.
 *
 * @param {object} [o]
 * @param {Function} [o.spawn] - the spawner, injected for tests.
 * @param {string|null} [o.cwd] - the lane the juror runs in. Passed only when set, so a tool-free juror is
 *   unaffected and a tool-bearing one hits `assertLaneCwd`'s refusal when nobody supplied a lane (#3151).
 * @param {string|null} [o.model] - an operator override for the model the DECLARATION asked for. Absent by
 *   default: the declared literal is the norm, and an override is a deliberate command-line act.
 */
export function createDefaultJudge({ spawn = judgeSpawn, cwd, model } = {}) {
  return async (request) => {
    // THE OVERRIDE IS MERGED BEFORE THE GUARD RUNS, NEVER AFTER (#3151). `assertSafeJudgeRequest` is what stops
    // a flag-shaped `model` reaching argv, so asserting the declaration's request and then substituting the
    // operator's value would check one string and spawn another — the guard would be decorative. The CLI
    // adapter's parse refuses a `-`-leading value too; this is the seam that binds every caller of this
    // factory, including one that builds it by hand.
    const effective = model ? { ...request, model } : request;
    assertSafeJudgeRequest(effective);
    const outcome = await spawn({
      mandate: effective.mandate,
      input: effective.input,
      shape: effective.shape,
      model: effective.model,
      effort: effective.effort,
      budget: effective.budget,
      runId: effective.runId,
      lens: effective.lens,
      ...(effective.allowedTools ? { allowedTools: effective.allowedTools } : {}),
      ...(cwd ? { cwd } : {}),
    });
    // NOT a spread of `outcome`: it also carries `argv` (which embeds the whole mandate) and the answer itself.
    // The record keeps the meter, never the material. `normalizeJudgeTelemetry` whitelists again on arrival.
    return judgeOutcome(outcome.value, {
      costUsd: outcome.costUsd,
      durationMs: outcome.durationMs,
      wallMs: outcome.wallMs,
      numTurns: outcome.numTurns,
      stopReason: outcome.stopReason,
      sessionId: outcome.sessionId,
      loadedContextTokens: outcome.loadedContextTokens,
      usage: outcome.usage,
      // WHICH MODEL JUDGED, not only what it cost (#3151). Nothing filled this slot before — merely incomplete
      // while the model was a declared LITERAL, since the declaration answered "which model" for anyone who
      // read it. `--model` makes it operator-controllable, and a verdict recorded without the model that
      // produced it is a record that implies the declared one. `effective`, so an override is what gets
      // recorded rather than what was asked for. ONLY the model: the engine takes `lens` and `effort` from the
      // suspended request and would ignore them here, and reporting a value that is silently discarded reads
      // as a contract this side does not have.
      model: effective.model,
    });
  };
}

/**
 * The nearest `confirm`-kind step BELOW `stepIndex` that already holds a finding — i.e. an answer a caller
 * already gave, and that `driveRun` is about to re-encounter on a `--resume`. `null` when the refusing step
 * is the first, or nothing below it is a `confirm` with a recorded finding. PURE — reads only the
 * declaration's step list and the run's own findings.
 *
 * @param {object} declaration
 * @param {object} run
 * @param {number} stepIndex - the refusing step's index (`declaration.steps[stepIndex]`).
 * @returns {{step: string, value: *}|null}
 */
function findPriorConfirm(declaration, run, stepIndex) {
  for (let i = stepIndex - 1; i >= 0; i -= 1) {
    const entry = declaration.steps[i];
    if (entry.step.kind === 'confirm' && Object.prototype.hasOwnProperty.call(run.findings ?? {}, entry.name)) {
      return { step: entry.name, value: run.findings[entry.name] };
    }
  }
  return null;
}

/**
 * DRIVE A RUN to its next stop. The whole adapter, in one loop.
 *
 * @param {object} o
 * @param {object} o.run - the run record to drive.
 * @param {object} o.registry
 * @param {{read: Function, write: Function}} o.store
 * @param {Record<string, Function>} o.sinks
 * @param {(request: object) => Promise<object>} o.judge
 * @param {{value: *}|null} [o.resume] - the confirm answer, when one arrived.
 * @param {number} [o.maxTurns]
 * @returns {Promise<{run: object, stopped: string, error: (Error|null), applied: string[], step?: string,
 *   priorConfirm?: ({step: string, value: *}|null), inFlight?: string[]}>}
 *   `stopped` is one of `'complete'`, `'confirm'`, `'stuck'`, `'effect-halted'`, `'effect-in-flight'` or
 *   `'step-refused'` — the last one is a declaration fn (a `compute`, `judge`, `confirm` or `effect` step)
 *   throwing deterministically once its answer is already committed to the record (#3063). `step` and
 *   `priorConfirm` ride only on `step-refused`, because that is the one stop `renderOutcome` cannot describe
 *   from `{run, stopped, error, applied}` alone — see the file header and #3063 for why.
 */
export async function driveRun({ run, registry, store, sinks, judge, resume = null, maxTurns = 64, autoConfirm = null, attemptedBy = 'unknown' } = {}) {
  let current = run;
  let pendingResume = resume;
  const applied = [];

  for (let turn = 0; turn < maxTurns; turn += 1) {
    const status = runStatus(current, { registry });

    if (status === 'complete') return { run: current, stopped: 'complete', error: null, applied };

    if (status === 'awaiting-confirm') {
      // AN UNATTENDED ANSWER, WHEN AND ONLY WHEN THE DECLARATION SAID AN AGENT MAY GIVE ONE. The policy is
      // INJECTED rather than decided here: this adapter must not know which actor names a declaration uses, and
      // a confirm addressed to a HUMAN must keep stopping — that is the whole point of the step.
      //
      // The seam matters more than the convenience. A caller that wants an unattended loop supplies a policy;
      // a caller that does not gets today's behaviour unchanged, because `autoConfirm` defaults to null. The
      // policy returns `null` to decline, which is how it refuses a human-addressed confirm.
      if (pendingResume == null && typeof autoConfirm === 'function') {
        const auto = autoConfirm(current.pending, current);
        if (auto != null) { pendingResume = auto; }
      }
      // THE STOP. With no answer in hand the adapter returns; the caller prints the question and exits.
      if (pendingResume == null) return { run: current, stopped: 'confirm', error: null, applied };
      current = advance(current, { registry, resume: pendingResume });
      pendingResume = null;
      store.write(current);
      continue;
    }

    if (status === 'awaiting-judge') {
      // THE SPAWN, in the caller, between two `advance` calls — the declaration declared it and did not act.
      // Its cost rides back on the resume; `advance` stamps the row with the request's own lens/model/effort.
      const { value, telemetry } = unwrapJudgeOutcome(await judge(current.pending.request));
      current = advance(current, {
        registry,
        resume: { step: current.pending.step, value, ...(telemetry ? { telemetry } : {}) },
      });
      store.write(current);
      continue;
    }

    if (status === 'awaiting-effect') {
      // THREADED FROM THE ENTRY POINT, which is the only thing that knows. `driveRun` itself cannot tell a
      // person from a network client — it has both callers — so it must be told rather than assume.
      const outcome = await applyPendingEffects(current, { sinks, store, attemptedBy });
      current = outcome.run;
      applied.push(...outcome.applied);
      if (outcome.error) return { run: current, stopped: 'effect-halted', error: outcome.error, applied };
      // PARKED ON A DISPATCH (#3073). An in-flight halt is a SUCCESSFUL stop, not an error: the sink started
      // work that outlives this process, so `error` is null and the halt reports itself through `inFlight`.
      // Without this branch the loop falls through to `advance`, which returns the run UNCHANGED (in-flight
      // counts as unapplied, by design), so the driver spins to `maxTurns` and throws a runaway-loop error —
      // the CLI exits 1 and the HTTP adapter 500s on the one operation the epic exists to reach.
      if (outcome.inFlight && outcome.inFlight.length) {
        return { run: current, stopped: 'effect-in-flight', error: null, applied, inFlight: outcome.inFlight };
      }
      current = advance(current, { registry });
      store.write(current);
      continue;
    }

    // running — THE ONE `advance` CALL THAT EXECUTES A DECLARATION FN (#3063). A `compute` fn, a `judge`
    // `request`, a `confirm` `asks`/`of` or an `effect` `effects` can all throw here, deterministically, once
    // an earlier answer is already committed to the record — see the file header. The `try` is drawn around
    // THIS call only: the other three `advance` calls in this loop (`awaiting-confirm` resume, `awaiting-judge`
    // resume, the post-apply `awaiting-effect` resolve) run `resolvePending`, which executes no declaration fn
    // at all — what THEY throw is a caller error (a malformed resume, an answer outside the closed option set),
    // and folding those into `step-refused` would tell an operator who mistyped `--answer` to start a fresh
    // run, re-spawning the juror this story exists to stop paying for twice. Do not widen this catch.
    const declaration = registry.get(current.op);
    const stepIndex = current.cursor;
    let next;
    try {
      next = advance(current, { registry });
    } catch (e) {
      return {
        run: current,
        stopped: 'step-refused',
        error: e,
        applied,
        step: declaration.steps[stepIndex]?.name,
        priorConfirm: findPriorConfirm(declaration, current, stepIndex),
      };
    }
    if (next === current) return { run: current, stopped: 'stuck', error: null, applied };
    current = next;
    store.write(current);
  }

  throw new Error(`operations: run ${current.id} did not settle within ${maxTurns} turns — refusing to loop further.`);
}

/**
 * THE WHOLE COMMAND LINE for one declaration: parse, start-or-resume, drive, render. Returns the exit code and
 * the lines to print rather than writing them, so a test asserts on values instead of scraping stdout.
 *
 * @param {object} o
 * @param {object} o.declaration
 * @param {string[]} o.argv
 * @param {object} o.registry
 * @param {object} o.store
 * @param {Record<string, Function>} o.sinks
 * @param {Function} [o.judge] - a ready-made judge. Used as-is; the juror flags cannot reach it.
 * @param {(o: {cwd: (string|null), model: (string|null)}) => Function} [o.makeJudge] - a judge FACTORY, taking
 *   the parsed juror flags. Preferred over `judge` for a real command line: `--cwd`/`--model` are parsed HERE,
 *   so a caller that pre-builds its judge has no way to honour them (#3151). Falls back to `judge` when absent,
 *   which is why every existing test that injects a canned judge is untouched.
 * @param {() => string} o.newRunId
 * @returns {Promise<{code: number, lines: string[], run: (object|null), stopped: string}>}
 */
export async function runOperationCli({ declaration, argv, registry, store, sinks, judge, makeJudge, newRunId } = {}) {
  const spec = buildCliSpec(declaration);
  const parsed = parseOperationArgv(declaration, argv);

  if (parsed.control.help) return { code: 0, lines: [spec.usage], run: null, stopped: 'help' };
  if (!parsed.ok) {
    return { code: 2, lines: [...parsed.errors.map((e) => `error: ${e}`), '', spec.usage], run: null, stopped: 'refused' };
  }

  // THE JUDGE IS BUILT AFTER THE PARSE, from the flags the parse produced. Building it before (which `run.mjs`
  // used to do) is what made the juror's lane an environment-only input: there was no later seam at which a
  // `--cwd` could have been honoured, so the flag could not have existed (#3151).
  const activeJudge = typeof makeJudge === 'function'
    ? makeJudge({ cwd: parsed.control.cwd || null, model: parsed.control.model || null })
    : judge;

  let run;
  if (parsed.control.resume) {
    run = store.read(parsed.control.resume);
    if (!run) return { code: 2, lines: [`error: no run record for ${JSON.stringify(parsed.control.resume)}`], run: null, stopped: 'refused' };
    if (run.op !== declaration.name) {
      return { code: 2, lines: [`error: run ${run.id} is a \`${run.op}\` run, not \`${declaration.name}\``], run: null, stopped: 'refused' };
    }
  } else {
    run = startRun({ op: declaration.name, id: parsed.control.runId || newRunId(), input: parsed.input, registry });
    store.write(run);
  }

  let resume = null;
  if (parsed.control.answer != null) {
    const status = runStatus(run, { registry });
    if (status !== 'awaiting-confirm') {
      return {
        code: 2,
        lines: [
          `error: run ${run.id} is \`${status}\`, not awaiting a decision — refusing an --answer for a question `
          + 'that has not been asked. Re-run without --answer to drive it to its next stop.',
        ],
        run,
        stopped: 'refused',
      };
    }
    resume = { step: run.pending.step, value: parsed.control.answer };
  }

  // The command line genuinely is a person at a terminal.
  const outcome = await driveRun({ run, registry, store, sinks, judge: activeJudge, resume, attemptedBy: 'human' });
  return { ...renderOutcome({ outcome, json: parsed.control.json }), run: outcome.run, stopped: outcome.stopped };
}

/**
 * WHAT THE RUN'S JURORS COST, as operator-facing lines. PURE; `[]` when the run spawned none (so a stub-judged
 * run and a pre-telemetry record both render exactly as they did before).
 *
 * PRINTED AT EVERY STOP, INCLUDING THE CONFIRM. The confirm suspend is where it matters most: the juror has
 * already run and been paid for, and the operator is about to decide whether to spend more. A cost figure that
 * only appeared on `complete` would arrive after the decision it informs.
 */
export function renderSpendLines(run) {
  const rows = Array.isArray(run?.telemetry) ? run.telemetry : [];
  if (!rows.length) return [];
  const total = totalJudgeSpend(run);
  const per = rows.map((r) => {
    const bits = [
      `$${(r.costUsd ?? 0).toFixed(4)}`,
      `${((r.wallMs ?? r.durationMs ?? 0) / 1000).toFixed(1)}s`,
      r.model ? `model ${r.model}` : '',
      typeof r.loadedContextTokens === 'number' ? `${r.loadedContextTokens} ctx tokens` : '',
      r.sessionId ? `session ${r.sessionId}` : '',
    ].filter(Boolean);
    return `  ${r.step}${r.lens ? ` (${r.lens})` : ''}: ${bits.join(' · ')}`;
  });
  return [
    `judge spend: $${total.costUsd.toFixed(4)} over ${total.jurors} juror(s), ${(total.wallMs / 1000).toFixed(1)}s wall`,
    ...per,
  ];
}

/**
 * THE MACHINE-READABLE OUTCOME of a run, as one object. PURE.
 *
 * EXPORTED because it is the envelope, not the command line's private rendering: `--json` prints exactly this,
 * and #3036's HTTP adapter returns exactly this (plus its own `persisted` flag). One declaration describing an
 * operation and then two callers describing its OUTCOME two different ways would be the same defect one layer
 * down — a console reading the HTTP route and a terminal reading `--json` must not have to parse two shapes.
 *
 * @param {{run: object, stopped: string, error?: (Error|null), applied?: string[], inFlight?: string[]}} outcome
 * @returns {object}
 */
export function outcomePayload({ run, stopped, error = null, applied = [] }) {
  return {
    runId: run.id, op: run.op, stopped, applied,
    // #3073 — WHICH effects are still going, so a consumer does not have to re-scan `run.effects` to find out
    // why a parked run is parked.
    //
    // DERIVED FROM THE RECORD, never passed in (PR #1180 review, finding 1). The first cut took it as a
    // parameter, so `GET …/runs/<id>` — which builds this payload with no drive behind it — reported `[]` for
    // a parked run. On that route `[]` stopped meaning "nothing is in flight", and since the payload carries
    // no `effects` either, there was no way to recover a parked run's handle over HTTP at all. Reading the
    // record answers the same on every route.
    inFlight: run.effects.filter((e) => e.status === 'in-flight').map((e) => e.key),
    pending: run.pending, verdict: run.verdict, findings: run.findings,
    // The meter, and its total pre-summed — a consumer must not have to re-derive "what did this cost".
    telemetry: run.telemetry ?? [], spend: totalJudgeSpend(run),
    ...(error ? { error: String(error.message ?? error) } : {}),
  };
}

/**
 * The command line that starts THIS run again from its own recorded input. PURE.
 *
 * `buildCliSpec` derives every flag straight from `declaration.input`'s keys and refuses one that collides
 * with a control flag (`:59-65`), so `run.input`'s own keys can never render an ambiguous line — field names
 * map 1:1 to flags. Exported so `step-refused`'s restart line is asserted directly, not scraped from prose.
 *
 * @param {object} run
 * @returns {string}
 */
export function restartCommand(run) {
  const flags = Object.entries(run.input ?? {}).map(([key, value]) => `--${key}=${value}`);
  return [`node scripts/operations/run.mjs`, run.op, ...flags].join(' ');
}

/** Turn a `driveRun` outcome into exit code + lines. PURE. */
export function renderOutcome({ outcome, json = false }) {
  const { run, stopped, error, applied } = outcome;
  if (json) {
    return {
      // A dispatch park is a SUCCESSFUL stop, exactly like a confirm suspend — the run did what was asked.
      code: stopped === 'complete' || stopped === 'confirm' || stopped === 'effect-in-flight' ? 0 : 1,
      lines: [JSON.stringify(outcomePayload(outcome), null, 2)],
    };
  }

  const spend = renderSpendLines(run);

  if (stopped === 'confirm') {
    const p = run.pending;
    return {
      code: 0,
      lines: [
        `run ${run.id} — SUSPENDED at \`${p.step}\`, awaiting a decision from: ${p.of}`,
        '',
        // The material the decision is made ON, not just the question — otherwise the caller has to go and
        // fetch it, which is the restating-the-flow the skill is being freed from.
        ...(run.verdict != null ? ['verdict:', JSON.stringify(run.verdict, null, 2), ''] : []),
        ...(spend.length ? [...spend, ''] : []),
        p.asks,
        '',
        ...(p.options ? [`options: ${p.options.join(' | ')}`, ''] : []),
        `resume with: node scripts/operations/run.mjs ${run.op} --resume=${run.id} --answer=<option>`,
      ],
    };
  }
  if (stopped === 'complete') {
    return { code: 0, lines: [`run ${run.id} — complete. ${applied.length} effect(s) applied.`, ...spend] };
  }
  // PARKED, NOT FAILED (#3073). Exit 0 — the run did exactly what it was asked to: it started work that
  // outlives this process, and stopped. Exiting 1 would tell every caller a successful dispatch is an error.
  // The lines name the handle, because that is what an observer polls, and the deadline, because "still
  // running" and "probably dead" need opposite responses.
  if (stopped === 'effect-in-flight') {
    const { running, overdue, unknown } = inFlightEntries(run);
    const describe = (e) => `  ${e.key} (${e.type}) — handle ${e.handle ?? '(none)'}`
      + `${e.expectedBy ? `, expected by ${e.expectedBy}` : ', no deadline'}`;
    return {
      code: 0,
      lines: [
        `run ${run.id} — PARKED at \`${run.pending?.step}\`: work is in flight and its outcome arrives later.`,
        ...(running.length ? ['in flight:', ...running.map(describe)] : []),
        ...(overdue.length ? ['OVERDUE — past its own expectedBy:', ...overdue.map(describe)] : []),
        ...(unknown.length ? ['UNKNOWN — dispatched but no handle, so it cannot be observed:', ...unknown.map(describe)] : []),
        // FROM THE RECORD, not from this drive (PR #1180 review, finding 4). `applied` counts what THIS
        // drive applied, and the re-drive is the path the next line steers the operator onto — so on the
        // drive they actually run, a drive-local count says "0 effect(s) landed" about a record holding one.
        `${run.effects.filter((e) => e.status === 'applied').length} effect(s) have landed and are recorded as applied.`,
        `resume with: node scripts/operations/run.mjs ${run.op} --resume=${run.id} — it reports the same park `
        + 'until the work reports back, and never re-dispatches.',
        ...spend,
      ],
    };
  }
  if (stopped === 'effect-halted') {
    return {
      code: 1,
      lines: [
        `run ${run.id} — HALTED applying \`${run.pending?.step}\`: ${String(error?.message ?? error)}`,
        `${applied.length} effect(s) landed and are recorded as applied; a --resume=${run.id} continues from there `
        + 'and never re-applies them.',
        ...spend,
      ],
    };
  }
  // A DECLARATION FN REFUSED, DETERMINISTICALLY, ONCE ITS INPUT WAS ALREADY COMMITTED (#3063). `outcome.step`
  // names the refusing step — NOT `run.pending?.step`, which is `null` here (the confirm that led here already
  // cleared it). The prior-`confirm` lines are gated on `outcome.priorConfirm`: this stop never claims a
  // decision was made when the refusal is the FIRST step's own doing. The restart line is unconditional —
  // it is the one thing true on every path, deterministic or not.
  if (stopped === 'step-refused') {
    const priorConfirm = outcome.priorConfirm ?? null;
    return {
      code: 1,
      lines: [
        `run ${run.id} — REFUSED at \`${outcome.step}\`: ${String(error?.message ?? error)}`,
        ...(priorConfirm ? [
          `the answer recorded at \`${priorConfirm.step}\` is \`${priorConfirm.value}\`; it is committed, and a `
          + '--resume replays this same step with it.',
          'if this refusal is deterministic the run cannot reach another answer — start a fresh one:',
        ] : []),
        `  ${restartCommand(run)}`,
        ...spend,
      ],
    };
  }
  return { code: 1, lines: [`run ${run.id} — ${stopped}.`, ...spend] };
}
