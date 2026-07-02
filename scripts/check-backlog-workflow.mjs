#!/usr/bin/env node
/**
 * check-backlog-workflow.mjs — the workflow-intent invariant gate (#2084).
 *
 * Validates the CROSS-ITEM backlog rules docs/agent/backlog-workflow.md defines but the per-item schema
 * validator cannot see (they need a parent's children, or a scaffold's age): sliced-epic sizing and
 * born-active settlement. Pure rules live in scripts/lib/workflow-invariants.cjs (fixture-tested in
 * scripts/__tests__/workflow-invariants.test.mjs); check-standards.mjs folds the same check into the
 * everyday gate. This CLI is the standalone entry: `npm run check:backlog-workflow` [--json].
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const loadBacklog = require(join(ROOT, 'src/_data/backlog.js'));
const { validateWorkflowInvariants } = require('./lib/workflow-invariants.cjs');

const AS_JSON = process.argv.includes('--json');
const items = Array.isArray(loadBacklog) ? loadBacklog : (typeof loadBacklog === 'function' ? loadBacklog() : []);
const today = new Date().toISOString().slice(0, 10);
const { errors, warnings } = validateWorkflowInvariants(items, { today });

if (AS_JSON) {
  process.stdout.write(JSON.stringify({ errors, warnings }, null, 2) + '\n');
} else {
  for (const w of warnings) console.warn(`\x1b[33m  warn\x1b[0m ${w.message}`);
  for (const e of errors) console.error(`\x1b[31m error\x1b[0m ${e.message}`);
  console.log(`${errors.length ? '\x1b[31m' : '\x1b[32m'}${errors.length} error(s)\x1b[0m, ${warnings.length} warning(s) — backlog workflow-intent invariants`);
}
process.exit(errors.length ? 1 : 0);
