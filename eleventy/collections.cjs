// eleventy/collections.cjs — all eleventyConfig.addCollection registrations.
// Fragment of .eleventy.js (#2184). Collections are name-keyed; order is immaterial.

/**
 * Register all collections on the given eleventyConfig.
 * @param {import("@11ty/eleventy").UserConfig} eleventyConfig
 * @param {string} repoRoot - absolute path to the repo root (passed in from .eleventy.js)
 */
function registerCollections(eleventyConfig, repoRoot) {
  // Flatten adapters from categories for pagination.
  // Assemble fresh each build via the shared one-file-per-adapter loader (#1938) — NOT a top-level
  // `require` of a cached module — so adapter additions hot-reload on the watch server like
  // blocks/projects/intents do via the data cascade (the loader itself is `require`d, but it re-reads
  // src/_data/adapters/ from disk on every call). See backlog/050-eleventy-adapter-require-cache.md. The
  // watch target below triggers the rebuild.
  eleventyConfig.addCollection("flatAdapters", function(collectionApi) {
    const { loadAdapterItems } = require("../scripts/lib/adapters-loader.cjs");
    return loadAdapterItems();
  });
}

module.exports = { registerCollections };
