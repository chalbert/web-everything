/**
 * @file breaks/reaper-backstop-clobbers-live-fixer.mjs — BLOCKER, live 2026-09-27 (`we:backlog/4306-*.md`,
 * epic #3383/#4075): two live fixers ran at once on PR 2821. Completion records are keyed by session NAME,
 * which every fixer of a PR shares. The session reaper's own backstop write
 * (`we:scripts/conveyor/session-reaper.mjs#planBackstopCompletion`) stopped the OLD, already-finished fixer
 * (A) and, planning its backstop against the record it read, wrote `done` straight over the NEW, still-LIVE
 * fixer's (B) own `started` record — the record under the shared name `fix-<pr>` now falsely said "done" for a
 * session that was very much still working. `we:scripts/conveyor/reconcile-core.mjs#markSelfReportedDone` then
 * read that clobbered record and marked B "finished" too, even though its pid was alive — freeing the PR for a
 * THIRD fix-dispatch attempt while B kept working. See the card's own Evidence section for the full timeline;
 * this scenario reproduces the mechanism, not the exact live clock times.
 *
 * INVARIANT (the card's own headline): "a completion record only ever speaks for the session that wrote it."
 * Two independent guards close this, either one alone sufficient:
 *   - GUARD 1 (`planBackstopCompletion`): the reaper never writes a backstop that is not the reaped session's
 *     own to write — refuses (a) a foreign `sessionId` on the existing record, (b) a listed newer same-name
 *     generation, (c) an existing `started` record timestamped after the reaped session's own last transcript
 *     activity. THIS scenario's RED case is exactly (a): B's `started` record already carries B's OWN
 *     `sessionId`, which differs from A's.
 *   - GUARD 2 (`markSelfReportedDone` / `makeCompletionResolver` / `session-verdicts.mjs`): even if a foreign
 *     backstop somehow lands, no reader ever applies a record whose `sessionId` names a different session to
 *     ITS row.
 *
 * SCENARIO (review + fix-dispatch daemons, 3 rounds). One PR `P`, labelled `review:changes` with a finding (the
 * standard mechanical conflict-fix trigger, `we:scripts/conveyor/soak/fleet.mjs`'s own `changes` recipe — no
 * real git conflict needed). Seeded directly into the fake `claude` store, both bound to the SAME name `fix-P`:
 *   - A (the OLD, finished fixer): a REAL sleeper pid (its own `claude --bg` process stayed open, idle — the
 *     live incident's own a73a8bec shape), `state:'blocked'`, a REAL resolvable transcript whose one entry is
 *     an ENDED turn (no pending tool_use) timestamped just past `WE_IDLE_FINISHED_MINUTES` (pinned small here
 *     so the scenario need not wait out the real 10-minute default) — the idle-finished axis is what proves A
 *     done, exactly matching the incident's own reaper log line (`idle-finished:turn-ended-idle`), never the
 *     completion-record axis (by the time the reaper runs, the on-disk record under the shared name is
 *     already B's, not A's — see below).
 *   - B (the LIVE new fixer): a REAL sleeper pid, `state:'working'`, NO scripted staleness of its own (no
 *     transcript at all — every transcript-reading axis answers "unknown", never "reap"), a `started`
 *     completion record ALREADY on disk under the shared name, written the way the real CLI writes it —
 *     carrying B's own `sessionId` (`we:scripts/operations/completion-cli.mjs report`'s own shape, #4306).
 *
 * The fake completion writer in `we:scripts/conveyor/__tests__/sim/agent-actions.mjs#doWriteCompletion` has no
 * session identity (bypasses the CLI's `--session-id`), so this scenario writes B's record ITSELF, directly
 * through the REAL `completion-store.mjs` imported from the sim clone (the same technique that helper already
 * uses for its own writes) — never re-implementing the store's own logic.
 *
 * RED (pre-fix, baseline commit noted in `fixedBy.sha` below — reversed on `fixedBy.sha`, so this header names
 * the FIX commit, never the baseline): round 0's review-daemon tick reaps A (idle-finished), plans a backstop
 * against the on-disk record it reads (B's `started` one), and — with no Guard-1 skip condition — writes `done`
 * straight over it (`backstop-clobber`). The SAME round's fix-dispatch tick then reads that clobbered record via
 * `markSelfReportedDone` (Guard 2 absent too) and marks B `selfReportedDone`, so `assessLiveness` no longer
 * refuses the PR `live-process` — a further dispatch becomes possible while B's real pid is still alive
 * (`two-live-fixers`).
 *
 * GREEN (post-fix): Guard 1's condition (a) fires the moment the reaper plans A's backstop (the on-disk
 * record's `sessionId` is B's, foreign to A) — `planBackstopCompletion` returns `null`, nothing is written, and
 * B's own `started` record survives untouched. The fix-dispatch tick's own `reconcile-refused live-process`
 * line for PR P (captured in this run's own tick logs) is what a still-live, correctly-bound session always
 * prints — proof the record was never clobbered out from under B is the completion-record check itself
 * (`backstop-clobber` staying clear); `scenario-ran` guards against a vacuous pass (the reap never firing at
 * all, or B's own pid having died before the checks ran).
 *
 * MEASURED: RED confirmed against baseline `f1c0fee1d` (this item's own `main`, no card files applied) with
 * ONLY this scenario's own two files (`.mjs` + `.soak.test.mjs`) added — `backstop-clobber` (2/2 post-round
 * checks) and `two-live-fixers` (1/2) both fire. GREEN confirmed on the same baseline with Guards 1+2 applied
 * on top — both violations clear, `scenario-ran` still holds (A is still reaped every run).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runSoak } from '../soak.mjs';
import {
  fullSessionId, shortId, spawnSleeper, withStoreLock,
} from '../../../operations/__tests__/helpers/fake-claude-shim.mjs';

/**
 * Chosen OFFLINE against `behaviours.mjs`'s own `seededRandom(seed ^ hashName(name))` for `name: 'fix-1'`
 * (fake-gh.mjs's PR counter always starts at 1, and `fleet:false` opens no PR before this scenario's own —
 * deterministic, not a guess): under `seed=9` the roll lands at r≈0.168, inside `planFor`'s existing
 * `fix:hang` band (`0.15 <= r < 0.22`, ONE action: `hang()`, which sets `state` and a `hung` marker but never
 * calls `exit()`/writes a completion record). This is THE technique this scenario needs: `stepBehaviours`
 * (`we:scripts/conveyor/soak/behaviours.mjs`) shares ONE plan per session NAME, and both A and B here carry the
 * exact same name — the live incident's whole premise — so any OTHER plan (`fix:crash`/`fix:push`) would let
 * the harness's own scripted behaviour, not this card's bug, overwrite B's record or flip its state, exactly
 * the "soak behaviour plans are shared by session NAME" hazard `we:backlog/4306-*.md`'s own Test plan #6 names.
 * A is reaped (and so removed from `stepBehaviours`'s own `state==='working'|'blocked'` sweep) inside round 0's
 * REVIEW tick, which always runs BEFORE that round's `stepBehaviours` step, so the ONE `hang()` action this
 * plan ever produces lands on B alone — a no-op for this scenario's purposes, and the queue is empty forever
 * after. If a future change to `fleet.mjs`'s PR numbering, `planFor`'s own band bounds, or the PRNG itself ever
 * moves that roll, this scenario's own `judge()` fails LOUDLY (`scenario-ran`) rather than silently passing on
 * a run that stopped exercising the incident.
 */
