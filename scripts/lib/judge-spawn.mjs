/**
 * judge-spawn.mjs — the tool-free juror spawn behind one function (#3028, under #3029).
 *
 * ONE HELPER EVERY `judge` STEP CALLS. A juror is a `claude -p` subprocess with the findings shape
 * ENFORCED, the repo context STRIPPED, and NO TOOLS GRANTED. The flag recipe was measured in session
 * rather than invented, and this module is where it stops being folklore: no caller re-derives it, and
 * every caller gets the same three guarantees below. `judgeSpawn` returns a validated object or throws
 * carrying THE SPAWN'S OWN error text — never a paraphrase this module made up.
 *
 * VERIFIED AGAINST `claude` 2.1.220 (every flag below appears in `claude --help` at that version; the
 * behavioural claims were each reproduced by a real spawn while this file was written). If a future CLI
 * renames a flag, `buildJudgeArgv`'s unit tests still pass while the integration test fails — that split
 * is deliberate, and the integration test is the canary.
 *
 * THREE THINGS THIS BUYS, ONLY THE FIRST OF WHICH IS TIDINESS.
 *
 *  1. `--tools ""` IS A STRUCTURAL GUARANTEE, NOT A REMINDER. The review mandate's rule that a juror never
 *     checks the branch out in a shared tree (`we:skills-src/review/SKILL.md`, citing #2336) stops being
 *     prose the model has to recall and becomes something it CANNOT DO. Note it is STRONGER than the
 *     mandate: the mandate permits a throwaway clone, and a tool-free juror cannot make one. That
 *     escalation path is deliberately outside the judge contract (#3035).
 *
 *  2. THE SHAPE IS ENFORCED BY THE TOOL, NOT APPROXIMATED. `--json-schema` is implemented as a FORCED TOOL
 *     CALL — a conforming run comes back with `stop_reason: "tool_use"` and the answer already parsed in
 *     `structured_output` (reproduced: a schema-constrained spawn returned `stop_reason: "tool_use"` and a
 *     `structured_output` object, not a string). So there is no prose to parse, no fences to strip, and no
 *     ask-and-validate loop to build. Retries are for genuine failures only.
 *
 *  3. A JUROR IS A STRUCTURALLY DISTINCT ACTOR, NOT A NOMINAL ONE — and THIS is the guarantee the item was
 *     originally written without. The repo's independence check (`we:scripts/lib/review-independence.mjs`)
 *     keys reviewer identity on `CLAUDE_CODE_SESSION_ID`, and A SUBAGENT INHERITS ITS PARENT'S VALUE — so
 *     by that test every review run as a subagent IS THE SAME ACTOR AS THE AUTHOR, no matter what the
 *     mandate calls it. `we:scripts/lib/review-core.mjs` tells the model it is "A reviewer subagent
 *     (independent of you and of the PR's original author)", but nothing enforces that sentence: the
 *     independence decider is imported by the LABEL and LAND seams, never by the review path that emits
 *     the claim. A headless `claude -p`, by contrast, DOES NOT ADOPT the inherited `CLAUDE_CODE_SESSION_ID`
 *     — it mints its own (reproduced: three spawns whose environment carried the parent's id each reported
 *     a different `session_id`). Supplying `--session-id` makes that identity DETERMINISTIC and
 *     RECORDABLE instead of merely fresh, which is why `judgeSpawn` derives one from the run id and
 *     RETURNS IT: a caller can record WHICH ACTOR judged, and that record is a machine fact rather than a
 *     sentence in a prompt.
 *
 *     Read the limit honestly, in the #2895 spirit: a distinct session id is not an unforgeable actor
 *     signal (nothing local is — see the header of `review-independence.mjs`). What it buys is that the
 *     juror's identity is no longer AUTOMATICALLY the author's, which is the failure a subagent juror has
 *     by construction and cannot argue its way out of.
 *
 * THE TRAP, RECORDED SO NOBODY RE-FINDS IT. `--bare` strips more context than `--safe-mode` — and forces
 * key-based auth. Its own help text says Anthropic auth is "strictly ANTHROPIC_API_KEY or apiKeyHelper via
 * --settings (OAuth and keychain are never read)", so on a subscription it CANNOT SEE THE LOGIN and the
 * spawn dies with `"Not logged in · Please run /login"` (reproduced: exit 1, `is_error: true`, zero tokens
 * billed). Tier one MUST use `--safe-mode`. `FORBIDDEN_ARGV` names the flag and a unit test asserts the
 * helper never emits it, so the trap is a gate rather than a comment.
 *
 * ARGV CONSTRUCTION IS PURE, AND THAT IS THE TESTABILITY SEAM. `buildJudgeArgv` spawns nothing and touches
 * no environment, so the whole flag contract is unit-testable at zero cost and zero latency; exactly one
 * integration test pays for a real spawn. `parseJudgeOutcome` is likewise pure over the CLI's stdout.
 *
 * WHY STDIN CARRIES THE INPUT. The judged material is a diff and can be large, so it goes on stdin rather
 * than argv — no `ARG_MAX` ceiling, and argv stays a fixed, assertable flag list. It also keeps the
 * positional-prompt slot empty, which matters because `--tools` is VARIADIC: a positional argument sitting
 * after `--tools ""` would be swallowed as a tool name. `buildJudgeArgv` therefore always follows
 * `--tools ""` with an option token, and a unit test pins that.
 *
 * NOT IN SCOPE: the hosted-tier backend. This is tier one only; the tier-two substitution sits behind this
 * same signature and is not built here (#3028 "Not in scope").
 *
 * PURE except `judgeSpawn`, which spawns a subprocess and takes an injectable `spawnFn` so callers and
 * tests can substitute one. A LEAF module: it imports nothing from the review/jury seams.
 */

