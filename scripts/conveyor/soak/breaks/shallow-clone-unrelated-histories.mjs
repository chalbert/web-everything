/**
 * @file breaks/shallow-clone-unrelated-histories.mjs — live break, 2026-09-26 (#4075, card x8pcbf3). PR #2752
 * (`lane/4034-critical-work-gate`) was stuck: every conveyor rebase-onto-main attempt failed "merge-tree
 * produced no tree (fatal: refusing to merge unrelated histories)", although the branch plainly descends from
 * `main`. Root cause (read-only reproduced in the live `wev-review-daemon` checkout): that checkout was SHALLOW —
 * `.git/shallow` named PR #2752's own head sha (`8e1f0c23d`) as a boundary with zero recorded parents, while
 * `origin/main` in the same checkout was fully deepened. `rebaseDropManifest` / `rebaseDropContent`
 * (`we:scripts/lib/rebase-drop-*.mjs`) fetch only the ONE lane ref they need, which keeps that grafted root, so
 * `git merge-tree --write-tree origin/main origin/<lane>` finds no common ancestor and fails. A checkout
 * DEFECT, but reported exactly like a real failure: the fix-dispatch daemon's main-red rebase pass
 * (`we:scripts/conveyor/ci-red-recovery-watch.mjs#sweepCiRedRecovery`, wired in
 * `we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs#runMainRedRebaseAllRepos`) posted a FAILED
 * rebase-onto-main marker per attempt, burning `DEFAULT_MAX_REBASE_RETRIES_PER_SHA` (2, `main-red-recovery.mjs`)
 * until the PR was handed off as `rebase-cap-exhausted` and picked up `review-status:ci-heal-stalled`.
 *
 * Fix: PR #2761, merge commit 3c69543f8 — `we:scripts/lib/git-run.mjs#ensureFullHistory` (probe
 * `git rev-parse --is-shallow-repository`; only when shallow, `git fetch <remote> --unshallow`).
 * `rebaseDropManifest` / `rebaseDropContent` call it ONLY when merge-tree fails "unrelated histories", then retry
 * the identical merge-tree once; `branch-sync.mjs` gets the same fix-and-retry, `branch-drift.mjs` the same guard.
 *
 * WHY A SOAK CASE, NOT ONLY THE UNIT TESTS: the unit tests pin the plumbing against a FAKE git runner. What broke
 * live was the seam — a daemon checkout whose on-disk git state (a shallow boundary some earlier `--depth` fetch
 * left behind) was never produced by the code that later tripped on it, feeding a REAL daemon pass whose durable
 * retry cap turned one checkout defect into a stalled PR. This scenario runs the real fix-dispatch daemon, real
 * git, in a daemon clone put into the exact live shape.
 *
 * SCENARIO (fix-dispatch only, no default fleet, 3 rounds):
 *   - one PR on `lane/soak-shallow`, its required `test` check FAILED at a moment `main`'s own CI was red (a
 *     seeded `gh run list` history: red run, then a later green one — main has recovered), and `main` moved one
 *     docs-only commit past the lane's base (`ahead_by: 1`). That is exactly a `rebase-onto-main` dispatch for
 *     `planMainRedRebases`.
 *   - the daemon clone then does `git fetch --depth=1 origin lane/soak-shallow` — the real git way to land the
 *     live state: `.git/shallow` names the lane head, `origin/main` stays fully deep (the setup asserts both).
 *
 * The scenario hook reads the PR's rebase-onto-main marker comments at the start of every round.
 * RED = a marker says the refresh FAILED with "unrelated histories" (pre-fix: every tick, until the cap is
 * burned — two FAILED markers by round 2), or no marker ever reports a successful refresh.
 * GREEN = the first tick's refresh unshallows the clone, retries merge-tree, and rebuilds the lane onto main
 * ("refreshed this branch onto main's current tip"); no FAILED marker at all.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runSoak } from '../soak.mjs';

const ROUNDS = 3;
const LANE = 'lane/soak-shallow';
const INVARIANT = 'shallow-unrelated-histories';
/** `we:scripts/conveyor/main-red-recovery.mjs#REBASE_ONTO_MAIN_COMMENT_MARKER` — duplicated so the judge never
 *  imports daemon code from the tree under test. */
const MARKER = '🔀 conveyor rebase-onto-main';

/** Fixed timestamps: main red at T0, the PR's `test` fails at T1 (inside the window), main green at T2. Only their
 *  order matters (`classifyCiFailureAttribution` compares them to each other, never to "now"). */
const T0 = '2026-09-26T10:00:00Z';
const T1 = '2026-09-26T10:30:00Z';
const T2 = '2026-09-26T11:00:00Z';

const git = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

function rebaseMarkers(w, pr) {
  const row = w.gh.pr('we', pr);
  return (row?.comments ?? []).map((c) => String(c?.body ?? '')).filter((b) => b.trimStart().startsWith(MARKER));
}

