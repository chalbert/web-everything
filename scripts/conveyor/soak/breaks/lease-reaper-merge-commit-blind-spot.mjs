/**
 * @file breaks/lease-reaper-merge-commit-blind-spot.mjs — live break, confirmed on PR #2835 (still unfixed on
 * `main` 2026-09-28), fixed by we:backlog/4337-lease-reaper-branch-fallback-reject-lanes-with-unlanded-merg.md.
 *
 * LIVE INCIDENT. `we:scripts/conveyor/lease-reaper.mjs#defaultGitIsAncestor`'s squash/rebase fallback
 * (`git cherry <sha> HEAD`) excludes MERGE commits from its per-commit patch-equivalence view entirely — a
 * merge commit never surfaces in `cherry`'s output as a distinguishable patch, neither `+` nor `-`. So a lane
 * whose HEAD carries a real `--no-ff` merge commit with UNIQUE conflict-resolution content — content `sha`
 * (the corresponding PR's own merge-commit oid) never received — but whose *non-merge* commits are
 * independently patch-equivalent upstream by some other means, reads as empty/all-`-`: falsely "contained".
 * `laneQuietSincePr` then corroborates reclamation and the merge's own conflict-resolution work is lost.
 *
 * `laneQuietSincePr` is consulted from exactly ONE production caller (`resolveLeaseItemNum`), and ONLY for the
 * BRANCH-FALLBACK population: a lease whose `session` names NEITHER a backlog item nor a PR under the
 * dispatcher's own session grammar (`we:scripts/conveyor/session-slug.mjs`) — e.g. a bare
 * `lane-pool.mjs acquire --purpose=<slug>` with no matching `--session=`. A normal `conveyor-<item>` /
 * `fix-<pr>` session is trusted directly off the PR list with NO corroboration at all — this bug cannot
 * manifest there. So this scenario deliberately mirrors its soak sibling
 * `unrecognized-session-lease-outlives-merged-pr.mjs`'s session shape (an unrecognized, ad-hoc label), the
 * SAME real population #4311/#xkk4lv7 introduced this corroboration path for — this card's fix hardens that
 * SAME path's containment check, not a new one.
 *
 * FIX (#4337): after `cherry` reads "contained", veto on any merge commit reachable from HEAD but not from
 * `sha` (`git rev-list --merges`, bounded to `sha..HEAD`) — existence alone is disqualifying, since a merge's
 * unique content can never be represented as a `cherry`-comparable patch at all. Fail-closed: this can only
 * turn a would-be `true` into `false`/`null`, never the reverse.
 *
 * SCENARIO (no daemon tick loop — this incident lives in the RESIDENT `lease-reaper.mjs --dry-run` pass, same
 * shape as `unrecognized-session-lease-outlives-merged-pr.mjs`; `daemons: []`). ONE throwaway `LANE_POOL_ROOT`
 * pool named `web-everything`, a fake `gh` answering `pr list`, a fake `claude` that exits 1 (session axis OFF
 * — this break needs only the PR-terminal / branch-fallback axis):
 *   - **lane-1 (the incident)**: session `build-9301` (an ad-hoc mechanical-pass label matching NEITHER
 *     dispatcher namespace — the same shape #4311/#xkk4lv7's own live incident used), branch
 *     `lane/9301-lease-merge-blindspot`. HEAD is a real `--no-ff` merge commit carrying unique
 *     conflict-resolution content (an extra file committed alongside the merge, beyond the trivial union of
 *     its two parents — the same fixture shape as the unit-level regression in this PR's own
 *     `__tests__/lease-reaper.test.mjs`). The merge's OWN non-merge commit (`lane-only.txt`) is independently
 *     reproduced (same diff, different sha) on a separate local branch — that reproduction, NOT the merge
 *     commit, is the fake PR's own `mergeCommit.oid`. Clean tree. Lease acquired 90 minutes ago, PR "merged"
 *     60 minutes ago — both comfortably past `DEFAULT_QUIET_MS` (30 min), so the ONLY variable under test is
 *     the containment axis itself, not the quiet window.
 *   - **lane-2 (the control)**: session `build-9302`, branch `lane/9302-squash-landed`, ONE non-merge commit,
 *     NO merge commit anywhere, independently reproduced (same diff, different sha) as the fake PR's own
 *     `mergeCommit.oid` — the pre-existing squash/rebase happy path this fix must NOT regress, driven through
 *     the same real resident pass, through the same branch-fallback corroboration path. Same quiet-window
 *     timing as lane-1.
 *
 * RED (pre-fix): lane-1 IS in `wouldReap` (`reason: 'pr-merged'`) — the merge's own content is invisible to
 * `cherry`, so `laneQuietSincePr` wrongly reads "contained" and the corroboration succeeds. Lane-2 is ALSO
 * reaped (unaffected happy path).
 * GREEN (post-fix): lane-1 is NOT reaped (stays `kept` — the new veto blocks corroboration). Lane-2 IS STILL
 * reaped (the fix changes nothing for the case it must not regress).
 */
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync, rmSync, readFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runSoak } from '../soak.mjs';

