/**
 * @file scripts/conveyor/pr-events-worker/core.mjs
 * @description The PURE core of the PR-events webhook receiver (slice 1 of "webhooks, not polling, as the
 * primary PR trigger"). Everything here is plain JS over Web-standard APIs (WebCrypto, Request/Response), so it
 * runs unchanged in the Cloudflare Worker (`worker.mjs`) and in Node's vitest (`__tests__/`).
 *
 * WHAT IT DOES
 *   • POST /github/webhook — verifies GitHub's `X-Hub-Signature-256` HMAC over the RAW body with the
 *     `GITHUB_WEBHOOK_SECRET` binding, keeps only the PR-lifecycle events the daemons care about, turns each into
 *     a compact record (numbers, SHAs, label names — never titles, bodies or user text) and appends it to the
 *     event log. A GitHub redelivery (same `X-GitHub-Delivery` id) is stored once.
 *   • GET /events?cursor=N — bearer-authed with the SEPARATE `PR_EVENTS_READ_TOKEN` binding (the webhook secret
 *     never leaves GitHub↔Worker). Returns every event with `seq > cursor`, oldest first, plus the new cursor.
 *   • GET /health — `{ ok }` only; no data, no auth.
 *
 * CURSOR SEMANTICS (the contract `we:scripts/lib/pr-events.mjs` relies on)
 *   • `seq` is a strictly increasing integer, assigned by the single-writer log, never reused (pruning never
 *     lowers `head`).
 *   • `cursor` absent → `{ cursor: head, events: [], reset: true }`: a fresh reader starts at "now" (its own
 *     first full tick covers history — nothing is replayed).
 *   • `cursor > head` → the log was recreated under the reader; same answer as absent (`reset: true`).
 *   • `cursor < oldest - 1` → events the reader never saw were pruned: `gap: true` and the reader must treat
 *     that as "something happened" (run a full tick). Retention is bounded by count AND age.
 *   • `more: true` → a page limit cut the answer short; the reader asks again from the returned cursor.
 *
 * Fail-closed: a missing secret/token binding answers 503, never "accept unsigned" / "serve unauthenticated".
 */

export const ACCEPTED_EVENTS = Object.freeze({
  pull_request: new Set(['opened', 'synchronize', 'ready_for_review', 'closed', 'labeled', 'unlabeled', 'reopened']),
  check_suite: new Set(['completed']),
  check_run: new Set(['completed']),
  pull_request_review: new Set(['submitted', 'dismissed']),
});

export const DEFAULT_MAX_EVENTS = 5000;
export const DEFAULT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
export const DEFAULT_PAGE_LIMIT = 200;
export const MAX_PAGE_LIMIT = 500;

const enc = new TextEncoder();

function toHex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Constant-time string compare (length leak only). */
export function timingSafeEqual(a, b) {
  const x = enc.encode(String(a));
  const y = enc.encode(String(b));
  let diff = x.length ^ y.length;
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i += 1) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

/** `sha256=<hex>` HMAC of `body` (string or bytes) under `secret`. */
export async function signBody(secret, body) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = typeof body === 'string' ? enc.encode(body) : body;
  return `sha256=${toHex(await crypto.subtle.sign('HMAC', key, bytes))}`;
}

/** True only for a well-formed `sha256=` header matching the HMAC of the exact raw body. */
export async function verifySignature(secret, body, header) {
  if (!secret || typeof header !== 'string' || !/^sha256=[0-9a-f]{64}$/i.test(header)) return false;
  return timingSafeEqual((await signBody(secret, body)).toLowerCase(), header.toLowerCase());
}

const prNumbers = (list) => (Array.isArray(list) ? list.map((p) => p?.number).filter(Number.isInteger) : []);

/**
 * Turn one GitHub delivery into the compact stored record, or `null` when the event/action is not one we keep.
 * Only identifiers and states — no titles, bodies, comments or logins.
 */
export function parseGithubEvent(eventName, payload, { deliveryId = null, receivedAt = Date.now() } = {}) {
  const actions = ACCEPTED_EVENTS[eventName];
  if (!actions || !payload || typeof payload !== 'object') return null;
  const action = String(payload.action || '');
  if (!actions.has(action)) return null;
  const repo = payload.repository?.full_name;
  if (typeof repo !== 'string' || !repo) return null;
  const base = { id: deliveryId, at: new Date(receivedAt).toISOString(), type: eventName, action, repo };

  if (eventName === 'pull_request') {
    const pr = payload.pull_request || {};
    const rec = { ...base, prs: Number.isInteger(payload.number) ? [payload.number] : prNumbers([pr]), sha: pr.head?.sha || null };
    if (action === 'labeled' || action === 'unlabeled') rec.label = payload.label?.name || null;
    if (action === 'closed') rec.merged = pr.merged === true;
    if (pr.draft === true) rec.draft = true;
    return rec;
  }
  if (eventName === 'check_suite') {
    const s = payload.check_suite || {};
    return { ...base, prs: prNumbers(s.pull_requests), sha: s.head_sha || null, conclusion: s.conclusion || null, app: s.app?.slug || null };
  }
  if (eventName === 'check_run') {
    const r = payload.check_run || {};
    return { ...base, prs: prNumbers(r.pull_requests), sha: r.head_sha || null, conclusion: r.conclusion || null, name: r.name || null };
  }
  // pull_request_review
  const rv = payload.review || {};
  return { ...base, prs: prNumbers([payload.pull_request]), sha: rv.commit_id || null, state: rv.state ? String(rv.state).toLowerCase() : null };
}

