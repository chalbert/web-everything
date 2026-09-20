#!/usr/bin/env node
/**
 * @file wip-report-cli.mjs
 * @description The `/wip` report for the operator. Flags: `--json` (structured report), `--sessions` (today's raw
 * `wip-agents` dump, unchanged, as the debug view), `--stamp` (the ONLY flag that writes: persists `last-wip` so the
 * next run's `Done since` starts here). A default run has no side effects. Importing launches nothing.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { composeInput, buildReport, renderReport } from './wip-report.mjs';
import { createWipReportReader, lastWipPath, stampLastWip } from './wip-report-io.mjs';
import { main as wipAgentsMain } from './wip-agents-cli.mjs';

const KNOWN = ['--json', '--sessions', '--stamp'];
export async function main({ argv = process.argv.slice(2), readRaw = createWipReportReader(), sessionsMain = wipAgentsMain,
  stamp = (iso) => stampLastWip(lastWipPath(homedir(), process.env), iso),
  stdout = (s) => process.stdout.write(s), stderr = (s) => process.stderr.write(s) } = {}) {
  try {
    for (const a of argv) if (!KNOWN.includes(a)) throw new Error(`Unknown argument: ${a} (known: ${KNOWN.join(' ')})`);
    if (argv.includes('--sessions')) return await sessionsMain({ argv: argv.includes('--json') ? ['--json'] : [], stdout, stderr });
    const raw = await readRaw();
    const report = buildReport(composeInput(raw));
    stdout((argv.includes('--json') ? JSON.stringify(report) : renderReport(report)) + '\n');
    if (argv.includes('--stamp')) stamp(new Date(raw.now).toISOString());
    return 0;
  } catch (e) { stderr(`${e.message ?? e}\n`); return 1; }
}
const IS_CLI = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (IS_CLI) process.exitCode = await main();