const MIN = 60_000;
const ACQUIRED_MIN_AGO = 90;
const MERGED_MIN_AGO = 60; // > DEFAULT_QUIET_MS's 30 minutes on both lanes

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function initRepo(dir) {
  mkdirSync(dir, { recursive: true });
  git(['init', '--quiet', '--initial-branch=main'], dir);
  git(['config', 'user.email', 't@t.com'], dir);
  git(['config', 'user.name', 't'], dir);
}

/** lane-1: the incident — a merge commit with unique content, unreachable from the fake PR's `mergeCommit.oid`,
 *  while the lane's own non-merge commit IS independently reproduced there. Returns the checked-out lane dir
 *  plus the sha to use as `mergeCommit.oid`. */
function makeIncidentLane(poolDir) {
  const dir = join(poolDir, 'lane-1');
  initRepo(dir);
  writeFileSync(join(dir, 'conflict.txt'), 'v0\n');
  git(['add', 'conflict.txt'], dir);
  git(['commit', '--quiet', '-m', 'C0: base'], dir);

  git(['checkout', '--quiet', '-b', 'lane/9301-lease-merge-blindspot'], dir);
  writeFileSync(join(dir, 'lane-only.txt'), 'lane-only\n');
  git(['add', 'lane-only.txt'], dir);
  git(['commit', '--quiet', '-m', 'C1: lane-only file'], dir);
  const laneC1 = git(['rev-parse', 'HEAD'], dir);

  git(['checkout', '--quiet', '-b', 'other', 'main'], dir);
  writeFileSync(join(dir, 'conflict.txt'), 'other-v\n');
  git(['add', 'conflict.txt'], dir);
  git(['commit', '--quiet', '-m', 'C2: other change (already upstream)'], dir);

  git(['checkout', '--quiet', 'lane/9301-lease-merge-blindspot'], dir);
  git(['merge', '--no-ff', '--quiet', '-m', 'M: merge other into lane', 'other'], dir);
  writeFileSync(join(dir, 'conflict.txt'), 'other-v\nresolved-unique-content\n');
  git(['add', 'conflict.txt'], dir);
  git(['commit', '--quiet', '--amend', '-m', 'M: merge other into lane (unique resolution)'], dir);

  // `mergeCommit.oid`: what's "already landed" — other's own change plus a SEPARATE, patch-equivalent
  // recreation of lane's C1 — but never the merge commit or its unique resolution.
  git(['checkout', '--quiet', '-b', 'landed', 'other'], dir);
  git(['cherry-pick', laneC1], dir);
  const landedSha = git(['rev-parse', 'HEAD'], dir);

  git(['checkout', '--quiet', 'lane/9301-lease-merge-blindspot'], dir);
  return { dir, mergeCommitOid: landedSha };
}

