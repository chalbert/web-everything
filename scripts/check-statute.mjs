#!/usr/bin/env node
/**
 * check-statute.mjs — the statute-layer integrity gate (#2083).
 *
 * The statute layer (docs/agent/platform-decisions.md + the three sibling governance docs rendered at
 * /rules/) is load-bearing: ~99% of resolved decisions cite it via `codifiedIn:`. This validates the
 * link fabric in both directions:
 *   1. resolution — every backlog `codifiedIn:` doc-cite resolves to a rendered anchor (validateRulesAnchors,
 *      pre-existing #1828 gate)
 *   2. duplicates — a named `{#id}` anchor defined twice in platform-decisions.md (a prose "see {#id}"
 *      written in definition syntax renders a duplicate HTML id; the fragment silently resolves wrong)
 *   3. orphans — a named anchor nothing references (no codifiedIn, no doc link, no `#id` mention)
 *   4. substance — a cited anchor with no real content behind it (a rule in name only)
 *
 * Pure rules + fs gather live in scripts/lib/validate-rules-anchors.cjs (fixture-tested in
 * scripts/__tests__/rules-anchors.test.mjs); check-standards.mjs folds the same check into the everyday
 * gate. This CLI is the standalone entry: `npm run check:statute` [--json].
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { runStatuteCheck } = require('./lib/validate-rules-anchors.cjs');

const AS_JSON = process.argv.includes('--json');
const { errors, warnings } = runStatuteCheck();

if (AS_JSON) {
  process.stdout.write(JSON.stringify({ errors, warnings }, null, 2) + '\n');
} else {
  for (const w of warnings) console.warn(`\x1b[33m  warn\x1b[0m ${w.message}`);
  for (const e of errors) console.error(`\x1b[31m error\x1b[0m ${e.message}`);
  console.log(`${errors.length ? '\x1b[31m' : '\x1b[32m'}${errors.length} error(s)\x1b[0m, ${warnings.length} warning(s) — statute layer (anchors, codifiedIn links)`);
}
process.exit(errors.length ? 1 : 0);
