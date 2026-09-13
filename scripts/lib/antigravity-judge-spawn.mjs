/**
 * antigravity-judge-spawn.mjs — a THIRD `JudgeProvider` PRIMITIVE (#3383, sibling of `#xqa9ttq`'s Codex work),
 * Google's Antigravity CLI (`agy`) as a genuinely TOOL-FREE judge seat — the SAFEST possible slice of the three
 * providers this repo has now probed, and DELIBERATELY nothing more than that: this module is a standalone
 * primitive, proven to run a real judge request end to end, and is NOT wired into `we:scripts/operations/
 * cli-adapter.mjs#resolveJudgeProvider` or any `judge` step. Wiring it into the panel is a separate, later item
 * — the same build order `codex-judge-spawn.mjs` followed (seat the primitive, prove it standalone, wire it
 * only once that is proven).
 *
 * WHY TOOL-FREE, AND WHY THAT IS THE SAFEST STARTING SLICE. `backlog/3633-probe-antigravity-cli-against-the-
 * judge-contract.md` (probe 13, run live against `agy` 1.2.1) found `--sandbox` confines only the CLI's
 * SHELL — `run_command` — while `agy`'s 57 IN-PROCESS tools (`view_file`, `write_to_file`, `replace_file_
 * content`, …) walk around it entirely: a sandboxed agent was DENIED a `cat`/`head`/write via the shell and
 * then read and wrote the exact same files a heartbeat later using its own file tools, undetected by the
 * sandbox and self-reported (wrongly) as "denied" in its own final answer. That makes any WRITE-capable
 * Antigravity seat genuinely risky today: no flag combination the probe found actually confines it. A
 * tool-free seat sidesteps that hole STRUCTURALLY rather than by convention — this module never passes
 * `--dangerously-skip-permissions` (the flag that unlocks tool execution at all), so EVERY tool call the model
 * attempts — shell or in-process alike — is auto-denied by `agy`'s own headless permission check, confirmed
 * live twice while building this module (see "LIVE RE-CONFIRMATION" below): the same run that tries `list_dir`
 * or `run_command` gets `TOOL_ERROR` / "user denied permission" for EACH attempt, never a bypass. There is
 * nothing here for `--sandbox`'s known hole to exploit, because nothing is ever allowed to execute in the
 * first place — which is also why this module never passes `--sandbox` at all: it would be a false sense of
 * confinement layered over a seat that already cannot act.
 *
 * MIRRORS `we:scripts/lib/codex-judge-spawn.mjs`'S OWN SHAPE, DELIBERATELY. Same `JudgeProvider` port
 * (`(request: JudgeProviderRequest) => Promise<JudgeProviderOutcome>`, `we:scripts/lib/judge-spawn.mjs`), same
 * PURE-ARGV / PURE-PARSE split (`buildAntigravityJudgeArgv` / `parseAntigravityJudgeOutcome`, both spawn
 * nothing), same injectable `spawnFn`/temp-file helpers for testability, same "assertNoXToolAllowlist" guard
 * shape, same three unfillable port fields handled the same honest way. Where `agy`'s CONTRACT actually
 * differs from Codex's, it is recorded here rather than copied blind — see the numbered list below.
 *
 * EVERY CLAIM BELOW WAS PROVEN LIVE. `backlog/3633-...md`'s own 20 probes (2026-09-11, `agy` 1.2.1, a real
 * Google AI Pro subscription) are the evidentiary record for the CLI's general contract; this module ALSO
 * re-ran the specific probes its own design leans on WHILE BEING WRITTEN (same machine, same `agy` 1.2.1,
 * 2026-09-13) — see "LIVE RE-CONFIRMATION" below for exactly what was re-proven and what is new since #3633.
 *
 * WHAT DIFFERS FROM `codex-judge-spawn.mjs`, EACH RECORDED WHERE IT DIFFERS:
 *
 *   1. THE TRANSPORT IS `--input-format stream-json` / `--output-format stream-json`, NOT `agy`'s own default
 *      `--print '<prompt>' --output-format json`. #3633 probe 5 found `--print` takes the prompt as a FLAG
 *      VALUE (not a positional) with NO stdin route in plain `json` mode — the judged material would have to
 *      ride argv, which is the opposite of `judgeSpawn`'s "material on stdin" discipline. Probe 5b's
 *      UNDOCUMENTED stream-json route restores it: the prompt is an NDJSON `user` event on stdin
 *      (`{"event":"user","message":{"role":"user","content":"…"}}`), `--print ''` stays empty, and the
 *      answer arrives on the LAST line, an `{"event":"result","result":{…}}` object. Confirmed again live
 *      while building this module (see below).
 *
 *   2. THE ANSWER IS NESTED, one level deeper than #3633's own prose implied. In `--output-format json` mode
 *      (probe 1) the fields (`status`, `structured_output`, `usage`, …) sit at the TOP of the one JSON
 *      document. In `--output-format stream-json` mode — the route this module actually uses — those same
 *      fields sit ONE LEVEL DEEPER, under the `result` KEY of the `{"event":"result", ...}` line:
 *      `parsed.result.structured_output`, not `parsed.structured_output`. #3633's own prose ("the answer
 *      arrives on the `{"event":"result", …}` line, same `structured_output` field") is true but easy to
 *      misread as flat; `parseAntigravityJudgeOutcome` below reads `line.result.*`, confirmed against a real
 *      spawn's raw JSONL (see "LIVE RE-CONFIRMATION").
 *
 *   3. NO SCHEMA TRANSFORM, AT ALL — the single biggest difference from Codex. `#3371`'s Codex module exists
 *      largely to satisfy OpenAI's strict "every property must be `required`" structured-output dialect
 *      (`requireAllProperties`/`stripNulls`). #3633 probe 3 sent this repo's REAL `REVIEW_JUDGE_SHAPE` —
 *      fourteen `findings[]` properties, one (`summary`) required — to `agy` UNTRANSFORMED and it was
 *      accepted; probe 4 found an omitted optional field comes back ABSENT, never `null`. So this module's
 *      `shape` parameter is sent EXACTLY as given — no `requireAllProperties`-equivalent exists here, and none
 *      is needed.
 *
 *   4. NO SANDBOX FLAG (see the block above) and NO ALLOWLIST MECHANISM EITHER — the flag surface (`agy
 *      --help`, #3633) has no `--tools`/`--allowedTools` at all, only `--dangerously-skip-permissions` (all)
 *      or nothing (auto-deny). `assertNoAntigravityToolAllowlist` below refuses a request carrying
 *      `allowedTools` for the same reason `codex-judge-spawn.mjs`'s guard does: there is no configurable
 *      allow-list here for such a list to apply to, and this provider's ceiling — genuinely ZERO working
 *      tools — is fixed by simply never passing the one flag that would unlock any.
 *
 *   5. `--disable-slash-commands` IS MANDATORY, WITH NO CODEX COUNTERPART. #3633 probe 19: slash-command
 *      expansion is ON BY DEFAULT in print mode, and a prompt whose TEXT happens to start with `/settings` (or
 *      any registered slash command) can be answered by the CLI ITSELF, with NO model call at all
 *      (`conversation_id: ""`) — a prompt-injection surface with no analogue in either `judge-spawn.mjs` or
 *      `codex-judge-spawn.mjs`. This module passes `--disable-slash-commands` UNCONDITIONALLY; there is no
 *      parameter that can omit it.
 *
 *   6. THE SILENT-EMPTY-ANSWER FAILURE MODE (#3633 probe 7), THE MOST DANGEROUS SHAPE FOUND, AND THE ONE THIS
 *      MODULE IS BUILT AROUND. Because no tool is ever unlocked (see above), any prompt that leads the model to
 *      reach for one — even ordinarily, with no adversarial intent — ends the turn with exit 0, `result.status:
 *      "SUCCESS"`, `result.response: ""`, and `result.structured_output` KEY ABSENT ENTIRELY (never `null`,
 *      never an empty object — genuinely not present). `parseAntigravityJudgeOutcome` therefore checks for the
 *      KEY'S PRESENCE, not its truthiness, and THROWS `AntigravityToolDeniedError` — carrying `result.
 *      denied_actions` and stderr's own diagnostic line — whenever it is absent, regardless of `status` or
 *      exit code. Trusting either would silently record a juror that said nothing as a clean, empty-findings
 *      accept — precisely the `#x0p5k2q` class `we:scripts/lib/review-core.mjs`'s `REVIEW_JUDGE_SHAPE` guards
 *      against on the Claude path, reproduced here for a structurally different reason (auto-denial, not a
 *      juror choosing silence).
 *
 *   7. THREE PORT FIELDS CANNOT BE FILLED HONESTLY, same as Codex and for the same reasons: `costUsd` is always
 *      `0` (#3633 probe 18 — no USD figure anywhere, only token counts, and a `FetchQuotaStatus` RPC exists in
 *      the binary with no CLI surface); `sessionId` is OBSERVED off the `result.conversation_id` field (or the
 *      `init` event's own `conversation_id`, identical value), never derived up front the way `judgeSpawn`'s
 *      `deriveSessionId` is; a `budget` on the request is ACCEPTED but has NO EFFECT (`--max-budget-usd` has no
 *      `agy` equivalent) — kept as an accepted, unused option so a caller forwarding a whole
 *      `JudgeProviderRequest` need not special-case this provider just to omit one field.
 *
 * LIVE RE-CONFIRMATION (2026-09-13, this machine, `agy` 1.2.1, building this exact module — not quoted from
 * #3633, independently reproduced):
 *   - The stream-json route (item 1) ran end to end against `we:scripts/lib/__tests__/judge-spawn.integration.
 *     test.mjs`'s own toy schema: exit 0, a `result` event whose `structured_output` held the schema-shaped
 *     answer.
 *   - The nesting (item 2) was read directly off that raw JSONL — `result.result.structured_output`, not
 *     `result.structured_output` — confirming #3633's prose the hard way.
 *   - The silent-empty-answer failure (item 6) was reproduced on demand: a prompt asking the (tool-FREE, no
 *     `--dangerously-skip-permissions`) juror to run `git status` produced two `TOOL_ERROR` step events
 *     (`list_dir`, then `run_command`, each "permission check failed" / "user denied permission"), then a
 *     `result` event with `status: "SUCCESS"`, `response: ""`, `structured_output` ABSENT, and
 *     `denied_actions: [{"action":"command","display_name":"RunCommand"}]` — exit code 0 throughout, and
 *     stderr carried `jetski: no output produced — a tool required the "command" permission that headless
 *     mode cannot prompt for, so it was auto-denied. … re-run with --dangerously-skip-permissions to
 *     auto-approve all tools.` (which this module never does).
 *   - `--disable-slash-commands` (item 5) was re-tested against a bare `/settings` prompt: unlike #3633's own
 *     probe (which reported an immediate `rc=2` refusal on that exact input in stream-json mode), this run
 *     instead engaged the model normally — a real `conversation_id`, real tool reads, and a genuine schema-
 *     constrained answer about settings, rather than the CLI intercepting the string as a command. Recorded
 *     as an HONEST DISCREPANCY from #3633's own prose on that one sub-case, not silently smoothed over — but
 *     it does not weaken the mandatory-flag design: what actually matters (the string was judged as DATA, and
 *     no free CLI-internal answer bypassed the model) held either way.
 *   - `--effort` alone (no `--model`) was confirmed to work with no CLI complaint; an invalid `--effort` value
 *     produced BOTH a stderr line and a stream-json `result` event with `status: "ERROR"` before any API call,
 *     exit 1 — confirming #3633 probe 9's "fails fast, in the request event" finding survives the stream-json
 *     route too.
 *
 * PURE except `antigravityJudgeSpawn`, which spawns a subprocess and writes/removes a temp file, and takes an
 * injectable `spawnFn` exactly like `judgeSpawn`/`codexJudgeSpawn` do. `buildAntigravityJudgeArgv`,
 * `buildAntigravityPrompt`, `buildAntigravityStreamInput` and `parseAntigravityJudgeOutcome` are pure.
 *
 * A LEAF MODULE, DELIBERATELY — imports nothing from the review/jury seams, mirroring `judge-spawn.mjs`'s and
 * `codex-judge-spawn.mjs`'s own "A LEAF module" discipline (see the latter's header for the concrete
 * `markdown-it`/ephemeral-clone-CLI-test regression that discipline exists to prevent).
 */

