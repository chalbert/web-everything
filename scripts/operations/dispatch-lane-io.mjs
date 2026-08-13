/**
 * @file scripts/operations/dispatch-lane-io.mjs
 * @description THE IO SHELL of the `dispatch-lane` declaration (#3037, under epic #3029) — the tick reader its
 *   `read` step is injected with, the SINK that starts the agent, and the OBSERVER that later asks how it is
 *   going.
 *
 * WHY IT IS A SEPARATE FILE. {@link ./dispatch-lane.mjs} is the declaration: what the operation IS. This is the
 * only place it touches the world — the same pure-core / io-shell split {@link ./review-pr-io.mjs} uses, and
 * what lets the declaration be unit-tested with a stub reader and a stub spawner.
 *
 * EVERY BINDING HERE SHELLS SOMETHING THAT ALREADY EXISTS. Nothing in this file decides anything about a
 * dispatch:
 *   - the whole tick — guards, TTLs, lane exclusion, the re-dispatch gate, watcher arming — is ONE call to
 *     `we:scripts/conveyor/tick-core.mjs`, the same CLI the runner drives, with the caller's bookkeeping on
 *     STDIN exactly as the skill pipes it. Not `conveyor-state` + `dispatch-plan` re-composed here: that
 *     composition IS the tick core, and re-doing it is how a second, subtly different dispatcher gets born;
 *   - item identity is `normNum` (`we:scripts/conveyor/queue-store.mjs`) — the ONE normalizer the state read,
 *     the plan and the core all key on;
 *   - the item's slug and repo-qualified `scope:` come from the canonical backlog loader (`we:src/_data/backlog.js`),
 *     the same source `dispatch-plan.mjs` enriches its queue rows from;
 *   - the brief is `we:skills-src/conveyor/delivery-agent-brief.md`, read as text and filled by the declaration.
 *
 * THE SINK IS THE ONLY THING IN THIS REPO THAT STARTS AN AGENT. Read {@link createDispatchSinks} before
 * changing it — the handle contract lives there, and it is the reason a restart can still find the build.
 *
 * IMPURE by construction: `node`, `claude`, `fs`.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { normNum } from '../conveyor/queue-store.mjs';
import { inFlight, notApplied } from './effect-executor.mjs';
import { createFileRunStore } from './run-store.mjs';
import { DEFAULT_EXPECTED_WITHIN_MINUTES, DISPATCH_EFFECT } from './dispatch-lane.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
/** The repo root, resolved by SCRIPT LOCATION and never by cwd — same reason `run-store.mjs` does it. */
export const REPO_ROOT = resolve(HERE, '..', '..');

/** The mechanized tick core — one call, the whole per-tick state machine (`{ decisions, nextState }`). */
export function tickCli(root = REPO_ROOT) {
  return join(root, 'scripts', 'conveyor', 'tick-core.mjs');
}
/** The delivery-agent brief TEMPLATE the declaration fills. */
export function briefPath(root = REPO_ROOT) {
  return join(root, 'skills-src', 'conveyor', 'delivery-agent-brief.md');
}

/**
 * How long after `startedAt` a dispatched session that is NOT yet listed still reads as `running`.
 *
 * `claude --bg` returns before its session is necessarily visible to `claude agents`, and the observer's
 * "absent" branch is TERMINAL — so without a grace window the first poll after a dispatch could close out a
 * build that had not finished starting. Two minutes is far below any real build and far above process startup.
 */
export const LISTING_GRACE_MS = 2 * 60 * 1000;

