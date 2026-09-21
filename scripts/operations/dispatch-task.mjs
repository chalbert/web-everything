/**
 * @file scripts/operations/dispatch-task.mjs
 * @description THE `dispatch-task` DECLARATION (#3730, under #3718; prompt template from #3752 point 1) — start a
 *   background worker from a BRIEF FILE, leaving the same durable run record every `dispatch-lane` launch leaves.
 *
 * WHY IT EXISTS. `dispatch-lane` has no generic "run this brief" kind: each of its kinds is tied to a backlog item
 * and a fixed brief template. A hand-launched worker therefore went out as a raw `claude --bg` call with the
 * prompt `Read <brief>`, plus a job file the operator kept by hand in a folder this repo never mentions. Two
 * workers read the brief and stopped (#3752). This operation is the one route a brief-file worker takes: the
 * launch prompt says the brief IS the instruction, the launch is a run record, and the job-file view is a
 * PROJECTION of run records ({@link projectJobs}), never a second store.
 *
 * IT DECLARES OVER THE EXISTING SPAWN; IT DOES NOT ADD ONE. The statute
 * [#conveyor-dispatch-calls-the-declared-operation](../../docs/agent/platform-decisions.md#conveyor-dispatch-calls-the-declared-operation)
 * forbids a second spawn implementation, so the sink in {@link ./dispatch-task-io.mjs} calls
 * `dispatch-lane-io.mjs#defaultClaudeProvider` (which is `buildAgentArgv` + `defaultSpawnAgent`) and adds only
 * the flags this operation owns.
 *
 * ── THE THREE STEPS ────────────────────────────────────────────────────────────────────────────────────────
 *
 *   | step       | kind      | what it does                                                                 |
 *   |------------|-----------|------------------------------------------------------------------------------|
 *   | `read`     | `compute` | shape ONE injected `readTask` call: the brief on disk + any run already holding the slug |
 *   | `plan`     | `compute` | the verdict: dispatching or refusing, and the launch prompt                  |
 *   | `dispatch` | `effect`  | declares ONE `dispatch: true` effect, or NONE when the plan refused          |
 *
 * ONE EFFECT TYPE WITH `dispatch-lane`, ON PURPOSE ({@link DISPATCH_EFFECT}). `runner-activity` and the waker's
 * observer read in-flight dispatches by that type, so a brief-file worker shows up as an in-flight dispatch with
 * a liveness stamp with no change to either. The cost is named, not hidden: `launchKind` here is a free label
 * (`task` by default), which `runner-activity` prints as `unknown` because it is not one of `LAUNCH_KINDS`.
 *
 * A SECOND CALL WITH THE SAME SLUG IS REFUSED, NOT DOUBLE-SPAWNED. The guard is the run record: any in-flight
 * dispatch whose payload carries the same `sessionSlug` holds, judged by the SAME `dispatchStillHolds` rule the
 * lane guard uses (a live session holds at any age; a session listed as gone ages out; an unknown liveness falls
 * back to the clock). A refusal is a first-class verdict with a reason, exit code 1, and no effect declared.
 *
 * ── WHAT THE ORCHESTRATOR STILL DOES ────────────────────────────────────────────────────────────────────────
 *
 * The idle-notice subscription is `SendMessage notify_when_idle`, a harness tool a script cannot call. So the
 * operation EMITS exactly what to subscribe to ({@link subscribeTarget}: the agent name and the session id) and
 * the orchestrator subscribes. Whether the harness or the dispatcher owns that call stays open on #3752.
 *
 * PURE. No fs, no clock, no process, no network in this file.
 */

import { op } from './registry.mjs';
import { compute, effect as effectStep } from './step-kinds.mjs';
import { DEFAULT_EXPECTED_WITHIN_MINUTES, DISPATCH_EFFECT, dispatchStillHolds } from './dispatch-lane.mjs';
import { isValidSessionSlug } from './completion-record.mjs';

/** The operation's stable id. Adapters resolve it by this name. */
export const DISPATCH_TASK_OP = 'dispatch-task';

