/**
 * @file breaks/worker-push-during-fix-claim.mjs — live break, 2026-09-27 (the fix procedure, operator-approved).
 * A second author pushed to a PR's lane while the daemon fixer was mid-repair, and the PR ended up buried.
 *
 * LIVE INCIDENT: chalbert/web-everything PR #2811. The daemon fixer `fix-2811` was repairing the PR; an
 * orchestrator worker (not a daemon session) pushed two commits (`efaae6300`, `60f0f3d57`) to the SAME branch
 * `lane/run-rating-slice1-mechanical-grade`. Nothing refused the push. The fixer saved its repair on
 * `lane/run-rating-slice1-fix-2811-alt` and posted a TERMINAL stand-down with no label and the wrong reason, and
 * the reconcile planner then held #2811 `stood-down` forever.
 *
 * FIX — `we:scripts/conveyor/fix-procedure.mjs` (`fix-begin`/`fix-end`, the per-PR fix claim) wired into the
 * planner (`fix-claimed`), the dispatchers, the status tagger, and the push paths (`pr-land.mjs`, the
 * `fix-procedure.mjs push` helper, `guard-bash.mjs`).
 *
 * SCENARIO (review + fix-dispatch daemons, no default fleet): ONE PR bounced `review:changes`, CI green. The
 * fixer runs the REAL `fix-begin` CLI from the daemon clone (PR → draft, `review-status:fixing`, claim held).
 *   round 1 — a worker (different session) pushes to the PR's branch through the push helper → must be REFUSED;
 *   round 2 — while the claim is held, no review/fix is dispatched, the draft is not promoted, and the
 *             `fixing` label survives the status tagger; then the fixer pushes (allowed), re-arms, runs `fix-end`;
 *   later   — the fix daemon promotes the green draft and the review daemon re-reviews it.
 *
 * RED  = the worker's push lands (pre-fix there is no claim to refuse it), or the PR is never promoted/re-reviewed.
 * GREEN = push refused; fixer finishes; PR promoted and re-reviewed.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { CONSTELLATION_REPOS } from '../../../lib/constellation-repos.mjs';
import { readStoreSnapshot } from '../../../operations/__tests__/helpers/fake-claude-shim.mjs';
import { runSoak } from '../soak.mjs';

const ROUNDS = 8;
const WE_SLUG = CONSTELLATION_REPOS.we.slug;
const HEAD = 'lane/soak-fix-claim';
const FIXER = 'fix-soak-claim';
const FIXER_SESSION = 'soak-fixer-session';
const WORKER_SESSION = 'soak-worker-session';
const INVARIANT = 'fix-procedure';
const PROMOTE_BY_ROUND = 5;
const REVIEW_BY_ROUND = 7;

const TOOL = (w) => join(w.simCloneRoot, 'scripts', 'conveyor', 'fix-procedure.mjs');

function toolEnv(w, over = {}) {
  const env = { ...w.env, ...over };
  delete env.CLAUDE_CODE_SESSION_ID;
  delete env.WE_FIX_WHO;
  return { ...env, ...over };
}

function labelNames(w, pr) {
  return (w.gh.pr('we', pr)?.labels ?? []).map((l) => (typeof l === 'string' ? l : l?.name));
}

/** Clone the fake origin, commit one file on top of the PR head, run `push(work)`; returns its spawn result. */
function withCommitOnHead(w, file, push) {
  const work = mkdtempSync(join(tmpdir(), 'soak-fix-claim-'));
  try {
    const g = (args) => execFileSync('git', args, { cwd: work, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
    execFileSync('git', ['clone', '--quiet', '--branch', HEAD, w.repos.we.originPath, work], { stdio: 'ignore' });
    g(['config', 'user.email', 'sim@example.com']); g(['config', 'user.name', 'Sim World']); g(['config', 'commit.gpgsign', 'false']);
    writeFileSync(join(work, file), `${file}\n`, 'utf8');
    g(['add', file]); g(['commit', '-q', '-m', `soak: ${file}`]);
    return push(work);
  } finally { rmSync(work, { recursive: true, force: true }); }
}

function sessionsFor(w, pr) {
  const store = readStoreSnapshot(w.claude.env.FAKE_CLAUDE_STORE);
  return (store.sessions ?? []).filter((s) => [`review-${pr}`, `fix-${pr}`, `ci-heal-${pr}`].includes(String(s.name ?? '')));
}

export default {
  id: 'worker-push-during-fix-claim',
  title: 'a worker pushes to a PR branch while the daemon fixer is mid-repair — nothing refuses it and the PR is buried stood-down',
  card: 'fix procedure (operator-approved 2026-09-27) — live incident PR #2811',
  fixedBy: {
    sha: 'acbb07c6b',
    where: 'lane/fix-procedure',
    paths: ['scripts/conveyor/fix-procedure.mjs', 'scripts/conveyor/fix-claim-store.mjs', 'scripts/conveyor/stand-down.mjs', 'scripts/pr-land.mjs', 'scripts/guard-bash.mjs', 'scripts/conveyor/reconcile-core.mjs', 'scripts/conveyor/review-status-tag.mjs', 'scripts/conveyor/fix-dispatch-claim.mjs', 'scripts/conveyor/reconcile-pass.mjs', 'scripts/conveyor/reconcile-fix-dispatch.mjs', 'scripts/operations/ci-heal-pr-dispatch.mjs'],
  },
  fixPresent(root) {
    return existsSync(join(root, 'scripts', 'conveyor', 'fix-procedure.mjs'));
  },
  run({ log } = {}) {
    return runSoak({
      name: 'break:worker-push-during-fix-claim',
      rounds: ROUNDS,
      daemons: ['review', 'fix-dispatch'],
      mainEvery: 0,
      scorecards: false,
      fleet: false,
      setup(w) {
        w.git.createBranch('we', HEAD, { from: 'main', files: { 'soak/fix-claim.txt': 'a PR bounced for changes\n' } });
        const pr = w.gh.openPr({ repo: 'we', head: HEAD, base: 'main', title: 'soak: fix claim vs a concurrent worker push', labels: [], body: 'No backlog item.' });
        for (const name of ['review:changes', 'review:pending']) {
          execFileSync('gh', ['label', 'create', name, '--repo', WE_SLUG, '--force'], { env: w.env, stdio: 'ignore' });
        }
        w.gh.addLabels('we', pr, ['review:changes']);
        w.gh.comment('we', pr, '🔁 review — changes requested\n\nthe soak finding: handle the empty case');
        w.gh.setChecks('we', pr, [{ name: 'test', status: 'COMPLETED', conclusion: 'SUCCESS' }]);
        const ctx = { pr, begun: false, workerRefused: null, finished: false, promotedAt: null, reviewedAt: null, reported: new Set() };
        if (existsSync(TOOL(w))) {
          const r = spawnSync(process.execPath, [TOOL(w), 'fix-begin', String(pr), `--repo=${WE_SLUG}`, `--who=${FIXER}`, '--why=soak: address review'], {
            cwd: w.simCloneRoot, env: toolEnv(w, { CLAUDE_CODE_SESSION_ID: FIXER_SESSION }), encoding: 'utf8',
          });
          ctx.begun = r.status === 0;
          ctx.beginOut = `${r.stdout ?? ''}${r.stderr ?? ''}`.trim();
        }
        return ctx;
      },
      perRound(w, round, ctx, api) {
        const flag = (key, detail) => { if (!ctx.reported.has(key)) { ctx.reported.add(key); api.violation(INVARIANT, detail); } };
        const view = w.gh.pr('we', ctx.pr);
        const labels = labelNames(w, ctx.pr);
        api.say(`r${String(round).padStart(2, '0')} PR #${ctx.pr}: draft=${view?.isDraft} labels=${labels.join(',')} sessions=${sessionsFor(w, ctx.pr).map((s) => s.name).join(',') || '-'}`);

        if (round === 1) {
          if (!ctx.begun) flag('begin', `fix-begin did not take the claim: ${ctx.beginOut ?? 'fix-procedure.mjs absent'}`);
          else if (view?.isDraft !== true) flag('draft', `fix-begin held the claim but PR #${ctx.pr} is not a draft`);
          const before = w.git.headOf('we', HEAD);
          const res = withCommitOnHead(w, 'soak/worker.txt', (work) => (existsSync(TOOL(w))
            ? spawnSync(process.execPath, [TOOL(w), 'push', `--branch=${HEAD}`, '--repo=we'], { cwd: work, env: toolEnv(w, { CLAUDE_CODE_SESSION_ID: WORKER_SESSION }), encoding: 'utf8' })
            // pre-fix there is no push check at all: the worker's push is a plain `git push`.
            : spawnSync('git', ['push', 'origin', `HEAD:${HEAD}`], { cwd: work, encoding: 'utf8' })));
          const after = w.git.headOf('we', HEAD);
          ctx.workerRefused = res.status !== 0 && after === before;
          api.say(`r01 worker push → exit ${res.status}${ctx.workerRefused ? ' (refused)' : ' (LANDED)'}`);
          if (!ctx.workerRefused) flag('worker-push', `a worker's push to ${HEAD} landed while ${FIXER} held the fix claim on PR #${ctx.pr}`);
        }

        if (round === 2 && ctx.begun) {
          if (sessionsFor(w, ctx.pr).length) flag('dispatch-while-claimed', `a review/fix session was dispatched for PR #${ctx.pr} while the fix claim was held`);
          if (view?.isDraft !== true) flag('promoted-while-claimed', `PR #${ctx.pr} was promoted while the fix claim was held`);
          if (!labels.includes('review-status:fixing')) flag('fixing-label', `review-status:fixing was stripped from PR #${ctx.pr} while the claim was held`);
          // The fixer finishes: push (allowed — it holds the claim), re-arm, fix-end.
          const res = withCommitOnHead(w, 'soak/fix.txt', (work) => spawnSync(process.execPath, [TOOL(w), 'push', `--branch=${HEAD}`, '--repo=we'], {
            cwd: work, env: toolEnv(w, { CLAUDE_CODE_SESSION_ID: FIXER_SESSION }), encoding: 'utf8',
          }));
          if (res.status !== 0) flag('holder-push', `the claim holder's own push was refused: ${(res.stderr ?? '').trim()}`);
          w.gh.setChecks('we', ctx.pr, [{ name: 'test', status: 'COMPLETED', conclusion: 'SUCCESS' }]);
          w.gh.removeLabels('we', ctx.pr, ['review:changes']);
          w.gh.addLabels('we', ctx.pr, ['review:pending']);
          const end = spawnSync(process.execPath, [TOOL(w), 'fix-end', String(ctx.pr), `--repo=${WE_SLUG}`, `--who=${FIXER}`], {
            cwd: w.simCloneRoot, env: toolEnv(w, { CLAUDE_CODE_SESSION_ID: FIXER_SESSION }), encoding: 'utf8',
          });
          ctx.finished = end.status === 0;
          if (!ctx.finished) flag('fix-end', `fix-end failed: ${`${end.stdout ?? ''}${end.stderr ?? ''}`.trim()}`);
          else if (w.gh.pr('we', ctx.pr)?.isDraft !== true) flag('end-undrafted', 'fix-end must leave the PR draft for the promotion to mark ready');
        }

        if (round > 2 && ctx.finished) {
          if (ctx.promotedAt === null && view?.isDraft === false) ctx.promotedAt = round;
          if (ctx.reviewedAt === null && sessionsFor(w, ctx.pr).some((s) => String(s.name).startsWith('review-'))) ctx.reviewedAt = round;
          if (round >= PROMOTE_BY_ROUND && ctx.promotedAt === null) flag('not-promoted', `PR #${ctx.pr} was not promoted by round ${round} after fix-end on green CI`);
          if (round >= REVIEW_BY_ROUND && ctx.reviewedAt === null) flag('not-reviewed', `PR #${ctx.pr} was not re-reviewed by round ${round} after its promotion`);
        }
      },
      log,
    });
  },
  judge(report) {
    return report.violations
      .filter((v) => v.invariant === INVARIANT || v.invariant === 'crash' || v.invariant === 'isolation')
      .map((v) => `${v.daemon ?? '-'} tick ${v.tick ?? '-'}: [${v.invariant}] ${v.detail}`);
  },
};
