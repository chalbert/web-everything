/**
 * @file breaks/unrecognized-session-lease-outlives-merged-pr.mjs — LIVE INCIDENT, 2026-09-27 ~6:55pm ET
 * (`we:backlog/4311-lane-concurrency-ceiling-counts-stale-unreleased-leases-as-a.md`, card `xkk4lv7`, PR #2835).
 * `node we:scripts/operations/run.mjs dispatch-lane --num=4306` refused with `capacity-cap` while every dispatch
 * kind (building/preparing/fixing/healing) read ZERO live work — the lane-concurrency ceiling
 * (`we:scripts/lib/lane-concurrency.mjs`) still counted a lane as leased that had, in fact, finished hours ago.
 *
 * ROOT CAUSE: the resident `lease-reaper.mjs` pass (launchd, every 120s) resolves a held lease's item/PR number
 * ONLY from `lease.session`, via `itemNumFromSession`/`prNumFromSession` (`we:scripts/conveyor/session-slug.mjs`'s
 * dispatcher-minted grammar: `conveyor-`/`prepare-`/`fix-`/`review-`/`ci-heal-`/`inspect-<id>`). A lane acquired
 * via a BARE `we:scripts/lane-pool.mjs acquire --purpose=<slug>` with no matching `--session=` gets its session
 * from `defaultSession()` (`hostname():process.ppid`, or an ad-hoc mechanical-pass label like `build-4306` — the
 * exact live shape the card's own investigation caught mid-flight) — a name that fits NEITHER namespace. Both
 * `itemNumFromSession`/`prNumFromSession` return `null` (deliberately — never guess), so the PR-terminal axis
 * NEVER FIRES for this lease, however long ago its PR merged. `sessionGoneForLease` is equally blind (it only
 * ever checks a dispatcher-minted name). The lease is reclaimable ONLY by the 4-hour TTL backstop — live
 * evidence: lane-2 (`soak-gate-merge-base`, PR #2825 MERGED) and lane-9 (`promote-stale-green`, PR #2826 MERGED)
 * both sat leased well past their PR's merge, each occupying one of the 8 ceiling slots the whole time — and the
 * identical inflation reaches the build-dispatch daemon's own `[cap] N builds in flight` counter (card's "Related
 * manifestation" section), since both counters ultimately read "is this lane still leased," not "is real work
 * still running in it."
 *
 * FIX (#xkk4lv7, PR #2835): `laneBranchItemNum` resolves the lease's item from the lane's OWN checked-out branch
 * (the same `lane/<num>-*` grammar already trusted for a PR's `headRefName`), consulted ONLY when BOTH
 * `itemNumFromSession` and `prNumFromSession` return `null` (Fork 1 — never overrides a correctly-resolved
 * PR-kind lookup). A branch-derived terminal verdict is trusted only once `laneQuietSincePr` corroborates it
 * (Fork 2/Option C): clean tree, HEAD contained in the PR's own merge commit, AND `nowMs` at least
 * `DEFAULT_QUIET_MS` (30 minutes) past the LATER of the PR's `mergedAt` and the lease's OWN `acquiredAt` — a
 * fresh holder of an old-merged branch always gets its own full 30-minute grace from `acquiredAt`, never an
 * instant reap off a stale `mergedAt` alone (round-3 light-plan-review finding, this card's own Risk 9).
 *
 * SCENARIO (no daemon tick loop — this incident lives in the RESIDENT `lease-reaper.mjs` pass, which is not one
 * of `soak.mjs`'s review/fix-dispatch/drain ticks; `daemons: []`, mirrors `rebuild-finalize-starved.mjs`'s own
 * "drive the real script directly" shape). TWO real, standalone git repos stand in for two held lanes in a
 * throwaway `LANE_POOL_ROOT` pool named `web-everything` (the exact dir name `repoKeyForDir` maps to `'we'`), a
 * fake `gh` on PATH answering `pr list` for both, and a fake `claude` that exits 1 (session axis OFF —
 * deterministic regardless of host `claude` state; this break needs only the PR-terminal axis):
 *   - **lane-1 (the incident)**: session `build-9101` (the card's own live `build-<num>` shape — an ad-hoc
 *     mechanical-pass label matching NEITHER dispatcher namespace), branch `lane/9101-mechanical-pass`, clean
 *     tree, HEAD = the fake PR's own `mergeCommit.oid` (trivially contained). Lease **acquired 90 minutes ago**
 *     (comfortably inside the 240-minute TTL — this is the whole point: a lease nowhere NEAR its TTL backstop).
 *     PR #9101 **merged 60 minutes ago** — 60 > `DEFAULT_QUIET_MS`'s 30 minutes, so the fix's own quiet window has
 *     genuinely elapsed. Pre-fix this lease is invisible to every fast axis and sits `kept` for up to 3.5 MORE
 *     hours; post-fix it reaps THIS pass, via `pr-merged`.
 *   - **lane-2 (the safety-gate control, Fork 2/Option C)**: session `Mac:24601` (the `defaultSession()` shape),
 *     branch `lane/9102-mechanical-pass`, clean tree, HEAD contained in PR #9102's merge commit. PR #9102
 *     **merged 24 hours ago** (long past any quiet window on `mergedAt` alone) but this lease was **acquired only
 *     5 minutes ago** — a genuinely FRESH holder of an old-merged branch (a retry, or a second mechanical pass
 *     reusing the same branch). `nowMs - max(mergedAt, acquiredAt)` = 5 minutes, well under the 30-minute quiet
 *     window, so this must stay `kept` on BOTH trees — proving the fix's own safety gate, not just its reap path,
 *     survives a real (non-unit-test) resident pass. Never reaped by pre-fix code either, for the unrelated
 *     reason that its TTL (5 minutes old) is nowhere close — the point of THIS fixture is exclusively the
 *     post-fix guarantee.
 *
 * RED (pre-fix): lane-1 is NOT in `wouldReap` — `resolveLeaseItemNum`/`laneBranchItemNum` do not exist yet, so
 * `itemNum` stays `null` for a `build-`-prefixed session, the PR-terminal axis never engages, and (90 minutes <
 * 240-minute TTL) the TTL backstop hasn't fired either — the lease reads `kept`, exactly the live incident.
 * GREEN (post-fix): lane-1 IS in `wouldReap` with `reason: 'pr-merged'` (quiet window satisfied); lane-2 stays
 * `kept` on both trees (the safety gate holds).
 *
 * The Fork-1 namespace-conflict regression (`fix-<PR>` + unrelated merged branch) and the remaining Fork-2
 * fresh-holder/live-work regressions are already proven at the unit level in this same PR
 * (`we:scripts/conveyor/__tests__/lease-reaper.test.mjs`, `we:scripts/__tests__/lane-pool-reap-branch-fallback.
 * test.mjs`) — this soak's own job is narrower and complementary: prove the RESIDENT dry-run pass (the actual
 * daemon surface the capacity-cap incident lived on, never exercised by those two unit suites) genuinely frees
 * the concurrency-ceiling slot within the quiet window instead of the 4-hour TTL, end to end, through the real
 * script — not a hand-picked `classifyReap`/`resolveLeaseItemNum` call.
 */
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync, rmSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readFileSync } from 'node:fs';
import { runSoak } from '../soak.mjs';

