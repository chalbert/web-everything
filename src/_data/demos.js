// The `demos` 11ty global — assembled from one-file-per-demo specs (#1146).
//
// Was a single src/_data/demos.json; now one-file-per-demo in src/_data/demos/<id>.json, mirroring
// src/_data/blocks/ (#882) and src/_data/intents/ (#1145) — a demo edit is a small, conflict-free diff,
// and two parallel-batch lanes adding different demos never collide. The loader globs those files into the
// same `demos` array every template, validator, and the Playwright spec already consume.
//
// On the pinned Eleventy v2 this `demos.js` and the sibling `src/_data/demos/` directory both target the
// `demos` key — the loader's array wins, the directory's auto-nested data does not collide.
const { loadDemos } = require('../../scripts/lib/demos-loader.cjs');

module.exports = () => loadDemos();
