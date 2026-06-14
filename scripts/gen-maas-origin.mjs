#!/usr/bin/env node
/**
 * gen-maas-origin.mjs — regenerate the per-language MaaS origin from the neutral serve-path IR.
 *
 * The IR (`blocks/renderers/module-service/servePathIR.ts`) is the source of truth (#505); each language
 * origin is a DERIVED, deterministic projection of it via a `LanguageBackend` (#547, #463 fork a) — same
 * IR in, byte-identical source out, NO AI in the path. The committed goldens under
 * `blocks/renderers/module-service/generation/__goldens__/<backend>/` are what proves the generator (a
 * vitest drift test asserts they equal a fresh emit) and what #548 (.NET) / #549 (conformance) build on.
 *
 * The JS golden is, specifically, the regenerated JS reference origin: the same language whose hand-written
 * reference handler (fetchHandler.ts) is already covered by the #506 conformance suite — so locking it
 * byte-for-byte validates the backend interface against an already-conformant target.
 *
 * Run: `npm run gen:maas-origin`  (writes the goldens)
 */
import { build } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GEN = 'blocks/renderers/module-service/generation';
const SRC = join(ROOT, `${GEN}/index.ts`);
const GOLDEN_DIR = join(ROOT, `${GEN}/__goldens__`);
const CORPUS_SNAPSHOT = join(ROOT, `${GEN}/corpus/__snapshots__/corpus.snapshot.json`);

/** Bundle the generation module (TS + its IR import) to a temp ESM and import it. */
async function loadGeneration() {
  const tmp = join(ROOT, 'node_modules/.cache/maas-origin.mjs');
  await build({
    entryPoints: [SRC],
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile: tmp,
    logLevel: 'silent',
  });
  try {
    return await import(`${tmp}?t=${Date.now()}`);
  } finally {
    rmSync(tmp, { force: true });
  }
}

/** All backends whose origin is committed as a golden. */
const BACKENDS = (gen) => [gen.javascriptBackend, gen.csharpBackend];

export async function generateAllOrigins() {
  const gen = await loadGeneration();
  return BACKENDS(gen).map((b) => gen.generateOrigin(b));
}

/** The regression-corpus snapshot (#551): every backend over every corpus fixture, flattened + serialized. */
export async function generateCorpusSnapshot() {
  const gen = await loadGeneration();
  return gen.serializeSnapshot(gen.runCorpus(BACKENDS(gen)));
}

// Run as a script: write each backend's core + shell golden. Imported (by the test): expose the helper.
if (import.meta.url === `file://${process.argv[1]}`) {
  const origins = await generateAllOrigins();
  let changed = 0;
  for (const origin of origins) {
    const dir = join(GOLDEN_DIR, origin.backend);
    mkdirSync(dir, { recursive: true });
    for (const mod of [origin.core, origin.shell]) {
      const out = join(dir, mod.filename);
      let prev = '';
      try {
        prev = readFileSync(out, 'utf8');
      } catch {
        /* first run */
      }
      if (prev !== mod.source) changed++;
      writeFileSync(out, mod.source);
    }
  }
  // The #551 regression-corpus snapshot: all backends × all fixtures, locked for drift review.
  const snapshot = await generateCorpusSnapshot();
  mkdirSync(dirname(CORPUS_SNAPSHOT), { recursive: true });
  let prevSnap = '';
  try {
    prevSnap = readFileSync(CORPUS_SNAPSHOT, 'utf8');
  } catch {
    /* first run */
  }
  if (prevSnap !== snapshot) changed++;
  writeFileSync(CORPUS_SNAPSHOT, snapshot);
  console.log(changed === 0 ? '✓ MaaS origin goldens + corpus up to date' : `✓ wrote ${changed} MaaS generation artifact(s)`);
}
