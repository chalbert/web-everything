/**
 * Unit tests for the MaaS eager hot-set pre-warming policy (backlog #462). Proves the lazy-default /
 * eager-hot-set behavior built on the #461 origin: the declared hot set is resolved + cache-filled up
 * front (a genuine later cache hit), everything else stays lazy, and the lazy remainder is ALWAYS
 * reported so coverage is never silently partial. A stubbed `serve` keeps the suite DOM-free.
 */
import { describe, it, expect, vi } from 'vitest';
import { prewarmHotSet, tupleIdentity, type PrewarmPolicy } from '../../../renderers/module-service/prewarm';
import { ServedArtifactCache, type DefinitionResolver } from '../../../renderers/module-service/definitionRegistry';
import type { ServeResult, ServeOptions } from '../../../renderers/module-service/moduleService';

const resolver: DefinitionResolver = {
  resolve: (id) => (id === 'user-card' ? '<component name="user-card"></component>' : null),
};
const stubServe = vi.fn((_def: string, opts: ServeOptions): ServeResult => ({
  form: opts.form,
  code: `/* ${opts.form} */`,
  language: 'javascript',
  lossy: false,
  diagnostics: [],
}));

const newCache = () => new ServedArtifactCache(resolver, stubServe);

describe('prewarmHotSet', () => {
  it('eager-warms exactly the hot set and reports the lazy remainder', () => {
    const cache = newCache();
    const policy: PrewarmPolicy = {
      ids: ['user-card'],
      hotSet: [{ form: 'declarative' }, { form: 'wc-class' }],
      matrix: { forms: ['declarative', 'wc-class', 'html', 'jsx'], targets: ['esnext'], strategies: ['declarative-static'] },
    };
    const report = prewarmHotSet(cache, policy);

    expect(report.warmed).toEqual([
      tupleIdentity('user-card', { form: 'declarative' }),
      tupleIdentity('user-card', { form: 'wc-class' }),
    ]);
    // Matrix is 4 forms; 2 warmed → 2 left lazy (html, jsx).
    expect(report.lazyRemainder.count).toBe(2);
    expect(report.lazyRemainder.identities).toEqual([
      tupleIdentity('user-card', { form: 'html' }),
      tupleIdentity('user-card', { form: 'jsx' }),
    ]);
    expect(report.unresolved).toEqual([]);
  });

  it('actually cache-fills the hot set (a later request is a hit, not a re-serve)', () => {
    const cache = newCache();
    prewarmHotSet(cache, { ids: ['user-card'], hotSet: [{ form: 'wc-class' }] });
    const callsAfterWarm = stubServe.mock.calls.length;
    // The warmed tuple now resolves from cache — serve() is not invoked again.
    cache.serve('user-card', { form: 'wc-class' });
    expect(stubServe.mock.calls.length).toBe(callsAfterWarm);
    expect(cache.stats.hits).toBeGreaterThan(0);
  });

  it('reports an unknown-id hot-set tuple in `unresolved` instead of throwing', () => {
    const cache = newCache();
    const report = prewarmHotSet(cache, { ids: ['ghost'], hotSet: [{ form: 'wc-class' }], matrix: { forms: ['wc-class'] } });
    expect(report.warmed).toEqual([]);
    expect(report.unresolved).toEqual([tupleIdentity('ghost', { form: 'wc-class' })]);
    // Still accounts the lazy remainder for the (unresolved) matrix.
    expect(report.lazyRemainder.count).toBe(1);
  });

  it('emits a warmed/lazy summary to the log sink', () => {
    const cache = newCache();
    const lines: string[] = [];
    prewarmHotSet(
      cache,
      { ids: ['user-card'], hotSet: [{ form: 'declarative' }], matrix: { forms: ['declarative', 'html'] } },
      (m) => lines.push(m),
    );
    expect(lines.some((l) => /eager-warmed 1 tuple\(s\); 1 left lazy/.test(l))).toBe(true);
    expect(lines.some((l) => /lazy remainder:/.test(l))).toBe(true);
  });

  it('defaults the matrix to all forms at the baseline target/strategy', () => {
    const cache = newCache();
    const report = prewarmHotSet(cache, { ids: ['user-card'], hotSet: [] });
    // No hot set → the whole default matrix (5 forms × esnext × declarative-static) is lazy.
    expect(report.warmed).toEqual([]);
    expect(report.lazyRemainder.count).toBe(5);
  });
});
