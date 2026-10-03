/**
 * @file breaks/reclaim-skips-liveness-gate-when-preserved.mjs — live break, confirmed 2026-09-28 (lane-18,
 * lane-21; #4294), fixed by we:backlog/4372-health-watch-reclaim-resets-live-pushed-lane.md (bornAs: 4372).
 *
 * LIVE INCIDENT. `scripts/lane-pool.mjs#cmdReclaim` only ever ran its liveness gate (live owner session, live
 * process cwd, quiet period) inside `cmdReclaimSalvage`, and only entered that path when a lane's content was
 * NOT provably preserved. Once every uncommitted/ahead change is already on a remote ref (the lane pushed its
 * work, e.g. to its own `lane/*` ref mid-PR), `cmdReclaim` fell straight through to `git reset --hard
 * origin/main` + `git clean -fd` with only a live-LEASE check — so an unleased lane whose lease had just been
 * dropped (see we:backlog/4371, `bornAs: 4371`) was reset the moment its work was pushed, even while its
 * worker was still live and mid-verify or mid-PR. Measured live: lane-18 reflog `16:38:53 commit b01a9b50c` →
 * `16:49:34 reset: moving to origin/main`; health-watch log `lane-18: reset — content already on a remote
 * ref, nothing to salvage` with the SAME owner session live one tick earlier. Recurred on lane-21.
 *
 * FIX (#4372): a shared `laneLivenessGate` (`we:scripts/lib/lane-salvage.mjs`) now runs on `cmdReclaim`'s
 * direct-reset path too — for every non-override reclaim, preserved or not — both before claiming the lease
 * marker and again ("under the hold") right before the actual reset.
 *
 * SCENARIO (no daemon tick loop — `cmdReclaim` is a plain synchronous CLI command, same shape as this
 * directory's `lease-reaper-hand-briefed-owner-invisible.mjs` sibling; `daemons: []`). A real throwaway git
 * origin + one lane clone (never the sim world's own daemon clone/lane pool — this needs REAL git plumbing:
 * a genuinely pushed commit, a genuinely dropped lease), plus a fake `claude`/`lsof` on PATH so the gate's
 * read never touches this host's own real sessions/processes:
 *   - **lane-1 (the incident)**: acquires normally, commits work, pushes it to its own `lane/9401-test` ref
 *     (provably preserved), then RELEASES the lease (the #4371 shape: a lease can drop while its worker is
 *     still live) while `claude agents --json` still lists that same session as `working` with its `cwd`
 *     inside the lane.
 *   - **lane-2 (the control)**: the identical push-then-release shape, but with NO live agent in the fake
 *     listing and the quiet period already satisfied (`WE_LANE_SALVAGE_QUIET_MIN=0`) — must still reclaim
 *     normally, proving the fix does not just refuse every reclaim outright.
 *
 * RED (pre-fix): lane-1 IS reclaimed (`reclaimed: true`) — its live owner is invisible to the pre-fix direct-
 * reset path, which never runs the liveness gate at all once content reads as preserved. GREEN (post-fix):
 * lane-1 is KEPT (`kept: true`, reason names the live session) and its pushed content is left untouched.
 * Lane-2 is reclaimed exactly as before either way — the fix must not regress the happy path.
 */
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runSoak } from '../soak.mjs';

/** Hermetic commit identity — a CI runner has no global `user.name`/`user.email`, so `git commit` would abort. */
const GIT_IDENTITY_ENV = {
  GIT_AUTHOR_NAME: 'Sim World', GIT_AUTHOR_EMAIL: 'sim@example.com',
  GIT_COMMITTER_NAME: 'Sim World', GIT_COMMITTER_EMAIL: 'sim@example.com',
};

function git(cwd, args) {
  return execFileSync('git', ['-c', 'commit.gpgsign=false', ...args], {
    cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...GIT_IDENTITY_ENV },
  }).trim();
}

/** A fake `claude` (agents listing) + `lsof` (no live pids) pair on one bin dir, so the gate's reads are fully
 *  hermetic — never the real host's own sessions/processes. */