/**
 * READ ONE TICK and select this item's row. The `readTick` the declaration is injected with.
 *
 * ONE `tick-core` call. Its STDIN is the caller's session-ephemeral bookkeeping — read from `bookkeepingFile`
 * when given, `{}` otherwise. The file is the CALLER'S (the runner's `nextState`); this function neither
 * creates nor writes one, so no parallel state store comes into existence (#2612).
 *
 * @param {object} o
 * @param {string|number} o.num - the item to dispatch.
 * @param {string} [o.bookkeepingFile] - path to the caller's `{ bookkeeping, signals, config }` JSON.
 * @param {string} [o.root]
 * @param {Function} [o.runNode] - injectable `(argv, opts) => stdout`, so the reader is testable without a tick.
 * @param {Function} [o.exec] - the `execFileSync`-shaped call the DEFAULT `runNode` goes through. Separate from
 *   `runNode` on purpose: overriding `runNode` replaces the production path, while overriding `exec` EXERCISES
 *   it, which is the only way a test can assert the options (the timeout) it builds — see F5/F12 in the PR
 *   #1211 review, where a tested default reached by nothing was the whole defect.
 * @param {Function} [o.readText] - injectable file reader.
 * @param {Function} [o.loadItems] - injectable backlog loader.
 * @param {() => Date} [o.now] - injectable clock; stamps `observedAt`, which is how the pure declaration ages
 *   its double-dispatch guard out without reading a clock of its own.
 * @returns {{launch: object|null, suppressed: object|null, resolvedNum: string, item: object|null, briefTemplate: string, nextState: object, statusLine: string, notes: object[], bookkeepingSource: string, observedAt: string}}
 */
export function readTick({
  num,
  bookkeepingFile = '',
  root = REPO_ROOT,
  exec = execFileSync,
  runNode = (argv, opts) => defaultRunNode(argv, opts, { exec }),
  readText = (path) => readFileSync(path, 'utf8'),
  loadItems = () => defaultLoadItems(root),
  listInFlightDispatches = (key) => inFlightDispatchesFor(key),
  now = () => new Date(),
} = {}) {
  const key = normNum(num);
  if (!key) throw new TypeError(`dispatch-lane-io: \`num\` must be an item id, got ${JSON.stringify(num)}`);

  // THE CALLER'S BOOKKEEPING, or none. A missing file is a REFUSAL, not a silent fall back to `{}`: a caller
  // that named a file meant to dispatch under its live guards, and quietly dropping them is precisely the
  // double-dispatch the guards exist to prevent. Naming NO file is the honest guard-less mode, reported as
  // `bookkeepingSource: 'none'` all the way onto the verdict.
  let stdin = '{}';
  let bookkeepingSource = 'none';
  let droppedKeys = [];
  if (String(bookkeepingFile || '').trim()) {
    const forwarded = forwardableBookkeeping(readText(bookkeepingFile));
    stdin = forwarded.stdin;
    droppedKeys = forwarded.dropped;
    bookkeepingSource = 'file';
  }

  let tick;
  try {
    tick = JSON.parse(String(runNode([tickCli(root)], { cwd: root, input: stdin })));
  } catch (e) {
    const msg = String((e && (e.stderr || e.message)) || e).split('\n').filter(Boolean).pop() || 'tick-core failed';
    throw new Error(`dispatch-lane-io: could not read the conveyor tick — ${msg}`);
  }
  const decisions = tick && typeof tick.decisions === 'object' && tick.decisions ? tick.decisions : {};
  const match = (rows) => (Array.isArray(rows) ? rows : []).find((r) => r && normNum(r.num) === key) || null;

  const item = findItem(key, loadItems);
  const nextState = tick && typeof tick.nextState === 'object' ? tick.nextState : null;
  return {
    resolvedNum: key,
    // The SELECTION happens here, with the tick's own normalizer — see the declaration's header for why it is
    // not in the pure half.
    launch: match(decisions.spawnBuilds),
    suppressed: match(decisions.suppressedBuilds),
    // THIS launch's guard entry, picked out of the tick's `buildGuards` with the same normalizer. The core
    // records one per planned spawn; only this one describes work this operation actually starts.
    dispatchedGuard: match(nextState?.buildGuards),
    item,
    briefTemplate: String(readText(briefPath(root))),
    nextState,
    statusLine: String(decisions.statusLine || ''),
    notes: Array.isArray(decisions.notes) ? decisions.notes : [],
    bookkeepingSource,
    droppedBookkeepingKeys: droppedKeys,
    // THIS OPERATION'S OWN in-flight dispatches for the item — see {@link inFlightDispatchesFor}.
    inFlightDispatches: listInFlightDispatches(key),
    // WHEN THIS READ WAS TAKEN. The declaration ages the double-dispatch guard out (`dispatchStillHolds`) and
    // is pure, so the clock has to arrive as DATA rather than be read there. Omitted or unparseable → nothing
    // ages out and every in-flight record holds, which is the fail-closed direction.
    observedAt: now().toISOString(),
  };
}

