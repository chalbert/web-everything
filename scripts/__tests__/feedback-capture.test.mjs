// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { validateFeedbackEntry, prepareFeedbackPayload, sendFeedbackEntry } from '../lib/feedback-schema.mjs';

const entry = {
  schemaVersion: 1, category: 'friction',
  summary: '  The confirmation step is hard to find.  ',
  suggestion: 'Label the action "Confirm" more clearly.',
};
const payload = JSON.stringify({ ...entry, summary: entry.summary.trim() });
const cli = 'scripts/conveyor/feedback-capture.mjs';

describe('feedback capture contract', () => {
  it('validates, normalizes and sends a generalized lesson without mutating input', async () => {
    const original = structuredClone(entry);
    expect(validateFeedbackEntry(entry)).toEqual({ ok: true, errors: [], clean: JSON.parse(payload) });
    expect(prepareFeedbackPayload(entry).payload).toBe(payload);
    const send = vi.fn();
    expect(await sendFeedbackEntry(entry, { send })).toEqual({ ok: true, errors: [], sent: true });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(payload);
    expect(entry).toEqual(original);
  });

  it.each(['summary', 'suggestion'])('denies secrets in %s on both send and preview without redaction', async field => {
    const secret = 'AKIA' + '1234567890ABCDEF';
    const unsafe = { ...entry, [field]: `Consider ${secret}` };
    expect(validateFeedbackEntry(unsafe).ok).toBe(true); // Shape alone is not admission.
    for (const preview of [false, true]) {
      const send = vi.fn();
      const result = await sendFeedbackEntry(unsafe, { preview, send });
      expect(result).toMatchObject({ ok: false, sent: false, payload: null });
      expect(result.errors.join(' ')).toContain(`${field} failed scrub`);
      expect(JSON.stringify(result)).not.toContain(secret);
      expect(send).not.toHaveBeenCalled();
    }
    expect(prepareFeedbackPayload(unsafe).clean).toBeNull();
  });

  it.each([
    { code: 'example' }, { diff: 'example' }, { tenantId: 'example' },
    { summary: 'a'.repeat(241) }, { suggestion: 'a'.repeat(401) },
    { category: 'unknown' }, { schemaVersion: 2 }, { summary: '' },
    { suggestion: 12 }, { suggestion: 'first\nsecond' }, { summary: '+ added prose' },
  ])('refuses invalid schema before IO: %j', async change => {
    const send = vi.fn();
    const result = validateFeedbackEntry({ ...entry, ...change });
    expect(result).toMatchObject({ ok: false, clean: null });
    expect(result.errors.length).toBeGreaterThan(0);
    expect((await sendFeedbackEntry({ ...entry, ...change }, { send })).ok).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it('gives capped-field and allow-list reasons without echoing unknown keys', () => {
    expect(validateFeedbackEntry({ ...entry, summary: 'a'.repeat(241) }).errors).toContain('summary exceeds 240 characters');
    const result = validateFeedbackEntry({ ...entry, privateKeyName: 'private value' });
    expect(result.errors[0]).toContain('disallowed field');
    expect(JSON.stringify(result)).not.toContain('privateKeyName');
  });

  it.each([null, [], 'text', 1, new Date()])('rejects non-record inputs: %j', value => {
    expect(validateFeedbackEntry(value).ok).toBe(false);
  });

  it('rejects missing fields and accessors without evaluating them', () => {
    const getter = vi.fn(() => 'prose');
    const value = { ...entry };
    Object.defineProperty(value, 'summary', { get: getter });
    expect(validateFeedbackEntry(value).ok).toBe(false);
    expect(getter).not.toHaveBeenCalled();
    expect(validateFeedbackEntry({}).ok).toBe(false);
  });

  it.each(['const value = 1', '```snippet```', '/Users/example/private', 'src/private.ts',
    'person@example.com', '--- old\n+++ new\n@@ -1 +1 @@'])('denies code, paths, PII and diff pastes: %s', text => {
    const result = prepareFeedbackPayload({ ...entry, suggestion: text });
    expect(result).toMatchObject({ ok: false, clean: null, payload: null });
  });

  it('previews exact bytes, never sends, and rechecks edits before transmission', async () => {
    const send = vi.fn();
    const preview = await sendFeedbackEntry(entry, { preview: true, send });
    expect(preview).toEqual({ ok: true, errors: [], sent: false, payload });
    expect(send).not.toHaveBeenCalled();
    await sendFeedbackEntry(entry, { send });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(preview.payload);
    send.mockClear();
    expect((await sendFeedbackEntry({ ...entry, summary: '/Users/example/private' }, { send })).ok).toBe(false);
    expect(send).not.toHaveBeenCalled();
    expect(await sendFeedbackEntry(entry, { preview: true })).toEqual(preview);
  });

  it('requires a transport and propagates transport failure without retry', async () => {
    await expect(sendFeedbackEntry(entry)).rejects.toThrow('transport callback');
    await expect(sendFeedbackEntry(entry, { preview: 'true' })).rejects.toThrow('boolean');
    const send = vi.fn().mockRejectedValue(new Error('offline'));
    await expect(sendFeedbackEntry(entry, { send })).rejects.toThrow('offline');
    expect(send).toHaveBeenCalledTimes(1);
  });
});

describe('feedback CLI subprocess', () => {
  it('defaults to status only and opt-in preview emits exact payload bytes', () => {
    const options = { input: JSON.stringify(entry), encoding: 'utf8' };
    expect(JSON.parse(execFileSync(process.execPath, [cli], options))).toEqual({ ok: true, errors: [] });
    expect(execFileSync(process.execPath, [cli, '--preview'], options)).toBe(payload);
  });

  it.each([
    [[], '{invalid'], [['--send'], JSON.stringify(entry)],
    [['--preview'], JSON.stringify({ ...entry, summary: 'AKIA' + '1234567890ABCDEF' })],
  ])('exits nonzero for invalid or denied input', (args, input) => {
    const result = spawnSync(process.execPath, [cli, ...args], { input, encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout).ok).toBe(false);
    expect(result.stdout).not.toContain('1234567890ABCDEF');
  });
});
