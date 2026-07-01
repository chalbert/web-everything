/**
 * token-css.mjs — the engine-agnostic build transport for the JS-first token CSS (#1813, ruled by
 * #1824). Returns the `:root{}` token-CSS string the docs site inlines pre-paint, derived from the
 * FUI webtheme injector (`fui:plugs/webtheme/`) — never a hand-authored CSS file, never a committed
 * generated artifact.
 *
 * ## How the bytes cross the build boundary (#1731 `we-data-crosses-via-fui-served-route`)
 * WE's docs build **cannot** `import '@frontierui'` (the #700/#239 WE→FUI build-import ban,
 * `we:src/_layouts/base.njk:434`). So — exactly as `scripts/lib/component-tokens.mjs` already does for
 * the #802 component-token tier — this transpiles the real FUI webtheme TS modules with esbuild
 * (bundled to one ESM, imported via a `data:` URL) rather than depending on the `@frontierui` package
 * or duplicating the token values. The resolution stays the webtheme SoT (`ThemeSource` +
 * `emitTokenCss`), never a re-implementation. The only FUI surface consumed is the sibling source tree
 * at `../frontierui/plugs/webtheme/` (the CLI/copy boundary), and consumption is **detect-or-skip**:
 * a WE tree without `../frontierui` (CI without the sibling repo) falls back to emitting from the
 * WE-site override alone, so the docs build never fails on FUI's absence.
 *
 * ## What it emits (the two ratified pieces of #1824 Fork 2a)
 *  1. The **resolved-theme** `:root{}` block: the WE-site project theme (the `values→product` layer,
 *     {@link ../../src/_data/weSiteTheme.js}) layered over the FUI platform default via
 *     `ThemeSource.with()`, projected one-way to `--token-<family>-<name>` by FUI's `emitTokenCss`.
 *  2. The **alias bridge**: one generated block aliasing each legacy `--<family>-<name>` site var to
 *     its emitted `--token-*` (`--color-primary: var(--token-color-primary)`), so the existing 629
 *     `we:src/` call sites keep working AND now derive from the injector — the no-drift guarantee
 *     #1683 exists for, with near-zero churn (a full call-site rename is a later cleanup, not this
 *     slice).
 *
 * Direction is fixed JS→CSS: this only reads the source and writes CSS; CSS is never a read path back.
 *
 * @module token-css
 */
import { build } from 'esbuild';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import weSiteThemeModule from '../../src/_data/weSiteTheme.js';

// weSiteTheme.js is CommonJS (the Eleventy `_data` cascade needs CJS), so under ESM its
// `module.exports` surfaces as the default import. The semantic-alias tier (`LEGACY_ALIASES`) is no
// longer defined here — #2026 Fork 1 relocated it into the FUI-owned `fui:plugs/webtheme/` single
// source, so this build imports it from the transpiled FUI bundle (below) rather than a parallel copy.
const weSiteTheme = weSiteThemeModule;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const FUI_WEBTHEME = join(ROOT, '..', 'frontierui', 'plugs', 'webtheme');

let _fui;
/**
 * Transpile + import the real FUI webtheme modules once (cached per process). Returns null when
 * `../frontierui` is not checked out (detect-or-skip), so the caller falls back to the override alone.
 */
async function loadFuiWebtheme() {
  if (_fui !== undefined) return _fui;
  if (!existsSync(FUI_WEBTHEME)) {
    _fui = null;
    return _fui;
  }
  const res = await build({
    stdin: {
      contents:
        "export { default as ThemeSource } from './ThemeSource.ts';" +
        "export { emitTokenCss } from './emitCss.ts';" +
        "export { defaultTheme } from './defaultTheme.ts';" +
        "export { LEGACY_ALIASES } from './legacyAliases.ts';",
      resolveDir: FUI_WEBTHEME,
      sourcefile: 'fui-webtheme-entry.ts',
      loader: 'ts',
    },
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
  });
  const code = res.outputFiles[0].text;
  _fui = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
  return _fui;
}

/** `--token-<family>-<name>` — must match FUI's `tokenVarName` so the alias bridge targets the real emit. */
function tokenVarName(family, name) {
  return `--token-${family}-${name}`;
}

/**
 * Emit the resolved-theme `:root{}` block from the FUI default + the WE-site override. When FUI is
 * present the values flow through `ThemeSource.with()` (the `config-extends-platform-default`
 * primitive) so the site theme is provably the FUI default extended; when FUI is absent the same
 * `emitTokenCss` shape is reproduced from the override alone (detect-or-skip parity).
 */
function emitResolvedBlock(fui) {
  if (fui) {
    const source = new fui.ThemeSource(fui.defaultTheme).with(weSiteTheme);
    return fui.emitTokenCss(source);
  }
  // Fallback: emit only the override's own rows, in the FUI `emitTokenCss` shape.
  const decls = [];
  for (const family of Object.keys(weSiteTheme)) {
    for (const name of Object.keys(weSiteTheme[family])) {
      decls.push(`  ${tokenVarName(family, name)}: ${weSiteTheme[family][name]};`);
    }
  }
  return `:root {\n${decls.join('\n')}\n}`;
}

/**
 * The alias-bridge `:root{}` block: each legacy `--<family>-<name>` site var pointed at its emitted
 * `--token-*`. Generated from the FUI-owned `LEGACY_ALIASES` single source (#2026 Fork 1), so
 * renaming/removing a token at the source updates the site's var via this projection (the #1813
 * acceptance), never a hand edit. `aliases` is FUI's `LEGACY_ALIASES`; when FUI is absent
 * (detect-or-skip) there is no alias source, so no bridge block is emitted.
 */
function emitAliasBlock(aliases) {
  const decls = aliases.map(
    ({ legacy, family, name }) => `  ${legacy}: var(${tokenVarName(family, name)});`,
  );
  return `:root {\n${decls.join('\n')}\n}`;
}

/**
 * The full token CSS string the docs site inlines into its `<head>` pre-paint: the
 * injector-derived `--token-*` resolved-theme block followed by the legacy `--<family>-*` alias
 * bridge. Read fresh each build — there is no committed generated file to drift.
 */
export async function tokenCss() {
  const fui = await loadFuiWebtheme();
  const lines = [
    '/* Generated by scripts/lib/token-css.mjs — JS-first token CSS (#1813/#1824). Do not hand-edit. */',
    '/* Source of truth: FUI webtheme injector (fui:plugs/webtheme) + the WE-site project theme',
    '   (we:src/_data/weSiteTheme.js). Emitted one-way (JS→CSS); never a read path back. */',
    emitResolvedBlock(fui),
  ];
  // The semantic-alias tier is FUI-owned (#2026 Fork 1) — only emit the bridge when FUI is present
  // (detect-or-skip); a WE tree without the `../frontierui` sibling has no alias source.
  if (fui) {
    lines.push('/* Legacy --<family>-* alias bridge → the emitted --token-* (#2026 Fork 1, FUI-owned). */');
    lines.push(emitAliasBlock(fui.LEGACY_ALIASES));
  }
  return lines.join('\n');
}
