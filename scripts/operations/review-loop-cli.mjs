#!/usr/bin/env node
/**
 * @file scripts/operations/review-loop-cli.mjs
 * @description #3072's REMAINING SLICE, MADE CALLABLE — drives ONE `review-pr` run unattended, using
 * `we:scripts/lib/review-loop-policy.mjs`'s ratified confirm policy, and files a notification either way the
 * policy leaves a debt behind: the queued-accept notice when it DECLINES a clean `accept` (`review:human`) — or,
 * since the #2749 fix (2026-09-26), MECHANICALLY FILES the owed prevention guard(s) as a real backlog card
 * through the declared `file-item` operation and resumes the SAME run with `accept` itself, when the verdict is
 * `prevention-outstanding` on the agent-addressed (`review:pending`) tier. That second case is NEVER surfaced to
 * a human (2026-09-26 scope ruling: filing the follow-up is not a decision an operator needs to make) — see
 * `review-loop-policy.mjs`'s header for the full account of why `#3442`'s old mechanical-accept-without-filing
 * was reversed and replaced rather than merely reverted.
 *
 *   node scripts/operations/review-loop-cli.mjs --pr=1234 --repo=chalbert/web-everything --cwd=<a lane>
 *   node scripts/operations/review-loop-cli.mjs --resume=<run-id> --repo=chalbert/web-everything --pr=1234
 *
 * WHY THIS IS A SEPARATE ENTRY POINT FROM `run.mjs review-pr`, NOT A FLAG ON IT. `runOperationCli`
 * (`we:scripts/operations/cli-adapter.mjs`) drives every declared operation for a HUMAN at a terminal — it
 * calls `driveRun` with `attemptedBy: 'human'` and no `autoConfirm`, which is exactly right for that caller.
 * Threading an `--unattended` flag through the GENERIC adapter would let every OTHER declared operation opt
 * into a review-specific policy it knows nothing about — the same "a declaration's own concern leaking into
 * the shared adapter" shape `review-pr.mjs` itself refuses at its `read` step (`assertMandatoryLensSeated`
 * lives on the declaration, not on `cli-adapter.mjs`). So this operation's unattended path gets its own thin
 * entry point, the same way `we:scripts/operations/dispatch-abort.mjs` is its own plain module rather than a
 * mode of `run.mjs`.
 *
 * WHAT THIS FILE OWNS, AND ONLY THIS: wiring `driveRun`'s generic `autoConfirm` seam to the CONCRETE policy,
 * filing the queued-accept notification when that policy declines a clean accept, and — the #2749 addition —
 * mechanically filing the owed prevention card + auto-resuming to accept when the policy declines a
 * `prevention-outstanding` verdict. Everything else is reused, not re-derived: `run.mjs`'s own operation table
 * (`resolveOperation`, `createCliJudgeFactory`) builds the exact same declaration/registry/sinks/judge the human
 * CLI uses (for BOTH `review-pr` and, now, the nested `file-item` call), and
 * `we:scripts/operations/cli-adapter.mjs`'s own `parseOperationArgv` / `renderOutcome` / `runOperationCli` /
 * `restartCommand` render every stop this shares with the human path — so a bug fixed in either place is fixed
 * here too, and the two callers can never quietly drift on what a stop MEANS.
 *
 * THE ROUND CAP NEEDS NOTHING NEW HERE (see `review-loop-policy.mjs`'s header for the full account): by the
 * time this file sees a run, `run.verdict.loop` is already `converged` / `in-progress` / `exhausted` /
 * `escalated`, computed by `deriveLoopOutcome` off the verdict ledger's own history. `--json` already prints
 * it (`outcomePayload`'s `verdict` field IS the whole `reduce` finding). This file's plain-text output names
 * it explicitly anyway, so a human skimming stdout for "did this bounce cleanly or run out of rounds" is not
 * forced to parse JSON to find out.
 *
 * ONE ROUND PER INVOCATION, DELIBERATELY. Re-judging the SAME diff twice in one process is not what the round
 * cap is FOR — round N+1 exists only once the diff has actually changed (a fix landed), which happens in a
 * different process entirely. So this script drives exactly one read→judge→judgeSecurity→reduce→confirm
 * [→record] pass and exits; the loop ACROSS rounds is realized by re-invoking it once the PR's diff moves —
 * `#3279`'s dispatched session's job every time it runs, never a `while` loop inside this file. The ONE
 * exception is the mechanized prevention-filing branch below, which resumes the SAME run a second time within
 * THIS SAME invocation — that is not a second round (the diff has not changed), it is completing the ONE round
 * that was already decided, the same way a human's own `--answer=accept` resume would.
 *
 * IMPURE: spawns jurors (via the injected judge), writes run records, files a real backlog card through
 * `file-item` on a `prevention-outstanding` verdict, and — only on a queued clean accept — appends one line to
 * the learnings pool. Everything DECISION-shaped is imported from a pure module (`review-loop-policy.mjs`);
 * nothing here decides, it only wires and reports.
 */

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  cwdFlagValue, driveRun, hasJsonFlag, outcomePayload, parseOperationArgv, renderOutcome, runOperationCli,
} from './cli-adapter.mjs';
import { startRun, runStatus } from './engine.mjs';
import { createFileRunStore, newRunId } from './run-store.mjs';
import { resolveOperation, createCliJudgeFactory } from './run.mjs';
import { appendEntry } from '../conveyor/learnings-drop.mjs';
import {
  acceptResumeCommand, buildAcceptQueueEntry, buildPreventionFilingInput, buildPreventionQueueEntry,
  isPreventionOutstandingClear, isPreventionOutstandingParked, isQueuedAcceptStop, reviewLoopAutoConfirm,
} from '../lib/review-loop-policy.mjs';
import { hasUncapturedPrevention } from '../lib/jury-core.mjs';
import { writeAllSync } from '../lib/write-all-sync.mjs';

