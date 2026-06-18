// One-file-per-block assembler (#882). The block structural contract is split into
// src/_data/blocks/<id>.json — one file per block — replacing the former monolithic
// src/_data/blocks.json. This module globs that directory and assembles the `blocks` array
// every template, validator, and CEM generator consumes.
//
// CJS so the single implementation is shared by BOTH runtimes: the 11ty data loader
// (src/_data/blocks.js, CommonJS) requires it, and the ESM `.mjs` scripts/tests import it.
//
// Assembly is SORTED BY id for a deterministic order independent of readdirSync's
// platform-dependent order (the Style Dictionary merge-order lesson — never trust dir order).
// The block field set (the contract) is unchanged; #657 pinned it. This only changes file
// granularity, mirroring how the backlog globs backlog/*.md (src/_data/backlog.js) with no
// aggregate file.
const { readdirSync, readFileSync } = require('node:fs');
const { join } = require('node:path');

const BLOCKS_DIR = join(__dirname, '../../src/_data/blocks');

/** Assemble the per-block spec files into the canonical `blocks` array, sorted by id. */
function loadBlocks(dir = BLOCKS_DIR) {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

module.exports = { loadBlocks, BLOCKS_DIR };
