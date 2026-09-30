#!/usr/bin/env node
/**
 * @file scripts/conveyor/health-investigate-dispatch.mjs
 * @description #4078 (health daemon slice 2, ruling #4065 clause 2) — the IO SHELL that dispatches ONE
 *   diagnose-only investigation agent per health episode, stops it at its wall clock, and lands its findings in
 *   the episode report. The decisions are pure and live in we:scripts/conveyor/health-investigate-plan.mjs; this
 *   file reads, spawns, stops and writes.
 *
 * LAUNCHED AS A KIND ON THE DECLARED `dispatch-lane` OPERATION
 * (#conveyor-dispatch-calls-the-declared-operation clause 1), never through the stuck-PR inspector's spawner:
 * the brief is filled by `dispatch-lane.mjs#fillBrief` against `BRIEF_REQUIRED_BY_KIND['health-investigate']`,
 * the session is named by `sessionSlugFor`, and the agent is started by that operation's ONE sink
 * (`dispatch-lane-io.mjs#createDispatchSinks`) — the same composition `ci-heal-pr-dispatch.mjs` uses. The model is
 * dispatch routing's answer for the investigator role (`decideDispatchRoute({kind: 'investigate'})`, whose tier
 * the sink turns into `--model`), never hand-set here.
 *
 * READ-ONLY TOOL SURFACE ({@link healthInvestigateToolArgs}). The agent reads untrusted transcript text, so the
 * deny list holds Edit/Write and every `gh` call (including `gh pr comment`), `git`, network fetches, and every
 * declared operation except the read ones in {@link HEALTH_INVESTIGATE_READ_OPERATIONS}. The allow list
 * pre-approves exactly those reads, so an unattended `--bg` session never sits on a permission prompt for them.
 * Its ONE write is this file's own `record` verb, which accepts only the running session's own episode, once,
 * and scrubs everything before writing. Same residual `review-dispatch.mjs` states for itself: a prefix-match
 * deny list is not a sandbox.
 *
 * THE WALL CLOCK is enforced by stopping the session through `session-reaper.mjs#stopSessionWithRetry` — the
 * reaper's own `claude stop` path — on the first tick within `investigateReapLeadMs` of `investigateWallClockMs`,
 * or as soon as the findings land.
 *
 * Files (under `health-watch-section.mjs#healthDir`):
 *   investigations/ledger.json           every dispatch and its status (written only by the tick)
 *   investigations/<episodeId>.json      the agent's scrubbed findings (written only by `record`, once)
 *
 * Usage (the agent's own two commands — the tick calls {@link runInvestigations} in-process):
 *   node scripts/conveyor/health-investigate-dispatch.mjs show   --episode=<id>
 *   node scripts/conveyor/health-investigate-dispatch.mjs record --episode=<id> --session=<slug>   < findings.json
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, appendFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  BRIEF_REQUIRED_BY_KIND, DISPATCH_EFFECT, HEALTH_INVESTIGATE_KIND, fillBrief, sessionSlugFor,
} from '../operations/dispatch-lane.mjs';
import {
  REPO_ROOT, agentArgsFromEnv, createDispatchSinks, resolveDispatchSettingsEnv,
} from '../operations/dispatch-lane-io.mjs';
import { resolveDispatchRoute as decideDispatchRoute } from '../lib/dispatch-routing-policy-io.mjs';
import { CONVEYOR_STATE_ROOT_ENV } from '../lib/daemon-last-good.mjs';
import { stopSessionWithRetry } from './session-reaper.mjs';
import { DEFAULT_HEALTH_CONFIG, renderInvestigationSection } from './health-watch-core.mjs';
import { planInvestigations, planWallClock, pruneLedger, validateFindings } from './health-investigate-plan.mjs';
import { healthDir } from './health-watch-section.mjs';

// ── the tool surface ─────────────────────────────────────────────────────────────────────────────────────────

/** The declared read operations the agent may run through `run.mjs` (4078: runner-activity, stale-state,
 *  dispatch-eligibility). Every other operation id is denied — see {@link NON_READ_OPERATIONS}. */
export const HEALTH_INVESTIGATE_READ_OPERATIONS = Object.freeze(['runner-activity', 'stale-state', 'dispatch-eligibility']);

/** Every OTHER `run.mjs` operation id, denied by name. A static list (importing `run.mjs` here would pull every
 *  operation's io into the health tick); `health-investigate-dispatch.test.mjs` asserts it covers every id in
 *  `run.mjs#OPERATIONS`, so a new operation cannot silently become reachable. */
