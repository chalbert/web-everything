const syntaxHighlight = require("@11ty/eleventy-plugin-syntaxhighlight");

const { deriveResearchFreshness } = require("./scripts/lib/research-freshness.cjs");
const { buildTechnicalConfiguratorUrl } = require("./scripts/lib/technical-configurator-url.cjs");
const { spliceDataTables } = require("./scripts/lib/data-table-build-hook.cjs");

module.exports = function (eleventyConfig) {
  eleventyConfig.addPlugin(syntaxHighlight);

  // Product-component namespace knob (#1953, ratified #1886 — platform-decisions.md
  // #identity-semantic-look-composable "Namespace"). Exposed as a Nunjucks GLOBAL so the
  // product-components.njk macros can read it: macros do not see the template data cascade
  // (`site.*`), but Nunjucks globals are visible inside macro bodies. Single-sources the value
  // from src/_data/site.js so the data cascade (`site.componentNamespace`) and the macro path agree.
  const { componentNamespace } = require("./src/_data/site.js");
  eleventyConfig.addNunjucksGlobal("componentTag", (base) => `${componentNamespace}${base}`);

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

  // webStandards display structuring (#828): the {concern:{usage,reference}} bag (#803 realization SoT,
  // rendered raw by the #826 panel) is polished for /blocks/{id}/ WITHOUT changing the field shape —
  // humanize the camelCase concern key, bucket into a fixed category order, sort by label within a
  // bucket. Returns an array of {concern, label, category, usage, reference}; the template iterates it and
  // emits a category subheader on each group change. Pure presentation — the object on disk is untouched.
  const WS_ACRONYMS = new Set(["api","css","html","dom","url","apg","db","idb","ui","http","svg","json","cem","scxml"]);
  function humanizeConcern(key) {
    const tokens = String(key)
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")        // camelCase boundary
      .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")     // ACRONYMWord boundary (cacheAPI → cache API)
      .split(/\s+/).filter(Boolean);
    const cased = tokens.map(t =>
      WS_ACRONYMS.has(t.toLowerCase()) ? t.toUpperCase() : t.toLowerCase());
    // a leading aria-/apg- ARIA-attribute token hyphenates to the next (ariaCurrentStep →
    // "aria-current step"), matching the platform's own attribute spelling; the rest space-separate.
    if (cased.length >= 2 && (cased[0] === "aria" || cased[0] === "apg")) {
      return [cased[0] + "-" + cased[1], ...cased.slice(2)].join(" ");
    }
    return cased.join(" ");
  }
  const WS_CATEGORIES = ["ARIA & accessibility patterns", "CSS", "Platform APIs & DOM"];
  // explicit a11y/CSS members beyond the aria*/apg*/css* prefixes; everything unmatched falls to the
  // "Platform APIs & DOM" catch-all (never miscategorized — only the conservative prefixes + lists bucket).
  const WS_A11Y = new Set(["rovingTabindex","navigationLandmark","paginationNavLandmark","disclosureNavigation","headingElements","exclusiveAccordion","exclusiveGroups","inertAttribute","rowgroupScope"]);
  const WS_CSS = new Set(["containerQueries","flexWrap","contentVisibility","prefersReducedMotion"]);
  function concernCategory(key) {
    if (/^(aria|apg)/i.test(key) || WS_A11Y.has(key)) return WS_CATEGORIES[0];
    if (/^css/i.test(key) || WS_CSS.has(key)) return WS_CATEGORIES[1];
    return WS_CATEGORIES[2];
  }
  eleventyConfig.addFilter("webStandardsRows", function(bag) {
    if (!bag || typeof bag !== "object") return [];
    const rows = Object.entries(bag).map(([concern, detail]) => ({
      concern,
      label: humanizeConcern(concern),
      category: concernCategory(concern),
      usage: (detail && detail.usage) || "",
      reference: (detail && detail.reference) || "",
    }));
    rows.sort((a, b) => {
      const ci = WS_CATEGORIES.indexOf(a.category) - WS_CATEGORIES.indexOf(b.category);
      return ci !== 0 ? ci : a.label.localeCompare(b.label);
    });
    return rows;
  });

  // fuiDemo (#701): embed a Frontier-UI-hosted demo inline next to its standard page via a sandboxed
  // <iframe> — no cross-repo import (the #700 ruling). The demo stays a FUI deliverable and keeps FUI
  // branding (the chrome lives in this WE wrapper). The FUI base URL is parameterised: the dev server
  // (:6000) by default, or a published demos host via FUI_DEMO_BASE in prod. Generalises to ANY FUI demo
  // — pass the demo's file name; the first consumer is the #038 component-converter on /blocks/component/.
  const FUI_DEMO_BASE = (process.env.FUI_DEMO_BASE || "http://localhost:6000").replace(/\/$/, "");
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
  // Assemble fresh each build via the shared one-file-per-adapter loader (#1938) — NOT a top-level
  // `require` of a cached module — so adapter additions hot-reload on the watch server like
  // blocks/projects/intents do via the data cascade (the loader itself is `require`d, but it re-reads
  // src/_data/adapters/ from disk on every call). See backlog/050-eleventy-adapter-require-cache.md. The
  // watch target below triggers the rebuild.
  eleventyConfig.addCollection("flatAdapters", function(collectionApi) {
    const { loadAdapterItems } = require("./scripts/lib/adapters-loader.cjs");
    return loadAdapterItems();
  });

  // SSR data-table build orchestration (#1905, slice C of the #1867 harness) — detect a deterministic
  // `<we-data-table rows="[[ ref ]]">` web-expression binding in the rendered page HTML, resolve the bare
  // ref from the build-known data cascade, shell out to the version-pinned FUI build-CLI over the
  // subprocess boundary (keyed-batch in / keyed-batch out), and splice the returned SSR `<table>`. The
  // evaluator + renderer live in FUI (a WE→FUI import is a banned backward DAG edge), so WE orchestrates
  // the FUI compute over a process boundary; the build NEVER reads the dev /_maas/data/ route — that's the
  // dev-freshness HMR seam, not a build transport. See docs/agent/platform-decisions.md#ssr-data-table-build-harness.
  // Non-deterministic / unresolved bindings are left intact for the client runtime; non-table pages pay a
  // single substring check. The pinned FUI artifact MUST already exist (FUI `build:tools` before WE
  // `build:docs`, ratified #1946) — a missing artifact is a hard build error, never a silent skip.
  eleventyConfig.addTransform("weDataTableSSR", function (content) {
    if (!/\.html?$/.test(this.page && this.page.outputPath || "")) return content;
    return spliceDataTables(content, this.data || {}, __dirname);
  });

  // The backlog feeds off backlog/*.md (parsed by src/_data/backlog.js, which
  // lives outside the input dir) — watch it so edits trigger a rebuild in dev.
  // reports/*.md is watched too: pointer items mirror a report, so editing a
  // report must refresh the backlog that loads it.
  eleventyConfig.addWatchTarget("backlog");
  eleventyConfig.addWatchTarget("reports");
  // The per-adapter files are read fresh in the flatAdapters collection (not the data cascade), so watch
  // the directory explicitly — otherwise new adapter pages 404 on the live dev server until restart.
  eleventyConfig.addWatchTarget("src/_data/adapters");

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
