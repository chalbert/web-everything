// Generic one-file-per-entry registry assembler (#1157 — universalises the #882/#1145/#1146 split).
//
// The earlier splits each shipped a near-identical `<reg>-loader.cjs` (blocks/intents/protocols/demos/
// semantics/presets/research). #1157 converts the remaining hand-authored array registries
// (plugs/projects/capabilities/designSystems/analytics/renderStrategies/states/resources/references/
// expressiveAssets) so the convention is universal — every registry is a per-entry directory and the
// parallel batcher never special-cases "split vs monolithic". Rather than ten more copy-pasted loaders,
// this single factory builds the assembler for any of them; the per-registry `src/_data/<reg>.js` 11ty
// global and the `.mjs` scripts/tests both call it. The assembled array (sorted by the entry's natural
// key) is byte-identical to the former monolith's set — only the granularity moved.
//
// CJS so the one implementation is shared by both runtimes: the Eleventy data loader requires it, and the
// ESM `.mjs` scripts import it (via createRequire / interop). The Vite/vitest bundle can't read the fs,
// so a TS consumer that statically imported a monolith gets a sibling `src/_data/<reg>.data.ts`
// import.meta.glob assembler instead (mirrors src/_data/intents.data.ts, #1145).
const { readdirSync, readFileSync } = require('node:fs');
const { join } = require('node:path');

const DATA_DIR = join(__dirname, '../../src/_data');

/** Filesystem-safe handle for a human key (e.g. a reference `category`) — the per-entry file name. */
function slugKey(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Assemble the per-entry spec files under src/_data/<reg>/ into the canonical array, sorted by `keyOf`.
 * @param {string} reg               registry id (directory name under src/_data/)
 * @param {(e:object)=>string} keyOf entry → its natural sort key (default: `id`)
 */
function loadRegistry(reg, keyOf = (e) => e.id) {
  const dir = join(DATA_DIR, reg);
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')))
    .sort((a, b) => String(keyOf(a)).localeCompare(String(keyOf(b))));
}

// The natural sort key per split registry. id-keyed unless the entry has no id (references keys on its
// human `category`; the expressiveAssets `_schema` pseudo-entry keys on its id like the rest).
const KEY_OF = {
  references: (e) => slugKey(e.category),
};

/** Convenience: load a registry using its registered key extractor. */
function loadDataRegistry(reg) {
  return loadRegistry(reg, KEY_OF[reg]);
}

module.exports = { loadRegistry, loadDataRegistry, slugKey, KEY_OF, DATA_DIR };
