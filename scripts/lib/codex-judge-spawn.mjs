/**
 * codex-judge-spawn.mjs — the SECOND `JudgeProvider` implementation (#xqa9ttq, under #3369/#3370), Codex CLI
 * as a tool-free panelist.
 *
 * EVERY CLAIM BELOW WAS PROVEN LIVE, NOT DERIVED FROM DOCS — `#3371`'s ten probes against `codex-cli 0.153.4`
 * on a real ChatGPT subscription are the evidentiary record this module translates into code. This header
 * points at the probe that proves each design choice rather than re-arguing it; re-read `#3371` before
 * changing any of the argv/parsing decisions here.
 *
 * WHAT THIS SATISFIES: the SAME `JudgeProvider` port `judgeSpawn` (`we:scripts/lib/judge-spawn.mjs`)
 * implements — `(request: JudgeProviderRequest) => Promise<JudgeProviderOutcome>`, named in
 * `we:scripts/operations/cli-adapter.mjs`. Nothing about the port's shape changed to make this true (`#3371`'s
 * verdict: "the port's shape survives the probe intact").
 *
 * TOOL-FREE ONLY. There is no `allowedTools`/lane-cwd parameter here, and there never should be one added
 * casually: probe 9 found NO context-strip flag for a tool-bearing Codex juror in a lane cwd (`-C` always
 * loads `we:AGENTS.md`), and per `#3581`'s ratified sequencing this provider is seated as a tool-free
 * panelist first. `assertNoCodexTools` below REFUSES a request carrying `allowedTools` rather than silently
 * ignoring it.
 *
 * THE FOUR THINGS THAT DO NOT TRANSLATE FROM `judge-spawn.mjs`, EACH RECORDED WHERE IT DIFFERS:
 *
 *   1. ARGV IS A DIFFERENT LIST, not a renamed one. `-p --output-format json` becomes `exec --json` (a JSONL
 *      STREAM, not one document); `--json-schema '<inline>'` becomes `--output-schema <FILE>` — a temp file
 *      this module writes and cleans up; `--append-system-prompt` has NO EQUIVALENT, so the mandate is folded
 *      into the prompt text sent on stdin; `--tools ''` has no equivalent either — `-s read-only` is the
 *      nearest control and it is sandbox-based, not tool-removal. See `buildCodexJudgeArgv`.
 *
 *   2. THE STDIN TRAP (probe 0). `codex exec` takes its prompt as a POSITIONAL argument, and per its own
 *      `--help`: "If not provided as an argument (or if `-` is used), instructions are read from stdin." A
 *      spawn that supplies BOTH a positional prompt AND a piped, never-closed stdin hangs forever — reproduced
 *      live, killed at 300s. This module supplies NO positional prompt at all (mirroring `judge-spawn.mjs`'s
 *      own "why stdin carries the input" discipline) and relies on `child.stdin.end(text)`, which CLOSES the
 *      stream, to be the thing that makes this safe — exactly the property `judgeSpawn` already leans on.
 *
 *   3. OUTPUT IS JSONL, AND THE ANSWER IS THE LAST THING, NEVER THE FIRST (probes 5, 7). A multi-turn run's
 *      only schema-constrained message is its FINAL `agent_message` (probe 7) — everything before it is free
 *      prose a naive "first agent_message" parser would wrongly treat as the answer. `--output-last-message
 *      <FILE>` is the clean seam for this (this module always passes it and prefers it), with a JSONL
 *      fallback for when that file was never written (killed mid-run, probe 6). Terminal STATUS is likewise
 *      the LAST event (`turn.completed`/`turn.failed`), never the first: probe 5's auth failure emits a ~30s,
 *      ~12-event retry storm across two transports before the real `turn.failed`, and a parser reading the
 *      first `error` line would report a transient retry as the final word.
 *
 *   4. THREE PORT FIELDS CANNOT BE FILLED HONESTLY, so they are not faked (`#3371`'s verdict, verbatim):
 *      `costUsd` is always `0` (no USD figure exists anywhere in Codex's output — only token counts);
 *      `sessionId` is OBSERVED off the `thread.started` event, never derived, so it is not deterministic
 *      before the run the way `judgeSpawn`'s `deriveSessionId` is; `JudgeBudgetError` cannot be constructed at
 *      all (no spend ceiling exists to have been hit), so this module never throws it — a `budget` on the
 *      request is accepted for port-shape compatibility and silently has no effect, which is recorded here
 *      rather than left to be rediscovered.
 *
 * PURE except `codexJudgeSpawn`, which spawns a subprocess and writes/removes temp files, and takes an
 * injectable `spawnFn` exactly like `judgeSpawn` does. `buildCodexJudgeArgv` and `parseCodexJudgeOutcome` are
 * pure, mirroring the split `judge-spawn.mjs` uses for the same testability reason: the whole argv/parsing
 * contract is unit-testable at zero cost, and exactly one integration test pays for a real spawn.
 *
 * A LEAF MODULE, DELIBERATELY — imports nothing from the review/jury seams, mirroring `judge-spawn.mjs`'s own
 * "A LEAF module" discipline exactly, and `requireAllProperties`/`stripNulls` (the schema-transform pair) are
 * DEFINED HERE rather than in `we:scripts/lib/jury-core.mjs`, where an earlier draft put them, FOR A REAL
 * REASON RECORDED SO IT IS NOT RE-INTRODUCED: `jury-core.mjs` imports `review-escalation.mjs`, which needs the
 * `markdown-it` npm package. `we:scripts/operations/cli-adapter.mjs` (this module's only caller) is itself
 * imported at module-load time by `we:scripts/backlog.mjs` and other lightweight CLI entry points — and SEVERAL
 * of those are exercised by this repo's own "ephemeral clone" test harness (`we:scripts/__tests__/
 * number-stranded-locus.test.mjs`, `backlog-cli-snapshot.test.mjs`, `we:scripts/backlog/__tests__/
 * resolve-parent-cli.test.mjs`, the #2273/#2274 pattern), which copies ONLY the `scripts/` tree into an
 * isolated tmp directory with NO `node_modules` at all, to prove CLI behaviour decoupled from cwd/lane state.
 * A `cli-adapter.mjs → jury-core.mjs → review-escalation.mjs → markdown-it` static import edge is EAGER (ESM
 * resolves every static import at load time, whether or not the code path that needs it ever runs), so it
 * broke ALL THREE of those harnesses with `ERR_MODULE_NOT_FOUND: Cannot find package 'markdown-it'` — caught
 * only by actually running the full suite, exactly the class of bug `we:docs/agent/prototype-based-dev.md`
 * warns a mocked-only test suite cannot see. `jury-core.mjs` already carried this dependency for its OWN
 * reasons (`CARE_LEVELS`); the defect was `cli-adapter.mjs` gaining a NEW edge to it that did not exist before
 * this provider. Keeping these two functions here, with zero jury/review imports, is what keeps that edge from
 * reappearing — do not move them back to `jury-core.mjs` without re-solving this.
 */

