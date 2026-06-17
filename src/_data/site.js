// Canonical site origin for absolute URLs (sitemap <loc>, future og:url/canonical).
// Override at build time with SITE_URL=… when deploying to a real domain; the
// default is a placeholder that the rendered-site a11y gate (#770/#774) strips back
// to a pathname anyway — it consumes the sitemap for its route list, not the host.
module.exports = {
  url: (process.env.SITE_URL || "https://webeverything.dev").replace(/\/$/, ""),
};
