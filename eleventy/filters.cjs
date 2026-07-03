// eleventy/filters.cjs — all eleventyConfig.addFilter registrations.
// Fragment of .eleventy.js (#2184). Each filter is registered by a unique name; order within
// this file is immaterial to Eleventy — registrations are name-keyed, not position-keyed.

const { deriveResearchFreshness } = require("../scripts/lib/research-freshness.cjs");

// webStandards display structuring (#828)
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

/**
 * Register all filters on the given eleventyConfig.
 * @param {import("@11ty/eleventy").UserConfig} eleventyConfig
 */
function registerFilters(eleventyConfig) {
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
        entryPoints: [__dirname + "/../blocks/renderers/jsx/htmlToJsx.ts"],
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
      const src = fs.readFileSync(__dirname + "/../blocks/renderers/jsx/render-strategy/crossStrategy.ts", "utf8");
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
      const src = fs.readFileSync(__dirname + "/../blocks/renderers/jsx/eventHandlerForm.ts", "utf8");
      const { code } = transformSync(src, { loader: "ts", format: "cjs" });
      const m = { exports: {} };
      new Function("module", "exports", "require", code)(m, m.exports, require);
      _eventHandlerForm = m.exports;
    }
    return _eventHandlerForm.toFunctionProp(String(jsx));
  });

  // Backlog tracked-work tile grid (#2018, keystone #2016) — the same SSR path applied to the biggest
  // hand-rolled surface on the site (the /backlog/ item grid). Each tile renders as a `we-card` (its
  // `#num Title` → card title; its whole badge/blocker/summary/children/meta body → one trusted body part)
  // in ONE subprocess batch to the pinned FUI CLI (render-from-data per #2007). UNLIKE the intent/project/
  // stage grids, the tile BODY arrives pre-rendered: it is composed in the template by the SHARED
  // `backlog-badges.njk` macros (the anti-drift single source of truth — re-defining them is a
  // `check:standards` error), so this filter only wraps the SSR card shell around that macro HTML. The
  // outer `.project-card` filter/link chrome (the `data-status/kind/size/tier` facets the client filter
  // reads) stays in the wrapper; the client `<we-card>` CE upgrade (base.njk) is a pure enhancement over
  // the JS-off-correct baseline.
  const { renderBacklogGrid } = require("../scripts/lib/component-render-build-hook.cjs");
  eleventyConfig.addFilter("weBacklogGrid", function (tiles) {
    return renderBacklogGrid(tiles, require("path").resolve(__dirname, ".."));
  });
}

module.exports = { registerFilters };