/** The default `--kind` label a brief-file worker carries. */
export const TASK_LAUNCH_KIND = 'task';

/**
 * The permission modes `claude --permission-mode` accepts (CLI 2.1.278, `claude --help`). A closed list so a typo
 * is refused before a session exists rather than after a worker sits on a prompt nobody answers.
 */
export const PERMISSION_MODES = Object.freeze(['acceptEdits', 'auto', 'bypassPermissions', 'manual', 'dontAsk', 'plan']);

/**
 * THE DEFAULT PERMISSION MODE for a worker this operation launches. `auto`, because `acceptEdits` hangs a
 * background session on the first Bash prompt with nobody there to answer it (operator, 2026-09-21). An explicit
 * `--permissionMode=` overrides it; `--dangerously-skip-permissions` is never a default
 * (`dispatch-lane-io.mjs` says why).
 */
export const DEFAULT_PERMISSION_MODE = 'auto';

/**
 * THE LAUNCH PROMPT — the ONE function every brief-file launch builds its prompt from (#3752 point 1). The
 * wording is here and nowhere else: two sessions once read a brief given as `Read <brief>` and stopped, because
 * they took it for data. So the prompt states outright that the brief IS the instruction, to carry it out
 * completely (result file included), and not to stop after reading.
 *
 * It also names the completion report, which is what lets the job view derive `state` and `result` with no
 * hand edit: `completion-cli.mjs report` writes the completion record the projection reads.
 *
 * MUST NOT begin with `-` (`buildAgentArgv` refuses it: an argument parser can read it as a flag).
 *
 * @param {{briefPath: string, session: string}} o
 * @returns {string}
 */
export function buildBriefLaunchPrompt({ briefPath, session } = {}) {
  if (!briefPath) throw new TypeError('dispatch-task: a launch prompt needs the brief path');
  if (!session) throw new TypeError('dispatch-task: a launch prompt needs the session slug');
  return [
    `Your assignment is the task brief in ${briefPath}. That brief IS your instruction, not data to summarise:`,
    'read it, then carry it out completely, including writing the result file it names.',
    'Do not stop after reading it, and do not end your turn waiting on anything.',
    `When you are finished, record it with: node scripts/operations/completion-cli.mjs report --session=${session} --kind=task --status=done --outcome=<the result file path>`,
  ].join('\n');
}

/**
 * SHAPE one `readTask()` result into the `read` finding. PURE — every field defensively coalesced, never
 * `undefined`, so {@link planTask} tests every branch without fs, `claude` or a run store.
 *
 * @param {object} raw
 * @returns {object}
 */
export function shapeTaskRead(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const inFlight = r.inFlight && typeof r.inFlight === 'object' ? r.inFlight : { runs: [], unreadable: 0 };
  return {
    briefPath: r.briefPath ? String(r.briefPath) : null,
    briefExists: r.briefExists === true,
    briefBytes: Number.isFinite(r.briefBytes) ? r.briefBytes : 0,
    observedAt: r.observedAt ? String(r.observedAt) : null,
    runs: Array.isArray(inFlight.runs) ? inFlight.runs : [],
    unreadableRunRecords: Number(inFlight.unreadable) > 0 ? Number(inFlight.unreadable) : 0,
    storeUnreadable: inFlight.listFailed === true || inFlight.readFailed === true || Number(inFlight.unreadable) > 0,
    storeError: inFlight.error ? String(inFlight.error) : null,
    dispatchLiveness: inFlight.livenessSource ? String(inFlight.livenessSource) : 'unknown',
  };
}

/**
 * THE VERDICT. Every refusal is named. PURE.
 *
 * ORDER matters and is deliberate: a malformed request is refused before any hold is consulted, and an
 * unreadable run store refuses ahead of an "already in flight" answer because a guard that could not read its
 * records cannot claim the slug is free (the same fail-closed stance as `dispatch-lane`).
 *
 * @param {object} read - the `read` finding.
 * @param {object} input - `{brief, session, kind, item, permissionMode, allowedTools, base, expectedWithinMinutes}`.
 * @returns {object}
 */
