#!/usr/bin/env node
/**
 * @file scripts/conveyor/tick-once.mjs
 * @description #3383 — ONE conveyor tick, as a standalone, detached-safe CLI: the entry point a later
 *   SessionStart / UserPromptSubmit hook will run. A thin wrapper over `runTickOnce` (`skills-src/conveyor/runner.mjs`);
 *   it owns only the wakeup policy around it (who may tick, how often, what the outcome means). It builds its
 *   effects with the SAME `buildCliTickEffects` the resident runner uses — there is no second tick path.
 *
 * NOT HOOK WIRING. Nothing here edits settings.json, loads a launchd job, or gates a start. It NEVER starts or
 *   stops the resident runner and NEVER touches the runner singleton lease (`runner-lock.mjs`); two drivers are
 *   kept apart by the tick mutex inside `runTickOnce`, as slice 1 built it.
 *
 * USAGE   node scripts/conveyor/tick-once.mjs [--apply] [--verbose] [--min-interval-ms=N] [--repo=<name>]
 *   (no flag)  PLAN ONLY. Runs the read-only tick core and reports what a tick WOULD do. It claims no throttle,
 *              takes no tick mutex, dispatches nothing, runs no mechanical pass, saves no bookkeeping, writes no
 *              status file. (Same convention as land-advance: plan by default, `--apply` executes.)
 *   --apply    Claim the throttle, then run one real tick: status + decision trace, reconcile, mechanical passes,
 *              dispatch pass, save bookkeeping. Never run against live PRs from a test; the tests inject fixtures.
 *   --verbose  Print a one-line outcome and the decision trace (and any output the tick's child processes made).
 *              Without it the process writes NOTHING to stdout or stderr: the exit code is the whole answer, so
 *              a hook can detach it and forget it.
 *   --min-interval-ms=N  Coalesce wakeups inside N ms of the last SUCCESSFUL tick (default 60000; also env
 *              `WE_TICK_MIN_INTERVAL_MS`; the flag wins).
 *
 * EXIT CODES (each outcome distinct; a real crash of node itself is 1, a usage error is 2)
 *    0  ticked          apply: one full tick ran and its throttle claim was recorded as a success.
 *                       plan: a tick would run; the plan was produced.
 *   10  throttled       coalesced: inside the min interval, a tick is already in flight, or a concurrent wakeup
 *                       holds the claim fence. Nothing ran; nothing needs doing.
 *   11  skipped         not an orchestrator session: the worker marker is set, or its value is unrecognised
 *                       (fail closed: see `scripts/operations/session-role.mjs`). Checked before any file is touched.
 *   12  busy            the tick mutex is held by another driver, or an EXPIRED claim exists that cannot be proven
 *                       dead (other host, or a live pid). Retry on a later wakeup.
 *   13  unavailable     coordination (throttle record, tick mutex, bookkeeping, action store) unreadable or
 *                       corrupt. Fail closed: no tick ran.
 *   14  failed          the tick started and failed (lease lost, a thrown error). It is recorded as an ATTEMPT,
 *                       not a success, so it does not throttle the next wakeup.
 *    2  usage           bad flag or bad `--min-interval-ms`.
 *
 * THE THROTTLE record and its crash rules are documented in `scripts/operations/tick-throttle.mjs`.
 * THE WORKER MARKER (`WE_CONVEYOR_WORKER=1`) is documented in `scripts/operations/session-role.mjs`.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { classifySession } from '../operations/session-role.mjs';
import { createTickThrottle, parseMinIntervalMs, MIN_INTERVAL_ENV } from '../operations/tick-throttle.mjs';
import { resolveCoordinationRoot } from '../operations/coordination-root.mjs';
import { CoordinationUnavailableError } from '../operations/action-record.mjs';
import { DRIVER_ID } from '../operations/tick-mutex.mjs';
import { createTickBookkeeping } from './tick-bookkeeping.mjs';
import { runTickOnce, createTickCoordination, buildCliTickEffects, makeCliTickOnce, tickSurface, DRIVER_STATUS_FILENAME } from '../../skills-src/conveyor/runner.mjs';

export const EXIT = Object.freeze({ TICKED: 0, USAGE: 2, THROTTLED: 10, NOT_ORCHESTRATOR: 11, BUSY: 12, UNAVAILABLE: 13, FAILED: 14 });
const THROTTLE_REASONS = new Set(['throttled', 'in-flight', 'contended']);
const KNOWN_FLAGS = new Set(['apply', 'verbose', 'min-interval-ms', 'repo']);

export function parseArgs(argv) {
  const flags = {};
  for (const a of argv) {
    if (!a.startsWith('--')) throw new TypeError(`Unexpected argument: ${a}`);
    const eq = a.indexOf('=');
    const name = eq === -1 ? a.slice(2) : a.slice(2, eq);
    if (!KNOWN_FLAGS.has(name)) throw new TypeError(`Unknown flag: --${name}`);
    flags[name] = eq === -1 ? true : a.slice(eq + 1);
  }
  return flags;
}

const traceLines = (out) => (tickSurface(out).decisionTrace || []).map((t) => `  ${t.kind}: ${t.text}`);

/**
 * The whole command as a function over injected ports, so every outcome is testable with no real tick.
 * @returns {Promise<{ exitCode: number, status: string, reason?: string, lines: string[] }>}
 */