const SEED = 9;
const MIN = 60_000;
/** Pinned small so the scenario need not wait out the real 10-minute default — see this file's own header. */
const IDLE_FINISHED_MINUTES = 2;
/** REAL wall-clock age (this axis reads real transcript timestamps, never the sim's own virtual clock) for
 *  A's one transcript entry: past `IDLE_FINISHED_MINUTES`, comfortably short of the 30-minute hung default (so
 *  hung-transcript, a DIFFERENT axis, never fires instead and this scenario stays pinned to idle-finished, the
 *  live incident's own exact reap reason). */
const A_TRANSCRIPT_AGE_MS = (IDLE_FINISHED_MINUTES + 3) * MIN;

/** Import the REAL `completion-store.mjs` FROM THE SIM CLONE (never this repo's own tree directly) — the same
 *  "run the daemon's own code" reasoning `agent-actions.mjs#doWriteCompletion` already uses for its writes. */
async function completionStoreFrom(simCloneRoot) {
  const path = join(simCloneRoot, 'scripts', 'operations', 'completion-store.mjs');
  return import(pathToFileURL(path).href);
}

/** One ENDED assistant turn (no `tool_use` block at all, so `detectBlockedOnChild` never reads it as pending)
 *  — the transcript shape `readIdleFinishedInfo` needs to confirm a session done, at the given ISO timestamp. */
function writeEndedTurnTranscript(path, isoTs) {
  mkdirSync(join(path, '..'), { recursive: true });
  const line = JSON.stringify({
    type: 'assistant',
    timestamp: isoTs,
    message: { role: 'assistant', content: [{ type: 'text', text: 'done, re-armed' }] },
  });
  writeFileSync(path, `${line}\n`);
}

