/**
 * Rollup plugin: the trait Enforcer for Rollup (#717), against the #716 neutral
 * contract. The Vite plugin's hook shape is already Rollup-compatible, so this is
 * the thinnest adapter — it shares the exact same {@link buildTraitManifestSource}
 * core, so a Rollup build emits a byte-identical manifest to Vite/webpack/esbuild
 * from the same input, and an unused trait code-splits to **zero bytes**.
 *
 * ```ts
 * // rollup.config.mjs
 * import { traitEnforcerRollup } from '@webeverything/trait-enforcer/rollup';
 * export default { plugins: [traitEnforcerRollup({ traitMap: { sortable: '/traits/Sortable' } })] };
 * ```
 */
import type { Plugin } from 'rollup';
import {
  DEFAULT_VIRTUAL_ID,
  buildTraitManifestSource,
  type TraitEnforcerOptions,
} from './vite-plugin.js';

export function traitEnforcerRollup(options: TraitEnforcerOptions): Plugin {
  const virtualId = options.virtualId ?? DEFAULT_VIRTUAL_ID;
  const resolvedId = '\0' + virtualId;

  return {
    name: 'web-everything-trait-enforcer',

    resolveId(id) {
      return id === virtualId ? resolvedId : null;
    },

    load(id) {
      if (id !== resolvedId) return null;
      return buildTraitManifestSource(options);
    },
  };
}
