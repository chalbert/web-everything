// Tests for the quarantined-frame archival (backlog #489): the gate retains every judged-non-app
// frame with its verdict as a content-addressed, append-only labeled negative for the on-device
// classifier distillation set (#488) — kept off the browse page. Proves content-addressing,
// idempotency, and that the visionVerdict join is materialised on disk. No browser/model needed.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { archiveQuarantinedFrame } from '../../design-refs.mjs';

const HASH = 'a'.repeat(64);
const WEBP = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]); // RIFF…WEBP-ish bytes
const record = {
  contentHash: HASH,
  sourceUrl: 'https://example.com/marketing',
  captureMethod: 'playwright',
  visionVerdict: { verdict: 'marketing', provider: 'mock', reasons: ['hero + CTA, no app chrome'], at: '2026-06-13T00:00:00.000Z' },
};

let root;
beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'design-refs-quarantine-')); });
afterEach(() => { rmSync(root, { recursive: true, force: true }); });

describe('archiveQuarantinedFrame', () => {
  it('writes a content-addressed {screenshot.webp, meta.json} pair', () => {
    const wrote = archiveQuarantinedFrame(HASH, WEBP, record, root);
    expect(wrote).toBe(true);
    const dir = join(root, HASH);
    expect(existsSync(join(dir, 'screenshot.webp'))).toBe(true);
    expect(existsSync(join(dir, 'meta.json'))).toBe(true);
    // The webp bytes round-trip unchanged.
    expect(readFileSync(join(dir, 'screenshot.webp')).equals(WEBP)).toBe(true);
  });

  it('materialises the visionVerdict join on disk', () => {
    archiveQuarantinedFrame(HASH, WEBP, record, root);
    const meta = JSON.parse(readFileSync(join(root, HASH, 'meta.json'), 'utf8'));
    expect(meta.visionVerdict.verdict).toBe('marketing');
    expect(meta.visionVerdict.provider).toBe('mock');
    expect(meta.visionVerdict.reasons).toEqual(['hero + CTA, no app chrome']);
    expect(meta.sourceUrl).toBe('https://example.com/marketing');
  });

  it('is idempotent — a re-run with the same hash does not churn or rewrite', () => {
    expect(archiveQuarantinedFrame(HASH, WEBP, record, root)).toBe(true);
    // A second call (e.g. the same frame re-judged on a later run) is a no-op.
    expect(archiveQuarantinedFrame(HASH, Buffer.from([0xff]), { ...record, sourceUrl: 'changed' }, root)).toBe(false);
    // The original bytes + meta are untouched (append-only).
    expect(readFileSync(join(root, HASH, 'screenshot.webp')).equals(WEBP)).toBe(true);
    expect(JSON.parse(readFileSync(join(root, HASH, 'meta.json'), 'utf8')).sourceUrl).toBe('https://example.com/marketing');
  });

  it('content-addresses by hash — distinct frames land in distinct dirs', () => {
    const HASH2 = 'b'.repeat(64);
    archiveQuarantinedFrame(HASH, WEBP, record, root);
    archiveQuarantinedFrame(HASH2, WEBP, { ...record, contentHash: HASH2, visionVerdict: { ...record.visionVerdict, verdict: 'blank' } }, root);
    expect(existsSync(join(root, HASH))).toBe(true);
    expect(existsSync(join(root, HASH2))).toBe(true);
    expect(JSON.parse(readFileSync(join(root, HASH2, 'meta.json'), 'utf8')).visionVerdict.verdict).toBe('blank');
  });
});
