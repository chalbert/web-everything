// One-file-per-demo assembler (#1146, mirrors the #882 blocks / #1145 intents split). The demo registry
// was a single src/_data/demos.json; it now lives one-file-per-demo in src/_data/demos/<id>.json, so two
// parallel-batch lanes adding/editing different demos touch different files and merge clean.
//
// CJS so the single implementation is shared by both runtimes: the 11ty data loader (src/_data/demos.js)
// requires it, and the ESM `.mjs` scripts/tests (+ the Playwright spec) import it. Sorted by id for a
// deterministic order. The demo field set (the contract) is unchanged — only the granularity moved.
const { readdirSync, readFileSync } = require('node:fs');
const { join } = require('node:path');

const DEMOS_DIR = join(__dirname, '../../src/_data/demos');

/** Assemble the per-demo spec files into the canonical `demos` array, sorted by id. */
function loadDemos(dir = DEMOS_DIR) {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

module.exports = { loadDemos, DEMOS_DIR };
