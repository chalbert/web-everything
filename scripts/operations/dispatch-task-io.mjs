/**
 * @file scripts/operations/dispatch-task-io.mjs
 * @description THE IO SHELL of {@link ./dispatch-task.mjs} (#3730): the reader (the brief on disk + the run store),
 *   the sink that starts the worker, and the job-file projection read. `dispatch-task.mjs` reaches none of this.
 *
 * NO SECOND SPAWN. The sink calls `dispatch-lane-io.mjs#defaultClaudeProvider` — `buildAgentArgv` plus
 * `defaultSpawnAgent` — and adds only the flags this operation owns (`--permission-mode`, an optional
 * `--allowedTools=`). See the statute
 * [#conveyor-dispatch-calls-the-declared-operation](../../docs/agent/platform-decisions.md#conveyor-dispatch-calls-the-declared-operation).
 *
 * THE GUARDS IT INHERITS, and the one it adds:
 *   - {@link assertNotALaneCheckout} — the same check `dispatch-lane` makes: refuse from a `lane-<n>` clone.
 *   - {@link assertMainNotStale} — `dispatch-lane` does NOT call it (it freshens instead); the review and fix
 *     dispatchers do. This operation does, because #3752 point 3 asks that a dispatch from a stale checkout fail
 *     with the refresh hint. It measures the LOCAL `<base>` branch against `origin/<base>`, with `base` from the
 *     `--base` input (default `main`), so it runs from a prototype-tip checkout with `--base=<prototype branch>`.
 *
 * A LAUNCH THAT FAILS BEFORE THE SPAWN throws `notApplied`, so the entry lands `failed` (never in flight) and the
 * slug is free again.
 *
 * ALSO A SMALL CLI, for the job view: `node scripts/operations/dispatch-task-io.mjs jobs [--session=<slug>]`
 * prints the projection of run records as JSON.
 */

