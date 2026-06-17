// componentTokens — the resolved webtheme component-token tier, exposed to Eleventy so the per-block
// token panel (`block-pages.njk`) can render its rows. Keyed by token-group name (`button`, `card`, …);
// a block names the group(s) it draws from via its `componentTokens` field (#802 Fork 2).
//
// Shares the SAME resolution as the CEM emit (`scripts/gen-cem.mjs`) — both call
// `resolvedComponentGroups()` so the token panel and the manifest can never disagree (#802 Fork 1's
// one-source principle). This repo is CommonJS, so the ESM helper (esbuild-transpiles the TS webtheme
// modules) is pulled in via a dynamic import inside this async data file.
module.exports = async function () {
  const { resolvedComponentGroups } = await import('../../scripts/lib/component-tokens.mjs');
  return resolvedComponentGroups();
};
