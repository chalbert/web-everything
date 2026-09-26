/**
 * @file breaks/claude-auth-expired.mjs — LIVE INCIDENT, night of 2026-09-25/26 ET (card we:backlog/xbsmmwu,
 * epic #4075). The operator's own Claude login expired; every daemon-dispatched session (`ci-heal-2711`/
 * `ci-heal-2712`, re-dispatched repeatedly until 06:53) ended IMMEDIATELY on the CLI's own auth failure and sat
 * `blocked`/`idle` for hours, pid still alive, never producing anything further. `reconcile-core.mjs
 * #assessLiveness` had no way to tell this apart from a session genuinely still working the PR, so it kept
 * reading it as `live-process` and refused every fresh dispatch — `reconcile-refused live-process … PR #2711` /
 * `#2712`, all night, even once the operator logged back in.
 *
 * FIX (this same card): `we:scripts/conveyor/reconcile-core.mjs#markAuthExpiredSessions` (new pre-pass, mirrors
 * `markHungSessions`) marks a session whose OWN transcript shows the Claude CLI's auth failure
 * (`we:scripts/conveyor/hung-session.mjs#readClaudeAuthExpiredInfo`); `assessLiveness`'s `isFinished` now
 * excludes `authExpired: true` rows the same way it already excludes `hung`/`selfReportedDone` ones — UNLIKE
 * the hung-transcript axis this needs no staleness window at all (the transcript's content, not its age, is
 * the whole signal), and unlike `markSelfReportedDone`'s cool-off it applies to EVERY kind, including
 * `ci-heal`, which carries no completion-record schema for that mechanism to ever reach.
 *
 * SCENARIO: the plain soak world's default fleet already seeds exactly the trigger population —
 * `red-no-item` (`we:scripts/conveyor/soak/fleet.mjs`, always PR #2): red CI, no backlog item, owed `ci-heal`.
 * MEASURED LIVE building this scenario: the fix-dispatch daemon's own `ci-heal-<pr>` binding has a one-tick
 * VISIBILITY LAG — a session dispatched on tick N is not yet correctly read as live on tick N+1 (a SEPARATE,
 * pre-existing harness property, unrelated to this card, that this scenario works around rather than "fixing";
 * it reproduces on both the pre-fix and post-fix tree identically, so it is never mistaken for this card's own
 * bug). Left alone, that lag alone causes ONE harmless extra `ci-heal-<pr>` dispatch at round 1, regardless of
 * this fix — this scenario lets that happen, then sabotages EVERY live `ci-heal-<pr>` session that exists by
 * round 2 (by which tick the daemon's own binding has caught up and correctly reads them as live — confirmed
 * live: an UNsabotaged run holds at exactly 2 such sessions forever from round 2 on), so the ONLY variable
 * left is this card's own fix.
 *
 * `SEED` is chosen (see its own doc) so the FIRST `ci-heal-<pr>` session rolls, under `behaviours.mjs
 * #planFor`'s existing random mix, into the pre-existing `fix:hang` plan — a session that sits
 * `state:'working'`, pid alive, and NEVER completes on its own. That already models the live incident's own
 * "sat blocked/idle … never stopped" shape with zero new sim machinery; this scenario adds the ONE thing
 * `fix:hang` alone does not: the real Claude-auth-failure TEXT actually landing in the transcript
 * (`we:scripts/conveyor/__tests__/sim/agent-actions.mjs#authExpiredFail`, appended directly — never
 * `touchTranscript`, since real content, not a bare mtime bump, is what the shared detector reads).
 *
 * RED (pre-fix) = every `ci-heal-<pr>` session, however many, keeps reading as `live-process` forever once its
 * transcript carries the auth failure → the daemon never dispatches a THIRD one. GREEN (post-fix) =
 * `assessLiveness` excludes every auth-expired row the very next fix-dispatch tick, and a fresh `ci-heal-<pr>`
 * session IS dispatched (the durable heal-mark comment count stays at 3 of `CI_HEAL_ROUND_CAP` (3) at that
 * point, so nothing else blocks it).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runSoak } from '../soak.mjs';
import { authExpiredFail } from '../../__tests__/sim/agent-actions.mjs';

/**
 * Chosen OFFLINE against `behaviours.mjs`'s own `seededRandom(seed ^ hashName(name))` for `name: 'ci-heal-2'`
 * (PR #2 is `red-no-item`'s fixed number — `fleet.mjs#seedDefaultFleet` opens it 2nd, and `fake-gh.mjs`'s PR
 * counter always starts at 1, so this is deterministic, not a guess): under `seed=8` the roll lands at
 * r≈0.1975, inside `planFor`'s existing `fix:hang` band (`0.15 <= r < 0.22`). If a future change to the
 * fleet's own PR order, the `fix:hang` band's bounds, or the PRNG itself ever moves that roll, this scenario's
 * own `judge()` below fails LOUDLY with a "re-pick SEED" message — it never silently passes on a scenario that
 * stopped actually exercising the incident.
 */