import { spawn as nodeSpawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JUDGE_TIMEOUT_GRACE_MS, JUDGE_TIMEOUT_MS, JudgeTimeoutError } from './judge-spawn.mjs';

/**
 * #xqa9ttq — THE OPENAI-STRICT SCHEMA TRANSFORM, proved live against a real `codex exec` spawn in `#3371`
 * probes 3/4 before this function existed. `we:scripts/lib/judge-spawn.mjs`'s Claude-backed jurors use
 * `--json-schema`, which tolerates a `required` list narrower than `properties` — the repo's own judge shapes
 * (`REVIEW_JUDGE_SHAPE`, `REVIEW_PREP_JUDGE_SHAPE`, `SYNTHESIS_SHAPE`) all lean on that: `findings[]` items
 * declare fourteen properties and require only `summary`. OpenAI's structured-output mode (what a Codex
 * `--output-schema` compiles to) is STRICTER and REJECTS that shape outright — probe 3 reproduced the exact
 * 400: `"'required' is required to be supplied and to be an array including every key in properties. Missing
 * 'file'."` Probe 4 proved the fix mechanically: walk the schema, and at every `object` node add EVERY declared
 * property key to `required`.
 *
 * WHY A NEWLY-REQUIRED PROPERTY ALSO NEEDS `null` FOLDED INTO ITS `type`. Forcing `required` without touching
 * `type` would ask the model to always supply a value for a field a Claude-shaped juror was allowed to omit —
 * which is not the same request. Probe 4's own real response proved OpenAI's actual behaviour: a field the
 * juror had nothing to say about came back as `null` explicitly (`"file":null`, `"line":null`,
 * `"parallelizable":null`), never omitted. So a property is widened to accept `null` alongside its declared
 * type IF AND ONLY IF it was not already required — a property the schema's AUTHOR already demanded (like
 * `summary`) keeps its original type unchanged, because that field was never optional and widening it would
 * silently invite a `null` a caller downstream (`normalizeFinding`) is not written to expect there.
 *
 * ONLY THE CODEX PATH CALLS THIS. `we:scripts/lib/judge-spawn.mjs`'s Claude argv sends the ORIGINAL shape,
 * untouched — see this function's own call site in `we:scripts/operations/cli-adapter.mjs#resolveJudgeProvider`.
 * Transforming the shared shape constants themselves (rather than transforming a copy at the Codex call site)
 * would change what every EXISTING Claude juror is asked for, which is exactly the regression `#3371`'s verdict
 * warns against.
 *
 * WHY THIS LIVES HERE AND NOT IN `jury-core.mjs`: see this file's own header — a real import-graph regression,
 * caught by the repo's ephemeral-clone CLI tests, not a style preference.
 *
 * PURE AND RECURSIVE: walks `properties`/`items`/`anyOf`/`oneOf`/`allOf`/`$defs` so a nested object node (a
 * finding INSIDE a findings array, say) gets the same treatment as the top-level one. A node with no
 * `properties` (a `{type: 'string'}` leaf, an already-built `$ref`) is returned unchanged — there is nothing to
 * widen. Never mutates its input; returns a new tree throughout, top to bottom, so a caller holding the
 * original constant is never surprised by an in-place edit.
 *
 * @param {*} schema - a JSON Schema node (object, array item schema, or a whole document).
 * @returns {*} an equivalent node, transformed for OpenAI strict mode. Non-object/array input is returned as-is.
 */
