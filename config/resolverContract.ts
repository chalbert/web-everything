/**
 * Per-dimension config **resolver contract** (#1702, ratifying #1662; carved #1780) — the plug-in
 * interface a dimension provides so every dimension resolves *identically*. This file is **contract
 * only**: the runtime that consumes it (`resolveDimension`/`resolveConfig`) is standard impl and lives
 * in **FUI** (`@webeverything/config` is consumed *by* that impl), per #1282 (WE holds zero standard
 * impl). WE keeps the interface + vectors; FUI keeps the runtime.
 *
 * The kernel this generalizes is `CustomAutoDefineRegistry`: a default-less core plus a value that
 * extends a platform flavor through an ordered nearest-wins chain. An *open-set* dimension (autoDefine,
 * renderStrategy) realizes the chain as `new Registry({ extends: [flavorA, flavorB] })`; a *scalar/mode*
 * dimension (codegenSoT mode, theme tokens) realizes the SAME ordered nearest-wins lookup over plain
 * config objects. Either way: **lazy, no merged blob is materialized** (#1662).
 *
 * See `docs/agent/platform-decisions.md#config-extends-platform-default`.
 *
 * @module config
 */

/**
 * A dimension's plug-in to the generic resolver. Each dimension provides exactly this so every
 * dimension resolves *identically* — the resolver core has no per-dimension knowledge.
 *
 * @typeParam Flavor   the dimension's flavor-id union
 * @typeParam Resolved the dimension's resolved value type (a registry for open-set dims, a config
 *                     object for scalar/mode dims)
 */
export interface DimensionResolver<Flavor extends string = string, Resolved = unknown> {
  /** Dimension name, used only for diagnostics. */
  readonly dimension: string;

  /**
   * Build the resolved value from an **ordered, nearest-first** chain of base flavor ids plus an
   * optional local override. For open-set dimensions this is `new Registry({ extends: flavors.map(byName) })`
   * (the `CustomRegistry.extends` mechanism does the nearest-wins lookup). For scalar/mode dimensions
   * this performs an analogous ordered nearest-wins pick over the flavors' plain values.
   *
   * Implementations MUST treat `flavors[0]` as nearest (after `override`) and apply nearest-wins; they
   * MUST NOT deep-merge a blob.
   *
   * @param flavors  ordered base flavor ids, nearest-first
   * @param override the descriptor's local `overrides` (the absolute nearest top), or `undefined`
   */
  fromExtends(flavors: readonly Flavor[], override?: unknown): Resolved;

  /**
   * Accept a plain inline value the project supplied directly (no flavor chain). Optional — when a
   * dimension has no meaningful "inline value" form it may omit this and the resolver will throw if an
   * inline value is encountered.
   */
  fromInline?(value: unknown): Resolved;
}
