// The `projects` 11ty global — assembled from one-file-per-entry specs (#1157).
//
// Was a single src/_data/projects.json; now one-file-per-entry in src/_data/projects/<key>.json, mirroring the
// #882/#1145/#1146 splits — an entry edit is a small, conflict-free diff and two parallel-batch lanes
// editing different entries never collide. The shared loader globs those files into the same `projects`
// array (sorted by the entry's natural key) every template and validator already consumes.
//
// On the pinned Eleventy v2 this `projects.js` and the sibling src/_data/projects/ directory both target the
// `projects` key — the loader's array wins, the directory's auto-nested data does not collide.
const { loadDataRegistry } = require('../../scripts/lib/registry-loader.cjs');

module.exports = () => loadDataRegistry('projects');
