/**
 * component-tokens.mjs — resolve the webtheme component-token tier into per-group rows, the single
 * source both the CEM emit (`scripts/gen-cem.mjs`) and the docs token panel (`src/_data/componentTokens.js`)
 * consume. Ratified by #802 (Fork 1 → CEM `cssProperties` projected from the token tier; Fork 3 → the
 * override · alias · resolved-literal shape).
 *
 * `webtheme/` is TypeScript and this repo's Node has no TS loader, so we transpile the real modules on the
 * fly with esbuild (bundled to one ESM, imported via a data: URL) rather than duplicating the token data —
 * the resolution stays the webtheme SoT (`flattenTokens` → `resolveTokens`), never a re-implementation.
 */
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

let _webtheme;
/** Transpile + import the real webtheme token modules once (cached per process). */
async function loadWebtheme() {
  if (_webtheme) return _webtheme;
  const res = await build({
    stdin: {
      contents:
        "export { defaultTokens } from './webtheme/defaultTokens.ts';" +
        "export { flattenTokens, resolveTokens, cssVarName } from './webtheme/tokens.ts';",
      resolveDir: ROOT,
      sourcefile: 'webtheme-entry.ts',
      loader: 'ts',
    },
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
  });
  const code = res.outputFiles[0].text;
  _webtheme = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
  return _webtheme;
}

/**
 * Resolve the component-token tier into rows keyed by their top-level group name (`button`, `card`, …).
 * Each row carries the three things #802 Fork 3 shows — the CSS custom property the block overrides, the
 * alias it references, and the literal it resolves to — plus `$type` for an optional CEM `syntax`.
 *
 *   { name:'--button-radius', aliasOf:'radius.md', reference:'var(--radius-md)', resolved:'0.5rem', type:'dimension' }
 */
export async function resolvedComponentGroups() {
  const wt = await loadWebtheme();
  const resolved = wt.resolveTokens(wt.flattenTokens(wt.defaultTokens));
  const groups = {};
  for (const t of resolved) {
    const group = t.path[0];
    (groups[group] ||= []).push({
      name: wt.cssVarName(t.path),
      aliasOf: t.aliasOf,
      reference: t.aliasOf ? `var(${wt.cssVarName(t.aliasOf.split('.'))})` : null,
      resolved: String(t.resolved),
      type: t.type || null,
      description: t.description || null,
    });
  }
  return groups;
}

/** Normalize a block's `componentTokens` field (string | string[] | undefined) to a group-name array. */
export function componentTokenGroups(field) {
  if (!field) return [];
  return Array.isArray(field) ? field : [field];
}