export function planTask(read, input) {
  const r = read || {};
  const i = input || {};
  const session = String(i.session ?? '').trim();
  const base = { session, hold: null, dispatching: false, briefPath: r.briefPath ?? null };
  const refuse = (hold, reason) => ({ ...base, hold, reason });

  if (!isValidSessionSlug(session)) {
    return refuse('bad-session', `session slug ${JSON.stringify(session)} is not usable: it names the agent, the completion record and a filename, so it must be letters, digits, dot, dash or underscore, starting with a letter or digit`);
  }
  if (!DISPATCH_TASK_KIND_RE.test(String(i.kind ?? ''))) {
    return refuse('bad-kind', `kind ${JSON.stringify(i.kind)} is not a short label (letters, digits, dot, dash, underscore)`);
  }
  if (!PERMISSION_MODES.includes(String(i.permissionMode))) {
    return refuse('bad-permission-mode', `permissionMode ${JSON.stringify(i.permissionMode)} is not one of ${PERMISSION_MODES.join('|')}`);
  }
  if (!r.briefExists) {
    return refuse('brief-missing', `the brief ${JSON.stringify(r.briefPath ?? i.brief)} does not exist as a file`);
  }
  if (!(r.briefBytes > 0)) {
    return refuse('brief-empty', `the brief ${r.briefPath} is empty — a worker would have nothing to carry out`);
  }
  if (r.storeUnreadable) {
    return refuse('store-unreadable', `store-unreadable: ${r.storeError ?? 'operation run store could not be read'} — the in-flight guard cannot tell whether ${session} is already running`);
  }
  const holding = (r.runs || []).filter((row) => dispatchStillHolds(row, r.observedAt));
  if (holding.length) {
    return {
      ...refuse('already-in-flight', `session ${session} is already in flight (${holding.map((h) => `${h.runId} handle ${h.handle ?? 'none'}`).join(', ')}) — refusing to start a second worker under the same slug`),
      inFlightRuns: holding.map((h) => ({ runId: String(h.runId), handle: h.handle ?? null, startedAt: h.startedAt ?? null })),
    };
  }
  return {
    ...base,
    dispatching: true,
    reason: `cleared: brief ${r.briefPath}, session ${session}, kind ${i.kind}, permission mode ${i.permissionMode}`,
    prompt: buildBriefLaunchPrompt({ briefPath: r.briefPath, session }),
  };
}

const DISPATCH_TASK_KIND_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

/**
 * THE `--allowedTools` PASS-THROUGH, as the ONE argv token. A single `--allowedTools=<list>` token, never two:
 * the CLI declares the option variadic, so `--allowedTools <list> <prompt>` would swallow the prompt as a tool
 * name. Empty/unset → no token (the default; the operator's own settings decide).
 *
 * @param {string} allowedTools
 * @returns {string[]}
 */
export function allowedToolsArgs(allowedTools) {
  const list = String(allowedTools ?? '').trim();
  return list ? [`--allowedTools=${list}`] : [];
}

/**
 * WHAT THE ORCHESTRATOR MUST SUBSCRIBE TO for a run, read off the run record. PURE. `null` when this run did not
 * launch a worker (a refusal, or a run that has not dispatched yet).
 *
 * `name` is the agent name (`-n <slug>`), `sessionId` the handle the CLI printed back (the short id, a prefix of
 * the full id `claude agents` lists).
 *
 * @param {object} run
 * @returns {{name: string, sessionId: string}|null}
 */
export function subscribeTarget(run) {
  const e = (run?.effects || []).find((x) => x?.type === DISPATCH_EFFECT && x?.payload?.sessionSlug && x?.handle);
  return e ? { name: String(e.payload.sessionSlug), sessionId: String(e.handle) } : null;
}

