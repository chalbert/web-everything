/**
 * @file breaks/build-dispatch-orphan-adopt.mjs — #4131/#4382 build-orphan-adopt.
 *
 * LIVE incident, 2026-09-29: a build's detached delivery wrapper (`deliver-item-run.mjs`) died with NONE of
 * `build-dispatch-daemon.mjs#doneWhy`'s three claim-retirement signals ever becoming true — no PR opened, the
 * item still sitting in the cleared queue, no settled run-store row (only the wrapper's own exit path ever
 * settles one, and it never ran). The claim sat "in flight" forever, occupying a builder slot, while the
 * agent's own finished work — a real commit, already pushed into the lane — was silently abandoned. #4131's
 * own claim (owner `Mac:74142`, the daemon's 06:41 ET boot pid, confirmed dead by the time the claim was
 * read) is exactly this shape: the agent's transcript says it finished and reported done, the branch/lane
 * held the commit, and no PR ever opened. #4382 is the sibling shape with nothing resumable at all (the
 * owning daemon was killed by the operator for a cap change, run f4166fa3883080a9's own dispatch never
 * settled).
 *
 * Fix: `scripts/conveyor/build-dispatch-orphan-adopt.mjs#adoptOrphanedBuildClaims`, wired into
 * `skills-src/conveyor/build-dispatch-daemon.mjs`'s own live tick (`effects.adoptOrphans`, called before the
 * tick's own claim-retirement read).
 *
 * Scenario, BOTH shapes in one run: a REAL claim (`build-dispatch-claim.mjs`, real lock files on a temp root)
 * plus a REAL run-store row (`run-store.mjs`, a real JSON file) whose `pid:` handle names a process that has
 * GENUINELY exited — spawned and waited out for real, never guessed — pointing at a REAL git lane.
 *   - #4131 shape: the lane has one real commit ahead of `main` and a REAL `done` delivery report
 *     (`delivery-report-store.mjs`) for the matching session slug sits on disk.
 *   - #4382 shape: same dead handle, but NO report and NO lane commit at all — nothing resumable.
 * `adoptOrphanedBuildClaims()` runs for real over both; only the actual detached resume SPAWN is faked (this
 * soak sandbox cannot run a real agent) and the lane-pool path lookup is short-circuited straight to the temp
 * lane (no real `lane-pool.mjs` state on this host to shell out to) — every other read/write in the pass is
 * the genuine on-disk primitive.
 */
import {
  mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync,
} from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..', '..');

/** A real, dead pid — spawned and WAITED OUT (never guessed at, never a hardcoded huge number). */
function realDeadPid() {
  const r = spawnSync(process.execPath, ['-e', 'process.exit(0)']);
  if (!Number.isInteger(r.pid) || r.pid <= 0) throw new Error('soak fixture: could not mint a real dead pid');
  return r.pid;
}

/** A minimal, real git lane in the SHAPE a real pool lane has (PR #2921 review — the old fixture committed on a
 *  side branch, which hid that a real lane's working branch IS its local `main`): `origin/main` at one base
 *  commit, the local `main` checked out on it, and — when `ahead` — ONE build commit on that same local `main`
 *  carrying the agent's work plus the wrapper's own claim edit to the item's backlog card. */
function makeLane({ ahead, num = '4131' }) {
  const lane = mkdtempSync(join(tmpdir(), 'soak-orphan-lane-'));
  const git = (args) => execFileSync('git', args, { cwd: lane, encoding: 'utf8' });
  git(['init', '-q', '-b', 'main']);
  git(['config', 'user.email', 'soak@test']);
  git(['config', 'user.name', 'soak']);
  mkdirSync(join(lane, 'backlog'));
  writeFileSync(join(lane, 'README.md'), 'base\n');
  writeFileSync(join(lane, 'backlog', `${num}-orphan-thing.md`), 'status: open\n');
  git(['add', '.']);
  git(['commit', '-q', '-m', 'base']);
  git(['update-ref', 'refs/remotes/origin/main', 'HEAD']);
  if (ahead) {
    writeFileSync(join(lane, 'agent-work.txt'), 'the agent\'s own finished work\n');
    writeFileSync(join(lane, 'backlog', `${num}-orphan-thing.md`), 'status: active\n');
    git(['add', '.']);
    git(['commit', '-q', '-m', `WE #${num}: delivery build`]);
  }
  return lane;
}

