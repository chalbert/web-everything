#!/usr/bin/env node
/**
 * @file scripts/operations/run.mjs
 * @description THE OPERATION COMMAND LINE (#3035, under epic #3029) — `run.mjs <operation> [flags]`.
 *
 * THE WHOLE ENTRY POINT. There is no per-operation argv parser and no per-operation route: {@link
 * ./cli-adapter.mjs} derives both from the declaration, and this file only says WHICH operations exist and what
 * their io bindings are. Declaring a second operation adds one entry to {@link OPERATIONS} and buys its command
 * line; that is clause 1 of
 * [#operations-declared-once-callers-generated](../../docs/agent/platform-decisions.md#operations-declared-once-callers-generated)
 * in the smallest form it can take.
 *
 *   node scripts/operations/run.mjs review-pr --pr=1234 --repo=chalbert/web-everything
 *   node scripts/operations/run.mjs review-pr --resume=<run-id> --answer=accept
 *   node scripts/operations/run.mjs review-pr --resume=<run-id> --answer=abstain   # writes nothing
 *
 * The first invocation reads, judges, reduces and then STOPS at the `confirm` suspend. The second records. An
 * `--answer` on the first is refused — see the adapter's header.
 */

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createRegistry } from './registry.mjs';
import { createFileRunStore, newRunId } from './run-store.mjs';
import { createDefaultJudge, runOperationCli, buildCliSpec } from './cli-adapter.mjs';
import { reviewPrOperation, REVIEW_PR_OP } from './review-pr.mjs';
import { createReviewPrReader, createReviewPrSinks } from './review-pr-io.mjs';
import { reviewPrepOperation, REVIEW_PREP_OP } from './review-prep.mjs';
import { createReviewPrepReader, createReviewPrepSinks } from './review-prep-io.mjs';
import { suggestNextOperation, SUGGEST_NEXT_OP } from './suggest-next.mjs';
import { createBoardReader, createExclusionReader } from './suggest-next-io.mjs';
import { gateHealthOperation, GATE_HEALTH_OP, classifyFollowUp } from './gate-health.mjs';
import { createHistoryReader } from './gate-health-io.mjs';
import { dispatchLaneOperation, DISPATCH_LANE_OP } from './dispatch-lane.mjs';
import { createTickReader, createDispatchSinks, agentArgsFromEnv } from './dispatch-lane-io.mjs';
import { claimOperation, CLAIM_OP } from './claim.mjs';
import { createClaimReader, createClaimSinks } from './claim-io.mjs';
import { exploreOperation, EXPLORE_OP } from './explore.mjs';
import { createExploreSinks, agentArgsFromEnv as exploreAgentArgsFromEnv } from './explore-io.mjs';
import { writeAllSync } from '../lib/write-all-sync.mjs';

/**
 * THE OPERATION TABLE — the only per-operation code in the command line. Each entry builds its declaration and
 * its io bindings; everything else is derived.
 *
 * `suggest-next` (#3036) is the proof that "declaring a second operation buys its command line" is literally
 * true: the four lines below are the ENTIRE command-line cost of it. No argv parser, no usage text, no
 * validation — `--help` prints `[--tier=A|B, default A] …` because the declaration says so. The same
 * declaration is what {@link ./http-adapter.mjs} derives a route table from, with no third entry anywhere.
 */
export const OPERATIONS = Object.freeze({
  [REVIEW_PR_OP]: () => ({
    declaration: reviewPrOperation({ readPr: createReviewPrReader() }),
    sinks: createReviewPrSinks(),
  }),
  // backlog/xzdi27a-* — the sibling of `review-pr` for a BACKLOG CARD instead of a PR diff (no `gh`, no diff,
  // no confirm suspend: a prep review's verdict is a note + a commit, applied in one CLI call end to end).
  [REVIEW_PREP_OP]: () => ({
    declaration: reviewPrepOperation({ readPrep: createReviewPrepReader() }),
    sinks: createReviewPrepSinks(),
  }),
  [SUGGEST_NEXT_OP]: () => ({
    declaration: suggestNextOperation({
      loadBoard: createBoardReader(),
      loadExclusions: createExclusionReader(),
    }),
    // NO SINKS, AND NOT AN OVERSIGHT: every step is `compute`, so the declaration cannot produce an effect
    // for a sink to apply. `applyPendingEffects` is never reached, and the HTTP adapter reads the same step
    // kinds to give this operation a GET-only, record-free surface.
    sinks: {},
  }),
  // Registering here is what makes `gate-health` callable at all. It shipped unregistered in PR #1163, so
  // `resolveOperation` threw and its "callable from the command line and over HTTP" claim was false — the
  // reviewer could only run it by hand-writing the wiring. Same no-sinks reasoning as `suggest-next`.
  [GATE_HEALTH_OP]: () => ({
    declaration: gateHealthOperation({ loadHistory: createHistoryReader({ classify: classifyFollowUp }) }),
    sinks: {},
  }),
  // #3037 — the first operation whose effect STARTS work instead of finishing it. Its one sink launches a
  // delivery agent and returns an in-flight marker; the matching OBSERVER is registered by the waker
  // (`we:scripts/operations/wake.mjs`), which is the process that polls it. Both live in `dispatch-lane-io.mjs`.
  [DISPATCH_LANE_OP]: () => ({
    declaration: dispatchLaneOperation({ readTick: createTickReader() }),
    // `WE_DISPATCH_AGENT_ARGS` is read HERE rather than defaulted inside the sink: the permission mode, the
    // model and the effort a dispatched agent runs under are the operator's call, and a knob only a test can
    // reach is not a knob. Unset → no extra flags, which is the deliberate non-default (a baked-in
    // `--dangerously-skip-permissions` would widen every agent this ever launches).
    sinks: createDispatchSinks({ extraArgs: agentArgsFromEnv() }),
  }),
  // #3034 — the is-the-engine-too-heavy probe: `compute` → `compute` → `effect`, no judge, no confirm.
  // Registering here is what makes `node run.mjs claim --ref=<NNN>` work; `we:scripts/backlog.mjs claim`
  // (the real command-line caller) routes through the SAME declaration (`we:scripts/backlog.mjs`'s
  // `claimViaOperation`), not a second implementation.
  [CLAIM_OP]: () => ({
    declaration: claimOperation({ readClaimContext: createClaimReader() }),
    sinks: createClaimSinks(),
  }),
  // #3150 — the multi-agent committee. The SECOND operation whose effects start work instead of finishing it,
  // and the proof that #3037's long-running-effect machinery generalises: it reuses `dispatch: true` +
  // `inFlight(handle)` + the observer contract whole and adds no mechanism of its own. Its declaration takes NO
  // injected reader — every input is a declared field and the panel's reports arrive on the run record as the
  // `investigate` step's own finding — so this entry binds sinks only. The matching OBSERVER is registered by
  // the waker (`we:scripts/operations/wake.mjs`), which is the process that polls it.
  [EXPLORE_OP]: () => ({
    declaration: exploreOperation(),
    // The SAME `WE_DISPATCH_AGENT_ARGS` a dispatched delivery agent runs under, and deliberately not a second
    // knob: a committee panelist and a delivery agent are the same kind of spawned background session, so an
    // operator who set the permission mode for one meant it for both. Unset → no extra flags.
    sinks: createExploreSinks({ extraArgs: exploreAgentArgsFromEnv() }),
  }),
});

