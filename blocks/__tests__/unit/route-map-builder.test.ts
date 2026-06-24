/**
 * webrouting route-map BUILDER + emitter registry suite (#1736).
 *
 * Asserts the faithful derivation (`buildRouteMap`) over the conformance vectors — every built map both
 * round-trips through the #1721 schema validator and equals its golden — and the default-less pluggable
 * emitter registry (support-all fan-out, no built-in default).
 */
import { describe, it, expect } from 'vitest';
import { buildRouteMap, validateRouteMap, type RouteMap } from '../../router/route-map';
import { routeBuilderCases } from '../../router/__fixtures__/route-builder-cases';
import {
  RouteEmitterRegistry,
  UnknownRouteEmitterError,
  type RouteMapEmitter,
} from '../../router/route-emitters';

describe('buildRouteMap — faithful DOM→map derivation (#1736)', () => {
  for (const c of routeBuilderCases) {
    it(c.title, () => {
      const map = buildRouteMap(c.input, c.base);
      expect(map).toEqual(c.expected);
      // Every derived map is schema-valid (the #1721 contract the emitters read).
      expect(validateRouteMap(map)).toEqual([]);
    });
  }

  it('drops the non-serializable pattern/template even if present on the input', () => {
    const input = [
      { path: '/users/:id', guard: 'auth', pattern: '[URLPattern]', template: '<template>' },
    ] as unknown as Parameters<typeof buildRouteMap>[0];
    const map = buildRouteMap(input);
    expect(map.routes[0]).toEqual({ path: '/users/:id', guard: 'auth' });
    expect('pattern' in map.routes[0]).toBe(false);
    expect('template' in map.routes[0]).toBe(false);
  });
});

describe('RouteEmitterRegistry — default-less pluggable emitter set (#1736)', () => {
  const map: RouteMap = { routes: [{ path: '/' }, { path: '/about' }] };
  const pathList: RouteMapEmitter<string[]> = { id: 'paths', emit: (m) => m.routes.map((r) => r.path) };
  const count: RouteMapEmitter<number> = { id: 'count', emit: (m) => m.routes.length };

  it('starts empty (no built-in default) and registers an open set', () => {
    const reg = new RouteEmitterRegistry();
    expect(reg.ids()).toEqual([]);
    reg.register(pathList).register(count);
    expect(reg.ids()).toEqual(['paths', 'count']);
    expect(reg.has('paths')).toBe(true);
  });

  it('emits one registered emitter, and fans out over all (support-all)', () => {
    const reg = new RouteEmitterRegistry().register(pathList).register(count);
    expect(reg.emit('paths', map)).toEqual(['/', '/about']);
    expect(reg.emitAll(map)).toEqual({ paths: ['/', '/about'], count: 2 });
  });

  it('throws for an unknown emitter id', () => {
    const reg = new RouteEmitterRegistry().register(count);
    expect(() => reg.emit('paths', map)).toThrow(UnknownRouteEmitterError);
  });

  it('an empty registry emits nothing (valid — emitters are an opt-in open set)', () => {
    expect(new RouteEmitterRegistry().emitAll(map)).toEqual({});
  });
});
