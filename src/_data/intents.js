// The `intents` 11ty global — assembled from one-file-per-intent specs (#1145).
//
// The intent registry used to live in a single ~300 KB src/_data/intents.json. It now lives
// one-file-per-intent in src/_data/intents/<id>.json, mirroring src/_data/blocks/ (#882) and
// backlog/*.md — so an intent edit is a small, conflict-free diff with an unambiguous path, and two
// parallel-batch lanes editing different intents never collide. This loader globs those files into the
// same `intents` array every template and validator already consumes, so the assembled-array contract is
// unchanged (only the on-disk source granularity moved).
//
// On the pinned Eleventy v2, this `intents.js` loader and the sibling `src/_data/intents/` directory both
// target the `intents` key — the loader's array wins, the directory's auto-nested data does not collide
// (verified for blocks.js + src/_data/blocks/).
const { loadIntents } = require('../../scripts/lib/intents-loader.cjs');

module.exports = () => loadIntents();