/** The operation this driver always runs. Not a flag: this file has exactly one job. */
export const REVIEW_LOOP_OP = 'review-pr';

/**
 * #xu2pp2m — WHO A RUN THROUGH THIS ENTRY POINT IS ATTRIBUTED TO, when the caller named nobody.
 *
 * `review-pr`'s `actor` field defaults to `'operator'` (`we:scripts/operations/review-pr.mjs`), which is
 * exactly right for `run.mjs review-pr` — a HUMAN at a terminal answering `confirm` themselves. It is exactly
 * WRONG here: this file is the unattended driver, it already tells `driveRun` `attemptedBy: 'agent'`, and
 * nothing about the run involves an operator at all. Live-caught 2026-09-12 (PR #2122): a fully mechanical
 * clear recorded its durable verdict as `Recorded by operator.` and its operator notice as
 * `PR … — human review accepted by operator.` — a machine-made clear, indistinguishable downstream from one a
 * person actually looked at.
 *
 * THE DEFAULT MOVES, THE FLAG DOES NOT. A caller who passes `--actor=<name>` still gets exactly that name
 * (`applyUnattendedActorDefault` only fills in an absent one), so the human-driven `--resume … --answer=accept`
 * ceremony — which goes through this file too, with `--actor=` supplied — is unchanged.
 */
export const UNATTENDED_REVIEW_ACTOR = 'agent (unattended review-loop)';

/**
 * PURE — the input a run started through this driver should carry. Fills `actor` with
 * {@link UNATTENDED_REVIEW_ACTOR} only when the invocation named none.
 *
 * WHY IT READS RAW `argv` AND NOT `parsed.input.actor`. The declaration's own `default: 'operator'` has
 * ALREADY been applied by the time `parseOperationArgv` returns, so `parsed.input.actor === 'operator'` is
 * indistinguishable between "nobody said" and "somebody typed `--actor=operator`". Raw argv is the only place
 * that distinction still exists — the same reason `cwdFlagValue`/`hasJsonFlag` read argv directly.
 *
 * @param {object} input - `parseOperationArgv`'s `input`.
 * @param {string[]} argv
 * @returns {object}
 */