import { spawn as nodeSpawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JUDGE_TIMEOUT_GRACE_MS, JUDGE_TIMEOUT_MS, JudgeTimeoutError } from './judge-spawn.mjs';

/** The CLI this provider runs as. Named once, exactly like `judge-spawn.mjs`'s `JUDGE_CLI` and
 *  `codex-judge-spawn.mjs`'s `CODEX_CLI`. */
export const ANTIGRAVITY_CLI = 'agy';

/**
 * #3383 — THE PINNED MODEL for a review-panel seat backed by this provider (`review-pr.mjs`'s
 * `judgeAntigravityReview`, the fifth seat), mirroring `codex-direct-task.mjs#CODEX_MODEL`'s role for the
 * Codex seats: a stampable `{provider, model}` identity for `model-probation.json`, rather than whatever `agy`
 * resolves implicitly (#3633 probe 9 — the CLI's own undocumented default self-reports as "Gemini 3.8 Flash"
 * with NO exposed effort tier, so a run record could not even stamp what it actually asked for).
 *
 * `gemini-3.1-pro` — a BARE model id from `agy`'s own roster (#3633 probe 9's "ten models" enumeration) —
 * deliberately NOT one of the effort-SUFFIXED ids (`gemini-3.8-flash-medium` and friends). Probe 9 also found
 * effort is "either a model-id suffix or the flag, never both": a suffixed id conflicts with a separately
 * passed `--effort`, while a bare id like this one REQUIRES `--effort` as its own flag (available `low|high`
 * for this specific model). This module's seat always supplies one explicitly (see `ANTIGRAVITY_REVIEW_EFFORT`
 * in `review-pr.mjs`), so pinning a bare id here is what keeps the two flags from ever landing on the same
 * argv in a way `agy` refuses.
 *
 * NO LIVE COST/QUALITY COMPARISON HAS BEEN RUN across `agy`'s ten models for this role, unlike the Codex fourth
 * seat's measured medium-vs-max comparison (`CORRECTNESS_ADVISORY_EFFORT`'s own docblock) — stated honestly:
 * this is a deliberately modest, defensible starting pin for a seat with ZERO real review trials (see
 * `model-probation.json`'s own entry for this identity), not a benchmarked choice. Revisit once probation data
 * (#3649's run-quality recorder) accumulates.
 */
