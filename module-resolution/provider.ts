/**
 * Module-resolution axis (#274, materializing #271's ruling) — the standalone, dependency-free model
 * of how a project resolves a bare module specifier (e.g. `@frontierui/jsx-runtime`).
 *
 * **WE owns no resolver and no new project-facing format** (#271). A bare specifier is resolved by
 * whatever *native* manifest the project's toolchain already maintains — there is no WE-dispatched
 * strategy set at runtime. The four native manifests:
 *
 *   | Strategy                         | Native manifest that resolves it          | When                         |
 *   | -------------------------------- | ----------------------------------------- | ---------------------------- |
 *   | node_modules + `exports` (default) | the installed package's `package.json#exports` | bundler / dev-server / node |
 *   | importmap → src or dist          | the page's `<script type="importmap">`    | raw browser, no bundler      |
 *   | CDN / served URL (override)      | an importmap entry pointing at a URL      | build-less / CDN delivery    |
 *   | dev-server alias                 | the project's existing vite/bundler alias | dev convenience              |
 *
 * WE contributes exactly two thin, **no-resolve-time-code** things:
 *  1. **The invariant (the only lock)** — whatever manifest a project uses, an `@frontierui/*` entry
 *     must terminate at the package's `exports`, never at WE/foreign source or a raw in-repo path.
 *     Enforced by a `check:standards` lint (see `validateModuleResolutionLock`), not a runtime guard.
 *  2. **A `moduleResolution` field** on the project flavor config (config-extends-platform-default):
 *     a per-specifier `overrides` map with the value space **{ default | URL }** exactly per #264. It
 *     is a *generator hint* — when WE scaffolds a project's importmap/alias it materialises the choice
 *     into the native manifest the environment then runs ({@link materializeModuleResolution}). It is
 *     **not** a resolver.
 */

/**
 * The value space for a specifier override (#264, ratified): either the sentinel
 * {@link DEFAULT_RESOLUTION} ("consume the package the normal way — node-resolution via `exports`;
 * the project's build/delivery system handles it") or an absolute `http(s)` **URL** (point the same
 * specifier at a CDN / served file for a build-less setup). `local-importmap` is **not** a third
 * value — it is just "no override; you own the native manifest, WE stays out".
 */
export type ModuleResolutionValue = typeof DEFAULT_RESOLUTION | string;

/** The sentinel meaning "resolve via the default native path (node_modules + `exports`)". */
export const DEFAULT_RESOLUTION = 'default' as const;

/**
 * The `moduleResolution` field on a project's flavor config. `overrides` maps a bare specifier to its
 * resolution value; an absent specifier (or one mapped to {@link DEFAULT_RESOLUTION}) consumes the
 * package the normal way. A project config *extends* the platform default ({@link PLATFORM_DEFAULT_MODULE_RESOLUTION}).
 */
export interface ModuleResolutionConfig {
  overrides: Record<string, ModuleResolutionValue>;
}

/**
 * The fully-defined platform-default flavor a project extends (config-extends-platform-default): no
 * overrides — every specifier resolves the default native way. A project narrows it by adding URL
 * overrides for the specifiers it wants delivered build-lessly.
 */
export const PLATFORM_DEFAULT_MODULE_RESOLUTION: ModuleResolutionConfig = { overrides: {} };

/** True for an absolute `http(s)` URL — the only non-default value the axis accepts (#264). */
export function isResolutionUrl(value: string): boolean {
  return /^https?:\/\//.test(value);
}

/** A `moduleResolution` config was malformed (a value that is neither `default` nor an http(s) URL). */
export class ModuleResolutionError extends Error {
  constructor(why: string) {
    super(`moduleResolution config invalid: ${why}`);
    this.name = 'ModuleResolutionError';
  }
}

/** Merge a project's `moduleResolution` over the platform default (project overrides win). */
export function extendModuleResolution(
  project: Partial<ModuleResolutionConfig> = {},
): ModuleResolutionConfig {
  return {
    overrides: { ...PLATFORM_DEFAULT_MODULE_RESOLUTION.overrides, ...(project.overrides ?? {}) },
  };
}

/** Assert every override value is `default` or an http(s) URL; returns the config typed when valid. */
export function assertModuleResolution(config: ModuleResolutionConfig): ModuleResolutionConfig {
  for (const [specifier, value] of Object.entries(config.overrides)) {
    if (value === DEFAULT_RESOLUTION) continue;
    if (typeof value !== 'string' || !isResolutionUrl(value))
      throw new ModuleResolutionError(
        `override for "${specifier}" must be "${DEFAULT_RESOLUTION}" or an http(s) URL, got ${JSON.stringify(value)}`,
      );
  }
  return config;
}

/**
 * How a single specifier resolves under a config: `default` (consume the package normally — no
 * manifest entry materialised) or a `url` (an importmap entry pointing at the URL).
 */
export function resolveSpecifier(
  config: ModuleResolutionConfig,
  specifier: string,
): { mode: 'default' } | { mode: 'url'; url: string } {
  const value = config.overrides[specifier];
  if (value === undefined || value === DEFAULT_RESOLUTION) return { mode: 'default' };
  if (!isResolutionUrl(value))
    throw new ModuleResolutionError(`override for "${specifier}" is not an http(s) URL`);
  return { mode: 'url', url: value };
}

/**
 * Materialise the config into a native importmap (the **generator hint**, #271). Only URL overrides
 * produce importmap entries — `default` specifiers are intentionally absent, left to the toolchain's
 * own node-resolution. The returned object is the `imports` block of a `<script type="importmap">`;
 * WE writes it into the project's manifest, it does not resolve anything at runtime.
 */
export function materializeModuleResolution(config: ModuleResolutionConfig): { imports: Record<string, string> } {
  assertModuleResolution(config);
  const imports: Record<string, string> = {};
  for (const [specifier, value] of Object.entries(config.overrides)) {
    if (value !== DEFAULT_RESOLUTION) imports[specifier] = value;
  }
  return { imports };
}
