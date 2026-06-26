/**
 * webrouting Speculation Rules emitter suite (#1740) — conformance vectors.
 *
 * Pins native-first (#1688): emits the platform Speculation Rules shape. Static routes → a `list` rule of
 * concrete URLs; parametric routes → a `document` rule matching links by URLPattern (pattern-preserving, no
 * enumeration, never fabricated); error-boundary routes excluded. Also proves it plugs into the #1736
 * emitter registry as a peer.
 */
import { describe, it, expect } from 'vitest';
import { createSpeculationRulesEmitter } from '../../router/speculation-rules-emitter';
import { RouteEmitterRegistry } from '../../router/route-emitters';
import { buildRouteMap, type RouteMap } from '../../router/route-map';

const map: RouteMap = {
  routes: [
    { path: '/' },
    { path: '/about' },
    { path: '/users/:id' }, // parametric — document rule
    { path: '/blog/*' }, // wildcard — document rule
    { path: '/*', isErrorBoundary: true }, // error boundary — excluded
  ],
};

describe('speculation-rules emitter — native-first derivation (#1740)', () => {
  it('static routes become a list rule of concrete URLs', () => {
    const out = createSpeculationRulesEmitter().emit(map);
    expect(out.listed).toEqual(['/', '/about']);
    const listRule = out.rules.prefetch!.find((r) => r.source === 'list')!;
    expect(listRule.urls).toEqual(['/', '/about']);
  });

  it('parametric routes become a document rule matched by URLPattern, never enumerated', () => {
    const out = createSpeculationRulesEmitter().emit(map);
    expect(out.patterns).toEqual(['/users/:id', '/blog/*']);
    const docRule = out.rules.prefetch!.find((r) => r.source === 'document')!;
    expect(docRule.where).toEqual({ or: [{ href_matches: '/users/:id' }, { href_matches: '/blog/*' }] });
    // No concrete URL was fabricated for the parametric routes.
    expect(out.listed.some((p) => p.includes(':') || p.includes('*'))).toBe(false);
  });

  it('a single parametric route uses a bare href_matches (no `or` wrapper)', () => {
    const out = createSpeculationRulesEmitter().emit({ routes: [{ path: '/users/:id' }] });
    const docRule = out.rules.prefetch!.find((r) => r.source === 'document')!;
    expect(docRule.where).toEqual({ href_matches: '/users/:id' });
  });

  it('excludes error-boundary routes', () => {
    const out = createSpeculationRulesEmitter().emit(map);
    expect(out.skipped).toEqual(['/*']);
    expect(out.listed).not.toContain('/*');
    expect(out.patterns).not.toContain('/*');
  });

  it('honors the action + eagerness options', () => {
    const out = createSpeculationRulesEmitter({ action: 'prerender', eagerness: 'eager' }).emit(map);
    expect(out.rules.prerender).toBeDefined();
    expect(out.rules.prefetch).toBeUndefined();
    expect(out.rules.prerender!.every((r) => r.eagerness === 'eager')).toBe(true);
  });

  it('emits valid JSON for the <script type="speculationrules"> body', () => {
    const out = createSpeculationRulesEmitter().emit(map);
    expect(() => JSON.parse(out.json)).not.toThrow();
    expect(JSON.parse(out.json)).toEqual(out.rules);
  });

  it('an empty / all-boundary map yields an empty rules object', () => {
    const out = createSpeculationRulesEmitter().emit({ routes: [{ path: '/*', isErrorBoundary: true }] });
    expect(out.rules).toEqual({});
    expect(out.skipped).toEqual(['/*']);
  });

  it('plugs into the #1736 emitter registry as a peer over a built map', () => {
    const built = buildRouteMap([{ path: '/' }, { path: '/x/:y' }]);
    const reg = new RouteEmitterRegistry().register(createSpeculationRulesEmitter());
    const out = reg.emit('speculation-rules', built) as { listed: string[]; patterns: string[] };
    expect(out.listed).toEqual(['/']);
    expect(out.patterns).toEqual(['/x/:y']);
  });
});
