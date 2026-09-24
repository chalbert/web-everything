/** #3383 — The throttled "last tick" record: coalesces hook wakeups so many prompts start ONE tick.
 *
 * One JSON file under the coordination root (`tick-throttle.json`), shared by every checkout. It is claimed the
 * way the action store claims records, with no new lock scheme:
 *   • the FIRST claim creates the file exclusively (`open 'wx'`); a lost race re-reads and continues;
 *   • every later change is a read-check-write inside one short `tryLease` fence (`coordination-lock.mjs`),
 *     checked against the claim TOKEN and the record `rev`, written temp + rename. A wrong token or stale
 *     `rev` changes nothing (`owner-lost`), exactly as in `action-store.mjs`.
 *
 * SHAPE  { version: 1, rev,
 *          claim:       null | { token, claimedAt, driverId, pid, host },        // a tick claimed and not yet finished
 *          lastAttempt: null | { token, at, driverId, outcome, reason? },        // outcome: in-flight|success|failed|abandoned
 *          lastSuccess: null | { token, at, driverId, tickId } }
 *
 * ATTEMPTED AND SUCCESSFUL ARE SEPARATE. The throttle window is measured from `lastSuccess.at` only, so a tick
 * that failed (or never got the tick mutex) does not throttle the next wakeup. A claim still in flight
 * coalesces every other wakeup until it finishes or is reconciled away.
 *
 * A CRASHED CLAIMANT EXPIRES BY SUSPICION + RECONCILE, NOT A BARE TTL. A claim older than `claimStaleMs` is only
 * SUSPECT. {@link reconcileClaim} then looks at the claimant: same host and its pid is positively dead => the
 * claim is abandoned (recorded as `abandoned`, not success) and this wakeup may claim; the pid alive AND
 * holding the tick mutex => still running, held; anything else (other host, live pid not ticking) => held,
 * because nothing proves it dead. A backwards clock is never expiry, and never throttles.
 *
 * Any unreadable or malformed record is `CoordinationUnavailableError` (fail closed), never "no record".
 */
import * as nativeFs from 'node:fs';
import { join } from 'node:path';
import { hostname } from 'node:os';
import { randomUUID } from 'node:crypto';
import { coordinationPaths, resolveCoordinationRoot } from './coordination-root.mjs';
import { tryLease, pidAlive } from './coordination-lock.mjs';
import { CoordinationUnavailableError, milliseconds } from './action-record.mjs';

export const DEFAULT_MIN_INTERVAL_MS = 60_000;
export const DEFAULT_CLAIM_STALE_MS = 10 * 60_000;
export const MIN_INTERVAL_ENV = 'WE_TICK_MIN_INTERVAL_MS';

/** Parse a min-interval override; `undefined` when absent, throws TypeError on a bad value (never a silent default). */
export function parseMinIntervalMs(raw) {
  if (raw === undefined || raw === null || raw === '') return DEFAULT_MIN_INTERVAL_MS;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) throw new TypeError(`Invalid tick min interval: ${JSON.stringify(raw)}`);
  return n;
}

const EMPTY = Object.freeze({ version: 1, rev: 0, claim: null, lastAttempt: null, lastSuccess: null });

function assertRecord(r) {
  const ok = r && typeof r === 'object' && r.version === 1 && Number.isInteger(r.rev) && r.rev >= 0
    && (r.claim === null || (r.claim && typeof r.claim.token === 'string' && Number.isFinite(r.claim.claimedAt) && Number.isInteger(r.claim.pid) && typeof r.claim.host === 'string'))
    && (r.lastAttempt === null || (r.lastAttempt && typeof r.lastAttempt.token === 'string' && Number.isFinite(r.lastAttempt.at)))
    && (r.lastSuccess === null || (r.lastSuccess && typeof r.lastSuccess.token === 'string' && Number.isFinite(r.lastSuccess.at)));
  if (!ok) throw new Error('Invalid tick-throttle record');
  return r;
}

/** Default reconcile of a SUSPECT claim. Returns 'dead' | 'alive' | 'unknown'; only 'dead' frees the claim. */
export function defaultReconcileClaim(claim, { root, fs = nativeFs, isPidAlive = pidAlive } = {}) {
  if (claim.host !== hostname()) return 'unknown';
  if (isPidAlive(claim.pid) === false) return 'dead';
  let owner = null;
  try { owner = JSON.parse(fs.readFileSync(join(coordinationPaths(root).tickMutex, 'owner.json'), 'utf8')); }
  catch (e) { if (e.code !== 'ENOENT') return 'unknown'; }
  return owner?.driverId && owner.driverId === claim.driverId ? 'alive' : 'unknown';
}

