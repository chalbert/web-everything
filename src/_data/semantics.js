// The `semantics` 11ty global — assembled from one-file-per-term specs (#1146).
//
// Was a single src/_data/semantics.json (194 prose entries — a high merge-conflict surface as new
// standards add terms); now one-file-per-term in src/_data/semantics/<slug>.json (file named by the term
// slug), mirroring src/_data/blocks/ (#882) and src/_data/intents/ (#1145). A new glossary term is a new
// file — two parallel-batch lanes adding terms never collide. The loader globs those files into the same
// `semantics` array (sorted by term) every template and validator already consumes.
//
// On the pinned Eleventy v2 this `semantics.js` and the sibling `src/_data/semantics/` directory both
// target the `semantics` key — the loader's array wins, the directory's auto-nested data does not collide.
const { loadSemantics } = require('../../scripts/lib/semantics-loader.cjs');

module.exports = () => loadSemantics();