export const ANTIGRAVITY_MODEL = 'gemini-3.1-pro';

/**
 * The shared care→rigor dial's effort enum (`judge-spawn.mjs#EFFORT_LEVELS`) does not match `agy`'s own
 * `--effort` values one-to-one — #3633 probe 9: `agy --effort` accepts exactly `low`, `medium`, `high`.
 * `xhigh`/`max` CLAMP DOWN to `high` rather than being refused, mirroring `codex-judge-spawn.mjs`'s own
 * `CODEX_EFFORT_MAP` reasoning exactly: a clamp is a degraded-but-working request, a refusal is a request that
 * cannot run at all. RE-DERIVE if `agy` ever adds a level above `high`.
 */
export const ANTIGRAVITY_EFFORT_MAP = Object.freeze({
  low: 'low',
  medium: 'medium',
  high: 'high',
  xhigh: 'high',
  max: 'high',
});

/**
 * #3633 probe 7, reproduced live while building this module (see the file header's "LIVE RE-CONFIRMATION") —
 * the single most dangerous failure shape found across all three providers this repo has probed: a run that
 * reaches for a tool it structurally cannot use ends with exit 0, `status: "SUCCESS"`, an empty `response`,
 * and `structured_output` ABSENT rather than merely empty. A NEW CLASS with no Codex counterpart (Codex's
 * read-only shell lets `git status` succeed; `agy`'s auto-deny refuses the attempt outright) — collapsing it
 * into a generic "the juror failed" `Error` would read as "the model got it wrong" when the real fact is "the
 * model tried to act and this seat cannot act at all". Carries `deniedActions` (the CLI's own
 * `result.denied_actions` array, when present) so a caller can see WHAT was attempted without re-parsing
 * stderr.
 */