import { spawn as nodeSpawn } from 'node:child_process';
import { createHash } from 'node:crypto';

/** The CLI a juror runs as. Named once so a test can assert it and a caller can override the path. */
export const JUDGE_CLI = 'claude';

/**
 * Flags this helper must NEVER emit, with the reason it is banned. `--bare` forces key-based auth and
 * cannot see a subscription login (#3028's recorded trap) — a spawn using it fails "Not logged in".
 */
export const FORBIDDEN_ARGV = Object.freeze(['--bare']);

/**
 * The runtime half of the `--bare` refusal. `buildJudgeArgv` never emits a forbidden flag from its OWN
 * recipe, but this is the check that actually stands between an argv and a process. Separately exported so
 * it is provable on its own.
 *
 * IT IS ALSO REACHABLE THROUGH `judgeSpawn`, which an earlier version of this header denied. `model` is
 * validated only as a non-empty string, so `model: '--bare'` becomes the argv pair `--model --bare` and this
 * guard fires — a real footgun (a flag-shaped option VALUE smuggling a banned flag past the recipe), and the
 * route the unit test uses to pin `judgeSpawn`'s call to this function. The belt-and-braces case the call
 * site is commented for — a future edit making `buildJudgeArgv` emit `--bare` literally — remains
 * unreachable from the public API and is therefore untested; say so rather than imply otherwise.
 *
 * @param {string[]} argv
 * @throws when argv carries any `FORBIDDEN_ARGV` entry.
 */
export function assertNoForbiddenArgv(argv = []) {
  for (const banned of FORBIDDEN_ARGV) {
    if (argv.includes(banned)) {
      throw new Error(`judge-spawn: refusing to spawn with ${banned} — see FORBIDDEN_ARGV and #3028's recorded trap`);
    }
  }
}

/** The CLI's own `--effort` enum, per `claude --help` at 2.1.220. */
export const EFFORT_LEVELS = Object.freeze(['low', 'medium', 'high', 'xhigh', 'max']);

/** Defaults for the care→rigor dial. Per-lens callers override all three; these are the cheap middle. */
export const DEFAULT_MODEL = 'sonnet';
export const DEFAULT_EFFORT = 'medium';
export const DEFAULT_BUDGET_USD = 0.5;