function fakeBins(root, agentsListing) {
  const bin = join(root, 'fakebin');
  mkdirSync(bin, { recursive: true });
  writeFileSync(join(bin, 'claude'), `#!/bin/sh\ncat <<'JSON'\n${JSON.stringify(agentsListing)}\nJSON\n`);
  chmodSync(join(bin, 'claude'), 0o755);
  writeFileSync(join(bin, 'lsof'), '#!/bin/sh\nexit 0\n');
  chmodSync(join(bin, 'lsof'), 0o755);
  return bin;
}

/** Build ONE lane: a real bare origin + a clone that commits + pushes work to its own `lane/*` ref, then
 *  drops its lease (release) — the exact #4371/#4372 shape: content preserved, lease gone, worker maybe live. */
function buildPushedThenReleasedLane({ poolDir, laneNum, laneScript, poolArgsCommon, session, env }) {
  const dir = join(poolDir, `lane-${laneNum}`);
  writeFileSync(join(dir, 'work.txt'), `landed via PR (lane-${laneNum})\n`);
  git(dir, ['add', 'work.txt']);
  git(dir, ['commit', '--quiet', '-m', 'land work']);
  git(dir, ['push', '--quiet', 'origin', `HEAD:refs/heads/lane/${9400 + laneNum}-test`]);
  const r = spawnSync('node', [laneScript, 'release', `--lane=${laneNum}`, `--session=${session}`, ...poolArgsCommon], { encoding: 'utf8', env });
  if (r.status !== 0) throw new Error(`release --lane=${laneNum} failed: ${r.stderr}`);
}

