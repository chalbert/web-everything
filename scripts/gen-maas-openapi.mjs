#!/usr/bin/env node
/**
 * gen-maas-openapi.mjs — regenerate the OpenAPI projection of the neutral MaaS serve-path IR.
 *
 * The IR (`blocks/renderers/module-service/servePathIR.ts`) is the source of truth (backlog #505); the
 * OpenAPI document is a DERIVED, deterministic projection of it (`servePathOpenAPI.ts`), so it is
 * generated rather than hand-written — same IR in, byte-identical document out. The committed
 * `maas-servepath.openapi.json` is what #506 (conformance vectors) and #507 (generation adapter) read,
 * and what an enterprise consumer generates a client/stub against. A vitest drift test asserts the
 * committed file equals a fresh projection, so it can never go stale.
 *
 * Run: `npm run gen:maas-openapi`  (writes blocks/renderers/module-service/maas-servepath.openapi.json)
 */
import { build } from 'esbuild';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'blocks/renderers/module-service/servePathOpenAPI.ts');
const OUT = join(ROOT, 'blocks/renderers/module-service/maas-servepath.openapi.json');

/** Bundle the projector (TS + its IR import) to a temp ESM, import it, and project. */
export async function projectOpenAPI() {
  const tmp = join(ROOT, 'node_modules/.cache/maas-openapi.mjs');
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
    return mod.servePathToOpenAPI();
  } finally {
    rmSync(tmp, { force: true });
  }
}

/** Stable, pretty JSON with a trailing newline — the on-disk form the drift test compares against. */
export const serialize = (doc) => `${JSON.stringify(doc, null, 2)}\n`;

// Run as a script: write the file. Imported (by the test): just expose the helpers above.
if (import.meta.url === `file://${process.argv[1]}`) {
  const doc = await projectOpenAPI();
  const next = serialize(doc);
  let prev = '';
  try {
    prev = readFileSync(OUT, 'utf8');
  } catch {
    /* first run */
  }
  writeFileSync(OUT, next);
  console.log(prev === next ? `✓ maas-servepath.openapi.json up to date` : `✓ wrote ${OUT}`);
}
