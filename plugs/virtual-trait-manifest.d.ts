/**
 * Ambient type for `virtual:trait-manifest`. The build-time Enforcer that generated this module
 * relocated to FUI (#894 / #905); under WE's build it now resolves to the empty static manifest via the
 * `resolve.alias` in `vite.config.mts` (and `vitest.config.ts`). `bootstrap.ts` still statically imports
 * the module, so tsc needs this ambient declaration *inside* the `build:plugs` project (`include:
 * plugs/**`, `blocks/**`) — the alias target alone doesn't satisfy the type checker. See backlog #116.
 */
declare module 'virtual:trait-manifest' {
  import type { TraitManifest } from './webbehaviors/traitManifest';
  export const traitManifest: TraitManifest;
  const _default: TraitManifest;
  export default _default;
}
