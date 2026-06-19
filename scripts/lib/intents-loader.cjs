// One-file-per-intent assembler (#1145, mirrors the #882 blocks split). The intent registry was a single
// src/_data/intents.json (56 entries, ~300 KB) — the highest-conflict registry for concurrent/parallel
// batch work after researchTopics. It now lives one-file-per-intent in src/_data/intents/<id>.json, so two
// lanes editing different intents touch different files and merge clean (the src/_data/blocks/ precedent).
//
// CJS so the single implementation is shared by BOTH runtimes: the 11ty data loader (src/_data/intents.js,
// CommonJS) requires it, and the ESM `.mjs` scripts/tests/validators import it. Assembly is SORTED BY id
// for a deterministic order independent of readdirSync's platform-dependent order. The intent field set
// (the contract) is unchanged — only the on-disk granularity moved.
const { readdirSync, readFileSync } = require('node:fs');
const { join } = require('node:path');

const INTENTS_DIR = join(__dirname, '../../src/_data/intents');

/** Assemble the per-intent spec files into the canonical `intents` array, sorted by id. */
function loadIntents(dir = INTENTS_DIR) {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

module.exports = { loadIntents, INTENTS_DIR };
