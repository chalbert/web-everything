/**
 * Unit tests for the phase-1 shared-code gate (#1137).
 *
 * Verifies the observable HTTP behaviour the deployed Cloudflare Worker must produce: an ungated request
 * gets the splash; a correct code sets a signed cookie + 302; a wrong code is rejected; a request already
 * carrying the valid signed cookie is served the static asset; and the gate fails *closed* (never leaks
 * content) when a secret is unset. No deploy needed — the gate is plain Web-standard code
 * (Request/Response/Web Crypto), runnable under vitest. The `serveAsset` callback stands in for the
 * Worker's ASSETS binding (`env.ASSETS.fetch`).
 */
import { describe, it, expect } from 'vitest';
// @ts-expect-error — plain JS Worker, no .d.ts
import { gate } from '../../worker.js';

const ENV = { GATE_CODE: 'open-sesame', GATE_COOKIE_SECRET: 'test-hmac-key-1234567890' };
const serveSite = async () => new Response('SITE', { status: 200 });

describe('phase-1 gate Worker (#1137)', () => {
  it('serves the splash form for an ungated GET (200, no asset)', async () => {
    const res = await gate(new Request('https://we.example/'), ENV, serveSite);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('action="/__gate"');
    expect(body).not.toContain('SITE');
  });

  it('accepts the correct shared code: sets a signed cookie and 302s in', async () => {
    const req = new Request('https://we.example/__gate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'code=open-sesame',
    });
    const res = await gate(req, ENV, serveSite);
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/');
    const setCookie = res.headers.get('Set-Cookie')!;
    expect(setCookie).toMatch(/^we_gate=/);
    expect(setCookie).toMatch(/HttpOnly/);
    expect(setCookie).toMatch(/Secure/);
  });

  it('rejects a wrong code with 401 and re-shows the splash', async () => {
    const req = new Request('https://we.example/__gate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'code=nope',
    });
    const res = await gate(req, ENV, serveSite);
    expect(res.status).toBe(401);
    expect(await res.text()).toContain('Incorrect code');
  });

  // NOTE: happy-dom strips the `Cookie` request header (a forbidden header name on Request), so these two
  // cases use a minimal request stub exposing exactly what the gate reads (method/url/headers.get).
  // Cloudflare's Workers runtime preserves the Cookie header — this is a test-env limitation, not a gap.
  const stubReq = (urlStr: string, cookie?: string, method = 'GET') => ({
    method,
    url: urlStr,
    headers: { get: (k: string) => (k.toLowerCase() === 'cookie' ? cookie ?? null : null) },
  });

  it('serves the asset when a valid signed cookie is present', async () => {
    // First, obtain a valid cookie by submitting the right code.
    const grantRes = await gate(
      new Request('https://we.example/__gate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'code=open-sesame',
      }),
      ENV,
      serveSite,
    );
    const cookieValue = grantRes.headers.get('Set-Cookie')!.split(';')[0];

    let served = false;
    const res = await gate(stubReq('https://we.example/blocks/', cookieValue) as any, ENV, async () => {
      served = true;
      return new Response('SITE', { status: 200 });
    });
    expect(served).toBe(true);
    expect(await res.text()).toBe('SITE');
  });

  it('does not serve the asset with a forged cookie', async () => {
    let served = false;
    const res = await gate(stubReq('https://we.example/', 'we_gate=forged-value') as any, ENV, async () => {
      served = true;
      return new Response('SITE');
    });
    expect(served).toBe(false);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('action="/__gate"');
  });

  // Fail-closed on a mis-wired deploy: if the secrets are unset, NOBODY gets in (the safe failure
  // direction — a lockout, never a content leak). Covers the exact deploy-day worry of forgetting a secret.
  it('fails closed when GATE_COOKIE_SECRET is unset: no session is minted and no request 500s', async () => {
    const envNoSecret = { GATE_CODE: 'open-sesame' } as any; // GATE_COOKIE_SECRET missing
    // A plain GET must gracefully show the splash (not throw a 500 from signing a zero-length HMAC key).
    const getRes = await gate(new Request('https://we.example/'), envNoSecret, serveSite);
    expect(getRes.status).toBe(200);
    expect(await getRes.text()).toContain('action="/__gate"');
    // Even the correct code cannot mint a passthrough cookie: the accept branch is guarded by `secret`.
    const postRes = await gate(
      new Request('https://we.example/__gate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'code=open-sesame',
      }),
      envNoSecret,
      serveSite,
    );
    expect(postRes.status).toBe(401);
    expect(postRes.headers.get('Set-Cookie')).toBeNull();
  });

  it('fails closed when GATE_CODE is unset: no submitted code is ever accepted', async () => {
    const envNoCode = { GATE_COOKIE_SECRET: 'test-hmac-key-1234567890' } as any; // GATE_CODE missing
    const res = await gate(
      new Request('https://we.example/__gate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'code=open-sesame',
      }),
      envNoCode,
      serveSite,
    );
    expect(res.status).toBe(401);
    expect(await res.text()).toContain('Incorrect code');
  });
});
