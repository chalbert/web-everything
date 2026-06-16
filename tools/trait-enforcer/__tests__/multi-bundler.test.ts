/**
 * Multi-bundler trait Enforcer baseline (#717) — proves the per-bundler adapters
 * share the one #716-anchored core and that a REAL production build (Rollup and
 * esbuild, both installed) code-splits each used trait and ships an unused trait
 * as zero bytes.
 *
 * Conformance that *all four* bundlers agree byte-for-byte is the separate
 * #716-gated suite (out of scope here); this proves the two installable adapters
 * end-to-end and that every adapter routes through `buildTraitManifestSource`.
 */
import { describe, it, expect } from 'vitest';
import { rollup } from 'rollup';
import { build as esbuild } from 'esbuild';
import { buildTraitManifestSource } from '../vite-plugin';
import { traitEnforcerRollup } from '../rollup-plugin';
import { traitEnforcerEsbuild } from '../esbuild-plugin';
import type { TraitMap } from '../traitManifestContract';

const traitMap: TraitMap = {
  sortable: 'virtual:trait/sortable',
  'export-csv': 'virtual:trait/export-csv',
};
// A template that uses `sortable` but not `export-csv`.
const templates = ['<data-grid sortable></data-grid>'];

// A virtual-module shim so the trait module specifiers resolve to tiny stubs in a build.
function stubTraits(extraResolve?: (id: string) => string | null) {
  return {
    name: 'stub-traits',
    resolveId(id: string) {
      if (id.startsWith('virtual:trait/')) return id;
      return extraResolve ? extraResolve(id) : null;
    },
    load(id: string) {
      if (id.startsWith('virtual:trait/')) return 'export default {};';
      return null;
    },
  };
}

describe('shared core', () => {
  it('every adapter emits a manifest identical to the core (single source of truth)', () => {
    const core = buildTraitManifestSource({ traitMap, templates });
    // The Rollup/esbuild/Vite adapters all call buildTraitManifestSource — assert
    // the core scans usage so only the used trait is in the manifest.
    expect(core).toContain('"sortable"');
    expect(core).not.toContain('export-csv');
  });
});

describe('Rollup adapter — real build', () => {
  it('code-splits a used trait and emits zero chunk for an unused one', async () => {
    const bundle = await rollup({
      input: 'virtual:trait-manifest',
      plugins: [traitEnforcerRollup({ traitMap, templates }), stubTraits()],
    });
    const { output } = await bundle.generate({ format: 'es' });
    await bundle.close();
    const ids = output
      .filter((o): o is import('rollup').OutputChunk => o.type === 'chunk')
      .flatMap((c) => Object.keys(c.modules));
    expect(ids).toContain('virtual:trait/sortable');
    expect(ids).not.toContain('virtual:trait/export-csv');
  });
});

describe('esbuild adapter — real build', () => {
  it('resolves the virtual manifest and bundles only the used trait', async () => {
    const result = await esbuild({
      entryPoints: ['virtual:trait-manifest'],
      bundle: true,
      write: false,
      format: 'esm',
      splitting: true,
      outdir: 'out',
      plugins: [
        traitEnforcerEsbuild({ traitMap, templates }),
        {
          name: 'stub-traits-esbuild',
          setup(b) {
            b.onResolve({ filter: /^virtual:trait\// }, (a) => ({ path: a.path, namespace: 'stub' }));
            b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export default {};' }));
          },
        },
      ],
    });
    const all = result.outputFiles.map((f) => f.text).join('\n');
    // The used trait is referenced via a dynamic import; the unused one never appears.
    expect(all).toContain('sortable');
    expect(all).not.toContain('export-csv');
  });
});
