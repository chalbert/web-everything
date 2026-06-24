/**
 * webrouting sitemap.xml emitter suite (#1737) — conformance vectors for the faithful derivation.
 *
 * Pins #1688 Fork 1a: static routes emit one `<url>` each; parametric (`:id`/`*`) and error-boundary routes
 * are EXCLUDED by default and surfaced in `skipped` (never fabricated into `/users/0`); the XML is
 * sitemaps.org/0.9. Also proves it plugs into the #1736 emitter registry as a peer.
 */
import { describe, it, expect } from 'vitest';
import { createSitemapEmitter, isParametricPath } from '../../router/sitemap-emitter';
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

describe('sitemap emitter — faithful derivation (#1737)', () => {
  const emitter = createSitemapEmitter({ baseUrl: 'https://example.com' });

  it('emits one <loc> per STATIC route, excluding parametric + error-boundary routes', () => {
    const { xml, included, skipped } = emitter.emit(map);
    expect(included).toEqual(['/', '/about']);
    expect(skipped).toEqual(['/users/:id', '/blog/*', '/*']);
    expect(xml).toContain('<loc>https://example.com/</loc>');
    expect(xml).toContain('<loc>https://example.com/about</loc>');
  });

  it('never fabricates a concrete URL for a parametric route (no :id, no /users/0)', () => {
    const { xml } = emitter.emit(map);
    expect(xml).not.toContain(':id');
    expect(xml).not.toContain('/users/');
    expect(xml).not.toContain('/blog/');
  });

  it('produces a well-formed sitemaps.org/0.9 document', () => {
    const { xml } = emitter.emit(map);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml.trimEnd().endsWith('</urlset>')).toBe(true);
  });

  it('joins origin + path with exactly one slash and XML-escapes the loc', () => {
    const e = createSitemapEmitter({ baseUrl: 'https://example.com/' }); // trailing slash tolerated
    const out = e.emit({ routes: [{ path: '/a&b' }] });
    expect(out.xml).toContain('<loc>https://example.com/a&amp;b</loc>');
    expect(out.xml).not.toContain('example.com//a');
  });

  it('an empty / all-parametric map yields a valid empty urlset', () => {
    const out = emitter.emit({ routes: [{ path: '/:id' }] });
    expect(out.included).toEqual([]);
    expect(out.skipped).toEqual(['/:id']);
    expect(out.xml).toContain('<urlset');
    expect(out.xml).toContain('</urlset>');
  });

  it('isParametricPath flags params/wildcards/groups, not static paths', () => {
    expect(isParametricPath('/users/:id')).toBe(true);
    expect(isParametricPath('/blog/*')).toBe(true);
    expect(isParametricPath('/files/{name}')).toBe(true);
    expect(isParametricPath('/about')).toBe(false);
  });

  it('plugs into the #1736 emitter registry as a peer over a built map', () => {
    const built = buildRouteMap([{ path: '/' }, { path: '/x/:y' }]);
    const reg = new RouteEmitterRegistry().register(createSitemapEmitter({ baseUrl: 'https://e.com' }));
    const out = reg.emit('sitemap', built) as { included: string[]; skipped: string[] };
    expect(out.included).toEqual(['/']);
    expect(out.skipped).toEqual(['/x/:y']);
  });
});