export class AntigravityToolDeniedError extends Error {
  constructor({ deniedActions, stderr, raw }) {
    const actions = Array.isArray(deniedActions) && deniedActions.length
      ? deniedActions.map((a) => a?.display_name || a?.action || JSON.stringify(a)).join(', ')
      : '(none reported)';
    const tail = String(stderr || '').trim().slice(-600);
    super(
      'antigravity-judge-spawn: the juror reached for a tool this TOOL-FREE seat cannot use, and headless mode '
      + 'auto-denied it — the turn still reports exit 0 and `status: "SUCCESS"`, but `structured_output` is '
      + `ABSENT (#3633 probe 7). Denied action(s): ${actions}.`
      + (tail ? `\nstderr[-600..]: ${tail}` : '\nstderr: <empty>')
      + '\nThis is a hard failure regardless of `status` — trusting either would silently record a juror that '
      + 'said nothing as a clean accept. Re-run with a mandate that does not invite tool use, or seat a '
      + 'tool-bearing provider instead.',
    );
    this.name = 'AntigravityToolDeniedError';
    this.deniedActions = Array.isArray(deniedActions) ? deniedActions : [];
    this.raw = raw;
  }
}

/**
 * Refuses a `JudgeProviderRequest` carrying `allowedTools` — mirrors `codex-judge-spawn.mjs#
 * assertNoCodexToolAllowlist` exactly, for the analogous reason: `agy`'s flag surface (#3633) has NO
 * per-tool allow-list mechanism at all, only the all-or-nothing `--dangerously-skip-permissions`, which this
 * module never passes. This provider's ceiling — genuinely ZERO working tools, stronger than Codex's
 * read-only shell — is fixed by that omission, not by a configurable list.
 * @param {string[]|null|undefined} allowedTools
 */
