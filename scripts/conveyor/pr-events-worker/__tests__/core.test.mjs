/**
 * @file The PR-events receiver core: signature verification (incl. GitHub's published test vector), event
 * parsing (kept/ignored, no user text stored), cursor semantics, and the HTTP routing + fail-closed auth.
 */
import { describe, it, expect } from 'vitest';
import {
  verifySignature, signBody, parseGithubEvent, createEventLog, createMemoryStorage, handleRequest, timingSafeEqual,
} from '../core.mjs';

const REPO = { full_name: 'chalbert/web-everything' };

describe('verifySignature', () => {
  it('matches GitHub\'s documented test vector', async () => {
    // docs.github.com "Validating webhook deliveries" — secret + payload → expected header.
    const header = 'sha256=757107ea0eb2509fc211221cce984b8a37570b6d7586c22c46f4379c8b043e17';
    expect(await verifySignature("It's a Secret to Everybody", 'Hello, World!', header)).toBe(true);
    expect(await signBody("It's a Secret to Everybody", 'Hello, World!')).toBe(header);
  });

  it('rejects a tampered body, a wrong secret, a malformed or missing header, and a missing secret', async () => {
    const good = await signBody('s3cret', '{"a":1}');
    expect(await verifySignature('s3cret', '{"a":1}', good)).toBe(true);
    expect(await verifySignature('s3cret', '{"a":2}', good)).toBe(false);
    expect(await verifySignature('other', '{"a":1}', good)).toBe(false);
    expect(await verifySignature('s3cret', '{"a":1}', good.replace('sha256=', 'sha1='))).toBe(false);
    expect(await verifySignature('s3cret', '{"a":1}', null)).toBe(false);
    expect(await verifySignature('', '{"a":1}', good)).toBe(false);
  });

  it('verifies over raw bytes, identical to the string form', async () => {
    const bytes = new TextEncoder().encode('{"x":"é"}');
    expect(await verifySignature('k', bytes, await signBody('k', '{"x":"é"}'))).toBe(true);
  });

  it('timingSafeEqual compares exactly', () => {
    expect(timingSafeEqual('abc', 'abc')).toBe(true);
    expect(timingSafeEqual('abc', 'abd')).toBe(false);
    expect(timingSafeEqual('abc', 'abcd')).toBe(false);
  });
});

describe('parseGithubEvent', () => {
  const at = Date.parse('2026-09-27T12:00:00Z');
  it('keeps pull_request lifecycle actions with ids only — never title/body/login', () => {
    const r = parseGithubEvent('pull_request', {
      action: 'labeled', number: 12, label: { name: 'review:pending' }, repository: REPO,
      pull_request: { number: 12, title: 'SECRET TITLE', body: 'SECRET BODY', head: { sha: 'abc' }, user: { login: 'someone' } },
      sender: { login: 'someone' },
    }, { deliveryId: 'd1', receivedAt: at });
    expect(r).toEqual({ id: 'd1', at: '2026-09-27T12:00:00.000Z', type: 'pull_request', action: 'labeled', repo: 'chalbert/web-everything', prs: [12], sha: 'abc', label: 'review:pending' });
    expect(JSON.stringify(r)).not.toMatch(/SECRET|someone/);
  });

  it('records merged on closed and the check conclusion/name on check events', () => {
    expect(parseGithubEvent('pull_request', { action: 'closed', number: 3, repository: REPO, pull_request: { merged: true, head: { sha: 'h' } } }).merged).toBe(true);
    const cr = parseGithubEvent('check_run', { action: 'completed', repository: REPO, check_run: { name: 'test', head_sha: 'h', conclusion: 'failure', pull_requests: [{ number: 3 }] } });
    expect(cr).toMatchObject({ type: 'check_run', prs: [3], sha: 'h', conclusion: 'failure', name: 'test' });
    const cs = parseGithubEvent('check_suite', { action: 'completed', repository: REPO, check_suite: { head_sha: 'h', conclusion: 'success', app: { slug: 'github-actions' }, pull_requests: [] } });
    expect(cs).toMatchObject({ type: 'check_suite', prs: [], conclusion: 'success', app: 'github-actions' });
    const rv = parseGithubEvent('pull_request_review', { action: 'submitted', repository: REPO, pull_request: { number: 3 }, review: { state: 'CHANGES_REQUESTED', commit_id: 'h', body: 'x' } });
    expect(rv).toMatchObject({ type: 'pull_request_review', prs: [3], state: 'changes_requested' });
  });

  it('ignores events and actions outside the accepted set', () => {
    expect(parseGithubEvent('pull_request', { action: 'edited', number: 1, repository: REPO, pull_request: {} })).toBeNull();
    expect(parseGithubEvent('check_run', { action: 'created', repository: REPO, check_run: {} })).toBeNull();
    expect(parseGithubEvent('issues', { action: 'opened', repository: REPO })).toBeNull();
    expect(parseGithubEvent('ping', { zen: 'x', repository: REPO })).toBeNull();
    expect(parseGithubEvent('pull_request', { action: 'opened', number: 1 })).toBeNull(); // no repository
  });
});