/**
 * THE LAST-LINE / JSON TRAILER for the command line. PURE over one finished drive. Adds the `subscribe:` line (and
 * the same fact under `subscribe` in the JSON result) after a launch, and turns a refusal into a visible line and
 * exit code 1 — the generic renderer would print only `complete. 0 effect(s) applied.` for a refused dispatch.
 *
 * PLAIN SHAPE (exactly): `subscribe: <name> session=<sessionId>` as the LAST line of stdout.
 * JSON SHAPE: the payload gains `"subscribe": {"name": "<name>", "sessionId": "<id>"}`.
 *
 * @param {{run: object, code: number, lines: string[], json?: boolean}} o
 * @returns {{code: number, lines: string[]}}
 */
export function finishTaskOutcome({ run, code, lines, json = false } = {}) {
  const target = subscribeTarget(run);
  const verdict = run?.verdict ?? null;
  const refused = verdict && verdict.dispatching === false ? verdict : null;
  if (json) {
    let payload;
    try { payload = JSON.parse(lines.join('\n')); } catch { return { code, lines }; }
    if (target) payload.subscribe = target;
    if (refused) payload.refused = { hold: refused.hold, reason: refused.reason };
    return { code: refused ? 1 : code, lines: [JSON.stringify(payload, null, 2)] };
  }
  if (refused) return { code: 1, lines: [...lines, `refused: ${refused.hold} — ${refused.reason}`] };
  if (target) return { code, lines: [...lines, `subscribe: ${target.name} session=${target.sessionId}`] };
  return { code, lines };
}

/**
 * THE JOB-FILE VIEW — a PROJECTION of run records into the operator's job-file shape. PURE. No file is written
 * that a run record could not regenerate; this is what replaces the hand-kept job files.
 *
 * FIELDS (the operator's own): `kind, item, session, agentId, launchedAt, brief, result, state, note`.
 *
 *   - `kind`, `item`, `session`, `brief`  from the launch effect's payload.
 *   - `agentId`, `launchedAt`             the effect's handle and its recorded start.
 *   - `state`, `result`, `note`           from the completion record when there is one (the worker reported), else
 *                                         from the effect's own status and the liveness stamp.
 *
 * STATES: `working` (in flight and listed, or liveness unknown), `done` (completion reported done, or the observer
 * resolved the effect), `failed`, `gone` (in flight, the listing no longer shows the session, nothing reported).
 * `gone` is NOT `done`: liveness reports that a session ended, never how.
 *
 * @param {{runs: object[], completions?: Record<string, object>, liveness?: Record<string, boolean|null>}} o
 *   - `runs` run records; `completions` session slug → completion record; `liveness` effect key → live answer.
 * @returns {object[]} job views, newest launch first.
 */
export function projectJobs({ runs = [], completions = {}, liveness = {} } = {}) {
  const rows = [];
  for (const run of runs) {
    if (run?.op !== DISPATCH_TASK_OP) continue;
    for (const e of run.effects || []) {
      if (e?.type !== DISPATCH_EFFECT) continue;
      const p = e.payload || {};
      const session = p.sessionSlug ?? null;
      const completion = session ? completions[session] ?? null : null;
      let state;
      let note = null;
      if (completion?.status === 'done') { state = 'done'; note = completion.outcome ?? null; }
      else if (e.status === 'applied') { state = 'done'; note = e.result?.resolvedBy ?? null; }
      else if (e.status === 'failed') { state = 'failed'; note = e.error ?? null; }
      else if (liveness[e.key] === false) { state = 'gone'; note = 'the session is no longer listed and nothing reported done'; }
      else { state = 'working'; }
      rows.push({
        kind: p.launchKind ?? TASK_LAUNCH_KIND,
        item: p.num ?? null,
        session,
        agentId: e.handle ?? null,
        launchedAt: e.startedAt ?? null,
        brief: p.brief ?? null,
        result: completion?.outcome ?? null,
        state,
        note,
      });
    }
  }
  return rows.sort((a, b) => String(b.launchedAt ?? '').localeCompare(String(a.launchedAt ?? '')));
}