/**
 * THE ONE SEED ENCODING — the single place a multi-field identity becomes a `deriveSessionId` seed (#3058).
 *
 * WHY IT EXISTS: a space join is not injective. `` `${runId} ${id}` `` maps `("a", "b c#1")` and
 * `("a b", "c#1")` onto the SAME seed, so two structurally different seats in two different runs are recorded
 * as one actor. And `[runId, lens].filter(Boolean).join(' ')` was worse than ambiguous — dropping an absent
 * field before the join collapsed a `runId`-only spawn onto a `lens`-only spawn carrying the same string, with
 * no space anywhere in the input. Both were reproduced before this encoder replaced them.
 *
 * WHY LENGTH-PREFIXED AND NOT NUL-DELIMITED. A NUL delimiter is injective only while you can promise NUL never
 * appears in a field, and that promise is about CALLER INPUT this module does not control — `runId` and `lens`
 * arrive from an operations declaration (`we:scripts/operations/cli-adapter.mjs`). Length-prefixing reserves no
 * byte at all, so it needs no promise and no escaping: it stays injective over arbitrary field content. This
 * repo also already uses NUL as a deliberate in-file sentinel in committed scripts, so it is not a free byte
 * here by convention either.
 *
 * THE ENCODING. `v1|<count>|` then, per field, either `~` for an ABSENT field (`undefined`/`null`) or
 * `<length>:<value>` for a present one. Absent, empty and missing are therefore three different things:
 * `['a']` → `v1|1|1:a`, `['a', undefined]` → `v1|2|1:a~`, `['a', '']` → `v1|2|1:a0:`. Decoding is
 * unambiguous — read the count, then read each field's declared length — which is what injectivity means.
 * `<length>` is in UTF-16 code units, i.e. JS `String.length`, because that is the unit a decoder would slice
 * a JS string by; byte length would be the wrong ruler for this data type, not a stricter one.
 *
 * FIELD SEMANTICS ARE POSITIONAL AND SHARED: field 0 is the run identity, field 1 is the actor's name within
 * that run (a bare `lens` for a direct spawn, a `lens#slot` seat id for a panel seat). Both call sites mean the
 * same thing by the same position, which is why they share this encoder rather than each owning one.
 *
 * @param {Array<string|undefined|null>} fields - the identity fields, in a fixed positional order.
 * @returns {string} an injective encoding of exactly that field list.
 */
export function sessionSeed(fields) {
  if (!Array.isArray(fields) || fields.length === 0) {
    throw new TypeError('judge-spawn: sessionSeed needs a non-empty array of fields');
  }
  const parts = fields.map((f, i) => {
    if (f === undefined || f === null) return '~';
    if (typeof f !== 'string') {
      throw new TypeError(
        `judge-spawn: sessionSeed field ${i} must be a string, null or undefined, got ${JSON.stringify(f)}`,
      );
    }
    return `${f.length}:${f}`;
  });
  return `v1|${fields.length}|${parts.join('')}`;
}

/**
 * A deterministic RFC 9562 UUIDv8 derived from a seed — the juror's `--session-id`.
 *
 * DETERMINISTIC ON PURPOSE: the same run id and lens always name the same session, so the transcript is
 * findable from the run record and the actor that judged is recorded rather than merely fresh. Version 8
 * is the RFC's CUSTOM version, which is honest about this being a hash rather than random (v4) or a
 * namespaced SHA-1 (v5). Verified accepted by `claude --session-id` at 2.1.220: the CLI echoed the exact
 * id back in its result.
 *
 * SEEDS OF MORE THAN ONE FIELD GO THROUGH `sessionSeed`, NEVER THROUGH A HAND-ROLLED JOIN. This function
 * hashes whatever string it is given and cannot tell an ambiguous seed from an unambiguous one, so the
 * injectivity has to be established before the call — see `sessionSeed`'s header and #3058 for the
 * space-join defect that convention replaced.
 *
 * @param {string} seed - any stable string; multi-field callers pass `sessionSeed([...])`.
 * @returns {string} a lowercase canonical UUID.
 */
