// One-file-per-research-topic assembler (#1145, mirrors the #882 blocks split). The research registry was a
// single src/_data/researchTopics.json (133 entries, ~336 KB) — the HIGHEST-churn registry, hammered by
// every /prepare + /decision turn, so the worst conflict surface for concurrent/parallel batch work. It now
// lives one-file-per-topic in src/_data/researchTopics/<id>.json, so two lanes preparing different topics
// touch different files and merge clean (the src/_data/blocks/ precedent).
//
// CJS so the single implementation is shared by BOTH runtimes: the 11ty data loader
// (src/_data/researchTopics.js, CommonJS) requires it, and the ESM `.mjs` scripts/tests import it. Assembly
// is SORTED BY id for a deterministic order independent of readdirSync's platform-dependent order. The
// topic field set (the contract) is unchanged — only the on-disk granularity moved.
const { readdirSync, readFileSync } = require('node:fs');
const { join } = require('node:path');

const RESEARCH_DIR = join(__dirname, '../../src/_data/researchTopics');

/** Assemble the per-topic spec files into the canonical `researchTopics` array, sorted by id. */
function loadResearch(dir = RESEARCH_DIR) {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

module.exports = { loadResearch, RESEARCH_DIR };
