// eleventy/shortcodes.cjs — all eleventyConfig.addShortcode registrations.
// Fragment of .eleventy.js (#2184). Each shortcode is registered by a unique name; order within
// this file is immaterial to Eleventy — registrations are name-keyed, not position-keyed.

const { buildTechnicalConfiguratorUrl } = require("../scripts/lib/technical-configurator-url.cjs");
const { renderIntentGrid, renderProjectGrid, renderStageGrid } = require("../scripts/lib/component-render-build-hook.cjs");

// fuiDemo (#701): embed a Frontier-UI-hosted demo inline next to its standard page via a sandboxed
// <iframe> — no cross-repo import (the #700 ruling). The demo stays a FUI deliverable and keeps FUI
// branding (the chrome lives in this WE wrapper). The FUI base URL is parameterised: the dev server
// (:6002) by default, or a published demos host via FUI_DEMO_BASE in prod. Generalises to ANY FUI demo
// — pass the demo's file name; the first consumer is the #038 component-converter on /blocks/component/.
// (:6002 not :6000 — 6000 is X11, a browser-blocked unsafe port.)
const FUI_DEMO_BASE = (process.env.FUI_DEMO_BASE || "http://localhost:6002").replace(/\/$/, "");
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

// technicalConfigurator (#752): embed the Plateau Technical Configurator next to a block's standard
// page, seeded with that block's technical dimensions. Per the constellation, the configurator is a
// Plateau offering WE *embeds* (never imports) — same sandboxed-iframe boundary as fuiDemo. Per the
// #788 ratification the seed transport is URL-canonical + typed (built by
// technical-configurator-url.cjs); the embed src carries `embed=1`, the "Open full configurator ↗"
// deep-link omits it so it lands on the project-wide tool. Base URL is env-parameterised:
// plateau-app dev server (:4000) by default, a published host via PLATEAU_BASE in prod.
const PLATEAU_BASE = (process.env.PLATEAU_BASE || "http://localhost:4000").replace(/\/$/, "");

/**
 * Register all shortcodes on the given eleventyConfig.
 * @param {import("@11ty/eleventy").UserConfig} eleventyConfig
 * @param {string} repoRoot - absolute path to the repo root (passed in from .eleventy.js)
 */
function registerShortcodes(eleventyConfig, repoRoot) {
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

  // SSR component-render (#2016, keystone of the #777 WE-docs dogfood epic) — the general build-time
  // component→HTML render path. `{% weIntentGrid intents %}` renders the intents catalog's card/badge/tag
  // tiles to real SSR HTML in ONE subprocess batch to the pinned FUI build-CLI (render-from-data per
  // #2007 — the SSR tool emits the block's shape from data, it does NOT treat authored markup as source).
  // The output is byte-identical to what the transient `<we-card>`/`<we-badge>`/`<we-tag>` elements upgrade
  // to at runtime, so the page is correct with JS off and the client CE upgrade (`src/_layouts/base.njk`)
  // becomes a pure enhancement. Same subprocess boundary + pinned-artifact/missing-artifact hard error as
  // the data-table hook above; the block factories live in FUI (a WE→FUI import is a banned backward DAG
  // edge). The pinned FUI artifact MUST already exist (FUI `build:tools` before WE `build:docs`).
  eleventyConfig.addShortcode("weIntentGrid", function (intents) {
    return renderIntentGrid(intents, repoRoot);
  });

  // Home/index landing grid (#2019) — the same #2016 SSR path generalized to the project tiles. Each
  // project renders as a `we-card` (name → title, status → header `we-badge`, icon+description+status-meter
  // → body) in ONE subprocess batch to the pinned FUI CLI (render-from-data per #2007). `hrefFor` supplies
  // the tile link (internal `/projects/{id}/` for standards/protocols; external for the impls tiles), and
  // `external` toggles `target="_blank"`. The client `<we-card>` CE upgrade (base.njk) is a pure
  // enhancement over this JS-off-correct baseline.
  eleventyConfig.addShortcode("weProjectGrid", function (projects, opts) {
    const o = opts || {};
    const external = !!o.external;
    return renderProjectGrid(projects, {
      repoRoot,
      external,
      gridClass: o.gridClass || "project-grid",
      hrefFor: (project) => {
        if (o.href) return o.href(project);
        return external ? project.url : `/projects/${project.id}/`;
      },
    });
  });

  // Governance lifecycle stage cards (#2020, keystone #2016) — the same SSR path applied to the governance
  // page's four stage tiles. Each stage renders as a `we-card` (its `N · Name` line → title, its marker →
  // a header `we-badge`, its role/description/gate copy → the body) in ONE subprocess batch to the pinned
  // FUI CLI (render-from-data per #2007). No linking anchor — stage cards are not click-throughs. The
  // client `<we-card>`/`<we-badge>` CE upgrade (base.njk) is a pure enhancement over this JS-off baseline.
  eleventyConfig.addShortcode("weStageGrid", function (stages) {
    return renderStageGrid(stages, repoRoot);
  });
}

module.exports = { registerShortcodes };