export function assertNoAntigravityToolAllowlist(allowedTools) {
  if (allowedTools === null || allowedTools === undefined) return;
  if (Array.isArray(allowedTools) && allowedTools.length === 0) return;
  throw new Error(
    'antigravity-judge-spawn: refusing a request with an `allowedTools` list — this provider has no '
    + 'configurable tool allow-list to apply it to. It never passes `--dangerously-skip-permissions`, so '
    + 'EVERY tool call (shell or in-process) is auto-denied by `agy` itself (#3633 probe 7) — the ceiling is '
    + 'fixed by that omission, not by an allow-list. Omit `allowedTools`, or use a tool-bearing provider for '
    + 'an allow-listed role.',
  );
}

/**
 * THE PURE HALF: the `agy` argv, translated from `#3633`'s probes (5b, 9, 19) and this module's own live
 * re-confirmation. Spawns nothing, writes no file, reads no environment.
 *
 * NEVER `--dangerously-skip-permissions` (there is no parameter that adds it — that is what keeps this seat
 * genuinely tool-free) and NEVER `--sandbox` (pointless here: with no tool ever unlocked, there is nothing for
 * `--sandbox`'s own known bypass — #3633 probe 13, `view_file`/`write_to_file` walking around a sandboxed
 * shell — to exploit; adding it would only imply a confinement this seat does not need).
 *
 * @param {object} opts
 * @param {string} opts.schemaFile - path a caller has ALREADY written the JSON Schema to (sent UNTRANSFORMED —
 *   see the file header's item 3; there is no `requireAllProperties`-equivalent for this provider).
 * @param {string} [opts.model] - `agy`'s `--model`.
 * @param {string} [opts.effort] - one of `judge-spawn.mjs`'s `EFFORT_LEVELS`; mapped via `ANTIGRAVITY_EFFORT_MAP`.
 * @returns {string[]} argv AFTER the binary name.
 */
export function buildAntigravityJudgeArgv({ schemaFile, model, effort } = {}) {
  if (typeof schemaFile !== 'string' || !schemaFile.trim()) {
    throw new TypeError('antigravity-judge-spawn: `schemaFile` must be a non-empty path');
  }
  const argv = [
    '--input-format', 'stream-json',
    '--output-format', 'stream-json',
    // MANDATORY, UNCONDITIONALLY — #3633 probe 19's prompt-injection surface (see file header item 5). No
    // parameter here can omit this.
    '--disable-slash-commands',
    '--json-schema', schemaFile,
  ];
  if (model !== undefined) {
    if (typeof model !== 'string' || !model.trim() || model.trim().startsWith('-')) {
      throw new TypeError(`antigravity-judge-spawn: \`model\` must be a plain non-empty string, got ${JSON.stringify(model)}`);
    }
    argv.push('--model', model.trim());
  }
  if (effort !== undefined) {
    const mapped = ANTIGRAVITY_EFFORT_MAP[effort];
    if (!mapped) {
      throw new TypeError(`antigravity-judge-spawn: \`effort\` must be one of ${Object.keys(ANTIGRAVITY_EFFORT_MAP).join('|')}, got ${JSON.stringify(effort)}`);
    }
    argv.push('--effort', mapped);
  }
  // `--print ''` — the prompt rides stdin as a stream-json `user` event instead (see
  // `buildAntigravityStreamInput`); an EMPTY value is required in this mode (#3633 probe 5b), never omitted
  // (omitting `--print` entirely is plain-text mode, which has no stdin route at all — see the file header).
  argv.push('--print', '');
  return argv;
}

