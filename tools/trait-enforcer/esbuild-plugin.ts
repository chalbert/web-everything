/**
 * esbuild plugin: the trait Enforcer for esbuild (#717), against the #716 neutral
 * contract. esbuild's plugin model is `onResolve`/`onLoad` over a virtual
 * namespace rather than Rollup's `resolveId`/`load`, but the body is the same
 * shared {@link buildTraitManifestSource} core — so an esbuild build emits a
 * byte-identical manifest, and esbuild's own code-splitting (`splitting: true`)
 * turns each lazy `() => import()` into its own chunk, an unused trait into none.
 *
 * ```ts
 * import { traitEnforcerEsbuild } from '@webeverything/trait-enforcer/esbuild';
 * await build({ plugins: [traitEnforcerEsbuild({ traitMap })], splitting: true, format: 'esm', ... });
 * ```
 */
import type { Plugin } from 'esbuild';
import {
  DEFAULT_VIRTUAL_ID,
  buildTraitManifestSource,
  type TraitEnforcerOptions,
} from './vite-plugin.js';

const NAMESPACE = 'we-trait-enforcer';

export function traitEnforcerEsbuild(options: TraitEnforcerOptions): Plugin {
  const virtualId = options.virtualId ?? DEFAULT_VIRTUAL_ID;

  return {
    name: 'web-everything-trait-enforcer',
    setup(build) {
      build.onResolve({ filter: new RegExp(`^${escapeRegExp(virtualId)}$`) }, (args) => ({
        path: args.path,
        namespace: NAMESPACE,
      }));

      build.onLoad({ filter: /.*/, namespace: NAMESPACE }, () => ({
        contents: buildTraitManifestSource(options),
        loader: 'js',
        // The manifest's `() => import(spec)` thunks resolve against the project root.
        resolveDir: process.cwd(),
      }));
    },
  };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
