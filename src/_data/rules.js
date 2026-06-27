// The `rules` 11ty global — the statute layer's read path (#1828, ratifies #1792 Fork 1 → (c)).
//
// Renders the four `codifiedIn:`-cited governance docs (docs/agent/{platform-decisions, block-standard,
// backlog-workflow, vision-tiers}.md) to /rules/ with their heading AND inline anchors intact, keeping the
// markdown the source of truth (no per-rule records migration). src/rules.njk consumes this for the index;
// src/rules-pages.njk paginates it for one rendered page per doc. The loader lives in scripts/lib so the
// `codifiedIn:` anchor-resolution gate (check:standards) can re-use the exact same anchor extraction.
const { loadRules } = require('../../scripts/lib/rules-loader.cjs');

module.exports = () => loadRules();
