/**
 * @file breaks/reaper-restops-finished-sessions.mjs — live 2026-09-26, fixed by PR #2762 (merge 93e3307f3,
 * "review-daemon: print why each held PR got no review; reaper stops each finished session once").
 *
 * LIVE INCIDENT. WE PRs #2746–#2758 sat `review:pending` for about an hour. The review daemon's ticks took ~20
 * minutes instead of 2, because its session reaper (`scripts/conveyor/session-reaper.mjs#runSessionReaperPass`,
 * called every tick from `skills-src/conveyor/review-daemon.mjs#defaultReapSessions`) re-ran `claude stop` on
 * ~1,500 ALREADY-FINISHED sessions on every single pass:
 *   1. a `stopped` row whose `cwd` is not the daemon's own clone (every dispatched session runs in its own
 *      scratch dir) came back `wrong-cwd` from `classifySessionReap` (cwd is checked BEFORE state), and the
 *      #4149 upgrade axes (no-outcome / hung / idle-finished) then re-reaped it — forever;
 *   2. a `done`/`failed` row stays `done`/`failed` in the real `claude agents --json --all` listing after a
 *      `claude stop`, and nothing remembered it had already been stopped — so it was stopped again every tick.
 * And the reap ran AFTER discovery inside `tickOnce`, so a PR whose stale bound session (a `live-process`
 * refusal) the reap just stopped still waited one MORE (20-minute) tick for its review dispatch.
 *
 * FIX (#2762): `classifySessionReapWithGroundTruth` returns `already-stopped` for a `stopped` row whatever its
 * cwd; a new opt-in `makeReapedLedger` (`~/.claude/we-session-reaper/reaped.json`, resolved via `homedir()` —
 * in the sim that is the world's fake HOME, never the real one) remembers stopped ids so a still-`done`/`failed`
 * row is skipped (`previouslyReaped`); `defaultReapSessions` opts into it; `tickOnce` reaps BEFORE discovery.
 *
 * SCENARIO (review daemon only, 3 rounds, no default fleet). Seeded straight into the fake `claude` store:
 *   - STOPPED_FOREIGN × 10: `state:'stopped'`, cwd a per-session scratch dir (not the clone), a `fix-9xxx`
 *     name with a `startedAt` 5h old — past the fix kind's 120-minute no-outcome ceiling, so the #4149 axis
 *     fires on it. Any `claude stop` of one of these is a redundant stop.
 *   - DONE_LOCAL × 8 (`state:'done'`, cwd = the daemon clone) and FAILED_FOREIGN × 8 (`state:'failed'`,
 *     scratch cwd, old `startedAt`): legitimately reaped ONCE. The fake `claude stop` flips a row to `stopped`;
 *     the real CLI does not for a finished row (the PR's own evidence), so at the start of every round the
 *     scenario puts these rows back to their terminal state — modelling the real listing. A second stop on a
 *     later tick is a redundant stop.
 *   - one stale `fix-<P>` session bound by name to a `review:pending` PR P: `state:'working'`, a REAL live pid
 *     (so reconcile refuses P as `live-process`), scratch cwd, `startedAt` 3h old (no-outcome ceiling → the
 *     reaper stops it). The review for P must be dispatched on the SAME tick that stops this session.
 * Each round, `perRound` reads the fake `claude` call log for the previous tick's `claude stop` calls.
 *
 * RED (pre-fix): tick 0 and tick 1 both stop the 10 stopped-foreign rows, and tick 1 re-stops the 16
 * done/failed rows stopped on tick 0 (`reaper-restop`); the fix session is stopped on tick 0 but P's review
 * only goes out on tick 1 (`reap-after-discovery`). GREEN: no seeded row is stopped twice, no stopped row is
 * stopped at all, and P's review goes out on tick 0. `reaper-scenario` guards against a vacuous GREEN (the
 * reaper never ran, the stale session was never stopped, or the soak died before both checks ran).
 */

