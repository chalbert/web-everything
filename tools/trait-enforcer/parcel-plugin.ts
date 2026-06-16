/**
 * Parcel plugin: the trait Enforcer for Parcel (#787, graduating ratified decision #756) — the fifth
 * bundler adapter, completing the #722 cross-bundler conformance matrix against the #716 neutral contract.
 *
 * Parcel's plugin model is declarative: a `Resolver` registered in `.parcelrc` (referenced by relative
 * path, Parcel ≥ 2.9.0 — so no published package is needed). Its `resolve()` matches the virtual manifest
 * specifier and returns `{ filePath, code }`, where `code` is the byte-identical output of the shared
 * {@link buildTraitManifestSource} core — so a Parcel build emits the same manifest as Vite / Rollup /
 * webpack / esbuild, and the lazy `() => import()` thunks inside it each code-split into their own bundle
 * (an unused trait into none).
 *
 * Supports **both** #756 config-delivery modes from the one factory:
 *   • **B (default):** a Map passed directly — `traitEnforcerParcel({ traitMap })`. The Map is build-time
 *     static, so the resolver declares `invalidateOnStartup` rather than watching a config file.
 *   • **A (declarative):** `traitEnforcerParcel()` with no options reads `.trait-enforcerrc` /
 *     `package.json#traitEnforcer` via Parcel's native `config.getConfig`. The published **default export**
 *     is this no-options form, so `.parcelrc` can register the plugin with zero JS wrapper.
 *
 * ```jsonc
 * // .parcelrc
 * { "extends": "@parcel/config-default", "resolvers": ["./trait-enforcer-resolver.js", "..."] }
 * ```
 */
import { Resolver } from '@parcel/plugin';
import { resolve as resolvePath } from 'node:path';
import {
  DEFAULT_VIRTUAL_ID,
  buildTraitManifestSource,
  type TraitEnforcerOptions,
} from './vite-plugin.js';

/** Synthetic `.js` identity for the virtual manifest — `code` below is served, never read from disk. */
const VIRTUAL_FILE = 'web-everything-trait-manifest.js';

/** The config-file names the declarative (mode A) loader searches, in order. */
const CONFIG_FILES = ['.trait-enforcerrc', '.trait-enforcerrc.json', '.trait-enforcerrc.js'];

/**
 * Build the Parcel trait-Enforcer resolver. Pass `{ traitMap }` for mode B, or omit options for mode A
 * (declarative). Returns a Parcel `Resolver` — register it in `.parcelrc` by relative path.
 */
export function traitEnforcerParcel(options?: TraitEnforcerOptions): Resolver<TraitEnforcerOptions> {
  return new Resolver<TraitEnforcerOptions>({
    async loadConfig({ config }) {
      // Mode B — a Map passed as a JS arg (the documented default). Static at build time.
      if (options?.traitMap) {
        config.invalidateOnStartup();
        return options;
      }
      // Mode A — declarative: read `.trait-enforcerrc` or `package.json#traitEnforcer`.
      const result = await config.getConfig<Partial<TraitEnforcerOptions>>(CONFIG_FILES, {
        packageKey: 'traitEnforcer',
      });
      const loaded = (result?.contents ?? {}) as Partial<TraitEnforcerOptions>;
      if (!loaded.traitMap) {
        throw new Error(
          'traitEnforcerParcel: no traitMap. Pass `{ traitMap }` (mode B), or declare a `traitEnforcer` ' +
            'key in .trait-enforcerrc / package.json (mode A).',
        );
      }
      return loaded as TraitEnforcerOptions;
    },

    resolve({ specifier, config }) {
      const virtualId = options?.virtualId ?? config?.virtualId ?? DEFAULT_VIRTUAL_ID;
      if (specifier !== virtualId) return null;
      // `code` overrides any on-disk read; the synthetic `.js` filePath just routes it through the JS
      // transformer so the manifest's dynamic-import thunks are parsed and code-split.
      return { filePath: resolvePath(VIRTUAL_FILE), code: buildTraitManifestSource(config) };
    },
  });
}

/**
 * Default export = the no-options (mode A) resolver, so `.parcelrc` can register the plugin directly by
 * path with no JS wrapper. A mode-B project wires `traitEnforcerParcel({ traitMap })` from a local file.
 */
export default traitEnforcerParcel();
