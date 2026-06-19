// One-file-per-preset assembler (#1146, mirrors the #882 blocks / #1145 intents split). The assembler
// presets were a single src/_data/assemblerPresets.json (an object `{ $comment, presets: [...] }`); each
// preset now lives one-file-per-preset in src/_data/assemblerPresets/<name>.json, so two parallel-batch
// lanes adding different presets touch different files and merge clean.
//
// The consumer contract is the WRAPPER object `{ presets: [...] }` (templates read `assemblerPresets.presets`;
// check-standards reads `(assemblerPresets || {}).presets`), so the 11ty loader (src/_data/assemblerPresets.js)
// re-wraps this array. CJS so it is shared by both runtimes. Sorted by `name` (the preset key) for a
// deterministic order. The preset field set (the contract) is unchanged — only the granularity moved.
const { readdirSync, readFileSync } = require('node:fs');
const { join } = require('node:path');

const PRESETS_DIR = join(__dirname, '../../src/_data/assemblerPresets');

/** Assemble the per-preset spec files into the canonical presets array, sorted by name. */
function loadPresets(dir = PRESETS_DIR) {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

module.exports = { loadPresets, PRESETS_DIR };
