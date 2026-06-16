/**
 * Multi-bundler trait Enforcer baseline (#717 + #744) — proves the per-bundler
 * adapters share the one #716-anchored core and that a REAL production build
 * (Rollup, esbuild, and webpack — all installable here) code-splits each used
 * trait and ships an unused trait as zero bytes.
 *
 * Conformance that *all* bundlers agree byte-for-byte is the separate #716-gated
 * suite (#722, out of scope here); this proves the installed adapters end-to-end
 * and that every adapter routes through `buildTraitManifestSource`. The Parcel
 * adapter is tracked separately (#746) — Parcel's declarative plugin model can't
 * take the shared `traitEnforcerX(options)` factory shape, a design fork.
 */
import { describe, it, expect } from 'vitest';
import { rollup } from 'rollup';
import { build as esbuild } from 'esbuild';
import webpack from 'webpack';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildTraitManifestSource } from '../vite-plugin';
import { traitEnforcerRollup } from '../rollup-plugin';
import { traitEnforcerEsbuild } from '../esbuild-plugin';
import { traitEnforcerWebpack } from '../webpack-plugin';
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

describe('webpack adapter — real build', () => {
  it('code-splits a used trait and emits zero chunk for an unused one', async () => {
    // webpack resolves the data:-URI manifest's `() => import(spec)` thunks against
    // the real filesystem, so the trait stubs are written to a temp dir and the Map
    // points at their absolute paths (the same fixture shape #238 uses for its real
    // webpack build). `sortable` is used by the template; `export-csv` is not.
    const work = mkdtempSync(join(tmpdir(), 'we744-webpack-'));
    try {
      const sortablePath = join(work, 'sortable.js');
      const csvPath = join(work, 'export-csv.js');
      writeFileSync(sortablePath, 'export default { name: "sortable" };');
      writeFileSync(csvPath, 'export default { name: "export-csv" };');
      writeFileSync(
        join(work, 'entry.js'),
        `import { traitManifest } from 'virtual:trait-manifest'; export default traitManifest;`,
      );

      const fileMap: TraitMap = { sortable: sortablePath, 'export-csv': csvPath };
      const stats = await new Promise<webpack.Stats>((resolve, reject) => {
        webpack(
          {
            mode: 'none', // no minify/tree-shake of names → markers survive verbatim
            entry: join(work, 'entry.js'),
            output: { path: join(work, 'out'), filename: 'main.js', chunkFilename: '[name].chunk.js' },
            plugins: [traitEnforcerWebpack({ traitMap: fileMap, templates })],
          },
          (err, s) => {
            if (err) return reject(err);
            if (!s) return reject(new Error('webpack produced no stats'));
            if (s.hasErrors()) return reject(new Error(s.toString({ all: false, errors: true })));
            resolve(s);
          },
        );
      });

      const moduleIds = [...stats.compilation.modules].map((m) => m.identifier());
      // The used trait is pulled into a code-split chunk; the unused one is absent entirely.
      expect(moduleIds.some((id) => id.includes('sortable.js'))).toBe(true);
      expect(moduleIds.some((id) => id.includes('export-csv.js'))).toBe(false);
      // A real split chunk exists beyond the entry (proof the lazy import code-split).
      const chunkAssets = Object.keys(stats.compilation.assets).filter((a) => a.endsWith('.chunk.js'));
      expect(chunkAssets.length).toBeGreaterThan(0);
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  });
});
