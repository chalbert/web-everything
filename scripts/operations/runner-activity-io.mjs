/**
 * Injected reader for runner-activity. The synchronous store readers run inside ONE bounded child read,
 * like pr-status's bounded gh read. The outer SIGKILL deadline covers EVERY filesystem read too (a JS
 * timer cannot interrupt readFileSync). No tick is executed and no liveness stamp is persisted.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createFileRunStore, runsDir } from './run-store.mjs';
import { createFileCallLogStore } from './call-log-store.mjs';
import { DISPATCH_EFFECT, LAUNCH_KINDS, dispatchStillHolds } from './dispatch-lane.mjs';
import { REPO_ROOT, defaultListAgents, inFlightDispatchesFor, stampLiveness } from './dispatch-lane-io.mjs';
import { lockDirFor, parseLockEntry } from '../readiness/file-locks.mjs';
import { looksLikeRunnerProcess, pidToCwd } from '../conveyor/resolve-runner-checkout.mjs';
import { RUNNER_LOCK_ROOT, RUNNER_LEASE_PATH, RUNNER_LEASE_MINUTES } from '../../skills-src/conveyor/runner-lock.mjs';
import { DRIVER_STATUS_FILENAME } from '../../skills-src/conveyor/runner.mjs';

export const READ_TIMEOUT_MS = 10_000;
const PROCESS_TIMEOUT_MS = 2_000;
const SELF = fileURLToPath(import.meta.url);

/** Missing is distinct from corrupt/unreadable. All real calls are covered by the outer read deadline. */
function optionalText(path) {
  try { return readFileSync(path, 'utf8'); } catch (e) { if (e.code === 'ENOENT') return null; throw e; }
}

/**
 * Snapshot assembly with injected stores/readers. In-flight rows come from the existing dispatch reader;
 * terminal effects supply outcomes, never the call log's `complete` (which can mean no dispatch occurred).
 * Older records lack a completion timestamp: report the last-attempt ordering proxy explicitly.
 */
export function collectRunnerActivity({ limit = 10 } = {}, {
  readText = optionalText,
  exec = execFileSync,
  env = process.env,
  now = () => new Date(),
  storeFor = (root) => createFileRunStore(env.OPERATION_RUNS_DIR || runsDir(root)),
  listAgents = () => defaultListAgents({ exec, env: { ...env, WE_DISPATCH_LIST_TIMEOUT_MS: String(PROCESS_TIMEOUT_MS) } }),
} = {}) {
  const observedAt = now().toISOString();
  const lockSource = join(lockDirFor(env.CONVEYOR_RUNNER_LOCK_ROOT || RUNNER_LOCK_ROOT, RUNNER_LEASE_PATH), 'lock.json');
  const lockText = readText(lockSource);
  const lease = lockText == null ? null : parseLockEntry(lockText);
  if (lockText != null && !lease) throw new Error('runner-activity: malformed runner lease');
  let root = REPO_ROOT;
  let alive = false;
  let command = '';
  const commandRead = (file, argv) => String(exec(file, argv, {
    encoding: 'utf8', timeout: PROCESS_TIMEOUT_MS, killSignal: 'SIGKILL',
    stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1024 * 1024,
  }) || '');
  if (lease?.pid > 0) {
    try { command = commandRead('ps', ['-o', 'command=', '-p', String(lease.pid)]); }
    catch (e) {
      // ps exits 1 when there is no such PID. Permission errors/timeouts must never masquerade as death.
      if (e.status !== 1 || String(e.stderr || '').trim()) throw e;
    }
    // Resolve candidate script tokens BEFORE identity checking: conveyor/runner.mjs is valid
    // when launched from skills-src. cwd alone is never the checkout root.
    const candidates = command.trim().split(/\s+/).filter((t) =>
      t === 'runner.mjs' || t.endsWith('/runner.mjs'));
    let cwd;
    for (const candidate of candidates) {
      if (!isAbsolute(candidate) && cwd === undefined) {
        cwd = pidToCwd(lease.pid,
          (pid) => commandRead('lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn']));
        if (!cwd || !isAbsolute(cwd)) throw new Error('runner-activity: live runner checkout could not be resolved');
      }
      const script = isAbsolute(candidate) ? resolve(candidate) : resolve(cwd, candidate);
      if (looksLikeRunnerProcess(script)) {
        alive = true;
        root = resolve(dirname(script), '../..');
        break;
      }
    }
  } else if (lease) throw new Error('runner-activity: runner lease has no usable PID');
  const tickSource = join(root, '.conveyor', DRIVER_STATUS_FILENAME);
  const tickText = readText(tickSource);
  const tick = tickText == null ? null : JSON.parse(tickText);
  if (tickText != null && (!tick || !Number.isInteger(tick.tick) || !Number.isFinite(Date.parse(tick.at)) || !Array.isArray(tick.stalled))) {
    throw new Error('runner-activity: malformed driver-status snapshot');
  }
  const store = storeFor(root);
  const ids = store.list(); // A failed listing is not an empty history.
  const records = new Map();
  let unreadableRunRecords = 0;
  for (const id of ids) {
    try { const record = store.read(id); if (record) records.set(id, record); }
    catch { unreadableRunRecords += 1; }
  }
  const cachedStore = { list: () => [...records.keys()], read: (id) => records.get(id) };
  const effects = [...records.values()].flatMap((run) => (run.effects || [])
    .filter((e) => e.type === DISPATCH_EFFECT).map((e) => ({ run, e })));
  const nums = new Set(effects.map(({ e }) => String(e.payload?.num ?? '')));
  const rows = [...nums].flatMap((num) => inFlightDispatchesFor(num, { store: cachedStore }).runs);
  const stamped = stampLiveness({ runs: rows, unreadable: unreadableRunRecords }, { listAgents });
  const metadata = (run, e) => ({
    num: e.payload?.num ?? null,
    launchKind: LAUNCH_KINDS.includes(e.payload?.launchKind) ? e.payload.launchKind
      : LAUNCH_KINDS.includes(run.findings?.read?.launchKind) ? run.findings.read.launchKind : 'unknown',
  });
  const inFlightDispatches = stamped.runs.map((row) => {
    const run = records.get(row.runId);
    const e = run.effects.find((entry) => entry.key === row.key);
    const started = Date.parse(row.startedAt);
    return { ...row, ...metadata(run, e),
      ageMs: Number.isFinite(started) ? Math.max(0, Date.parse(observedAt) - started) : null,
      holds: dispatchStillHolds(row, observedAt),
    };
  });
  const completed = effects.filter(({ e }) => ['applied', 'failed'].includes(e.status)).map(({ run, e }) => {
    const timing = (run.stepTimings || []).find((t) => t.step === e.step && t.finishedAt);
    const at = timing?.finishedAt || e.lastAttemptAt || e.startedAt || null;
    return { runId: run.id, key: e.key, ...metadata(run, e), outcome: e.status,
      result: e.result ?? null, error: e.error ?? null, at,
      timestampSource: timing ? 'run.stepTimings.finishedAt' : 'last-attempt-proxy',
    };
  }).sort((a, b) => (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0) || a.runId.localeCompare(b.runId));
  return {
    observedAt, checkout: root, staleAfterMs: RUNNER_LEASE_MINUTES * 60_000,
    runner: { present: !!lease, pid: lease?.pid ?? null, alive, heartbeatAt: lease?.heartbeatAt ?? null,
      source: lockSource, livenessSource: lease ? 'singleton lease + ps command identity' : 'singleton lease absent' },
    lastTick: { number: tick?.tick ?? null, at: tick?.at ?? null, source: tickSource,
      proxy: false, stalled: tick?.stalled ?? [], statusLine: tick?.statusLine ?? '',
      plannedDispatch: tick?.dispatch ?? null },
    inFlightDispatches, dispatchLiveness: stamped.livenessSource,
    completedDispatches: completed.slice(0, limit), completedAvailable: completed.length,
    historySource: env.OPERATION_RUNS_DIR || runsDir(root), unreadableRunRecords,
  };
}

