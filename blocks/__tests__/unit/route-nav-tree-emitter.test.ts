/**
 * webrouting IA nav-tree emitter suite (#1738) — conformance vectors.
 *
 * Pins #1688 Fork 2(a): the emitter REALIZES the navigation-intent `structure` axis (hierarchical / lateral /
 * linear) and falls back to path-nesting when none is declared. Faithful derivation — nests only under
 * declared routes (no fabricated intermediate levels), keeps parametric routes in template form
 * (pattern-preserving, unlike the sitemap emitter), excludes error-boundary routes. Also proves it plugs
 * into the #1736 emitter registry as a peer.
 */
import { describe, it, expect } from 'vitest';
import { createNavTreeEmitter, type NavTreeNode } from '../../router/nav-tree-emitter';
import { RouteEmitterRegistry } from '../../router/route-emitters';
import { buildRouteMap, type RouteMap } from '../../router/route-map';

const map: RouteMap = {
  routes: [
    { path: '/' },
    { path: '/standards' },
    { path: '/standards/:standard' },
    { path: '/standards/:standard/conformance' },
    { path: '/backlog/:id' }, // parametric ROOT — its `/backlog` parent is not declared (no fabrication)
    { path: '/*', isErrorBoundary: true }, // excluded
  ],
};

/** Find a node by path anywhere in the tree. */
function find(nodes: NavTreeNode[], path: string): NavTreeNode | undefined {
  for (const n of nodes) {
    if (n.path === path) return n;
    const hit = find(n.children, path);
    if (hit) return hit;
  }
  return undefined;
}

describe('nav-tree emitter — hierarchical realization (#1738)', () => {
  const emitter = createNavTreeEmitter({ structure: 'hierarchical' });

  it('nests under the longest declared path-prefix; home `/` stays a sibling root', () => {
    const { tree, structure, derivedFrom } = emitter.emit(map);
    expect(structure).toBe('hierarchical');
    expect(derivedFrom).toBe('navigation-intent');
    // Roots: home, /standards, and the orphan-parametric /backlog/:id.
    expect(tree.map((n) => n.path).sort()).toEqual(['/', '/backlog/:id', '/standards']);
  });

  it('keeps parametric routes in TEMPLATE form (pattern-preserving) and nests them', () => {
    const { tree } = emitter.emit(map);
    const standards = find(tree, '/standards')!;
    expect(standards.children.map((c) => c.path)).toEqual(['/standards/:standard']);
    const standard = find(tree, '/standards/:standard')!;
    expect(standard.children.map((c) => c.path)).toEqual(['/standards/:standard/conformance']);
    expect(standard.segment).toBe(':standard'); // template segment, no concrete value fabricated
  });

  it('NEVER fabricates a missing intermediate level — an orphan route is a root', () => {
    const { tree } = emitter.emit(map);
    // `/backlog` is not declared, so `/backlog/:id` cannot nest under a fabricated node — it is a root.
    expect(tree.some((n) => n.path === '/backlog/:id')).toBe(true);
    expect(find(tree, '/backlog')).toBeUndefined();
  });

  it('excludes error-boundary routes and surfaces them in `skipped`', () => {
    const { tree, skipped } = emitter.emit(map);
    expect(find(tree, '/*')).toBeUndefined();
    expect(skipped).toEqual(['/*']);
  });
});

describe('nav-tree emitter — lateral / linear are flat (#1738)', () => {
  it('lateral: every navigable route is a flat peer root, no nesting', () => {
    const out = createNavTreeEmitter({ structure: 'lateral' }).emit(map);
    expect(out.structure).toBe('lateral');
    expect(out.tree.every((n) => n.children.length === 0)).toBe(true);
    expect(out.tree.map((n) => n.path)).toEqual([
      '/',
      '/standards',
      '/standards/:standard',
      '/standards/:standard/conformance',
      '/backlog/:id',
    ]);
  });

  it('linear: flat, in route order (the sequence), error boundary still excluded', () => {
    const out = createNavTreeEmitter({ structure: 'linear' }).emit(map);
    expect(out.structure).toBe('linear');
    expect(out.tree.map((n) => n.path)).toEqual([
      '/',
      '/standards',
      '/standards/:standard',
      '/standards/:standard/conformance',
      '/backlog/:id',
    ]);
    expect(out.skipped).toEqual(['/*']);
  });
});

describe('nav-tree emitter — fallback + registry (#1738)', () => {
  it('falls back to path-nesting (hierarchical) when no structure is declared', () => {
    const out = createNavTreeEmitter().emit(map);
    expect(out.structure).toBe('hierarchical');
    expect(out.derivedFrom).toBe('path-nesting-fallback');
    const standards = find(out.tree, '/standards')!;
    expect(standards.children.map((c) => c.path)).toEqual(['/standards/:standard']);
  });

  it('plugs into the #1736 emitter registry as a peer over a built map', () => {
    const built = buildRouteMap([{ path: '/' }, { path: '/docs' }, { path: '/docs/:page' }]);
    const reg = new RouteEmitterRegistry().register(createNavTreeEmitter({ structure: 'hierarchical' }));
    const out = reg.emit('nav-tree', built) as { tree: NavTreeNode[] };
    const docs = find(out.tree, '/docs')!;
    expect(docs.children.map((c) => c.path)).toEqual(['/docs/:page']);
  });
});
