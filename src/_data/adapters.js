// The `adapters` 11ty global — assembled from one-file-per-adapter specs (#1938).
//
// The adapter registry used to live in a single src/_data/adapters.json (a [{ id, title, description,
// items[] }] nested-group array). It now lives one-file-per-adapter in src/_data/adapters/<id>.json plus a
// tiny src/_data/adapters/_groups.json (group order + title + description), mirroring the
// blocks/intents/protocols/… splits (#882/#1145/#1146/#1157) — so an adapter edit is a small, conflict-free
// diff and two parallel-batch lanes editing different adapters never collide. This loader assembles those
// files into the same nested-group `adapters` array every template + validator already consumes, so the
// assembled contract is unchanged (only the on-disk source granularity moved).
//
// On the pinned Eleventy v2, this `adapters.js` loader and the sibling `src/_data/adapters/` directory both
// target the `adapters` key — the loader's array wins, the directory's auto-nested data does not collide
// (verified for blocks.js + src/_data/blocks/).
const { loadAdapters } = require('../../scripts/lib/adapters-loader.cjs');

module.exports = () => loadAdapters();
