// One-file-per-adapter assembler (#1938, the #1145/#1146/#1157 split applied to the last monolithic
// array-collection). The adapter registry was a single src/_data/adapters.json — a small
// [{ id, title, description, items[] }] nested-group array — and the only real array-collection still
// monolithic, so it sat in the parallel-batch lock-set (a lane editing ANY adapter reserved the whole
// file). It now lives one-file-per-adapter in src/_data/adapters/<id>.json plus a tiny
// src/_data/adapters/_groups.json carrying the (rarely-edited) group order + title + description — so two
// lanes editing different adapters touch different files and merge clean. This removes adapters.json from
// the merge-risk denylist entirely (#1935 Fork 2, category ①).
//
// CJS so the single implementation is shared by BOTH runtimes: the 11ty data loader (src/_data/adapters.js,
// CommonJS) requires it, and the ESM `.mjs` scripts/tests/validators import it. The assembled nested-group
// array is shape-identical to the former monolith — only the on-disk granularity moved. Groups are emitted
// in `_groups.json` order; items are sorted by id within each group for a deterministic order independent
// of readdirSync's platform-dependent ordering.
const { readdirSync, readFileSync } = require('node:fs');
const { join } = require('node:path');

const ADAPTERS_DIR = join(__dirname, '../../src/_data/adapters');

/** Read the per-adapter item specs (each carries a `category` group back-ref), sorted by id. */
function readItems(dir) {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json') && !f.startsWith('_'))
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

/**
 * Assemble the canonical nested-group `adapters` array — [{ id, title, description, items[] }] — from the
 * per-adapter files + _groups.json, byte-shape-identical to the former src/_data/adapters.json. The
 * per-item `category` back-ref is stripped from the grouped view (it only exists to place the file in its
 * group); the group metadata supplies title/description.
 */
function loadAdapters(dir = ADAPTERS_DIR) {
  const groups = JSON.parse(readFileSync(join(dir, '_groups.json'), 'utf8'));
  const items = readItems(dir);
  return groups
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((g) => ({
      id: g.id,
      title: g.title,
      description: g.description,
      items: items
        .filter((i) => i.category === g.id)
        .map(({ category, ...rest }) => rest),
    }));
}

/**
 * The FLAT item set used by the pagination collection + entity validators — every adapter item with its
 * group context attached as `category`/`categoryTitle` (mirrors the old
 * collections.flatAdapters = adapters.flatMap(c => c.items.map(i => ({ ...i, category, categoryTitle }))) ).
 */
function loadAdapterItems(dir = ADAPTERS_DIR) {
  return loadAdapters(dir).flatMap((g) =>
    g.items.map((item) => ({ ...item, category: g.id, categoryTitle: g.title })),
  );
}

module.exports = { loadAdapters, loadAdapterItems, ADAPTERS_DIR };
