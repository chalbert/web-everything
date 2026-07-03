// The `normativeSpecs` 11ty global — assembled from one-file-per-spec entries (#2097, #2096).
//
// Each entry in src/_data/normativeSpecs/<id>.json describes a normative spec partial at
// src/_includes/spec-descriptions/<category>/<id>.njk, rendered at /specs/<category>/<id>/
// by src/spec-pages.njk. The skeleton and home are ratified by #2096; this pilot entry (#2097)
// is CustomNodeRegistry — the worked example every per-category authoring wave of epic #2079 copies.
//
// Scope policy (Fork 3-a of #2096): active ⇒ spec required; draft/experimental ⇒ permitted + required
// for promotion; concept ⇒ exempt. The gate enforcement (check-standards.mjs) is authored by the wave
// that first makes a standard active; the pilot exercises the permitted arm (draft ⇒ authored early).
const { loadDataRegistry } = require('../../scripts/lib/registry-loader.cjs');

module.exports = () => loadDataRegistry('normativeSpecs');
