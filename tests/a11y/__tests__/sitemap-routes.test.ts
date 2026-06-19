import { describe, it, expect } from 'vitest';
import { deriveScopeCRoutes, ENFORCED_ROUTES } from '../sitemap-routes';

describe('deriveScopeCRoutes — scope-C filter over sitemap pathnames (#847/#774)', () => {
  const sitemap = [
    '/',
    '/intents/',
    '/blocks/',
    '/mission/',
    '/intents/motion/',
    '/intents/loading/',
    '/blocks/accordion/',
    '/blocks/wizard/',
    '/backlog/846-sitemap/',
    '/backlog/100-foo/',
    '/cases/for-each/01-basic/',
    '/cases/accordion/01-standard/',
  ];
  const routes = deriveScopeCRoutes(sitemap);

  it('keeps every index surface (root + single-segment pages)', () => {
    expect(routes).toEqual(expect.arrayContaining(['/', '/intents/', '/blocks/', '/mission/']));
  });

  it('keeps exactly one representative detail page per path-prefix group', () => {
    const details = routes.filter((r) => r.replace(/^\/|\/$/g, '').split('/').length >= 2);
    const groups = details.map((r) => r.split('/')[1]);
    expect(new Set(groups).size).toBe(groups.length); // no group appears twice
    expect(new Set(groups)).toEqual(new Set(['intents', 'blocks', 'backlog', 'cases']));
  });

  it('picks the lexicographically-first detail per group (deterministic)', () => {
    expect(routes).toContain('/backlog/100-foo/'); // not /backlog/846-…/
    expect(routes).toContain('/blocks/accordion/'); // not /blocks/wizard/
    expect(routes).toContain('/cases/accordion/01-standard/'); // not /cases/for-each/…
  });

  it('normalizes missing trailing slashes and returns a sorted, de-duped list', () => {
    const out = deriveScopeCRoutes(['/blocks', '/blocks/', '/blocks/x']);
    expect(out).toEqual(['/blocks/', '/blocks/x/']);
  });

  it('ignores non-absolute / empty entries', () => {
    expect(deriveScopeCRoutes(['', 'https://x.dev/y', '/ok/'])).toEqual(['/ok/']);
  });

  it('seeds the 10 #793/#805-enforced index surfaces', () => {
    expect(ENFORCED_ROUTES.has('/')).toBe(true);
    expect(ENFORCED_ROUTES.has('/backlog/')).toBe(true);
    expect(ENFORCED_ROUTES.size).toBe(10);
  });
});
