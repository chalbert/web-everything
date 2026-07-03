// .eleventy.js — thin loader over eleventy/*.cjs fragments (#2184).
//
// WHY FRAGMENT-SPLIT? `.eleventy.js` was a 380-line registration monolith: every addFilter/
// addShortcode/... lived in one file, so any two concurrent lane edits would clean-merge but
// silently last-win on same-name registrations — the #2149 Fork-2 category-③ merge-risk ruling.
//
// FRAGMENT STRATEGY: each category of registration lives in its own eleventy/*.cjs file.
// Eleventy's addFilter/addShortcode/addCollection/addTransform/addWatchTarget/addPassthroughCopy
// calls are ALL name-keyed and order-insensitive within their category — concurrent edits to
// DIFFERENT fragments are provably disjoint (they touch different files). The thin root keeps only:
//   • addPlugin (must run early, plugin may itself register filters/shortcodes — keep first)
//   • addNunjucksGlobal (needs componentNamespace from site.js — one-liner, not worth its own fragment)
//   • the return { dir: … } config block (static, low-churn)
//
// ORDER-SENSITIVITY AUDIT (justifies the category-① delist from RESERVED_MERGE_RISK_BY_REPO):
//   • addPlugin(syntaxHighlight): must be called before any filter/shortcode that relies on it,
//     kept in the thin root (first call), not in any fragment — order preserved.
//   • addFilter / addShortcode: Eleventy 2.x registers by unique name; last-write-wins only if
//     the SAME name is registered twice. All names here are unique (verified: no duplicate
//     registrations). Concurrent fragment edits NEVER touch the same name → disjoint by key.
//   • addCollection: name-keyed ("flatAdapters"); one entry, no ordering risk.
//   • addTransform: name-keyed ("weDataTableSSR"); one entry.
//   • eleventy.on("eleventy.after"): appended; multiple listeners are fine (event bus, not last-wins).
//   • addWatchTarget / addPassthroughCopy: additive sets; order irrelevant.
// CONCLUSION: all registration categories are order-insensitive for DISTINCT-name concurrent edits.
// The monolith guard is no longer needed; `.eleventy.js` is delisted from RESERVED_MERGE_RISK_BY_REPO
// (see scripts/readiness/lane-partition.mjs — this commit removes the entry).

const syntaxHighlight = require("@11ty/eleventy-plugin-syntaxhighlight");
const { componentNamespace } = require("./src/_data/site.js");

const { registerFilters }      = require("./eleventy/filters.cjs");
const { registerShortcodes }   = require("./eleventy/shortcodes.cjs");
const { registerCollections }  = require("./eleventy/collections.cjs");
const { registerTransforms }   = require("./eleventy/transforms.cjs");
const { registerPassthroughs } = require("./eleventy/passthroughs.cjs");

module.exports = function (eleventyConfig) {
  // Plugin registration must come first (may seed filter/shortcode slots the fragments also use).
  eleventyConfig.addPlugin(syntaxHighlight);

  // Product-component namespace knob (#1953, ratified #1886 — platform-decisions.md
  // #identity-semantic-look-composable "Namespace"). Exposed as a Nunjucks GLOBAL so the
  // product-components.njk macros can read it: macros do not see the template data cascade
  // (`site.*`), but Nunjucks globals are visible inside macro bodies. Single-sources the value
  // from src/_data/site.js so the data cascade (`site.componentNamespace`) and the macro path agree.
  eleventyConfig.addNunjucksGlobal("componentTag", (base) => `${componentNamespace}${base}`);

  // Delegate all category registrations to their fragments.
  // repoRoot = __dirname (this file lives at the repo root); fragments need it for cross-dir requires.
  const repoRoot = __dirname;
  registerFilters(eleventyConfig, repoRoot);
  registerShortcodes(eleventyConfig, repoRoot);
  registerCollections(eleventyConfig, repoRoot);
  registerTransforms(eleventyConfig, repoRoot);
  registerPassthroughs(eleventyConfig);

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      layouts: "_layouts"
    },
    templateFormats: ["md", "njk", "html"],
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    dataTemplateEngine: "njk",
  };
};