export function deriveSessionId(seed) {
  if (typeof seed !== 'string' || !seed.trim()) {
    throw new TypeError('judge-spawn: deriveSessionId needs a non-empty seed string');
  }
  const b = createHash('sha256').update(seed).digest().subarray(0, 16);
  b[6] = (b[6] & 0x0f) | 0x80; // version 8 — custom
  b[8] = (b[8] & 0x3f) | 0x80; // variant 10x
  const h = b.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/**
 * THE PURE HALF: the juror's argv. Spawns nothing, reads no environment, touches no disk.
 *
 * The order is FIXED so tests can assert the whole list, and so `--tools ""` is always followed by an
 * option token (see the header on variadic `--tools`). The judged input is NOT here — it goes on stdin.
 *
 * @param {object} opts
 * @param {string} opts.mandate - the stable juror instruction, sent via `--append-system-prompt`.
 * @param {object} opts.shape - a JSON Schema object; enforced via `--json-schema`.
 * @param {string} [opts.model] - per-lens model alias or full name.
 * @param {string} [opts.effort] - per-lens effort, one of `EFFORT_LEVELS`.
 * @param {number} [opts.budget] - hard per-juror ceiling in USD.
 * @param {string} opts.sessionId - the juror's session id; use `deriveSessionId`.
 * @returns {string[]} argv AFTER the binary name.
 */
export function buildJudgeArgv({
  mandate,
  shape,
  model = DEFAULT_MODEL,
  effort = DEFAULT_EFFORT,
  budget = DEFAULT_BUDGET_USD,
  sessionId,
  allowedTools = null,
} = {}) {
  if (allowedTools !== null) {
    // A tool name reaches argv as a bare token, so a flag-shaped one becomes a FLAG — the same hazard
    // `FORBIDDEN_ARGV` exists for, one field over. Refuse anything that is not a plain tool identifier.
    if (!Array.isArray(allowedTools) || allowedTools.length === 0) {
      throw new TypeError('judge-spawn: `allowedTools` must be a non-empty array, or null for a tool-free juror');
    }
    for (const t of allowedTools) {
      if (typeof t !== 'string' || !/^[A-Za-z][A-Za-z0-9_]*$/.test(t)) {
        throw new TypeError(`judge-spawn: refusing tool name ${JSON.stringify(t)} — a non-identifier reaches argv as a flag`);
      }
    }
    assertNoForbiddenArgv(allowedTools);
  }
  if (typeof mandate !== 'string' || !mandate.trim()) {
    throw new TypeError('judge-spawn: `mandate` must be a non-empty string');
  }
  if (!shape || typeof shape !== 'object' || Array.isArray(shape)) {
    throw new TypeError('judge-spawn: `shape` must be a JSON Schema object');
  }
  if (typeof model !== 'string' || !model.trim()) {
    throw new TypeError('judge-spawn: `model` must be a non-empty string');
  }
  if (!EFFORT_LEVELS.includes(effort)) {
    throw new TypeError(`judge-spawn: \`effort\` must be one of ${EFFORT_LEVELS.join('|')}, got ${JSON.stringify(effort)}`);
  }
  if (typeof budget !== 'number' || !Number.isFinite(budget) || budget <= 0) {
    throw new TypeError('judge-spawn: `budget` must be a positive finite number of USD');
  }
  if (typeof sessionId !== 'string' || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(sessionId)) {
    throw new TypeError('judge-spawn: `sessionId` must be a canonical lowercase UUID — use deriveSessionId()');
  }

  // TOOL-FREE BY DEFAULT, TOOL-BEARING ONLY ON REQUEST. `--tools ''` is what makes a juror's "never check the
  // branch out in a shared tree" a thing it CANNOT do rather than is asked not to — so it stays the default and
  // every existing caller is unchanged.
  //
  // WHY A TOOL-BEARING VARIANT EXISTS AT ALL. Nine PR reviews run by hand on 2026-08-11/12 found what they
  // found BECAUSE they could act: a `gh` flag bypass found by firing the command at real GitHub, a guard hole
  // reproduced on the parent commit, four decorative tests found by mutating source and watching what stayed
  // green. A juror that can only read a diff finds none of those. The tools ARE the finding mechanism.
  //
  // WHAT REPLACES THE GUARANTEE `--tools ''` GAVE. Two structural properties, both enforced by hooks rather
  // than by instruction: the spawn runs with `cwd` in the caller's own LANE, so `guard-lane` denies any write
  // to a shared checkout; and its `sessionId` is derived, so it differs from the author's and the self-clear
  // refusal in `review-independence.mjs` holds. Neither depends on the juror cooperating.
  const toolArgs = allowedTools === null
    ? ['--tools', '']                 // variadic — the next token below MUST be an option, and is.
    : ['--allowedTools', ...allowedTools];
  return [
    '-p',
    '--output-format', 'json',
    '--safe-mode',                    // NOT --bare: see FORBIDDEN_ARGV and the header's trap section.
    ...toolArgs,
    '--model', model,
    '--effort', effort,
    '--max-budget-usd', String(budget),
    '--no-session-persistence',
    '--session-id', sessionId,
    '--append-system-prompt', mandate,
    '--json-schema', JSON.stringify(shape),
  ];
}

/**
 * THE OTHER PURE HALF: the CLI's stdout, turned into a validated result or a throw.
 *
 * FAILS LOUD AND FAILS WITH THE SPAWN'S OWN WORDS. When the CLI reports an error it carries its own text
 * in `result` (that is how the `--bare` trap surfaces as "Not logged in · Please run /login"), and this
 * function throws exactly that rather than a paraphrase.
 *
 * @param {string} stdout - the CLI's raw stdout.
 * @param {string} [stderr] - the CLI's stderr, folded into the message when stdout is unparseable.
 * @returns {{value: object, sessionId: string, costUsd: number, durationMs: number, numTurns: number,
 *            stopReason: string, usage: object}}
 */
export function parseJudgeOutcome(stdout, stderr = '') {
  let parsed;
  try {
    parsed = JSON.parse(String(stdout));
  } catch {
    const tail = String(stderr).trim().slice(-600);
    throw new Error(
      `judge-spawn: the juror did not emit parseable JSON on stdout.\n` +
      `stdout[0..600]: ${String(stdout).slice(0, 600)}\n` +
      (tail ? `stderr[-600..]: ${tail}` : 'stderr: <empty>'),
    );
  }

  if (parsed?.is_error) {
    // The CLI's OWN error text, verbatim — never reworded.
    throw new Error(`judge-spawn: the juror failed: ${parsed.result ?? '<no result text>'}`);
  }

  const value = parsed?.structured_output;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(
      'judge-spawn: the juror returned no `structured_output` object — the enforced shape did not land. ' +
      `stop_reason=${JSON.stringify(parsed?.stop_reason)} result=${JSON.stringify(parsed?.result ?? null).slice(0, 400)}`,
    );
  }

  return {
    value,
    sessionId: parsed.session_id ?? '',
    costUsd: typeof parsed.total_cost_usd === 'number' ? parsed.total_cost_usd : 0,
    durationMs: typeof parsed.duration_ms === 'number' ? parsed.duration_ms : 0,
    numTurns: typeof parsed.num_turns === 'number' ? parsed.num_turns : 0,
    stopReason: parsed.stop_reason ?? '',
    usage: parsed.usage ?? {},
  };
}

