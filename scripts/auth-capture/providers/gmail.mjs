/**
 * @file scripts/auth-capture/providers/gmail.mjs
 * @description Mail-source provider for a dedicated Gmail / Workspace inbox via the Gmail API (backlog
 * #611 tier 2, #709's secondary source). One real, reputable mailbox (so signup forms don't
 * disposable-blocklist it) serves an unlimited number of per-site identities through `+`-aliasing:
 * `screenshots+<site>@gmail.com` all deliver to `screenshots@gmail.com`, and the API search narrows to the
 * alias. Bring-your-own: it reads `GMAIL_ADDRESS` + an OAuth `GMAIL_ACCESS_TOKEN` from a gitignored env
 * file — no credential ever lives in this tree.
 *
 * The Gmail REST contract: `GET /gmail/v1/users/me/messages?q=<query>` (ids) → `GET .../messages/{id}`
 * (full, base64url body parts). The query-builder and the message-parser (incl. base64url body decode) are
 * pure + unit-tested without a token or a network; the registered factory is the thin fetch wrapper.
 */
import { registerMailProvider, aliasAddress } from '../mailSource.mjs';

const API = 'https://gmail.googleapis.com/gmail/v1/users/me/messages';

/**
 * Build the Gmail search `q` for auth mail to a given alias. `to:` narrows to the per-site `+`-alias;
 * `newer_than:` bounds the window (Gmail's relative-time syntax, e.g. `1h`, `1d`). Pure.
 */
export function buildSearchQuery({ to, newerThan = '1h' } = {}) {
  const parts = [];
  if (to) parts.push(`to:${to}`);
  if (newerThan) parts.push(`newer_than:${newerThan}`);
  return parts.join(' ');
}

/** Decode a base64url string (Gmail's body encoding) to UTF-8. Pure. */
export function decodeBase64Url(data) {
  if (!data) return '';
  const b64 = data.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(b64, 'base64').toString('utf8');
}

/** Walk a Gmail payload tree and return the first `text/plain` (else `text/html`) decoded body. Pure. */
export function extractGmailBody(payload) {
  if (!payload) return '';
  const visit = (part, want) => {
    if (part.mimeType === want && part.body?.data) return decodeBase64Url(part.body.data);
    for (const child of part.parts ?? []) {
      const hit = visit(child, want);
      if (hit) return hit;
    }
    return '';
  };
  return visit(payload, 'text/plain') || visit(payload, 'text/html') || '';
}

/** Map a full Gmail message resource to a normalized {@link MailMessage}. Pure. */
export function parseGmailMessage(json) {
  const headers = json?.payload?.headers ?? [];
  const header = (name) => headers.find((h) => h.name?.toLowerCase() === name)?.value;
  return {
    id: json?.id,
    from: header('from'),
    subject: header('subject') ?? '',
    body: extractGmailBody(json?.payload),
    receivedAt: json?.internalDate ? new Date(Number(json.internalDate)).toISOString() : undefined,
  };
}

/**
 * Build a Gmail {@link MailSource}. `address(site)` mints the `+`-alias off `config.base` (env
 * `GMAIL_ADDRESS`); `list` searches for recent mail to that alias and fetches each body.
 *
 * @param {object} [config]
 * @param {string} [config.base=GMAIL_ADDRESS]  The real mailbox, e.g. `screenshots@gmail.com`.
 * @param {string} [config.token=GMAIL_ACCESS_TOKEN]  OAuth bearer token (BYO, env).
 * @param {string} [config.newerThan='1h']  Search window.
 * @param {typeof fetch} [config.fetch=globalThis.fetch]  Injectable for tests.
 */
export function createGmailSource(config = {}) {
  const base = config.base ?? process.env.GMAIL_ADDRESS;
  const token = config.token ?? process.env.GMAIL_ACCESS_TOKEN;
  const newerThan = config.newerThan ?? '1h';
  const doFetch = config.fetch ?? globalThis.fetch;
  if (!base) throw new Error('gmail provider needs GMAIL_ADDRESS (the mailbox the +alias is minted from)');
  const auth = () => {
    if (!token) throw new Error('gmail provider needs GMAIL_ACCESS_TOKEN (an OAuth bearer token; BYO, gitignored env)');
    return { Authorization: `Bearer ${token}` };
  };
  let lastAlias = base;
  return {
    name: 'gmail',
    address: (site) => (lastAlias = aliasAddress(base, site)),
    async list({ matching } = {}) {
      const q = buildSearchQuery({ to: lastAlias, newerThan });
      const res = await doFetch(`${API}?q=${encodeURIComponent(q)}`, { headers: auth() });
      if (!res.ok) throw new Error(`gmail list failed: ${res.status}`);
      const ids = (await res.json())?.messages ?? [];
      const msgs = await Promise.all(
        ids.map(async ({ id }) => {
          const d = await doFetch(`${API}/${id}?format=full`, { headers: auth() });
          return d.ok ? parseGmailMessage(await d.json()) : null;
        }),
      );
      const out = msgs.filter(Boolean);
      return matching ? out.filter((m) => matching.test(m.subject) || matching.test(m.body)) : out;
    },
  };
}

registerMailProvider('gmail', createGmailSource);
