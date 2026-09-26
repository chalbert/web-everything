/**
 * @file breaks/couple-split-by-unrelated-merge.mjs — live break, 2026-09-26 (drain pass 20:32:20Z; fix PR #2763).
 *
 * LIVE INCIDENT. The drain (`we:scripts/merge-ai-prs.mjs`) considered three merge-ready PRs in one pass:
 * plateau-app#185 (the IMPL half of a cross-repo couple), web-everything#2751 (#185's WE CARRIER — its PR-body
 * lane manifest names both repos on the same lane ref) and web-everything#2746 (unrelated). The plan-time couple
 * gate (`joinImplToCouples`, R7) saw both halves `merge`, so it cleared the impl. `planLabelDrain` then orders
 * hash items by PR NUMBER ACROSS REPOS, so the cascade ran pa#185 → we#2746 → we#2751: #185 merged, #2746 merged
 * and moved WE `main`, and #2751's fresh pre-merge re-read now saw it BEHIND and refused it. The impl half was on
 * plateau-app `main`, its carrier was not — a couple SPLIT. (Second, latent hole: the plan-time `coupleImplOpen`
 * skips a sibling ref equal to the carrier's own, and couple halves share one lane ref name across repos.)
 *
 * FIX: 86b922437 (PR #2763, `fix(drain): a cross-repo couple lands whole in one pass or not at all`) — new
 * `we:scripts/lib/couple-cascade.mjs`, wired into the cascade in `we:scripts/merge-ai-prs.mjs`: HOLD a couple
 * member whose partner is not landing this pass; ORDER each couple contiguously (impl halves, then the carrier
 * immediately) so no other merge can move `main` between them; PRE-FLIGHT the carrier fresh right before its impl
 * merges; a repo-aware (`manifestRepoRefs`) sibling check; `coupleHeld`/`coupleSplit` in the JSON result.
 *
 * SCENARIO: the real `drain` pass daemon (`sim/daemon-host.mjs#PASS_DAEMONS` — the real
 * `scripts/merge-ai-prs.mjs --label=ready-to-merge` CLI spawned once per tick, i.e. one pass of the resident
 * `/drain` watch; the bare `merge-sweep` runs no label reconcile, so its open-PR context is never complete and
 * every couple defers `incomplete-context` — it cannot reach this break) against the fake GitHub, no default
 * fleet. Three merge-ready PRs (every commit Claude-co-authored, `test` green, `ready-to-merge` +
 * `review:accepted` with a trusted `reviewed-sha` marker for the head), numbered so the cross-repo PR-number
 * order reproduces the live one:
 *   - plateau-app#1  impl half, head `lane/xcpl001-couple` (no manifest);
 *   - web-everything#2  unrelated, touches its own file;
 *   - web-everything#3  the carrier, head `lane/xcpl001-couple` (SAME ref name), PR-body manifest naming
 *     `plateau-app` + `we` on that ref.
 * (web-everything#1 is a closed placeholder that only burns the number.) The fake GitHub computes
 * `mergeStateStatus` BEHIND whenever `main` has commits the head lacks (`fake-gh.mjs#computeMergeStatus`), so
 * #2's merge genuinely makes #3 BEHIND — the up-to-date rule the live pass hit. One pass runs; at the start of
 * the next round (before the second pass) the hook reads the fake GitHub.
 *
 * RED = after the pass, plateau-app#1 (impl) is MERGED while web-everything#3 (its carrier) is still OPEN — the
 * couple split (pre-fix: #1 → #2 → #3, #3 refused BEHIND). GREEN = the couple landed whole (#1 → #3 contiguously,
 * #2 then reads BEHIND and waits) or not at all.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { runSoak } from '../soak.mjs';

const REF = 'lane/xcpl001-couple';
const LABELS = ['ready-to-merge', 'review:accepted'];
const TRAILER = 'Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>';
const MANIFEST_BEGIN = '<!-- lane-manifest:begin -->';
const MANIFEST_END = '<!-- lane-manifest:end -->';

/** Open a merge-ready PR: `ready-to-merge` + `review:accepted`, with the automation-authored `reviewed-sha`
 *  marker the drain's accept-covers-head gate (`review-escalation.mjs#acceptanceCoversHead`) needs for its head. */
function openReadyPr(w, repo, head, sha, { title, body }) {
  const n = w.gh.openPr({ repo, head, title, body, labels: LABELS });
  w.gh.comment(repo, n, `review:accepted\n\n<!-- reviewed-sha: ${sha} -->`);
  return n;
}

/** Push a branch off `main` of `originPath` carrying ONE commit with the Claude co-author trailer (the drain's
 *  AI-authorship gate reads it off the commit body). `world.git.createBranch` commits without a trailer. */