import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { runSoak } from '../soak.mjs';
import { sessionMatches } from '../invariants.mjs';
import {
  fullSessionId, readCalls, shortId, spawnSleeper, withStoreLock,
} from '../../../operations/__tests__/helpers/fake-claude-shim.mjs';

const OWN = new Set(['reaper-restop', 'reap-after-discovery', 'reaper-scenario']);
const HOUR = 3_600_000;

export default {
  id: 'reaper-restops-finished-sessions',
  title: 'the review daemon\'s session reaper re-stops already-finished sessions every tick, and reaps only after discovery',
  card: 'PR #2762 (epic #4075/#3383)',
  fixedBy: {
    sha: '93e3307f3',
    where: 'main',
    paths: ['scripts/conveyor/session-reaper.mjs', 'skills-src/conveyor/review-daemon.mjs'],
  },
  fixPresent(root) {
    try {
      return /export function makeReapedLedger/.test(readFileSync(join(root, 'scripts/conveyor/session-reaper.mjs'), 'utf8'))
        && /reapedLedger: makeReapedLedger\(\)/.test(readFileSync(join(root, 'skills-src/conveyor/review-daemon.mjs'), 'utf8'));
    } catch { return false; }
  },
  run({ log } = {}) {
    return runSoak({
      name: 'break:reaper-restops-finished-sessions', rounds: 3, daemons: ['review'], mainEvery: 0, fleet: false,
      scorecards: false, junkInCwd: false, log,
      setup(w) {
        // The review:pending PR the stale fix session is bound to.
        const head = 'lane/soak-reaper-pending';
        w.git.createBranch('we', head, { from: 'main', files: { 'soak/reaper-pending.txt': 'waiting for review\n' } });
        const pr = w.gh.openPr({ repo: 'we', head, base: 'main', title: 'soak: review:pending, stale fix session bound', labels: ['review:pending'] });
        w.gh.setChecks('we', pr, [{ name: 'test', conclusion: 'SUCCESS' }]);

        const now = w.clock.now();
        const scratch = (id) => { const d = join(w.root, '.operations', 'dispatch', id); mkdirSync(d, { recursive: true }); return d; };
        const rows = [];
        const add = (group, state, name, cwd, startedAt, extra = {}) => {
          const id = shortId();
          rows.push({
            group, id, sessionId: fullSessionId(), name, kind: 'background', state, status: null, waitingFor: null,
            cwd: cwd ?? scratch(id), startedAt, ...extra,
          });
        };
        let n = 9000;
        for (let i = 0; i < 10; i += 1) add('stopped-foreign', 'stopped', `fix-${n += 1}`, null, now - 5 * HOUR);
        for (let i = 0; i < 8; i += 1) add('done-local', 'done', `fix-${n += 1}`, w.simCloneRoot, now - 5 * HOUR);
        for (let i = 0; i < 8; i += 1) add('failed-foreign', 'failed', `fix-${n += 1}`, null, now - 5 * HOUR);
        const pid = spawnSleeper();
        add('stale-bound', 'working', `fix-${pr}`, null, now - 3 * HOUR, { status: 'busy', pid });

        withStoreLock(w.claude.env.FAKE_CLAUDE_STORE, (store) => {
          for (const { group, ...row } of rows) store.sessions.push(row);
          store.pids.push(pid);
        });
        const groups = Object.fromEntries(rows.map((r) => [r.id, { group: r.group, state: r.state, name: r.name }]));
        return { pr, groups, staleId: rows.find((r) => r.group === 'stale-bound').id, callsSeen: 0, stopsById: {}, checked: 0 };
      },
      perRound(w, round, ctx, api) {
        if (round === 0) return;
        const tick = round - 1;
        const calls = readCalls(w.claude.env.FAKE_CLAUDE_CALLS);
        const fresh = calls.slice(ctx.callsSeen);
        ctx.callsSeen = calls.length;
        const stopped = fresh.filter((c) => c.argv?.[0] === 'stop').map((c) => String(c.argv[1] ?? '').trim().toLowerCase());
        const mine = stopped.filter((id) => ctx.groups[id]);
        const counts = {};
        for (const id of mine) counts[ctx.groups[id].group] = (counts[ctx.groups[id].group] ?? 0) + 1;
        api.say(`r${String(round).padStart(2, '0')} tick ${tick}: ${stopped.length} \`claude stop\` call(s), ${mine.length} on seeded rows ${JSON.stringify(counts)}`);

        const restopped = [];
        const stoppedStopped = [];
        for (const id of mine) {
          const g = ctx.groups[id];
          if (g.state === 'stopped') stoppedStopped.push(g.name);
          else if (ctx.stopsById[id] !== undefined && ctx.stopsById[id] !== tick) restopped.push(`${g.name}(${g.state}, first stopped tick ${ctx.stopsById[id]})`);
          if (ctx.stopsById[id] === undefined) ctx.stopsById[id] = tick;
        }
        if (stoppedStopped.length) {
          api.violation('reaper-restop', `tick ${tick}: \`claude stop\` on ${stoppedStopped.length} session(s) ALREADY stopped before the soak began (foreign cwd): ${stoppedStopped.slice(0, 4).join(', ')}${stoppedStopped.length > 4 ? ', …' : ''}`);
        }
        if (restopped.length) {
          api.violation('reaper-restop', `tick ${tick}: \`claude stop\` AGAIN on ${restopped.length} finished session(s) an earlier tick already stopped: ${restopped.slice(0, 4).join(', ')}${restopped.length > 4 ? ', …' : ''}`);
        }

        if (tick === 0) {
          const firstStops = mine.filter((id) => ['done-local', 'failed-foreign'].includes(ctx.groups[id].group)).length;
          if (firstStops === 0) api.violation('reaper-scenario', 'tick 0: the reaper stopped none of the 16 seeded done/failed sessions — the reap never ran, so this scenario proves nothing');
          const staleStopped = mine.includes(ctx.staleId);
          const reviewed = w.claude.sessions().some((s) => sessionMatches(s.name, 'review', ctx.pr));
          if (!staleStopped) api.violation('reaper-scenario', `tick 0: the stale fix-${ctx.pr} session (live pid, 3h past start) was not stopped — the reap-order check proves nothing`);
          else if (!reviewed) api.violation('reap-after-discovery', `tick 0 stopped fix-${ctx.pr} (the stale session holding PR #${ctx.pr} as live-process) but dispatched no review for #${ctx.pr} — discovery ran BEFORE the reap, so the freed PR waits a whole tick`);
          api.say(`r01 tick 0: stale fix-${ctx.pr} stopped=${staleStopped}, review for #${ctx.pr} dispatched=${reviewed}`);
        }
        ctx.checked += 1;

        // The real CLI keeps a finished row `done`/`failed` after `claude stop`; the fake flips it to `stopped`.
        // Put it back so the next tick sees the listing the live reaper saw.
        withStoreLock(w.claude.env.FAKE_CLAUDE_STORE, (store) => {
          for (const s of store.sessions) {
            const g = ctx.groups[String(s.id).toLowerCase()];
            if (g && (g.group === 'done-local' || g.group === 'failed-foreign')) s.state = g.state;
          }
        });
        const ledger = join(w.env.HOME, '.claude', 'we-session-reaper', 'reaped.json');
        try { api.say(`r${String(round).padStart(2, '0')} reaped ledger (world HOME): ${JSON.parse(readFileSync(ledger, 'utf8')).ids.length} id(s) at ${ledger.slice(dirname(w.env.HOME).length)}`); } catch { /* absent pre-fix */ }
      },
    });
  },
  judge(report) {
    const problems = report.violations
      .filter((v) => OWN.has(v.invariant))
      .map((v) => `${v.daemon ?? '-'} tick ${v.tick ?? '-'}: [${v.invariant}] ${v.detail}`);
    if ((report.ctx?.checked ?? 0) < 2) problems.push(`[reaper-scenario] only ${report.ctx?.checked ?? 0}/2 tick checks ran${report.fatal ? ` — ${report.fatal}` : ''}`);
    return problems;
  },
};
