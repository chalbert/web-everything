/**
 * @file scripts/__tests__/sweep-reference-liveness.test.mjs
 * @description Unit harness for the reference-liveness sweep (#585). The classifier is a pure
 * function (ref + probe → class) and the sweep runner takes an injectable fetch, so the full
 * multi-modal classification pipeline is exercised OFFLINE and deterministically — no network, no
 * clock. Each health class gets a fixture; the marker-precedence and content-drift rules (the two
 * with the subtlest priority) get the most cases.
 */
import { describe, it, expect } from 'vitest';
import { classify, runSweep, LIVENESS_CLASSES } from '../sweep-reference-liveness.mjs';

const ref = (over = {}) => ({ url: 'https://example.com/doc', home: 'corpus', sourceId: 'x', label: 'X', ...over });
const probe = (over = {}) => ({ status: 200, finalUrl: 'https://example.com/doc', redirected: false, error: null, ...over });

describe('classify — HTTP-driven classes', () => {
  it('200 with no redirect is live', () => {
    expect(classify(ref(), probe()).class).toBe('live');
  });
  it('404 / 410 is gone', () => {
    expect(classify(ref(), probe({ status: 404 })).class).toBe('gone');
    expect(classify(ref(), probe({ status: 410 })).class).toBe('gone');
  });
  it('401 / 403 is paywall', () => {
    expect(classify(ref(), probe({ status: 401 })).class).toBe('paywall');
    expect(classify(ref(), probe({ status: 403 })).class).toBe('paywall');
  });
  it('5xx is server-error (transient, not retirement)', () => {
    expect(classify(ref(), probe({ status: 503 })).class).toBe('server-error');
  });
  it('a cross-host redirect is moved', () => {
    const v = classify(ref(), probe({ redirected: true, finalUrl: 'https://newsite.io/doc' }));
    expect(v.class).toBe('moved');
    expect(v.finalUrl).toBe('https://newsite.io/doc');
  });
  it('a same-host redirect (e.g. trailing slash) stays live, not moved', () => {
    expect(classify(ref(), probe({ redirected: true, finalUrl: 'https://example.com/doc/' })).class).toBe('live');
  });
  it('a redirect to an archive host is archived, not moved', () => {
    const v = classify(ref(), probe({ redirected: true, finalUrl: 'https://web.archive.org/web/2020/https://example.com/doc' }));
    expect(v.class).toBe('archived');
  });
});

describe('classify — transport failures', () => {
  it('a fetch error is unreachable', () => {
    expect(classify(ref(), probe({ error: 'ENOTFOUND', status: null })).class).toBe('unreachable');
  });
  it('a timeout is unreachable', () => {
    expect(classify(ref(), probe({ error: 'timeout', status: null })).class).toBe('unreachable');
  });
});

describe('classify — curated markers win over the live probe (#584)', () => {
  it('a supersededBy marker classifies superseded even if the old URL still 200s', () => {
    const v = classify(ref({ supersededBy: 'fluent-ui' }), probe({ status: 200 }));
    expect(v.class).toBe('superseded');
    expect(v.detail).toContain('fluent-ui');
  });
  it('a retired:true marker classifies retired even on a 200', () => {
    const v = classify(ref({ retired: true, retiredReason: 'folded into Fluent' }), probe({ status: 200 }));
    expect(v.class).toBe('retired');
    expect(v.detail).toContain('folded into Fluent');
  });
});

describe('classify — content-drift only against a pinned baseline (#862)', () => {
  it('without a baseline a 200 is live (drift unknowable)', () => {
    expect(classify(ref(), probe({ bodyHash: 'abc' }), {}).class).toBe('live');
  });
  it('a matching baseline is live', () => {
    expect(classify(ref(), probe({ bodyHash: 'abc' }), { baselineHash: 'abc' }).class).toBe('live');
  });
  it('a diverged baseline is content-drift', () => {
    expect(classify(ref(), probe({ bodyHash: 'xyz' }), { baselineHash: 'abc' }).class).toBe('content-drift');
  });
});

describe('runSweep — full pipeline with injected fetch', () => {
  const stub = (map) => async (url) => {
    const r = map[url];
    if (r?.throw) throw new Error(r.throw);
    return { status: r?.status ?? 200, url: r?.finalUrl ?? url, redirected: !!r?.redirected };
  };

  it('classifies a mixed corpus, never probes marker-only rows, and tallies summary', async () => {
    let probed = [];
    const fetchImpl = (url, opts) => { probed.push(url); return stub({
      'https://live.com/': { status: 200 },
      'https://dead.com/': { status: 404 },
      'https://moved.com/': { status: 200, redirected: true, finalUrl: 'https://elsewhere.org/' },
    })(url, opts); };

    const refs = [
      ref({ url: 'https://live.com/' }),
      ref({ url: 'https://dead.com/' }),
      ref({ url: 'https://moved.com/' }),
      ref({ url: 'https://old.com/', supersededBy: 'new-thing' }), // marker-only: must NOT be fetched
    ];
    const report = await runSweep(refs, { fetchImpl, concurrency: 2, generatedAt: 'FIXED' });

    expect(report.generatedAt).toBe('FIXED'); // clock is injected, not read
    expect(report.summary.total).toBe(4);
    expect(report.summary.byClass.live).toBe(1);
    expect(report.summary.byClass.gone).toBe(1);
    expect(report.summary.byClass.moved).toBe(1);
    expect(report.summary.byClass.superseded).toBe(1);
    expect(probed).not.toContain('https://old.com/'); // skipProbe honoured
    // every byClass key is a known class
    expect(Object.keys(report.summary.byClass).every((c) => LIVENESS_CLASSES.includes(c))).toBe(true);
  });

  it('a thrown fetch becomes unreachable, not a crash', async () => {
    const fetchImpl = stub({ 'https://flaky.com/': { throw: 'ECONNRESET' } });
    const report = await runSweep([ref({ url: 'https://flaky.com/' })], { fetchImpl });
    expect(report.summary.byClass.unreachable).toBe(1);
  });
});
