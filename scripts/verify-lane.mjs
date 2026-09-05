#!/usr/bin/env node
/**
 * verify-lane.mjs — run a lane's required suites SYNCHRONOUSLY and record a green/red verification marker
 * keyed to the lane's HEAD commit (#2833, subagent-stall mitigation).
 *
 * WHY. A build subagent's delivery arc is: run the suites, then `pr-land` / `lane-pool release` to finish.
 * Twice one night a subagent BACKGROUNDED its long test run and then yielded/terminated before it finished —
 * leaving the lane mid-flight: producing nothing, never erroring, so nothing reclaimed it. The root cause was
 * that the verification was BACKGROUNDABLE and yielding mid-run LOOKED complete.
 *
 * This is the sanctioned "run your checks" step for the build flow, and it removes that footgun two ways:
 *   1. It runs the suites in the FOREGROUND (`stdio:'inherit'`), blocking until they exit — "background then
 *      yield" is no longer the path of least resistance, because the tool itself is a blocking call.
 *   2. It writes a lifecycle MARKER (`.git/.lane-verify`, keyed to HEAD): `running` at start, rewritten to
 *      `green`/`red` at finish. If the process is killed mid-run, the marker is stranded at `running` — so the
 *      delivery gate (`pr-land`'s finish-guard) can SEE the verification never completed and refuse to land.
 *
 * The pure decision half (marker shape + the gate decision `pr-land` calls) lives in `scripts/lib/lane-verify.mjs`.
 *
 * THE DEFAULT GATE IS DIFF-DRIVEN (#3372). Rather than an unconditional `npm run test:unit`, the default gate
 * decides off the lane's actual `git diff` against `origin/main` via `scripts/readiness/test-selection.mjs`
 * (#2681): a diff that is entirely shrinkable (docs/research/test files, no sensitive surface, no glob-edge) runs
 * only `npx vitest related <changed files>`; anything else — a sensitive surface, an unlisted surface, a
 * glob-discovered fixture root, or an unresolvable diff — falls back to the FULL `npm run test:unit`, unchanged.
 * See `scripts/lib/verify-lane-gate.mjs` for the decision core and why defaulting the shrink at THIS call site
 * does not conflict with #2681's own "not defaulted [on the CI merge gate]" DoD.
 *
 * Usage:
 *   node scripts/verify-lane.mjs                      # run the default gate (diff-driven selection + check:standards; #3372) foreground, record green/red for HEAD
 *   node scripts/verify-lane.mjs --gate="npm run test:unit"   # override the suite command (skips diff-driven selection entirely)
 *   node scripts/verify-lane.mjs --repo=~/workspace/.lanes/web-everything/lane-3   # verify a specific lane clone
 *   node scripts/verify-lane.mjs --json              # machine-readable {sha, status, exitCode} on stdout
 *   node scripts/verify-lane.mjs check               # READ-ONLY: print the current marker's gate verdict for HEAD, run nothing
 *   node scripts/verify-lane.mjs check --require-verified   # exit non-zero unless HEAD has a fresh GREEN marker (the gate pr-land applies)
 *   node scripts/verify-lane.mjs reset                # clear a stale marker so `verify` can start (x4jcqm4) — refuses if a FOREIGN lease is live (own live lease is OK, #3378)
 *   node scripts/verify-lane.mjs request              # #3105 — stamp the `running` marker and return immediately; does NOT run the gate.
 *     The sanctioned call for an interactive agent session: the actual suite run is picked up and executed by
 *     `scripts/conveyor/verify-dispatch.mjs` (a mechanical runner pass, unbound by the agent tool's foreground
 *     window) on its next tick, which runs the SAME `verify` mode below to completion. An agent that called
 *     `request` then polls `check` across its own turns — each `check` call is a fast marker read, never a
 *     suite run, so no single call can ever exceed the foreground window, no matter how long the gate itself
 *     takes. `request` reuses the exact START-write guard `verify` already applies (never clobbers a foreign
 *     terminal marker) — it is that guard's own first half, factored out, not a new decision.
 *
 * Exit codes: 0 = green (marker recorded green) / `check` verdict ok / `reset` cleared or was a no-op / `request`
 * accepted; 2 = red (suites failed — marker recorded red) / `check` verdict not-ok; 3 = usage / git error (no
 * marker written) / `reset` refused because a FOREIGN lease is live (own live lease no longer refuses, #3378) /
 * `request` refused (would clobber a foreign terminal marker — same guard `verify` applies).
 */