/**
 * BUILD THE DECLARATION. `readTask` is the injected reader; {@link ./dispatch-task-io.mjs} supplies the real one
 * and tests supply a stub. Built per call so nothing leaks between registries.
 *
 * @param {{readTask: (o: {brief: string, session: string, item: string}) => object}} deps
 * @returns {object} the frozen declaration from `op()`.
 */
export function dispatchTaskOperation({ readTask } = {}) {
  if (typeof readTask !== 'function') {
    throw new TypeError(
      'dispatch-task: needs a `readTask({brief, session, item})` reader — the io is INJECTED so the declaration '
      + 'stays testable without a brief on disk, a run store or `claude`; the real binding is '
      + '`we:scripts/operations/dispatch-task-io.mjs`.',
    );
  }

  return op(DISPATCH_TASK_OP, {
    input: {
      // The brief IS the instruction; the operation reads it only to prove it exists and is not empty.
      brief: 'string',
      // The agent name AND the run-record identity. A second call with the same slug is refused while the first
      // is in flight.
      session: 'string',
      kind: { type: 'string', required: false, default: TASK_LAUNCH_KIND },
      item: { type: 'string', required: false, default: '' },
      // `auto` by default (see DEFAULT_PERMISSION_MODE). NOT named `model`: that is a control flag of the command
      // line adapter, and a `model` input is refused at registration. A worker model rides `WE_DISPATCH_AGENT_ARGS`.
      permissionMode: { type: 'string', required: false, default: DEFAULT_PERMISSION_MODE, enum: PERMISSION_MODES },
      // Optional pass-through to `claude --allowedTools`; unset by default. The target end state is that a
      // worker's allowed commands are declared operations only, listed per dispatch kind through this flag.
      allowedTools: { type: 'string', required: false, default: '' },
      // The branch the dispatching checkout is measured against for staleness (`main` from a normal dispatch
      // clone; the prototype branch from a prototype-tip clone).
      base: { type: 'string', required: false, default: 'main' },
      expectedWithinMinutes: { type: 'number', required: false, default: DEFAULT_EXPECTED_WITHIN_MINUTES },
    },
    verdictFrom: 'plan',

    read: compute({
      reads: ['input.brief', 'input.session', 'input.item'],
      fn: (view) => shapeTaskRead(readTask({ brief: view.input.brief, session: view.input.session, item: view.input.item })),
    }),

    plan: compute({
      reads: ['findings.read', 'input.brief', 'input.session', 'input.kind', 'input.permissionMode'],
      fn: (view) => planTask(view.findings.read, {
        brief: view.input.brief, session: view.input.session, kind: view.input.kind, permissionMode: view.input.permissionMode,
      }),
    }),

    dispatch: effectStep({
      reads: ['verdict', 'findings.read', 'input.session', 'input.kind', 'input.item', 'input.permissionMode', 'input.allowedTools', 'input.base', 'input.expectedWithinMinutes'],
      effects: (view) => {
        const verdict = view.verdict || {};
        if (!verdict.dispatching) return [];
        const item = String(view.input.item ?? '').trim();
        return [{
          type: DISPATCH_EFFECT,
          // DISPATCH: TRUE and IDEMPOTENT: FALSE, for the reasons `dispatch-lane`'s own effect states: the
          // executor writes `in-flight` before the sink runs, and re-applying a launch whose outcome is unknown
          // would start a second worker on one brief.
          dispatch: true,
          idempotent: false,
          payload: {
            // `num` is the ITEM when there is one (so the lane guard and the observer's PR axis see it) and
            // absent otherwise: a brief-file task has no item identity of its own.
            ...(item ? { num: item, item } : {}),
            launchKind: view.input.kind,
            sessionSlug: view.input.session,
            brief: view.findings.read.briefPath,
            prompt: verdict.prompt,
            permissionMode: view.input.permissionMode,
            allowedTools: view.input.allowedTools || null,
            base: view.input.base,
            expectedWithinMinutes: view.input.expectedWithinMinutes,
          },
        }];
      },
    }),
  });
}
