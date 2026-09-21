#!/usr/bin/env node
/**
 * @file wip-report-cli.mjs
 * @description The `/wip` report for the operator. The default output is compact tables, made for a phone held vertically.
 * Flags: `--bullets` (the stacked-bullets fallback; so does env `WIP_REPORT_STYLE=bullets`), `--queue-plan` (only the
 * queue plan: the findings that need a backlog item, under their dedup keys; read-only, it files nothing; `--json` prints
 * it as JSON), `--json` (structured report), `--sessions` (today's raw `wip-agents` dump, unchanged, as the debug view),
 * `--stamp` (the ONLY flag that writes: persists `last-wip` so the next run's `Done since` starts here). A default run has
 * no side effects. Importing launches nothing.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { composeInput, buildReport, renderReport } from './wip-report.mjs';
import { renderQueuePlan } from './wip-report-queue.mjs';
import { createWipReportReader, lastWipPath, stampLastWip } from './wip-report-io.mjs';
import { main as wipAgentsMain } from './wip-agents-cli.mjs';

const KNOWN = ['--json', '--sessions', '--stamp', '--bullets', '--queue-plan'];
export async function main({ argv = process.argv.slice(2), readRaw = createWipReportReader(), sessionsMain = wipAgentsMain,
  stamp = (iso) => stampLastWip(lastWipPath(homedir(), process.env), iso),
  env = process.env, stdout = (s) => process.stdout.write(s), stderr = (s) => process.stderr.write(s) } = {}) {
  try {
    for (const a of argv) if (!KNOWN.includes(a)) throw new Error(`Unknown argument: ${a} (known: ${KNOWN.join(' ')})`);
    if (argv.includes('--sessions')) return await sessionsMain({ argv: argv.includes('--json') ? ['--json'] : [], stdout, stderr });
    const raw = await readRaw();
    const report = buildReport(composeInput(raw));
    const style = argv.includes('--bullets') || env.WIP_REPORT_STYLE === 'bullets' ? 'bullets' : 'compact';
    if (argv.includes('--queue-plan')) stdout((argv.includes('--json') ? JSON.stringify(report.queue) : renderQueuePlan(report.queue)) + '\n');
    else stdout((argv.includes('--json') ? JSON.stringify(report) : renderReport(report, { style })) + '\n');
    if (argv.includes('--stamp')) stamp(new Date(raw.now).toISOString());
    return 0;
  } catch (e) { stderr(`${e.message ?? e}\n`); return 1; }
}
const IS_CLI = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (IS_CLI) process.exitCode = await main();
