// The `protocols` 11ty global — assembled from one-file-per-protocol specs (#1146).
//
// Was a single src/_data/protocols.json; now one-file-per-protocol in src/_data/protocols/<id>.json,
// mirroring src/_data/blocks/ (#882) and src/_data/intents/ (#1145) — a protocol edit is a small,
// conflict-free diff, and two parallel-batch lanes editing different protocols never collide. The loader
// globs those files into the same `protocols` array every template and validator already consumes.
//
// On the pinned Eleventy v2 this `protocols.js` and the sibling `src/_data/protocols/` directory both
// target the `protocols` key — the loader's array wins, the directory's auto-nested data does not collide.
const { loadProtocols } = require('../../scripts/lib/protocols-loader.cjs');

module.exports = () => loadProtocols();