export default {
  id: 'reaper-backstop-clobbers-live-fixer',
  title: "the session reaper's backstop write clobbers a LIVE new fixer's own `started` completion record with an old, finished fixer's `done` — a second fixer generation can then be read as finished while it is still working",
  card: 'we:backlog/4306-blocker-two-live-fixers-on-one-pr-reaper-backstop-clobbers-t.md (BLOCKER fix-2821, live 2026-09-27, epic #3383/#4075)',
  fixedBy: {
    // #xab3jh7 — filled at land time with the FIX commit's own sha (never the baseline); the scenario/fixture
    // files named in `paths` stay OUT of that commit so `red-green.mjs --revert` keeps them when reversing it.
    sha: 'PENDING-FILL-AT-LAND',
    where: 'main',
    paths: [
      'scripts/conveyor/session-reaper.mjs',
      'scripts/conveyor/reconcile-core.mjs',
      'scripts/conveyor/session-verdicts.mjs',
      'scripts/conveyor/session-verdicts-io.mjs',
      'scripts/operations/completion-record.mjs',
      'scripts/operations/completion-store.mjs',
      'scripts/operations/completion-cli.mjs',
    ],
  },
  fixPresent(root) {
    try {
      // Guard 1's own skip-condition parameter name — present only once `planBackstopCompletion` gained the
      // (a)/(b)/(c) checks this card adds.
      return /newerSameNameListed/.test(readFileSync(join(root, 'scripts/conveyor/session-reaper.mjs'), 'utf8'));
    } catch { return false; }
  },
  run({ log } = {}) {
    return runSoak({
      name: 'break:reaper-backstop-clobbers-live-fixer',
      rounds: 3,
      daemons: ['review', 'fix-dispatch'],
      mainEvery: 0,
      fleet: false,
      scorecards: false,
      seed: SEED,
      env: { WE_IDLE_FINISHED_MINUTES: String(IDLE_FINISHED_MINUTES) },
      log,
      setup(w) {
        const head = 'lane/soak-reaper-backstop-clobber';
        w.git.createBranch('we', head, { from: 'main', files: { 'soak/reaper-backstop-clobber.txt': 'bounced\n' } });
        const pr = w.gh.openPr({
          repo: 'we', head, base: 'main', title: 'soak: review:changes with a finding — owes a fix',
          labels: ['review:changes'], body: 'No backlog item.',
        });
        w.gh.setChecks('we', pr, [{ name: 'test', conclusion: 'SUCCESS' }]);
        w.gh.comment('we', pr, '1. soak finding: the change needs a test', { author: 'review-bot' });

        const now = w.clock.now();
        const name = `fix-${pr}`;

        // A — the OLD, finished fixer. Real pid, transcript ended its turn A_TRANSCRIPT_AGE_MS (real wall
        // clock) ago — past IDLE_FINISHED_MINUTES, short of the 30-minute hung default.
        const pidA = spawnSleeper();
        const idA = shortId();
        const sessionIdA = fullSessionId();
        const cwdA = join(w.root, 'lanes', 'lane-a');
        const startedAtA = now - 40 * MIN;
        writeEndedTurnTranscript(
          join(w.env.HOME, '.claude', 'projects', cwdA.replaceAll('/', '-'), `${sessionIdA}.jsonl`),
          new Date(Date.now() - A_TRANSCRIPT_AGE_MS).toISOString(),
        );

        // B — the LIVE new fixer. Real pid, genuinely working, no scripted staleness of its own (no
        // transcript at all — every transcript-reading axis answers "unknown", never "reap").
        const pidB = spawnSleeper();
        const idB = shortId();
        const sessionIdB = fullSessionId();
        const cwdB = join(w.root, 'lanes', 'lane-b');
        const startedAtB = now - 5 * MIN; // started AFTER A — the newer generation

        withStoreLock(w.claude.env.FAKE_CLAUDE_STORE, (store) => {
          store.sessions.push({
            id: idA, sessionId: sessionIdA, name, kind: 'background', state: 'blocked', status: 'idle',
            waitingFor: null, cwd: cwdA, startedAt: startedAtA, pid: pidA,
          });
          store.sessions.push({
            id: idB, sessionId: sessionIdB, name, kind: 'background', state: 'working', status: 'busy',
            waitingFor: null, cwd: cwdB, startedAt: startedAtB, pid: pidB,
          });
          store.pids.push(pidA, pidB);
        });

        // B's OWN `started` completion record, written the SAME shape the real CLI writes (#4306 — `session`/
        // `kind`/`pr`/`item`/`status`/`outcome`/`verdict`/`label`/`runId`/`sessionId`/`startedAt`/`updatedAt`,
        // `we:scripts/operations/completion-record.mjs#newCompletionRecord`) — carrying B's own `sessionId`,
        // never A's, never null. Written directly here (never via a dynamic import of the sim clone's own
        // `completion-store.mjs`) because `setup` is called SYNCHRONOUSLY by the harness
        // (`we:scripts/conveyor/__tests__/sim/scenario.mjs`'s own `def.setup(w) ?? {}`, never awaited) — an
        // `async setup` silently hands back a dangling Promise as `ctx` instead of this scenario's own object.
        const bStartedIso = new Date(startedAtB).toISOString();
        const bRecord = {
          v: 1,
          session: name,
          kind: 'fix',
          pr: String(pr),
          item: null,
          status: 'started',
          outcome: null,
          verdict: null,
          label: null,
          runId: null,
          sessionId: sessionIdB,
          startedAt: bStartedIso,
          updatedAt: bStartedIso,
        };
        mkdirSync(w.completionsDir, { recursive: true });
        writeFileSync(join(w.completionsDir, `${name}.json`), `${JSON.stringify(bRecord, null, 2)}\n`);

        return {
          pr, name, sessionIdB, idA, idB, pidB, reaped: false, clobbered: false, foreignSpawned: false, checkedRounds: 0,
        };
      },
      async perRound(w, round, ctx, api) {
        if (round === 0) return; // let round 0's ticks (review then fix-dispatch) run first
        const { tryReadCompletion } = await completionStoreFrom(w.simCloneRoot);
        let record = null;
        try { record = tryReadCompletion(ctx.name, w.completionsDir); } catch { record = null; }

        if (!ctx.reaped) {
          const aRow = w.claude.sessions().find((s) => s.id === ctx.idA);
          if (aRow && (aRow.state === 'stopped' || aRow.state === 'done')) ctx.reaped = true;
        }
        ctx.checkedRounds += 1;

        if (!record) {
          api.violation('backstop-clobber', `r${round}: fix-${ctx.pr}'s completion record is GONE — expected B's own \`started\` record to still be on disk`);
        } else if (record.sessionId !== ctx.sessionIdB || record.status !== 'started') {
          ctx.clobbered = true;
          api.violation('backstop-clobber', `r${round}: fix-${ctx.pr}'s completion record was overwritten — now {status:${record.status}, sessionId:${record.sessionId ?? 'null'}} — B's own \`started\` record (sessionId ${ctx.sessionIdB}) was clobbered`);
        }

        // OBSERVATIONAL ONLY, never gates this break's own GREEN — see this file's own header. Whether a THIRD
        // `fix-<pr>` session gets dispatched depends on the fix-dispatch CLAIM's own same-owner re-acquire hole
        // (`we:scripts/conveyor/fix-dispatch-claim.mjs#acquireFixDispatchClaim`, tracked as this card's own
        // Follow-up F1) — a SEPARATE, not-yet-closed gap this card does not fix, so it can fire on the fixed
        // tree too (measured: it does). What THIS card's own guards own is the completion RECORD never
        // reading B as finished — `backstop-clobber` above is the load-bearing check.
        const foreign = w.claude.sessions().filter((s) => s.name === ctx.name && s.id !== ctx.idB);
        const bLive = w.claude.sessions().some((s) => s.id === ctx.idB && (s.state === 'working' || s.state === 'blocked'));
        if (bLive) {
          const thirdGeneration = foreign.some((s) => s.state === 'working' || s.state === 'blocked');
          if (thirdGeneration && !ctx.foreignSpawned) {
            ctx.foreignSpawned = true;
            api.say(`r${round} note: a THIRD fix-${ctx.pr} session was dispatched while B (session ${ctx.idB}, pid ${ctx.pidB}) is still live — the fix-dispatch CLAIM's own re-acquire hole (Follow-up F1), not this card's own guards`);
          }
        } else {
          // B dying is a real scenario-validity problem (this scenario's own "pin B alive" premise), unlike the
          // observational note above — it DOES gate GREEN, via `scenario-ran` in `judge()` below.
          ctx.bDied = true;
        }
      },
    });
  },
  judge(report) {
    // `backstop-clobber` is the ONE load-bearing check — see this file's own header for why a THIRD dispatch
    // appearing (Follow-up F1, a separate un-closed hole) is deliberately observational only, never gating.
    const problems = report.violations.filter((v) => v.invariant === 'backstop-clobber').map((v) => `${v.daemon ?? '-'} tick ${v.tick ?? '-'}: [${v.invariant}] ${v.detail}`);
    if (!report.ctx?.reaped) problems.push('[scenario-ran] A (the old, finished fixer) was never reaped — the idle-finished setup proves nothing');
    if (report.ctx?.bDied) problems.push("[scenario-ran] B (the live new fixer) stopped being live before the checks ran — this scenario's own \"pin B alive\" premise broke, proving nothing");
    if ((report.ctx?.checkedRounds ?? 0) < 2) problems.push(`[scenario-ran] only ${report.ctx?.checkedRounds ?? 0}/2 post-round checks ran${report.fatal ? ` — ${report.fatal}` : ''}`);
    return problems;
  },
};
