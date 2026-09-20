/**
 * @file scripts/conveyor/session-reap-stop.mjs
 * @description THE STOP MECHANICS of the conveyor session reaper (WE #3435/#3479, epic #3383) — split out of
 *   `session-reaper.mjs` (a MOVE, no logic change). This is the half that ACTS on sessions: the retried `claude stop`
 *   ({@link stopSessionWithRetry}, over `dispatch-abort.mjs#stopSession` — the ONE existing `claude stop <id>` wrapper
 *   in this repo) and the #77683 `clear-stuck-session` repair ({@link attemptClearStuckSession}) for a stop that
 *   genuinely fails. It never decides WHICH sessions to reap — `session-reap-plan.mjs` does — and the CLI
 *   (`session-reaper.mjs`) only calls into here for a candidate the plan already chose.
 *
 * `claude stop`'S REPORTED SUCCESS IS A HINT, NOT A CERTAINTY (found live 2026-09-02, confirmed against
 * upstream `anthropics/claude-code` issues #65925/#45250/#41461): a stop can report success while the local
 * listing keeps reporting the session unchanged. This reaper does not re-poll to confirm — that would add a
 * second `claude agents --json` read (and a race) for a confirmation this repo already knows is unreliable —
 * it logs {@link stopSession}'s own `alreadyGone` distinction and moves on, exactly as best-effort as
 * `lease-reaper.mjs`'s own per-candidate try/catch.
 *
 * THE #77683 REPAIR — WHEN `claude stop`/`claude rm` GENUINELY FAIL, NOT MERELY REPORT UNRELIABLY. A DIFFERENT
 * known upstream bug (GitHub #77683) leaves a session listed forever, its job directory never cleaned up, and
 * `claude stop`/`rm` refuse it outright rather than the merely-unconfirmed-success case just above. `we:scripts/
 * operations/clear-stuck-session.mjs` mechanizes the by-hand fix for exactly that shape (read → assess →
 * authorize → move), but its own `authorize` step is a real human `confirm` — reasoned, at the time it was
 * built, from "this moves a directory outside the repo's own git tree" alone, without weighing it against what
 * THIS file already does unattended.
 *
 * THAT WEIGHING, DONE HERE: this reaper already `claude stop`s a `done`/`failed` session with NO human step and
 * NO liveness re-check of its own — TERMINAL_REAP_STATES is the whole gate. It already `claude stop`s a
 * `blocked`/`working` one on nothing stronger than ONE independently-read fact (a backlog card's `status:`, or
 * one `gh pr view`) — the ground-truth axis above. `clear-stuck-session.mjs#assessStuck` is a STRICTER gate than
 * either: five independently-verified facts, including a REUSE of `reconcile-core.mjs#assessLiveness` — the
 * exact liveness rule this repo's own reconcile pass already trusts unattended elsewhere — plus a run-store
 * scan this reaper's own axes have no equivalent of at all. Requiring a HUMAN for the stricter gate while
 * trusting the weaker ones unattended would not be a safety margin; it would be an inconsistency this reaper's
 * own track record does not justify. So: THIS reaper's own call into `clear-stuck-session` supplies a TRUSTED
 * `proceed` programmatically ({@link clearStuckSessionAutoConfirm}) instead of stopping for a human — but it
 * NEVER skips `assessStuck` itself, and it never fires for anything this reaper did not already, independently,
 * decide to reap (see {@link attemptClearStuckSession}'s call site in `main()`: only a candidate `stopSession
 * WithRetry` already tried and failed on ever reaches it). A MANUAL invocation — `run.mjs clear-stuck-session
 * --session=<id>` with no `--answer` — is untouched: `clearStuckSessionAutoConfirm` is never wired into that
 * CLI path, so the interactive confirm still stops there exactly as `clear-stuck-session.mjs`'s own header
 * describes. `--no-clear-stuck` is the same kind of rollback/A-B escape hatch `--no-ground-truth` already is
 * for the axis above, for the same reason.
 */

import { execFileSync } from 'node:child_process';

import { stopSession } from '../operations/dispatch-abort.mjs';
import { sleepSyncMs } from '../readiness/drain-lock.mjs';
// THE #77683 REPAIR (see the file header) — driving `clear-stuck-session` end to end, in-process, with a
// TRUSTED `proceed` this reaper's own call path supplies. Nothing here is a second implementation of that
// operation's own verdict: `assessStuck` (reached through `clearStuckSessionOperation`) is the ONLY thing that
// decides whether anything actually moves.
import { driveRun } from '../operations/cli-adapter.mjs';
import { startRun } from '../operations/engine.mjs';
import { createRegistry } from '../operations/registry.mjs';
import { createFileRunStore, newRunId } from '../operations/run-store.mjs';
import { CLEAR_STUCK_SESSION_OP, clearStuckSessionOperation } from '../operations/clear-stuck-session.mjs';
import { createClearStuckSessionReader, createClearStuckSessionSinks } from '../operations/clear-stuck-session-io.mjs';