export function requireAllProperties(schema) {
  if (Array.isArray(schema)) return schema.map(requireAllProperties);
  if (!schema || typeof schema !== 'object') return schema;

  const out = { ...schema };
  for (const key of ['items', 'additionalProperties', 'contains', 'not']) {
    if (out[key] !== undefined) out[key] = requireAllProperties(out[key]);
  }
  for (const key of ['anyOf', 'oneOf', 'allOf', 'prefixItems']) {
    if (Array.isArray(out[key])) out[key] = out[key].map(requireAllProperties);
  }
  if (out.$defs && typeof out.$defs === 'object') {
    out.$defs = Object.fromEntries(Object.entries(out.$defs).map(([k, v]) => [k, requireAllProperties(v)]));
  }

  if (out.properties && typeof out.properties === 'object' && !Array.isArray(out.properties)) {
    const alreadyRequired = new Set(Array.isArray(out.properties.required ?? out.required) ? (out.required ?? []) : []);
    const propKeys = Object.keys(out.properties);
    const nextProperties = {};
    for (const key of propKeys) {
      const wasRequired = alreadyRequired.has(key);
      let propSchema = requireAllProperties(out.properties[key]);
      // Widen to accept `null` ONLY for a property that was not already required — see the header. A `type`
      // that is already an array gets `'null'` appended (deduped); a bare string type becomes a two-element
      // array; a node with no `type` at all (an `enum`-only leaf, a `$ref`, a bare `anyOf`) is left alone,
      // since there is no `type` keyword here to widen and inventing one could contradict the node's own
      // constraint.
      if (!wasRequired && propSchema && typeof propSchema === 'object' && 'type' in propSchema) {
        const types = Array.isArray(propSchema.type) ? propSchema.type : [propSchema.type];
        if (!types.includes('null')) propSchema = { ...propSchema, type: [...types, 'null'] };
      }
      nextProperties[key] = propSchema;
    }
    out.properties = nextProperties;
    out.required = propKeys;
  }
  return out;
}

