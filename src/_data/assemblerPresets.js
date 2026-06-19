// The `assemblerPresets` 11ty global — assembled from one-file-per-preset specs (#1146).
//
// Was a single src/_data/assemblerPresets.json (`{ $comment, presets: [...] }`); each preset now lives in
// src/_data/assemblerPresets/<name>.json, mirroring src/_data/blocks/ (#882). The consumer contract is the
// wrapper object `{ presets: [...] }` (templates iterate `assemblerPresets.presets`), so this loader globs
// the per-preset files and re-wraps them — the assembled shape is unchanged, only the granularity moved.
//
// On the pinned Eleventy v2 this `assemblerPresets.js` and the sibling `src/_data/assemblerPresets/`
// directory both target the `assemblerPresets` key — the loader's object wins, the directory does not collide.
const { loadPresets } = require('../../scripts/lib/presets-loader.cjs');

module.exports = () => ({ presets: loadPresets() });
