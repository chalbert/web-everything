/**
 * Tests for the composed-component trait-set authoring construct (#720) and the
 * PRODUCTION build-chunk assertion that an unused trait emits zero chunk.
 *
 * The chunk-isolation test runs a real **Rollup production build** (not a dev
 * server, not the per-usage Playwright check): it builds the manifest the
 * Enforcer generates for a component's declared trait set and proves Rollup emits
 * a split chunk for each *bound* trait and **no chunk** for an unbound one —
 * because an undeclared trait never appears in the manifest, so the bundler never
 * sees an `import()` to it.
 */
import { describe, it, expect } from 'vitest';
import { rollup } from 'rollup';
import { defineComposedComponent, composeTraitSets } from '../composedTraitSet';
import { generateManifestModule } from '../vite-plugin';
import type { TraitMap } from '../traitManifestContract';

describe('defineComposedComponent', () => {
  it('declares only its own trait set, with sorted names', () => {
    const datePicker = defineComposedComponent('date-picker', {
      'calendar-grid': '/traits/CalendarGrid',
      sortable: '/traits/Sortable',
    });
    expect(datePicker.name).toBe('date-picker');
    expect(datePicker.traitNames).toEqual(['calendar-grid', 'sortable']);
  });

  it('rejects an empty name', () => {
    expect(() => defineComposedComponent('', {})).toThrow(/name is required/);
  });
});

describe('composeTraitSets', () => {
  const calendarGrid = defineComposedComponent('calendar-grid', { 'calendar-grid': '/traits/CalendarGrid' });
  const clock = defineComposedComponent('clock', { clock: '/traits/Clock' });

  it('binds the union of sub-components (date-picker gets calendar-grid, never clock)', () => {
    const datePicker = composeTraitSets('date-picker', calendarGrid);
    expect(datePicker.traitNames).toEqual(['calendar-grid']);
    expect(datePicker.traitNames).not.toContain('clock');
  });

  it('errors on a conflicting module for the same trait name', () => {
    const a = defineComposedComponent('a', { shared: '/traits/A' });
    const b = defineComposedComponent('b', { shared: '/traits/B' });
    expect(() => composeTraitSets('combo', a, b)).toThrow(/conflicting modules/);
  });
});

describe('production build-chunk isolation (real Rollup build)', () => {
  // A component declares two traits but binds (uses) only one. The unbound trait
  // must leave zero footprint in the production bundle.
  const map: TraitMap = {
    sortable: 'virtual:trait/sortable',
    'export-csv': 'virtual:trait/export-csv',
  };

  async function buildChunks(used: string[]): Promise<string[]> {
    const manifestSource = generateManifestModule(map, used);
    // A Rollup virtual-module plugin: the entry is the generated manifest; each
    // trait module is a tiny stub. Default code-splitting turns every `import()`
    // in the manifest into its own chunk.
    const bundle = await rollup({
      input: 'virtual:manifest',
      plugins: [
        {
          name: 'virtual',
          resolveId(id) {
            if (id === 'virtual:manifest' || id.startsWith('virtual:trait/')) return id;
            return null;
          },
          load(id) {
            if (id === 'virtual:manifest') return manifestSource;
            if (id.startsWith('virtual:trait/')) return 'export default {};';
            return null;
          },
        },
      ],
    });
    const { output } = await bundle.generate({ format: 'es' });
    await bundle.close();
    // Collect every module id that made it into the build.
    const moduleIds = output
      .filter((o): o is import('rollup').OutputChunk => o.type === 'chunk')
      .flatMap((chunk) => Object.keys(chunk.modules));
    return moduleIds;
  }

  it('emits a split chunk for a bound trait', async () => {
    const ids = await buildChunks(['sortable']);
    expect(ids).toContain('virtual:trait/sortable');
  });

  it('emits ZERO chunk for an unbound trait', async () => {
    const ids = await buildChunks(['sortable']);
    expect(ids).not.toContain('virtual:trait/export-csv');
  });

  it('binds exactly the declared/used set — both when both are used', async () => {
    const ids = await buildChunks(['sortable', 'export-csv']);
    expect(ids).toContain('virtual:trait/sortable');
    expect(ids).toContain('virtual:trait/export-csv');
  });
});