export default {
  id: 'build-dispatch-orphan-adopt',
  title: 'a build-dispatch claim whose detached wrapper died was never retired or resumed — permanently stuck '
    + 'occupying a builder slot, with the agent\'s finished work abandoned',
  card: 'build-orphan-adopt (#4131/#4382, blocker bug 2026-09-29)',
  fixedBy: {
    sha: 'HEAD', where: 'lane/build-orphan-adopt',
    paths: ['scripts/conveyor/build-dispatch-orphan-adopt.mjs', 'skills-src/conveyor/build-dispatch-daemon.mjs'],
  },
  fixPresent(root) {
    const modulePath = join(root, 'scripts/conveyor/build-dispatch-orphan-adopt.mjs');
    const daemonPath = join(root, 'skills-src/conveyor/build-dispatch-daemon.mjs');
    return existsSync(modulePath) && existsSync(daemonPath) && /adoptOrphans/.test(readFileSync(daemonPath, 'utf8'));
  },
  async run({ log } = {}) {
    const violations = [];
    const {
      adoptOrphanedBuildClaims, checkResumable, findLatestInFlightBuildRow,
    } = await import(resolve(REPO_ROOT, 'scripts/conveyor/build-dispatch-orphan-adopt.mjs'));
    const {
      acquireBuildDispatchClaim, releaseBuildDispatchClaim, listBuildDispatchClaims,
      markBuildDispatchResume, readBuildDispatchResume, releaseBuildDispatchResume,
    } = await import(resolve(REPO_ROOT, 'scripts/conveyor/build-dispatch-claim.mjs'));
    const { createFileRunStore, newRunRecord, newRunId } = await import(resolve(REPO_ROOT, 'scripts/operations/run-store.mjs'));
    const { resolveInFlight } = await import(resolve(REPO_ROOT, 'scripts/operations/effect-executor.mjs'));
    const { DISPATCH_EFFECT } = await import(resolve(REPO_ROOT, 'scripts/operations/dispatch-lane.mjs'));
    const {
      writeDeliveryReport, newDeliveryReport, applyDeliveryUpdate, resolveDeliveryReportsDir,
    } = await import(resolve(REPO_ROOT, 'scripts/operations/delivery-report-store.mjs'));

    const claimRoot = mkdtempSync(join(tmpdir(), 'soak-orphan-claims-'));
    const resumeRoot = mkdtempSync(join(tmpdir(), 'soak-orphan-resumes-'));
    const runsDir = mkdtempSync(join(tmpdir(), 'soak-orphan-runs-'));
    const store = createFileRunStore(runsDir);

    /** Write a real in-flight `build` dispatch effect for `num`, handle `pid:<deadPid>`. */
    function writeInFlightRow(num, { lane, sessionSlug, deadPid }) {
      const runId = newRunId('dispatch-lane');
      const record = newRunRecord({ id: runId, op: 'dispatch-lane', input: {} });
      record.effects.push({
        key: 'step:1:0', type: DISPATCH_EFFECT, stepIndex: 1, index: 0, status: 'in-flight',
        handle: `pid:${deadPid}`, startedAt: new Date(Date.now() - 60 * 60_000).toISOString(),
        payload: { num, launchKind: 'build', lane, sessionSlug, scope: [] },
      });
      store.write(record);
      return runId;
    }

    function settleRow({ runId, key }) {
      const run = store.read(runId);
      const entry = (run.effects || []).find((e) => e.key === key);
      if (!entry || entry.status !== 'in-flight') return;
      store.write(resolveInFlight(run, key, { status: 'failed', result: { outcome: 'orphan-released' } }));
    }

    const deadPid = realDeadPid();

    // ── #4131 shape: report says done, lane still has the commit → RESUME ──────────────────────────────────
    const resumableLane = makeLane({ ahead: true });
    writeDeliveryReport(
      applyDeliveryUpdate(newDeliveryReport({ session: 'conveyor-4131', item: '4131' }), {
        status: 'done', outcome: 'done', filesTouched: ['agent-work.txt'],
      }),
      resolveDeliveryReportsDir(resumableLane),
    );
    acquireBuildDispatchClaim({ num: '4131', scope: [], lockRoot: claimRoot });
    const rowA = writeInFlightRow('4131', { lane: 9, sessionSlug: 'conveyor-4131', deadPid });
    let spawnedResumeWith = null;

    // ── #4382 shape: nothing resumable at all → RELEASE, no hold ────────────────────────────────────────────
    const emptyLane = makeLane({ ahead: false });
    acquireBuildDispatchClaim({ num: '4382', scope: [], lockRoot: claimRoot });
    const rowB = writeInFlightRow('4382', { lane: 11, sessionSlug: 'conveyor-4382', deadPid });

    // ── PR #2921 review shape: a LIVE re-dispatch whose item still has a STALE resume marker (bound to an older
    // attempt, dead pid) → must be LEFT; the stale marker must never make the live build look dead ──────────
    acquireBuildDispatchClaim({ num: '4400', scope: [], lockRoot: claimRoot });
    const rowC = writeInFlightRow('4400', { lane: 11, sessionSlug: 'conveyor-4400', deadPid: process.pid }); // this soak process: alive
    markBuildDispatchResume({ num: '4400', pid: deadPid, runId: 'dispatch-lane-OLDER-ATTEMPT', rowKey: 'step:1:0', lockRoot: resumeRoot });

    const laneByLaneNum = { 9: resumableLane, 11: emptyLane };
    const rowByNum = { 4131: rowA, 4382: rowB, 4400: rowC };

    let results;
    try {
      results = await adoptOrphanedBuildClaims({
        listClaims: () => listBuildDispatchClaims({ lockRoot: claimRoot }),
        findRow: (num) => findLatestInFlightBuildRow([{ id: rowByNum[num], record: store.read(rowByNum[num]) }], num),
        readResumeMarker: (num) => readBuildDispatchResume({ num, lockRoot: resumeRoot }),
        // REAL checkResumable — real `tryReadDeliveryReport`/`laneHasCommitAhead` (real git), only the
        // lane-pool path lookup is short-circuited (no real lane-pool state on this host).
        resolveResumability: (o) => checkResumable({ ...o, resolveLane: () => laneByLaneNum[Number(o.lane)] }),
        releaseClaim: ({ num }) => releaseBuildDispatchClaim({ num, lockRoot: claimRoot }),
        releaseResumeMarker: ({ num }) => releaseBuildDispatchResume({ num, lockRoot: resumeRoot }),
        settleRow,
        spawnResume: (o) => { spawnedResumeWith = o; return 424242; }, // FAKE — never a real agent in a soak sandbox.
        markResume: (o) => markBuildDispatchResume({ ...o, lockRoot: resumeRoot }),
      });
    } catch (e) {
      violations.push({ invariant: 'crash', detail: String(e?.stack || e) });
      return { violations };
    }
    log?.(JSON.stringify(results));

    const byNum = Object.fromEntries(results.map((r) => [r.num, r]));

    // #4131 — RESUMED, never released, never left stuck.
    if (byNum['4131']?.action !== 'resume') {
      violations.push({ invariant: 'resume-not-triggered', detail: `#4131 (resumable) got action ${JSON.stringify(byNum['4131'])}, expected 'resume'` });
    }
    if (!spawnedResumeWith || String(spawnedResumeWith.sessionSlug) !== 'conveyor-4131') {
      violations.push({ invariant: 'resume-wrong-session', detail: `resume spawned with ${JSON.stringify(spawnedResumeWith)}` });
    }
    const claimsAfter = listBuildDispatchClaims({ lockRoot: claimRoot }).map((c) => c.meta.num);
    if (!claimsAfter.includes('4131')) {
      violations.push({ invariant: 'claim-lost-during-resume', detail: '#4131\'s claim must stay held while its resume runs — it was released instead' });
    }
    const markerA = readBuildDispatchResume({ num: '4131', lockRoot: resumeRoot });
    if (!markerA) {
      violations.push({ invariant: 'resume-not-marked', detail: 'no resume marker recorded for #4131 after a resume dispatch' });
    } else if (markerA.meta?.runId !== rowA || markerA.meta?.rowKey !== 'step:1:0') {
      violations.push({ invariant: 'resume-marker-unbound', detail: `#4131's resume marker is not bound to its row: ${JSON.stringify(markerA.meta)}` });
    }
    if (!spawnedResumeWith || spawnedResumeWith.runId !== rowA || spawnedResumeWith.effectKey !== 'step:1:0') {
      violations.push({ invariant: 'resume-cannot-settle-row', detail: `resume not handed the original row's run-id/effect-key: ${JSON.stringify(spawnedResumeWith)}` });
    }

    // PR #2921 review — a stale marker must never get a LIVE build released.
    if (byNum['4400']?.action !== 'leave' || !claimsAfter.includes('4400')) {
      violations.push({ invariant: 'stale-marker-killed-live-build', detail: `#4400 (live re-dispatch, stale marker) got ${JSON.stringify(byNum['4400'])}; claim held: ${claimsAfter.includes('4400')}` });
    }

    // #4382 — THE ACTUAL BUG THIS CARD FIXES: RELEASED (never stuck forever occupying a builder slot).
    if (byNum['4382']?.action !== 'release') {
      violations.push({ invariant: 'release-not-triggered', detail: `#4382 (nothing resumable) got action ${JSON.stringify(byNum['4382'])}, expected 'release'` });
    }
    if (claimsAfter.includes('4382')) {
      violations.push({ invariant: 'claim-stuck-forever', detail: '#4382\'s claim is STILL held after adoption — this is the exact live bug: a dead-wrapper claim never retired, permanently occupying a builder slot' });
    }

    // cleanup — best-effort, never masks a violation already recorded.
    for (const dir of [claimRoot, resumeRoot, runsDir, resumableLane, emptyLane]) {
      try { rmSync(dir, { recursive: true, force: true }); } catch { /* best-effort */ }
    }

    return { violations, results };
  },
  judge(report) {
    return report.violations.map((v) => `[${v.invariant}] ${v.detail}`);
  },
};