/**
 * The default `node` runner for the tick read — a named export rather than an inline default so the OPTIONS it
 * passes are reachable by a test. They were not: every test overrode `runNode`, so the timeout below could be
 * deleted with the whole suite green (PR #1211 review, F5), and a fix no test asserts is a fix the next
 * refactor removes for free. Same reason for {@link defaultSpawnAgent}.
 *
 * @param {string[]} argv
 * @param {object} [opts] - merged last, so a caller can still override.
 * @param {{exec?: Function}} [io] - the `execFileSync`-shaped call, injected ONLY so the opts can be asserted.
 * @returns {string}
 */
export function defaultRunNode(argv, opts = {}, { exec = execFileSync } = {}) {
  return exec(process.execPath, argv, {
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: TICK_TIMEOUT_MS, killSignal: 'SIGKILL', ...opts,
  });
}

/**
 * EVERY RUN THIS OPERATION HAS LEFT IN FLIGHT for one item, read out of the run store.
 *
 * WHY THIS EXISTS, given the tick core already has an in-flight build guard. That guard lives in the CALLER'S
 * session bookkeeping, and `bookkeepingFile` defaults to empty — so the plain command-line invocation runs with
 * NO guards, and running it twice inside the spawn→claim window yields the same `spawnBuilds` row twice: two
 * agents in one lane clone, racing one working tree, both opening a PR. Neither run holds the lane, because the
 * AGENT leases it (the brief's first step), several seconds later.
 *
 * IT RE-DERIVES NOTHING. The tick core's guard is about the conveyor's session; this is about THIS operation's
 * own records, which are durable and which no tick has ever read. It answers one question — "did I already
 * start an agent for this item and never see it finish?" — from the only place that can answer it after a
 * restart.
 *
 * FAIL-SOFT PER RECORD, and the trade is stated: one unreadable run record is skipped rather than blocking
 * every dispatch (the store REFUSES a corrupt record, so one bad file would otherwise wedge the whole
 * operation), and the count of skipped records rides the result so a caller can see the guard was partial. It
 * rides it all the way onto the VERDICT as `unreadableRunRecords` — the first version of this sentence was a
 * claim wider than the code, because the count reached `shapeDispatchRead` and was dropped there (PR #1211
 * review, F4).
 *
 * `expectedBy` rides each row for the same kind of reason: the declaration ages a stale hold out
 * (`dispatchStillHolds`), and it cannot do that without the deadline the sink recorded.
 *
 * @param {string} key - the NORMALIZED item id.
 * @param {{store?: {list: Function, read: Function}}} [o]
 * @returns {{runs: Array<{runId: string, key: string, handle: (string|null), startedAt: (string|null), expectedBy: (string|null)}>, unreadable: number}}
 */
export function inFlightDispatchesFor(key, { store = createFileRunStore() } = {}) {
  const runs = [];
  let unreadable = 0;
  let ids;
  try { ids = store.list(); } catch { return { runs, unreadable: 0 }; }
  for (const id of Array.isArray(ids) ? ids : []) {
    let run;
    try { run = store.read(id); } catch { unreadable += 1; continue; }
    for (const e of (run && Array.isArray(run.effects) ? run.effects : [])) {
      if (e?.status !== 'in-flight' || e.type !== DISPATCH_EFFECT) continue;
      if (normNum(e.payload?.num) !== key) continue;
      runs.push({
        runId: String(run.id), key: String(e.key), handle: e.handle ?? null,
        startedAt: e.startedAt ?? null, expectedBy: e.expectedBy ?? null,
      });
    }
  }
  return { runs, unreadable };
}