export default {
  id: 'shallow-clone-unrelated-histories',
  title: 'a shallow boundary on a lane head in the daemon clone fails every rebase-onto-main "unrelated histories" and burns the retry cap',
  card: 'x8pcbf3 — PR #2761 (live PR #2752 stuck, review-status:ci-heal-stalled) (epic #4075)',
  fixedBy: {
    sha: '3c69543f8',
    where: 'main',
    paths: [
      'scripts/lib/git-run.mjs',
      'scripts/lib/rebase-drop-manifest.mjs',
      'scripts/lib/rebase-drop-content.mjs',
      'scripts/conveyor/branch-sync.mjs',
      'scripts/conveyor/branch-drift.mjs',
    ],
  },
  fixPresent(root) {
    try {
      const helper = readFileSync(join(root, 'scripts/lib/git-run.mjs'), 'utf8');
      const caller = readFileSync(join(root, 'scripts/lib/rebase-drop-manifest.mjs'), 'utf8');
      return /export function ensureFullHistory\(/.test(helper) && /ensureFullHistory\(run,/.test(caller);
    } catch { return false; }
  },
  run({ log } = {}) {
    return runSoak({
      name: 'break:shallow-clone-unrelated-histories',
      rounds: ROUNDS,
      daemons: ['fix-dispatch'], // owns the main-red rebase pass (runMainRedRebaseAllRepos)
      mainEvery: 0,
      fleet: false,
      scorecards: false,
      setup(w, { api }) {
        const slug = w.repos.we.slug;
        w.git.createBranch('we', LANE, { from: 'main', files: { 'soak/shallow-lane.txt': 'a lane change red only because main was red\n' } });
        // main moves past the lane's base — docs-only, so the daemon's self-sync follows it without a restart.
        api.moveMain(w, { 'soak/shallow-main-fix.md': '# main recovered\n' }, 'soak: main fix lands (main green again)');
        const pr = w.gh.openPr({ repo: 'we', head: LANE, base: 'main', title: 'soak: red because main was red', body: 'No backlog item.' });
        w.gh.setChecks('we', pr, [{ name: 'test', conclusion: 'FAILURE', startedAt: T0, completedAt: T1 }]);
        w.gh.raw.setRuns(slug, [
          { databaseId: 9001, headBranch: 'main', workflowName: 'CI', status: 'completed', conclusion: 'failure', createdAt: T0, updatedAt: T0 },
          { databaseId: 9002, headBranch: 'main', workflowName: 'CI', status: 'completed', conclusion: 'success', createdAt: T2, updatedAt: T2 },
        ]);

        // The live checkout defect: a `--depth=1` fetch leaves the lane head as a grafted root in the daemon clone.
        const clone = w.simCloneRoot;
        git(clone, ['fetch', '--quiet', 'origin', 'main']);
        git(clone, ['fetch', '--quiet', '--depth=1', 'origin', LANE]);
        const head = git(clone, ['rev-parse', `origin/${LANE}`]);
        const shallowFile = join(clone, '.git', 'shallow');
        const boundaries = existsSync(shallowFile) ? readFileSync(shallowFile, 'utf8').split('\n').filter(Boolean) : [];
        if (!boundaries.includes(head)) throw new Error(`setup: .git/shallow does not name the lane head ${head} (${boundaries.join(',') || 'none'})`);
        let unrelated = false;
        try { git(clone, ['merge-tree', '--write-tree', 'origin/main', `origin/${LANE}`]); } catch (e) { unrelated = /unrelated histories/.test(String(e.stderr || '')); }
        if (!unrelated) throw new Error('setup: the shallow clone did not reproduce "refusing to merge unrelated histories"');
        api.say(`setup: PR #${pr} ${LANE} @ ${head.slice(0, 9)} is a shallow boundary in the daemon clone — merge-tree says "unrelated histories"`);
        return { pr, head, seen: [] };
      },
      perRound(w, round, ctx, api) {
        if (round === 0) return;
        const markers = rebaseMarkers(w, ctx.pr);
        ctx.seen = markers;
        const failed = markers.filter((b) => /FAILED/.test(b) && /unrelated histories/i.test(b));
        if (failed.length) {
          api.violation(INVARIANT, `PR #${ctx.pr}: ${failed.length} rebase-onto-main attempt(s) FAILED "unrelated histories" (cap 2) — ${failed[failed.length - 1].split('\n').pop().slice(0, 240)}`);
        }
      },
      log,
    });
  },
  judge(report) {
    const problems = report.violations
      .filter((v) => v.invariant === INVARIANT || v.invariant === 'crash' || v.invariant === 'isolation')
      .map((v) => `${v.daemon ?? '-'} tick ${v.tick ?? '-'}: [${v.invariant}] ${v.detail}`);
    const seen = report.ctx?.seen ?? [];
    if (!problems.length && !seen.some((b) => /refreshed this branch onto main/.test(b))) {
      problems.push(`PR #${report.ctx?.pr ?? '?'}: no rebase-onto-main marker ever reported a successful refresh (${seen.length} marker(s) seen)`);
    }
    return problems;
  },
};
