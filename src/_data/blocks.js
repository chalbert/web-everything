// The `blocks` 11ty global — assembled from one-file-per-block specs (#882).
//
// The block structural contract used to live in a single 4657-line src/_data/blocks.json.
// It now lives one-file-per-block in src/_data/blocks/<id>.json, mirroring how the backlog
// globs backlog/*.md (src/_data/backlog.js) with no aggregate file — so a block edit is a
// small, conflict-free diff with an unambiguous path. This loader globs those files into the
// same `blocks` array every template and validator already consumes, so the assembled-array
// contract is unchanged (only the on-disk source granularity moved).
//
// Verified: on the pinned Eleventy v2, this `blocks.js` loader and the sibling
// `src/_data/blocks/` directory both target the `blocks` key — the loader's array wins, the
// directory's auto-nested data does not collide.
//
// The glob + deterministic id-sort live in the shared CJS assembler so the .mjs scripts
// (gen-cem, check-standards, …) assemble the identical array.
const { loadBlocks } = require('../../scripts/lib/blocks-loader.cjs');

module.exports = () => loadBlocks();
