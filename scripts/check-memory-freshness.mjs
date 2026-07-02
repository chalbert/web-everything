#!/usr/bin/env node
/**
 * check-memory-freshness.mjs — the agent-memory freshness audit CLI (#2087).
 *
 * The 180+ hand-curated leaf files under .claude/agent-memory/ have no freshness guarantee: an agent loads
 * a leaf's hook and applies it, but the leaf may cite a decision the project has since ruled the other way
 * or a statute anchor renamed out from under it. This surfaces those stale cites for curation.
 *
 * Three warning signals (see scripts/lib/memory-freshness.cjs): a dangling `#NNNN` cite, a cite to a
 * still-unsettled `kind: decision`, and an orphaned `docs/agent/<doc>.md#anchor` statute cite. All are
 * WARNINGS — a curation nudge, never a build-breaking gate (a leaf may deliberately cite an open decision).
 * check-standards.mjs folds the same warnings into the everyday gate; this is the standalone entry.
 *
 * Usage: `npm run check:memory-freshness` [--json]. Always exits 0 (advisory-only).
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { runMemoryFreshnessCheck } = require('./lib/memory-freshness.cjs');

const AS_JSON = process.argv.includes('--json');
const { warnings } = runMemoryFreshnessCheck();

if (AS_JSON) {
  process.stdout.write(JSON.stringify({ warnings }, null, 2) + '\n');
} else {
  for (const w of warnings) console.warn(`\x1b[33m  stale\x1b[0m ${w.message}`);
  console.log(`${warnings.length ? '\x1b[33m' : '\x1b[32m'}${warnings.length} freshness warning(s)\x1b[0m — agent-memory cites vs live status (#2087)`);
}
process.exit(0); // advisory-only: never breaks the build
