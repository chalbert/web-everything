const syntaxHighlight = require("@11ty/eleventy-plugin-syntaxhighlight");

module.exports = function (eleventyConfig) {
  eleventyConfig.addPlugin(syntaxHighlight);

  // Custom filter to filter plugs by project membership
  eleventyConfig.addFilter("filterByProject", function(plugs, projectId) {
    return plugs.filter(plug => plug.projects && plug.projects.includes(projectId));
  });

  // Reverse lookup: find blocks that implement a given intent
  eleventyConfig.addFilter("blocksForIntent", function(blocks, intentId) {
    return blocks.filter(b => b.implementsIntent === intentId);
  });

  // Flatten adapters from categories for pagination
  eleventyConfig.addCollection("flatAdapters", function(collectionApi) {
    const adapters = require("./src/_data/adapters.json");
    return adapters.flatMap(category =>
      category.items.map(item => ({ ...item, category: category.id, categoryTitle: category.title }))
    );
  });

  // The backlog feeds off backlog/*.md (parsed by src/_data/backlog.js, which
  // lives outside the input dir) — watch it so edits trigger a rebuild in dev.
  // reports/*.md is watched too: pointer items mirror a report, so editing a
  // report must refresh the backlog that loads it.
  eleventyConfig.addWatchTarget("backlog");
  eleventyConfig.addWatchTarget("reports");

  eleventyConfig.addPassthroughCopy("src/css");
  eleventyConfig.addPassthroughCopy("src/assets");
  eleventyConfig.addPassthroughCopy("demos");
  eleventyConfig.addPassthroughCopy("plugs");

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
