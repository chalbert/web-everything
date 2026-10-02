/** Bounded background enrichment for we:scripts/readiness/dispatch-plan.mjs.
 * The tick never awaits GitHub. One exclusive worker checks at most two ids, once each.
 * Attempts rotate even on failure; only successful verdicts enter the cooldown cache.
 */
import { execFileSync, spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, unlinkSync, openSync, closeSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readAlreadyDoneCacheState, writeAlreadyDoneCacheState, recordVerdicts } from './already-done-cache.mjs';

export const NETWORK_CHECKS_PER_TICK = 2;
const WORKER = fileURLToPath(import.meta.url);
const readJson = (path, fallback) => { try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return fallback; } };

/** Round-robin by last attempt, including failed checks: an unavailable id cannot starve the tail. */
export function selectRefreshIds(ids, attempts = {}) {
  return [...new Set(ids.map(String))].sort((a, b) => (attempts[a] || 0) - (attempts[b] || 0) || a.localeCompare(b))
    .slice(0, NETWORK_CHECKS_PER_TICK);
}

/** Three LOCAL git reads shared by the entire queue. No fetch, per-item log, or PR request.
 * @test-only-export-ok: dynamically imported by the dispatch-plan CLI shell.
 */
export function readLocalDoneFacts({ cwd = process.cwd(), git = execFileSync } = {}) {
  const run = (args) => String(git('git', args, { cwd, encoding: 'utf8', stdio: 'pipe', timeout: 3000, maxBuffer: 32 * 1024 * 1024 }));
  try {
    const shallow = run(['rev-parse', '--is-shallow-repository']).trim() !== 'false';
    const refs = run(['for-each-ref', '--format=%(refname)', 'refs/remotes/origin/']).trim().split('\n');
    const messages = run(['log', 'origin/main', '--first-parent', '-z', '--format=%P%x00%B']).split('\0');
    if (messages.at(-1) === '') messages.pop();
    if (messages.length % 2) return null;
    const mentioned = new Set();
    const aliases = {};
    let ambiguous = false;
    for (let i = 0; i < messages.length; i += 2) {
      const message = messages[i + 1];
      for (const token of message.match(/[a-z0-9]+/gi) || []) mentioned.add(token.toLowerCase());
      for (const m of message.matchAll(/\b(x[a-z0-9]+)→#(\d+)\b/g)) (aliases[m[2]] ||= []).push(m[1].toLowerCase());
      if (messages[i].trim().split(/\s+/).length > 1 && !/^Merge pull request #\d+ from /.test(message)) ambiguous = true;
    }
    return { mentioned, aliases, ambiguous, shallow, otherBases: refs.some(r => !/^refs\/remotes\/origin\/(main|HEAD|lane\/.*)$/.test(r)), messages };
  } catch { return null; }
}

/** A candidate or incomplete history is UNKNOWN, never cached as a negative.
 * Git does not contain the original PR body (including disclaimers); the worker verifies candidates.
 * @test-only-export-ok: dynamically imported by the dispatch-plan CLI shell.
 * Negative evidence is tied to this local snapshot and is recomputed next tick, not persisted with a TTL.
 */
export function localDoneVerdict(id, bornAs, facts) {
  if (!facts || facts.shallow || facts.otherBases) return null;
  if (facts.ambiguous) return null;
  const aliases = [String(id), bornAs, ...(facts.aliases[String(id)] || [])].filter(Boolean).map(a => String(a).toLowerCase());
  if (aliases.some(alias => facts.mentioned.has(alias))) return null;
  return { done: false, pr: null, checked: true };
}

/** Reserve before spawning. A live worker excludes overlapping ticks; dead workers are recoverable.
 * @test-only-export-ok: dynamically imported by the dispatch-plan CLI shell.
 * The worker is detached deliberately: its bounded lifetime and log belong to the enrichment job.
 */
const LOCK_MAX_AGE_MS = 60000;
export function startAlreadyDoneRefresh(ids, cachePath, { cwd = process.cwd(), env = process.env, readOnly = false } = {}) {
  if (!ids.length) return { started: false, ids: [] };
  const lock = `${cachePath}.refresh-lock`;
  try {
    mkdirSync(dirname(cachePath), { recursive: true });
    const prior = readJson(lock, null);
    let lockAge = Infinity;
    try { lockAge = Date.now() - statSync(lock).mtimeMs; } catch (e) { if (e.code !== 'ENOENT') throw e; }
    if (lockAge !== Infinity) {
      // The worker's guardian SIGKILLs it at 15s, so a lock older than this is dead no matter who now owns its
      // recorded pid (a recycled pid must not hold the lock — and enrichment — forever).
      if (lockAge < LOCK_MAX_AGE_MS && Number.isInteger(prior?.pid) && prior.pid > 0) {
        try { process.kill(prior.pid, 0); return { started: false, ids: [] }; }
        catch (e) { if (e.code !== 'ESRCH') return { started: false, ids: [] }; }
      }
      // Covers a killed reservation writer and the parent→worker pid handoff without stealing a live job.
      if (lockAge < 15000) return { started: false, ids: [] };
      unlinkSync(lock);
    }
    const fd = openSync(lock, 'wx');
    // The parent's pid covers the small reservation-to-worker handoff window.
    writeFileSync(fd, JSON.stringify({ pid: process.pid, at: Date.now() })); closeSync(fd);
    const selected = selectRefreshIds(ids, readJson(`${cachePath}.attempts`, {}));
    const payload = { ids: selected, cachePath, lock, cwd, readOnly };
    const log = openSync(`${cachePath}.refresh.log`, 'a');
    let child;
    try {
      child = spawn(process.execPath, [WORKER, JSON.stringify(payload)], { cwd, env: { ...env, WE_GH_THROTTLE_CALLER: 'dispatch-plan.mjs', WE_GH_THROTTLE_RETRY_MAX_ATTEMPTS: '1', WE_GH_THROTTLE_ACQUIRE_TIMEOUT_MS: '0', WE_GH_THROTTLE_NO_BUDGET_PROBE: '1', WE_GH_THROTTLE_PERSONAL_ROUTE: '0' }, detached: true, stdio: ['ignore', 'ignore', log] });
      child.on('error', () => { try { unlinkSync(lock); } catch { /* already released */ } });
      child.unref();
    } finally { closeSync(log); }
    return { started: true, ids: selected };
  } catch (e) {
    return { started: false, ids: [], error: String(e.message) };
  }
}

export async function refreshAlreadyDone({ ids, cachePath, check, now = Date.now, readOnly = false }) {
  const attempts = readJson(`${cachePath}.attempts`, {});
  for (const id of selectRefreshIds(ids, attempts)) {
    attempts[id] = now();
    writeFileSync(`${cachePath}.attempts`, JSON.stringify(attempts));
    const verdict = await check(id);
    if (verdict.checked && !readOnly) writeAlreadyDoneCacheState(recordVerdicts(readAlreadyDoneCacheState(cachePath), new Map([[id, verdict]]), now()), cachePath);
  }
}

async function main(payload) {
  const { ids, cachePath, lock, cwd, readOnly } = payload;
  writeFileSync(lock, JSON.stringify({ pid: process.pid, at: Date.now() }));
  // A separate guardian can terminate synchronous throttle/subprocess waits too. Never increase tick timeout.
  const guard = spawn(process.execPath, ['-e', `setTimeout(()=>{try{process.kill(-${process.pid},'SIGKILL')}catch{}},15000)`], { stdio: 'ignore' });
  try {
    const { runGhSync } = await import('../lib/gh-throttle.mjs');
    const { alreadyDoneRequest } = await import('../lib/gh-metered-reads.mjs');
    const { filterAlreadyDoneCandidates } = await import('../operations/dispatch-lane-io.mjs');
    const remote = String(execFileSync('git', ['remote', 'get-url', 'origin'], { cwd, encoding: 'utf8', timeout: 1000 })).trim();
    const slug = remote.match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/)?.[1];
    if (!slug) return;
    await refreshAlreadyDone({ ids, cachePath, readOnly, check: async id => {
      try {
        const req = alreadyDoneRequest(slug, id);
        const raw = runGhSync(req.args, { ...req.opts, timeout: 3000, killSignal: 'SIGKILL', maxBuffer: 4 * 1024 * 1024,
          throttle: { ...req.opts.throttle, caller: 'dispatch-plan.mjs', deferrable: true, maxAttempts: 1, acquireTimeoutMs: 0 } });
        const rows = JSON.parse(String(raw));
        if (!Array.isArray(rows)) return { checked: false };
        const matches = filterAlreadyDoneCandidates(rows, id);
        return { checked: true, done: matches.length > 0, pr: matches[0] ?? null };
      } catch (e) {
        process.stderr.write(`already-done #${id}: ${String(e.stderr || e.message)}\n`);
        return { checked: false };
      }
    } });
  } finally {
    guard.kill();
    try { unlinkSync(lock); } catch { /* already released */ }
    // A timed-out gh shim may have left descendants; reap our own detached group after diagnostics flush.
    setImmediate(() => { try { process.kill(-process.pid, 'SIGKILL'); } catch { /* group already gone */ } });
  }
}
if (process.argv[1] && resolve(process.argv[1]) === WORKER) main(JSON.parse(process.argv[2])).catch(e => { process.stderr.write(`${e.stack}\n`); process.exitCode = 1; });
