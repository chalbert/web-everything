/**
 * Unit tests for the phase-1 shared-code gate Pages Function (#1137).
 *
 * Verifies the observable HTTP behaviour a deployed Cloudflare Pages Function must produce: an ungated
 * request gets the splash; a correct code sets a signed cookie + 302; a wrong code is rejected; and a
 * request already carrying the valid signed cookie passes through to the site. No deploy needed — the
 * function is plain Web-standard code (Request/Response/Web Crypto), runnable under vitest.
 */
import { describe, it, expect } from 'vitest';
// @ts-expect-error — plain JS Pages Function, no .d.ts
import { onRequest } from '../_middleware.js';

const ENV = { GATE_CODE: 'open-sesame', GATE_COOKIE_SECRET: 'test-hmac-key-1234567890' };

function ctx(request: Request, next = async () => new Response('SITE', { status: 200 })) {
  return { request, env: ENV, next } as any;
}

describe('phase-1 gate Pages Function (#1137)', () => {
  it('serves the splash form for an ungated GET (200, no passthrough)', async () => {
    const res = await onRequest(ctx(new Request('https://we.example/')));
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
    const res = await onRequest(ctx(req));
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
    const res = await onRequest(ctx(req));
    expect(res.status).toBe(401);
    expect(await res.text()).toContain('Incorrect code');
  });

  // NOTE: happy-dom strips the `Cookie` request header (a forbidden header name on Request), so these two
  // cases use a minimal request stub exposing exactly what the function reads (method/url/headers.get).
  // Cloudflare's Workers runtime preserves the Cookie header — this is a test-env limitation, not a gap.
  const stubReq = (urlStr: string, cookie?: string, method = 'GET') => ({
    method,
    url: urlStr,
    headers: { get: (k: string) => (k.toLowerCase() === 'cookie' ? cookie ?? null : null) },
  });

  it('passes through to the site when a valid signed cookie is present', async () => {
    // First, obtain a valid cookie by submitting the right code.
    const grantRes = await onRequest(
      ctx(
        new Request('https://we.example/__gate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'code=open-sesame',
        }),
      ),
    );
    const cookieValue = grantRes.headers.get('Set-Cookie')!.split(';')[0];

    let passedThrough = false;
    const res = await onRequest(
      ctx(stubReq('https://we.example/blocks/', cookieValue) as any, async () => {
        passedThrough = true;
        return new Response('SITE', { status: 200 });
      }),
    );
    expect(passedThrough).toBe(true);
    expect(await res.text()).toBe('SITE');
  });

  it('does not pass through with a forged cookie', async () => {
    const res = await onRequest(ctx(stubReq('https://we.example/', 'we_gate=forged-value') as any));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('action="/__gate"');
  });
});