export const NON_READ_OPERATIONS = Object.freeze([
  'review-pr', 'review-prep', 'record-verdict', 'verify', 'mutation-check', 'gap-sweep-status', 'clear-stuck-session',
  'resolve', 'scaffold', 'file-item', 'suggest-next', 'pr-status', 'land-advance', 'pr-reconcile', 'pr-ownership',
  'agent-activity', 'daemon-status', 'heavy-queue', 'review-seat-caps', 'gate-health', 'telemetry-summary',
  'graduation-progress-report', 'route-pr-outcome', 'dispatch-lane', 'claim', 'open-pr', 'explore', 'stage-pr-view',
  'docket-refresh', 'restart-runner', 'priority-sync', 'live-state', 'live-work',
]);

/** Pre-approved commands, as `node <root>/…` prefixes (the agent's cwd is a scratch dir outside any checkout). */
export function healthInvestigateReadCommands(root = REPO_ROOT) {
  return [
    ...HEALTH_INVESTIGATE_READ_OPERATIONS.map((op) => `node ${root}/scripts/operations/run.mjs ${op}`),
    `node ${root}/scripts/conveyor/github-app-status.mjs`,
    // bounded transcript reads — byte-capped tail, per-field truncation (see that script's own header)
    `node ${root}/skills-src/inspect-agent-health/agent-health.mjs`,
    `node ${root}/scripts/conveyor/health-investigate-dispatch.mjs show`,
    `node ${root}/scripts/conveyor/health-investigate-dispatch.mjs record`,
    'claude agents',
  ];
}

/** The deny list. Both the absolute (`node <root>/scripts/…`) and relative spellings of every script rule. */
export function healthInvestigateDisallowedTools(root = REPO_ROOT) {
  const script = (rel) => [`Bash(node ${root}/${rel}:*)`, `Bash(node ${rel}:*)`];
  return [
    'Edit', 'Write', 'MultiEdit', 'NotebookEdit', 'WebFetch', 'WebSearch',
    // gh wholesale — this agent needs none (its gh-backed reads run as child processes of the declared scripts,
    // where Bash rules never reach). `gh pr comment` is named on its own too: it is the one write the card
    // calls out, and it stays denied even if the wholesale rule is ever narrowed.
    'Bash(gh:*)', 'Bash(gh pr comment:*)', 'Bash(gh api:*)',
    'Bash(git:*)', 'Bash(curl:*)', 'Bash(wget:*)',
    'Bash(claude stop:*)', 'Bash(claude rm:*)', 'Bash(claude --bg:*)',
    ...NON_READ_OPERATIONS.flatMap((op) => script(`scripts/operations/run.mjs ${op}`)),
    ...['scripts/backlog.mjs', 'scripts/lane-pool.mjs', 'scripts/pr-land.mjs', 'scripts/merge-ai-prs.mjs',
      'scripts/review-set-label.mjs', 'scripts/operations/completion-cli.mjs', 'scripts/conveyor/session-reaper.mjs',
      'scripts/conveyor/health-watch.mjs', 'scripts/conveyor/stuck-pr-inspect-dispatch.mjs'].flatMap(script),
  ];
}

/** ONE `=`-joined argv element per flag — never two (`--disallowedTools` is variadic and would swallow the
 *  prompt `buildAgentArgv` appends after it; `stuck-pr-inspect-dispatch.mjs#inspectDispatchDisallowedToolsArgs`). */
export function healthInvestigateToolArgs(root = REPO_ROOT) {
  return [
    `--disallowedTools=${healthInvestigateDisallowedTools(root).join(',')}`,
    `--allowedTools=${healthInvestigateReadCommands(root).map((c) => `Bash(${c}:*)`).join(',')}`,
  ];
}

// ── paths + small io ─────────────────────────────────────────────────────────────────────────────────────────