/**
 * Total context the request actually loaded — fresh input plus both cache halves.
 *
 * This is the number the #3028 measurement reports, and it is taken from the CLI's OWN `usage` block
 * rather than estimated. Cache reads COUNT: they are context the model was given, even when they are
 * cheap, and the whole claim under test is about how much context a juror carries.
 *
 * @param {object} usage - a result's `usage` object.
 * @returns {number} tokens.
 */
export function loadedContextTokens(usage = {}) {
  const n = (k) => (typeof usage?.[k] === 'number' ? usage[k] : 0);
  return n('input_tokens') + n('cache_creation_input_tokens') + n('cache_read_input_tokens');
}

/**
 * THE ONE FUNCTION A `judge` STEP CALLS. Spawns a tool-free juror and returns its validated answer.
 *
 * @param {object} opts
 * @param {string} opts.mandate - the stable juror instruction (system prompt suffix).
 * @param {string} opts.input - the material to judge; written to the juror's stdin.
 * @param {object} opts.shape - JSON Schema the answer is FORCED to satisfy.
 * @param {string} [opts.model] - per-lens model.
 * @param {string} [opts.effort] - per-lens effort.
 * @param {number} [opts.budget] - hard USD ceiling for this juror.
 * @param {string} [opts.runId] - run identity the session id derives from.
 * @param {string} [opts.lens] - lens name, mixed into the session id so a panel's jurors differ.
 * @param {string} [opts.sessionId] - an explicit session id, overriding the derivation.
 * @param {string} [opts.cwd] - working directory for the spawn.
 * @param {object} [opts.env] - environment for the spawn; defaults to the caller's.
 * @param {string} [opts.cli] - the binary to run.
 * @param {number} [opts.timeoutMs] - kill the juror after this long.
 * @param {Function} [opts.spawnFn] - injectable `child_process.spawn`, for tests.
 * @returns {Promise<{value: object, sessionId: string, costUsd: number, durationMs: number,
 *                    wallMs: number, numTurns: number, stopReason: string, usage: object,
 *                    loadedContextTokens: number, argv: string[]}>}
 */