export function createTickThrottle({ root = resolveCoordinationRoot(), fs = nativeFs, now = Date.now, minIntervalMs = DEFAULT_MIN_INTERVAL_MS,
  claimStaleMs = DEFAULT_CLAIM_STALE_MS, isPidAlive, wait, newToken = randomUUID, reconcileClaim = (claim) => defaultReconcileClaim(claim, { root, fs, isPidAlive }) } = {}) {
  const path = coordinationPaths(root).tickThrottle;
  const io = (fn) => { try { return fn(); } catch (e) { throw e instanceof CoordinationUnavailableError ? e : new CoordinationUnavailableError(path, e); } };
  const read = () => io(() => {
    let text;
    try { text = fs.readFileSync(path, 'utf8'); } catch (e) { if (e.code === 'ENOENT') return EMPTY; throw e; }
    return assertRecord(JSON.parse(text));
  });
  const write = (record) => io(() => {
    const tmp = `${path}.${randomUUID()}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(record)); fs.renameSync(tmp, path); return record;
  });
  // First-ever claim: create-exclusive. Returns false if somebody else created it first.
  const createExclusive = (record) => io(() => {
    fs.mkdirSync(coordinationPaths(root).root, { recursive: true });
    let fd;
    try { fd = fs.openSync(path, 'wx'); } catch (e) { if (e.code === 'EEXIST') return false; throw e; }
    try { fs.writeFileSync(fd, JSON.stringify(record)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    return true;
  });
  const fenced = (fn) => {
    const lock = io(() => tryLease({ path: `${path}.lock`, owner: { pid: process.pid, host: hostname() }, now, staleMs: 10_000, isPidAlive, fs, wait }));
    if (!lock.ok) return { ok: false, reason: 'contended' };
    try { return lock.handle.runIfOwned(fn); } finally { lock.handle.release(); }
  };

  /** Pure over (record, now): what would a wakeup do? Does not reconcile. */
  const decide = (record) => {
    const at = milliseconds(now());
    if (record.claim) {
      const age = at - record.claim.claimedAt;
      if (!(age >= 0 && age > claimStaleMs)) return { action: 'coalesce', reason: 'in-flight', claim: record.claim };
      return { action: 'reconcile', reason: 'claim-suspect', claim: record.claim };
    }
    const sinceSuccess = record.lastSuccess ? at - record.lastSuccess.at : Infinity;
    if (sinceSuccess >= 0 && sinceSuccess < minIntervalMs) return { action: 'coalesce', reason: 'throttled', retryAfterMs: minIntervalMs - sinceSuccess };
    return { action: 'claim', reason: 'due' };
  };

  /** Read-only: what a claim would do right now (used by plan mode). */
  const peek = () => {
    const record = read(), d = decide(record);
    if (d.action !== 'reconcile') return { ...d, ok: d.action === 'claim', record };
    const verdict = reconcileClaim(d.claim);
    return verdict === 'dead' ? { action: 'claim', reason: 'claim-abandoned', ok: true, record }
      : { action: 'held', reason: `claim-${verdict}`, ok: false, record };
  };

  const stamp = (record, patch) => ({ ...record, ...patch, version: 1, rev: record.rev + 1 });

  /** Atomically claim a tick. `{ ok:true, token }` or `{ ok:false, reason }` with reason in
   *  in-flight | throttled | claim-alive | claim-unknown | contended (a concurrent claimant holds the fence). */
  const claim = ({ owner = {} } = {}) => fenced(() => {
    const record = read(), d = decide(record);
    let base = record;
    if (d.action === 'coalesce') return { ok: false, reason: d.reason, retryAfterMs: d.retryAfterMs, record };
    if (d.action === 'reconcile') {
      const verdict = reconcileClaim(d.claim);
      if (verdict !== 'dead') return { ok: false, reason: `claim-${verdict}`, record };
      base = write(stamp(record, { claim: null,
        lastAttempt: { ...(record.lastAttempt ?? { token: d.claim.token, at: d.claim.claimedAt }), outcome: 'abandoned', reason: 'claimant-dead', at: milliseconds(now()) } }));
    }
    const at = milliseconds(now()), token = newToken();
    const next = stamp(base, { claim: { token, claimedAt: at, driverId: owner.driverId ?? null, pid: process.pid, host: hostname() },
      lastAttempt: { token, at, driverId: owner.driverId ?? null, outcome: 'in-flight' } });
    if (base.rev === 0) {
      // No file yet: create-exclusive is the claim itself.
      if (!createExclusive(next)) return { ok: false, reason: 'contended' };
    } else write(next);
    return { ok: true, token, rev: next.rev, record: next };
  });

  /** Finish a claim. Token + rev checked: a claim reconciled away by someone else changes nothing. */
  const complete = ({ token, rev }, { success, tickId = null, reason = null, driverId = null }) => fenced(() => {
    const record = read();
    if (!record.claim || record.claim.token !== token || (rev !== undefined && record.rev !== rev)) return { ok: false, reason: 'owner-lost', record };
    const at = milliseconds(now());
    const attemptRow = { token, at, driverId: driverId ?? record.claim.driverId, outcome: success ? 'success' : 'failed', ...(reason ? { reason } : {}) };
    const next = stamp(record, { claim: null, lastAttempt: attemptRow,
      lastSuccess: success ? { token, at, driverId: attemptRow.driverId, tickId } : record.lastSuccess });
    write(next);
    return { ok: true, record: next };
  });

  return { path, read, peek, claim, complete, minIntervalMs };
}