/**
 * NARROW the caller's bookkeeping to the part that may reach the tick core. Returns the STDIN text plus the
 * keys that were dropped.
 *
 * WHY ANYTHING IS DROPPED. `tick-core`'s shell reads four things off STDIN, and only one of them is
 * bookkeeping: `bookkeeping`, `signals`, `config` and `lastOperatorTurn`. `config` sets `buildTtlTicks`,
 * `fixRetryCap` and friends; `signals.returnedBuildNums` retires live build guards outright. So piping the file
 * through verbatim would let whoever writes it dial the very holds this operation exists to inherit — a file
 * carrying `{"config":{"buildTtlTicks":0}}` retires every build guard on the spot and clears a lane that
 * already has an agent on it. The declaration says a guard rule must not live in this file; forwarding a knob
 * that overrides one is the same defect wearing a different hat.
 *
 * DROPPING `signals` IS CONSERVATIVE; DROPPING `config` IS NOT, and the first version of this note claimed both
 * were. `signals.returnedBuildNums` only ever RETIRES guards, so losing it keeps them live longer and dispatches
 * less. `config` cuts both ways: a caller running `buildTtlTicks: 10` who names their file gets the shipped
 * default of 3 instead, so their guards expire SOONER here than in their own tick and this operation can
 * dispatch a lane they still consider held. Dropping it is still right — it is the knob an attacker or a
 * fat-fingered file would reach for — but it is a trade, not a free win, which is why the drops are REPORTED:
 * they ride the read all the way onto the verdict as `droppedBookkeeping`, so a caller sees which of their
 * settings this run did not honour.
 *
 * @param {string} text - the caller's bookkeeping file contents.
 * @returns {{stdin: string, dropped: string[]}}
 */
