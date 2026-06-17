/**
 * @file scripts/__tests__/pin-reference-snapshots.test.mjs
 * @description Unit harness for archive-on-cite snapshot pinning (#862). The hash, the Wayback
 * response parse, and the idempotent merge are pure, so the full pin loop is exercised offline with a
 * stub probe — no network. The idempotence guarantee (an existing pin never moves) gets the most cases,
 * since a drifting baseline would silently break the #585 content-drift comparison.
 */
import { describe, it, expect } from 'vitest';
import { hashBody, parseArchiveResponse, archiveLookupUrl, pinReferences } from '../pin-reference-snapshots.mjs';

const ref = (url, over = {}) => ({ url, home: 'corpus', sourceId: 's', ...over });

describe('hashBody', () => {
  it('is stable and whitespace-insensitive (trivial reflow is not drift)', () => {
    expect(hashBody('hello   world')).toBe(hashBody('hello world'));
    expect(hashBody('  hello world\n')).toBe(hashBody('hello world'));
  });
  it('moves when the actual content changes', () => {
    expect(hashBody('hello world')).not.toBe(hashBody('hello mars'));
  });
  it('is prefixed for self-description', () => {
    expect(hashBody('x')).toMatch(/^sha256:[0-9a-f]{64}$/);
  });
});

describe('parseArchiveResponse', () => {
  it('returns the closest available snapshot url', () => {
    const json = { archived_snapshots: { closest: { available: true, url: 'https://web.archive.org/web/2020/https://x.com/' } } };
    expect(parseArchiveResponse(json)).toContain('web.archive.org');
  });
  it('returns null when no snapshot exists', () => {
    expect(parseArchiveResponse({ archived_snapshots: {} })).toBeNull();
    expect(parseArchiveResponse({})).toBeNull();
    expect(parseArchiveResponse({ archived_snapshots: { closest: { available: false } } })).toBeNull();
  });
  it('archiveLookupUrl encodes the target', () => {
    expect(archiveLookupUrl('https://x.com/a b')).toContain(encodeURIComponent('https://x.com/a b'));
  });
});

describe('pinReferences — pin loop', () => {
  const probeOk = async (url) => ({ ok: true, bodyHash: hashBody('body of ' + url), contentLength: 10, archiveUrl: 'https://web.archive.org/x' });

  it('pins new URLs with hash + archive + timestamp', async () => {
    const { store, pinned } = await pinReferences([ref('https://a/'), ref('https://b/')], { probe: probeOk, now: 'T0' });
    expect(pinned).toEqual(['https://a/', 'https://b/']);
    expect(store['https://a/'].hash).toBe(hashBody('body of https://a/'));
    expect(store['https://a/'].archiveUrl).toBe('https://web.archive.org/x');
    expect(store['https://a/'].pinnedAt).toBe('T0');
  });

  it('is idempotent — an existing pin is left untouched and not re-probed', async () => {
    const existing = { 'https://a/': { url: 'https://a/', hash: 'sha256:OLD', pinnedAt: 'T0' } };
    let probed = [];
    const probe = async (url) => { probed.push(url); return probeOk(url); };
    const { store, pinned, skipped } = await pinReferences([ref('https://a/'), ref('https://b/')], { existing, probe, now: 'T1' });
    expect(probed).toEqual(['https://b/']);            // a/ not re-probed
    expect(store['https://a/'].hash).toBe('sha256:OLD'); // baseline never moved
    expect(pinned).toEqual(['https://b/']);
    expect(skipped).toEqual(['https://a/']);
  });

  it('--repin forces a baseline refresh for the named URL only', async () => {
    const existing = { 'https://a/': { url: 'https://a/', hash: 'sha256:OLD', pinnedAt: 'T0' } };
    const { store } = await pinReferences([ref('https://a/')], { existing, probe: probeOk, now: 'T2', repin: new Set(['https://a/']) });
    expect(store['https://a/'].hash).toBe(hashBody('body of https://a/'));
    expect(store['https://a/'].pinnedAt).toBe('T2');
  });

  it('respects --limit and records failures without crashing', async () => {
    const probe = async (url) => (url.includes('bad') ? { ok: false, error: 'HTTP 500' } : probeOk(url));
    const { pinned, skipped, failed } = await pinReferences(
      [ref('https://1/'), ref('https://bad/'), ref('https://2/')], { probe, now: 'T', limit: 2 });
    expect(failed).toEqual(['https://bad/']);
    expect(pinned).toEqual(['https://1/']);   // limit=2 consumed by 1/ + bad/ (both attempted)
    expect(skipped).toContain('https://2/');  // over limit
  });
});
