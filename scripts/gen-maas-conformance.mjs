#!/usr/bin/env node
/**
 * gen-maas-conformance.mjs — regenerate the frozen MaaS conformance golden vectors (backlog #506).
 *
 * The golden vectors (`blocks/renderers/module-service/conformance/golden.json`) are a DERIVED,
 * deterministic projection of the reference implementation (#461) over the hand-authored vector inputs
 * (`conformance/vectors.ts`) — same inputs in, byte-identical golden out. They are the language-neutral
 * gate the #506 runner drives every origin target against, and what the #507 generation adapter's output
 * is verified by. A vitest drift test asserts the committed file equals a fresh generation, so it can
 * never go stale — the same guard `gen-maas-openapi.mjs` uses for the OpenAPI projection.
 *
 * Run: `npm run gen:maas-conformance`
 *   (writes blocks/renderers/module-service/conformance/golden.json)
 */
import { build } from 'esbuild';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'blocks/renderers/module-service/conformance/generate.ts');
const OUT = join(ROOT, 'blocks/renderers/module-service/conformance/golden.json');

/** Bundle the generator (TS + its reference-impl imports) to a temp ESM, import it, and build the vectors. */
export async function projectGolden() {
  const tmp = join(ROOT, 'node_modules/.cache/maas-conformance.mjs');
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
    return mod.serialize(await mod.buildGoldenVectors());
  } finally {
    rmSync(tmp, { force: true });
  }
}

// Run as a script: write the file. Imported (by the test): just expose the helper above.
if (import.meta.url === `file://${process.argv[1]}`) {
  const next = await projectGolden();
  let prev = '';
  try {
    prev = readFileSync(OUT, 'utf8');
  } catch {
    /* first run */
  }
  writeFileSync(OUT, next);
  console.log(prev === next ? `✓ conformance/golden.json up to date` : `✓ wrote ${OUT}`);
}