const EPISODE_ID_RE = /^[a-z0-9][a-z0-9-]{0,160}$/;
export function investigationsDir(dir) { return join(dir, 'investigations'); }
export function ledgerPath(dir) { return join(investigationsDir(dir), 'ledger.json'); }
export function findingsPath(dir, episodeId) {
  if (!EPISODE_ID_RE.test(String(episodeId ?? ''))) throw new Error(`health-investigate: not an episode id: ${JSON.stringify(episodeId)}`);
  return join(investigationsDir(dir), `${episodeId}.json`);
}
function readJson(path, fallback) { try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return fallback; } }
function writeJsonAtomic(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp-${process.pid}`;
  writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(tmp, path);
}
export function readLedger(dir) { const v = readJson(ledgerPath(dir), []); return Array.isArray(v) ? v : []; }
export function readFindings(dir, episodeId) { try { return readJson(findingsPath(dir, episodeId), null); } catch { return null; } }

// ── dispatch ─────────────────────────────────────────────────────────────────────────────────────────────────

/** The investigator role's route — the model tier the sink turns into `--model`. Never throws: an unroutable
 *  call yields `null` and the sink then injects no `--model` (the operator's default). */
export function routeInvestigator({ route = decideDispatchRoute } = {}) {
  try { return route({ kind: 'investigate', cause: null, scopePaths: [] }, { scorecards: [] }); } catch { return null; }
}

/**
 * The dispatch-lane sink, configured for a lane-less, read-only agent: the tool surface rides `extraArgs`
 * (always — an override cannot drop it), no lane is granted Edit/Write, and the health state root rides the
 * session's `--settings` env so the agent's `record`/`show` resolve the SAME `healthDir` as this tick (a `--bg`
 * session does not inherit the spawner's environment).
 */
export function createInvestigationSinks({ root = REPO_ROOT, stateRoot = null, agentArgs = agentArgsFromEnv(), ...sinkOverrides } = {}) {
  const baseSettings = sinkOverrides.resolveSettingsEnv ?? resolveDispatchSettingsEnv;
  return createDispatchSinks({
    root,
    ...sinkOverrides,
    extraArgs: [...agentArgs, ...healthInvestigateToolArgs(root)],
    resolveLaneGrant: () => ({ additionalDirectories: [], allow: [] }),
    resolveSettingsEnv: (cwd) => ({ ...(baseSettings(cwd) || {}), ...(stateRoot ? { [CONVEYOR_STATE_ROOT_ENV]: stateRoot } : {}) }),
  });
}

/** The brief template `we:skills-src/conveyor/health-investigate-brief.md`, read fresh per dispatch. */
export function healthInvestigateBriefPath(root = REPO_ROOT) {
  return join(root, 'skills-src', 'conveyor', 'health-investigate-brief.md');
}

/**
 * DISPATCH ONE INVESTIGATION: fill the brief → route the investigator role → hand one effect payload to the
 * dispatch-lane sink.
 * @param {{episodeId:string, smell:string}} target
 * @param {object} [o]
 * @returns {Promise<{handle:string|null, session:string, unknownTokens:string[], routing:object|null}>}
 */
export async function dispatchInvestigation(target, {
  root = REPO_ROOT, stateRoot = null, config = {},
  readBrief = (r) => readFileSync(healthInvestigateBriefPath(r), 'utf8'),
  sinks = createInvestigationSinks({ root, stateRoot }),
  route = () => routeInvestigator(),
} = {}) {
  const cfg = { ...DEFAULT_HEALTH_CONFIG, ...config };
  const session = sessionSlugFor(target.episodeId, HEALTH_INVESTIGATE_KIND);
  const { prompt, unknownTokens } = fillBrief(readBrief(root), {
    EPISODE_ID: target.episodeId, SMELL: target.smell, SESSION_SLUG: session, WE_ROOT: root,
  }, BRIEF_REQUIRED_BY_KIND[HEALTH_INVESTIGATE_KIND], []);
  const routing = route();
  const out = await sinks[DISPATCH_EFFECT]({
    launchKind: HEALTH_INVESTIGATE_KIND, prompt, sessionSlug: session, lane: null, scope: [], routing,
    expectedWithinMinutes: Math.ceil(cfg.investigateWallClockMs / 60_000),
  });
  return { handle: out?.handle ?? null, session, unknownTokens, routing };
}

// ── the tick's pass ──────────────────────────────────────────────────────────────────────────────────────────

/**
 * ONE PASS, called by the health tick after its diagnoses and before it writes reports. In order:
 *   1. stop every running investigation whose findings landed or whose wall clock is due;
 *   2. dispatch what {@link planInvestigations} clears (nothing unless `investigateDispatch` is on);
 *   3. annotate each episode in `state` with its investigation status and findings (the report renders them);
 *   4. append the findings to the report of an episode that already CLOSED before they landed;
 *   5. write the ledger.
 * `dryRun` decides everything and performs nothing (no stop, no spawn, no write). Never throws for one
 * investigation's failure — each is recorded on the ledger instead.
 * @returns {Promise<{dispatched:Array<object>, held:Array<object>, stopped:Array<object>, failed:Array<object>}>}
 */
export async function runInvestigations({
  dir, state, smells, config = {}, now, dryRun = false, root = REPO_ROOT,
  dispatch = (target) => dispatchInvestigation(target, { root, stateRoot: resolve(dir, '..', '..'), config }),
  stop = (handle) => stopSessionWithRetry({ handle }),
  appendReport = (path, text) => appendFileSync(path, text),
} = {}) {
  const cfg = { ...DEFAULT_HEALTH_CONFIG, ...config };
  const smellsById = Object.fromEntries((smells || []).map((s) => [s.id, s]));
  let ledger = readLedger(dir);
  const findingsCache = new Map();
  const findingsFor = (id) => {
    if (!findingsCache.has(id)) findingsCache.set(id, readFindings(dir, id));
    return findingsCache.get(id);
  };
  const summary = { dispatched: [], held: [], stopped: [], failed: [] };
  const at = new Date(now).toISOString();

  // 1. stop
  for (const s of planWallClock(ledger, { now, config: cfg, hasFindings: (id) => !!findingsFor(id) })) {
    const entry = ledger.find((x) => x.episodeId === s.episodeId);
    if (dryRun) { summary.stopped.push({ ...s, dryRun: true }); continue; }
    let ok = true;
    if (s.handle) {
      try { stop(s.handle); } catch (e) { ok = false; entry.lastStopError = String(e?.message || e).split('\n')[0]; }
    }
    if (ok) {
      entry.status = s.why === 'findings-recorded' ? 'finished' : 'stopped-wall-clock';
      entry.endedAt = now;
      entry.endReason = s.why;
      delete entry.lastStopError;
    }
    summary.stopped.push({ ...s, ok });
  }

  // 2. dispatch
  const planned = planInvestigations({ episodes: state.episodes || {}, smellsById, ledger, config: cfg, now });
  summary.held = planned.held;
  for (const target of planned.dispatch) {
    if (dryRun) { summary.dispatched.push({ ...target, dryRun: true }); continue; }
    const base = { episodeId: target.episodeId, key: target.key, smell: target.smell, subject: target.subject, startedAt: now };
    try {
      // eslint-disable-next-line no-await-in-loop -- one at a time: the running cap is counted per spawn.
      const r = await dispatch(target);
      ledger.push({ ...base, session: r.session, handle: r.handle, deadlineAt: now + cfg.investigateWallClockMs, status: 'running' });
      summary.dispatched.push({ ...target, session: r.session, handle: r.handle });
    } catch (e) {
      // Counts as this episode's one investigation (never retried every tick) and against the window budget.
      const error = String(e?.message || e).split('\n')[0];
      ledger.push({ ...base, session: null, handle: null, status: 'dispatch-failed', endedAt: now, endReason: error });
      summary.failed.push({ ...target, error });
    }
  }

  // 3. annotate open episodes
  const holdByEpisode = new Map(planned.held.filter((h) => h.rule !== 'one-per-episode').map((h) => [h.episodeId, h]));
  for (const ep of Object.values(state.episodes || {})) {
    if (!ep?.id) continue;
    const entry = ledger.find((x) => x.episodeId === ep.id);
    const hold = holdByEpisode.get(ep.id);
    if (entry) {
      ep.investigationStatus = statusLine(entry);
      const f = findingsFor(ep.id);
      if (f) ep.investigation = f;
    } else if (hold) {
      ep.investigationStatus = { status: 'held', reason: hold.reason, session: null };
    }
  }

  // 4. findings for an episode that closed before they landed: the tick no longer re-renders its report.
  const openIds = new Set(Object.values(state.episodes || {}).map((e) => e?.id).filter(Boolean));
  for (const entry of ledger) {
    if (entry.reportedAt || openIds.has(entry.episodeId)) continue;
    const f = findingsFor(entry.episodeId);
    const md = join(dir, 'episodes', `${entry.episodeId}.md`);
    if (!f || dryRun || !existsSync(md)) continue;
    try {
      appendReport(md, `\n${renderInvestigationSection({ investigationStatus: statusLine(entry), investigation: f }).join('\n')}\n`);
      entry.reportedAt = at;
    } catch { /* retried next tick */ }
  }
  for (const entry of ledger) if (!entry.reportedAt && openIds.has(entry.episodeId) && findingsFor(entry.episodeId)) entry.reportedAt = at;

  // A tick with dispatch off and nothing ever dispatched leaves no ledger file behind.
  if (!dryRun && (ledger.length || existsSync(ledgerPath(dir)))) writeJsonAtomic(ledgerPath(dir), pruneLedger(ledger, { now, config: cfg }));
  return summary;
}

function statusLine(entry) {
  const reason = {
    running: `started ${new Date(entry.startedAt).toISOString()}, stopped by ${new Date(entry.deadlineAt ?? entry.startedAt).toISOString()} at the latest`,
    finished: 'findings recorded; session stopped',
    'stopped-wall-clock': 'stopped at the wall clock before recording findings',
    'dispatch-failed': `the dispatch failed — ${entry.endReason ?? 'unknown'}`,
  }[entry.status] ?? entry.status;
  return { status: entry.status, reason: entry.lastStopError ? `${reason} (last stop attempt failed: ${entry.lastStopError})` : reason, session: entry.session ?? null };
}

// ── the agent's two verbs ────────────────────────────────────────────────────────────────────────────────────

/**
 * `record`: the agent's ONE write. Accepted only for a RUNNING ledger entry whose episode AND session match (a
 * prompt-injected agent cannot write another episode's report), and only once. Scrubbed before it is written.
 * @returns {{path:string, findings:object}}
 */
export function recordFindings({ dir, episodeId, session, input, now = Date.now(), home = homedir() }) {
  const path = findingsPath(dir, episodeId);
  const entry = readLedger(dir).find((x) => x.episodeId === episodeId);
  if (!entry) throw new Error(`health-investigate: no investigation is on the ledger for episode ${episodeId}`);
  if (entry.session !== session) throw new Error(`health-investigate: episode ${episodeId} belongs to session ${entry.session}, not ${session}`);
  if (entry.status !== 'running') throw new Error(`health-investigate: the investigation of ${episodeId} is ${entry.status} — nothing more can be recorded`);
  if (existsSync(path)) throw new Error(`health-investigate: findings for ${episodeId} are already recorded — one record per investigation`);
  const findings = { ...validateFindings(input, { home }), recordedAt: new Date(now).toISOString(), session };
  writeJsonAtomic(path, findings);
  return { path, findings };
}

/** `show`: the episode report the agent starts from (already scrubbed by the tick). */
export function showEpisode({ dir, episodeId }) {
  findingsPath(dir, episodeId); // validates the id shape
  const md = join(dir, 'episodes', `${episodeId}.md`);
  if (!existsSync(md)) throw new Error(`health-investigate: no report for episode ${episodeId} under ${dirname(md)}`);
  return readFileSync(md, 'utf8');
}

function parseFlags(argv) {
  const flags = {};
  const pos = [];
  for (const a of argv) {
    if (!a.startsWith('--')) { pos.push(a); continue; }
    const eq = a.indexOf('=');
    flags[eq === -1 ? a.slice(2) : a.slice(2, eq)] = eq === -1 ? true : a.slice(eq + 1);
  }
  return { flags, pos };
}

export function main(argv, { readStdin = () => readFileSync(0, 'utf8'), out = (s) => process.stdout.write(s), err = (s) => process.stderr.write(s) } = {}) {
  const { flags, pos } = parseFlags(argv);
  const dir = healthDir(typeof flags['state-root'] === 'string' ? flags['state-root'] : undefined);
  try {
    if (pos[0] === 'show') { out(showEpisode({ dir, episodeId: flags.episode })); return 0; }
    if (pos[0] === 'record') {
      let input;
      try { input = JSON.parse(readStdin()); } catch (e) { throw new Error(`health-investigate: findings on stdin are not JSON — ${e.message}`); }
      const { path } = recordFindings({ dir, episodeId: flags.episode, session: flags.session, input });
      out(`health-investigate: findings recorded → ${path}\n`);
      return 0;
    }
    err('health-investigate: usage — show --episode=<id> | record --episode=<id> --session=<slug> < findings.json\n');
    return 1;
  } catch (e) {
    err(`${String(e?.message || e)}\n`);
    return 1;
  }
}

const IS_CLI = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (IS_CLI) process.exitCode = main(process.argv.slice(2));