/** Build an isolated registry plus the bindings for ONE named operation. Throws on an unknown name. */
export function resolveOperation(name) {
  // `Object.hasOwn`, never a bare bracket read: `OPERATIONS['toString']` on a normal-prototype object returns an
  // INHERITED function, which a `typeof … === 'function'` test then accepts as a real operation. Same hazard the
  // jury enums guard with null-prototype tables (`we:scripts/lib/jury-core.mjs`, #xdompzx).
  const build = Object.hasOwn(OPERATIONS, String(name ?? '')) ? OPERATIONS[name] : undefined;
  if (typeof build !== 'function') {
    throw new Error(
      `operations: no operation named ${JSON.stringify(name)} (known: ${Object.keys(OPERATIONS).sort().join(', ')})`,
    );
  }
  const { declaration, sinks } = build();
  const registry = createRegistry();
  registry.register(declaration);
  return { declaration, registry, sinks };
}

/** The usage text when no operation is named. */
export function rootUsage() {
  return [
    'usage: run.mjs <operation> [--flags]',
    '',
    `operations: ${Object.keys(OPERATIONS).sort().join(', ')}`,
    '',
    'Run `run.mjs <operation> --help` for an operation\'s flags — they are derived from its declaration.',
  ].join('\n');
}

// The standard main check used across `we:scripts` — importing this module (tests do) must not run the CLI.
const IS_CLI = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (IS_CLI) {
  const [name, ...rest] = process.argv.slice(2);
  if (!name || name === '--help' || name === '-h') {
    writeAllSync(1, `${rootUsage()}\n`);
    process.exit(name ? 0 : 2);
  }
  let resolved;
  try {
    resolved = resolveOperation(name);
  } catch (e) {
    writeAllSync(1, `error: ${String(e.message ?? e)}\n\n${rootUsage()}\n`);
    process.exit(2);
  }
  const { declaration, registry, sinks } = resolved;
  if (rest.includes('--help')) {
    writeAllSync(1, `${buildCliSpec(declaration).usage}\n`);
    process.exit(0);
  }
  runOperationCli({
    declaration,
    argv: rest,
    registry,
    store: createFileRunStore(),
    sinks,
    // A TOOL-BEARING juror needs a lane of its OWN, and `assertLaneCwd` refuses the spawn without one. The
    // lane comes from the environment rather than being acquired here: this entry point must not lease a
    // resource whose release it cannot guarantee, and a caller that has not leased one should get the refusal.
    //
    // `?? null`, NEVER a fallback to this process's directory (PR #1178 review, blocking 1). An omitted cwd
    // used to reach `judgeSpawn`'s `process.cwd()` default, and since a review normally runs INSIDE a lane
    // that silently handed the juror the driver's own working tree — the very tree the parent was mid-review
    // of, and one the juror's mandate tells it to mutate. Passing `null` makes the refusal fire, which is what
    // the caller wanted all along. A tool-free juror ignores `cwd`, so every existing operation is unaffected.
    judge: createDefaultJudge({ cwd: process.env.JUDGE_LANE_CWD || null }),
    newRunId: () => newRunId(declaration.name),
  })
    .then(({ code, lines }) => {
      writeAllSync(1, `${lines.join('\n')}\n`);
      process.exit(code);
    })
    .catch((e) => {
      // The engine and the declaration both REFUSE rather than improvise; a refusal must reach the operator
      // with its own words, never a paraphrase.
      writeAllSync(1, `error: ${String(e?.message ?? e)}\n`);
      process.exit(1);
    });
}