/** lane-2: the control — the pre-existing squash/rebase happy path (no merge commit anywhere), unaffected by
 *  this fix, driven through the same real resident pass. */
function makeControlLane(poolDir) {
  const dir = join(poolDir, 'lane-2');
  initRepo(dir);
  writeFileSync(join(dir, 'f.txt'), 'v0\n');
  git(['add', 'f.txt'], dir);
  git(['commit', '--quiet', '-m', 'C0: base'], dir);

  git(['checkout', '--quiet', '-b', 'lane/9302-squash-landed'], dir);
  writeFileSync(join(dir, 'lane-only.txt'), 'lane-only\n');
  git(['add', 'lane-only.txt'], dir);
  git(['commit', '--quiet', '-m', 'C1: lane-only file'], dir);

  git(['checkout', '--quiet', '-b', 'landed', 'main'], dir);
  writeFileSync(join(dir, 'lane-only.txt'), 'lane-only\n');
  git(['add', 'lane-only.txt'], dir);
  git(['commit', '--quiet', '-m', 'squash-landed: same diff, different commit'], dir);
  const landedSha = git(['rev-parse', 'HEAD'], dir);

  git(['checkout', '--quiet', 'lane/9302-squash-landed'], dir);
  return { dir, mergeCommitOid: landedSha };
}

function writeLease(dir, { session, acquiredAt }) {
  writeFileSync(join(dir, '.git', '.lane-lease'), `${JSON.stringify({ session, acquiredAt, purpose: 'mechanical-pass' }, null, 2)}\n`);
}

/** A fake `gh` answering ANY call with a fixed `pr list` JSON (mirrors the sibling soak break's own
 *  convention); a fake `claude` that always exits 1 keeps the session-gone axis OFF deterministically. */
function fakeBin(root, prs) {
  const bin = join(root, 'fakebin');
  mkdirSync(bin, { recursive: true });
  const gh = join(bin, 'gh');
  writeFileSync(gh, `#!/bin/sh\ncat <<'JSON'\n${JSON.stringify(prs)}\nJSON\n`);
  chmodSync(gh, 0o755);
  const claude = join(bin, 'claude');
  writeFileSync(claude, '#!/bin/sh\nexit 1\n');
  chmodSync(claude, 0o755);
  return bin;
}