function pushAiBranch(originPath, branch, files) {
  const work = mkdtempSync(join(tmpdir(), 'soak-couple-'));
  const g = (args) => execFileSync('git', args, { cwd: work, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
  try {
    execFileSync('git', ['clone', '--quiet', originPath, work], { stdio: ['ignore', 'pipe', 'pipe'] });
    g(['checkout', '-q', '-b', branch, 'origin/main']);
    for (const [name, content] of Object.entries(files)) {
      mkdirSync(dirname(join(work, name)), { recursive: true });
      writeFileSync(join(work, name), content, 'utf8');
    }
    g(['add', '-A']);
    g(['-c', 'user.email=agent@example.com', '-c', 'user.name=Lane Agent', '-c', 'commit.gpgsign=false',
      'commit', '-q', '-m', `feat: ${branch}\n\n${TRAILER}`]);
    g(['push', '-q', 'origin', `HEAD:${branch}`]);
    return g(['rev-parse', 'HEAD']).trim();
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

function manifestBody(m) {
  return `A cross-repo couple's WE carrier.\n\n${MANIFEST_BEGIN}\n\`\`\`json\n${JSON.stringify(m, null, 2)}\n\`\`\`\n${MANIFEST_END}\n`;
}

/** Seed the three live-shaped PRs (see header) into world `w`; returns their numbers. */
export function seedCouple(w) {
  const we = w.repos.we.originPath;
  const pa = w.repos['plateau-app'].originPath;
  // The fake GitHub writes the merge commit IN the bare origin (`fake-gh.mjs#createMergeCommit`, `git commit-tree`),
  // and the world's fake HOME has no git identity — so give the origins GitHub's own merge identity, or every
  // `gh pr merge` fails "Author identity unknown" and nothing ever lands.
  for (const origin of [we, pa]) {
    execFileSync('git', ['config', 'user.name', 'GitHub'], { cwd: origin });
    execFileSync('git', ['config', 'user.email', 'noreply@github.com'], { cwd: origin });
  }
  // web-everything#1 — a closed placeholder that only burns the number, so the cross-repo PR-number order
  // is impl (pa#1) → unrelated (we#2) → carrier (we#3), exactly the live #185 → #2746 → #2751 shape.
  pushAiBranch(we, 'lane/xburn01-placeholder', { 'soak/couple/placeholder.md': '# placeholder\n' });
  const burn = w.gh.openPr({ repo: 'we', head: 'lane/xburn01-placeholder', title: 'placeholder' });
  w.gh.closePr('we', burn);

  const implSha = pushAiBranch(pa, REF, { 'tools/couple-impl.mjs': 'export const IMPL = 1;\n' });
  const impl = openReadyPr(w, 'plateau-app', REF, implSha, { title: 'impl half', body: 'the impl half' });

  const unrelatedSha = pushAiBranch(we, 'lane/xunrel1-unrelated', { 'soak/couple/unrelated.md': '# unrelated\n' });
  const unrelated = openReadyPr(w, 'we', 'lane/xunrel1-unrelated', unrelatedSha, { title: 'unrelated', body: 'unrelated work' });

  const carrierSha = pushAiBranch(we, REF, { 'soak/couple/carrier.md': '# carrier\n' });
  const carrier = openReadyPr(w, 'we', REF, carrierSha, {
    title: 'WE carrier',
    body: manifestBody({
      item: 'xcpl001',
      repos: [{ repo: 'plateau-app', ref: REF, carriesResolve: false }, { repo: 'we', ref: REF, carriesResolve: true }],
      blockedBy: [], stackParents: [], mergeRiskFiles: [], dismissedFindings: 0,
    }),
  });
  return { impl, unrelated, carrier }; // `openPr` returns the PR number
}

export default {
  id: 'couple-split-by-unrelated-merge',
  title: "drain lands a couple's impl half, then an unrelated WE merge makes its carrier BEHIND — the couple splits",
  card: 'PR #2763 (fix-couple-split; live drain pass 2026-09-26T20:32:20Z, plateau-app#185 / web-everything#2751)',
  fixedBy: { sha: '86b922437', where: 'main', paths: ['scripts/lib/couple-cascade.mjs', 'scripts/merge-ai-prs.mjs'] },
  fixPresent(root) {
    try {
      // The fix wires the new couple gate into the live cascade: `planCoupleCascadeStep(plan.ready, …)`.
      return /planCoupleCascadeStep\(plan\.ready/.test(readFileSync(join(root, 'scripts/merge-ai-prs.mjs'), 'utf8'));
    } catch { return false; }
  },
  run({ log } = {}) {
    return runSoak({
      name: 'break:couple-split-by-unrelated-merge',
      rounds: 2, // round 0 = the pass; round 1's hook reads the outcome BEFORE the second pass runs
      daemons: ['drain'], // one real `/drain` pass per tick (`merge-ai-prs.mjs --label=ready-to-merge`)
      mainEvery: 0,
      fleet: false,
      scorecards: false,
      setup: seedCouple,
      perRound(w, round, ctx, api) {
        if (round !== 1) return;
        const state = (repo, n) => w.gh.pr(repo, n)?.state;
        ctx.outcome = {
          impl: state('plateau-app', ctx.impl), unrelated: state('we', ctx.unrelated), carrier: state('we', ctx.carrier),
        };
        api.say(`r01 after pass 1: plateau-app#${ctx.impl} ${ctx.outcome.impl}, web-everything#${ctx.unrelated} ${ctx.outcome.unrelated}, web-everything#${ctx.carrier} ${ctx.outcome.carrier}`);
        if (ctx.outcome.impl === 'MERGED' && ctx.outcome.carrier !== 'MERGED') {
          api.violation('couple-split', `plateau-app#${ctx.impl} (impl half) MERGED while its WE carrier web-everything#${ctx.carrier} is ${ctx.outcome.carrier} (unrelated web-everything#${ctx.unrelated}: ${ctx.outcome.unrelated})`);
        }
      },
      log,
    });
  },
  judge(report) {
    const problems = report.violations
      .filter((v) => v.invariant === 'couple-split')
      .map((v) => `[${v.invariant}] ${v.detail}`);
    // A run that never reached the post-pass read proves nothing either way — never a false GREEN.
    const o = report.ctx?.outcome;
    if (!o) problems.push(`no post-pass outcome recorded${report.fatal ? ` (fatal: ${report.fatal})` : ''}`);
    // Nothing landing at all is not "held whole" — it means the drain never got past its gates (a harness gap),
    // so the scenario proved nothing. Post-fix the couple lands; pre-fix the impl + unrelated land.
    else if (![o.impl, o.unrelated, o.carrier].includes('MERGED')) problems.push(`vacuous: the drain pass landed nothing (${JSON.stringify(o)})`);
    return problems;
  },
};
