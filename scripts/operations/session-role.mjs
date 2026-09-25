/** #3383 — Worker marker: tells an ORCHESTRATOR session apart from a spawned WORKER, so a hook-driven
 * `tick-once` runs only in the former.
 *
 * WHY AN ENV MARKER AND NOT A "I AM AN ORCHESTRATOR" MARKER. An orchestrator is whatever session the operator
 * opened by hand, and nothing spawns it, so nothing could set a positive marker on it. A worker is only ever
 * created by our own spawn sites, so THAT is where a marker can be set reliably. Spawning inherits the
 * environment, so a child of a worker keeps the marker: it is set here on the way down and never cleared.
 *
 * THE MARKER: `WE_CONVEYOR_WORKER=1`.
 *   • unset                       -> orchestrator (nothing marked this process as a worker)
 *   • `1`                         -> worker
 *   • anything else (`0`, empty,  -> UNKNOWN. Fail closed: `tick-once` refuses. A marker we did not write, or
 *     `true`, garbage)               one somebody half-cleared, is not evidence of an orchestrator.
 *
 * Every place that spawns a `claude` session (or a node wrapper that in turn spawns one) passes its env through
 * {@link markWorkerEnv}: `dispatch-lane-io.mjs` (`defaultSpawnAgent`, `spawnAgentToCompletion`),
 * `detached-dispatch.mjs` (`defaultSpawnDetached`), `deliver-item-wrapper.mjs`, `operator/dispatch.mjs` and
 * `lib/judge-spawn.mjs`. A NEW spawn site must do the same, or its child could look like an orchestrator.
 * MEASURED (xgqz204, 2026-09-25, CLI 2.1.282): `claude --bg` does NOT hand the spawner's ambient env on to the
 * session — a var set on the spawning shell was absent from the session's hook env. What DOES arrive, in the
 * hook process env and the Bash tool env alike, is `--settings '{"env":{...}}'`: 5/5 probe sessions, 4 of them
 * served by pre-warmed spares forked by ANOTHER process (they carried that process's env), still saw it. So a
 * `claude --bg` spawn must put the marker in `--settings` — {@link workerMarkerSettingsEnv} — not only in the
 * spawn call's `env`.
 */
export const WORKER_MARKER_ENV = 'WE_CONVEYOR_WORKER';
export const WORKER_MARKER_VALUE = '1';

/** A copy of `env` with the worker marker set. Pass the result as a spawn's `env`. Never mutates `env`. */
export function markWorkerEnv(env = process.env) {
  return { ...(env ?? {}), [WORKER_MARKER_ENV]: WORKER_MARKER_VALUE };
}

/** A copy of a `--settings` env object (or `null`) with the worker marker set — what every `claude --bg` spawn
 *  folds into `--settings '{"env":...}'` (see the header: the spawn's own `env` never reaches a `--bg` session).
 *  Never mutates its input. */
export function workerMarkerSettingsEnv(settingsEnv = null) {
  return { ...(settingsEnv ?? {}), [WORKER_MARKER_ENV]: WORKER_MARKER_VALUE };
}

/** @returns {{ role: 'orchestrator'|'worker'|'unknown', reason: string }} */
export function classifySession(env = process.env) {
  if (!env || typeof env !== 'object') return { role: 'unknown', reason: 'no environment to read' };
  if (!Object.hasOwn(env, WORKER_MARKER_ENV) || env[WORKER_MARKER_ENV] === undefined) {
    return { role: 'orchestrator', reason: `${WORKER_MARKER_ENV} is not set` };
  }
  if (env[WORKER_MARKER_ENV] === WORKER_MARKER_VALUE) return { role: 'worker', reason: `${WORKER_MARKER_ENV}=1` };
  return { role: 'unknown', reason: `${WORKER_MARKER_ENV} has an unrecognised value ${JSON.stringify(String(env[WORKER_MARKER_ENV]))}` };
}
