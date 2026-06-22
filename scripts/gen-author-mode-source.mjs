#!/usr/bin/env node
/**
 * gen-author-mode-source.mjs — regenerate the author-mode source artifact (backlog #818, placement #954).
 *
 * The artifact (`src/_data/authorModeSource.json`) is a DERIVED, deterministic projection of the
 * transform core `serve()` over the canonical `<component>` definitions (`component-cases.ts`) — the
 * #954 build-emit: WE runs `serve()` at build time and commits the per-case × per-form
 * `{code, language, lossy, diagnostics}` output as JSON, which the FUI workbench author-mode panel
 * reads (only rendered text + diagnostics cross the #700 seam — FUI never imports `serve()`).
 *
 * A vitest drift test asserts the committed file equals a fresh generation, so it can never go stale —
 * the same generate-and-freeze guard `gen-maas-conformance.mjs` uses.
 *
 * Run: `npm run gen:author-mode-source`
 *   (writes src/_data/authorModeSource.json)
 */
import { build } from 'esbuild';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Window } from 'happy-dom';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'blocks/renderers/module-service/authorModeSource.ts');
const OUT = join(ROOT, 'src/_data/authorModeSource.json');

/** `serve()` parses `<component>` via `document.createElement`, so the node build-emit needs a DOM. */
function installDom() {
  const win = new Window();
  for (const key of ['document', 'window', 'customElements', 'HTMLElement', 'Node', 'DocumentFragment']) {
    if (globalThis[key] === undefined) globalThis[key] = win[key];
  }
}

/** Bundle the projector (TS + its serve()/fixture imports) to a temp ESM, import it, build the artifact. */
export async function projectAuthorModeSource() {
  installDom();
  const tmp = join(ROOT, 'node_modules/.cache/author-mode-source.mjs');
  await build({
    entryPoints: [SRC],
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile: tmp,
    logLevel: 'silent',
  });
  try {
    const mod = await import(`${tmp}?t=${Date.now()}`);
    return mod.serialize(mod.buildAuthorModeSource());
  } finally {
    rmSync(tmp, { force: true });
  }
}

// Run as a script: write the file. Imported (by the test): just expose the helper above.
if (import.meta.url === `file://${process.argv[1]}`) {
  const next = await projectAuthorModeSource();
  let prev = '';
  try {
    prev = readFileSync(OUT, 'utf8');
  } catch {
    /* first run */
  }
  writeFileSync(OUT, next);
  console.log(prev === next ? `✓ src/_data/authorModeSource.json up to date` : `✓ wrote ${OUT}`);
}