const SEED = 8;
/** Round 0 dispatches the first session; round 1 is the harness's own one-tick visibility lag producing one
 *  harmless extra dispatch (see the file header); round 2 sabotages everything alive; a couple more rounds of
 *  margin for the fix-dispatch daemon to notice and redispatch. */
const ROUNDS = 5;
const SABOTAGE_AT_ROUND = 2;

export default {
  id: 'claude-auth-expired',
  title: "a ci-heal session that hit the Claude CLI's own auth failure sits blocked forever; reconcile refuses live-process and the PR is never re-healed",
  card: 'we:backlog/xbsmmwu-claude-auth-expired-session-detection-reaper-reconcile-liven.md (epic #4075)',
  fixedBy: {
    sha: 'this same PR', where: 'this same PR (card we:backlog/xbsmmwu)',
    paths: ['scripts/conveyor/reconcile-core.mjs', 'scripts/conveyor/reconcile-pass.mjs', 'scripts/conveyor/hung-session.mjs'],
  },
  fixPresent(root) {
    try {
      return /markAuthExpiredSessions/.test(readFileSync(join(root, 'scripts/conveyor/reconcile-core.mjs'), 'utf8'));
    } catch { return false; }
  },
  run({ log } = {}) {
    return runSoak({
      name: 'break:claude-auth-expired', rounds: ROUNDS, daemons: ['fix-dispatch'], mainEvery: 0,
      scorecards: false, seed: SEED, log,
      perRound(w, round, ctx, api) {
        const pr = ctx.fleet?.find((p) => p.key === 'red-no-item')?.pr ?? null;
        if (pr == null) return; // fleet shape drifted — judge() below reports this, never a silent no-op
        const sessionName = `ci-heal-${pr}`;
        if (round === SABOTAGE_AT_ROUND && !ctx._sabotaged) {
          // EVERY currently-live one, not just the first: the real incident hit every redispatch during the
          // outage identically, and `assessLiveness` only frees the PR once ALL its bound sessions are
          // accounted for — leaving even one un-sabotaged, genuinely-unexplained live session would mask this
          // fix's own effect behind a correct, unrelated `live-process` refusal.
          const live = w.claude.sessions().filter((s) => s.name === sessionName && (s.state === 'working' || s.state === 'blocked'));
          for (const s of live) {
            authExpiredFail().run({ env: w.env }, s);
            api.say(`r${String(round).padStart(2, '0')} ${sessionName} (session ${s.id}) hit the Claude CLI auth failure (transcript only — pid/state left exactly as the live incident's own sessions were)`);
          }
          ctx._sabotaged = live.length > 0;
        }
        // Kept current every round — by the end of the run this is the LAST round's own count.
        ctx._finalCiHealCount = w.claude.sessions().filter((s) => s.name === sessionName).length;
        ctx._pr = pr;
      },
    });
  },
  judge(report) {
    const pr = report.ctx?._pr ?? report.ctx?.fleet?.find((p) => p.key === 'red-no-item')?.pr;
    if (pr == null) return ["scenario setup problem: no 'red-no-item' fleet PR found — fleet.mjs drifted"];
    if (!report.ctx?._sabotaged) {
      return [`scenario setup problem: PR #${pr}'s own ci-heal-${pr} session(s) never appeared to sabotage at round ${SABOTAGE_AT_ROUND} under SEED=${SEED} — re-pick SEED (this scenario's own header explains how) or the harness's dispatch timing drifted`];
    }
    const count = report.ctx?._finalCiHealCount ?? 0;
    if (count >= 3) return [];
    return [`PR #${pr} never got a fresh ci-heal-${pr} session after EVERY bound one hit the Claude auth failure (still only ${count} such session(s) after ${ROUNDS} rounds) — reconcile-core.mjs#assessLiveness is still reading an auth-dead session as live-process`];
  },
};