/**
 * Fold the mandate into the prompt text — `agy` has no `--append-system-prompt` equivalent (#3633's flag
 * surface), same gap Codex has. A clearly-labelled two-part text, not a silent concatenation, mirroring
 * `codex-judge-spawn.mjs#buildCodexPrompt` exactly.
 * @param {string} mandate
 * @param {string} input
 * @returns {string}
 */
export function buildAntigravityPrompt(mandate, input) {
  return `${mandate}\n\n---\n\nThe material to judge follows.\n\n${input}`;
}

/**
 * Wrap the prompt in the stream-json `user` event `agy --input-format stream-json` requires (#3633 probe 5b,
 * the undocumented route recovered by probing the binary's own validation errors). ONE line, newline-
 * terminated — `agy` reads NDJSON, one event per line.
 * @param {string} prompt
 * @returns {string}
 */
export function buildAntigravityStreamInput(prompt) {
  return `${JSON.stringify({ event: 'user', message: { role: 'user', content: prompt } })}\n`;
}

/** One parsed JSONL line, or `null` for a blank/unparsable one. Never throws. Mirrors
 *  `codex-judge-spawn.mjs`'s own `parseJsonlLine`. */
function parseJsonlLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try { return JSON.parse(trimmed); } catch { return null; }
}

/**
 * THE OTHER PURE HALF: `agy`'s raw stdout (stream-json JSONL) into a validated result or a throw. Mirrors
 * `parseJudgeOutcome`/`parseCodexJudgeOutcome`'s discipline — fail loud, fail with the spawn's own words.
 *
 * THE ANSWER IS THE `result` EVENT'S OWN `result` OBJECT (file header item 2) — `line.result.*`, not
 * `line.*`. Scanned from the END, mirroring `codex-judge-spawn.mjs`'s "terminal event is the last one" rule,
 * though in practice `agy` emits exactly one `result` event per turn, always last.
 *
 * @param {object} o
 * @param {string} o.stdout - raw stream-json JSONL stdout.
 * @param {string} [o.stderr] - folded in on any failure path — some `agy` failures never reach stdout at all
 *   (#3633 probe 8: a missing schema file), and the silent-empty-answer shape (probe 7) carries its own
 *   explanation on stderr only.
 * @returns {{value: object, sessionId: string, costUsd: number, numTurns: number, stopReason: string,
 *            usage: object}}
 * @throws {AntigravityToolDeniedError} on the silent-empty-answer shape (`status: "SUCCESS"`, no
 *   `structured_output`) — see the file header item 6.
 * @throws {Error} on any other terminal failure (`status: "ERROR"`), or on no terminal event at all.
 */
