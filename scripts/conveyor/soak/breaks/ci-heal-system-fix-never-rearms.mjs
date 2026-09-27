/**
 * @file breaks/ci-heal-system-fix-never-rearms.mjs — card #4263 (epic #4075/#3383, PR #2787 review, live
 * incident 2026-09-27). A `waiting-on-system-fix` ci-heal escalation names a fix PR and refuses further ci-heal
 * dispatch "until that fix lands or a new push changes this head" — but nothing ever actually checked whether
 * the named fix PR HAD landed. `reconcile-core.mjs`'s refusal keyed PURELY on the escalation's recorded head
 * still matching the PR's current head, so once the referenced system fix genuinely merged and the PR's own
 * required check reran on the SAME (unchanged) head, a real remaining failure stayed permanently suppressed:
 * nothing re-armed healing until a person noticed the stale escalation or an unrelated push happened to move
 * the head.
 *
 * FIX (this same PR, card #4263): `reconcile-pass.mjs#enrichPrsWithSystemFixFacts` re-scans each PR's own
 * comments with the SAME pure `latestCiHealEscalationForHead` reader `reconcile-core.mjs` uses, and — only for
 * a live `waiting-on-system-fix` escalation — independently re-checks the referenced `systemFixRef` PR's own
 * CURRENT state (`gh pr view <ref> --json state,mergedAt,labels`, classified through the same terminal-state
 * reader `pr-watch.mjs` uses). `reconcile-core.mjs`'s escalation branch now re-arms — falling straight through
 * to the ordinary ci-heal cap/dispatch path — once that referenced PR has merged or closed.
 *
 * SCENARIO (fix-dispatch daemon only, no default fleet): one victim PR shaped like the live case — a required
 * check red (`test=FAILURE`), no review-park label, so it reads `ci-red` — carrying a durable
 * `waiting-on-system-fix` escalation comment (posted by a TRUSTED automation login, exactly as
 * `ci-heal-escalation-mark.mjs` posts it) that names a SEPARATE "system fix" PR. The system-fix PR starts open
 * (mirroring "a fix for it is already open" at escalation time) and is merged mid-run — the referenced fix
 * LANDING, with the victim's own head untouched throughout (no new push — the ONE condition the live incident
 * needed: re-arm on the SAME head once the fix lands, never merely "a new push moved the head", which already
 * worked before this card).
 *
 * RED (pre-fix) = zero `ci-heal-<victim>` sessions are EVER dispatched, even several ticks after the system-fix
 * PR merges — the escalation refuses forever, exactly the live incident. GREEN (post-fix) = still zero sessions
 * while the system-fix PR is open (the escalation correctly holds, unchanged behavior), but a fresh
 * `ci-heal-<victim>` session appears within a few ticks of the merge — the PR's own required check is still red,
 * and nothing else on this head has changed.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runSoak } from '../soak.mjs';
import { sessionMatches } from '../invariants.mjs';
import { buildCiHealEscalationComment } from '../../ci-heal-escalation-mark.mjs';

const ROUNDS = 6;
/** Round 0/1 are the harness's own dispatch + one-tick visibility lag (mirrors every sibling scenario in this
 *  directory) — by round 1 the escalation's permanent refusal (RED and GREEN alike) must already be holding.
 *  The system-fix PR merges at round 2, comfortably after that baseline is established. */
const MERGE_ROUND = 2;
/** The trusted automation login `isTrustedMarkerAuthor` (we:scripts/lib/marker-authorship.mjs) accepts by
 *  default — the SAME identity `ci-heal-escalation-mark.mjs`'s own CLI posts under live. */
const TRUSTED_AUTHOR = 'web-everything';