/**
 * #xqa9ttq — STRIP `null` VALUES BEFORE A CODEX ANSWER REACHES `normalizeFinding` (`#3371` probe 4).
 *
 * `requireAllProperties` above widens the REQUEST so OpenAI's strict mode accepts the schema; this is the
 * matching RESPONSE-side half. A property Claude simply omits arrives from Codex as `key: null` instead
 * (probe 4's real, reproduced response carried `"file":null,"line":null,"parallelizable":null`). Left alone,
 * every Codex-judged finding would carry keys no Claude-judged finding ever has, and — more concretely —
 * `normalizeFinding`'s own null-BLIND checks would misfire: `if (raw.file) …` already treats `null` as absent
 * correctly, but `for (const k of ['introduced', ...]) if (typeof raw[k] === 'boolean')` also already excludes
 * `null` correctly. The risk this closes is everything OUTSIDE `normalizeFinding` that a Codex-backed shape may
 * one day feed (`SYNTHESIS_SHAPE` and friends have no normalizer at all) and would otherwise see `null` where a
 * Claude-backed run never emits the key — so the strip happens once, generically, before ANY consumer sees the
 * value, rather than being re-derived per shape or trusted to each downstream reader's own null-tolerance.
 *
 * DEEP AND PURE. Walks arrays and plain objects; a `null` ARRAY ELEMENT is left in place — dropping it would
 * shift every later index, silently corrupting positional data (e.g. a `findings[]` list). Only a `null`
 * OBJECT PROPERTY is removed, which cannot shift anything since object keys carry no position. Never mutates
 * its input.
 *
 * @param {*} value - a parsed JSON value (object, array, or scalar).
 * @returns {*} the same shape with every object property whose value is exactly `null` removed.
 */
export function stripNulls(value) {
  if (Array.isArray(value)) return value.map(stripNulls);
  if (value === null || typeof value !== 'object') return value;
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (v === null) continue;
    out[k] = stripNulls(v);
  }
  return out;
}

/** The CLI this provider runs as. Named once, exactly like `judge-spawn.mjs`'s `JUDGE_CLI`. */
export const CODEX_CLI = 'codex';

/**
 * The shared care→rigor dial's effort enum (`judge-spawn.mjs#EFFORT_LEVELS`) does not match Codex's own
 * `model_reasoning_effort` values one-to-one. Mapped where a real Codex level exists; `xhigh`/`max` CLAMP
 * DOWN to `high` rather than being refused or passed through unrecognised, because a clamp is a degraded-but-
 * working request and a refusal is a request that cannot run at all — the same "a bound being hit is not a
 * crash" reasoning `JUDGE_TIMEOUT_MS`'s header already uses, applied to an effort level instead of a clock.
 * RE-DERIVE if Codex ever adds a level above `high`.
 */
export const CODEX_EFFORT_MAP = Object.freeze({
  low: 'low',
  medium: 'medium',
  high: 'high',
  xhigh: 'high',
  max: 'high',
});

/**
 * A Codex `turn.failed` whose error is OpenAI's strict-schema 400 (`#3371` probe 3) — a CALLER bug (the shape
 * sent does not satisfy OpenAI's structured-output dialect), not a juror failure. A NEW CLASS with no Claude
 * counterpart, per this item's own scope: collapsing it into a generic "the juror failed" `Error` would read
 * as "the model got it wrong" when the real fact is "the request was never valid to send". Every
 * `codexJudgeSpawn` caller sends its shape through `requireAllProperties` first specifically to avoid ever
 * hitting this in production; a caller that still does either forgot that step or built a schema this
 * transform cannot fix (see `requireAllProperties`'s own header for what it does and does not do).
 */
export class CodexInvalidSchemaError extends Error {
  constructor({ schemaMessage, raw }) {
    super(
      `codex-judge-spawn: the schema sent to Codex is INVALID under OpenAI's strict structured-output dialect `
      + `— this is a caller/schema bug, not a juror failure (#3371 probe 3). Every property must appear in `
      + '`required`; `requireAllProperties` (`we:scripts/lib/jury-core.mjs`) exists to do that before send. '
      + `The provider's own message: ${schemaMessage}`,
    );
    this.name = 'CodexInvalidSchemaError';
    this.schemaMessage = schemaMessage;
    this.raw = raw;
  }
}

/**
 * Refuses a `JudgeProviderRequest` carrying `allowedTools` — this provider is TOOL-FREE ONLY (see file
 * header). Separately exported so it is provable on its own, the same reason `assertNoForbiddenArgv` is
 * exported from `judge-spawn.mjs`.
 * @param {string[]|null|undefined} allowedTools
 */
export function assertNoCodexTools(allowedTools) {
  if (allowedTools === null || allowedTools === undefined) return;
  if (Array.isArray(allowedTools) && allowedTools.length === 0) return;
  throw new Error(
    'codex-judge-spawn: refusing a TOOL-BEARING request — this provider is seated as a TOOL-FREE panelist '
    + 'only (#3581\'s ratified sequencing). Probe 9 found no context-strip flag for a tool-bearing Codex '
    + 'juror in a lane cwd (`-C` always loads `we:AGENTS.md`), so a tool-bearing Codex juror is out of scope '
    + 'here, not merely unimplemented. Omit `allowedTools`, or use the Claude provider for a tool-bearing role.',
  );
}

