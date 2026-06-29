// Canonical site origin for absolute URLs (sitemap <loc>, future og:url/canonical).
// Override at build time with SITE_URL=… when deploying to a real domain; the
// default is a placeholder that the rendered-site a11y gate (#770/#774) strips back
// to a pathname anyway — it consumes the sitemap for its route list, not the host.
module.exports = {
  url: (process.env.SITE_URL || "https://webeverything.dev").replace(/\/$/, ""),

  // Product-component namespace knob (#1953, ratified #1886 — platform-decisions.md
  // #identity-semantic-look-composable "Namespace"). `we-*` is reserved for the standard+primitive
  // layer (WE/FUI); a *product* owns its own namespace for the components it composes from those
  // primitives (`standard-card`, `standard-section`, …). Default empty → the WE website ships them
  // unprefixed (`<standard-section>`). A published product sets this (e.g. "acme-") to namespace its
  // components — `<acme-standard-section>` — with no change to the authoring macros, which read this
  // value. Trailing-`-`-tolerant: a value is normalised to end with exactly one `-` (or stays empty).
  componentNamespace: (() => {
    const raw = (process.env.COMPONENT_NAMESPACE || "").trim();
    return raw === "" ? "" : raw.replace(/-+$/, "") + "-";
  })(),
};
