// One-file-per-protocol assembler (#1146, mirrors the #882 blocks / #1145 intents split). The protocol
// registry was a single src/_data/protocols.json (32 entries); it now lives one-file-per-protocol in
// src/_data/protocols/<id>.json, so two parallel-batch lanes editing different protocols touch different
// files and merge clean (the src/_data/blocks/ precedent).
//
// CJS so the single implementation is shared by both runtimes: the 11ty data loader
// (src/_data/protocols.js) requires it, and the ESM `.mjs` scripts/tests import it. Sorted by id for a
// deterministic order. The protocol field set (the contract) is unchanged — only the granularity moved.
const { readdirSync, readFileSync } = require('node:fs');
const { join } = require('node:path');

const PROTOCOLS_DIR = join(__dirname, '../../src/_data/protocols');

/** Assemble the per-protocol spec files into the canonical `protocols` array, sorted by id. */
function loadProtocols(dir = PROTOCOLS_DIR) {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

module.exports = { loadProtocols, PROTOCOLS_DIR };