/**
 * THE PURE HALF: the Codex argv, translated from `#3371`'s table. Spawns nothing, writes no file, reads no
 * environment.
 *
 * @param {object} opts
 * @param {string} opts.schemaFile - path a caller has ALREADY written the (transformed) JSON Schema to.
 * @param {string} opts.outputLastMessageFile - path Codex should write its final answer to (probe 7's clean
 *   parse seam).
 * @param {string} opts.cwd - a scratch working directory. NOT a lane — this provider is tool-free, so `-C`
 *   only decides how much ambient repo doctrine gets loaded (probe 9), never what the juror can write.
 * @param {string} [opts.model] - Codex's `-m`.
 * @param {string} [opts.effort] - one of `judge-spawn.mjs`'s `EFFORT_LEVELS`; mapped via `CODEX_EFFORT_MAP`.
 * @returns {string[]} argv AFTER the binary name.
 */
export function buildCodexJudgeArgv({ schemaFile, outputLastMessageFile, cwd, model, effort } = {}) {
  if (typeof schemaFile !== 'string' || !schemaFile.trim()) {
    throw new TypeError('codex-judge-spawn: `schemaFile` must be a non-empty path');
  }
  if (typeof outputLastMessageFile !== 'string' || !outputLastMessageFile.trim()) {
    throw new TypeError('codex-judge-spawn: `outputLastMessageFile` must be a non-empty path');
  }
  if (typeof cwd !== 'string' || !cwd.trim()) {
    throw new TypeError('codex-judge-spawn: `cwd` must be a non-empty path — a scratch directory, not a lane');
  }
  const argv = [
    'exec',
    '--json',
    '--output-schema', schemaFile,
    '--output-last-message', outputLastMessageFile,
    '-s', 'read-only',              // NOT a tool allow-list — the nearest control Codex has (probe 9/table).
    '--skip-git-repo-check',        // the scratch cwd need not be a git repo.
    '--ephemeral',                  // no session persistence — the `--no-session-persistence` analogue.
    '-C', cwd,
  ];
  if (model !== undefined) {
    if (typeof model !== 'string' || !model.trim() || model.trim().startsWith('-')) {
      throw new TypeError(`codex-judge-spawn: \`model\` must be a plain non-empty string, got ${JSON.stringify(model)}`);
    }
    argv.push('-m', model.trim());
  }
  if (effort !== undefined) {
    const mapped = CODEX_EFFORT_MAP[effort];
    if (!mapped) {
      throw new TypeError(`codex-judge-spawn: \`effort\` must be one of ${Object.keys(CODEX_EFFORT_MAP).join('|')}, got ${JSON.stringify(effort)}`);
    }
    argv.push('-c', `model_reasoning_effort=${mapped}`);
  }
  // NO POSITIONAL PROMPT — see the file header's stdin-trap note. Everything rides stdin instead.
  return argv;
}

/**
 * Fold the mandate into the prompt text — Codex has no `--append-system-prompt` equivalent (`#3371`'s table).
 * A clearly-labelled two-part text, not a silent concatenation, so a reader of a captured transcript can tell
 * which part was the STABLE instruction and which was the judged MATERIAL.
 * @param {string} mandate
 * @param {string} input
 * @returns {string}
 */
export function buildCodexPrompt(mandate, input) {
  return `${mandate}\n\n---\n\nThe material to judge follows.\n\n${input}`;
}

/** One parsed JSONL line, or `null` for a blank/unparsable one. Never throws. */
function parseJsonlLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try { return JSON.parse(trimmed); } catch { return null; }
}

/**
 * Does this `turn.failed` error text carry OpenAI's `invalid_json_schema` 400 (probe 3's exact shape — the
 * error's `message` field is ITSELF a JSON-encoded string carrying a nested `error.code`)? Returns the parsed
 * inner object, or `null` if the text is not that shape.
 */
function parseInvalidSchemaError(message) {
  if (typeof message !== 'string') return null;
  let inner;
  try { inner = JSON.parse(message); } catch { return null; }
  if (inner?.error?.code === 'invalid_json_schema') return inner;
  return null;
}