export function parseAntigravityJudgeOutcome({ stdout, stderr = '' } = {}) {
  const lines = String(stdout).split('\n').map(parseJsonlLine).filter(Boolean);

  let terminal = null;
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (lines[i]?.event === 'result' && lines[i]?.result && typeof lines[i].result === 'object') {
      terminal = lines[i].result;
      break;
    }
  }

  if (!terminal) {
    // No `result` event at all. #3633 probe 8: a missing/malformed schema file produces EMPTY stdout with the
    // reason on stderr only — fold it in, exactly as `parseJudgeOutcome`/`parseCodexJudgeOutcome` do.
    const tail = String(stderr).trim().slice(-600);
    throw new Error(
      'antigravity-judge-spawn: the juror produced no terminal `{"event":"result", ...}` line.\n'
      + `stdout[0..600]: ${String(stdout).slice(0, 600)}\n`
      + (tail ? `stderr[-600..]: ${tail}` : 'stderr: <empty>'),
    );
  }

  if (terminal.status === 'ERROR') {
    // THE CLI'S OWN WORDS, VERBATIM — never reworded, exactly like `parseJudgeOutcome`'s `--bare` passthrough
    // and `parseCodexJudgeOutcome`'s `turn.failed` handling. #3633 probe 9/17: an invalid model/effort
    // selection or an auth failure both land here, fast and with the reason already in `terminal.error`.
    const tail = String(stderr).trim().slice(-600);
    throw new Error(
      `antigravity-judge-spawn: the juror failed: ${terminal.error || '<no error message>'}`
      + (tail ? `\nstderr[-600..]: ${tail}` : ''),
    );
  }

  // #3633 probe 7, reproduced live (file header item 6) — THE SILENT EMPTY ANSWER. `status: "SUCCESS"` and
  // exit 0 are NOT enough: `structured_output` must be checked for PRESENCE, not truthiness (an honest zero-
  // findings answer is a present, non-empty OBJECT — `{findings: [], summary: '...'}` — never an absent key).
  if (!('structured_output' in terminal) || terminal.structured_output === undefined) {
    throw new AntigravityToolDeniedError({
      deniedActions: terminal.denied_actions, stderr, raw: terminal,
    });
  }
  const { structured_output: structuredOutput } = terminal;
  if (!structuredOutput || typeof structuredOutput !== 'object' || Array.isArray(structuredOutput)) {
    throw new Error(
      `antigravity-judge-spawn: the juror's \`structured_output\` was not a JSON object: `
      + `${JSON.stringify(structuredOutput).slice(0, 200)}`,
    );
  }

  return {
    value: structuredOutput,
    sessionId: typeof terminal.conversation_id === 'string' ? terminal.conversation_id : '',
    // #3633 probe 18 — no USD figure exists anywhere in `agy`'s output. Reported as 0, never estimated.
    costUsd: 0,
    numTurns: typeof terminal.num_turns === 'number' ? terminal.num_turns : 0,
    stopReason: terminal.status,
    usage: terminal.usage ?? {},
  };
}

/** Sum of the token fields `agy` reports as "loaded" — its own key names (#3633 probe 10: `input_tokens` +
 *  `cache_read_tokens` is the comparable "context" figure; `total_tokens` alone excludes the cache-read half). */
export function antigravityLoadedContextTokens(usage = {}) {
  const n = (k) => (typeof usage?.[k] === 'number' ? usage[k] : 0);
  return n('input_tokens') + n('cache_read_tokens');
}

/**
 * THE ONE FUNCTION AN ANTIGRAVITY-BACKED `judge` STEP WOULD CALL — not yet called by any (see the file
 * header: this is a standalone, unwired primitive). Spawns a tool-free `agy` juror and returns its validated
 * answer, in the same `JudgeProviderOutcome` shape `judgeSpawn`/`codexJudgeSpawn` return.
 *
 * DOES NOT TRANSFORM `shape` — unlike `codexJudgeSpawn`, there is nothing to transform (file header item 3).
 *
 * @param {object} opts
 * @param {string} opts.mandate
 * @param {string} opts.input
 * @param {object} opts.shape - JSON Schema, sent EXACTLY as given.
 * @param {string} [opts.model]
 * @param {string} [opts.effort]
 * @param {number|null} [opts.budget] - ACCEPTED BUT IGNORED: `agy` has no `--max-budget-usd` equivalent
 *   (#3633 probe 18). Kept as an accepted (unused) option for the same reason `codexJudgeSpawn`'s is.
 * @param {string[]|null} [opts.allowedTools] - must be absent/empty; see `assertNoAntigravityToolAllowlist`.
 * @param {string|null} [opts.cwd] - a scratch directory. Defaults to a fresh `mkdtemp`. Genuinely inert here:
 *   with no tool ever unlocked, the juror cannot read OR write anything regardless of cwd — stronger than
 *   Codex's read-only shell, which can still read.
 * @param {Record<string,string>} [opts.env]
 * @param {string} [opts.cli]
 * @param {number} [opts.timeoutMs] - PARENT-IMPOSED wall; `agy`'s own `--print-timeout` (default 5m0s) exists
 *   but does NOT cap its internal 60s auth-wait (#3633 probe 17), so this remains the real ceiling, exactly as
 *   for the other two providers. Never passed to `agy` itself — this module relies solely on the SIGKILL below.
 * @param {Function} [opts.spawnFn]
 * @param {(prefix: string) => string} [opts.mkTempDir] - injectable `mkdtempSync`, for tests.
 * @param {(path: string, data: string) => void} [opts.writeFile] - injectable, for tests.
 * @param {(path: string, opts: object) => void} [opts.removeFile] - injectable, for tests.
 * @returns {Promise<{value: object, sessionId: string, costUsd: number, durationMs: number, wallMs: number,
 *                    numTurns: number, stopReason: string, usage: object, loadedContextTokens: number,
 *                    timedOut: boolean, argv: string[]}>}
 */