import { execSync } from 'node:child_process';
import { writeFileSync, renameSync, existsSync, readFileSync, readdirSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { VERIFY_FILENAME, verifyStartBody, verifyFinishBody, verifyGateDecision, readVerifyMarker, resolveVerifyOptions } from './lib/lane-verify.mjs';
import { LEASE_FILENAME, isLeaseStale, isConfirmedOwnLease } from './lib/lane-lease.mjs';
import { defaultPoolRoot } from './lib/lane-pool-paths.mjs';
import { writeAllSync } from './lib/write-all-sync.mjs';
import { resolveDefaultGate } from './lib/verify-lane-gate.mjs';
import { admissionLockRoot, resolveCap, resolveTimeoutMs, acquireSlotBlocking, releaseOwnedSlot } from './readiness/heavy-admission.mjs';

// ── tiny arg parsing (matches push-if-green.mjs / lane-pool.mjs) ─────────────────────────────────────
const flags = {};
const positionals = [];
for (const a of process.argv.slice(2)) {
  if (a.startsWith('--')) {
    const eq = a.indexOf('=');
    if (eq === -1) flags[a.slice(2)] = true;
    else flags[a.slice(2, eq)] = a.slice(eq + 1);
  } else positionals.push(a);
}

const expandHome = (p) => (p && p.startsWith('~') ? join(homedir(), p.slice(1)) : p);
const REPO = resolve(expandHome(flags.repo) || process.cwd());
const AS_JSON = !!flags.json;
// #2833 finding 5 — resolve the gate options through the SHARED resolver so `check` mode agrees with pr-land:
// `--require-verified` OR `WE_REQUIRE_VERIFIED=1`, and the `WE_LAND_UNVERIFIED=1` break-glass. Previously `check`
// read only `flags['require-verified']`, so the same env produced two different verdicts at the two call sites.
const { requireVerified: REQUIRE_VERIFIED, breakGlass: VERIFY_BREAK_GLASS } = resolveVerifyOptions({ flags, env: process.env });
const MODE = positionals[0] === 'check' ? 'check' : positionals[0] === 'reset' ? 'reset'
  : positionals[0] === 'request' ? 'request' : 'verify';

const git = (args) => execFileSync('git', args, { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const tryGit = (args) => { try { return git(args); } catch { return null; } };

// Resolve the marker inside the REAL git dir. `.git` is a DIRECTORY in a clone (the lane case) but a FILE in a
// worktree, and can be relocated via $GIT_DIR — so `git rev-parse --absolute-git-dir` is the only correct way to
// locate it (#2833 finding 4: a hardcoded `join(REPO, '.git', …)` throws ENOTDIR in a worktree). Falls back to
// the literal only if git can't answer, in which case the downstream git ops fail loudly anyway.
const GIT_DIR = tryGit(['rev-parse', '--absolute-git-dir']) || join(REPO, '.git');
const MARKER = join(GIT_DIR, VERIFY_FILENAME);

// #2833 finding 2 — the marker read is single-sourced in lane-verify.mjs (`readVerifyMarker`) so this writer and
// pr-land's finish-guard can never drift. It resolves `<gitDir>/.lane-verify`, folds a valid-JSON non-object to
// `{ corrupt: true }` (never `absent`, which would fail OPEN), and returns null only for a genuinely missing file.
const readMarker = () => readVerifyMarker(GIT_DIR);
function writeMarker(record) {
  // Atomic: write a temp sibling in the same git dir, then rename over the marker — so a concurrent reader
  // (pr-land's finish-guard) never observes a half-written file (#2833 finding 5). renameSync is atomic within a
  // filesystem, and the temp lives beside the marker so it always is.
  const tmp = `${MARKER}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(record, null, 2) + '\n');
  renameSync(tmp, MARKER);
}

function emit(result, exitCode) {
  if (AS_JSON) writeAllSync(1, JSON.stringify(result) + '\n');
  else process.stderr.write(`verify-lane [lane @ ${result.sha ? result.sha.slice(0, 8) : '?'}] ${result.status}: ${result.detail}\n`);
  process.exit(exitCode);
}

const headSha = tryGit(['rev-parse', 'HEAD']);
if (!headSha) emit({ sha: null, status: 'error', reason: 'no-head', detail: `could not resolve HEAD in ${REPO} — is this a git checkout?` }, 3);

// ── `check` — READ-ONLY: report the finish-guard verdict for HEAD, run nothing. This is exactly the gate
//    pr-land applies, exposed so a delivery step can pre-flight it (and so it is directly testable end-to-end).
if (MODE === 'check') {
  const v = verifyGateDecision({ record: readMarker(), headSha, breakGlass: VERIFY_BREAK_GLASS, requireVerified: REQUIRE_VERIFIED });
  emit({ sha: headSha, status: v.status, reason: v.reason, ok: v.ok, detail: v.detail }, v.ok ? 0 : 2);
}

// #3378 review (rounds 2-4) — `isConfirmedOwnLease` itself now refuses an `ownerSession` match that is either
// shadowed by a DECLARED occupant (`workerSession`, the dispatcher/worker split) or CONTESTED (a sibling lane
// sharing the same `ownerSession`, the workflowLane/conveyor-dispatch topology) — see its doc in
// `lib/lane-lease.mjs`. Telling "contested" apart from "uncontested" needs every OTHER lane's live lease, so
// `reset` scans the pool the same way `lane-pool.mjs#liveLeasesInPoolExcept` does for the structurally
// identical `release` decision: every pool under the workspace root, not just this lane's own pool (a
// session's siblings routinely hold lanes elsewhere). Best-effort — any unreadable dir just yields a shorter
// list, which can only make a lease read as UNCONTESTED (never a spurious refusal).
function tryReaddir(dir) {
  try { return readdirSync(dir); } catch { return []; }
}
function readLeaseFile(file) {
  if (!existsSync(file)) return null;
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return null; }
}
function siblingLeasesExcept(thisLeaseFile) {
  const poolRoot = defaultPoolRoot(REPO);
  const out = [];
  for (const poolName of tryReaddir(poolRoot)) {
    const poolDir = join(poolRoot, poolName);
    for (const laneName of tryReaddir(poolDir)) {
      if (!/^lane-\d+$/.test(laneName)) continue;
      const file = join(poolDir, laneName, '.git', LEASE_FILENAME);
      if (file === thisLeaseFile) continue;
      const sib = readLeaseFile(file);
      if (sib && !isLeaseStale(sib, Date.now())) out.push(sib);
    }
  }
  return out;
}

// ── `reset` (x4jcqm4) — clear a marker that is stale, not overlapping ─────────────────────────────────
// The START-write guard above (finding 4) is correct when a marker's terminal record belongs to a run that is
// STILL RELEVANT — but it cannot tell that apart from a marker that is simply old: a finished run, in a lane
// nothing currently holds. Two nights running that indistinguishability forced a manual `rm` of this file to
// unblock an unrelated change. `reset` is the sanctioned recovery: it clears the marker when this lane's own
// `.lane-lease` marker is absent, has outlived its TTL (`isLeaseStale`, `scripts/lib/lane-lease.mjs` — the
// same staleness test `lane-pool.mjs acquire` already uses to decide a lane is reclaimable), OR is CONFIRMED
// to be the caller's own live lease (`isConfirmedOwnLease`, #3378) — the same session that is about to run
// `verify` again has no one else's work to protect itself from, once a declared occupant (if any) is checked
// and the ownerSession match (if that's all there is) is confirmed uncontested. A live lease with no confirmed
// owner match (foreign, shadowed by a different declared occupant, contested by a sibling, or ambiguous
// because either side lacks an identity signal) still refuses: someone else may be relying on the current
// marker, matching the START-write guard's own protective posture rather than working around it.
if (MODE === 'reset') {
  if (!existsSync(MARKER)) emit({ sha: headSha, status: 'noop', reason: 'no-marker', detail: `no marker at ${MARKER} — nothing to reset.` }, 0);
  const record = readMarker();
  const leaseFile = join(GIT_DIR, LEASE_FILENAME);
  let lease = null;
  if (existsSync(leaseFile)) {
    try { lease = JSON.parse(readFileSync(leaseFile, 'utf8')); } catch { lease = null; }
  }
  const mySessionId = process.env.CLAUDE_CODE_SESSION_ID || null;
  const siblingLeases = lease ? siblingLeasesExcept(leaseFile) : [];
  if (lease && !isLeaseStale(lease, Date.now()) && !isConfirmedOwnLease({ lease, mySessionId, siblingLeases })) {
    emit(
      {
        sha: headSha, status: 'refused', reason: 'active-lease', exitCode: null,
        detail: `refusing to reset: ${leaseFile} holds a live lease (${lease.session || 'unknown'}, acquired ${lease.acquiredAt}) — this lane may be in active use; release it or let the lease expire first.`,
      },
      3,
    );
  }
  unlinkSync(MARKER);
  const desc = record && !record.corrupt ? `${record.status || 'stranded'} marker for ${String(record.sha || '?').slice(0, 8)}` : 'a corrupt marker';
  emit({ sha: headSha, status: 'reset', reason: 'cleared', detail: `cleared ${desc} — ${MARKER} removed.` }, 0);
}

// ── `verify` — run the suites SYNCHRONOUSLY and record the outcome ───────────────────────────────────
// #3372 — the DEFAULT gate is diff-driven (scripts/lib/verify-lane-gate.mjs): an explicit `--gate=` always wins
// (unchanged); otherwise resolve off the lane's actual diff against origin/main. Computed here (not above, with
// the other flags) so `check`/`reset` — which never reach this section — never pay for the git diff it needs.
const GATE = typeof flags.gate === 'string' ? flags.gate : resolveDefaultGate({ runGit: git, env: process.env }).command;

// 1. Stamp the `running` marker BEFORE the suites start, so a kill mid-run leaves a stranded (detectably
//    unfinished) marker rather than nothing.
//    #2833 finding 4: the same sha compare-and-set the FINISH write applies (below) must also guard the START
//    write. Two overlapping runs share one clone's marker; without this, `verify-lane` for a NEW sha would
//    overwrite an existing TERMINAL (`green`/`red`) record belonging to a DIFFERENT sha with a `running` marker
//    — destroying a sibling run's recorded result before any CAS could protect it. Refuse to clobber a terminal
//    record for a foreign sha (a `running`/absent/own-sha marker is fine to overwrite: re-verifying is legitimate).
const preStart = readMarker();
if (preStart && !preStart.corrupt && (preStart.status === 'green' || preStart.status === 'red') && preStart.sha && preStart.sha !== headSha) {
  emit(
    {
      sha: headSha, status: 'superseded', reason: 'superseded', exitCode: null,
      detail: `refusing to START verification for ${headSha.slice(0, 8)}: the on-disk marker holds a terminal ${preStart.status} record for ${String(preStart.sha).slice(0, 8)} (an overlapping verify-lane run) — overwriting it with a running marker would destroy that result; no marker written for this run.`,
    },
    3,
  );
}
writeMarker(verifyStartBody({ sha: headSha, suites: GATE, startedAt: new Date().toISOString() }));

// #3105 — `request` stops HERE: the marker is stamped, nothing has run yet, and this call already returns
// (`emit` calls `process.exit`). The actual suite run is picked up by `scripts/conveyor/verify-dispatch.mjs`
// (a mechanical runner pass) on its next tick, which re-invokes THIS file's default `verify` mode — the exact
// code below, unchanged — to completion. This is the only way an interactive agent session may ever bring this
// gate's `running` marker into being: no new marker status, no new gate-decision branch — a `request`-stamped
// marker is indistinguishable from (and handled identically to) an ordinary in-flight `running` one by every
// existing reader (`check`, `pr-land`'s finish-guard, a stranded/abandoned re-run). Checked BEFORE admission
// (below): a request never actually runs the gate itself, so it has no business queuing on the capacity
// semaphore — that cost belongs to whichever `verify-dispatch.mjs` tick actually executes it.
if (MODE === 'request') {
  emit({ sha: headSha, status: 'requested', reason: 'requested', exitCode: null, detail: `verification requested for ${headSha.slice(0, 8)} (suites: ${GATE}) — poll \`node scripts/verify-lane.mjs check\` for the result.` }, 0);
}

// 2. Admission: queue on the #3461 heavy-command capacity semaphore BEFORE running the gate — `check:standards`
//    and `test:unit` (this GATE) are named members of the closed heavy-command set, so this is the invocation-time
//    (never lane-acquire-time) chokepoint the semaphore gates. Fails OPEN on a queuing timeout (proceeds unslotted
//    with a stderr warning) — the residual-risk tradeoff `heavy-admission.mjs`'s own header names.
const ADMISSION_LOCK_ROOT = admissionLockRoot(REPO, process.env);
const ADMISSION_CAP = resolveCap(process.env);
const ADMISSION_TIMEOUT_MS = resolveTimeoutMs(process.env);
const laneMatch = /lane-(\d+)/.exec(REPO);
const admission = await acquireSlotBlocking({
  lockRoot: ADMISSION_LOCK_ROOT, cap: ADMISSION_CAP, owner: REPO, timeoutMs: ADMISSION_TIMEOUT_MS,
  lane: laneMatch ? laneMatch[1] : null,
});
if (admission.timedOut) {
  process.stderr.write(`⚠ heavy-command admission: timed out after ${admission.waitedMs}ms waiting for capacity (cap=${ADMISSION_CAP}) — proceeding unslotted.\n`);
} else if (admission.waitedMs > 0) {
  process.stderr.write(`heavy-command admission: acquired slot-${admission.slot} after waiting ${admission.waitedMs}ms (cap=${ADMISSION_CAP}).\n`);
}

// 3. Run the gate in the FOREGROUND, blocking until it exits (inherited stdio — the agent sees the output live).
let exitCode = 0;
try {
  execSync(GATE, { cwd: REPO, stdio: 'inherit' });
} catch (e) {
  exitCode = Number.isFinite(e && e.status) ? e.status : 2;
} finally {
  if (admission.ok) releaseOwnedSlot({ lockRoot: ADMISSION_LOCK_ROOT, cap: ADMISSION_CAP, owner: REPO });
}

// 4. Rewrite the marker to its terminal green/red form — for the sha THIS run actually verified.
//    #2833 finding 1: two overlapping verify-lane runs share one clone's marker. The finish write must
//    (a) stamp OUR sha (`headSha`, captured at start) — NOT re-read the on-disk marker's sha, or a slow run
//        finishing at X copies a newer run's sha Y onto its green and publishes a false green for Y; and
//    (b) refuse to overwrite a marker whose sha is not ours — an older/overlapping run must never clobber a
//        newer run's record (compare-and-set on the sha). A slow GREEN run at X must NOT stamp green over a
//        RED record for Y.
const onDisk = readMarker();
if (onDisk && !onDisk.corrupt && onDisk.sha && onDisk.sha !== headSha) {
  emit(
    {
      sha: headSha, status: 'superseded', reason: 'superseded', exitCode,
      detail: `suites finished (exit ${exitCode}) for ${headSha.slice(0, 8)}, but the on-disk marker now belongs to ${String(onDisk.sha).slice(0, 8)} (an overlapping verify-lane run) — refusing to overwrite it; no marker written for this run.`,
    },
    3,
  );
}
// Reuse the on-disk start body's audit fields only when it is OUR run's marker; otherwise synthesize a fresh one.
const startBody = onDisk && !onDisk.corrupt && onDisk.sha === headSha
  ? onDisk
  : verifyStartBody({ sha: headSha, suites: GATE, startedAt: null });
const finished = verifyFinishBody(startBody, {
  finishedAt: new Date().toISOString(),
  exitCode,
  sha: headSha,
});
writeMarker(finished);

emit(
  { sha: headSha, status: finished.status, reason: finished.status, exitCode, detail: finished.status === 'green' ? `suites passed — recorded green for ${headSha.slice(0, 8)} (delivery may proceed).` : `suites FAILED (exit ${exitCode}) — recorded red for ${headSha.slice(0, 8)}; the finish-guard will refuse to land until this is green.` },
  finished.status === 'green' ? 0 : 2,
);
