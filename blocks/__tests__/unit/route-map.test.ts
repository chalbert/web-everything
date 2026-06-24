/**
 * webrouting route-map projection — schema conformance suite (slice B, #1721).
 *
 * Runs the structural validator over the conformance vectors: positive vectors must conform, negative
 * vectors must each surface their pinned violation. Asserts the load-bearing #1685 invariant — the
 * projection drops the non-serializable `pattern` + `template` fields and rejects concrete URLs.
 */
import { describe, it, expect } from 'vitest';
import { validateRouteMap, isRouteMap, type RouteMap } from '../../router/route-map';
import { routeMapCases } from '../../router/__fixtures__/route-map-cases';

describe('webrouting route-map projection schema (#1721)', () => {
  for (const c of routeMapCases) {
    it(c.title, () => {
      const errors = validateRouteMap(c.map);
      if (c.valid) {
        expect(errors, `expected no violations, got: ${errors.join('; ')}`).toEqual([]);
        expect(isRouteMap(c.map)).toBe(true);
      } else {
        expect(errors.length, 'expected at least one violation').toBeGreaterThan(0);
        if (c.expectViolation) {
          expect(errors.some((e) => e.includes(c.expectViolation!))).toBe(true);
        }
        expect(isRouteMap(c.map)).toBe(false);
      }
    });
  }

  it('rejects a non-object map', () => {
    expect(validateRouteMap(null).length).toBeGreaterThan(0);
    expect(validateRouteMap([]).length).toBeGreaterThan(0);
    expect(validateRouteMap('routes').length).toBeGreaterThan(0);
  });

  it('drops nothing it should keep — the full serializable field set round-trips', () => {
    const map: RouteMap = {
      base: '/app',
      routes: [
        { path: '/app/orders/:orderId', guard: 'auth', guardLeave: 'confirmExit', loader: 'order', outlet: 'main', isErrorBoundary: false },
      ],
    };
    expect(validateRouteMap(map)).toEqual([]);
    // It is JSON-serializable — the whole point of the derived projection.
    expect(() => JSON.stringify(map)).not.toThrow();
    expect(JSON.parse(JSON.stringify(map))).toEqual(map);
  });
});