export async function judgeSpawn({
  mandate,
  input,
  shape,
  model = DEFAULT_MODEL,
  effort = DEFAULT_EFFORT,
  budget = DEFAULT_BUDGET_USD,
  runId,
  lens,
  sessionId,
  cwd = process.cwd(),
  env = process.env,
  cli = JUDGE_CLI,
  timeoutMs = 10 * 60 * 1000,
  allowedTools = null,
  spawnFn = nodeSpawn,
} = {}) {
  if (typeof input !== 'string' || !input.trim()) {
    throw new TypeError('judge-spawn: `input` must be a non-empty string — there is nothing to judge');
  }
  // A run id + lens names the juror DETERMINISTICALLY, so its transcript is findable from the run record
  // and the actor that judged is recorded. With neither supplied there is nothing stable to derive from,
  // so fall back to a one-off seed — still a distinct actor, just not a reproducible name.
  //
  // BOTH FIELDS ARE ALWAYS ENCODED, PRESENT OR NOT (#3058). The predecessor here was
  // `[runId, lens].filter(Boolean).join(' ')`, and the `filter` is what made it wrong: dropping an absent
  // field before the join made a `runId`-only spawn and a `lens`-only spawn carrying the same string derive
  // ONE id. `sessionSeed` encodes an absent field as an absent field, so position is preserved and the two
  // shapes stay distinct. The `filter` survives only as the "is anything nameable at all" test below, where
  // it decides between a stable name and a one-off — it no longer touches the seed's contents.
  const seed = (runId || lens)
    ? sessionSeed([runId, lens])
    : `judge:${Date.now()}:${Math.random()}`;
  const sid = sessionId ?? deriveSessionId(seed);
  const argv = buildJudgeArgv({ mandate, shape, model, effort, budget, sessionId: sid , allowedTools });

  // Belt-and-braces: the trap can never reach a real process, even if `buildJudgeArgv` is later edited.
  assertNoForbiddenArgv(argv);

  const startedAt = Date.now();
  const { stdout, stderr, code } = await new Promise((resolve, reject) => {
    let child;
    try {
      child = spawnFn(cli, argv, { cwd, env, stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (e) {
      reject(new Error(`judge-spawn: could not start \`${cli}\`: ${e.message}`));
      return;
    }
    let out = '';
    let err = '';
    let timer = null;
    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        try { child.kill('SIGKILL'); } catch { /* already gone */ }
        reject(new Error(`judge-spawn: the juror exceeded ${timeoutMs}ms and was killed`));
      }, timeoutMs);
      if (typeof timer.unref === 'function') timer.unref();
    }
    child.stdout?.on('data', (d) => { out += d; });
    child.stderr?.on('data', (d) => { err += d; });
    child.on('error', (e) => {
      if (timer) clearTimeout(timer);
      reject(new Error(`judge-spawn: \`${cli}\` failed to run: ${e.message}`));
    });
    child.on('close', (c) => {
      if (timer) clearTimeout(timer);
      resolve({ stdout: out, stderr: err, code: c });
    });
    // The judged material rides stdin — see the header on ARG_MAX and the variadic `--tools`.
    child.stdin?.on('error', () => { /* the child may exit before we finish writing; `close` reports it */ });
    child.stdin?.end(input);
  });

  const wallMs = Date.now() - startedAt;
  // `parseJudgeOutcome` throws with the CLI's own words; a non-zero exit with unparseable stdout lands there too.
  const outcome = parseJudgeOutcome(stdout, stderr || (code === 0 ? '' : `exit code ${code}`));
  return { ...outcome, wallMs, loadedContextTokens: loadedContextTokens(outcome.usage), argv };
}
