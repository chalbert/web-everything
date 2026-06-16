/**
 * webpack plugin: the trait Enforcer for webpack (#744), against the #716 neutral
 * contract. webpack has no Rollup-style `resolveId`/`load` pair, so the virtual
 * manifest is served by intercepting the module request in `normalModuleFactory`'s
 * `beforeResolve` hook and rewriting it to a `data:text/javascript` URI carrying
 * the generated source — webpack 5 parses such modules natively, so each lazy
 * `() => import()` still code-splits into its own chunk and an unused trait into
 * none. The body is the same shared {@link buildTraitManifestSource} core, so a
 * webpack build emits a byte-identical manifest to Vite/Rollup/esbuild/Parcel.
 *
 * ```ts
 * // webpack.config.js
 * const { traitEnforcerWebpack } = require('@webeverything/trait-enforcer/webpack');
 * module.exports = { plugins: [traitEnforcerWebpack({ traitMap: { sortable: '/traits/Sortable' } })] };
 * ```
 */
import type { Compiler } from 'webpack';
import {
  DEFAULT_VIRTUAL_ID,
  buildTraitManifestSource,
  type TraitEnforcerOptions,
} from './vite-plugin.js';

const PLUGIN_NAME = 'web-everything-trait-enforcer';

export function traitEnforcerWebpack(options: TraitEnforcerOptions) {
  const virtualId = options.virtualId ?? DEFAULT_VIRTUAL_ID;

  return {
    apply(compiler: Compiler) {
      compiler.hooks.normalModuleFactory.tap(PLUGIN_NAME, (nmf) => {
        nmf.hooks.beforeResolve.tap(PLUGIN_NAME, (resolveData) => {
          if (resolveData.request !== virtualId) return;
          // Rewrite the bare virtual id to a data: URI module carrying the
          // generated manifest source. The literal `() => import(spec)` thunks
          // inside it remain real dynamic imports, so webpack code-splits each.
          const source = buildTraitManifestSource(options);
          resolveData.request = 'data:text/javascript,' + encodeURIComponent(source);
        });
      });
    },
  };
}
