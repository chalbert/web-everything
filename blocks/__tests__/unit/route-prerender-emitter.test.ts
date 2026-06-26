/**
 * webrouting prerender manifest emitter suite (#1739) — conformance vectors.
 *
 * Pins #1688 Fork 1a: static routes enter the manifest; parametric (`:id`/`*`) and error-boundary routes are
 * EXCLUDED by default and surfaced in `skipped` + a build-time `notice` (never fabricated into `/users/0`).
 * Also proves it plugs into the #1736 emitter registry as a peer.
 */
import { describe, it, expect } from 'vitest';
import { createPrerenderEmitter } from '../../router/prerender-emitter';
import { RouteEmitterRegistry } from '../../router/route-emitters';
import { buildRouteMap, type RouteMap } from '../../router/route-map';

const map: RouteMap = {
  routes: [
    { path: '/' },
    { path: '/about' },
    { path: '/users/:id' }, // parametric — excluded
    { path: '/blog/*' }, // wildcard — excluded
    { path: '/*', isErrorBoundary: true }, // error boundary — excluded
  ],
};

describe('prerender emitter — faithful derivation (#1739)', () => {
  const emitter = createPrerenderEmitter();

  it('manifests one entry per STATIC route, excluding parametric + error-boundary routes', () => {
    const { manifest, skipped } = emitter.emit(map);
    expect(manifest).toEqual(['/', '/about']);
    expect(skipped).toEqual(['/users/:id', '/blog/*', '/*']);
  });

  it('never fabricates a concrete URL for a parametric route', () => {
    const { manifest } = emitter.emit(map);
    expect(manifest.some((p) => p.includes(':') || p.includes('*'))).toBe(false);
    expect(manifest).not.toContain('/users/0');
  });

  it('surfaces a build-time skip notice naming the excluded routes + the param-source hook', () => {
    const { notice } = emitter.emit(map);
    expect(notice).toContain('/users/:id');
    expect(notice).toContain('#1741');
  });

  it('an all-static map skips nothing and emits an empty notice', () => {
    const out = emitter.emit({ routes: [{ path: '/' }, { path: '/about' }] });
    expect(out.skipped).toEqual([]);
    expect(out.notice).toBe('');
  });

  it('an empty / all-parametric map yields an empty manifest', () => {
    const out = emitter.emit({ routes: [{ path: '/:id' }] });
    expect(out.manifest).toEqual([]);
    expect(out.skipped).toEqual(['/:id']);
  });

  it('plugs into the #1736 emitter registry as a peer over a built map', () => {
    const built = buildRouteMap([{ path: '/' }, { path: '/x/:y' }]);
    const reg = new RouteEmitterRegistry().register(createPrerenderEmitter());
    const out = reg.emit('prerender', built) as { manifest: string[]; skipped: string[] };
    expect(out.manifest).toEqual(['/']);
    expect(out.skipped).toEqual(['/x/:y']);
  });
});