export async function runTickOnceCommand({
  apply = false, env = process.env, now = Date.now, root = resolveCoordinationRoot({ env }), minIntervalMs,
  driverId = DRIVER_ID, repo = null,
  throttle = createTickThrottle({ root, now, minIntervalMs: minIntervalMs ?? parseMinIntervalMs(env[MIN_INTERVAL_ENV]) }),
  // Plan builds ONLY the read-only tick-core reader; apply builds the full effect set.
  buildEffects = ({ plan }) => (plan ? { tickOnce: makeCliTickOnce(paths({ repo })) } : buildCliTickEffects(paths({ repo, quiet: true }))),
  createCoordination = () => createTickCoordination({ root, now }),
  run = runTickOnce,
} = {}) {
  const lines = [];
  const finish = (exitCode, status, extra = {}) => ({ exitCode, status, ...extra, lines });
  const mode = apply ? 'apply' : 'plan';

  const session = classifySession(env);
  if (session.role !== 'orchestrator') {
    lines.push(`tick-once: skipped (${session.role}: ${session.reason})`);
    return finish(EXIT.NOT_ORCHESTRATOR, 'skipped-not-orchestrator', { reason: session.reason, role: session.role });
  }

  try {
    if (!apply) return await planOnce();
    return await applyOnce();
  } catch (error) {
    if (error instanceof CoordinationUnavailableError || error?.code === 'COORDINATION_UNAVAILABLE') {
      lines.push(`tick-once: coordination unavailable (${error.message})`);
      return finish(EXIT.UNAVAILABLE, 'coordination-unavailable', { reason: error.message });
    }
    lines.push(`tick-once: failed (${error?.message ?? error})`);
    return finish(EXIT.FAILED, 'failed', { reason: String(error?.message ?? error) });
  }

  function refused(claim) {
    if (THROTTLE_REASONS.has(claim.reason)) {
      lines.push(`tick-once: throttled (${claim.reason}${claim.retryAfterMs ? `, retry in ${Math.ceil(claim.retryAfterMs / 1000)}s` : ''})`);
      return finish(EXIT.THROTTLED, 'throttled', { reason: claim.reason, retryAfterMs: claim.retryAfterMs });
    }
    lines.push(`tick-once: busy (${claim.reason})`);
    return finish(EXIT.BUSY, 'busy', { reason: claim.reason });
  }

  // Read-only: no throttle claim, no mutex, no dispatch, no passes, no bookkeeping save, no status file.
  async function planOnce() {
    const peek = throttle.peek();
    if (!peek.ok) return refused(peek);
    const effects = { tickOnce: buildEffects({ plan: true }).tickOnce, emit: () => {} };
    const { loadBookkeeping } = createTickBookkeeping({ root, now });
    const coordination = {
      acquire: async () => ({ ok: true, handle: { heartbeat: () => true, release: () => true } }),
      loadBookkeeping: async () => loadBookkeeping(),
      saveBookkeeping: () => null,
      reconcileActions: async () => [],
    };
    const result = await run({ effects, coordination, driverId, now });
    return settle(result, 'plan');
  }

  async function applyOnce() {
    const claim = throttle.claim({ owner: { driverId } });
    if (!claim.ok) return refused(claim);
    let result;
    try { result = await run({ effects: buildEffects({ plan: false }), coordination: createCoordination(), driverId, now }); }
    catch (error) { result = { ok: false, reason: error instanceof CoordinationUnavailableError ? 'coordination-unavailable' : 'tick-threw', error: error?.message }; }
    // A failed tick is an ATTEMPT only: `success:false` leaves `lastSuccess` alone, so it never throttles the next one.
    throttle.complete(claim, { success: result.ok === true, tickId: result.tickId, reason: result.ok ? null : result.reason, driverId });
    return settle(result, 'apply');
  }

  function settle(result, how) {
    if (result.ok) {
      lines.push(`tick-once: ${how === 'plan' ? 'would tick' : 'ticked'} (${mode}${result.tickId ? `, ${result.tickId}` : ''})`, ...traceLines(result.out));
      return finish(EXIT.TICKED, how === 'plan' ? 'planned' : 'ticked', { tickId: result.tickId });
    }
    if (result.reason === 'busy') {
      lines.push('tick-once: busy (tick mutex held)');
      return finish(EXIT.BUSY, 'busy', { reason: 'mutex-held', heldBy: result.heldBy });
    }
    if (['coordination-unavailable', 'bookkeeping-unavailable'].includes(result.reason)) {
      lines.push(`tick-once: coordination unavailable (${result.reason}${result.error ? `: ${result.error}` : ''})`);
      return finish(EXIT.UNAVAILABLE, 'coordination-unavailable', { reason: result.reason });
    }
    lines.push(`tick-once: failed (${result.reason}${result.error ? `: ${result.error}` : ''})`);
    return finish(EXIT.FAILED, 'failed', { reason: result.reason });
  }
}