/**
 * THE OTHER PURE HALF: Codex's raw stdout (+ the `--output-last-message` file's content, if it was written)
 * into a validated result or a throw. Mirrors `parseJudgeOutcome`'s discipline — fail loud, fail with the
 * spawn's own words — over a structurally different (JSONL, not one document) stream.
 *
 * @param {object} o
 * @param {string} o.stdout - raw JSONL stdout.
 * @param {string} [o.stderr] - folded in when stdout carries nothing useful (probe 8: a malformed schema file
 *   never reaches stdout at all).
 * @param {string|null} [o.lastMessage] - the `--output-last-message` file's content, or `null` if it was
 *   never written (a kill before the file was created, probe 6).
 * @returns {{value: object, sessionId: string, costUsd: number, numTurns: number, stopReason: string,
 *            usage: object}}
 * @throws {CodexInvalidSchemaError} on OpenAI's strict-schema 400.
 * @throws {Error} on any other terminal failure, or on no terminal event at all (the timeout caller handles
 *   that case separately — see `codexJudgeSpawn`).
 */
export function parseCodexJudgeOutcome({ stdout, stderr = '', lastMessage = null } = {}) {
  const lines = String(stdout).split('\n').map(parseJsonlLine).filter(Boolean);

  // THE TERMINAL EVENT IS THE LAST ONE, NEVER THE FIRST (probe 5). Scan from the end for the two events that
  // actually conclude a turn; a `turn.started`/`item.*`/retry `error` line along the way is not terminal.
  let terminal = null;
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (lines[i]?.type === 'turn.completed' || lines[i]?.type === 'turn.failed') { terminal = lines[i]; break; }
  }
  const threadStarted = lines.find((l) => l?.type === 'thread.started');
  const sessionId = threadStarted?.thread_id ?? '';
  const numTurns = lines.filter((l) => l?.type === 'turn.started').length;

  if (!terminal) {
    // No terminal event at all. Probe 8: a malformed schema file produces EMPTY stdout with the reason on
    // stderr only — fold it in, exactly as `parseJudgeOutcome` does. Anything else with no terminal event and
    // no stderr is an honest "did not conclude", left for `codexJudgeSpawn`'s caller to interpret (it is also
    // what a killed-before-any-line spawn looks like, though that path is handled before parsing is attempted).
    const tail = String(stderr).trim().slice(-600);
    throw new Error(
      'codex-judge-spawn: the juror produced no terminal `turn.completed`/`turn.failed` event.\n'
      + `stdout[0..600]: ${String(stdout).slice(0, 600)}\n`
      + (tail ? `stderr[-600..]: ${tail}` : 'stderr: <empty>'),
    );
  }

  if (terminal.type === 'turn.failed') {
    const message = terminal.error?.message ?? '';
    const invalidSchema = parseInvalidSchemaError(message);
    if (invalidSchema) {
      throw new CodexInvalidSchemaError({ schemaMessage: invalidSchema.error.message, raw: terminal });
    }
    // THE CLI'S OWN WORDS, VERBATIM — never reworded, exactly like `parseJudgeOutcome`'s `--bare` passthrough.
    // Probe 5's auth failure lands here: a 401 buried in transport prose, after a ~30s retry storm this
    // function never sees (it only ever looks at the LAST event).
    const tail = String(stderr).trim().slice(-600);
    throw new Error(
      `codex-judge-spawn: the juror failed: ${message || '<no error message>'}` + (tail ? `\nstderr[-600..]: ${tail}` : ''),
    );
  }

  // `turn.completed`. The answer is the LAST message, never the first (probe 7) — prefer `--output-last-message`
  // (probe 7's clean seam); fall back to the last `agent_message` item in the stream if that file is somehow
  // absent despite a clean `turn.completed` (defensive — not observed in any probe, but cheap to cover).
  const answerText = (typeof lastMessage === 'string' && lastMessage.trim())
    ? lastMessage
    : [...lines].reverse().find((l) => l?.type === 'item.completed' && l.item?.type === 'agent_message')?.item?.text;

  if (typeof answerText !== 'string' || !answerText.trim()) {
    throw new Error(
      'codex-judge-spawn: the juror completed its turn but left no answer text — neither `--output-last-message` '
      + `nor the JSONL stream carried one. stdout[0..600]: ${String(stdout).slice(0, 600)}`,
    );
  }
  let parsedAnswer;
  try {
    parsedAnswer = JSON.parse(answerText);
  } catch {
    throw new Error(
      `codex-judge-spawn: the juror's final answer did not parse as JSON despite a schema-constrained turn.\n`
      + `answer[0..600]: ${answerText.slice(0, 600)}`,
    );
  }
  if (!parsedAnswer || typeof parsedAnswer !== 'object' || Array.isArray(parsedAnswer)) {
    throw new Error(`codex-judge-spawn: the juror's final answer was not a JSON object: ${answerText.slice(0, 200)}`);
  }

  return {
    // #3371 probe 4 — strip `null`s before ANY downstream consumer (e.g. `normalizeFinding`) sees this value.
    value: stripNulls(parsedAnswer),
    sessionId,
    // #3371 verdict — no USD figure exists anywhere in Codex's output. Reported as 0, never estimated.
    costUsd: 0,
    numTurns,
    stopReason: terminal.type,
    usage: terminal.usage ?? {},
  };
}

