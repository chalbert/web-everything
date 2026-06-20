/**
 * @file webtheme/compile.ts
 * @description DTCG → native-CSS compile — backlog #404, realizing the #403 DTCG↔CSS protocol mapping.
 *
 * The runtime tier is **native CSS only** (#403): each resolved token becomes one **custom property**;
 * typed numerics additionally register via **`@property`** so they animate + validate. A token authored
 * as a `{group.token}` **alias** compiles to `var(--ref)` (the value tracks its primitive at runtime,
 * matching the #403 example `--button-radius: var(--radius-md)`), while its `@property` `initial-value`
 * uses the fully-resolved literal. No build-time value baking beyond this; no second runtime.
 */
import {
  type DtcgDocument,
  type DtcgType,
  type ResolvedToken,
  cssVarName,
  flattenTokens,
  isTemplated,
  mapTemplatedRefs,
  resolveTokens,
} from './tokens';

export interface CompileOptions {
  /** The selector the custom properties are emitted under. Defaults to `:root`. */
  readonly selector?: string;
  /** Emit `@property` registrations for typed numerics (default true). */
  readonly registerProperties?: boolean;
}

export interface CompileResult {
  readonly css: string;
  /** Tokens whose `$type` has no CSS `@property` syntax (e.g. fontFamily/shadow) — registered as a plain var only. */
  readonly diagnostics: readonly string[];
}

/** DTCG `$type` → CSS `@property` `syntax` descriptor; types with no registrable syntax map to null. */
const PROPERTY_SYNTAX: Record<DtcgType, string | null> = {
  color: '<color>',
  dimension: '<length>',
  number: '<number>',
  duration: '<time>',
  fontFamily: null,
  fontWeight: null,
  shadow: null,
};

/**
 * The CSS value a token compiles to: a templated/calc value (#1315) → each `{ref}` substituted with
 * `var(--ref)` (so e.g. `calc({radius.base} - 2px)` emits `calc(var(--radius-base) - 2px)` and tracks its
 * base at runtime); a direct alias → `var(--ref)`; otherwise its literal value.
 */
function declaredValue(token: ResolvedToken): string {
  if (isTemplated(token.value)) {
    return mapTemplatedRefs(String(token.value), (path) => `var(${cssVarName(path.split('.'))})`);
  }
  if (token.aliasOf) return `var(${cssVarName(token.aliasOf.split('.'))})`;
  return String(token.value);
}

/**
 * Compile a DTCG token document to native CSS — the `:root` custom-property block plus an `@property`
 * registration per typed numeric. Resolves aliases (cycle/dangling-ref checked by {@link resolveTokens})
 * and emits in stable document order. A token whose `$type` has no registrable CSS syntax is emitted as a
 * plain custom property and noted in `diagnostics` (reported, never silently skipped).
 */
export function compileToCss(doc: DtcgDocument, opts: CompileOptions = {}): CompileResult {
  const selector = opts.selector ?? ':root';
  const registerProperties = opts.registerProperties ?? true;
  const tokens = resolveTokens(flattenTokens(doc));
  const diagnostics: string[] = [];

  const decls: string[] = [];
  const properties: string[] = [];
  for (const token of tokens) {
    const name = cssVarName(token.path);
    decls.push(`  ${name}: ${declaredValue(token)};`);

    if (!registerProperties || token.type === undefined) continue;
    const syntax = PROPERTY_SYNTAX[token.type];
    if (syntax === null) {
      diagnostics.push(`token "${token.path.join('.')}" ($type ${token.type}) has no @property syntax — emitted as a plain custom property.`);
      continue;
    }
    properties.push(
      `@property ${name} {\n  syntax: "${syntax}"; inherits: true; initial-value: ${token.resolved};\n}`,
    );
  }

  const rootBlock = `${selector} {\n${decls.join('\n')}\n}`;
  const css = [rootBlock, ...properties].join('\n\n') + '\n';
  return { css, diagnostics };
}
