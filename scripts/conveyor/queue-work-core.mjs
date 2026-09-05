/**
 * @file scripts/conveyor/queue-work-core.mjs
 * @description The PURE decision core behind {@link ./queue-work.mjs} (WE #3478). `queue.mjs` (#2613)
 *   resolves its `.conveyor/queue.json` sidecar purely from the caller's own cwd/script-location and reports
 *   success unconditionally — so a caller sitting in the wrong checkout gets a clean "✓ cleared" against a
 *   sidecar the LIVE conveyor runner (`we:skills-src/conveyor/runner.mjs`) never reads. This module decides,
 *   from the runner-singleton lock state, which checkout (if any) is safe to queue into — with no fs beyond
 *   what the caller injects, so the decision is unit-tested without a real lock dir or a real process.
 *
 * NO fs / clock / process here — every lock entry, the current time, and the pid→cwd lookup are all injected.
 * The impure scan (reading each `lock.json` under `~/.claude/conveyor-runner-locks/`) and the `lsof` probe live in
 * {@link ./queue-work.mjs}, deliberately thin and untested-by-design (mirrors `we:scripts/pr-status.mjs`'s
 * `sh()` convention — a probe that can't answer costs the caller a refusal, never a wrong guess).
 */

import { isLeaseExpired, DEFAULT_LEASE_MINUTES } from '../readiness/file-locks.mjs';

/**
 * Classify every lock dir found under the runner-lock root:
 *   - `no-lock`   — nothing there at all (no runner has ever raced for the lease, or it was cleanly reset).
 *   - `stale`     — one or more entries exist but EVERY one has an expired heartbeat (the runner crashed
 *                   without releasing its lease).
 *   - `ambiguous` — MORE THAN ONE entry is currently live. Should never happen for the fixed-sentinel
 *                   singleton lease this ships against today, but surfaced rather than silently picking one
 *                   if the lock shape ever grows multiple keys.
 *   - `live`      — exactly one live entry — the normal case.
 * Pure — `nowMs`/`leaseMinutes` are injected.
 * @param {Array<{dir:string, entry:({owner:string,pid:(number|null),heartbeatAt:string}|null)}>} entries
 * @param {number} nowMs
 * @param {number} [leaseMinutes]
 */
export function classifyRunnerLocks(entries, nowMs, leaseMinutes = DEFAULT_LEASE_MINUTES) {
  const valid = (entries || []).filter((e) => e && e.entry);
  const live = valid.filter((e) => !isLeaseExpired(e.entry, nowMs, leaseMinutes));
  if (live.length === 0) return valid.length === 0 ? { status: 'no-lock' } : { status: 'stale', stale: valid };
  if (live.length > 1) return { status: 'ambiguous', live };
  return { status: 'live', live: live[0] };
}

/**
 * Given a lock classification + injected pid probes, decide the target checkout to queue into — or WHY it
 * must refuse instead. Pure; `cwdForPid`/`isRunnerProcess` are the only "IO" here and are plain injected
 * functions.
 *
 * `isRunnerProcess` guards against a real, if narrow, gap a lock's `owner`/`pid`/`heartbeatAt` alone cannot
 * close: within the lease window, an OS can reuse a crashed runner's pid for an unrelated process before the
 * heartbeat goes stale (#3478 review, correctness+security findings). A lock heartbeat proves someone HELD the
 * lease recently; it does not prove pid `N` right now is still that same process. So once a `cwd` resolves,
 * this cross-checks the pid's actual command line still looks like the runner invocation before trusting it —
 * refusing rather than writing into whatever unrelated process happens to hold that pid now.
 *
 * `looksLikeCheckout` closes a second gap the same review round raised: everything above proves the pid IS
 * (as far as its command line can show) the runner, and reports its cwd — but never confirms that cwd is
 * actually a git checkout rather than some other directory the process happened to be launched from. This
 * checks for a real, cheap marker (a `.git` entry) at the resolved path before trusting it as a queue target.
 * @param {ReturnType<typeof classifyRunnerLocks>} classification
 * @param {(pid:number)=>(string|null)} cwdForPid
 * @param {(pid:number)=>boolean} isRunnerProcess
 * @param {(cwd:string)=>boolean} looksLikeCheckout
 * @returns {{ok:true, checkoutRoot:string, owner:string, pid:number} | {ok:false, reason:string, detail:object}}
 */
export function resolveQueueTarget(classification, cwdForPid, isRunnerProcess, looksLikeCheckout) {
  if (classification.status !== 'live') return { ok: false, reason: classification.status, detail: classification };
  const { entry } = classification.live;
  if (!Number.isInteger(entry.pid)) return { ok: false, reason: 'lock-missing-pid', detail: { owner: entry.owner } };
  if (!isRunnerProcess(entry.pid)) return { ok: false, reason: 'pid-identity-mismatch', detail: { pid: entry.pid, owner: entry.owner } };
  const cwd = cwdForPid(entry.pid);
  if (!cwd) return { ok: false, reason: 'cwd-unresolvable', detail: { pid: entry.pid, owner: entry.owner } };
  if (!looksLikeCheckout(cwd)) return { ok: false, reason: 'checkout-unverifiable', detail: { pid: entry.pid, owner: entry.owner, cwd } };
  return { ok: true, checkoutRoot: cwd, owner: entry.owner, pid: entry.pid };
}

/** Human-readable explanation for a `resolveQueueTarget` refusal — one line, names the reason plainly rather
 *  than ever reporting a bare unconditional success. Pure. */
export function describeRefusal(target) {
  switch (target.reason) {
    case 'no-lock':
      return 'no live conveyor runner lock found — refusing to guess which checkout to queue into; start the runner, or use queue.mjs directly if you already know the target checkout';
    case 'stale':
      return `found ${target.detail?.stale?.length ?? 'a'} stale runner lock(s) (heartbeat expired — the runner likely crashed without releasing it); refusing rather than queuing into a checkout nothing is reading`;
    case 'ambiguous':
      return `found ${target.detail?.live?.length ?? 'multiple'} LIVE runner locks at once — ambiguous, which should never happen for the singleton lease; refusing rather than guessing`;
    case 'lock-missing-pid':
      return 'the live runner lock has no pid recorded — cannot resolve its checkout';
    case 'pid-identity-mismatch':
      return `pid ${target.detail?.pid} no longer looks like the conveyor runner (its command line doesn't match) — the lease heartbeat is fresh but the pid may have been reused by an unrelated process; refusing rather than trusting a stale identity`;
    case 'cwd-unresolvable':
      return `could not resolve pid ${target.detail?.pid}'s working directory via \`lsof\` — is it installed, and does this process have permission to inspect that pid?`;
    case 'checkout-unverifiable':
      return `pid ${target.detail?.pid}'s resolved working directory (${target.detail?.cwd}) has no \`.git\` — it doesn't look like a real checkout; refusing rather than writing a queue sidecar into an arbitrary directory`;
    default:
      return target.reason;
  }
}
