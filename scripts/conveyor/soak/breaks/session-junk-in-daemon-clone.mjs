/**
 * @file breaks/session-junk-in-daemon-clone.mjs — found BY THIS HARNESS on 2026-09-25 (its first 50-tick soak with
 * sessions that leave junk). Card: we:backlog/xm5i1xm (epic #4075). UNFIXED anywhere yet.
 *
 * `dispatch-lane-io.mjs#createDispatchSinks` spawns every dispatched `claude --bg` session with cwd = the
 * dispatching daemon's OWN clone ("the cwd the agent starts in"; the agent acquires its own lane later). A session
 * that writes a scratch/log file by a relative path before it moves into its lane leaves an untracked file in the
 * daemon clone. Self-sync then refuses the dirty clone ("dirty — needs a hand merge"), the clone falls behind main,
 * and every dispatch after that is refused as stale-main — the same cascade as the unsupported-repo.json and
 * run-scorecards.json incidents. In the soak ONE junk file produced 125 invariant violations over 50 ticks.
 *
 * On the #2625 rebuild code (lane/4044) the freeze does NOT follow — the rebuild keeps the clone on main and
 * dispatch continues — but the junk is never cleaned up and the clone stays dirty for good (`clean` fails every
 * tick after it; measured 2026-09-25: 12/14 ticks). Either way the clone is not the pristine tree it must be.
 *
 * Scenario: the plain soak world; at round 1 every live session that has no lane yet leaves one junk file in the
 * directory it was spawned in (`behaviours.mjs#leaveJunk`); main keeps moving. RED = clean/behind/lag/stale/owed.
 *
 * `fixPresent` has no marker to look for until a fix exists, so it is `false`: the test runs as EXPECTED-FAIL.
 * WHOEVER FIXES IT: the expected-fail test will start failing ("expected to fail but passed") the moment the fix
 * works — replace this probe with a marker your fix adds, set `fixedBy`, and prove it with
 * `node scripts/conveyor/soak/red-green.mjs --break=session-junk-in-daemon-clone`.
 */

import { runSoak } from '../soak.mjs';
import { leaveJunk } from '../behaviours.mjs';

export default {
  id: 'session-junk-in-daemon-clone',
  title: 'a dispatched session starts in the daemon clone; its scratch file dirties the clone and freezes self-sync',
  card: 'we:backlog/xm5i1xm (epic #4075)',
  fixedBy: { sha: '(unfixed)', where: 'not fixed yet' },
  fixPresent() { return false; },
  run({ log } = {}) {
    return runSoak({
      name: 'break:session-junk-in-daemon-clone', rounds: 7, mainEvery: 2, scorecards: false, junkInCwd: false, log,
      perRound(w, round, ctx, api) {
        if (round !== 1) return;
        const live = w.claude.sessions().filter((s) => (s.state === 'working' || s.state === 'blocked') && !s.laneDir);
        for (const session of live) {
          leaveJunk({ inCwd: true }).run({ env: w.env }, session);
          api.say(`r01 ${session.name} left a scratch file in its spawn dir ${session.cwd}`);
        }
      },
    });
  },
  judge(report) {
    return report.violations
      .filter((v) => ['clean', 'behind', 'lag', 'stale', 'owed'].includes(v.invariant))
      .map((v) => `${v.daemon ?? '-'} tick ${v.tick ?? '-'}: [${v.invariant}] ${v.detail}`);
  },
};
