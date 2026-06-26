/**
 * webrouting dynamic-route param-source hook suite (#1741) — conformance vectors.
 *
 * Pins #1688 Fork 1(a): the opt-in enumeration contract. A sourced parametric route expands to concrete
 * entries from a generateStaticParams-shaped hook (never fabricated); an un-sourced parametric route stays
 * parametric (still excluded by the emitters) and is surfaced. Proves the expansion composes with the
 * exclude-by-default sitemap (#1737) + prerender (#1739) emitters additively.
 */
import { describe, it, expect } from 'vitest';
import { expandRouteMap, substituteParams } from '../../router/param-source';
import { createSitemapEmitter } from '../../router/sitemap-emitter';
import { createPrerenderEmitter } from '../../router/prerender-emitter';
import type { RouteMap } from '../../router/route-map';

const map: RouteMap = {
  routes: [
    { path: '/' },
    { path: '/users/:id', loader: 'user' },
    { path: '/blog/:slug' }, // no source — stays parametric
    { path: '/*', isErrorBoundary: true },
  ],
};

describe('substituteParams (#1741)', () => {
  it('substitutes named groups and url-encodes values', () => {
    expect(substituteParams('/users/:id', { id: '42' })).toBe('/users/42');
    expect(substituteParams('/files/:name', { name: 'a b' })).toBe('/files/a%20b');
  });

  it('substitutes a `*` wildcard when keyed', () => {
    expect(substituteParams('/blog/*', { '*': 'a/b' })).toBe('/blog/a/b');
  });

  it('leaves an unsupplied token in place (never fabricates a partial URL)', () => {
    expect(substituteParams('/users/:id/:tab', { id: '1' })).toBe('/users/1/:tab');
  });
});

describe('expandRouteMap (#1741)', () => {
  it('expands a sourced parametric route to one concrete entry per param set, preserving fields', () => {
    const out = expandRouteMap(map, { '/users/:id': () => [{ id: '1' }, { id: '2' }] });
    const paths = out.map.routes.map((r) => r.path);
    expect(paths).toEqual(['/', '/users/1', '/users/2', '/blog/:slug', '/*']);
    expect(out.map.routes.find((r) => r.path === '/users/1')!.loader).toBe('user');
    expect(out.expanded).toEqual([{ from: '/users/:id', to: ['/users/1', '/users/2'] }]);
  });

  it('keeps an un-sourced parametric route parametric and surfaces it in skipped + notice', () => {
    const out = expandRouteMap(map, { '/users/:id': () => [{ id: '1' }] });
    expect(out.map.routes.some((r) => r.path === '/blog/:slug')).toBe(true);
    expect(out.skipped).toContain('/blog/:slug');
    expect(out.notice).toContain('/blog/:slug');
  });

  it('a source yielding nothing concrete is itself a skip (no fabrication)', () => {
    const out = expandRouteMap(map, { '/users/:id': () => [] });
    expect(out.skipped).toContain('/users/:id');
    expect(out.expanded).toEqual([]);
  });

  it('passes static routes through untouched and emits an empty notice when all parametric routes are sourced', () => {
    const out = expandRouteMap(
      { routes: [{ path: '/' }, { path: '/users/:id' }] },
      { '/users/:id': () => [{ id: '1' }] },
    );
    expect(out.skipped).toEqual([]);
    expect(out.notice).toBe('');
  });

  it('composes additively with the sitemap emitter — sourced routes now INCLUDED', () => {
    const expanded = expandRouteMap(map, { '/users/:id': () => [{ id: '1' }, { id: '2' }] });
    const out = createSitemapEmitter({ baseUrl: 'https://e.com' }).emit(expanded.map);
    expect(out.included).toEqual(['/', '/users/1', '/users/2']);
    expect(out.skipped).toEqual(['/blog/:slug', '/*']); // un-sourced + boundary still excluded
  });

  it('composes additively with the prerender emitter — sourced routes now in the manifest', () => {
    const expanded = expandRouteMap(map, { '/users/:id': () => [{ id: '7' }] });
    const out = createPrerenderEmitter().emit(expanded.map);
    expect(out.manifest).toEqual(['/', '/users/7']);
    expect(out.skipped).toEqual(['/blog/:slug', '/*']);
  });
});