/**
 * How many total attempts (1 initial + retries) the stop loop below makes for ONE candidate before counting it
 * a real failure — found live 2026-09-04 (WE #3435/#3383 epic): a live tick's `runQuiet` (`we:skills-src/
 * conveyor/runner.mjs`) logged exactly one mechanical-pass failure for this file over 190+ ticks of a live
 * overnight run, and it turned out to be undiagnosable — see {@link STOP_RETRY_BACKOFF_MS} and the file header
 * comment above {@link stopSession}'s import for why: `claude stop`'s own upstream flakiness ("claude stop's
 * reported success is a hint, not a certainty", issues #65925/#45250/#41461) is a KNOWN, generally-transient
 * class of failure this file already treats as benign for the "reported success but listing lags" direction —
 * a genuine non-`No job matching` `claude stop` error (a momentary CLI-internal lock/timeout under this
 * environment's own live concurrency — dozens of `claude` invocations across dispatch, review and mechanical
 * passes racing the same session registry at once) is the SAME class, just the inverse direction (a real
 * failure that is likely to clear on its own). Retrying beats leaving it to the next tick two ways: it usually
 * recovers the stop immediately, and — because ONE candidate failure marks the WHOLE pass's own exit code
 * failed below (`process.exit(failures > 0 || anomalies > 0 ? 1 : 0)`, kept intentional — see that comment) —
 * it stops a single transient blip from making an otherwise-clean sweep read as a mystery crash to the runner.
 * Concurrency was stress-tested live (25 concurrent `claude stop` + 10 concurrent `claude agents --json --all`
 * calls at once, repeatedly) without reproducing a hard failure — so a short, bounded retry is expected to
 * clear a real one; it is not chasing a reproduced deterministic bug because there isn't one to chase.
 */
export const STOP_RETRY_ATTEMPTS = 3;

/** Backoff (ms) before retry attempt 2 and attempt 3 respectively (index 0 = wait before the 2nd attempt) —
 *  short, since the live stress test above found no contention surviving even a fraction of a second; long
 *  enough to clear a momentary CLI-internal lock without meaningfully delaying the tick. */
export const STOP_RETRY_BACKOFF_MS = [300, 900];

/**
 * {@link stopSession}, retried up to {@link STOP_RETRY_ATTEMPTS} times with {@link STOP_RETRY_BACKOFF_MS}
 * backoff between attempts, for a transient `claude stop` failure — see {@link STOP_RETRY_ATTEMPTS}'s own doc
 * for why this exists and why it lives HERE (the IO shell's own retry policy) rather than inside
 * {@link stopSession} itself (`dispatch-abort.mjs`'s other callers, e.g. `wake.mjs`'s interactive abort, want
 * the FIRST failure surfaced immediately, not silently retried behind the operator's back). Never retries an
 * `alreadyGone` answer — that is not a failure, `stopSession` already resolves it. Injectable `sleep` so a test
 * proves the retry without a real wall-clock wait.
 * @param {{handle:string, exec?:Function, sleep?:(ms:number)=>void, attempts?:number, backoffMs?:number[]}} o
 * @returns {{stopped:true, alreadyGone:boolean, output:string}}
 */
export function stopSessionWithRetry({ handle, exec = execFileSync, sleep = sleepSyncMs, attempts = STOP_RETRY_ATTEMPTS, backoffMs = STOP_RETRY_BACKOFF_MS } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return stopSession({ handle, exec });
    } catch (e) {
      lastErr = e;
      if (attempt < attempts) sleep(backoffMs[attempt - 1] ?? backoffMs[backoffMs.length - 1]);
    }
  }
  throw lastErr;
}

// ── THE #77683 REPAIR — clear-stuck-session, driven with a TRUSTED `proceed` (see the file header) ───────────

