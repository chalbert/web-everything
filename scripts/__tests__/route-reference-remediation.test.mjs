/**
 * @file scripts/__tests__/route-reference-remediation.test.mjs
 * @description Unit harness for the reference-remediation router (#861). The routing decision is a
 * pure function (classified results + known-URL set → actions/skipped), so the full class→remediation
 * mapping, the actionable/non-actionable split, and the idempotent dedup are tested offline with
 * synthetic sweep rows — no backlog writes, no network.
 */
import { describe, it, expect } from 'vitest';
import { routeRemediations, REMEDIATION_ROUTES } from '../route-reference-remediation.mjs';

const res = (over = {}) => ({ url: 'https://x.com/', home: 'corpus', sourceId: 's', label: 'S', class: 'live', status: 200, finalUrl: 'https://x.com/', detail: 'ok', ...over });

describe('routeRemediations — class → action mapping', () => {
  it('files an item for each actionable class with the mapped action', () => {
    const results = [
      res({ url: 'https://gone.com/', class: 'gone', detail: 'HTTP 404' }),
      res({ url: 'https://moved.com/', class: 'moved', finalUrl: 'https://new.com/' }),
      res({ url: 'https://arch.com/', class: 'archived' }),
      res({ url: 'https://drift.com/', class: 'content-drift' }),
      res({ url: 'https://sup.com/', class: 'superseded', detail: 'supersededBy fluent' }),
    ];
    const { actions } = routeRemediations(results, new Set());
    expect(actions.map((a) => a.action)).toEqual([
      'retire-and-replace', 'update-url', 'rehome-from-archive', 're-verify-citation', 'swap-to-canonical',
    ]);
    // each action carries a self-describing title + a digest with the dedup marker
    for (const a of actions) {
      expect(a.title).toBeTruthy();
      expect(a.digest).toContain(`remediation-for: ${a.url}`);
    }
  });

  it('does NOT file non-actionable classes, with a reason', () => {
    const results = [
      res({ url: 'https://a/', class: 'live' }),
      res({ url: 'https://b/', class: 'paywall' }),
      res({ url: 'https://c/', class: 'unreachable' }),
      res({ url: 'https://d/', class: 'server-error' }),
      res({ url: 'https://e/', class: 'retired' }),
    ];
    const { actions, skipped } = routeRemediations(results, new Set());
    expect(actions).toHaveLength(0);
    expect(skipped).toHaveLength(5);
    expect(skipped.every((s) => typeof s.reason === 'string' && s.reason.length)).toBe(true);
  });

  it('the moved digest names the redirect target', () => {
    const { actions } = routeRemediations([res({ url: 'https://old/', class: 'moved', finalUrl: 'https://new/' })]);
    expect(actions[0].digest).toContain('https://new/');
  });
});

describe('routeRemediations — idempotent dedup', () => {
  it('skips a URL that already has a remediation-for marker', () => {
    const results = [res({ url: 'https://gone.com/', class: 'gone' })];
    const { actions, skipped } = routeRemediations(results, new Set(['https://gone.com/']));
    expect(actions).toHaveLength(0);
    expect(skipped[0].reason).toMatch(/already filed/);
  });

  it('a second run over the same report files nothing new (simulated)', () => {
    const results = [res({ url: 'https://gone.com/', class: 'gone' }), res({ url: 'https://ok.com/', class: 'live' })];
    const first = routeRemediations(results, new Set());
    expect(first.actions).toHaveLength(1);
    // after filing, its URL is now known → second pass is empty
    const known = new Set(first.actions.map((a) => a.url));
    const second = routeRemediations(results, known);
    expect(second.actions).toHaveLength(0);
  });
});

describe('REMEDIATION_ROUTES — contract', () => {
  it('every actionable route has action + title + digest functions', () => {
    for (const [cls, route] of Object.entries(REMEDIATION_ROUTES)) {
      if (route.act) {
        expect(typeof route.action).toBe('string');
        expect(typeof route.title).toBe('function');
        expect(typeof route.digest).toBe('function');
      } else {
        expect(typeof route.reason).toBe('string');
      }
    }
  });
});
