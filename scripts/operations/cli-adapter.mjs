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
import { applyPendingEffects } from './effect-executor.mjs';
import { totalJudgeSpend } from './run-record.mjs';
import { validateInput } from './registry.mjs';
import { assertNoForbiddenArgv, EFFORT_LEVELS, judgeSpawn } from '../lib/judge-spawn.mjs';

/** Flags the adapter owns. A declaration may not name an input field that collides with one. */
export const CONTROL_FLAGS = Object.freeze(['help', 'json', 'resume', 'answer', 'run-id']);

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
  return {
    name: declaration.name,
    fields,
    usage: [
      `usage: run.mjs ${declaration.name} ${flagText} [--json]`,
      `       run.mjs ${declaration.name} --resume=<run-id> [--answer=<option>] [--json]`,
      '',
      `steps: ${steps}`,
    ].join('\n'),
  };
}

/** Coerce one `--flag=value` token to a declared input type. Returns `undefined` when it does not fit. */
function coerce(type, raw) {
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
  const errors = [];
  const raw = {};
  const control = { help: false, json: false, resume: '', answer: null, runId: '' };

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
    if (!known.has(name)) { errors.push(`unknown flag --${name} — \`${declaration.name}\` accepts ${[...known].map((k) => `--${k}`).join(', ')}`); continue; }
    const field = spec.fields.find((f) => f.name === name);
    const coerced = coerce(field.type, value);
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
  if (request?.budget !== undefined && (typeof request.budget !== 'number' || !Number.isFinite(request.budget) || request.budget <= 0)) {
    throw new Error(`operations: \`budget\` must be a positive finite number of USD, got ${JSON.stringify(request.budget)}`);
  }
  assertNoForbiddenArgv([request?.model, request?.effort].filter((t) => typeof t === 'string'));
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
 */
export function createDefaultJudge({ spawn = judgeSpawn, cwd } = {}) {
  return async (request) => {
    assertSafeJudgeRequest(request);
    const outcome = await spawn({
      mandate: request.mandate,
      input: request.input,
      shape: request.shape,
      model: request.model,
      effort: request.effort,
      budget: request.budget,
      runId: request.runId,
      lens: request.lens,
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
    });
  };
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
 * @returns {Promise<{run: object, stopped: string, error: (Error|null), applied: string[]}>}
 */
export async function driveRun({ run, registry, store, sinks, judge, resume = null, maxTurns = 64 } = {}) {
  let current = run;
  let pendingResume = resume;
  const applied = [];

  for (let turn = 0; turn < maxTurns; turn += 1) {
    const status = runStatus(current, { registry });

    if (status === 'complete') return { run: current, stopped: 'complete', error: null, applied };

    if (status === 'awaiting-confirm') {
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
      const outcome = await applyPendingEffects(current, { sinks, store });
      current = outcome.run;
      applied.push(...outcome.applied);
      if (outcome.error) return { run: current, stopped: 'effect-halted', error: outcome.error, applied };
      current = advance(current, { registry });
      store.write(current);
      continue;
    }

    // running
    const next = advance(current, { registry });
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
 * @param {Function} o.judge
 * @param {() => string} o.newRunId
 * @returns {Promise<{code: number, lines: string[], run: (object|null), stopped: string}>}
 */
export async function runOperationCli({ declaration, argv, registry, store, sinks, judge, newRunId } = {}) {
  const spec = buildCliSpec(declaration);
  const parsed = parseOperationArgv(declaration, argv);

  if (parsed.control.help) return { code: 0, lines: [spec.usage], run: null, stopped: 'help' };
  if (!parsed.ok) {
    return { code: 2, lines: [...parsed.errors.map((e) => `error: ${e}`), '', spec.usage], run: null, stopped: 'refused' };
  }

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

  const outcome = await driveRun({ run, registry, store, sinks, judge, resume });
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

/** Turn a `driveRun` outcome into exit code + lines. PURE. */
export function renderOutcome({ outcome, json = false }) {
  const { run, stopped, error, applied } = outcome;
  if (json) {
    const payload = {
      runId: run.id, op: run.op, stopped, applied,
      pending: run.pending, verdict: run.verdict, findings: run.findings,
      // The meter, and its total pre-summed — a consumer must not have to re-derive "what did this cost".
      telemetry: run.telemetry ?? [], spend: totalJudgeSpend(run),
      ...(error ? { error: String(error.message ?? error) } : {}),
    };
    return { code: stopped === 'complete' || stopped === 'confirm' ? 0 : 1, lines: [JSON.stringify(payload, null, 2)] };
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
  return { code: 1, lines: [`run ${run.id} — ${stopped}.`, ...spend] };
}
