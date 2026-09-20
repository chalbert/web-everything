#!/usr/bin/env node
/**
 * @file land-advance-cli.mjs
 * Standalone plan adapter. Default execution reads only; applying is explicit and
 * refuses incomplete evidence. All side effects are behind the injected applier.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLandAdvanceReader, createLandAdvanceApplier } from './land-advance-io.mjs';
import { planLandAdvance, renderTable } from './land-advance.mjs';
export async function main({ argv = process.argv.slice(2), deps = {}, stdout = (s) => process.stdout.write(s), stderr = (s) => process.stderr.write(s) } = {}) {
  try {
    for (const a of argv) if (!['--json', '--apply'].includes(a) && !/^--cap=\d+$/.test(a)) throw new Error(`Unknown argument: ${a}`);
    const cap = Number(argv.find((a) => a.startsWith('--cap='))?.slice(6) ?? 3);
    const inputs = await (deps.readInputs ?? createLandAdvanceReader({ cap, refreshPrototype: argv.includes('--apply') }))();
    const plan = planLandAdvance({ ...inputs, cap });
    if (argv.includes('--apply') && !plan.errors.length) plan.applied = await (deps.apply ?? createLandAdvanceApplier())(plan);
    stdout((argv.includes('--json') ? JSON.stringify(plan) : renderTable(plan)) + '\n');
    const errors = [...plan.errors, ...(plan.applied?.errors ?? [])];
    for (const e of errors) stderr(`${e.source ?? 'apply'}: ${e.message}\n`);
    return errors.length ? 1 : 0;
  } catch (e) { stderr(`${e.message ?? e}\n`); return 1; }
}
const IS_CLI = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (IS_CLI) process.exitCode = await main();