export default {
  id: 'ci-heal-system-fix-never-rearms',
  title: 'a waiting-on-system-fix ci-heal escalation refuses forever, even after the referenced fix PR merges and CI reruns on the SAME (unchanged) head',
  card: 'we:backlog/4263-high-waiting-on-system-fix-ci-heal-escalation-never-expires.md (epic #4075, PR #2787 review)',
  fixedBy: {
    sha: 'this same PR', where: 'this same PR (card #4263)',
    paths: ['scripts/conveyor/reconcile-core.mjs', 'scripts/conveyor/reconcile-pass.mjs'],
  },
  fixPresent(root) {
    try {
      const core = readFileSync(join(root, 'scripts/conveyor/reconcile-core.mjs'), 'utf8');
      const pass = readFileSync(join(root, 'scripts/conveyor/reconcile-pass.mjs'), 'utf8');
      return /isSystemFix\s*&&\s*base\.systemFixLanded/.test(core) && /enrichPrsWithSystemFixFacts/.test(pass);
    } catch { return false; }
  },
  run({ log } = {}) {
    return runSoak({
      name: 'break:ci-heal-system-fix-never-rearms',
      rounds: ROUNDS,
      daemons: ['fix-dispatch'],
      mainEvery: 0,
      scorecards: false,
      fleet: false,
      setup(w) {
        // The fake GitHub writes the merge commit IN the bare origin (`fake-gh.mjs#createMergeCommit`, `git
        // commit-tree`), and the world's fake HOME has no git identity — so give the origin GitHub's own merge
        // identity, or the round-2 `mergePr` fails "Author identity unknown" on a CI runner (no global git config)
        // and the scenario crashes before the merge ever lands (mirrors `couple-split-by-unrelated-merge.mjs`).
        execFileSync('git', ['config', 'user.name', 'GitHub'], { cwd: w.repos.we.originPath });
        execFileSync('git', ['config', 'user.email', 'noreply@github.com'], { cwd: w.repos.we.originPath });
        const victimHead = 'lane/soak-system-fix-victim';
        w.git.createBranch('we', victimHead, { from: 'main', files: { 'soak/system-fix-victim.txt': 'a change whose CI is red — the tooling, not this diff, is at fault\n' } });
        const victimPr = w.gh.openPr({
          repo: 'we', head: victimHead, base: 'main', title: 'soak: waiting-on-system-fix escalation, referenced fix still open',
          body: 'No backlog item for this one.',
        });
        w.gh.setChecks('we', victimPr, [{ name: 'test', conclusion: 'FAILURE' }]);

        const fixHead = 'lane/soak-system-fix-repair';
        w.git.createBranch('we', fixHead, { from: 'main', files: { 'soak/system-fix-repair.txt': 'the tooling/gate fix\n' } });
        const systemFixPr = w.gh.openPr({
          repo: 'we', head: fixHead, base: 'main', title: 'soak: the system-level fix the escalation is waiting on',
          body: 'No backlog item for this one.',
        });

        const victimHeadSha = w.gh.pr('we', victimPr)?.headRefOid;
        const escalation = buildCiHealEscalationComment({
          headSha: victimHeadSha, outcome: 'waiting-on-system-fix', systemFixRef: systemFixPr,
          reason: 'soak: tooling gate misbehaving the same way on more than one PR — the system fix is already open',
        });
        w.gh.comment('we', victimPr, escalation, { author: TRUSTED_AUTHOR });

        return { victimPr, systemFixPr, merged: false, countAtMerge: null, finalCount: null };
      },
      perRound(w, round, ctx, api) {
        const count = () => w.claude.sessions().filter((s) => sessionMatches(s.name, 'ci-heal', ctx.victimPr)).length;
        if (round === MERGE_ROUND) {
          ctx.countAtMerge = count();
          w.gh.mergePr('we', ctx.systemFixPr);
          ctx.merged = true;
          api.say(`r${String(round).padStart(2, '0')} system-fix PR #${ctx.systemFixPr} merged (victim PR #${ctx.victimPr} still 0 ci-heal sessions so far: ${ctx.countAtMerge})`);
        }
        ctx.finalCount = count();
        if (round === ROUNDS - 1) {
          api.say(`r${String(round).padStart(2, '0')} final: ${ctx.finalCount} ci-heal-${ctx.victimPr} session(s) total (merged at round ${MERGE_ROUND})`);
        }
      },
      log,
    });
  },
  judge(report) {
    const problems = [];
    const { victimPr, countAtMerge, finalCount, merged } = report.ctx ?? {};
    if (victimPr == null) return ['scenario setup problem: no victim PR recorded in ctx — scenario setup failed'];
    if (!merged) return [`scenario setup problem: the system-fix PR was never merged (round ${MERGE_ROUND} never ran) — re-check ROUNDS`];
    // Sanity — the escalation must hold BEFORE the fix lands (both RED and GREEN trees agree on this half; a
    // failure here means the scenario's own escalation setup is broken, not the card's own bug).
    if (countAtMerge > 0) {
      problems.push(`scenario setup problem: PR #${victimPr} already had ${countAtMerge} ci-heal session(s) dispatched BEFORE the system-fix PR merged — the escalation never held in the first place, so this run proves nothing about re-arming`);
    }
    // THE CARD: healing must re-arm once the referenced fix PR lands, on the SAME unchanged head.
    if ((finalCount ?? 0) <= (countAtMerge ?? 0)) {
      problems.push(`PR #${victimPr}: still 0 ci-heal sessions dispatched even ${ROUNDS - 1 - MERGE_ROUND} tick(s) after its waiting-on-system-fix escalation's referenced fix PR merged — the escalation is refusing FOREVER instead of re-arming (card #4263)`);
    }
    return problems;
  },
};
