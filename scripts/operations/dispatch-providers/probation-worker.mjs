/**
 * @file scripts/operations/dispatch-providers/probation-worker.mjs
 * @description THE PROBATION-WORKER DISPATCH PROVIDER (agy-launcher-probation, operator 2026-09-27) — runs an
 *   opened, non-critical `ci-heal` on the probation worker the router picked (Codex, Antigravity-Claude or
 *   Antigravity-Gemini — `we:scripts/lib/provider-routing.mjs#selectProbationWorker`), instead of a
 *   `claude --bg` session.
 *
 * SAME PORT CONTRACT AS EVERY OTHER PROVIDER — `(request, io?) => 'pid:<n>'`, read from {@link ./build.mjs}'s own
 * docblock rather than restated. It spawns {@link PROBATION_HEAL_RUN_SCRIPT} detached and returns its handle in
 * milliseconds; the run script owns the whole heal arc (see its own header).
 *
 * WHEN IT RUNS. `../dispatch-lane-io.mjs#routeDispatchProvider` hands a request here only when ALL hold:
 *   1. the request carries a `probationWorker` (the router's pick — so the gate was open and the task not critical);
 *   2. the launch kind is in {@link PROBATION_LAUNCH_KINDS} (`ci-heal` only — the one kind with a launcher here;
 *      a `doc-fix` build still records its pick but runs on Claude until the build launcher takes probation work);
 *   3. the repo is WE (the run script resolves every tool through WE's own checkout);
 *   4. {@link probationLaunchFromEnv} says `on`.
 * Anything else takes the unchanged path. So the pick is always RECORDED; it is only LAUNCHED where it can run.
 *
 * WHAT IT REPORTS. `request.reportExecutor` (the #2815 `executor` field, a no-op before that lands): `antigravity`
 * or `codex` — the vendor the run script will actually spawn, never a guess.
 */

import { join } from 'node:path';
import { normNum } from '../../conveyor/queue-store.mjs';
import { notApplied } from '../effect-executor.mjs';
import { DETACHED_HANDLE_PREFIX, REPO_ROOT, defaultSpawnDetached, deliveryDispatchLogPath } from '../detached-dispatch.mjs';

/** The per-dispatch process this provider starts. Resolved by script location, never cwd. */
export const PROBATION_HEAL_RUN_SCRIPT = join(REPO_ROOT, 'scripts', 'operations', 'probation-heal-run.mjs');

/** The launch kinds a probation worker can be LAUNCHED for today. */
export const PROBATION_LAUNCH_KINDS = Object.freeze(['ci-heal']);

/** The env var that turns launching off (`off`) or on (`on`). Read ONCE per sink, like the dispatch modes. */
export const PROBATION_LAUNCH_ENV = 'WE_PROBATION_LAUNCH';

/**
 * `on` or `off`. PURE over `env`. An explicit value wins (anything but `on`/`off` THROWS, the same rule the
 * dispatch-mode knobs follow: a typo must never silently pick a side). Unset means `on` — the operator opened
 * these rows on 2026-09-27 — EXCEPT under the test runner (`VITEST`), where unset means `off`, so no unit test
 * that builds a real sink can start a real detached heal by accident.
 * @param {Record<string, string|undefined>} [env]
 * @returns {'on'|'off'}
 */
export function probationLaunchFromEnv(env = process.env) {
  const raw = String(env?.[PROBATION_LAUNCH_ENV] ?? '').trim().toLowerCase();
  if (!raw) return env?.VITEST ? 'off' : 'on';
  if (raw !== 'on' && raw !== 'off') {
    throw new TypeError(`operations: ${PROBATION_LAUNCH_ENV} must be \`on\` or \`off\`, got ${JSON.stringify(raw)}`);
  }
  return raw;
}

/**
 * Should this request go to the probation launcher? PURE.
 * @param {object} request
 * @param {'on'|'off'} launch
 * @returns {{launch: boolean, why: string}}
 */
export function probationLaunchDecision(request, launch) {
  const kind = String(request?.launchKind ?? '');
  const worker = request?.probationWorker;
  if (!worker) return { launch: false, why: 'no probation worker on the request' };
  if (!PROBATION_LAUNCH_KINDS.includes(kind)) return { launch: false, why: `kind '${kind}' has no probation launcher yet` };
  const repo = String(request?.repo ?? 'we');
  if (repo !== 'we') return { launch: false, why: `repo '${repo}' — the probation launcher runs WE heals only` };
  if (launch !== 'on') return { launch: false, why: `${PROBATION_LAUNCH_ENV}=off` };
  return { launch: true, why: `probation worker ${worker.id} (${worker.provider}/${worker.model})` };
}

/**
 * THE PROVIDER. Spawns the run script detached and returns `pid:<n>`. Refuses with `notApplied` BEFORE any process
 * exists when the request cannot be launched (the entry then lands `failed` and is retried), and throws a plain
 * error AFTER a spawn whose pid cannot be read (INDETERMINATE — see `ci-heal.mjs` for the same split).
 * @param {object} request
 * @param {{spawnDetached?: Function, logPathFor?: Function, runScript?: string}} [io]
 * @returns {string}
 */
export function probationWorkerDetachedProvider(request, {
  spawnDetached = defaultSpawnDetached,
  logPathFor = deliveryDispatchLogPath,
  runScript = PROBATION_HEAL_RUN_SCRIPT,
} = {}) {
  const worker = request?.probationWorker;
  const pr = normNum(request?.pr);
  const sessionSlug = String(request?.sessionSlug ?? '').trim();
  const reason = String(request?.reason ?? '').trim() || 'red-ci';
  if (!worker?.id || !worker?.provider || !worker?.model) throw notApplied('dispatch-lane: refusing a probation launch with no probation worker');
  if (!pr) throw notApplied('dispatch-lane: refusing a probation ci-heal launch with no PR number');
  if (!sessionSlug) throw notApplied(`dispatch-lane: refusing a probation ci-heal launch for PR #${pr} with no session slug`);

  const argv = [
    String(runScript), `--pr=${pr}`, `--session=${sessionSlug}`, `--reason=${reason}`,
    `--worker=${JSON.stringify(worker)}`,
  ];
  const num = normNum(request?.num);
  if (num) argv.push(`--num=${num}`);
  const lane = Number(request?.lane);
  if (Number.isInteger(lane) && lane > 0) argv.push(`--lane=${lane}`);
  const scope = Array.isArray(request?.scope) ? request.scope.map(String).filter(Boolean) : [];
  if (scope.length) argv.push(`--scope=${scope.join(',')}`);

  const child = spawnDetached(argv, { cwd: request?.cwd ?? REPO_ROOT, logPath: logPathFor(sessionSlug), settingsEnv: request?.settingsEnv });
  const pid = Number(child?.pid);
  if (!Number.isInteger(pid) || pid <= 0) {
    throw new Error(`dispatch-lane: started the probation heal for PR #${pr} but node reported no pid — whether it is running cannot be told from here`);
  }
  // #2815's one `executor` field — the vendor the run script spawns. A no-op until that field lands.
  request?.reportExecutor?.(worker.executor);
  return `${DETACHED_HANDLE_PREFIX}${pid}`;
}