// The real tick's paths: resolved by SCRIPT LOCATION, never cwd (the runner's own convention), so a hook
// launched from any directory still reads the checkout this script lives in.
function paths({ repo, quiet }) {
  const HERE = dirname(fileURLToPath(import.meta.url));
  const REPO_ROOT = join(HERE, '..', '..');
  return { scriptsDir: join(HERE, '..'), tickCorePath: join(HERE, 'tick-core.mjs'), repo, quiet,
    statusPath: join(REPO_ROOT, '.conveyor', DRIVER_STATUS_FILENAME), traceDir: join(REPO_ROOT, '.conveyor', 'decision-trace') };
}

/** Run `fn` with stdout/stderr captured (nothing reaches the terminal), returning what was written. */
export async function withCapturedOutput(fn) {
  const captured = [];
  const out = process.stdout.write, err = process.stderr.write;
  const grab = (stream) => (chunk) => { captured.push({ stream, text: String(chunk) }); return true; };
  process.stdout.write = grab('stdout'); process.stderr.write = grab('stderr');
  try { return { value: await fn(), captured }; }
  finally { process.stdout.write = out; process.stderr.write = err; }
}

async function main(argv) {
  let flags;
  try { flags = parseArgs(argv); }
  catch (error) { process.stderr.write(`tick-once: ${error.message}\nusage: tick-once [--apply] [--verbose] [--min-interval-ms=N] [--repo=<name>]\n`); return EXIT.USAGE; }
  let minIntervalMs;
  try { minIntervalMs = parseMinIntervalMs(flags['min-interval-ms'] ?? process.env[MIN_INTERVAL_ENV]); }
  catch (error) { process.stderr.write(`tick-once: ${error.message}\n`); return EXIT.USAGE; }

  const { value, captured } = await withCapturedOutput(() => runTickOnceCommand({
    apply: flags.apply === true, minIntervalMs, repo: typeof flags.repo === 'string' ? flags.repo : null,
  }));
  if (flags.verbose === true) {
    for (const c of captured) process[c.stream].write(c.text);
    process.stdout.write(`${value.lines.join('\n')}\n`);
  }
  return value.exitCode;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; }, () => { process.exitCode = EXIT.FAILED; });
}
