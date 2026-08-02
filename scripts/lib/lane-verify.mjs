/**
 * lane-verify.mjs — the pure verification-record core for #2833 (subagent-stall mitigation).
 *
 * THE STALL THIS EXISTS FOR. A build subagent's delivery arc is: run the required suites, then
 * `lane-pool release` / `pr-land` to finish. Twice one night a subagent BACKGROUNDED its long test run and
 * then yielded/terminated before the run finished — leaving the lane/PR mid-flight, producing nothing, never
 * erroring, so nothing reclaimed it. The root cause (prevention-introspection): the verification was
 * BACKGROUNDABLE, and yielding mid-run LOOKED complete. The fix must make an unfinished verification NOT look
 * complete.
 *
 * THE MECHANISM. A lane records its verification as a marker keyed to the exact commit it verified:
 *   - `scripts/verify-lane.mjs` runs the suites SYNCHRONOUSLY (foreground, blocks until exit). It writes a
 *     `running` marker at start and rewrites it to `green`/`red` at finish. If the process is killed mid-run
 *     (the stall), the marker is stranded at `running` — a DETECTABLY-unfinished verification.
 *   - the delivery gate (`pr-land.mjs`) reads the marker for the HEAD it is about to land and REFUSES when the
 *     verification is unfinished (`running` — the exact stall signature) or, under `--require-verified`, absent.
 *     A stranded/abandoned run can no longer masquerade as a delivered lane.
 *
 * This module is the DECISION half — no filesystem, no git, no clock (the caller passes `nowMs`) — so it is
 * unit-testable. `verify-lane.mjs` owns the IO half (git rev-parse, the synchronous suite run, the atomic
 * marker write) and `pr-land.mjs` calls `verifyGateDecision` at its finish-guard. Mirrors the split in
 * `scripts/lib/lane-lease.mjs`.
 */

/** The marker lives in the lane clone's `.git/` (like `.lane-lease`): never tracked, never `git clean`-ed,
 *  invisible to `git status`, one-per-lane. */
export const VERIFY_FILENAME = '.lane-verify';

/** How long a `running` marker may sit before it reads as ABANDONED rather than still-in-flight. This only
 *  refines the human message (`abandoned` vs `in-flight`) — a `running` marker is "verification unfinished"
 *  either way, so the gate refuses regardless of age. Long enough to outlast a genuinely slow suite. */
export const DEFAULT_VERIFY_TTL_MINUTES = 30;

/** Build the AT-START (`running`) marker. The caller stamps `startedAt` (ISO) and the resolved `sha` so this
 *  stays clock-free / git-free / testable. `suites` is the gate command string, recorded for the message. */
export function verifyStartBody({ sha, suites, startedAt }) {
  return {
    sha: sha || null,
    status: 'running',
    startedAt: startedAt || null,
    finishedAt: null,
    suites: suites || null,
    exitCode: null,
  };
}

/** Rewrite a `running` marker into its terminal (`green`/`red`) form once the synchronous run has exited.
 *  Pure: the caller supplies `finishedAt` (ISO), the process `exitCode` (0 ⇒ green), and — crucially — the
 *  `sha` this run ACTUALLY verified.
 *
 *  #2833 finding 1: the finish write must stamp the sha the run itself captured at START, NEVER inherit it from
 *  the on-disk marker (`prev.sha`). Two overlapping `verify-lane` runs share one clone's marker; if a slow run
 *  finishing at X copies whatever sha is on disk (a newer run's Y) onto its own green, it publishes a false
 *  green for a tree it never verified — the exact false-green this guard exists to kill. So `sha` is passed
 *  explicitly and wins. `prev` supplies only `startedAt`/`suites` (audit fields); `base.sha` is a fallback for
 *  legacy callers that pass their own start body as `prev`. */
export function verifyFinishBody(prev, { finishedAt, exitCode, sha } = {}) {
  const base = prev && typeof prev === 'object' ? prev : {};
  const green = Number(exitCode) === 0;
  return {
    sha: sha ?? base.sha ?? null,
    status: green ? 'green' : 'red',
    startedAt: base.startedAt ?? null,
    finishedAt: finishedAt || null,
    suites: base.suites ?? null,
    exitCode: Number.isFinite(Number(exitCode)) ? Number(exitCode) : null,
  };
}

/** Has a `running` marker outlived its TTL (⇒ ABANDONED — the writer is presumed gone)? A `green`/`red`
 *  marker never expires by time: its `sha` binds it to an exact tree, so SHA-identity — not the clock — is the
 *  real freshness test. A malformed / dateless `running` marker reads as abandoned (fail toward "not fresh").
 *  Pure — the caller passes `nowMs`. */
export function isVerifyAbandoned(record, nowMs, ttlMs = DEFAULT_VERIFY_TTL_MINUTES * 60_000) {
  if (!record || typeof record !== 'object') return true;
  if (record.status !== 'running') return false;
  const at = Date.parse(record.startedAt);
  if (Number.isNaN(at)) return true;
  return nowMs - at >= ttlMs;
}