/**
 * The event log over a tiny storage interface — ONE implementation of the cursor rules, shared by the Durable
 * Object (SQLite storage, `worker.mjs`) and the in-memory store the tests and local harness use.
 *
 * storage: { getMeta(k), setMeta(k, v), hasDelivery(id), insert(seq, id, at, json), range(afterSeq, limit),
 *            minSeq(), prune(throughSeq, olderThanMs) }
 */
export function createEventLog(storage, { maxEvents = DEFAULT_MAX_EVENTS, retentionMs = DEFAULT_RETENTION_MS } = {}) {
  const head = () => Number(storage.getMeta('head') || 0);
  return {
    /** Append one compact record. Returns `{ seq, duplicate }`. */
    append(record, now = Date.now()) {
      storage.setMeta('lastDeliveryAt', String(now));
      if (record.id && storage.hasDelivery(record.id)) return { seq: null, duplicate: true };
      const seq = head() + 1;
      const stored = { ...record, seq };
      storage.insert(seq, record.id || null, now, JSON.stringify(stored));
      storage.setMeta('head', String(seq));
      storage.setMeta('lastEventAt', String(now));
      storage.prune(seq - maxEvents, now - retentionMs);
      return { seq, duplicate: false };
    },
    /** A verified delivery we chose not to store (ping, ignored action) still proves the pipe is alive. */
    touch(now = Date.now()) { storage.setMeta('lastDeliveryAt', String(now)); },
    read(cursor, limit = DEFAULT_PAGE_LIMIT) {
      const h = head();
      const lim = Math.max(1, Math.min(MAX_PAGE_LIMIT, Number(limit) || DEFAULT_PAGE_LIMIT));
      const meta = {
        head: h,
        lastEventAt: numOrNull(storage.getMeta('lastEventAt')),
        lastDeliveryAt: numOrNull(storage.getMeta('lastDeliveryAt')),
      };
      if (cursor == null || !Number.isInteger(cursor) || cursor < 0 || cursor > h) {
        return { cursor: h, events: [], reset: true, gap: false, more: false, ...meta };
      }
      const oldest = storage.minSeq();
      const gap = oldest != null && cursor < oldest - 1;
      const rows = storage.range(cursor, lim).map((j) => JSON.parse(j));
      const next = rows.length ? rows[rows.length - 1].seq : (gap ? h : cursor);
      return { cursor: next, events: rows, reset: false, gap, more: next < h, ...meta };
    },
  };
}

const numOrNull = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

/** The in-memory storage (tests + local harness). Same contract as the Durable Object's SQL storage.
 *  @test-only-export-ok: the Worker uses its SQL storage; this is the unit-test / local-replay backend by design. */
export function createMemoryStorage() {
  const meta = new Map();
  let rows = []; // { seq, id, at, json } ascending
  return {
    getMeta: (k) => (meta.has(k) ? meta.get(k) : null),
    setMeta: (k, v) => { meta.set(k, v); },
    hasDelivery: (id) => rows.some((r) => r.id === id),
    insert: (seq, id, at, json) => { rows.push({ seq, id, at, json }); },
    range: (after, limit) => rows.filter((r) => r.seq > after).slice(0, limit).map((r) => r.json),
    minSeq: () => (rows.length ? rows[0].seq : null),
    prune: (throughSeq, olderThanMs) => { rows = rows.filter((r) => r.seq > throughSeq && r.at >= olderThanMs); },
    _rows: () => rows,
  };
}

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

/**
 * Route one request. `getLog()` returns the event log (sync or async; the Worker hands back a Durable Object
 * stub whose methods are async RPC, the tests a plain `createEventLog`).
 */
export async function handleRequest(request, env, { getLog, now = () => Date.now() }) {
  const url = new URL(request.url);
  if (url.pathname === '/health' && request.method === 'GET') return json(200, { ok: true });

  if (url.pathname === '/github/webhook') {
    if (request.method !== 'POST') return json(405, { error: 'method not allowed' });
    if (!env.GITHUB_WEBHOOK_SECRET) return json(503, { error: 'webhook secret not configured' });
    const raw = new Uint8Array(await request.arrayBuffer());
    const ok = await verifySignature(env.GITHUB_WEBHOOK_SECRET, raw, request.headers.get('x-hub-signature-256'));
    if (!ok) return json(401, { error: 'bad signature' });
    const eventName = request.headers.get('x-github-event') || '';
    const deliveryId = request.headers.get('x-github-delivery') || null;
    let payload;
    try { payload = JSON.parse(new TextDecoder().decode(raw)); } catch { return json(400, { error: 'body is not JSON' }); }
    const t = now();
    const log = await getLog();
    const record = parseGithubEvent(eventName, payload, { deliveryId, receivedAt: t });
    if (!record) {
      await log.touch(t);
      return json(200, { stored: false, reason: eventName === 'ping' ? 'ping' : 'ignored event/action' });
    }
    const res = await log.append(record, t);
    return json(202, { stored: !res.duplicate, seq: res.seq, duplicate: res.duplicate });
  }

  if (url.pathname === '/events') {
    if (request.method !== 'GET') return json(405, { error: 'method not allowed' });
    if (!env.PR_EVENTS_READ_TOKEN) return json(503, { error: 'read token not configured' });
    const auth = request.headers.get('authorization') || '';
    const m = /^Bearer (.+)$/.exec(auth);
    if (!m || !timingSafeEqual(m[1], env.PR_EVENTS_READ_TOKEN)) return json(401, { error: 'unauthorized' });
    const c = url.searchParams.get('cursor');
    const cursor = c == null || c === '' ? null : (/^\d+$/.test(c) ? Number(c) : null);
    const limit = Number(url.searchParams.get('limit')) || DEFAULT_PAGE_LIMIT;
    const log = await getLog();
    return json(200, { ...(await log.read(cursor, limit)), now: now() });
  }

  return json(404, { error: 'not found' });
}
