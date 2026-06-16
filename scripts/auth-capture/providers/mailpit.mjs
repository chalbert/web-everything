/**
 * @file scripts/auth-capture/providers/mailpit.mjs
 * @description Mail-source provider for a local dev mail SINK — Mailpit / Inbucket (backlog #611 tier 1,
 * the primary source for OUR OWN exercise apps). The app under capture is pointed at the sink's SMTP, so
 * every verification/OTP mail it sends lands here with NO real email account or credential — the simplest
 * source #709's ladder reaches for first.
 *
 * Mailpit's REST API: `GET {url}/api/v1/messages` (list, newest first) → `GET {url}/api/v1/message/{id}`
 * (full message incl. text body). The list-parsing and address are pure (tested without a server); the
 * registered factory is the thin wrapper that fetches `MAILPIT_URL` (default http://localhost:8025).
 */
import { registerMailProvider, aliasAddress } from '../mailSource.mjs';

export const DEFAULT_MAILPIT_URL = 'http://localhost:8025';

/** Normalize a Mailpit list-response into summary {@link MailMessage}s (body filled on fetch). Pure. */
export function parseMailpitList(json) {
  const items = Array.isArray(json?.messages) ? json.messages : [];
  return items.map((m) => ({
    id: m.ID ?? m.id,
    from: m.From?.Address ?? m.from,
    subject: m.Subject ?? m.subject ?? '',
    body: '', // filled by the detail fetch
    receivedAt: m.Created ?? m.created,
  }));
}

/** Pull the best text body out of a Mailpit message-detail response (prefer Text, fall back to HTML). Pure. */
export function parseMailpitBody(json) {
  return json?.Text ?? json?.text ?? json?.HTML ?? json?.html ?? '';
}

/**
 * Build a Mailpit {@link MailSource}. The sink catches all mail, so `address(site)` returns a dedicated
 * `screenshots+<site>` alias off `config.base` (default `screenshots`) purely for per-site disambiguation.
 *
 * @param {object} [config]
 * @param {string} [config.url=MAILPIT_URL|DEFAULT_MAILPIT_URL]  Mailpit base URL.
 * @param {string} [config.base='screenshots']  Local-part the per-site alias is minted from.
 * @param {typeof fetch} [config.fetch=globalThis.fetch]  Injectable for tests.
 */
export function createMailpitSource(config = {}) {
  const url = (config.url ?? process.env.MAILPIT_URL ?? DEFAULT_MAILPIT_URL).replace(/\/$/, '');
  const base = config.base ?? 'screenshots';
  const doFetch = config.fetch ?? globalThis.fetch;
  return {
    name: 'mailpit',
    address: (site) => aliasAddress(base, site),
    async list() {
      const res = await doFetch(`${url}/api/v1/messages`);
      if (!res.ok) throw new Error(`mailpit list failed: ${res.status}`);
      const summaries = parseMailpitList(await res.json());
      // Fetch each body (Mailpit returns the full text only on the detail endpoint).
      return Promise.all(
        summaries.map(async (s) => {
          const d = await doFetch(`${url}/api/v1/message/${s.id}`);
          return { ...s, body: d.ok ? parseMailpitBody(await d.json()) : '' };
        }),
      );
    },
  };
}

registerMailProvider('mailpit', createMailpitSource);