export async function antigravityJudgeSpawn({
  mandate,
  input,
  shape,
  model,
  effort,
  allowedTools = null,
  cwd = null,
  env = process.env,
  cli = ANTIGRAVITY_CLI,
  timeoutMs = JUDGE_TIMEOUT_MS,
  spawnFn = nodeSpawn,
  mkTempDir = (prefix) => mkdtempSync(prefix),
  writeFile = writeFileSync,
  removeFile = (p, o) => rmSync(p, o),
} = {}) {
  if (typeof mandate !== 'string' || !mandate.trim()) {
    throw new TypeError('antigravity-judge-spawn: `mandate` must be a non-empty string');
  }
  if (typeof input !== 'string' || !input.trim()) {
    throw new TypeError('antigravity-judge-spawn: `input` must be a non-empty string — there is nothing to judge');
  }
  if (!shape || typeof shape !== 'object' || Array.isArray(shape)) {
    throw new TypeError('antigravity-judge-spawn: `shape` must be a JSON Schema object');
  }
  assertNoAntigravityToolAllowlist(allowedTools);

  const workDir = mkTempDir(join(tmpdir(), 'antigravity-judge-'));
  const spawnCwd = cwd || workDir;
  const schemaFile = join(workDir, 'schema.json');
  writeFile(schemaFile, JSON.stringify(shape));

  const argv = buildAntigravityJudgeArgv({ schemaFile, model, effort });
  const streamInput = buildAntigravityStreamInput(buildAntigravityPrompt(mandate, input));

  const startedAt = Date.now();
  let result;
  try {
    result = await new Promise((resolve, reject) => {
      let child;
      try {
        child = spawnFn(cli, argv, { cwd: spawnCwd, env, stdio: ['pipe', 'pipe', 'pipe'] });
      } catch (e) {
        reject(new Error(`antigravity-judge-spawn: could not start \`${cli}\`: ${e.message}`));
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
        // PARENT-IMPOSED WALL — `agy` has no CLI-side timeout that covers every wait (#3633 probe 17: its own
        // `--print-timeout` does not bound the internal auth wait). Mirrors `judgeSpawn`/`codexJudgeSpawn`'s
        // own SIGKILL-then-settle discipline: the kill RESOLVES rather than rejects, since a killed run's
        // partial JSONL is still line-parseable.
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
        reject(new Error(`antigravity-judge-spawn: \`${cli}\` failed to run: ${e.message}`));
      });
      child.on('close', (c) => settle({ stdout: out, stderr: err, code: c, timedOut: killed }));
      // The prompt rides stdin as ONE stream-json event, and `.end()` CLOSES the stream — the same property
      // that keeps `judgeSpawn`/`codexJudgeSpawn` safe from a "prompt as argv + open stdin" deadlock (a class
      // #3633 probe 5 found `agy` does NOT actually have, but this module never relies on that being true).
      child.stdin?.on('error', () => { /* the child may exit before we finish writing; `close` reports it */ });
      child.stdin?.end(streamInput);
    });
  } finally {
    try { removeFile(workDir, { recursive: true, force: true }); } catch { /* best-effort cleanup */ }
  }

  const wallMs = Date.now() - startedAt;

  if (result.timedOut) {
    let outcome = null;
    try { outcome = parseAntigravityJudgeOutcome({ stdout: result.stdout, stderr: result.stderr }); } catch { outcome = null; }
    if (!outcome) throw new JudgeTimeoutError({ timeoutMs, wallMs, stdout: result.stdout, stderr: result.stderr });
    return {
      ...outcome, durationMs: wallMs, wallMs, timedOut: true,
      loadedContextTokens: antigravityLoadedContextTokens(outcome.usage), argv,
    };
  }
  const outcome = parseAntigravityJudgeOutcome({
    stdout: result.stdout,
    stderr: result.stderr || (result.code === 0 ? '' : `exit code ${result.code}`),
  });
  return {
    ...outcome, durationMs: wallMs, wallMs, timedOut: false,
    loadedContextTokens: antigravityLoadedContextTokens(outcome.usage), argv,
  };
}
