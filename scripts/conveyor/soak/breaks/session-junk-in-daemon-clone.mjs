/**
 * @file breaks/session-junk-in-daemon-clone.mjs — found BY THIS HARNESS on 2026-09-25 (its first 50-tick soak with
 * sessions that leave junk). Card: we:backlog/xm5i1xm → #4174 (epic #4075).
 *
 * `dispatch-lane-io.mjs#createDispatchSinks` USED TO spawn every dispatched `claude --bg` session with cwd = the
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
 * FIX (#4174): the sink now spawns every session into `dispatchSessionCwd` — a per-session scratch directory
 * under `<workspace>/.operations/dispatch/`, a SIBLING of the dispatching checkout and of `.lanes/`, never a
 * path inside either. A junk file a session drops before it acquires its own lane now lands there instead of in
 * the daemon clone, so the clone never goes dirty over it. Every brief's one pre-lane command
 * (`lane-pool.mjs acquire`) was changed to an absolute `{{WE_ROOT}}`-qualified path for the same reason
 * `fix`/`ci-heal`'s briefs already needed one: cwd no longer has a `scripts/` directory of its own.
 *
 * Scenario: the plain soak world; at round 1 every live session that has no lane yet leaves one junk file in the
 * directory it was spawned in (`behaviours.mjs#leaveJunk`); main keeps moving. RED (pre-fix) =
 * clean/behind/lag/stale/owed; GREEN (post-fix) = the junk lands outside the clone and none of those trip.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runSoak } from '../soak.mjs';
import { leaveJunk } from '../behaviours.mjs';

export default {
  id: 'session-junk-in-daemon-clone',
  title: 'a dispatched session starts in the daemon clone; its scratch file dirties the clone and freezes self-sync',
  card: 'we:backlog/xm5i1xm (epic #4075)',
  fixedBy: {
    sha: '70f0cd842',
    where: 'lane/xm5i1xm-dispatched-session-scratch-cwd',
    paths: [
      'scripts/operations/dispatch-lane-io.mjs', 'scripts/operations/dispatch-lane.mjs',
      'scripts/conveyor/reconcile-fix-dispatch.mjs', 'scripts/operations/review-dispatch.mjs',
      'scripts/conveyor/stuck-pr-inspect-dispatch.mjs',
      'skills-src/conveyor/delivery-agent-brief.md', 'skills-src/conveyor/fix-agent-brief.md',
      'skills-src/conveyor/fix-agent-ci-brief.md', 'skills-src/conveyor/investigation-agent-brief.md',
      'skills-src/conveyor/prepare-decision-agent-brief.md', 'skills-src/conveyor/prepare-scope-agent-brief.md',
      'skills-src/review/review-agent-brief.md',
    ],
  },
  fixPresent(root) {
    try {
      return /dispatchSessionCwd/.test(readFileSync(join(root, 'scripts/operations/dispatch-lane-io.mjs'), 'utf8'));
    } catch { return false; }
  },
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
