const syntaxHighlight = require("@11ty/eleventy-plugin-syntaxhighlight");

module.exports = function (eleventyConfig) {
  eleventyConfig.addPlugin(syntaxHighlight);

  // Custom filter to filter plugs by project membership
  eleventyConfig.addFilter("filterByProject", function(plugs, projectId) {
    return plugs.filter(plug => plug.projects && plug.projects.includes(projectId));
  });

  // Filter a list to items whose `attr` strictly equals `value`. Nunjucks (unlike Jinja2) has no
  // `equalto` test, so `selectattr("attr", "equalto", v)` silently falls back to a truthiness check and
  // returns EVERYTHING — a real footgun that leaked resolved items into the /backlog/ Prioritisation
  // table. Use this instead of selectattr+equalto for any equality filter in a template.
  eleventyConfig.addFilter("where", function(list, attr, value) {
    return (list || []).filter(item => item && item[attr] === value);
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
      const { buildSync } = require("esbuild");
      // Bundle (not just transpile) so htmlToJsx.ts's relative imports (e.g. ./dialect, #235) are
      // inlined — a standalone transform would emit a bare require("./dialect") that can't resolve
      // from the 11ty config's cwd.
      const { outputFiles } = buildSync({
        entryPoints: [__dirname + "/blocks/renderers/jsx/htmlToJsx.ts"],
        bundle: true,
        format: "cjs",
        platform: "node",
        write: false,
      });
      const m = { exports: {} };
      new Function("module", "exports", "require", outputFiles[0].text)(m, m.exports, require);
      _htmlToJsx = m.exports.htmlToJsx;
    }
    const { parseHTML } = require("linkedom");
    const { document } = parseHTML("<!DOCTYPE html><html><body></body></html>");
    return _htmlToJsx(String(html), document);
  });

  // Build-time syntax highlighting for the autoToggle-generated source panes. The manual
  // `{% highlight %}` panes are colored by @11ty/eleventy-plugin-syntaxhighlight (Prism), but the
  // autoToggle macro emits plain escaped text — so the generated HTML/JSX panes had no `.token`
  // markup and looked inconsistent (backlog/071). This filter runs the SAME Prism the plugin uses
  // over a code string and returns its token markup; the macro injects it with `| safe` (Prism
  // already escapes `<`/`&`, so do NOT also pipe through `escape`). `prism-theme.css` styles the
  // tokens, so generated and hand-authored panes now match.
  let _prism;
  eleventyConfig.addFilter("highlightCode", function(code, lang) {
    if (!_prism) {
      _prism = require("prismjs");
      require("prismjs/components/prism-markup");
      require("prismjs/components/prism-clike");
      require("prismjs/components/prism-javascript");
      require("prismjs/components/prism-jsx");
      require("prismjs/components/prism-typescript");
      require("prismjs/components/prism-tsx");
    }
    const grammar = _prism.languages[lang];
    const text = String(code).trim();
    // Unknown language → fall back to a manually-escaped, untokenized string (never raw HTML).
    if (!grammar) return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return _prism.highlight(text, grammar, lang);
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

  // Build-time event-handler display form (#324): rewrite the canonical string-behavior spelling
  // (on:click="inc($event)") that htmlToJsx emits into the convenience function-prop spelling
  // (onclick={inc}) for the source toggle's "JSX · fn" pane. Lazily esbuild-transpiles the SAME
  // shared transform the tests exercise (blocks/renderers/jsx/eventHandlerForm.ts) — a second
  // presentation axis, orthogonal to the html|react name dialect; the canonical pane stays the source.
  let _eventHandlerForm;
  eleventyConfig.addFilter("eventHandlerToFunctionProp", function(jsx) {
    if (!_eventHandlerForm) {
      const fs = require("fs");
      const { transformSync } = require("esbuild");
      const src = fs.readFileSync(__dirname + "/blocks/renderers/jsx/eventHandlerForm.ts", "utf8");
      const { code } = transformSync(src, { loader: "ts", format: "cjs" });
      const m = { exports: {} };
      new Function("module", "exports", "require", code)(m, m.exports, require);
      _eventHandlerForm = m.exports;
    }
    return _eventHandlerForm.toFunctionProp(String(jsx));
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
  // Design-reference corpus (#382): serve the WebP shots under the gallery page's URL, and watch
  // design-refs so new captures (and the designRefs data loader) hot-reload on the dev server.
  eleventyConfig.addPassthroughCopy({ "design-refs/items": "research/design-references/shots" });
  eleventyConfig.addWatchTarget("design-refs");

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
