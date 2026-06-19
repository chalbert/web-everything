// The `references` 11ty global — assembled from one-file-per-entry specs (#1157).
//
// Was a single src/_data/references.json; now one-file-per-entry in src/_data/references/<key>.json, mirroring the
// #882/#1145/#1146 splits — an entry edit is a small, conflict-free diff and two parallel-batch lanes
// editing different entries never collide. The shared loader globs those files into the same `references`
// array (sorted by the entry's natural key) every template and validator already consumes.
//
// On the pinned Eleventy v2 this `references.js` and the sibling src/_data/references/ directory both target the
// `references` key — the loader's array wins, the directory's auto-nested data does not collide.
const { loadDataRegistry } = require('../../scripts/lib/registry-loader.cjs');

module.exports = () => loadDataRegistry('references');
