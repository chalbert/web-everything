/**
 * Real Parcel build harness for the trait Enforcer (#787). Parcel loads resolver plugins as Node-
 * `require`d files in worker subprocesses (its declarative model — #756's config-delivery fork), so the
 * uncompiled-TS Enforcer core can't be handed to it the way webpack's inline plugin is. This harness
 * bridges that: it **esbuild-compiles** `parcel-plugin.ts` (+ the shared core) to a temp `.mjs`, writes a
 * `.parcelrc` referencing it **by relative path** (Parcel ≥ 2.9.0 — no published package needed), then
 * runs a real production Parcel build over a fixture and reads back the emitted bundles.
 *
 * The temp project lives **inside the repo** so Parcel resolves `@parcel/*` + `@parcel/plugin` by walking
 * up to the repo `node_modules`. Optimization is off so the marker strings survive verbatim (Parcel's
 * analogue of webpack `mode: 'none'`).
 *
 * The build itself runs in a **child Node process** (`build.mjs`), not in-process: Parcel's `lmdb` cache
 * native binding fails to load inside vitest's transformed module environment ("URL must be of scheme
 * file"), but works in a clean Node process — so the actual `parcel.run()` is shelled out.
 */
import { build as esbuildBuild } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, readdirSync, readFileSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_VIRTUAL_ID, type TraitEnforcerOptions } from '../vite-plugin';
import type { TraitMap } from '../traitManifestContract';

const HERE = dirname(fileURLToPath(import.meta.url));
const PLUGIN_SRC = join(HERE, '..', 'parcel-plugin.ts');

/** One trait stub: its module source, and whether it's delivered eagerly (static import). */
export interface HarnessTrait {
  code: string;
  delivery?: 'eager';
}

export interface ParcelBuildResult {
  /** The entry bundle's code. */
  entry: string;
  /** Every emitted bundle's code, concatenated. */
  all: string;
  /** The emitted bundle file names (for diagnostics). */
  bundleNames: string[];
}

/**
 * Run a real Parcel build of the trait manifest over `traits`, scanning `templates` for usage. Each trait
 * becomes an on-disk stub module the manifest's import thunks resolve against (absolute paths). Returns the
 * entry-bundle text and the union of all bundle texts — the same `{ entry, all }` shape the cross-bundler
 * conformance suite asserts on.
 */
export async function runParcelBuild(
  traits: Record<string, HarnessTrait>,
  templates: string[],
): Promise<ParcelBuildResult> {
  const tmp = mkdtempSync(join(HERE, '.parcel-tmp-'));
  try {
    // 1. Compile the Enforcer plugin (with the shared core bundled in) to a Node-loadable ESM file.
    await esbuildBuild({
      entryPoints: [PLUGIN_SRC],
      bundle: true,
      platform: 'node',
      format: 'esm',
      outfile: join(tmp, 'enforcer.mjs'),
      external: ['@parcel/plugin'], // resolved from the repo node_modules at Parcel load time
      logLevel: 'silent',
    });

    // 2. Write each trait stub and build the Map. Parcel resolves a leading `/` as PROJECT-root-relative
    //    (not filesystem-absolute, unlike webpack), so specifiers are `./<name>.js` relative to the virtual
    //    manifest module — whose synthetic filePath lands in `tmp` (the build runs with cwd = tmp), so the
    //    stubs (also in `tmp`) resolve.
    const traitMap: TraitMap = {};
    for (const [name, spec] of Object.entries(traits)) {
      const safe = name.replace(/[^a-z0-9]/gi, '_');
      writeFileSync(join(tmp, `${safe}.js`), spec.code);
      const rel = `./${safe}.js`;
      traitMap[name] = spec.delivery === 'eager' ? { module: rel, delivery: 'eager' } : rel;
    }

    // 3. The resolver file Parcel loads — mode B (Map as a JS arg), referenced by relative path in .parcelrc.
    const options: TraitEnforcerOptions = { traitMap, templates };
    writeFileSync(
      join(tmp, 'resolver.mjs'),
      `import { traitEnforcerParcel } from './enforcer.mjs';\n` +
        `export default traitEnforcerParcel(${JSON.stringify(options)});\n`,
    );
    writeFileSync(
      join(tmp, '.parcelrc'),
      JSON.stringify({ extends: '@parcel/config-default', resolvers: ['./resolver.mjs', '...'] }),
    );
    writeFileSync(join(tmp, 'package.json'), JSON.stringify({ name: 'we787-parcel-fixture', version: '1.0.0' }));
    writeFileSync(
      join(tmp, 'entry.js'),
      `import { traitManifest } from '${DEFAULT_VIRTUAL_ID}';\nexport default traitManifest;\n`,
    );

    // 4. Real production build, run in a CHILD Node process (Parcel's lmdb cache binding breaks under
    //    vitest's module env but loads fine in clean Node). Optimization off so markers survive verbatim.
    writeFileSync(
      join(tmp, 'build.mjs'),
      `import { Parcel } from '@parcel/core';\n` +
        `const bundler = new Parcel({\n` +
        `  entries: ${JSON.stringify(join(tmp, 'entry.js'))},\n` +
        `  mode: 'production',\n` +
        `  defaultConfig: '@parcel/config-default',\n` +
        `  shouldDisableCache: true,\n` +
        `  cacheDir: ${JSON.stringify(join(tmp, '.parcel-cache'))},\n` +
        `  defaultTargetOptions: { distDir: ${JSON.stringify(join(tmp, 'dist'))}, shouldOptimize: false, sourceMaps: false, shouldScopeHoist: false },\n` +
        `});\n` +
        `await bundler.run();\n`,
    );
    execFileSync(process.execPath, [join(tmp, 'build.mjs')], { cwd: tmp, stdio: 'pipe' });

    // 5. Read back the emitted bundles; the entry bundle is named from `entry.js`.
    const dist = join(tmp, 'dist');
    const bundleNames = readdirSync(dist).filter((f) => f.endsWith('.js'));
    const texts = bundleNames.map((f) => readFileSync(join(dist, f), 'utf8'));
    const entryName = bundleNames.find((f) => basename(f).startsWith('entry')) ?? bundleNames[0];
    const entry = readFileSync(join(dist, entryName), 'utf8');
    return { entry, all: texts.join('\n'), bundleNames };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}
