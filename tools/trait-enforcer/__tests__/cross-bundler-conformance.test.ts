/**
 * Cross-bundler trait conformance suite (#722) — one fixture, identical manifest + identical chunk
 * isolation everywhere. This is what turns "tree-shakable across every bundler" from a per-adapter hope
 * into a *verified* property: a single fixture binding a **lazy**, an **eager**, and a **preload** trait
 * (plus one **unused** trait) runs through every installed bundler and must agree on two things —
 *
 *   1. **Identical manifest** — every adapter serves the byte-for-byte output of the one shared
 *      `buildTraitManifestSource` core (#716/#717). Proven directly by invoking each adapter's load
 *      mechanism, no full build required.
 *   2. **Identical chunk isolation** — a REAL production build per bundler emits the same chunk topology:
 *      the eager trait is inlined into the entry, the lazy and preload traits each code-split into their
 *      own chunk, and the unused trait produces **zero bytes** (tree-shaken out of the manifest entirely).
 *
 * Mirrors the proven patterns next door: #234's 4-bundler marker test and #506's MaaS golden vectors.
 *
 * Coverage: Vite, Rollup, webpack, esbuild — the four installed adapters. The fifth, Parcel, is pending
 * its adapter (#756 — Parcel's declarative plugin model surfaced a config-delivery fork in #744); it joins
 * this matrix unchanged once #756 lands. The suite asserts conformance over whichever adapters exist.
 */
import { describe, it, expect } from 'vitest';
import { rollup } from 'rollup';
import { build as esbuildBuild } from 'esbuild';
import webpack from 'webpack';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  buildTraitManifestSource,
  DEFAULT_VIRTUAL_ID,
  type TraitEnforcerOptions,
} from '../vite-plugin';
import { traitEnforcer } from '../vite-plugin';
import { traitEnforcerRollup } from '../rollup-plugin';
import { traitEnforcerEsbuild } from '../esbuild-plugin';
import { traitEnforcerWebpack } from '../webpack-plugin';
import { traitEnforcerParcel } from '../parcel-plugin';
import { runParcelBuild } from './parcel-build-harness';
import type { TraitMap } from '../traitManifestContract';

/** Parcel stores its plugin opts under this symbol; the conformance test invokes resolve()/loadConfig() through it. */
const PARCEL_CONFIG = Symbol.for('parcel-plugin-config');
type ParcelResolverOpts = {
  loadConfig?: (a: { config: unknown }) => Promise<TraitEnforcerOptions> | TraitEnforcerOptions;
  resolve: (a: { specifier: string; config: TraitEnforcerOptions }) => { code?: string } | null | undefined;
};
const parcelOpts = (r: unknown): ParcelResolverOpts => (r as Record<symbol, ParcelResolverOpts>)[PARCEL_CONFIG];
/** A minimal Parcel Config stand-in — only the calls the Enforcer's loadConfig makes. */
const fakeParcelConfig = () => ({ invalidateOnStartup() {}, async getConfig() { return null; } });

// ── The one shared fixture (all three #716 delivery shapes + an unused trait) ──────────────────────
const VID = DEFAULT_VIRTUAL_ID;
// Specifiers are virtual; a per-bundler stub resolves each to a unique marker so chunk topology is
// readable by string search regardless of how a bundler names its chunks.
const SPECS = {
  lazy: 'virtual:trait/lazy',
  eager: 'virtual:trait/eager',
  preload: 'virtual:trait/preload',
  unused: 'virtual:trait/unused',
} as const;
const MARK = (k: keyof typeof SPECS) => `TRAITMARK_${k}`;
const stubSource = (spec: string) => {
  const key = (Object.keys(SPECS) as (keyof typeof SPECS)[]).find((k) => SPECS[k] === spec)!;
  return `export default ${JSON.stringify(MARK(key))};`;
};

const fixture: TraitEnforcerOptions = {
  traitMap: {
    'lazy-trait': SPECS.lazy,
    'eager-trait': { module: SPECS.eager, delivery: 'eager' },
    'preload-trait': SPECS.preload,
    'unused-trait': SPECS.unused,
  } as TraitMap,
  // Uses lazy, eager, preload (preload via the #202 delivery="eager" override); never the unused trait.
  templates: ['<x-grid lazy-trait eager-trait preload-trait preload-trait-delivery="eager"></x-grid>'],
};

/** The single source of truth every adapter must reproduce byte-for-byte. */
const EXPECTED_MANIFEST = buildTraitManifestSource(fixture);

// ── Part A — manifest byte-identity (no full build; invoke each adapter's load mechanism) ──────────