export function forwardableBookkeeping(text) {
  let parsed;
  try {
    parsed = JSON.parse(String(text));
  } catch (e) {
    throw new Error(`dispatch-lane-io: the bookkeeping file is not parseable JSON (${String(e.message || e).split('\n')[0]})`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new TypeError('dispatch-lane-io: the bookkeeping file must hold a JSON object');
  }
  // A file may be either `{ bookkeeping: {...}, … }` (what the tick's shell reads) or the bare bookkeeping map
  // (what `nextState` is) — `tick-core` accepts both, so the same two shapes are accepted here.
  const wrapped = !!parsed.bookkeeping && typeof parsed.bookkeeping === 'object' && !Array.isArray(parsed.bookkeeping);
  const bookkeeping = wrapped ? parsed.bookkeeping : parsed;
  // FROM THE SAME PREDICATE the line above branches on. Deriving it independently made the report lie about a
  // malformed file (`{"bookkeeping": 3, "config": {…}}` nests `config` under `bookkeeping` and was still
  // reported as dropped) — a report that disagrees with what happened is worse than no report.
  const dropped = wrapped ? Object.keys(parsed).filter((k) => k !== 'bookkeeping') : [];
  return { stdin: JSON.stringify({ bookkeeping }), dropped };
}

/**
 * The canonical backlog loader — the SAME one `dispatch-plan.mjs` enriches its queue rows from, so the scope
 * this operation puts in the brief is the scope the dispatcher arbitrated on.
 */
function defaultLoadItems(root) {
  const require = createRequire(import.meta.url);
  const load = require(join(root, 'src', '_data', 'backlog.js'));
  return typeof load === 'function' ? load() : [];
}

/** One item's spec path + repo-qualified scope, or null when the loader cannot see it. */
function findItem(key, loadItems) {
  let items = [];
  try { items = loadItems() || []; } catch { return null; }
  const it = (Array.isArray(items) ? items : []).find((x) => normNum(x?.num) === key);
  if (!it || !it.slug) return null;
  return {
    num: String(it.num),
    slug: String(it.slug),
    specPath: `backlog/${it.num}-${it.slug}.md`,
    // Already repo-qualified by the loader (`we:scripts/...`), which is the form the brief's `--scope` wants.
    scope: Array.isArray(it.scope) ? it.scope.map(String) : [],
  };
}

/** `readTick` bound to one root — the shape the declaration wants. */
export function createTickReader(bindings = {}) {
  return ({ num, bookkeepingFile }) => readTick({ ...bindings, num, bookkeepingFile });
}

/**
 * How long `claude --bg` gets to return. It is documented to return IMMEDIATELY, so anything near this is a
 * hang, and a hang here is synchronous inside the executor — it would stall the CLI or the whole waker pass.
 * A timeout kills it and the entry lands INDETERMINATE (`in-flight`, no handle), which is the truthful state:
 * a session may or may not have been started.
 */
export const SPAWN_TIMEOUT_MS = 60 * 1000;

/** How long `claude agents --json` gets. A read this cheap that blocks is a broken environment, not slow work. */
export const LIST_TIMEOUT_MS = 15 * 1000;

/**
 * How long the whole tick read gets. It is the only NETWORK-bound path in this file — `tick-core` shells
 * `conveyor-state`, `dispatch-plan`, the free-lane picker and one `gh pr view` per bounced PR — so it is the
 * one most able to hang, and it runs synchronously inside the CLI. Generous, because a real read against a
 * live queue takes tens of seconds; bounded, because a wedged `gh` must not hang a caller forever.
 */
export const TICK_TIMEOUT_MS = 5 * 60 * 1000;

/** The env var an operator sets to pass extra `claude` flags (a JSON array) to every dispatched agent. */
export const AGENT_ARGS_ENV = 'WE_DISPATCH_AGENT_ARGS';

/**
 * Extra `claude` flags from the environment, or `[]`. REFUSES a malformed value rather than dispatching with
 * flags the operator thinks are set and are not — a silently-ignored `--permission-mode` is exactly the kind of
 * thing nobody notices until an agent stalls on a prompt.
 */
export function agentArgsFromEnv(env = process.env) {
  const raw = String(env[AGENT_ARGS_ENV] || '').trim();
  if (!raw) return [];
  let parsed;
  try { parsed = JSON.parse(raw); } catch { parsed = null; }
  if (!Array.isArray(parsed) || parsed.some((a) => typeof a !== 'string')) {
    throw new TypeError(`operations: ${AGENT_ARGS_ENV} must be a JSON array of strings, e.g. '["--model","sonnet"]'`);
  }
  return parsed;
}

/**
 * REFUSE to dispatch from inside a lane clone.
 *
 * The agent's very first instruction is to acquire a lane of its own, and it runs it in the cwd it was started
 * in. Started inside `lane-N`, it would acquire a SECOND lane from within one — a nested checkout whose lease,
 * scope and eventual PR all belong to a lane nobody assigned it.
 *
 * WHAT IT ACTUALLY CHECKS, said plainly: the root's BASENAME matches `lane-<digits>`. `REPO_ROOT` is resolved by
 * script location rather than cwd, so it is the checkout the operation was invoked from — but the earlier
 * wording ("fires exactly when the operation was invoked from a lane clone") was wider than the test in both
 * directions, and the review was right to say so (PR #1211, F9): a primary checkout that happens to be named
 * `lane-2` is refused, and a lane-shaped worktree named anything else is not. The name is the convention
 * `we:scripts/lane-pool.mjs` creates, and a stricter check would need to read the pool's registry from a file
 * this module deliberately does not touch.
 *
 * IT THROWS `notApplied`, so the entry lands `failed` — and the executor retries `failed` with no cap. The
 * condition is PERMANENT (a checkout does not rename itself), so such a run re-attempts an impossible dispatch
 * on every waker pass until a person closes it out. It is bounded in the only way that matters — nothing is
 * ever spawned — and capped retry is #3083, which is unruled; recorded here so the next reader does not think
 * the retry was considered and blessed.
 */
export function assertNotALaneCheckout(root) {
  if (/^lane-\d+$/.test(String(root).split('/').filter(Boolean).pop() || '')) {
    throw notApplied(
      `dispatch-lane: refusing to start a delivery agent from the lane checkout ${root} — the brief's first step `
      + 'acquires a lane, and acquiring one from inside another nests two checkouts. Run this from the primary checkout.',
    );
  }
}

/**
 * Errors that PROVE no agent started. Matching one marks the entry `failed` (retried on the next pass) instead
 * of the default INDETERMINATE — and the list is deliberately tiny, because the default is the safe one: a
 * `claude` invocation that failed for any reason we do not recognise may still have started a session, and
 * guessing otherwise is how a lane gets two agents.
 */
const PRE_SPAWN_REFUSALS = Object.freeze(['ENOENT', 'EACCES']);

/** Is this spawn failure one we can PROVE happened before any agent existed? */
export function isPreSpawnRefusal(error) {
  const code = String(error?.code || '');
  return PRE_SPAWN_REFUSALS.includes(code);
}

/**
 * THE SINK — the one thing in this repo that starts a delivery agent.
 *
 * THE HANDLE IS MINTED, NOT DISCOVERED, and that is the load-bearing detail. The #3030 spike established that
 * `sessionId` is the durable handle and `pid` must never be one (the OS reuses it), and read the id back out of
 * `claude agents --json`. Reading it back needs a before/after diff of the live session list and races every
 * other session that starts in the same instant. `claude --session-id <uuid>` removes the race outright: the
 * dispatcher CHOOSES the id, so the handle is known before the agent exists and cannot be attributed to the
 * wrong session. (The spike did not have this; it is the one place its account was narrower than the CLI.)
 *
 * WHAT IS STILL NOT COVERED, stated rather than papered over: a sink killed between `claude --bg` returning and
 * this function returning loses the handle, and the executor then refuses the entry on replay (it is
 * `in-flight` with a null handle — `inFlightEntries().unknown`). That window is a few milliseconds wide and the
 * failure is VISIBLE and closable with `resolveInFlight`, which is the whole reason #3073 wrote `in-flight`
 * before the sink rather than after.
 *
 * NO PERMISSION FLAGS ARE BAKED IN — but the knob is REACHABLE. `extraArgs` (model, effort, permission mode)
 * defaults to empty, because a dispatcher that hard-coded `--dangerously-skip-permissions` would silently widen
 * every agent it ever launches; that is a decision for whoever runs the conveyor. It is read from
 * {@link AGENT_ARGS_ENV} at the `run.mjs` binding so an operator can actually set it, rather than being a
 * parameter only a test can reach.
 *
 * NOT YET PROVEN LIVE. No test starts a `claude` process, and no dispatch has been fired end to end — the argv
 * below is asserted, the CLI's response to it is not. A background session's permission mode and the isolation
 * default are the two things a first live run has to settle; #xaibmeu, which routes the conveyor through this
 * operation, is where that happens.
 *
 * @param {object} [o]
 * @param {string} [o.root] - the cwd the agent starts in. The agent acquires its OWN lane clone (brief step 1),
 *   so this is the checkout it runs `lane-pool acquire` from, never the lane itself.
 * @param {Function} [o.spawnAgent] - injectable `(argv, opts) => stdout`; the default shells `claude`.
 * @param {Function} [o.exec] - the `execFileSync`-shaped call the DEFAULT `spawnAgent` goes through. See
 *   {@link readTick} for why this is a second seam and not the same one.
 * @param {() => string} [o.mintSessionId] - injectable UUID minter.
 * @param {() => Date} [o.now] - injectable clock, for `expectedBy`.
 * @param {string[]} [o.extraArgs]
 * @returns {Record<string, Function>} effect type → `async (payload, ctx) => result`.
 */
export function createDispatchSinks({
  root = REPO_ROOT,
  exec = execFileSync,
  spawnAgent = (argv, opts) => defaultSpawnAgent(argv, opts, { exec }),
  mintSessionId = () => randomUUID(),
  now = () => new Date(),
  extraArgs = [],
} = {}) {
  return {
    [DISPATCH_EFFECT]: async (payload) => {
      assertNotALaneCheckout(root);
      const sessionId = String(mintSessionId());
      const argv = buildAgentArgv({ sessionId, payload, extraArgs });
      try {
        spawnAgent(argv, { cwd: root });
      } catch (e) {
        if (isPreSpawnRefusal(e)) {
          throw notApplied(`claude could not be started (${String(e.code)}) — no agent exists`, { sessionId });
        }
        // INDETERMINATE. The entry stays `in-flight` with a NULL handle: something may be running and cannot be
        // observed. The replay guard refuses it and `inFlightEntries` reports it under `unknown`, which is
        // exactly right — a person finds out what happened and closes it out.
        throw new Error(
          `claude --bg failed and whether an agent started is UNKNOWN: ${String((e && e.message) || e).split('\n')[0]}`,
        );
      }
      const minutes = Number(payload.expectedWithinMinutes) > 0
        ? Number(payload.expectedWithinMinutes)
        : DEFAULT_EXPECTED_WITHIN_MINUTES;
      return inFlight({
        handle: sessionId,
        expectedBy: new Date(now().getTime() + minutes * 60 * 1000).toISOString(),
      });
    },
  };
}

/**
 * The default `claude --bg` spawner — named and exported for the same reason as {@link defaultRunNode}: the
 * TIMEOUT it sets is the whole point of the option bag, and while it lived inside a default parameter that
 * every test overrode, deleting it left the suite green (PR #1211 review, F5).
 *
 * @param {string[]} argv
 * @param {object} [opts]
 * @param {{exec?: Function}} [io] - injected ONLY so the opts can be asserted.
 * @returns {string}
 */
export function defaultSpawnAgent(argv, opts = {}, { exec = execFileSync } = {}) {
  return exec('claude', argv, {
    encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, timeout: SPAWN_TIMEOUT_MS, killSignal: 'SIGKILL', ...opts,
  });
}

/**
 * The `claude` argv for one dispatch. PURE and exported, because the argv IS the contract with the CLI and a
 * test that asserts it is the only thing standing between a flag rename and a silent non-dispatch.
 *
 * `--bg` starts the session and returns immediately; `--session-id` pins the handle; `-n` names the session so
 * `claude agents` is legible to an operator watching the pool.
 *
 * THE PROMPT'S POSITION GUARANTEES NOTHING, which the first cut of this comment got wrong. `claude` parses with
 * commander, and commander accepts options intermixed with operands — a last positional beginning with `-` is
 * still read as a flag. Rather than bet on `--` being handled the way this file hopes (untested against the
 * real CLI, and a wrong bet turns into a dispatch with a mangled prompt), the dash is REFUSED outright. Every
 * legitimate brief starts with markdown, so the refusal costs nothing and proves what the position could not.
 */
export function buildAgentArgv({ sessionId, payload, extraArgs = [] }) {
  const prompt = String(payload?.prompt || '');
  if (!prompt.trim()) throw notApplied('dispatch-lane: refusing to start an agent with an empty prompt');
  if (prompt.trimStart().startsWith('-')) {
    throw notApplied('dispatch-lane: refusing a brief that begins with `-` — an argument parser can read it as a flag');
  }
  return [
    '--bg',
    '--session-id', String(sessionId),
    '-n', String(payload.sessionSlug || `conveyor-${payload.num}`),
    ...extraArgs.map(String),
    prompt,
  ];
}

/**
 * THE OBSERVER — the #3084 half that asks how a dispatched build is going.
 *
 * IT ANSWERS `running` OR `unresolved`, AND NEVER `succeeded`. That is not an omission, it is what the tool
 * exposes. `claude agents --json` reports LIVENESS: a session is in the list or it is not. It carries no exit
 * status, no outcome, and (measured on 2.1.220, with `--all`) no terminal record for a completed session at
 * all. So "the session is gone" collapses *finished cleanly* and *died* into one observation, and the
 * vocabulary has exactly one honest word for that: `unresolved` — terminal for the observer, actionable by a
 * person, WRITES NOTHING. Answering `succeeded` there would record `applied` for a build that may have crashed,
 * and the run would advance past the step that exists to react to it.
 *
 * THIS IS WHY `--all` IS NOT PASSED. It also lists COMPLETED sessions, so a finished build would keep reading
 * as `running` forever — the one mistake that makes an observer worse than none.
 *
 * WHAT THAT COSTS, STATED PROPERLY: `unresolved` writes nothing, so a finished dispatch is re-reported on EVERY
 * waker pass, and past `STUCK_ESCALATION_HOURS` the waker starts exiting non-zero on every pass until a person
 * closes the entry out (`node scripts/operations/wake.mjs --resolve=<runId> --key=<effectKey> --status=…`).
 * That is a standing cost per completed build, not a one-off line. The genuine completion signal for a delivery
 * agent is its PR, which the conveyor's own watcher (`we:scripts/conveyor/pr-watch.mjs`) already watches to a
 * terminal state; folding that in is #x9ylkp7.
 *
 * WHAT IT NO LONGER COSTS. Until PR #1211's review it also locked the item out of dispatching AGAIN, forever —
 * the never-resolving entry composed with a double-dispatch guard that held on any in-flight record and a run
 * store that never prunes, so the operation was single-use per item. The guard now ages a stale hold out
 * (`dispatch-lane.mjs#dispatchStillHolds`), which is what keeps this deferral a cost rather than a wedge.
 *
 * ONE LISTING PER PASS. The table is built once per pass and MEMOIZES the read, so a run with several in-flight
 * entries — or several parked runs in one pass — costs one subprocess, not one per entry. Build a fresh table
 * for a fresh pass; the CLI at the bottom of `we:scripts/operations/wake.mjs` does exactly that.
 *
 * @param {object} [o]
 * @param {() => object[]} [o.listAgents] - injectable `claude agents --json` reader.
 * @param {Function} [o.exec] - the `execFileSync`-shaped call the DEFAULT reader goes through. See
 *   {@link readTick} for why this is a second seam and not the same one.
 * @param {() => Date} [o.now]
 * @returns {Record<string, Function>} effect type → `async (entry, ctx) => {status, result?, error?}`.
 */
export function createDispatchObservers({ exec = execFileSync, listAgents = () => defaultListAgents({ exec }), now = () => new Date() } = {}) {
  // `undefined` is the not-yet-read sentinel, NOT `null`: a reader that returns `null` (or anything else the
  // check below refuses) must still be memoized, or every entry re-shells it — the exact per-entry cost this
  // memo removes. A THROW is not memoized, so a transient failure is retried rather than poisoning the pass.
  let listed;
  return {
    [DISPATCH_EFFECT]: async (entry, ctx) => {
      const handle = String(ctx?.handle ?? entry?.handle ?? '');
      if (listed === undefined) listed = listAgents();
      const sessions = listed;
      if (!Array.isArray(sessions)) {
        throw new TypeError('dispatch-lane-io: `claude agents --json` did not return an array');
      }
      const live = sessions.find((s) => s && String(s.sessionId) === handle);
      if (live) return { status: 'running', result: null };

      // NOT-YET-LISTED IS NOT GONE. `--bg` returns before the session is necessarily visible, so a poll inside
      // the grace window still reads as running rather than closing out a build that is still starting.
      const started = entry?.startedAt ? Date.parse(entry.startedAt) : NaN;
      if (!Number.isNaN(started) && now().getTime() - started < LISTING_GRACE_MS) {
        return { status: 'running', result: null };
      }
      return {
        status: 'unresolved',
        error: `session ${handle} is no longer listed by \`claude agents\`, which reports liveness and not outcome — `
          + 'whether the build finished cleanly cannot be told from here. Check its PR, then close the entry out.',
      };
    },
  };
}

/**
 * `claude agents --json` — active sessions only. See {@link createDispatchObservers} for why not `--all`.
 *
 * BOUNDED, because this call sits synchronously inside a waker pass that promises to be fail-soft per run: a
 * `claude` that blocks (a cold start that wants to ask something, a wedged daemon) would otherwise stall every
 * OTHER parked run in the pass. A timeout turns that into one reported observer error, which is what the
 * contract says should happen.
 *
 * ASSERTED, not merely asserted-about. This function was called by no test at all, so both of the emphatic
 * claims above it — no `--all`, and a timeout — could be inverted with the suite green (PR #1211 review, F5/F6).
 * `dispatch-lane-defaults.test.mjs` now pins the argv and the opts, and the wake CLI test proves the same argv
 * across a real process boundary.
 *
 * @param {{exec?: Function}} [io] - injected ONLY so the argv and opts can be asserted.
 */
export function defaultListAgents({ exec = execFileSync } = {}) {
  const out = exec('claude', ['agents', '--json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 8 * 1024 * 1024,
    timeout: LIST_TIMEOUT_MS,
    killSignal: 'SIGKILL',
  });
  return JSON.parse(String(out || '[]'));
}