export function applyUnattendedActorDefault(input, argv = []) {
  const named = argv.some((t) => typeof t === 'string' && (t === '--actor' || t.startsWith('--actor=')));
  if (named) return input;
  return { ...input, actor: UNATTENDED_REVIEW_ACTOR };
}

/**
 * THE PRODUCTION `fileItem` BINDING (#2749) — drives the declared `file-item` operation to completion, IN
 * PROCESS, exactly the way `run.mjs file-item --json --title=… …` would from a terminal (same
 * `resolveOperation`/`runOperationCli` this file already uses for `review-pr` itself), so filing the owed
 * prevention card reuses the SAME declaration/effects/refusals a human's own `file-item` invocation gets,
 * never a re-derived shortcut. `file-item` has no `confirm`/`judge` step (every step is `compute`/`effect`), so
 * this always settles in ONE `driveRun` sweep — no `makeJudge`, no resume.
 *
 * A FRESH `createFileRunStore()` PER CALL, not the caller's own `review-pr` store: `file-item` is a DIFFERENT
 * operation with its own run-record namespace (`we:scripts/operations/run-store.mjs` keys records by run id,
 * which `newRunId(declaration.name)` already scopes per-operation) — reusing the review-pr store would work by
 * accident (`driveRun` starts a fresh run either way) but would mix two operations' records under one store
 * instance for no reason. `.operations/runs/` is gitignored, so this leaves no stray file in the diff.
 *
 * @param {{title:string,kind:string,size:string,digest:string,scope:string,parent:string,queue:string}} input -
 *   {@link module:review-loop-policy.buildPreventionFilingInput}'s own output.
 * @param {{resolve?: Function, run?: Function, makeStore?: Function}} [deps] - test seams only; production
 *   always uses the real `resolveOperation`/`runOperationCli`/`createFileRunStore`.
 * @returns {Promise<{code:number, lines:string[]}>}
 */
export async function fileItemForPrevention(input, {
  resolve = resolveOperation, run = runOperationCli, makeStore = createFileRunStore,
} = {}) {
  const argv = [
    `--title=${input.title}`,
    `--kind=${input.kind}`,
    `--size=${input.size}`,
    `--digest=${input.digest}`,
    `--scope=${input.scope}`,
    ...(input.parent ? [`--parent=${input.parent}`] : []),
    `--queue=${input.queue}`,
    '--json',
  ];
  const { declaration, registry, sinks } = resolve('file-item', { json: true });
  return run({
    declaration, argv, registry, store: makeStore(), sinks, newRunId: () => newRunId('file-item'),
  });
}

/**
 * DRIVE ONE ROUND, UNATTENDED. The whole file, as a function — mirrors `we:scripts/operations/cli-adapter.mjs
 * #runOperationCli`'s shape closely, on purpose, so the two are easy to read side by side and hard to let
 * drift silently: same parse, same start-or-resume, same render. The differences are exactly the two things
 * this file exists for — `autoConfirm` on the `driveRun` call, and the queued-accept branch after it returns.
 *
 * @param {object} o
 * @param {object} o.declaration - the `review-pr` declaration (a fresh one per call; see the CLI block).
 * @param {object} o.registry
 * @param {string[]} o.argv
 * @param {{read: Function, write: Function}} o.store
 * @param {Record<string, Function>} o.sinks
 * @param {(o: {cwd: (string|null), model: (string|null), provider: (string|null)}) => Function} o.makeJudge
 * @param {() => string} o.mintRunId
 * @param {(pending: object|null, run: object) => ({value: string}|null)} [o.autoConfirm] - injected so a test
 *   can supply a stub; the real caller always passes {@link reviewLoopAutoConfirm}.
 * @param {(entry: object, opts: object) => {record: object, path: string}} [o.appendLearning] - injected so a
 *   test never touches the real pool file; the real caller always passes `learnings-drop.mjs#appendEntry`.
 * @param {string} [o.session] - the learnings-pool session slug the queued-accept entry files under.
 * @param {(input: object) => Promise<{code: number, lines: string[]}>} [o.fileItem] - #2749: files the owed
 *   prevention card through the declared `file-item` operation. Injected so a test never touches the real
 *   backlog/queue files; the real caller always passes {@link fileItemForPrevention}.
 * @returns {Promise<{code: number, lines: string[], run: (object|null), stopped: string}>}
 */
