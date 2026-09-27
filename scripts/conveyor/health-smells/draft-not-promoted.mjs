/**
 * draft-not-promoted — draft-first PRs (operator-approved 2026-09-27): a draft PR whose required checks have
 * ALL read green for over `greenForMs` with nothing having promoted it (`gh pr ready`). This is the safety
 * net for the exact failure mode a coordinator review caught the day this feature shipped: the promotion
 * effect (`scripts/operations/promote-draft-pr-dispatch.mjs`, reading `scripts/conveyor/reconcile-core.mjs`'s
 * `kind:'promote-draft'` plan) was originally wired ONLY into `skills-src/conveyor/runner.mjs` — the headless
 * conveyor runner, which had NO LIVE SINGLETON LEASE that day. It is now ALSO ridden on
 * `skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs`'s tick (the one daemon confirmed live), mirroring
 * that same file's own precedent for `hungCi`/`mainRedRebase`/`missingRun` (each rides that daemon for the
 * identical reason — see `runHungCiRecoveryAllRepos`'s own docblock). This smell is the belt-and-suspenders
 * check that doesn't trust either wiring: if BOTH stop ticking (or a THIRD regression reintroduces the gap),
 * a draft stuck green-but-unreviewed for a while surfaces here instead of sitting silently forever — the
 * exact silent-forever shape a draft-first PR risks by construction (nothing dispatches a review for a draft,
 * so nothing else would ever notice it is stuck).
 *
 * "Green" is read the same way `we:scripts/operations/pr-status.mjs#reduceCheckState` already defines it for
 * every other CI-truth consumer in this repo (pending outranks failure outranks success; an empty/unreadable
 * rollup is `unchecked`, never green) — reused, not re-derived. It does not have the TRUE required-check-name
 * set (that needs a live `we:scripts/lib/required-status-checks.mjs` read, and this `evaluate()` must stay
 * pure over its probed input, same discipline every other smell here holds itself to) — it applies
 * `reduceCheckState`'s own default `CI_TRUTH_EXCLUDED_CHECKS` exclusion instead, the identical simplification
 * `red-pr-unattended.mjs`'s own `ignoreChecks` config already makes for the same reason.
 */
import { MINUTE, fmtAge } from '../health-watch-core.mjs';
import { reduceCheckState } from '../../operations/pr-status.mjs';

export default {
  id: 'draft-not-promoted',
  scope: 'repo',
  cadence: 'gh',
  probes: ['prs'],
  openAfter: 1,
  closeAfter: 1,
  severity: 'high',
  action: 'investigate',
  greenForMs: 15 * MINUTE,
  recommendationHint: 'A draft PR has read all-green for a while with nothing promoting it — check the promote-draft-pr-dispatch pass is actually ticking.',
  evaluate({ prs }, { now }) {
    const out = [];
    for (const pr of prs || []) {
      if (!pr.isDraft) continue;
      const check = reduceCheckState(pr.statusCheckRollup);
      if (check.state !== 'green') continue;
      const times = (pr.statusCheckRollup || []).map((c) => Date.parse(c.completedAt || '')).filter(Number.isFinite);
      // The LATEST completed-at among the checks this read considers is the earliest moment the whole set was
      // provably green; falling back to `updatedAt` (or `now`, i.e. "just noticed, not breaching yet") when no
      // check carries a readable timestamp keeps this from fabricating a breach out of missing data.
      const since = times.length ? Math.max(...times) : (Date.parse(pr.updatedAt || '') || now);
      const greenFor = Math.max(0, now - since);
      const n = String(pr.number);
      out.push({
        subject: `${pr.repo}#${n}`,
        breach: greenFor >= this.greenForMs,
        measure: { greenForMin: Math.round(greenFor / MINUTE), title: String(pr.title || '').slice(0, 80) },
        summary: `${pr.repo}#${n} is a draft PR whose required checks have read green for ${fmtAge(greenFor)} with nothing promoting it.`,
        recommendation: `Draft ${pr.repo}#${n} should already have been promoted (\`gh pr ready\`) — check `
          + "`scripts/operations/promote-draft-pr-dispatch.mjs` is actually being ticked (reconcile-fix-dispatch-"
          + `daemon.mjs's runTickAllRepos, and/or the conveyor runner if it is back up), or promote it by hand: `
          + `gh pr ready ${n} --repo ${pr.repo}.`,
      });
    }
    return out;
  },
};
