// The `researchTopics` 11ty global — assembled from one-file-per-topic specs (#1145).
//
// The research registry used to live in a single ~336 KB src/_data/researchTopics.json — the highest-churn
// registry (every /prepare + /decision turn edits it). It now lives one-file-per-topic in
// src/_data/researchTopics/<id>.json, mirroring src/_data/blocks/ (#882) and backlog/*.md — so a topic edit
// is a small, conflict-free diff with an unambiguous path, and two parallel-batch lanes preparing different
// topics never collide. This loader globs those files into the same `researchTopics` array every template
// and validator already consumes, so the assembled-array contract is unchanged (only the granularity moved).
//
// On the pinned Eleventy v2, this `researchTopics.js` loader and the sibling `src/_data/researchTopics/`
// directory both target the `researchTopics` key — the loader's array wins, the directory's auto-nested
// data does not collide (verified for blocks.js + src/_data/blocks/).
const { loadResearch } = require('../../scripts/lib/research-loader.cjs');

module.exports = () => loadResearch();