export async function runReviewLoopOnce({
  declaration, registry, argv, store, sinks, makeJudge, mintRunId, autoConfirm = reviewLoopAutoConfirm,
  appendLearning = appendEntry, session = 'review-loop', fileItem = fileItemForPrevention,
} = {}) {
  const parsed = parseOperationArgv(declaration, argv);
  if (parsed.control.help) {
    const { buildCliSpec } = await import('./cli-adapter.mjs');
    return { code: 0, lines: [buildCliSpec(declaration).usage], run: null, stopped: 'help' };
  }
  if (!parsed.ok) {
    const { buildCliSpec } = await import('./cli-adapter.mjs');
    return {
      code: 2,
      lines: [...parsed.errors.map((e) => `error: ${e}`), '', buildCliSpec(declaration).usage],
      run: null,
      stopped: 'refused',
    };
  }

  const activeJudge = makeJudge({
    cwd: parsed.control.cwd || null, model: parsed.control.model || null, provider: parsed.control.provider || null,
  });

  let run;
  if (parsed.control.resume) {
    run = store.read(parsed.control.resume);
    if (!run) return { code: 2, lines: [`error: no run record for ${JSON.stringify(parsed.control.resume)}`], run: null, stopped: 'refused' };
    if (run.op !== declaration.name) {
      return { code: 2, lines: [`error: run ${run.id} is a \`${run.op}\` run, not \`${declaration.name}\``], run: null, stopped: 'refused' };
    }
  } else {
    run = startRun({
      op: declaration.name,
      id: parsed.control.runId || mintRunId(),
      // #xu2pp2m — see `applyUnattendedActorDefault`: this driver is the UNATTENDED one, so an unnamed actor
      // is an agent, never `review-pr`'s own human-terminal `'operator'` default.
      input: applyUnattendedActorDefault(parsed.input, argv),
      registry,
    });
    store.write(run);
  }

  let resume = null;
  if (parsed.control.answer != null) {
    const status = runStatus(run, { registry });
    if (status !== 'awaiting-confirm') {
      return {
        code: 2,
        lines: [`error: run ${run.id} is \`${status}\`, not awaiting a decision — refusing an --answer for a question that has not been asked.`],
        run,
        stopped: 'refused',
      };
    }
    resume = { step: run.pending.step, value: parsed.control.answer };
    for (const [field, value] of Object.entries(parsed.control.confirm)) {
      run = { ...run, input: { ...run.input, [field]: value } };
    }
    if (Object.keys(parsed.control.confirm).length) store.write(run);
  }

  // THE ONE LINE THIS FILE ADDS TO THE DRIVE CALL: an UNATTENDED policy, and `attemptedBy: 'agent'` so a
  // reader of the run's own step-timing record can tell this pass apart from a human at a terminal — the same
  // distinction `applyPendingEffects`'s `attemptedBy` already threads for its effect rows.
  const outcome = await driveRun({
    run, registry, store, sinks, judge: activeJudge, resume, autoConfirm, attemptedBy: 'agent',
  });

  // ── THE MECHANIZED PREVENTION-FILING BRANCH (#2749 fix, 2026-09-26 scope ruling) ─────────────────────────
  // `reviewLoopAutoConfirm` DECLINES a `prevention-outstanding` verdict (it must — filing a card is impure
  // I/O, and the policy stays pure). Filing the owed guard(s) is NOT a decision for an operator, so this is
  // NEVER surfaced as a queued-for-a-human notice: the loop files ONE real backlog card itself, through the
  // declared `file-item` operation (`buildPreventionFilingInput` — pure — derives its input from the SAME
  // findings the verdict already carries), cleared to the conveyor, and — only once that filing actually
  // succeeds — resumes THIS SAME run with the `accept` the policy would not answer itself. The debt is now
  // TRACKED (a real card, not a notice nobody is obligated to act on), so the #2823 "blocks a clean accept
  // until filed" gate is satisfied by construction. A FAILED filing does the opposite of the accept path: it
  // leaves the run parked EXACTLY as it was (nothing recorded) and reports the failure loudly — never
  // swallowed, and never advances to a mechanical accept over a debt that, this time, genuinely went unfiled.
  if (isPreventionOutstandingParked(outcome)) {
    const { pr, repo } = outcome.run.input;
    const filingInput = buildPreventionFilingInput({ repo, pr, findings: outcome.run.verdict.findings });
    let filed;
    let filingError = null;
    try {
      filed = await fileItem(filingInput);
      if (filed.code !== 0) filingError = `file-item refused: ${filed.lines.join(' / ')}`;
    } catch (e) {
      filingError = String(e?.message ?? e);
    }

    if (filingError) {
      const rendered = renderOutcome({ outcome, json: parsed.control.json, declaration });
      if (parsed.control.json) {
        const payload = { ...JSON.parse(rendered.lines[0]), preventionFilingError: filingError };
        return { code: 1, lines: [JSON.stringify(payload, null, 2)], run: outcome.run, stopped: outcome.stopped };
      }
      return {
        code: 1,
        lines: [
          ...rendered.lines, '',
          `FAILED to file the owed prevention card mechanically: ${filingError}`,
          'The run stays parked — nothing was recorded, and this verdict is never auto-cleared unfiled.',
        ],
        run: outcome.run,
        stopped: outcome.stopped,
      };
    }

    const filedPayload = JSON.parse(filed.lines[0] ?? '{}');
    const filedNum = filedPayload?.verdict?.num ?? null;
    const filedRel = filedPayload?.verdict?.rel ?? null;

    // THE CARD IS FILED AND TRACKED — resume THIS SAME run with the mechanical `accept` the policy itself
    // declined to answer, so the label swap + durable comment apply exactly as a clean accept's would.
    const acceptResume = { step: outcome.run.pending.step, value: 'accept' };
    const acceptedOutcome = await driveRun({
      run: outcome.run, registry, store, sinks, judge: activeJudge, resume: acceptResume, autoConfirm, attemptedBy: 'agent',
    });
    const rendered = renderOutcome({ outcome: acceptedOutcome, json: parsed.control.json, declaration });
    if (parsed.control.json) {
      const payload = {
        ...JSON.parse(rendered.lines[0]),
        preventionFiled: { num: filedNum, path: filedRel },
      };
      return { code: rendered.code, lines: [JSON.stringify(payload, null, 2)], run: acceptedOutcome.run, stopped: acceptedOutcome.stopped };
    }
    return {
      code: rendered.code,
      lines: [
        ...rendered.lines, '',
        `prevention guard(s) filed mechanically — ${filedRel ?? '(no path)'} (#${filedNum ?? '?'}), cleared to `
        + 'the conveyor; no human was asked.',
      ],
      run: acceptedOutcome.run,
      stopped: acceptedOutcome.stopped,
    };
  }

  // ── THE QUEUED-ACCEPT BRANCH — the one behaviour `runOperationCli` does not have ──────────────────────────
  // The policy already declined a CLEAN accept on a `review:human` PR (see `review-loop-policy.mjs`); this
  // only decides whether to FILE the notification and say so, or fall through to the SAME rendering the
  // human CLI would give an ordinary confirm stop. `prevention-outstanding` NEVER reaches this branch — see
  // the mechanized branch above, which handles that verdict before this one is ever consulted.
  //
  // #x100grep — EVERY EXIT OF THIS FUNCTION CARRIES `run.verdict.loop` THROUGH UNMODIFIED, this branch
  // included. A future caller (the reconcile/runner wiring this item deliberately does not build, or a human)
  // decides whether to dispatch ANOTHER round or stop by reading `converged`/`in-progress`/`exhausted`/
  // `escalated` off exactly this field — so a branch that rendered its own bespoke JSON shape here, without
  // it, would be the one stop a caller most needs the loop status at (a clean review is precisely the round
  // that would otherwise look done) and the one stop that omitted it.
  if (isQueuedAcceptStop(outcome)) {
    const { pr, repo } = outcome.run.input;
    const entry = buildAcceptQueueEntry({ repo, pr, runId: outcome.run.id });
    const resumeCmd = acceptResumeCommand({ runId: outcome.run.id, repo, pr });
    let filed = null;
    let filingError = null;
    try {
      filed = appendLearning(entry, { session });
    } catch (e) {
      // A FAILED FILING DOES NOT UN-PARK THE RUN. The run is still safely suspended — nothing was answered —
      // so the worst this costs is a human finding out later than they might have, never a wrongly-recorded
      // accept. Reported loudly rather than swallowed, because "the notification silently never went out" is
      // exactly the failure mode this branch exists to avoid.
      filingError = String(e?.message ?? e);
    }

    if (parsed.control.json) {
      const payload = {
        ...outcomePayload({ run: outcome.run, stopped: outcome.stopped, ownedBy: declaration.ownedBy }),
        queued: 'accept-needs-human',
        resumeCommand: resumeCmd,
        filedTo: filed ? filed.path : null,
        ...(filingError ? { filingError } : {}),
      };
      return { code: filingError ? 1 : 0, lines: [JSON.stringify(payload, null, 2)], run: outcome.run, stopped: outcome.stopped };
    }
    return {
      code: filingError ? 1 : 0,
      lines: [
        `run ${outcome.run.id} — QUEUED for a human: ${repo}#${pr}'s review reduced to ACCEPT.`,
        'An unattended agent actor never records an accept — that verdict now needs a human to clear it on '
        + 'their own time.',
        ...(filingError
          ? [`FAILED to file the learnings-pool notice: ${filingError}`]
          : [`filed → ${filed.path}`]),
        `clear it: ${resumeCmd}`,
      ],
      run: outcome.run,
      stopped: outcome.stopped,
    };
  }

  // ── THE PREVENTION-FILED BRANCH — reachable only via a HUMAN's manual `--answer=accept` resume of a
  // previously-parked `prevention-outstanding` run (`#3442`'s automatic version, answered by `reviewLoopAutoConfirm`
  // itself, was REVERSED by the #2749 fix above — see that function's doc). A human who read the queued notice,
  // decided to file (or already had) the named guard(s), and resumed with `--answer=accept` still gets this
  // same file-then-notify treatment: the accept already recorded (a human answered it), so this only files the
  // named guard(s) as the notification, then falls through to the ordinary rendering below (an `accept`
  // outcome, same as a genuinely clean verdict would render) with the filing result spliced in.
  if (isPreventionOutstandingClear(outcome)) {
    const { pr, repo } = outcome.run.input;
    // PER-FINDING, NOT PER-RUN (review, finding 1). `buildPreventionQueueEntry` REFUSES rather than truncates
    // a guard whose own text overflows `FIELD_CAPS` (see that function) — a single oversized `prevention`
    // string must not (a) crash this whole invocation uncaught (the accept already recorded; a caller with no
    // try/catch of its own would get an unhandled rejection over a PR that already cleared) or (b) block filing
    // every OTHER guard in the same run that would have fit. So both the BUILD and the APPEND are inside one
    // try/catch, per finding — one bad guard's failure is isolated and reported, the rest still file.
    const filedPaths = [];
    const buildOrFileErrors = [];
    for (const finding of outcome.run.verdict.findings.filter(hasUncapturedPrevention)) {
      try {
        const entry = buildPreventionQueueEntry({ repo, pr, runId: outcome.run.id, finding });
        filedPaths.push(appendLearning(entry, { session }).path);
      } catch (e) {
        // NEITHER FAILURE UN-DOES THE ACCEPT — it already recorded. The worst this costs is a human finding
        // out about this one unfiled guard later than they might have; reported loudly rather than swallowed,
        // same posture as the queued-accept branch's own filing failure.
        buildOrFileErrors.push(String(e?.message ?? e));
      }
    }
    const filingError = buildOrFileErrors.length ? buildOrFileErrors.join('; ') : null;

    if (parsed.control.json) {
      // FIXED (independent review of PR #1784, CONFIRMED): this used to hardcode `code: filingError ? 1 : 0`,
      // ignoring `outcome.stopped` entirely — the SAME `renderOutcome`-bypass shape the plain-text branch
      // below never had (it already delegates to `rendered.code`, which IS `renderOutcome`'s own stopped-aware
      // value). `isPreventionOutstandingClear` narrows entry to this branch to the two genuine-success stops
      // (`'complete'`, `'effect-in-flight'`), so `baseCode` is 0 in the only cases this branch runs today —
      // but deriving it from `outcome.stopped`, the same success set `renderOutcome`'s own JSON path uses
      // (minus `'confirm'`, not reachable here), keeps this branch correct on its own terms rather than
      // correct only because a guard elsewhere happens to protect it.
      const baseCode = outcome.stopped === 'complete' || outcome.stopped === 'effect-in-flight' ? 0 : 1;
      const payload = {
        ...outcomePayload({ run: outcome.run, stopped: outcome.stopped, ownedBy: declaration.ownedBy }),
        preventionFiled: filedPaths,
        ...(filingError ? { preventionFilingError: filingError } : {}),
      };
      return { code: filingError ? 1 : baseCode, lines: [JSON.stringify(payload, null, 2)], run: outcome.run, stopped: outcome.stopped };
    }
    const rendered = renderOutcome({ outcome, json: false, declaration });
    return {
      code: filingError ? 1 : rendered.code,
      lines: [
        ...rendered.lines,
        '',
        `prevention-outstanding auto-cleared to accept — ${filedPaths.length} named guard(s) filed to the `
        + 'learnings pool:',
        ...filedPaths.map((p) => `  filed → ${p}`),
        ...(filingError ? [`FAILED to file (some guard(s) may be unfiled): ${filingError}`] : []),
      ],
      run: outcome.run,
      stopped: outcome.stopped,
    };
  }

  const rendered = renderOutcome({ outcome, json: parsed.control.json, declaration });
  // THE LOOP STATUS, NAMED IN WORDS, on a stop this file did not special-case (a bounce that landed, a stop
  // exhausted at the cap, an ordinary human-addressed park). `--json` already carries `run.verdict.loop`
  // inside the printed `verdict` field (via `outcomePayload`, which `renderOutcome` calls); this adds nothing
  // new to the record, only to what a human reads first.
  const loop = outcome.run?.verdict?.loop;
  const loopLine = (!parsed.control.json && loop && typeof loop === 'object')
    ? [`review loop: ${loop.outcome} — ${loop.why}`]
    : [];
  return { ...rendered, lines: [...rendered.lines, ...loopLine], run: outcome.run, stopped: outcome.stopped };
}