/**
 * THE FINISH-GUARD DECISION (#2833). Given the lane's verification `record` and the `headSha` a delivery step
 * (pr-land) is about to land, decide whether that HEAD is verified enough to deliver. Pure — no fs/git/clock.
 *
 *   - `breakGlass` (env `WE_LAND_UNVERIFIED=1`) → ALWAYS ok, flagged. The deliberate documented override so a
 *     guard bug / a legitimately-CI-only land is never permanently wedged (house style: `WE_MERGE_BREAK_GLASS`).
 *   - a `green` record whose `sha` === `headSha` → ok (`verified`). The one clean pass.
 *   - a `running` record whose `sha` === `headSha` → NOT ok (`verify-unfinished`) — the EXACT observed stall: a
 *     verification was started for this commit and never finished. Refused REGARDLESS of `requireVerified`,
 *     because a half-run verification must never look complete. `isVerifyAbandoned` only colours the message.
 *   - a `red` record whose `sha` === `headSha`: refused (`verify-red`) ONLY under `requireVerified`; without it
 *     the marker is advisory and the record is allowed (`red-ci-gated`). This is the asymmetry between the two
 *     hazard classes — "never finished" (`running`) is always refused; "finished badly" (`red`) blocks only when
 *     the caller demanded a local green. It matches the "absent/red under `--require-verified`" contract in the
 *     PR body + #2833 resolution, and keeps the CI-gated drain / parallel-workflow paths (which gate the merge
 *     via the required GitHub `test` check — a red tree also fails it) untouched, as documented.
 *   - a `corrupt` record (the marker exists but did not parse) → NOT ok (`verify-corrupt`), regardless of
 *     `requireVerified`. A torn/garbled marker must never fold into `absent` and fail OPEN — exactly backwards
 *     for a stall guard (#2833 finding 5). Re-run `verify-lane` (or delete the marker) to recover.
 *   - no record, or a record for a DIFFERENT `sha` (stale — the tree moved on): if `requireVerified` → NOT ok
 *     (`unverified`); else ok (`untracked`). The default-allow keeps CI-gated callers (the drain, the parallel
 *     workflow — which verify via the required GitHub check, not this marker) working unchanged; the solo /
 *     conveyor build flow passes `--require-verified` to demand a local green before it lands.
 *
 * @returns {{ ok:boolean, status:string, reason:string, detail:string }}
 */
export function verifyGateDecision({ record, headSha, nowMs = Date.now(), ttlMs = DEFAULT_VERIFY_TTL_MINUTES * 60_000, breakGlass = false, requireVerified = false } = {}) {
  if (breakGlass) {
    return { ok: true, status: 'break-glass', reason: 'break-glass', detail: 'WE_LAND_UNVERIFIED=1 — verification gate overridden (deliberate break-glass; the PR still rides the required CI check).' };
  }
  const rec = record && typeof record === 'object' ? record : null;

  // A marker that exists but did not parse (the IO layer signals `{ corrupt: true }`) is refused unconditionally
  // — never treated as `absent`, which would fail open (#2833 finding 5).
  if (rec && rec.corrupt) {
    return { ok: false, status: 'corrupt', reason: 'verify-corrupt', detail: 'the lane verification marker exists but is unparseable (corrupt/torn) — refusing to land; re-run `node scripts/verify-lane.mjs` (or delete the marker) to record a clean result.' };
  }

  const matches = rec && rec.sha && headSha && rec.sha === headSha;

  if (matches && rec.status === 'green') {
    return { ok: true, status: 'green', reason: 'verified', detail: `lane verified green for ${String(headSha).slice(0, 8)} (suites: ${rec.suites || 'recorded'}).` };
  }
  if (matches && rec.status === 'running') {
    const abandoned = isVerifyAbandoned(rec, nowMs, ttlMs);
    return {
      ok: false, status: 'running', reason: 'verify-unfinished',
      detail: `verification for ${String(headSha).slice(0, 8)} is UNFINISHED (${abandoned ? 'abandoned — a backgrounded run that never completed' : 'still in-flight'}; started ${rec.startedAt || '?'}). A half-run verification must not look complete — re-run \`node scripts/verify-lane.mjs\` to completion (foreground, blocking) before landing.`,
    };
  }
  if (matches && rec.status === 'red') {
    if (requireVerified) {
      return { ok: false, status: 'red', reason: 'verify-red', detail: `verification for ${String(headSha).slice(0, 8)} recorded a RED result (exit ${rec.exitCode ?? '?'}) — fix the failure and re-run \`node scripts/verify-lane.mjs\`.` };
    }
    // Advisory mode: the required CI check (which a red tree also fails) gates the actual merge, so a local red
    // marker does not block here — matching "absent/red under --require-verified" (docs + #2833 resolution).
    return { ok: true, status: 'red', reason: 'red-ci-gated', detail: `verification for ${String(headSha).slice(0, 8)} recorded RED (exit ${rec.exitCode ?? '?'}), but --require-verified was not set — not blocking here; the PR's required CI check gates the merge.` };
  }

  // No marker, or a marker for a different commit (the tree moved since it was written).
  const why = rec ? `the recorded verification is for ${String(rec.sha).slice(0, 8)}, not the HEAD being landed (${String(headSha).slice(0, 8)})` : 'no verification marker for this lane';
  if (requireVerified) {
    return { ok: false, status: 'absent', reason: 'unverified', detail: `${why} — run \`node scripts/verify-lane.mjs\` (a foreground, blocking suite run) to record a green result before landing (or set WE_LAND_UNVERIFIED=1 to override).` };
  }
  return { ok: true, status: 'untracked', reason: 'untracked', detail: `${why} — verification not tracked via the lane marker here (the PR's required CI check still gates the merge).` };
}