export default {
  id: 'reclaim-skips-liveness-gate-when-preserved',
  title: "cmdReclaim's direct-reset path (git reset --hard) never ran the liveness gate once a lane's content read as provably preserved — an unleased lane whose lease had just dropped, but whose worker was still live and had just pushed, was reset mid-verify or mid-PR",
  card: 'we:backlog/4372-health-watch-reclaim-resets-live-pushed-lane.md (bornAs: 4372)',
  fixedBy: {
    sha: 'PENDING-FILL-AT-LAND',
    where: 'main',
    paths: ['scripts/lane-pool.mjs', 'scripts/lib/lane-salvage.mjs'],
  },
  fixPresent(root) {
    try {
      const src = readFileSync(join(root, 'scripts/lane-pool.mjs'), 'utf8');
      return /laneLivenessGate/.test(src) && /reportKept/.test(src);
    } catch {
      return false;
    }
  },
  run({ log } = {}) {
    return runSoak({
      name: 'break:reclaim-skips-liveness-gate-when-preserved',
      rounds: 1,
      daemons: [], // cmdReclaim is a plain synchronous CLI command, not a resident daemon tick.
      mainEvery: 0,
      fleet: false,
      scorecards: false,
      junkInCwd: false,
      log,
      setup(w) {
        const base = mkdtempSync(join(tmpdir(), 'we-soak-reclaim-preserved-'));
        const originDir = join(base, 'origin.git');
        const referenceDir = join(base, 'reference');
        const poolRoot = join(base, 'pool');
        git(base, ['init', '--quiet', '--bare', '--initial-branch=main', originDir]);
        git(base, ['clone', '--quiet', originDir, referenceDir]);
        writeFileSync(join(referenceDir, 'file.txt'), 'v1\n');
        git(referenceDir, ['add', 'file.txt']);
        git(referenceDir, ['commit', '--quiet', '-m', 'v1']);
        git(referenceDir, ['push', '--quiet', 'origin', 'main']);

        const laneScript = join(w.simCloneRoot, 'scripts/lane-pool.mjs');
        const poolArgsCommon = [`--origin=${originDir}`, `--reference=${referenceDir}`, '--name=reclaimsoak', '--branch=main', '--no-install'];
        const env = { ...process.env, ...w.env, LANE_POOL_ROOT: poolRoot };

        const runPool = (args) => spawnSync('node', [laneScript, ...args], { encoding: 'utf8', env, timeout: 30_000 });
        if (runPool(['provision', '--count=2', ...poolArgsCommon]).status !== 0) {
          throw new Error('soak setup: provision failed');
        }

        // lane-1: the incident.
        if (runPool(['acquire', '--lane=1', '--session=incident-session', ...poolArgsCommon]).status !== 0) {
          throw new Error('soak setup: acquire lane-1 failed');
        }
        buildPushedThenReleasedLane({ poolDir: join(poolRoot, 'reclaimsoak'), laneNum: 1, laneScript, poolArgsCommon, session: 'incident-session', env });

        // lane-2: the control — identical shape, but no live agent in the fake listing.
        if (runPool(['acquire', '--lane=2', '--session=control-session', ...poolArgsCommon]).status !== 0) {
          throw new Error('soak setup: acquire lane-2 failed');
        }
        buildPushedThenReleasedLane({ poolDir: join(poolRoot, 'reclaimsoak'), laneNum: 2, laneScript, poolArgsCommon, session: 'control-session', env });

        // The fake listing carries ONLY the incident session, matching lane-1's dropped lease's own session
        // name (also its lease's `workerSession`/`ownerSession` when adopted — plain `--session` is enough
        // here since `liveAgentInLane` also matches on cwd, and this listing's cwd IS lane-1's own directory).
        const lane1Dir = join(poolRoot, 'reclaimsoak', 'lane-1');
        const agentsListing = [{ kind: 'background', name: 'incident-session', sessionId: 'incident-session', state: 'working', cwd: lane1Dir, startedAt: Date.now() }];
        const binDir = fakeBins(base, agentsListing);

        return { base, poolRoot, poolArgsCommon, laneScript, binDir, checked: { 1: false, 2: false } };
      },
      perRound(w, round, ctx, api) {
        try {
          const env = {
            ...process.env, ...w.env, LANE_POOL_ROOT: ctx.poolRoot, PATH: `${ctx.binDir}:${process.env.PATH}`,
            WE_LANE_SALVAGE_QUIET_MIN: '0', // isolate the LIVENESS half of the gate — recency is not this scenario's axis
          };
          const reclaim = (laneNum) => {
            const r = spawnSync('node', [ctx.laneScript, 'reclaim', `--lane=${laneNum}`, '--json', ...ctx.poolArgsCommon], { encoding: 'utf8', env, timeout: 30_000 });
            ctx.checked[laneNum] = true;
            let report = null;
            try { report = JSON.parse(r.stdout); } catch { /* fall through — reported as scenario-ran below */ }
            if (!report) {
              api.violation('scenario-ran', `reclaim --lane=${laneNum} --json produced no parseable output (exit ${r.status}); stderr: ${String(r.stderr || '').split('\n').slice(0, 3).join(' | ')}`);
            }
            return report;
          };

          const r1 = reclaim(1);
          if (r1) {
            api.say(`r00 lane-1 (incident) reclaim: reclaimed=${r1.reclaimed} kept=${!!r1.kept} keptReason=${r1.keptReason || '-'}`);
            if (r1.reclaimed === true) {
              api.violation('live-worker-lane-reclaimed', 'lane-1 was reclaimed (reset) even though its dropped lease\'s owning session is listed live in claude agents --json with its cwd inside the lane — a live worker\'s already-pushed lane was reset out from under it');
            }
            if (!existsSync(join(ctx.poolRoot, 'reclaimsoak', 'lane-1', 'work.txt'))) {
              api.violation('live-worker-content-destroyed', "lane-1's pushed work.txt no longer exists on disk after reclaim — a live worker's content was destroyed");
            }
          }

          const r2 = reclaim(2);
          if (r2) {
            api.say(`r00 lane-2 (control) reclaim: reclaimed=${r2.reclaimed}`);
            if (r2.reclaimed !== true) {
              api.violation('happy-path-regressed', `lane-2 (no live agent, quiet period satisfied) was NOT reclaimed (reclaimed=${r2.reclaimed}) — the fix regressed the ordinary preserved-and-quiet reclaim path`);
            }
          }
        } finally {
          rmSync(ctx.base, { recursive: true, force: true });
        }
      },
    });
  },
  judge(report) {
    const OWN = new Set(['live-worker-lane-reclaimed', 'live-worker-content-destroyed', 'happy-path-regressed', 'scenario-ran']);
    const problems = report.violations.filter((v) => OWN.has(v.invariant)).map((v) => `${v.daemon ?? '-'} tick ${v.tick ?? '-'}: [${v.invariant}] ${v.detail}`);
    if (!report.ctx?.checked?.[1] || !report.ctx?.checked?.[2]) problems.push('[scenario-ran] cmdReclaim never ran for one or both lanes — this scenario proves nothing');
    return problems;
  },
};
