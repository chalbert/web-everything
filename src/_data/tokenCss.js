// tokenCss — the JS-first token CSS exposed to Eleventy so the base layout can inline it into the
// `<head>` pre-paint (#1813, ruled by #1824). The injector-derived `--token-*` resolved-theme block
// (FUI webtheme default + the WE-site project theme, `src/_data/weSiteTheme.js`) plus the legacy
// `--<family>-*` alias bridge, emitted one-way (JS→CSS). Read fresh each build — no committed
// generated artifact to drift.
//
// This `_data` global is the ONLY Eleventy-coupled surface of the transport; the emit itself lives in
// the engine-agnostic `scripts/lib/token-css.mjs`, so a future move off Eleventy (#777) re-points one
// sink. This repo is CommonJS, so the ESM helper is pulled in via dynamic import inside this async
// data file (the same shape as `componentTokens.js`).
module.exports = async function () {
  const { tokenCss } = await import('../../scripts/lib/token-css.mjs');
  return tokenCss();
};