/** Sum of the token fields Codex actually reports as "loaded" — its own key names, distinct from Claude's. */
export function codexLoadedContextTokens(usage = {}) {
  const n = (k) => (typeof usage?.[k] === 'number' ? usage[k] : 0);
  return n('input_tokens') + n('cached_input_tokens');
}

/**
 * THE ONE FUNCTION A CODEX-BACKED `judge` STEP CALLS. Spawns a tool-free Codex juror and returns its
 * validated answer, in the same `JudgeProviderOutcome` shape `judgeSpawn` returns.
 *
 * DOES NOT APPLY `requireAllProperties` ITSELF — the caller (`we:scripts/operations/cli-adapter.mjs`'s
 * Codex-selecting wrapper) does, so this function's own unit tests can exercise it against an ALREADY-VALID
 * schema without needing the transform in the loop, and so a caller with an already-strict schema is not
 * double-transformed silently.
 *
 * @param {object} opts
 * @param {string} opts.mandate
 * @param {string} opts.input
 * @param {object} opts.shape - JSON Schema, ALREADY in OpenAI-strict form (every property required).
 * @param {string} [opts.model]
 * @param {string} [opts.effort]
 * @param {number|null} [opts.budget] - ACCEPTED BUT IGNORED: Codex has no `--max-budget-usd` equivalent
 *   (`#3371`'s verdict — "does not exist and cannot be built"). Kept as an accepted (unused) option rather
 *   than refused, so a caller forwarding a whole `JudgeProviderRequest` (as `createDefaultJudge` does) does
 *   not have to special-case Codex just to omit a field every other provider request already carries.
 * @param {string[]|null} [opts.allowedTools] - must be absent/empty; see `assertNoCodexTools`.
 * @param {string|null} [opts.cwd] - a scratch directory. Defaults to a fresh `mkdtemp` — NEVER a lane, and
 *   never the caller's own cwd, since a tool-free juror has nothing to protect a shared tree from but still
 *   has no reason to load one's doctrine either (probe 9).
 * @param {Record<string,string>} [opts.env]
 * @param {string} [opts.cli]
 * @param {number} [opts.timeoutMs] - PARENT-IMPOSED wall; Codex has no CLI timeout flag (`#3371` probe 6).
 * @param {Function} [opts.spawnFn]
 * @param {(prefix: string) => string} [opts.mkTempDir] - injectable `mkdtempSync`, for tests.
 * @param {(path: string, data: string) => void} [opts.writeFile] - injectable, for tests.
 * @param {(path: string) => string} [opts.readFile] - injectable, for tests.
 * @param {(path: string, opts: object) => void} [opts.removeFile] - injectable, for tests.
 * @returns {Promise<{value: object, sessionId: string, costUsd: number, durationMs: number, wallMs: number,
 *                    numTurns: number, stopReason: string, usage: object, loadedContextTokens: number,
 *                    timedOut: boolean, argv: string[]}>}
 */