describe('manifest byte-identity — every adapter serves the one shared core verbatim', () => {
  const resolvedId = '\0' + VID;

  it('Vite + Rollup adapters return the core source from their load hook', () => {
    for (const make of [traitEnforcer, traitEnforcerRollup]) {
      const plugin = make(fixture) as { load: (id: string) => string | null | undefined };
      expect(plugin.load(resolvedId)).toBe(EXPECTED_MANIFEST);
    }
  });

  it('esbuild adapter onLoad yields the core source', () => {
    let onLoadCb: ((args: unknown) => { contents: string }) | undefined;
    const fakeBuild = {
      onResolve: () => {},
      onLoad: (_filter: unknown, cb: (args: unknown) => { contents: string }) => {
        onLoadCb = cb;
      },
    };
    traitEnforcerEsbuild(fixture).setup(fakeBuild as never);
    expect(onLoadCb!({ path: VID }).contents).toBe(EXPECTED_MANIFEST);
  });

  it('webpack adapter rewrites the virtual id to a data: URI carrying the core source', () => {
    let beforeResolveCb: ((data: { request: string }) => void) | undefined;
    const fakeCompiler = {
      hooks: {
        normalModuleFactory: {
          tap: (_name: string, cb: (nmf: unknown) => void) =>
            cb({
              hooks: {
                beforeResolve: {
                  tap: (_n: string, fn: (data: { request: string }) => void) => {
                    beforeResolveCb = fn;
                  },
                },
              },
            }),
        },
      },
    };
    traitEnforcerWebpack(fixture).apply(fakeCompiler as never);
    const data = { request: VID };
    beforeResolveCb!(data);
    expect(data.request.startsWith('data:text/javascript,')).toBe(true);
    const decoded = decodeURIComponent(data.request.slice('data:text/javascript,'.length));
    expect(decoded).toBe(EXPECTED_MANIFEST);
  });

  it('Parcel serves the manifest verbatim from resolve()', async () => {
    const opts = parcelOpts(traitEnforcerParcel(fixture));
    // Mode B: loadConfig returns the passed options; resolve() emits the shared-core source for them.
    const config = (await opts.loadConfig!({ config: fakeParcelConfig() })) as TraitEnforcerOptions;
    const result = opts.resolve({ specifier: VID, config });
    expect(result?.code).toBe(EXPECTED_MANIFEST);
  });
});

// ── Part B — identical chunk isolation across real builds ──────────────────────────────────────────
//
// Each bundler builds the same fixture and we read back the entry chunk text and the union of all chunk
// texts. The invariant every bundler must satisfy:
//   - eager trait  → inlined into the ENTRY chunk
//   - lazy/preload → code-split into a NON-entry chunk (absent from the entry)
//   - unused trait → produces zero bytes (nowhere in the output)

interface BuildShape {
  /** The entry chunk's code. */
  entry: string;
  /** Every emitted chunk's code, concatenated. */
  all: string;
}

function assertIsolation(shape: BuildShape): void {
  // All bound traits are present somewhere; the unused one is gone entirely (tree-shaken from the manifest).
  expect(shape.all).toContain(MARK('eager'));
  expect(shape.all).toContain(MARK('lazy'));
  expect(shape.all).toContain(MARK('preload'));
  expect(shape.all).not.toContain(MARK('unused'));
  // The eager trait is inlined into the entry; the lazy + preload traits are split OUT of it.
  expect(shape.entry).toContain(MARK('eager'));
  expect(shape.entry).not.toContain(MARK('lazy'));
  expect(shape.entry).not.toContain(MARK('preload'));
}

/** Resolve `virtual:trait/*` to its marker stub — the shared shim for the Rollup-family builds. */
function rollupStub() {
  return {
    name: 'stub-traits',
    resolveId(id: string) {
      return id.startsWith('virtual:trait/') ? id : null;
    },
    load(id: string) {
      return id.startsWith('virtual:trait/') ? stubSource(id) : null;
    },
  };
}

