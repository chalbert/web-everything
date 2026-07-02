/**
 * Cloudflare Worker — phase-1 shared-code gate for the public WE site (#1137, #1104 phase 1).
 *
 * Platform note (2026-07-02): Cloudflare migrated new sites off the standalone Pages "Connect to Git"
 * flow onto **Workers Static Assets** (the go-forward unified platform). This Worker replaces the former
 * Pages Function `functions/_middleware.js` — same gate behaviour, same #1135 ratification intent (one
 * Cloudflare substrate carrying every later phase: KV for phase-3 per-person codes, etc.). The static
 * `_site/` Eleventy build is served through the `ASSETS` binding; `run_worker_first = true` in
 * wrangler.toml makes this Worker intercept EVERY request (including asset paths) so nothing is served
 * un-gated.
 *
 * Per #1135 this is NOT a security boundary and NOT per-person access control — one shared code, typed
 * once and remembered via a signed cookie. The `code === SECRET` check below is the exact seam phase 3
 * extends to a Workers KV per-person lookup with no re-platform.
 *
 * Secrets (set on the Worker, never committed) — `wrangler secret put GATE_CODE|GATE_COOKIE_SECRET`:
 *   - GATE_CODE           — the shared entry code the splash form submits.
 *   - GATE_COOKIE_SECRET  — HMAC key signing the remember-me cookie.
 */

const COOKIE_NAME = 'we_gate';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days — "typed once, remembered" (#1137), not a login session.

/** The grant token a valid cookie signs — stable, so any signed cookie grants access (phase 1 has no nonce). */
const GRANT = 'we-site-phase1';

/** Base64url of an ArrayBuffer/Uint8Array. */
function b64url(bytes) {
  let s = '';
  const arr = new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** HMAC-SHA256(secret, message) → base64url. The cookie value is the signature of a fixed grant token. */
async function sign(message, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return b64url(sig);
}

/** Constant-time-ish string compare (lengths differ → false; equal length → per-char OR). */
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > -1) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

/**
 * Read the `code` field from the gate POST. The splash `<form>` submits
 * `application/x-www-form-urlencoded`, so parse that directly; fall back to `formData()` for multipart.
 */
async function readCodeField(request) {
  const ct = request.headers.get('Content-Type') || '';
  if (ct.includes('application/x-www-form-urlencoded')) {
    const params = new URLSearchParams(await request.text());
    return params.get('code') ?? '';
  }
  try {
    const form = await request.formData();
    return form.get('code') ?? '';
  } catch {
    return '';
  }
}

function splashHtml(error) {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Web Everything — enter</title>
<style>
  :root { color-scheme: light dark; }
  body { font: 16px/1.5 system-ui, sans-serif; display: grid; place-items: center; min-height: 100vh; margin: 0;
    background: #0b0e1a; color: #e6e8ef; }
  .card { width: min(92vw, 420px); padding: 2rem; border-radius: 14px; background: #141a2e;
    box-shadow: 0 10px 40px rgba(0,0,0,.4); }
  h1 { margin: 0 0 .25rem; font-size: 1.4rem; }
  p { margin: .25rem 0 1.25rem; color: #9aa3bd; }
  input { width: 100%; box-sizing: border-box; padding: .7rem .8rem; border-radius: 8px; border: 1px solid #2a3354;
    background: #0f1424; color: inherit; font-size: 1rem; }
  button { margin-top: .8rem; width: 100%; padding: .7rem; border: 0; border-radius: 8px; cursor: pointer;
    background: #6366f1; color: #fff; font-size: 1rem; font-weight: 600; }
  .err { color: #f87171; margin-top: .6rem; font-size: .9rem; min-height: 1.2em; }
</style></head>
<body><form class="card" method="POST" action="/__gate">
  <h1>Web Everything</h1>
  <p>This preview is gated. Enter the shared access code to continue.</p>
  <input name="code" type="password" autocomplete="off" autofocus placeholder="Access code" aria-label="Access code">
  <button type="submit">Enter</button>
  <div class="err" role="alert">${error ? 'Incorrect code — try again.' : ''}</div>
</form></body></html>`;
}

/**
 * Core gate. `serveAsset(request)` yields the static asset Response (the `ASSETS` binding in the Worker,
 * a stub in tests). Returns the Response to send. Exported for unit testing without a live runtime.
 */
export async function gate(request, env, serveAsset) {
  const url = new URL(request.url);
  const secret = env.GATE_COOKIE_SECRET || '';
  // Fail closed *gracefully* on a mis-wired deploy: with no secret, never sign (a zero-length HMAC key
  // throws in Web Crypto → a 500 that looks like a broken gate). expected='' can never match a cookie,
  // so every request falls through to the splash — a lockout, never a content leak.
  const expected = secret ? await sign(GRANT, secret) : '';

  // 1) Already gated? Serve the static asset.
  const cookies = parseCookies(request.headers.get('Cookie'));
  if (secret && cookies[COOKIE_NAME] && safeEqual(cookies[COOKIE_NAME], expected)) {
    return serveAsset(request);
  }

  // 2) Gate submission. Require the secret too, so we never mint a cookie signed with an empty key.
  if (request.method === 'POST' && url.pathname === '/__gate') {
    const code = await readCodeField(request);
    if (secret && env.GATE_CODE && safeEqual(String(code ?? ''), env.GATE_CODE)) {
      const headers = new Headers({ Location: '/' });
      headers.append(
        'Set-Cookie',
        `${COOKIE_NAME}=${expected}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`,
      );
      return new Response(null, { status: 302, headers });
    }
    return new Response(splashHtml(true), { status: 401, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  // 3) Ungated GET → splash (200 so the browser keeps the requested URL for the post-gate redirect).
  return new Response(splashHtml(false), {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export default {
  /** Runs first on every request (run_worker_first); passes gated requests to the static-asset binding. */
  async fetch(request, env) {
    return gate(request, env, (req) => env.ASSETS.fetch(req));
  },
};