export async function codexJudgeSpawn({
  mandate,
  input,
  shape,
  model,
  effort,
  allowedTools = null,
  cwd = null,
  env = process.env,
  cli = CODEX_CLI,
  timeoutMs = JUDGE_TIMEOUT_MS,
  spawnFn = nodeSpawn,
  mkTempDir = (prefix) => mkdtempSync(prefix),
  writeFile = writeFileSync,
  readFile = (p) => readFileSync(p, 'utf8'),
  removeFile = (p, o) => rmSync(p, o),
} = {}) {
  if (typeof mandate !== 'string' || !mandate.trim()) {
    throw new TypeError('codex-judge-spawn: `mandate` must be a non-empty string');
  }
  if (typeof input !== 'string' || !input.trim()) {
    throw new TypeError('codex-judge-spawn: `input` must be a non-empty string — there is nothing to judge');
  }
  if (!shape || typeof shape !== 'object' || Array.isArray(shape)) {
    throw new TypeError('codex-judge-spawn: `shape` must be a JSON Schema object');
  }
  assertNoCodexTools(allowedTools);

  const workDir = mkTempDir(join(tmpdir(), 'codex-judge-'));
  const spawnCwd = cwd || workDir;
  const schemaFile = join(workDir, 'schema.json');
  const outputLastMessageFile = join(workDir, 'last-message.txt');
  writeFile(schemaFile, JSON.stringify(shape));

  const argv = buildCodexJudgeArgv({ schemaFile, outputLastMessageFile, cwd: spawnCwd, model, effort });
  const prompt = buildCodexPrompt(mandate, input);

  const startedAt = Date.now();
  let result;
  let lastMessage = null;
  try {
    result = await new Promise((resolve, reject) => {
      let child;
      try {
        child = spawnFn(cli, argv, { cwd: spawnCwd, env, stdio: ['pipe', 'pipe', 'pipe'] });
      } catch (e) {
        reject(new Error(`codex-judge-spawn: could not start \`${cli}\`: ${e.message}`));
        return;
      }
      let out = '';
      let err = '';
      let timer = null;
      let grace = null;
      let killed = false;
      let settled = false;
      const settle = (r) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        if (grace) clearTimeout(grace);
        resolve(r);
      };
      if (timeoutMs > 0) {
        // PARENT-IMPOSED WALL — Codex has no CLI-side timeout flag (`#3371` probe 6). Mirrors `judgeSpawn`'s
        // own SIGKILL-then-settle discipline: the kill RESOLVES rather than rejects, because a killed run's
        // partial JSONL is still line-parseable (probe 6's own finding — strictly BETTER than Claude's single
        // JSON document, which is unparseable the instant it is truncated).
        timer = setTimeout(() => {
          killed = true;
          try { child.kill('SIGKILL'); } catch { /* already gone */ }
          grace = setTimeout(() => settle({ stdout: out, stderr: err, code: null, timedOut: true }), JUDGE_TIMEOUT_GRACE_MS);
          if (typeof grace.unref === 'function') grace.unref();
        }, timeoutMs);
        if (typeof timer.unref === 'function') timer.unref();
      }
      child.stdout?.on('data', (d) => { out += d; });
      child.stderr?.on('data', (d) => { err += d; });
      child.on('error', (e) => {
        if (timer) clearTimeout(timer);
        if (grace) clearTimeout(grace);
        reject(new Error(`codex-judge-spawn: \`${cli}\` failed to run: ${e.message}`));
      });
      child.on('close', (c) => settle({ stdout: out, stderr: err, code: c, timedOut: killed }));
      // NO POSITIONAL PROMPT WAS PASSED (see `buildCodexJudgeArgv`) — the prompt rides stdin, and `.end()`
      // CLOSES it, which is the exact property that avoids probe 0's deadlock trap.
      child.stdin?.on('error', () => { /* the child may exit before we finish writing; `close` reports it */ });
      child.stdin?.end(prompt);
    });
    // READ THE LAST-MESSAGE FILE BEFORE CLEANUP — it lives inside `workDir`, which the `finally` below removes.
    // A run that never wrote it (killed before completion, probe 6) leaves this `null`, which
    // `parseCodexJudgeOutcome` falls back past.
    try { lastMessage = readFile(outputLastMessageFile); } catch { lastMessage = null; }
  } finally {
    try { removeFile(workDir, { recursive: true, force: true }); } catch { /* best-effort cleanup */ }
  }

  const wallMs = Date.now() - startedAt;

  if (result.timedOut) {
    let outcome = null;
    try { outcome = parseCodexJudgeOutcome({ stdout: result.stdout, stderr: result.stderr, lastMessage }); } catch { outcome = null; }
    if (!outcome) throw new JudgeTimeoutError({ timeoutMs, wallMs, stdout: result.stdout, stderr: result.stderr });
    return {
      ...outcome, durationMs: wallMs, wallMs, timedOut: true,
      loadedContextTokens: codexLoadedContextTokens(outcome.usage), argv,
    };
  }
  const outcome = parseCodexJudgeOutcome({
    stdout: result.stdout,
    stderr: result.stderr || (result.code === 0 ? '' : `exit code ${result.code}`),
    lastMessage,
  });
  return {
    ...outcome, durationMs: wallMs, wallMs, timedOut: false,
    loadedContextTokens: codexLoadedContextTokens(outcome.usage), argv,
  };
}