import { statSync, readFileSync, readdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

import { DISPATCH_EFFECT, DEFAULT_EXPECTED_WITHIN_MINUTES } from './dispatch-lane.mjs';
import { DISPATCH_TASK_OP, allowedToolsArgs, projectJobs } from './dispatch-task.mjs';
import {
  REPO_ROOT, assertNotALaneCheckout, defaultClaudeProvider, defaultListAgents, defaultSpawnAgent, isPreSpawnRefusal,
  persistLastSeenLive, stampLiveness, resolveWorkerModel,
} from './dispatch-lane-io.mjs';
import { assertMainNotStale } from './review-dispatch.mjs';
import { inFlight, notApplied } from './effect-executor.mjs';
import { createFileRunStore, resolveRunsDir } from './run-store.mjs';
import { tryReadCompletion } from './completion-store.mjs';
import { writeAllSync } from '../lib/write-all-sync.mjs';
import { workerTierFor } from '../lib/provider-routing.mjs';
import { CLAUDE_NATIVE_MODEL_BY_TIER } from '../lib/dispatch-contracts.mjs';
import { resolveBacklogFile, readScopeList } from './resolve-io.mjs';

/**
 * BEST-EFFORT `scope:`/`tags:` for a `--item`-carrying `dispatch-task` brief (#3857 — "the scope of --item when
 * one is given"). A `dispatch-task` brief has no `scope:` of its own (unlike `dispatch-lane`, which routes an
 * ITEM), so `workerTierFor`'s statute/security rows only see anything for a brief that names one. NEVER
 * THROWS, same posture as `readItemDeliveryAgentMarker`: an item that cannot be resolved or read degrades to
 * `{scopePaths: [], tags: []}` rather than blocking a dispatch that would otherwise proceed.
 * @param {string|null} item
 * @param {{root?: string, read?: (path: string) => string}} [io]
 * @returns {{scopePaths: string[], tags: string[]}}
 */
export function readItemRoutingFacts(item, { root = REPO_ROOT, read = (p) => readFileSync(p, 'utf8') } = {}) {
  const key = String(item ?? '').trim();
  if (!key) return { scopePaths: [], tags: [] };
  try {
    const file = resolveBacklogFile(key, root, (dir) => readdirSync(dir));
    if (!file) return { scopePaths: [], tags: [] };
    const content = read(join(root, 'backlog', file));
    const scope = readScopeList(content) ?? [];
    const tagsRaw = createRequire(import.meta.url)('gray-matter')(content)?.data?.tags;
    const tags = Array.isArray(tagsRaw) ? tagsRaw.filter((t) => typeof t === 'string' && t.trim()) : [];
    return { scopePaths: scope, tags };
  } catch {
    return { scopePaths: [], tags: [] };
  }
}

/**
 * EVERY RUN LEFT IN FLIGHT UNDER ONE SESSION SLUG, out of the run store. Same fail-closed shape as
 * `dispatch-lane-io.mjs#inFlightDispatchesFor` (a list or read failure is reported, never read as "none"), keyed on
 * the effect payload's `sessionSlug` instead of the item id — the name of the agent is the identity a brief-file
 * task has.
 *
 * @param {string} slug
 * @param {{store?: {list: Function, read: Function, dir?: string}}} [o]
 */
export function inFlightTaskRuns(slug, { store = createFileRunStore() } = {}) {
  const runs = [];
  let unreadable = 0;
  let readFailed = false;
  let error;
  let ids;
  try { ids = store.list(); if (!Array.isArray(ids)) throw new Error('Invalid run store listing'); }
  catch (e) { return { runs, unreadable: 0, listFailed: true, error: `${store.dir ?? resolveRunsDir()}: ${e.message}` }; }
  for (const id of ids) {
    let run;
    try { run = store.read(id); if (!run) throw new Error('Listed run is missing'); }
    catch (e) { unreadable += 1; readFailed = true; error = `${store.dir ?? resolveRunsDir()}/${id}.json: ${e.message}`; continue; }
    for (const e of Array.isArray(run.effects) ? run.effects : []) {
      if (e?.status !== 'in-flight' || e.type !== DISPATCH_EFFECT) continue;
      if (e.payload?.sessionSlug !== slug) continue;
      runs.push({
        runId: String(run.id), key: String(e.key), handle: e.handle ?? null,
        startedAt: e.startedAt ?? null, expectedBy: e.expectedBy ?? null, lastSeenLiveAt: e.lastSeenLiveAt ?? null,
      });
    }
  }
  return { runs, unreadable, ...(readFailed ? { readFailed, error } : {}) };
}

/**
 * THE REAL `readTask` — the brief on disk plus the run-store guard read, liveness-stamped. Everything is injectable
 * so a test drives it with a memory store and a fake listing.
 *
 * The brief path is resolved against the CALLER's directory and handed on ABSOLUTE, so the launch prompt names one
 * file whatever directory the worker starts in.
 */
export function createTaskReader({
  store = createFileRunStore(),
  listAgents = () => defaultListAgents(),
  now = () => new Date(),
  statFile = statSync,
  cwd = process.cwd(),
} = {}) {
  return ({ brief, session }) => {
    const briefPath = resolve(cwd, String(brief ?? ''));
    let briefExists = false;
    let briefBytes = 0;
    try { const st = statFile(briefPath); briefExists = st.isFile(); briefBytes = st.size; } catch { /* absent → refused by the plan */ }
    const found = inFlightTaskRuns(String(session ?? '').trim(), { store });
    const stamped = stampLiveness(found, { listAgents });
    try { persistLastSeenLive(stamped, { store, now }); } catch { /* best-effort, as in dispatch-lane */ }
    return { briefPath, briefExists, briefBytes, observedAt: now().toISOString(), inFlight: stamped };
  };
}

/**
 * THE SINK for the `dispatch: true` effect the declaration emits. Starts ONE `claude --bg` worker through the
 * shared provider and answers `inFlight({ handle, expectedBy })`, exactly the contract `dispatch-lane`'s sink meets.
 *
 * FLAG ORDER: the operator's standing `WE_DISPATCH_AGENT_ARGS` (`extraArgs`) first, then this operation's own
 * `--permission-mode` and optional `--allowedTools=`. The CLI takes the last value of a repeated flag, so an
 * explicit or defaulted `--permissionMode` here wins over a permission mode in the environment.
 *
 * THE WORKER MODEL (#3857) is decided by the checked-in model-tier table
 * ({@link ../lib/provider-routing.mjs#workerTierFor}), keyed on `payload.launchKind` (the brief's `--kind`)
 * and, when `payload.item` names one, that item's own `scope:`/`tags:` ({@link readItemRoutingFacts}). A
 * `--model` still set through `WE_DISPATCH_AGENT_ARGS` is honoured only alongside `payload.modelReason`
 * (`dispatch-task.mjs`'s own `modelReason` input) — {@link resolveWorkerModel} decides, and
 * {@link defaultClaudeProvider}/`buildAgentArgv` is where it is enforced and applied, the ONE shared spawn
 * point every Claude dispatch passes through.
 *
 * @param {object} [o]
 * @param {string} [o.root] - the dispatching checkout; also the worker's cwd.
 * @param {(argv: string[], opts: object) => string} [o.spawnAgent] - the CLI-shaped spawn seam.
 * @param {string[]} [o.extraArgs]
 * @param {(root: string) => object} [o.checkStaleness] - injectable staleness check (default: real `git fetch`).
 * @param {() => string} [o.mintSessionId]
 * @param {() => Date} [o.now]
 */
export function createDispatchTaskSinks({
  root = REPO_ROOT,
  spawnAgent = (argv, opts) => defaultSpawnAgent(argv, opts),
  extraArgs = [],
  checkStaleness,
  mintSessionId = () => randomUUID(),
  now = () => new Date(),
} = {}) {
  return {
    [DISPATCH_EFFECT]: async (payload) => {
      assertNotALaneCheckout(root);
      try { assertMainNotStale(root, checkStaleness, { base: payload?.base || 'main' }); }
      catch (e) { throw notApplied(`dispatch-task: ${e.message}`); }

      const sessionId = String(mintSessionId());
      const args = [
        ...extraArgs,
        '--permission-mode', String(payload.permissionMode),
        ...allowedToolsArgs(payload.allowedTools),
      ];
      // #3857 — THE MODEL-TIER TABLE'S ANSWER for this brief, computed once and reused for both enforcement
      // (inside `buildAgentArgv`, via `table` below) and the run record (`workerModel`, after the spawn).
      const facts = readItemRoutingFacts(payload.item);
      const tierDecision = workerTierFor({ kind: payload.launchKind, taskType: null, scopePaths: facts.scopePaths, tags: facts.tags });
      const table = { tier: tierDecision.tier, model: CLAUDE_NATIVE_MODEL_BY_TIER[tierDecision.tier], reason: tierDecision.reason };
      let handle;
      try {
        handle = defaultClaudeProvider({
          sessionId,
          cwd: root,
          prompt: payload.prompt,
          sessionSlug: payload.sessionSlug,
          num: payload.num,
          launchKind: payload.launchKind,
          extraArgs: args,
          systemPromptFile: null,
          table,
          modelReason: payload.modelReason ?? null,
        }, { spawnAgent });
      } catch (e) {
        if (e && e.notApplied) throw e;
        if (isPreSpawnRefusal(e)) throw notApplied(`claude could not be started (${String(e.code)}) — no agent exists`, { sessionId });
        // INDETERMINATE: something may be running and cannot be observed. The entry stays in flight with no
        // handle, the replay guard refuses it, and a person closes it out.
        throw new Error(`claude --bg failed and whether an agent started is UNKNOWN: ${String((e && e.message) || e).split('\n')[0]}`);
      }
      // Recomputed (not carried from the try block above): `buildAgentArgv` already proved this decision
      // refusal-free by the time a handle exists, and pure + cheap means re-deriving it for the record is
      // simpler than threading a second return value through `defaultClaudeProvider`'s handle-only contract.
      const modelDecision = resolveWorkerModel({ extraArgs: args, table, modelReason: payload.modelReason ?? null });
      const minutes = Number(payload.expectedWithinMinutes) > 0 ? Number(payload.expectedWithinMinutes) : DEFAULT_EXPECTED_WITHIN_MINUTES;
      return inFlight({
        dispatch: {
          launchKind: payload.launchKind, route: 'claude-bg', permissionMode: payload.permissionMode, executor: null,
          workerModel: { name: modelDecision.model, tier: modelDecision.tier, source: modelDecision.source, tableTier: modelDecision.tableTier, reason: modelDecision.reason },
        },
        handle: String(handle),
        expectedBy: new Date(now().getTime() + minutes * 60 * 1000).toISOString(),
      });
    },
  };
}

/**
 * THE JOB-FILE VIEW READ — every `dispatch-task` run projected into the job-file shape. Reads the run store, the
 * completion records for the sessions found, and one liveness listing (only when something is in flight).
 *
 * @param {{session?: (string|null)}} [o]
 * @param {object} [io]
 * @returns {object[]} see {@link projectJobs}.
 */
export function readJobView({ session = null } = {}, {
  store = createFileRunStore(),
  listAgents = () => defaultListAgents(),
  readCompletion = (s) => tryReadCompletion(s),
} = {}) {
  const runs = [];
  for (const id of store.list()) {
    let run;
    try { run = store.read(id); } catch { continue; }
    if (run?.op === DISPATCH_TASK_OP) runs.push(run);
  }
  const completions = {};
  const rows = [];
  for (const run of runs) {
    for (const e of run.effects || []) {
      if (e?.type !== DISPATCH_EFFECT) continue;
      const slug = e.payload?.sessionSlug;
      if (slug && !(slug in completions)) {
        try { completions[slug] = readCompletion(slug); } catch { completions[slug] = null; }
      }
      if (e.status === 'in-flight') rows.push({ runId: String(run.id), key: String(e.key), handle: e.handle ?? null });
    }
  }
  const stamped = stampLiveness({ runs: rows, unreadable: 0 }, { listAgents });
  const liveness = Object.fromEntries(stamped.runs.map((r) => [r.key, r.live ?? null]));
  const jobs = projectJobs({ runs, completions, liveness });
  return session ? jobs.filter((j) => j.session === session) : jobs;
}

// ── the job-view CLI ────────────────────────────────────────────────────────────────────────────────────────
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd !== 'jobs') {
    writeAllSync(2, 'usage: dispatch-task-io.mjs jobs [--session=<slug>]\n');
    process.exit(2);
  }
  const flag = (name) => rest.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) || null;
  try {
    writeAllSync(1, `${JSON.stringify(readJobView({ session: flag('session') }), null, 2)}\n`);
  } catch (e) {
    writeAllSync(2, `dispatch-task-io: ${e.message}\n`);
    process.exit(1);
  }
}
