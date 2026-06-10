/**
 * @file scripts/readiness/__tests__/model-proposer.test.mjs
 * @description Resilience proof for the BYO-key model proposer (#253).
 *
 * The #252 model provider called the Messages API with a single `fetch` and no retry, so a transient
 * `429`/`529`/`5xx` during a backlog-wide sweep dropped that item to a "provider error" give-up. These
 * tests pin the #253 fix straight onto its acceptance criteria, with an injected fake `fetch` + an
 * instant `sleep` so nothing touches the network or waits real wall-clock:
 *   - a simulated 429 is RETRIED (then succeeds), not immediately recorded as a give-up;
 *   - a terminal 400 is NOT retried — it fails fast (one call), preserving the give-up path;
 *   - `Retry-After` is honored over the default backoff schedule.
 */
import { describe, it, expect } from 'vitest';
import { createModelProposer, fetchWithRetry, retryAfterMs } from '../model-proposer.mjs';

/** A Response-ish stand-in: enough surface for fetchWithRetry + the proposer body parsing. */
const res = (status, { body = '{}', headers = {} } = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (k) => headers[k.toLowerCase()] ?? null },
  text: async () => body,
  json: async () => JSON.parse(body),
});

/** A fetch stub that returns the next queued response per call, recording how many times it was hit. */
const queuedFetch = (responses) => {
  let i = 0;
  const fn = async () => responses[Math.min(i++, responses.length - 1)];
  fn.calls = () => i;
  return fn;
};

const noSleep = async () => {}; // collapse backoff waits so tests run instantly
const candidate = { title: 'T', summary: '', body: 'b', gaps: ['acceptance-criteria', 'file-paths'] };
const okBody = JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({ criteria: ['c'], paths: ['p'], rationale: 'r' }) }] });

describe('fetchWithRetry (#253) — bounded backoff on transient failures', () => {
  it('retries a 429 and returns the eventual success', async () => {
    const fetchImpl = queuedFetch([res(429), res(429), res(200, { body: okBody })]);
    const resp = await fetchWithRetry('u', {}, { fetchImpl, sleep: noSleep });
    expect(resp.status).toBe(200);
    expect(fetchImpl.calls()).toBe(3); // two retries, then success
  });

  it('retries a 529 overloaded / 5xx', async () => {
    const fetchImpl = queuedFetch([res(529), res(503), res(200, { body: okBody })]);
    const resp = await fetchWithRetry('u', {}, { fetchImpl, sleep: noSleep });
    expect(resp.status).toBe(200);
    expect(fetchImpl.calls()).toBe(3);
  });

  it('does NOT retry a terminal 400 — fails fast in a single call', async () => {
    const fetchImpl = queuedFetch([res(400), res(200, { body: okBody })]);
    const resp = await fetchWithRetry('u', {}, { fetchImpl, sleep: noSleep });
    expect(resp.status).toBe(400); // returned as-is, caller throws the give-up
    expect(fetchImpl.calls()).toBe(1);
  });

  it('does NOT retry a 401/403 (bad/forbidden key)', async () => {
    for (const status of [401, 403]) {
      const fetchImpl = queuedFetch([res(status), res(200, { body: okBody })]);
      const resp = await fetchWithRetry('u', {}, { fetchImpl, sleep: noSleep });
      expect(resp.status).toBe(status);
      expect(fetchImpl.calls()).toBe(1);
    }
  });

  it('gives up after the max-attempts cap and returns the last response', async () => {
    const fetchImpl = queuedFetch([res(429), res(429), res(429), res(429), res(429)]);
    const resp = await fetchWithRetry('u', {}, { fetchImpl, sleep: noSleep, maxAttempts: 3 });
    expect(resp.status).toBe(429);
    expect(fetchImpl.calls()).toBe(3); // capped, not infinite
  });

  it('retries a thrown network error, then re-throws once exhausted', async () => {
    let n = 0;
    const fetchImpl = async () => { n++; throw new Error('ECONNRESET'); };
    await expect(fetchWithRetry('u', {}, { fetchImpl, sleep: noSleep, maxAttempts: 2 })).rejects.toThrow('ECONNRESET');
    expect(n).toBe(2);
  });

  it('honors a Retry-After header over the default backoff', async () => {
    const waits = [];
    const fetchImpl = queuedFetch([res(429, { headers: { 'retry-after': '2' } }), res(200, { body: okBody })]);
    await fetchWithRetry('u', {}, { fetchImpl, sleep: async (ms) => waits.push(ms), now: () => 0 });
    expect(waits).toEqual([2000]); // 2s from the header, not the 500ms base
  });
});

describe('retryAfterMs — delta-seconds or HTTP-date', () => {
  it('parses delta-seconds', () => expect(retryAfterMs('3')).toBe(3000));
  it('parses an HTTP-date relative to now', () => expect(retryAfterMs(new Date(5000).toUTCString(), 0)).toBe(5000));
  it('returns null for absent or garbage', () => {
    expect(retryAfterMs(null)).toBeNull();
    expect(retryAfterMs('soon')).toBeNull();
  });
  it('clamps a past date to 0', () => expect(retryAfterMs(new Date(0).toUTCString(), 10_000)).toBe(0));
});

describe('createModelProposer (#252/#253) — integration over the retrying fetch', () => {
  it('survives a transient 429 and returns the parsed draft instead of a give-up', async () => {
    const fetchImpl = queuedFetch([res(429), res(200, { body: okBody })]);
    const proposer = createModelProposer('key', { fetchImpl, sleep: noSleep });
    const draft = await proposer.propose(candidate);
    expect(draft).toEqual({ criteria: ['c'], paths: ['p'], rationale: 'r' });
  });

  it('throws (records a give-up) on a terminal 400 without retrying', async () => {
    const fetchImpl = queuedFetch([res(400, { body: 'bad request' })]);
    const proposer = createModelProposer('key', { fetchImpl, sleep: noSleep });
    await expect(proposer.propose(candidate)).rejects.toThrow('API 400');
    expect(fetchImpl.calls()).toBe(1);
  });
});