/**
 * THE autoConfirm POLICY for a `clear-stuck-session` run THIS FILE drives ITSELF — never the interactive CLI
 * (`run.mjs clear-stuck-session --session=<id>` wires no `autoConfirm` at all, so a manual invocation still
 * stops for a human exactly as that operation's own header describes). Scoped as narrowly as it can be: it
 * answers ONLY the one `authorize` confirm step this ONE operation declares (`step === 'authorize'`, `of ===
 * 'operator'` — both checked, belt-and-braces, even though this policy is never handed any OTHER declaration's
 * `pending`) and it answers the SAME way every time, `proceed` — it is not a judgement call, it is this
 * reaper's own already-established trust (see the file header's "THE #77683 REPAIR" section) expressed as a
 * value. It never manufactures a move: `clear-stuck-session.mjs#planMove` still refuses unless `assessStuck`
 * separately confirmed the session stuck, so a `proceed` here only ever PERMITS a move the verdict already
 * found genuine, exactly as it would for a human answering the same question.
 *
 * @param {{kind?: string, step?: string, of?: string}|null} pending - the run's `pending` record.
 * @returns {{value: 'proceed'}|null}
 */
export function clearStuckSessionAutoConfirm(pending) {
  if (!pending || pending.kind !== 'confirm' || pending.step !== 'authorize' || pending.of !== 'operator') return null;
  return { value: 'proceed' };
}

/**
 * ATTEMPT the `clear-stuck-session` repair for ONE handle whose `claude stop` genuinely failed (not
 * `alreadyGone` — {@link stopSessionWithRetry} already resolves that on its own) — the #77683 shape this
 * reaper could previously do nothing about beyond logging a failure. Drives the DECLARED operation end to end
 * — `read` → `assess` → `authorize` (auto-answered, see {@link clearStuckSessionAutoConfirm}) → `move` (an
 * `effect`, applied through the real sink) — building a fresh registry per call, exactly as `we:scripts/
 * operations/review-loop-cli.mjs` does for ITS own unattended driver.
 *
 * NEVER TURNS "UNCONFIRMED" INTO "CLEARED". `assessStuck`'s verdict is read back off the completed run
 * (`outcome.run.verdict.confirmedStuck`) — a run that completes with `confirmedStuck: false` (a real liveness
 * signal, a bound run-store record, a state other than `"blocked"` …) reports `cleared: false`, and the
 * candidate is left exactly as the ORIGINAL `claude stop` failure the caller already logged. So is a run that
 * for any other reason does not reach `stopped: 'complete'` (a `step-refused`, an `effect-halted` move).
 *
 * @param {object} o
 * @param {string} o.handle - the short session id (`session.id`), the SAME handle `stopSessionWithRetry` just
 *   failed on.
 * @param {(o: {session: string, pr: number}) => object} [o.readStuckFacts] - injected so a test never touches
 *   real `fs`/`claude`/`ps`; the real caller (`main()` below) uses the real reader.
 * @param {Record<string, Function>} [o.sinks] - the `QUARANTINE_MOVE_EFFECT` sink table.
 * @param {{read: Function, write: Function}} [o.store] - the operation run-store; defaults to the real file
 *   store so a reaper-driven clear leaves the SAME kind of audit trail a manual `run.mjs clear-stuck-session`
 *   invocation would.
 * @param {() => string} [o.mintRunId]
 * @returns {Promise<{cleared: boolean, runId: (string|null), stopped: string, confirmedStuck: boolean, reason: string}>}
 */
export async function attemptClearStuckSession({
  handle,
  readStuckFacts = createClearStuckSessionReader(),
  sinks = createClearStuckSessionSinks(),
  store = createFileRunStore(),
  mintRunId = () => newRunId(CLEAR_STUCK_SESSION_OP),
} = {}) {
  const registry = createRegistry();
  const declaration = clearStuckSessionOperation({ readStuckFacts });
  registry.register(declaration);

  const run = startRun({ op: declaration.name, id: mintRunId(), input: { session: handle }, registry });
  store.write(run);

  const outcome = await driveRun({
    run,
    registry,
    store,
    sinks,
    // `clear-stuck-session` declares no `judge` step — this must never be called; a loud refusal beats a
    // silent stub returning nothing meaningful if that ever stops being true.
    judge: async () => {
      throw new Error('session-reaper: clear-stuck-session declared a `judge` step this caller cannot answer');
    },
    autoConfirm: clearStuckSessionAutoConfirm,
    attemptedBy: 'session-reaper',
  });

  const confirmedStuck = outcome.run?.verdict?.confirmedStuck === true;
  const cleared = confirmedStuck && outcome.stopped === 'complete';
  const reason = confirmedStuck
    ? (cleared
      ? 'confirmed stuck (assessStuck) and cleared'
      : `confirmed stuck but the run did not complete (stopped: ${outcome.stopped}${outcome.error ? `, error: ${String(outcome.error?.message || outcome.error).split('\n')[0]}` : ''})`)
    : (outcome.run?.verdict?.reason || 'clear-stuck-session did not confirm this session as stuck');

  return { cleared, runId: outcome.run?.id ?? null, stopped: outcome.stopped, confirmedStuck, reason };
}