const MIN = 60_000;
/** Well short of `DEFAULT_LEASE_TTL_MINUTES` (240) — the whole point of this scenario: a lease nowhere near its
 *  TTL backstop. */
const LANE1_ACQUIRED_MIN_AGO = 90;
/** > `DEFAULT_QUIET_MS`'s 30 minutes — the fix's own quiet window has genuinely elapsed by the time this pass runs. */
const LANE1_MERGED_MIN_AGO = 60;
/** A genuinely fresh holder — comfortably inside the 30-minute quiet window, regardless of how old the PR is. */
const LANE2_ACQUIRED_MIN_AGO = 5;
const LANE2_MERGED_MIN_AGO = 24 * 60;

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function makeLane(root, name, branch) {
  const dir = join(root, name);
  mkdirSync(dir, { recursive: true });
  git(['init', '--quiet', '--initial-branch=main'], dir);
  writeFileSync(join(dir, 'file.txt'), 'v1\n');
  git(['add', 'file.txt'], dir);
  git(['-c', 'user.email=t@t.com', '-c', 'user.name=t', 'commit', '--quiet', '-m', 'v1'], dir);
  git(['checkout', '--quiet', '-b', branch], dir);
  writeFileSync(join(dir, 'feature.txt'), `${name} work\n`);
  git(['add', 'feature.txt'], dir);
  git(['-c', 'user.email=t@t.com', '-c', 'user.name=t', 'commit', '--quiet', '-m', `${name} feature`], dir);
  const headSha = git(['rev-parse', 'HEAD'], dir);
  return { dir, headSha };
}

function writeLease(dir, { session, acquiredAt }) {
  // `.lane-lease` — `we:scripts/lib/lane-lease.mjs#LEASE_FILENAME`'s own value, hand-written here (this scenario
  // never runs a real `lane-pool.mjs acquire`) with exactly the fields `readLease`/`isLeaseStale` read.
  writeFileSync(join(dir, '.git', '.lane-lease'), `${JSON.stringify({ session, acquiredAt, purpose: 'mechanical-pass' }, null, 2)}\n`);
}

