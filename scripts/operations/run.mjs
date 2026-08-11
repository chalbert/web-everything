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
import { suggestNextOperation, SUGGEST_NEXT_OP } from './suggest-next.mjs';
import { createBoardReader, createExclusionReader } from './suggest-next-io.mjs';
import { gateHealthOperation, GATE_HEALTH_OP, classifyFollowUp } from './gate-health.mjs';
import { createHistoryReader } from './gate-health-io.mjs';
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
    judge: createDefaultJudge(),
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
