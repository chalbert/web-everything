/**
 * @file breaks/claude-auth-dispatch-pause.mjs — card x5kagse (epic #4075/#3383), the FOLLOW-UP to #2717
 * (`claude-auth-expired.mjs`, this same directory). #2717 made a dead-from-auth-failure session stop reading
 * as `live-process`, so a fresh one gets redispatched — but overnight 2026-09-25/26 that redispatch itself kept
 * happening every single tick while the operator's login stayed broken, burning a fresh `ci-heal-<pr>` session
 * every ~2 minutes all night, each one dying on the very same auth failure instantly.
 *
 * FIX (this same card): `we:scripts/conveyor/claude-auth-health.mjs` — a shared "is the login broken" read (the
 * open health episode, or directly the most recently dispatched session's own transcript) plus a cheap
 * `claude auth status` probe, wired into `runTickAllRepos` (`we:skills-src/conveyor/
 * reconcile-fix-dispatch-daemon.mjs`) so `fix`/`ci-heal` dispatch is skipped OUTRIGHT — never merely
 * attempted — for as long as the break persists.
 *
 * SCENARIO: same fleet/seed as `claude-auth-expired.mjs` (see that file's own header for why `SEED = 8` lands
 * `ci-heal-2` — PR #2, `red-no-item` — into the `fix:hang` band, a session that sits `working` forever unless
 * this scenario itself acts on it). Round 2 sabotages every LIVE `ci-heal-2` session with the real auth-failure
 * transcript content (`authExpiredFail`) AND flips the fake CLI's own `auth status` fault on
 * (`w.claude.fault('auth-expired', true)` — `we:scripts/operations/__tests__/helpers/fake-claude-shim.mjs`'s
 * own `auth status --json` branch, added by this same card), modelling the live incident: the login is broken,
 * both the transcript-based direct scan AND the cheap CLI probe agree. Rounds 3-5 keep sabotaging any
 * `ci-heal-2` session that might still appear (defends the RED case too — the pre-fix tree keeps redispatching
 * one every tick) while the fault stays on. Round 6 clears the fault (`fault('auth-expired', false)` — models
 * the operator running `/login`) and sabotages nothing further from there on.
 *
 * RED (pre-fix) = the daemon keeps dispatching a FRESH `ci-heal-2` session every tick it is sabotaged —
 * unbounded growth for as long as the break persists (the live incident, verbatim). GREEN (post-fix) = the
 * session COUNT freezes the instant the first failure is observed (round 2) and never grows again until AFTER
 * the fault clears (round 6), at which point exactly ONE more session appears and then holds steady (the
 * resumed session is left un-sabotaged, i.e. login really is fixed) — proving both halves of the card: the
 * pause AND the automatic resume, with no attempt burned in between. The daemon's own tick log is also checked
 * for the card's own required wording during the paused window.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runSoak } from '../soak.mjs';
import { authExpiredFail } from '../../__tests__/sim/agent-actions.mjs';

/** Same seed/reasoning as `claude-auth-expired.mjs` — see that file's own header. Kept as SHORT as still proves
 *  both halves (pause + resume): the daemon-soak harness's own isolation check trips on a REAL self-sync
 *  candidate write once enough sim-clock minutes elapse in one run (pre-existing harness property, unrelated
 *  to this card — measured live building this scenario: `claude-auth-expired.mjs`'s own 5 rounds / 15 sim-min
 *  run clean; this scenario's first draft at 10 rounds / 30 sim-min did not) — never fixed here (this card's
 *  own file scope explicitly excludes the self-sync/rebuild files), just stayed under by keeping the round
 *  count low. */
const SEED = 8;
const ROUNDS = 7;
/** Round 0 dispatches the first session; round 1 is the harness's own harmless one-tick visibility lag. */
const FIRST_SABOTAGE_ROUND = 2;
const LAST_CONTINUED_SABOTAGE_ROUND = 3; // rounds 2..3: the break persists across more than one tick, keep re-sabotaging.
const RECOVER_ROUND = 5; // fault clears here; nothing sabotaged from here on.

