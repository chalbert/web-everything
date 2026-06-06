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

  // Build-time HTML → JSX (mirror dialect). Lazily esbuild-transpiles the shared TS transform
  // (blocks/renderers/jsx/htmlToJsx.ts — the same source the browser/tests use) and runs it over a
  // linkedom document so the source-toggle's JSX pane is generated from the authored HTML.
  let _htmlToJsx;
  eleventyConfig.addFilter("htmlToJsx", function(html) {
    if (!_htmlToJsx) {
      const fs = require("fs");
      const { transformSync } = require("esbuild");
      const src = fs.readFileSync(__dirname + "/blocks/renderers/jsx/htmlToJsx.ts", "utf8");
      const { code } = transformSync(src, { loader: "ts", format: "cjs" });
      const m = { exports: {} };
      new Function("module", "exports", "require", code)(m, m.exports, require);
      _htmlToJsx = m.exports.htmlToJsx;
    }
    const { parseHTML } = require("linkedom");
    const { document } = parseHTML("<!DOCTYPE html><html><body></body></html>");
    return _htmlToJsx(String(html), document);
  });

  // Build-time Axis-2 lowering: declarative-static JSX → vdom JSX (the #078 cross-strategy
  // compiler). Lazily esbuild-transpiles the shared TS — the SAME lift() the tests exercise — so
  // the strategy toggle's vdom pane is generated from the authored declarative source, not hand-kept.
  let _crossStrategy;
  eleventyConfig.addFilter("liftToVdom", function(declarative) {
    if (!_crossStrategy) {
      const fs = require("fs");
      const { transformSync } = require("esbuild");
      const src = fs.readFileSync(__dirname + "/blocks/renderers/jsx/render-strategy/crossStrategy.ts", "utf8");
      const { code } = transformSync(src, { loader: "ts", format: "cjs" });
      const m = { exports: {} };
      new Function("module", "exports", "require", code)(m, m.exports, require);
      _crossStrategy = m.exports;
    }
    return _crossStrategy.lift(String(declarative).trim()).code;
  });

  // Flatten adapters from categories for pagination.
  // Read the file fresh each build (not `require`, which Node module-caches) so adapter additions
  // hot-reload on the watch server like blocks/projects/intents do via the data cascade — see
  // backlog/050-eleventy-adapter-require-cache.md. The watch target below triggers the rebuild.
  eleventyConfig.addCollection("flatAdapters", function(collectionApi) {
    const fs = require("fs");
    const adapters = JSON.parse(fs.readFileSync(__dirname + "/src/_data/adapters.json", "utf8"));
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
  // adapters.json is read fresh in the flatAdapters collection (not the data cascade), so watch it
  // explicitly — otherwise new adapter pages 404 on the live dev server until restart.
  eleventyConfig.addWatchTarget("src/_data/adapters.json");

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