const IS_CLI = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (IS_CLI) {
  const argv = process.argv.slice(2);
  // `argv` is known before the declaration `resolveOperation` binds sinks to — see `hasJsonFlag`'s doc
  // (`we:scripts/operations/cli-adapter.mjs`). A `--json` invocation must not have this file's own notice
  // effect (fired mid-run, well before the final JSON line below) land on the same stdout stream.
  // #xu2pp2m — `cwd` for the SAME pre-parse reason as `json` (see `cwdFlagValue`). THIS entry point is the
  // one a dispatched/mechanical review runs through, and it is ALWAYS given a lane, so before this the diff it
  // judged came from `REPO_ROOT` on every single unattended review ever run (PR #2122 merged on it).
  const { declaration, registry, sinks } = resolveOperation(
    REVIEW_LOOP_OP, { json: hasJsonFlag(argv), cwd: cwdFlagValue(argv) },
  );
  runReviewLoopOnce({
    declaration,
    registry,
    argv,
    store: createFileRunStore(),
    sinks,
    makeJudge: createCliJudgeFactory(),
    mintRunId: () => newRunId(declaration.name),
  })
    .then(({ code, lines }) => {
      writeAllSync(1, `${lines.join('\n')}\n`);
      process.exit(code);
    })
    .catch((e) => {
      writeAllSync(1, `error: ${String(e?.message ?? e)}\n`);
      process.exit(1);
    });
}

