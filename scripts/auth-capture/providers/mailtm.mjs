/**
 * @file scripts/auth-capture/providers/mailtm.mjs
 * @description Mail-source provider for a throwaway public inbox — mail.tm (backlog #611 tier 3, #709's
 * zero-setup FALLBACK). No account of ours, no credential file: it creates a disposable mailbox on the fly
 * (random local-part on a mail.tm domain), authenticates, and reads messages. The least reputable source
 * (some signups blocklist disposable domains) — used only when neither a dev sink nor the Gmail inbox fits.
 *
 * mail.tm REST flow: `GET /domains` (pick one) → `POST /accounts` (create) → `POST /token` (JWT) →
 * `GET /messages` (list) → `GET /messages/{id}` (full body). The domain-pick and message-parsers are pure;
 * the registered factory is the thin wrapper that performs the account-create + token + fetch flow.
 */
import { registerMailProvider } from '../mailSource.mjs';

export const MAILTM_API = 'https://api.mail.tm';

/** Pick the first active domain from `GET /domains`. Pure. */
export function pickDomain(json) {
  const list = json?.['hydra:member'] ?? json?.member ?? (Array.isArray(json) ? json : []);
  const active = list.find((d) => d.isActive !== false) ?? list[0];
  return active?.domain ?? null;
}

/** Normalize a mail.tm message-list response into summary {@link MailMessage}s. Pure. */
export function parseMailtmList(json) {
  const list = json?.['hydra:member'] ?? json?.member ?? (Array.isArray(json) ? json : []);
  return list.map((m) => ({
    id: m.id,
    from: m.from?.address,
    subject: m.subject ?? '',
    body: Array.isArray(m.intro) ? m.intro.join('\n') : (m.intro ?? ''), // filled fully on detail fetch
    receivedAt: m.createdAt,
  }));
}

/** Pull the text body out of a mail.tm message-detail response (prefer text[], fall back to html[]). Pure. */
export function parseMailtmBody(json) {
  if (typeof json?.text === 'string') return json.text;
  if (Array.isArray(json?.text)) return json.text.join('\n');
  if (Array.isArray(json?.html)) return json.html.join('\n');
  return json?.intro ?? '';
}

/** A stable-ish disposable local-part for a site (slug + index suffix; callers vary it per run). Pure. */
export function throwawayLocalPart(site, suffix = '') {
  const slug = String(site || 'screenshots').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 16) || 'screenshots';
  return `${slug}${suffix}`;
}

/**
 * Build a mail.tm {@link MailSource}. Lazily creates the disposable account on first `address(site)` /
 * `list()` (so constructing the source does no I/O). The created address is the throwaway identity given
 * to the target.
 *
 * @param {object} [config]
 * @param {string} [config.password='screenshots-throwaway']  Account password (disposable).
 * @param {typeof fetch} [config.fetch=globalThis.fetch]  Injectable for tests.
 */
export function createMailtmSource(config = {}) {
  const password = config.password ?? 'screenshots-throwaway';
  const doFetch = config.fetch ?? globalThis.fetch;
  let account = null; // { address, token }

  const ensureAccount = async (site) => {
    if (account) return account;
    const domRes = await doFetch(`${MAILTM_API}/domains`);
    if (!domRes.ok) throw new Error(`mail.tm domains failed: ${domRes.status}`);
    const domain = pickDomain(await domRes.json());
    if (!domain) throw new Error('mail.tm returned no usable domain');
    const address = `${throwawayLocalPart(site)}@${domain}`;
    await doFetch(`${MAILTM_API}/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, password }),
    }); // 201 created, or 422 if it already exists — either way we can token below
    const tokRes = await doFetch(`${MAILTM_API}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, password }),
    });
    if (!tokRes.ok) throw new Error(`mail.tm token failed: ${tokRes.status}`);
    const token = (await tokRes.json())?.token;
    account = { address, token };
    return account;
  };

  return {
    name: 'mailtm',
    // mail.tm identity is the created throwaway address, not a +alias; expose it (creating on demand).
    address: (site) => {
      if (!account) throw new Error('mail.tm address is assigned on first list(); call list() to create the inbox, then read source.address');
      return account.address;
    },
    async list({ site } = {}) {
      const { token } = await ensureAccount(site);
      const auth = { Authorization: `Bearer ${token}` };
      const res = await doFetch(`${MAILTM_API}/messages`, { headers: auth });
      if (!res.ok) throw new Error(`mail.tm list failed: ${res.status}`);
      const summaries = parseMailtmList(await res.json());
      return Promise.all(
        summaries.map(async (s) => {
          const d = await doFetch(`${MAILTM_API}/messages/${s.id}`, { headers: auth });
          return { ...s, body: d.ok ? parseMailtmBody(await d.json()) : s.body };
        }),
      );
    },
  };
}

registerMailProvider('mailtm', createMailtmSource);
