/**
 * `build-parsed` — the build-time Auto-Define strategy (#242, kept minimal: its full HTML-usage
 * resolution — Custom Elements Manifest / `unplugin`-style scanning — is a follow-up if it grows past
 * this item). At build time a tool parses which tags a page uses and injects the imports / a manifest;
 * at runtime this strategy resolves an unknown tag against that pre-computed manifest (no inference,
 * no DOM watching — the binding was decided at build). It satisfies the {@link AutoDefineStrategy}
 * contract so it registers and resolves like the others.
 *
 * Spec: /projects/webcomponents/#protocol-auto-define-strategy
 * @module blocks/renderers/auto-define
 */
import {
  type AutoDefineStrategy,
  type DefiningModule,
  type RegistryScope,
  defineElement,
} from './defineElement';

/** A build-time manifest: tag → defining module specifier (what the build step emits). */
export type BuildManifest = Readonly<Record<string, string>>;

/**
 * Build a `build-parsed` strategy backed by a build-emitted manifest. `resolve` looks the tag up in the
 * manifest (decided at build, not inferred at runtime); an unknown tag returns `undefined` — the build
 * simply did not include it.
 */
export function createBuildParsedAutoDefine(manifest: BuildManifest = {}): AutoDefineStrategy {
  return {
    key: 'build-parsed',
    trigger: 'build-time',
    resolve: (tag: string): DefiningModule | undefined => {
      const specifier = manifest[tag];
      return specifier ? { specifier } : undefined;
    },
    define: (tag: string, ctor: CustomElementConstructor, _scope?: RegistryScope) => defineElement(tag, ctor),
  };
}

/** The default `build-parsed` strategy (empty manifest — a real build supplies one). */
export const buildParsedAutoDefine: AutoDefineStrategy = createBuildParsedAutoDefine();