describe('event log cursor semantics', () => {
  const rec = (i) => ({ id: `d${i}`, type: 'pull_request', action: 'opened', repo: 'r', prs: [i] });

  it('a fresh reader (no cursor) starts at head with no replay', () => {
    const log = createEventLog(createMemoryStorage());
    log.append(rec(1), 1000); log.append(rec(2), 2000);
    expect(log.read(null)).toMatchObject({ cursor: 2, events: [], reset: true, head: 2 });
  });

  it('returns only seq > cursor, oldest first, strictly increasing', () => {
    const log = createEventLog(createMemoryStorage());
    for (let i = 1; i <= 5; i += 1) log.append(rec(i), i * 1000);
    const r = log.read(2);
    expect(r.events.map((e) => e.seq)).toEqual([3, 4, 5]);
    expect(r).toMatchObject({ cursor: 5, gap: false, reset: false, more: false, lastEventAt: 5000, lastDeliveryAt: 5000 });
    expect(log.read(5)).toMatchObject({ cursor: 5, events: [] });
  });

  it('pages with `more` when the limit cuts the answer short', () => {
    const log = createEventLog(createMemoryStorage());
    for (let i = 1; i <= 5; i += 1) log.append(rec(i), i);
    const p1 = log.read(0, 2);
    expect(p1.events.map((e) => e.seq)).toEqual([1, 2]);
    expect(p1.more).toBe(true);
    const p2 = log.read(p1.cursor, 2);
    expect(p2.events.map((e) => e.seq)).toEqual([3, 4]);
    expect(log.read(p2.cursor, 2)).toMatchObject({ cursor: 5, more: false });
  });

  it('stores a redelivery (same delivery id) once, but still counts it as a delivery', () => {
    const log = createEventLog(createMemoryStorage());
    expect(log.append(rec(1), 1000)).toEqual({ seq: 1, duplicate: false });
    expect(log.append(rec(1), 9000)).toEqual({ seq: null, duplicate: true });
    expect(log.read(0)).toMatchObject({ head: 1, lastDeliveryAt: 9000, lastEventAt: 1000 });
  });

  it('flags a gap when events the reader never saw were pruned, and never reuses a seq', () => {
    const log = createEventLog(createMemoryStorage(), { maxEvents: 3 });
    for (let i = 1; i <= 6; i += 1) log.append(rec(i), i);
    const r = log.read(1);
    expect(r.gap).toBe(true);
    expect(r.events.map((e) => e.seq)).toEqual([4, 5, 6]);
    expect(log.read(3).gap).toBe(false); // 3 = oldest-1: nothing missed
    log.append(rec(7), 7);
    expect(log.read(6).events.map((e) => e.seq)).toEqual([7]);
  });

  it('prunes by age too', () => {
    const log = createEventLog(createMemoryStorage(), { retentionMs: 120 }); // cutoff at t=160 is 40
    log.append(rec(1), 0); log.append(rec(2), 50); log.append(rec(3), 160);
    expect(log.read(0).events.map((e) => e.seq)).toEqual([2, 3]);
  });

  it('a cursor beyond head (log recreated) answers reset', () => {
    const log = createEventLog(createMemoryStorage());
    log.append(rec(1), 1);
    expect(log.read(99)).toMatchObject({ cursor: 1, events: [], reset: true });
  });
});

describe('handleRequest', () => {
  const env = { GITHUB_WEBHOOK_SECRET: 'whsec', PR_EVENTS_READ_TOKEN: 'readtok' };
  const setup = () => { const log = createEventLog(createMemoryStorage()); return { log, opts: { getLog: () => log, now: () => 1_000 } }; };
  const hook = async (body, { event = 'pull_request', delivery = 'd1', secret = 'whsec' } = {}) => {
    const raw = JSON.stringify(body);
    return new Request('https://x/github/webhook', { method: 'POST', body: raw, headers: { 'x-github-event': event, 'x-github-delivery': delivery, 'x-hub-signature-256': await signBody(secret, raw) } });
  };
  const opened = { action: 'opened', number: 7, repository: REPO, pull_request: { number: 7, head: { sha: 's' } } };

  it('stores a signed accepted event (202) and ignores a signed ping (200, counted as a delivery)', async () => {
    const { log, opts } = setup();
    const r = await handleRequest(await hook(opened), env, opts);
    expect(r.status).toBe(202);
    expect(await r.json()).toMatchObject({ stored: true, seq: 1 });
    const p = await handleRequest(await hook({ zen: 'z', repository: REPO }, { event: 'ping', delivery: 'p1' }), env, opts);
    expect(p.status).toBe(200);
    expect(log.read(0).events).toHaveLength(1);
  });

  it('refuses a bad signature (401) and fails closed when the secret is not configured (503)', async () => {
    const { log, opts } = setup();
    expect((await handleRequest(await hook(opened, { secret: 'wrong' }), env, opts)).status).toBe(401);
    expect((await handleRequest(await hook(opened), { ...env, GITHUB_WEBHOOK_SECRET: undefined }, opts)).status).toBe(503);
    expect(log.read(0).events).toHaveLength(0);
  });

  it('serves /events only with the read token, never with the webhook secret', async () => {
    const { opts } = setup();
    await handleRequest(await hook(opened), env, opts);
    const get = (auth) => handleRequest(new Request('https://x/events?cursor=0', { headers: auth ? { authorization: auth } : {} }), env, opts);
    expect((await get(null)).status).toBe(401);
    expect((await get('Bearer whsec')).status).toBe(401);
    const ok = await get('Bearer readtok');
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ cursor: 1, events: [{ seq: 1, prs: [7] }] });
    expect((await handleRequest(new Request('https://x/events'), { ...env, PR_EVENTS_READ_TOKEN: '' }, opts)).status).toBe(503);
  });

  it('answers /health without data and 404 elsewhere', async () => {
    const { opts } = setup();
    expect(await (await handleRequest(new Request('https://x/health'), {}, opts)).json()).toEqual({ ok: true });
    expect((await handleRequest(new Request('https://x/'), env, opts)).status).toBe(404);
  });
});
