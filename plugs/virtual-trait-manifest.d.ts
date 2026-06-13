/**
 * Ambient type for `virtual:trait-manifest` — the Enforcer-generated trait
 * manifest module (see `tools/trait-enforcer/vite-plugin.ts`).
 *
 * `tools/trait-enforcer/virtual.d.ts` declares the same module for editor/demo
 * use, but `tools/` is outside the `build:plugs` tsc project (`include:
 * plugs/**`, `blocks/**`). `bootstrap.ts` statically imports the manifest, so the
 * declaration must live *inside* the project — hence this file. See backlog #116.
 */
declare module 'virtual:trait-manifest' {
  import type { TraitManifest } from './webbehaviors/traitManifest';
  export const traitManifest: TraitManifest;
  const _default: TraitManifest;
  export default _default;
}
