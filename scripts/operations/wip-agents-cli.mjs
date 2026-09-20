#!/usr/bin/env node
/**
 * @file wip-agents-cli.mjs
 * @description Small stdout-only report adapter for /wip. Importing it launches
 * nothing; injected readers and writers also let tests exercise exit semantics.
 * Odd sessions are data, not errors. Only a failed report produces stderr and 1.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWipAgentsReader } from './wip-agents-io.mjs';
import { classifyAgents, renderTable } from './wip-agents.mjs';
export async function main({ argv = process.argv.slice(2), readAgents = createWipAgentsReader(),
  stdout = (s) => process.stdout.write(s), stderr = (s) => process.stderr.write(s) } = {}) {
  try {
    const data = await readAgents();
    const rows = classifyAgents(data);
    stdout((argv.includes('--json') ? JSON.stringify({ generatedAt: new Date(data.now).toISOString(), rows }) : renderTable(rows)) + '\n');
    return 0;
  } catch (e) { stderr(`${e.message ?? e}\n`); return 1; }
}
const IS_CLI = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (IS_CLI) process.exitCode = await main();