describe('chunk isolation — identical across real builds', () => {
  it('Rollup', async () => {
    const bundle = await rollup({ input: VID, plugins: [traitEnforcerRollup(fixture), rollupStub()] });
    const { output } = await bundle.generate({ format: 'es' });
    await bundle.close();
    const chunks = output.filter((o): o is import('rollup').OutputChunk => o.type === 'chunk');
    const entry = chunks.find((c) => c.isEntry)!;
    assertIsolation({ entry: entry.code, all: chunks.map((c) => c.code).join('\n') });
  });

  it('esbuild', async () => {
    const result = await esbuildBuild({
      entryPoints: [VID],
      bundle: true,
      write: false,
      format: 'esm',
      splitting: true,
      minify: false,
      outdir: 'out',
      metafile: true,
      plugins: [
        traitEnforcerEsbuild(fixture),
        {
          name: 'stub-traits-esbuild',
          setup(b) {
            b.onResolve({ filter: /^virtual:trait\// }, (a) => ({ path: a.path, namespace: 'stub' }));
            b.onLoad({ filter: /.*/, namespace: 'stub' }, (a) => ({ contents: stubSource(a.path) }));
          },
        },
      ],
    });
    // The entry output is the one esbuild marks with an entryPoint in the metafile.
    const entryFile = Object.keys(result.metafile.outputs).find(
      (f) => result.metafile.outputs[f].entryPoint,
    )!;
    const byName = new Map(result.outputFiles.map((f) => [f.path.replace(/^.*\//, ''), f.text]));
    const entry = byName.get(entryFile.replace(/^.*\//, '')) ?? '';
    assertIsolation({ entry, all: result.outputFiles.map((f) => f.text).join('\n') });
  });

  it('webpack', async () => {
    const work = mkdtempSync(join(tmpdir(), 'we722-webpack-'));
    try {
      // webpack resolves the data:-URI manifest's import() thunks against the real fs, so the trait
      // stubs are on-disk files and the Map points at their absolute paths.
      const paths: Record<string, string> = {};
      for (const [key, spec] of Object.entries(SPECS)) {
        const p = join(work, `${key}.js`);
        writeFileSync(p, stubSource(spec));
        paths[key] = p;
      }
      const wpFixture: TraitEnforcerOptions = {
        traitMap: {
          'lazy-trait': paths.lazy,
          'eager-trait': { module: paths.eager, delivery: 'eager' },
          'preload-trait': paths.preload,
          'unused-trait': paths.unused,
        },
        templates: fixture.templates,
      };
      writeFileSync(
        join(work, 'entry.js'),
        `import { traitManifest } from '${VID}'; export default traitManifest;`,
      );
      const stats = await new Promise<webpack.Stats>((resolve, reject) => {
        webpack(
          {
            mode: 'none',
            entry: join(work, 'entry.js'),
            output: { path: join(work, 'out'), filename: 'main.js', chunkFilename: '[name].chunk.js' },
            plugins: [traitEnforcerWebpack(wpFixture)],
          },
          (err, s) => {
            if (err) return reject(err);
            if (!s) return reject(new Error('webpack produced no stats'));
            if (s.hasErrors()) return reject(new Error(s.toString({ all: false, errors: true })));
            resolve(s);
          },
        );
      });
      // webpack writes assets to disk (output.path); read them back (the in-memory asset can be a
      // SizeOnlySource once emitted, which refuses .source()).
      void stats;
      const outDir = join(work, 'out');
      const files = readdirSync(outDir);
      const entry = readFileSync(join(outDir, 'main.js'), 'utf8');
      const all = files.map((f) => readFileSync(join(outDir, f), 'utf8')).join('\n');
      assertIsolation({ entry, all });
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  });

  // Vite: a Vite *production* build bundles with Rollup, and the Vite Enforcer adapter is a
  // Rollup-shaped plugin (`resolveId`/`load`) — so driving that exact adapter through `rollup()` is the
  // faithful real-build test of Vite's bundling path (a standalone `vite.build` of a bare virtual entry
  // additionally needs an html/lib entry and re-poisons the shared esbuild service). Part A separately
  // proves the Vite adapter serves the byte-identical manifest; this proves it code-splits identically.
  it('Vite (production bundler = Rollup-driven)', async () => {
    const bundle = await rollup({ input: VID, plugins: [traitEnforcer(fixture), rollupStub()] });
    const { output } = await bundle.generate({ format: 'es' });
    await bundle.close();
    const chunks = output.filter((o): o is import('rollup').OutputChunk => o.type === 'chunk');
    const entry = chunks.find((c) => c.isEntry)!;
    assertIsolation({ entry: entry.code, all: chunks.map((c) => c.code).join('\n') });
  });

  it('Parcel (real build)', async () => {
    const { entry, all } = await runParcelBuild(
      {
        'lazy-trait': { code: stubSource(SPECS.lazy) },
        'eager-trait': { code: stubSource(SPECS.eager), delivery: 'eager' },
        'preload-trait': { code: stubSource(SPECS.preload) },
        'unused-trait': { code: stubSource(SPECS.unused) },
      },
      // Uses lazy/eager/preload (preload via the #202 delivery="eager" usage override); never unused.
      ['<x-grid lazy-trait eager-trait preload-trait preload-trait-delivery="eager"></x-grid>'],
    );
    assertIsolation({ entry, all });
  }, 60_000);
});