/** Same injected exec seam as pr-status; a fixed outer bound also covers sync disk reads in the child. */
export function createRunnerActivityReader({ run = execFileSync, env = process.env } = {}) {
  return (input) => JSON.parse(String(run(process.execPath, [SELF, '--snapshot', JSON.stringify(input)], {
    encoding: 'utf8', timeout: READ_TIMEOUT_MS, killSignal: 'SIGKILL',
    stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024, env,
  })));
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href && process.argv[2] === '--snapshot') {
  try { process.stdout.write(JSON.stringify(collectRunnerActivity(JSON.parse(process.argv[3] || '{}')))); }
  catch (e) { process.stderr.write(`runner-activity: ${e.message}\n`); process.exitCode = 1; }
}

/** runner-activity-only CLI persistence. Every adapter read/write and telemetry append runs
 * in a killable child; the shared adapter and other operations retain their existing stores. */
export const CLI_IO_TIMEOUT_MS = 2_000;
export function createRunnerActivityCliStores({ run = execFileSync, env = process.env } = {}) {
  const invoke = (target, method, value) => JSON.parse(String(run(process.execPath, [SELF, '--cli-io'], {
    input: JSON.stringify({ target, method, value }),
    encoding: 'utf8', timeout: CLI_IO_TIMEOUT_MS, killSignal: 'SIGKILL',
    stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024, env,
  })));
  return {
    store: Object.fromEntries(['read', 'write', 'list', 'delete'].map((method) =>
      [method, (value) => invoke('store', method, value)])),
    callLog: { append: (value) => invoke('callLog', 'append', value) },
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href && process.argv[2] === '--cli-io') {
  try {
    const { target, method, value } = JSON.parse(readFileSync(0, 'utf8'));
    const handle = target === 'store' ? createFileRunStore() : createFileCallLogStore();
    process.stdout.write(JSON.stringify(handle[method](value) ?? null));
  } catch (e) { process.stderr.write(`runner-activity CLI IO: ${e.message}\n`); process.exitCode = 1; }
}
