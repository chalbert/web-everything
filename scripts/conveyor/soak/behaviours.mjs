/**
 * @file behaviours.mjs — #4075 daemon soak harness (card x0zg44l). Fake dispatched sessions that behave like
 * real ones: each LIVE session the daemons spawn (through the fake `claude --bg`) is given a plan the first time
 * the soak sees it, drawn from a SEEDED random mix, then advanced one action per soak round.
 *
 * Every action that touches daemon state runs the REAL writer from the daemon clone, the way a real session
 * does (its brief hands it `WE_ROOT` = the daemon clone): `review-set-label.mjs` (via
 * `agent-actions.mjs#postVerdict`), the scorecard store (`log-delegation-trial.mjs`, see {@link writeScorecard}),
 * lane-pool acquire/release. And some sessions misbehave the way real ones did: crash without a completion,
 * hang (transcript stops moving), or leave junk files behind in their lane.
 *
 * The session's `env` is the world env WITHOUT any state-root pin — the live bug was precisely that a dispatched
 * session carries no `CONVEYOR_STATE_ROOT`, so a writer that resolves its path by script location writes into
 * the daemon clone.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import * as act from '../__tests__/sim/agent-actions.mjs';

/** Tiny deterministic PRNG (mulberry32) — the same seed always replays the same soak. */
export function seededRandom(seed) {
  let a = (Number(seed) >>> 0) || 1;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashName(name) {
  let h = 2166136261;
  for (const c of String(name)) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return h;
}

function runCli(ctx, rel, args) {
  const env = { ...process.env, ...ctx.env };
  delete env.CONVEYOR_STATE_ROOT; // a dispatched session never carries the daemon's own state-root pin
  return execFileSync(process.execPath, [join(ctx.simClone, rel), ...args], {
    cwd: ctx.simClone, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30_000,
  });
}

/** Write one scorecard row through the REAL store writer in the daemon clone — what a review session's
 *  `review-set-label.mjs --to=accepted` does for a delegated PR (`#3690` trial log). */
export function writeScorecard() {
  return {
    kind: 'writeScorecard',
    run(ctx, session) {
      const pr = /-(\d+)(?:$|[^0-9])/.exec(session.name)?.[1] ?? '0';
      runCli(ctx, 'scripts/conveyor/log-delegation-trial.mjs', [
        '--provider=anthropic', '--model=soak-model', `--task=soak review of PR ${pr}`,
        '--task-type=other', '--outcome=landed', '--verified-by=independent-claude', `--pr=${pr}`,
      ]);
    },
  };
}

/** Leave a junk file where the session is working: its lane once it has one, otherwise the directory it was
 *  SPAWNED in. Real sessions leave scratch/log files. A dispatched session is spawned with cwd = the daemon's own
 *  clone (`dispatch-lane-io.mjs#createDispatchSinks`: "the cwd the agent starts in"), so junk written before the
 *  session moves into its lane lands IN THE DAEMON CLONE — found by this harness (break
 *  `session-junk-in-daemon-clone`). `inCwd:false` keeps junk to lanes only. */
export function leaveJunk({ inCwd = true } = {}) {
  return {
    kind: 'leaveJunk',
    run(ctx, session) {
      const dir = session.laneDir || (inCwd ? session.cwd : null);
      if (!dir) return;
      try {
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, `soak-junk-${session.name}.log`), 'scratch output a real session forgot to delete\n');
      } catch { /* a vanished lane is not this action's failure */ }
    },
  };
}

/** Crash: the process dies mid-work, no completion record, no verdict. */
export function crash() {
  return {
    kind: 'crash',
    run(ctx, session) {
      ctx.claude.killPid(session.id);
      ctx.claude.setState(session.id, 'failed', { lastError: 'soak: simulated crash' });
    },
  };
}

/**
 * The plan for one session, chosen deterministically from `rand` on first sight.
 * @param {string} name - session name (`review-12`, `fix-13`, `ci-heal-14`, …)
 * @param {() => number} rand
 * @param {{scorecards?: boolean, junkInCwd?: boolean}} [opts] - `scorecards:false` drops the scorecard writer from
 *   review plans; `junkInCwd:false` keeps junk out of a lane-less session's spawn directory (the daemon clone).
 */
export function planFor(name, rand, { scorecards = true, junkInCwd = true } = {}) {
  const r = rand();
  if (name.startsWith('review-')) {
    const verdict = rand() < 0.7 ? 'accepted' : 'changes';
    const findings = verdict === 'changes' ? ['soak finding: the change needs a test'] : [];
    if (r < 0.1) return { label: 'review:crash', actions: [act.acquireLane({ purpose: 'review-loop' }), crash()] };
    if (r < 0.18) return { label: 'review:hang', actions: [act.acquireLane({ purpose: 'review-loop' }), act.hang()] };
    const actions = [act.acquireLane({ purpose: 'review-loop' }), act.postVerdict({ verdict, findings })];
    if (scorecards && verdict === 'accepted') actions.push(writeScorecard());
    if (r < 0.35) actions.push(leaveJunk({ inCwd: junkInCwd }));
    actions.push(act.releaseLane(), act.exit({ state: 'done', writeCompletion: true, verdict }));
    return { label: `review:${verdict}${r < 0.35 ? '+junk' : ''}`, actions };
  }
  if (name.startsWith('fix-') || name.startsWith('ci-heal-')) {
    if (r < 0.15) return { label: 'fix:crash', actions: [crash()] };
    if (r < 0.22) return { label: 'fix:hang', actions: [act.hang()] };
    const actions = [act.pushCommit({ files: { [`soak/${name}.txt`]: `fixed by ${name}\n` }, message: `soak: ${name}` })];
    if (r < 0.4) actions.push(leaveJunk({ inCwd: junkInCwd }));
    actions.push(act.exit({ state: 'done', writeCompletion: true }));
    return { label: 'fix:push', actions };
  }
  return { label: 'other:exit', actions: [act.exit({ state: 'done' })] };
}

/**
 * Advance every live session one action. First sight assigns the session a plan (seeded per session name, so
 * the plan a given session gets never depends on the ORDER sessions were seen in).
 * @param {object} ctx - the same ctx `agent-actions.mjs` actions take.
 * @param {{seed:number, plans:Map<string,{label:string, actions:object[]}>, scorecards?:boolean}} state
 * @returns {Promise<Array<{session:string, kind:string, error?:string}>>}
 */
export async function stepBehaviours(ctx, { seed, plans, scorecards = true, junkInCwd = true }) {
  const stepped = [];
  const live = ctx.claude.sessions().filter((s) => s.state === 'working' || s.state === 'blocked');
  for (const session of live) {
    if (!plans.has(session.name)) plans.set(session.name, planFor(session.name, seededRandom(seed ^ hashName(session.name)), { scorecards, junkInCwd }));
    const plan = plans.get(session.name);
    const action = plan.actions.shift();
    if (!action) continue;
    try {
      // eslint-disable-next-line no-await-in-loop -- sessions step in listing order, one action each
      await action.run(ctx, session);
      stepped.push({ session: session.name, kind: action.kind });
    } catch (e) {
      // A session action failing is a session failing — exactly what a real crashed session looks like to the
      // daemons. Never a soak failure by itself; the invariants judge what the DAEMONS do about it.
      stepped.push({ session: session.name, kind: action.kind, error: String((e && e.message) || e).split('\n')[0] });
      try { ctx.claude.setState(session.id, 'failed', { lastError: `soak action ${action.kind} failed` }); } catch { /* gone */ }
    }
  }
  return stepped;
}
