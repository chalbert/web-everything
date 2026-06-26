/**
 * webrouting route-config schema — conformance suite (#1732, slice of #1684).
 *
 * Runs the structural validators over the conformance vectors: positive vectors must conform, negative
 * vectors must each surface their pinned violation. Asserts the two load-bearing #1687 invariants — the
 * scope partition (per-route key ⊥ app-global config) and serializable-only (code-shaped forms rejected).
 */
import { describe, it, expect } from 'vitest';
import {
  validateRouteConfig,
  isRouteConfig,
  validateRoutePolicy,
  isRoutePolicy,
  type RouteConfig,
} from '../../router/route-config';
import { routeConfigCases, routePolicyCases } from '../../router/__fixtures__/route-config-cases';

describe('webrouting route-config app-global schema (#1732)', () => {
  for (const c of routeConfigCases) {
    it(c.title, () => {
      const errors = validateRouteConfig(c.config);
      if (c.valid) {
        expect(errors, `expected no violations, got: ${errors.join('; ')}`).toEqual([]);
        expect(isRouteConfig(c.config)).toBe(true);
      } else {
        expect(errors.length, 'expected at least one violation').toBeGreaterThan(0);
        if (c.expectViolation) {
          expect(errors.some((e) => e.includes(c.expectViolation!))).toBe(true);
        }
        expect(isRouteConfig(c.config)).toBe(false);
      }
    });
  }

  it('rejects a non-object config', () => {
    expect(validateRouteConfig(null).length).toBeGreaterThan(0);
    expect(validateRouteConfig([]).length).toBeGreaterThan(0);
    expect(validateRouteConfig('history').length).toBeGreaterThan(0);
  });

  it('the full app-global surface is JSON-serializable — the whole point of the schema', () => {
    const config: RouteConfig = {
      base: '/app',
      history: 'hash',
      prerender: true,
      notFound: '/404',
      trailingSlash: 'always',
      redirects: [{ from: '/old', to: '/new', permanent: true }],
      localePrefix: { strategy: 'except-default', defaultLocale: 'en' },
      caseSensitive: true,
    };
    expect(validateRouteConfig(config)).toEqual([]);
    expect(() => JSON.stringify(config)).not.toThrow();
    expect(JSON.parse(JSON.stringify(config))).toEqual(config);
  });
});

describe('webrouting route-config per-route schema (#1732)', () => {
  for (const c of routePolicyCases) {
    it(c.title, () => {
      const errors = validateRoutePolicy(c.policy);
      if (c.valid) {
        expect(errors, `expected no violations, got: ${errors.join('; ')}`).toEqual([]);
        expect(isRoutePolicy(c.policy)).toBe(true);
      } else {
        expect(errors.length, 'expected at least one violation').toBeGreaterThan(0);
        if (c.expectViolation) {
          expect(errors.some((e) => e.includes(c.expectViolation!))).toBe(true);
        }
        expect(isRoutePolicy(c.policy)).toBe(false);
      }
    });
  }
});
