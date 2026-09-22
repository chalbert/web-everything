#!/usr/bin/env node
/**
 * gen-dispatch-routing-table.mjs — PUBLISH the mechanical dispatch routing table (#3717 step 5).
 *
 * WHAT IT PUBLISHES. One table of `{dispatch kind → derived taskType → routing decision under today's
 * scorecards}`, GENERATED from the same pure functions the dispatch path itself calls
 * (`we:scripts/lib/dispatch-task-type.mjs#taskTypeFor` and
 * `we:scripts/lib/dispatch-contracts.mjs#decideDispatchRoute`, which is `routeDispatch`, which is
 * `selectProvider` + `selectSupervisionLevel`). Nothing in the output is written by hand, so the checked-in
 * table cannot quietly disagree with what the code does — `scripts/__tests__/dispatch-routing-table.test.mjs`
 * regenerates and fails on any drift.
 *
 * WHY A TABLE AT ALL. The card's own reason: it is what makes a WRONG route debuggable. A human reading the
 * runbook can see that a `build` over docs routes differently from a `build` over code, and can see the
 * routed-vs-executed gap (an unmarked non-Claude route that a Claude session still executes, because no Codex
 * or Gemini port is reachable without an item's own `deliveryAgent:` marker — #3443, #3658, #3840, #3848).
 *
 * HOW IT PUBLISHES — the repo's existing convention, not a new mechanism: a `gen-*.mjs` script behind an
 * `npm run gen:*` script, writing DERIVED, deterministic content (see `gen-reference-index.mjs`'s own header:
 * "no timestamp, so the committed file can't drift and a re-run over unchanged sources is a no-op diff").
 * The one difference is the destination — a delimited block inside an existing markdown doc rather than a
 * whole file — because the card names `we:docs/agent/dispatcher-runbook.md` as where an operator already
 * looks, and replacing that whole file with generated output would delete the prose around it.
 *
 * Run: `npm run gen:dispatch-routing-table`   (`--check` exits 1 on drift instead of writing)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CODE_CHANGE_DISPATCH_KINDS, ROLE_DISPATCH_KINDS, TASK_TYPES_WITHOUT_PRODUCING_KIND, taskTypeFor,
} from './lib/dispatch-task-type.mjs';
import { decideDispatchRoute } from './lib/dispatch-contracts.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
/** The doc the generated block lives in. */
export const RUNBOOK = join(ROOT, 'docs', 'agent', 'dispatcher-runbook.md');
/** The scorecards the table is computed against. */
export const SCORECARDS = join(ROOT, 'scripts', 'conveyor', 'run-scorecards.json');

export const BEGIN = '<!-- BEGIN GENERATED: dispatch routing table — `npm run gen:dispatch-routing-table` -->';
export const END = '<!-- END GENERATED: dispatch routing table -->';

/**
 * THE ROWS THE TABLE IS COMPUTED OVER — one per distinct routing question a real dispatch can ask, each with
 * the scope that distinguishes it. Not the cross product: a `build` over docs and a `build` over code are two
 * rows because the scope decides the `taskType`; a `fix` and a conflict-caused `fix` are two rows because the
 * cause does.
 */
export const TABLE_ROWS = Object.freeze([
  Object.freeze({ kind: 'build', cause: null, scopePaths: Object.freeze(['we:scripts/lib/example.mjs']), label: '`build` (any non-doc path in scope)' }),
  Object.freeze({ kind: 'build', cause: null, scopePaths: Object.freeze(['we:docs/agent/example.md']), label: '`build` (every scope path is documentation)' }),
  Object.freeze({ kind: 'build', cause: null, scopePaths: Object.freeze([]), label: '`build` (no declared scope)' }),
  Object.freeze({ kind: 'fix', cause: 'conflict', scopePaths: Object.freeze(['we:scripts/lib/example.mjs']), label: '`fix` caused by a merge conflict' }),
  Object.freeze({ kind: 'fix', cause: null, scopePaths: Object.freeze(['we:scripts/lib/example.mjs']), label: '`fix` (reviewer finding)' }),
  Object.freeze({ kind: 'ci-heal', cause: null, scopePaths: Object.freeze(['we:scripts/lib/example.mjs']), label: '`ci-heal`' }),
  Object.freeze({ kind: 'prepare', cause: null, scopePaths: Object.freeze(['we:backlog/0000-example.md']), label: '`prepare`' }),
  Object.freeze({ kind: 'prepare-decision', cause: null, scopePaths: Object.freeze(['we:backlog/0000-example.md']), label: '`prepare-decision`' }),
  Object.freeze({ kind: 'investigate', cause: null, scopePaths: Object.freeze(['we:backlog/0000-example.md']), label: '`investigate`' }),
  Object.freeze({ kind: 'review', cause: null, scopePaths: Object.freeze([]), label: '`review`' }),
]);

/** The size every row is computed at, so one column is not silently doing two jobs. */
export const TABLE_SIZE = 3;

/**
 * Read the scorecards the table is computed against.
 *
 * @param {{read?: (p: string) => string}} [io]
 * @returns {{version: unknown, records: object[]}}
 */