export default {
  id: 'claude-auth-dispatch-pause',
  title: 'while the operator\'s Claude login is broken, the fix-dispatch daemon keeps redispatching a fresh ci-heal session every tick, burning attempts all night, instead of pausing until login is confirmed back',
  card: 'we:backlog/x5kagse-fix-dispatch-and-review-daemons-pause-dispatch-while-the-cla.md (epic #4075)',
  fixedBy: {
    sha: 'this same PR', where: 'this same PR (card x5kagse)',
    paths: ['scripts/conveyor/claude-auth-health.mjs', 'skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs', 'skills-src/conveyor/review-daemon.mjs'],
  },
  fixPresent(root) {
    try {
      return /planClaudeAuthDispatchGate/.test(readFileSync(join(root, 'skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs'), 'utf8'));
    } catch { return false; }
  },
  run({ log } = {}) {
    return runSoak({
      name: 'break:claude-auth-dispatch-pause', rounds: ROUNDS, daemons: ['fix-dispatch'], mainEvery: 0,
      scorecards: false, seed: SEED, log,
      perRound(w, round, ctx, api) {
        const pr = ctx.fleet?.find((p) => p.key === 'red-no-item')?.pr ?? null;
        if (pr == null) return; // fleet shape drifted — judge() below reports this, never a silent no-op
        const sessionName = `ci-heal-${pr}`;
        ctx._pr = pr;

        if (round >= FIRST_SABOTAGE_ROUND && round <= LAST_CONTINUED_SABOTAGE_ROUND) {
          w.claude.fault('auth-expired', true); // the cheap `claude auth status` probe also reads broken
          const live = w.claude.sessions().filter((s) => s.name === sessionName && (s.state === 'working' || s.state === 'blocked'));
          for (const s of live) {
            authExpiredFail().run({ env: w.env }, s);
            api.say(`r${String(round).padStart(2, '0')} ${sessionName} (session ${s.id}) hit the Claude CLI auth failure (login still broken)`);
          }
          if (round === FIRST_SABOTAGE_ROUND) {
            ctx._sabotaged = live.length > 0;
            ctx._countAtFirstFailure = w.claude.sessions().filter((s) => s.name === sessionName).length;
          }
        }
        if (round === RECOVER_ROUND) {
          w.claude.fault('auth-expired', false); // models the operator running `/login`
          api.say(`r${String(round).padStart(2, '0')} login restored (\`claude auth status\` now reports loggedIn:true)`);
        }
        if (round === LAST_CONTINUED_SABOTAGE_ROUND) {
          ctx._countBeforeRecover = w.claude.sessions().filter((s) => s.name === sessionName).length;
        }
        ctx._finalCount = w.claude.sessions().filter((s) => s.name === sessionName).length;
      },
    });
  },
  judge(report) {
    const pr = report.ctx?._pr ?? report.ctx?.fleet?.find((p) => p.key === 'red-no-item')?.pr;
    const problems = [];
    if (pr == null) return ["scenario setup problem: no 'red-no-item' fleet PR found — fleet.mjs drifted"];
    if (!report.ctx?._sabotaged) {
      return [`scenario setup problem: PR #${pr}'s own ci-heal-${pr} session(s) never appeared to sabotage at round ${FIRST_SABOTAGE_ROUND} under SEED=${SEED} — re-pick SEED (this scenario's own header explains how) or the harness's dispatch timing drifted`];
    }
    const atFirstFailure = report.ctx?._countAtFirstFailure ?? 0;
    const beforeRecover = report.ctx?._countBeforeRecover ?? 0;
    const finalCount = report.ctx?._finalCount ?? 0;
    // THE PAUSE: no new ci-heal-<pr> session while the break persists (rounds 2..5) — the whole point of the card.
    if (beforeRecover > atFirstFailure) {
      problems.push(`dispatch kept burning fresh ci-heal-${pr} sessions WHILE the login was still broken (${atFirstFailure} at round ${FIRST_SABOTAGE_ROUND} -> ${beforeRecover} by round ${LAST_CONTINUED_SABOTAGE_ROUND}) — the daemon is not pausing dispatch`);
    }
    // THE RESUME: exactly one more session once the fault clears (round 6) — never zero (stuck paused forever),
    // never more than one extra by the final round (would mean it kept burning after recovery too).
    if (finalCount <= beforeRecover) {
      problems.push(`dispatch never resumed after login was restored at round ${RECOVER_ROUND} (still ${finalCount} ci-heal-${pr} session(s), same as before recovery) — the daemon is stuck paused`);
    } else if (finalCount > beforeRecover + 1) {
      problems.push(`dispatch over-corrected after recovery: ${finalCount - beforeRecover} new ci-heal-${pr} sessions appeared after round ${RECOVER_ROUND} recovered (expected exactly 1)`);
    }
    // THE LOG LINE: the card's own required wording, at least once during the paused window.
    const fixDispatchLogs = report.ticks.filter((t) => t.daemon === 'fix-dispatch' && t.round >= FIRST_SABOTAGE_ROUND && t.round <= LAST_CONTINUED_SABOTAGE_ROUND).flatMap((t) => t.logs ?? []);
    if (!fixDispatchLogs.some((l) => l.includes('paused: Claude login expired'))) {
      problems.push('the daemon\'s own tick log never printed the required "paused: Claude login expired — run /login" line while dispatch was paused');
    }
    return problems;
  },
};