/** A fake `gh` that answers ANY `gh ...` call with the same fixed `pr list` JSON (mirrors the production unit
 *  suite's own `fakeGhOnPath` convention, `we:scripts/__tests__/lane-pool-reap-branch-fallback.test.mjs`) — the
 *  one call `fetchPrStatesForRepo` makes. A fake `claude` that always exits 1 keeps the session-gone axis OFF
 *  deterministically (this break needs only the PR-terminal axis; a real `claude` on the host's own PATH must
 *  never leak into this scenario's result). */
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
  id: 'unrecognized-session-lease-outlives-merged-pr',
  title: "the resident lease-reaper's PR-terminal axis never resolves a lane leased via a bare `acquire --purpose=` (no dispatcher-recognizable session) — a merged-PR lease rides the 4-hour TTL backstop instead of freeing within the ~30-minute quiet window, inflating the lane-concurrency ceiling",
  card: 'we:backlog/4311-lane-concurrency-ceiling-counts-stale-unreleased-leases-as-a.md (#xkk4lv7, PR #2835)',
  fixedBy: {
    // Filled at land time with the fix commit's own sha (never the baseline) — see this file's own header
    // convention, matched by `reaper-backstop-clobbers-live-fixer.mjs` for an in-flight PR's own break.
    sha: 'PENDING-FILL-AT-LAND',
    where: 'main',
    paths: ['scripts/conveyor/lease-reaper.mjs', 'scripts/lane-pool.mjs'],
  },
  fixPresent(root) {
    try {
      return /export function resolveLeaseItemNum/.test(readFileSync(join(root, 'scripts/conveyor/lease-reaper.mjs'), 'utf8'));
    } catch {
      return false;
    }
  },
  run({ log } = {}) {
    return runSoak({
      name: 'break:unrecognized-session-lease-outlives-merged-pr',
      rounds: 1,
      daemons: [], // the incident lives in the RESIDENT lease-reaper pass, not a review/fix-dispatch/drain tick.
      mainEvery: 0,
      fleet: false,
      scorecards: false,
      junkInCwd: false,
      log,
      setup(w) {
        const base = mkdtempSync(join(tmpdir(), 'we-soak-lease-ceiling-'));
        const poolRoot = join(base, 'pool');
        const poolDir = join(poolRoot, 'web-everything'); // repoKeyForDir('web-everything') === 'we'
        mkdirSync(poolDir, { recursive: true });

        const lane1 = makeLane(poolDir, 'lane-1', 'lane/9101-mechanical-pass');
        writeLease(lane1.dir, { session: 'build-9101', acquiredAt: new Date(Date.now() - LANE1_ACQUIRED_MIN_AGO * MIN).toISOString() });

        const lane2 = makeLane(poolDir, 'lane-2', 'lane/9102-mechanical-pass');
        writeLease(lane2.dir, { session: 'Mac:24601', acquiredAt: new Date(Date.now() - LANE2_ACQUIRED_MIN_AGO * MIN).toISOString() });

        const prs = [
          {
            number: 9101, state: 'MERGED', headRefName: 'lane/9101-mechanical-pass',
            mergedAt: new Date(Date.now() - LANE1_MERGED_MIN_AGO * MIN).toISOString(),
            mergeCommit: { oid: lane1.headSha },
          },
          {
            number: 9102, state: 'MERGED', headRefName: 'lane/9102-mechanical-pass',
            mergedAt: new Date(Date.now() - LANE2_MERGED_MIN_AGO * MIN).toISOString(),
            mergeCommit: { oid: lane2.headSha },
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

          if (!reapedSessions.has('build-9101')) {
            api.violation('stale-lease-survives-merge', `lane-1 (session build-9101, PR #9101 merged ${LANE1_MERGED_MIN_AGO}m ago, lease acquired only ${LANE1_ACQUIRED_MIN_AGO}m ago — comfortably inside the 240m TTL) was NOT reaped — it keeps occupying a concurrency-ceiling slot with its work objectively done`);
          }
          if (reapedSessions.has('Mac:24601')) {
            api.violation('fresh-holder-wrongly-reaped', "lane-2 (session Mac:24601, a FRESH 5-minute-old holder of a branch whose PR merged 24h ago) WAS reaped — Fork 2/Option C's safety gate (anchor the quiet window to the LATER of mergedAt/acquiredAt) did not hold");
          }
        } finally {
          // #xkk4lv7 soak review finding: every sibling `mkdtempSync`-using break in this directory cleans up its
          // own scratch dir (e.g. `worker-push-during-fix-claim.mjs`) — leaving this one behind would silently
          // accumulate two real throwaway git repos under the host's tmpdir per run.
          rmSync(ctx.base, { recursive: true, force: true });
        }
      },
    });
  },
  judge(report) {
    const OWN = new Set(['stale-lease-survives-merge', 'fresh-holder-wrongly-reaped', 'scenario-ran']);
    const problems = report.violations.filter((v) => OWN.has(v.invariant)).map((v) => `${v.daemon ?? '-'} tick ${v.tick ?? '-'}: [${v.invariant}] ${v.detail}`);
    if (!report.ctx?.checked) problems.push('[scenario-ran] the resident lease-reaper dry-run pass never ran — this scenario proves nothing');
    return problems;
  },
};