export function loadScorecards({ read = (p) => readFileSync(p, 'utf8') } = {}) {
  const parsed = JSON.parse(String(read(SCORECARDS)));
  const records = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.records) ? parsed.records : [];
  return { version: Array.isArray(parsed) ? null : parsed?.version ?? null, records };
}

const cell = (v) => (v == null || v === '' ? '—' : `\`${v}\``);

/**
 * RENDER the generated block. Deterministic over the rows and the scorecards — no clock, no cwd — so an
 * unchanged input produces a byte-identical block.
 *
 * @param {{version: unknown, records: object[]}} scorecards
 * @returns {string}
 */
export function renderRoutingTable(scorecards) {
  const lines = [
    BEGIN,
    '',
    '## The routing table (generated)',
    '',
    'Which dispatch kind becomes which router `taskType`, and what the router then decides — **generated** by',
    '`npm run gen:dispatch-routing-table` from the same functions the dispatch path calls',
    '(`we:scripts/lib/dispatch-task-type.mjs` → `we:scripts/lib/dispatch-contracts.mjs#decideDispatchRoute` →',
    '`we:scripts/lib/provider-routing.mjs`). Edit the code, not this block;',
    '`scripts/__tests__/dispatch-routing-table.test.mjs` fails when the two disagree.',
    '',
    `Computed against \`we:scripts/conveyor/run-scorecards.json\` (version ${JSON.stringify(scorecards.version)}, `
      + `${scorecards.records.length} record(s)) at size ${TABLE_SIZE}.`,
    '',
    '| dispatch | derived `taskType` | routed | executed | supervision | why |',
    '|---|---|---|---|---|---|',
  ];
  for (const row of TABLE_ROWS) {
    const route = decideDispatchRoute(
      { kind: row.kind, cause: row.cause, scopePaths: [...row.scopePaths], size: TABLE_SIZE },
      { scorecards: scorecards.records },
    );
    const why = route.outcome === 'refused'
      ? `REFUSED — ${route.refusal}`
      : route.outcome === 'role'
        ? 'role path — the provider cascade is never consulted'
        : route.auditTrail.find((a) => a.criterion === 'task-type-derivation')?.reasoning ?? '';
    lines.push(`| ${row.label} | ${cell(route.taskType)} | ${cell(route.routed)} | ${cell(route.executed)} | ${cell(route.supervision)} | ${why.replace(/\|/g, '\\|')} |`);
  }
  lines.push('');
  lines.push('### `taskType`s no dispatch kind produces');
  lines.push('');
  lines.push('| `taskType` | why nothing produces it |');
  lines.push('|---|---|');
  for (const [taskType, why] of Object.entries(TASK_TYPES_WITHOUT_PRODUCING_KIND)) {
    lines.push(`| \`${taskType}\` | ${why} |`);
  }
  lines.push('');
  lines.push(`**Code-change kinds:** ${CODE_CHANGE_DISPATCH_KINDS.map((k) => `\`${k}\``).join(', ')}. `
    + `**Role kinds:** ${ROLE_DISPATCH_KINDS.map((k) => `\`${k}\``).join(', ')}.`);
  lines.push('');
  lines.push('**The gap.** `executed` is `claude` on every row above because none of these example rows carries an '
    + 'item\'s own `deliveryAgent:` marker (#3840) — the one override that makes `executed` follow `routed` for a '
    + '`build`/`fix`/`ci-heal` dispatch. With no marker, execution has exactly one port '
    + '(`we:scripts/operations/dispatch-lane-io.mjs#defaultClaudeProvider`, #3579), so a row whose `routed` is not '
    + '`claude` is a delegation the machinery decided and could not carry out unmarked; both halves are written '
    + 'into the run record so the gap is measurable rather than invisible (#3443, #3658, #3848).');
  lines.push('');
  lines.push(END);
  return lines.join('\n');
}

/**
 * Splice the generated block into the runbook, replacing an existing one or appending it.
 *
 * @param {string} doc
 * @param {string} block
 * @returns {string}
 */
export function spliceBlock(doc, block) {
  const start = doc.indexOf(BEGIN);
  const stop = doc.indexOf(END);
  if (start === -1 || stop === -1) return `${doc.replace(/\s*$/, '')}\n\n${block}\n`;
  return `${doc.slice(0, start)}${block}${doc.slice(stop + END.length)}`;
}

/** The runbook as it SHOULD be, given today's code and scorecards. */
export function expectedRunbook({ read = (p) => readFileSync(p, 'utf8') } = {}) {
  return spliceBlock(String(read(RUNBOOK)), renderRoutingTable(loadScorecards({ read })));
}

if (process.argv[1] && process.argv[1].endsWith('gen-dispatch-routing-table.mjs')) {
  const want = expectedRunbook();
  const have = readFileSync(RUNBOOK, 'utf8');
  if (process.argv.includes('--check')) {
    if (want !== have) {
      process.stderr.write('dispatcher-runbook.md is stale — run `npm run gen:dispatch-routing-table`\n');
      process.exit(1);
    }
    process.stdout.write('dispatcher-runbook.md routing table is current\n');
  } else {
    if (want !== have) writeFileSync(RUNBOOK, want);
    process.stdout.write(`${want === have ? 'unchanged' : 'wrote'} ${RUNBOOK}\n`);
  }
}