export default {
  id: 'lease-reaper-merge-commit-blind-spot',
  title: "the resident lease-reaper's git-cherry containment fallback excludes merge commits entirely — a lane holding a merge commit with unique conflict-resolution content, but whose non-merge commits are otherwise patch-equivalent upstream, reads as falsely 'contained' and its merge-resolution work gets reaped",
  card: 'we:backlog/4337-lease-reaper-branch-fallback-reject-lanes-with-unlanded-merg.md (PR #2835)',
  fixedBy: {
    sha: 'PENDING-FILL-AT-LAND',
    where: 'main',
    paths: ['scripts/conveyor/lease-reaper.mjs'],
  },
  fixPresent(root) {
    try {
      const src = readFileSync(join(root, 'scripts/conveyor/lease-reaper.mjs'), 'utf8');
      return /\['rev-list', '--merges'/.test(src);
    } catch {
      return false;
    }
  },
  run({ log } = {}) {
    return runSoak({
      name: 'break:lease-reaper-merge-commit-blind-spot',
      rounds: 1,
      daemons: [], // the incident lives in the RESIDENT lease-reaper pass, not a review/fix-dispatch/drain tick.
      mainEvery: 0,
      fleet: false,
      scorecards: false,
      junkInCwd: false,
      log,
      setup(w) {
        const base = mkdtempSync(join(tmpdir(), 'we-soak-lease-mergeblindspot-'));
        const poolRoot = join(base, 'pool');
        const poolDir = join(poolRoot, 'web-everything'); // repoKeyForDir('web-everything') === 'we'
        mkdirSync(poolDir, { recursive: true });

        const lane1 = makeIncidentLane(poolDir);
        // `build-<num>` — an ad-hoc mechanical-pass label matching NEITHER dispatcher session namespace, so
        // resolution falls through to the branch fallback + Fork 2/Option C corroboration this card's fix
        // hardens (a normal `conveyor-<item>`/`fix-<pr>` session is trusted directly, no corroboration at all,
        // and never reaches the buggy code path).
        writeLease(lane1.dir, { session: 'build-9301', acquiredAt: new Date(Date.now() - ACQUIRED_MIN_AGO * MIN).toISOString() });

        const lane2 = makeControlLane(poolDir);
        writeLease(lane2.dir, { session: 'build-9302', acquiredAt: new Date(Date.now() - ACQUIRED_MIN_AGO * MIN).toISOString() });

        const prs = [
          {
            number: 9301, state: 'MERGED', headRefName: 'lane/9301-lease-merge-blindspot',
            mergedAt: new Date(Date.now() - MERGED_MIN_AGO * MIN).toISOString(),
            mergeCommit: { oid: lane1.mergeCommitOid },
          },
          {
            number: 9302, state: 'MERGED', headRefName: 'lane/9302-squash-landed',
            mergedAt: new Date(Date.now() - MERGED_MIN_AGO * MIN).toISOString(),
            mergeCommit: { oid: lane2.mergeCommitOid },
          },
        ];
        const binDir = fakeBin(base, prs);

        return { base, poolRoot, binDir, checked: false };
      },
      perRound(w, round, ctx, api) {
        try {
          const script = join(w.simCloneRoot, 'scripts/conveyor/lease-reaper.mjs');
          const env = { ...process.env, ...w.env, LANE_POOL_ROOT: ctx.poolRoot, PATH: `${ctx.binDir}:${process.env.PATH}` };
          const r = spawnSync('node', [script, '--dry-run', '--json'], { encoding: 'utf8', env, timeout: 20_000 });
          ctx.checked = true;
          let report = null;
          try { report = JSON.parse(r.stdout); } catch { /* fall through — reported as scenario-ran below */ }
          if (!report) {
            api.violation('scenario-ran', `lease-reaper --dry-run --json produced no parseable output (exit ${r.status}); stderr: ${String(r.stderr || '').split('\n').slice(0, 3).join(' | ')}`);
            return;
          }
          ctx.report = report;
          api.say(`r00 lease-reaper --dry-run: scanned=${report.scanned} wouldReap=${JSON.stringify(report.wouldReap)} kept=${report.kept} prAxis=${JSON.stringify(report.prAxis)}`);

          if (report.prAxis?.we !== 'on') {
            api.violation('scenario-ran', `the PR-terminal axis for 'we' was OFF (prAxis=${JSON.stringify(report.prAxis)}) — the fake \`gh\` was never consulted, so this scenario proves nothing`);
            return;
          }
          const reapedSessions = new Set((report.wouldReap || []).map((c) => c.session));

          if (reapedSessions.has('build-9301')) {
            api.violation('merge-commit-work-reaped', "lane-1 (session build-9301) carries a merge commit with unique conflict-resolution content the fake PR's mergeCommit.oid never received, yet was reaped — the merge's own work would be lost");
          }
          if (!reapedSessions.has('build-9302')) {
            api.violation('happy-path-regressed', 'lane-2 (session build-9302, the pre-existing squash/rebase happy path with no merge commit at all) was NOT reaped — the fix regressed the case it must not touch');
          }
        } finally {
          rmSync(ctx.base, { recursive: true, force: true });
        }
      },
    });
  },
  judge(report) {
    const OWN = new Set(['merge-commit-work-reaped', 'happy-path-regressed', 'scenario-ran']);
    const problems = report.violations.filter((v) => OWN.has(v.invariant)).map((v) => `${v.daemon ?? '-'} tick ${v.tick ?? '-'}: [${v.invariant}] ${v.detail}`);
    if (!report.ctx?.checked) problems.push('[scenario-ran] the resident lease-reaper dry-run pass never ran — this scenario proves nothing');
    return problems;
  },
};
