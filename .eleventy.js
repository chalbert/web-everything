const syntaxHighlight = require("@11ty/eleventy-plugin-syntaxhighlight");

const { deriveResearchFreshness } = require("./scripts/lib/research-freshness.cjs");
const { buildTechnicalConfiguratorUrl } = require("./scripts/lib/technical-configurator-url.cjs");

module.exports = function (eleventyConfig) {
  eleventyConfig.addPlugin(syntaxHighlight);

  // Research-freshness badge derivation (#441 Fork 4 / #477): the same now-injected helper backing
  // check:standards' warn-only rule (a CJS module so this sync Eleventy 2.x config can require it; the
  // ESM rules module re-exports it). Returns { state: 'fresh'|'stale'|'unreviewed', dueDate, ... } so
  // the badge styles fresh vs. stale off the exact logic the gate uses.
  eleventyConfig.addFilter("researchFreshness", (topic) => deriveResearchFreshness(topic || {}));

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

  // fuiDemo (#701): embed a Frontier-UI-hosted demo inline next to its standard page via a sandboxed
  // <iframe> — no cross-repo import (the #700 ruling). The demo stays a FUI deliverable and keeps FUI
  // branding (the chrome lives in this WE wrapper). The FUI base URL is parameterised: the dev server
  // (:3001) by default, or a published demos host via FUI_DEMO_BASE in prod. Generalises to ANY FUI demo
  // — pass the demo's file name; the first consumer is the #038 component-converter on /blocks/component/.
  const FUI_DEMO_BASE = (process.env.FUI_DEMO_BASE || "http://localhost:3001").replace(/\/$/, "");
  // Per-demo render mode opt-in (#807/#786, ruled by #732/#765). The escape/resize/mount impl is the
  // FUI-owned embed SDK WE loads (impl→FUI; never the #700 source import) — WE only passes the mode
  // token. With no mode the iframe is the legacy static embed, byte-for-byte. Canonical tokens mirror
  // FUI's `RenderMode` contract; A/B1 + C (in-document) implemented, B2 reserved.
  const FUI_EMBED_MODES = {
    a: "contained", contained: "contained",
    b1: "host-restyle", "host-restyle": "host-restyle",
    c: "in-document", "in-document": "in-document",
  };
  const fuiDemoChrome = (label, src) => `  <figcaption class="fui-demo-chrome">
    <span class="fui-demo-badge" title="Hosted by Frontier UI — the implementation repo">Frontier&nbsp;UI demo</span>
    <span class="fui-demo-title">${label}</span>
    <a class="fui-demo-open" href="${src}" target="_blank" rel="noopener">Open in Frontier&nbsp;UI ↗</a>
  </figcaption>`;
  const fuiHostScript = `<script type="module" src="${FUI_DEMO_BASE}/embed/embed-host.ts"></script>`;
  eleventyConfig.addShortcode("fuiDemo", function(demoFile, title, height, mode) {
    const src = `${FUI_DEMO_BASE}/demos/${demoFile}`;
    const h = height || 460;
    const label = title || demoFile;
    const canonicalMode = mode ? FUI_EMBED_MODES[String(mode).trim().toLowerCase()] : null;
    if (!canonicalMode) {
      // Legacy path — static, sandboxed iframe with no SDK.
      return `<figure class="fui-demo">
${fuiDemoChrome(label, src)}
  <iframe class="fui-demo-frame" src="${src}" title="${label}" loading="lazy" sandbox="allow-scripts allow-same-origin" style="height:${h}px"></iframe>
</figure>`;
    }
    if (canonicalMode === "in-document") {
      // Mode C (#786): no iframe. Emit a mount point the FUI embed SDK populates by mounting the FUI
      // component directly in WE's DOM behind a shadow root (WE↔FUI-only, trust-gated, #765). The
      // `demoFile` here is the demo *module* (e.g. "foo.ts") exporting `mountInDocument`. Still a
      // runtime FUI bundle — impl→FUI, no #700 source import / `frontierui` alias.
      return `<figure class="fui-demo fui-demo--in-document">
${fuiDemoChrome(label, src)}
  <div class="fui-demo-frame" data-embed-mode="in-document" data-embed-src="${src}" title="${label}" style="min-height:${h}px"></div>
</figure>
${fuiHostScript}`;
    }
    // Iframe opt-in path (A/B1) — append the mode so the guest activates, tag the frame for the host,
    // and load the FUI embed-host SDK. The `<script>` is module-deduped by URL, safe to emit per demo.
    const frameSrc = `${src}?embed-mode=${canonicalMode}`;
    return `<figure class="fui-demo">
${fuiDemoChrome(label, src)}
  <iframe class="fui-demo-frame" src="${frameSrc}" data-embed-mode="${canonicalMode}" title="${label}" loading="lazy" sandbox="allow-scripts allow-same-origin" style="height:${h}px"></iframe>
</figure>
${fuiHostScript}`;
  });

  // technicalConfigurator (#752): embed the Plateau Technical Configurator next to a block's standard
  // page, seeded with that block's technical dimensions. Per the constellation, the configurator is a
  // Plateau offering WE *embeds* (never imports) — same sandboxed-iframe boundary as fuiDemo. Per the
  // #788 ratification the seed transport is URL-canonical + typed (built by
  // technical-configurator-url.cjs); the embed src carries `embed=1`, the "Open full configurator ↗"
  // deep-link omits it so it lands on the project-wide tool. Base URL is env-parameterised:
  // plateau-app dev server (:4000) by default, a published host via PLATEAU_BASE in prod.
  const PLATEAU_BASE = (process.env.PLATEAU_BASE || "http://localhost:4000").replace(/\/$/, "");
  eleventyConfig.addShortcode("technicalConfigurator", function(config, height) {
    const cfg = config || {};
    const embedSrc = buildTechnicalConfiguratorUrl(PLATEAU_BASE, cfg, { embed: true });
    const deepLink = buildTechnicalConfiguratorUrl(PLATEAU_BASE, cfg, {});
    const h = height || 520;
    return `<figure class="fui-demo tc-embed">
  <figcaption class="fui-demo-chrome">
    <span class="fui-demo-badge tc-embed-badge" title="Hosted by Plateau — the product app">Plateau&nbsp;configurator</span>
    <span class="fui-demo-title">Seeded with this block's technical dimensions</span>
    <a class="fui-demo-open" href="${deepLink}" target="_blank" rel="noopener">Open full configurator ↗</a>
  </figcaption>
  <iframe class="fui-demo-frame" src="${embedSrc}" title="Technical configurator (seeded)" loading="lazy" sandbox="allow-scripts allow-same-origin" style="height:${h}px"></iframe>
</figure>`;
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
