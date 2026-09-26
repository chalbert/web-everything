/**
 * @file breaks/claude-auth-false-positive.mjs — the false-positive twin of `claude-auth-expired.mjs` (PR #2717
 * review, card we:backlog/xbsmmwu). The first cut of `we:scripts/conveyor/hung-session.mjs
 * #classifyClaudeAuthExpired` matched free text (`401 … Unauthorized`, `authentication_failed`, the CLI's own
 * login phrase) in ANY newest assistant turn. A healthy session working this repo's own GitHub-auth code writes
 * exactly that prose — and the axis fires instantly, so `reconcile-core.mjs#assessLiveness` dropped the live
 * session and the daemon dispatched a DUPLICATE worker onto its PR.
 *
 * FIX: the detector now requires the CLI's own synthetic API-error provenance (`isApiErrorMessage: true`, which
 * a model can never author) before any text or error code counts.
 *
 * SCENARIO: the same world, seed and timing as `claude-auth-expired.mjs` (see its header for why round 2 and why
 * two sessions are the steady state) — but at round 2 every live `ci-heal-<pr>` session gets an ordinary
 * assistant turn DISCUSSING auth errors (`sim/agent-actions.mjs#authDiscussionTurn`) instead of the real
 * failure. RED (pre-fix) = reconcile reads those healthy sessions as auth-expired and dispatches a third
 * `ci-heal-<pr>`. GREEN = the count holds at the steady-state two.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runSoak } from '../soak.mjs';
import { authDiscussionTurn } from '../../__tests__/sim/agent-actions.mjs';

/** Same seed as `claude-auth-expired.mjs` — lands `ci-heal-2` in the `fix:hang` band (a session that stays
 *  `working` forever), so the only variable is what its transcript says. */
const SEED = 8;
const ROUNDS = 5;
const SABOTAGE_AT_ROUND = 2;
/** Round 0's dispatch plus round 1's harmless harness-lag extra (see `claude-auth-expired.mjs`). */
const STEADY_STATE_SESSIONS = 2;

export default {
  id: 'claude-auth-false-positive',
  title: 'a healthy ci-heal session narrating a 401 / quoting the login-expired phrase is read as auth-expired; the daemon dispatches a duplicate',
  card: 'we:backlog/xbsmmwu-claude-auth-expired-session-detection-reaper-reconcile-liven.md (PR #2717 review)',
  fixedBy: {
    sha: 'this same PR', where: 'this same PR (card we:backlog/xbsmmwu)',
    paths: ['scripts/conveyor/hung-session.mjs'],
  },
  fixPresent(root) {
    try {
      return /isApiErrorMessage === true/.test(readFileSync(join(root, 'scripts/conveyor/hung-session.mjs'), 'utf8'));
    } catch { return false; }
  },
  run({ log } = {}) {
    return runSoak({
      name: 'break:claude-auth-false-positive', rounds: ROUNDS, daemons: ['fix-dispatch'], mainEvery: 0,
      scorecards: false, seed: SEED, log,
      perRound(w, round, ctx, api) {
        const pr = ctx.fleet?.find((p) => p.key === 'red-no-item')?.pr ?? null;
        if (pr == null) return; // fleet shape drifted — judge() reports it
        const sessionName = `ci-heal-${pr}`;
        if (round === SABOTAGE_AT_ROUND && !ctx._touched) {
          const live = w.claude.sessions().filter((s) => s.name === sessionName && (s.state === 'working' || s.state === 'blocked'));
          for (const s of live) {
            authDiscussionTurn().run({ env: w.env }, s);
            api.say(`r${String(round).padStart(2, '0')} ${sessionName} (session ${s.id}) wrote an ordinary turn discussing a 401 — still healthy and working`);
          }
          ctx._touched = live.length > 0;
        }
        ctx._finalCiHealCount = w.claude.sessions().filter((s) => s.name === sessionName).length;
        ctx._pr = pr;
      },
    });
  },
  judge(report) {
    const pr = report.ctx?._pr ?? report.ctx?.fleet?.find((p) => p.key === 'red-no-item')?.pr;
    if (pr == null) return ["scenario setup problem: no 'red-no-item' fleet PR found — fleet.mjs drifted"];
    if (!report.ctx?._touched) {
      return [`scenario setup problem: PR #${pr}'s own ci-heal-${pr} session(s) never appeared at round ${SABOTAGE_AT_ROUND} under SEED=${SEED} — re-pick SEED (see claude-auth-expired.mjs) or the harness's dispatch timing drifted`];
    }
    const count = report.ctx?._finalCiHealCount ?? 0;
    if (count <= STEADY_STATE_SESSIONS) return [];
    return [`PR #${pr} got ${count} ci-heal-${pr} sessions (steady state is ${STEADY_STATE_SESSIONS}) after a HEALTHY one merely discussed a 401 — hung-session.mjs#classifyClaudeAuthExpired is matching model prose, not the CLI's own API-error turn`];
  },
};
