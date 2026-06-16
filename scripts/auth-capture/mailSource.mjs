/**
 * @file scripts/auth-capture/mailSource.mjs
 * @description The mail-source abstraction for the managed-inbox auth-capture helper (backlog #611;
 * shape settled by #709 — internal dev tooling, a repo-local `scripts/` helper, no Plateau service, no
 * owned-domain infra).
 *
 * The hard part of screenshotting a real app *behind a login* isn't the screenshot (Playwright does
 * that) — it's reading the verification/OTP/magic-link mail the signup sends, from whatever source the
 * target allows. #709 settled a three-tier source ladder, simplest-first:
 *   1. our own exercise apps → a dev mail SINK (Mailpit / Inbucket) — no real email account;
 *   2. a dedicated Gmail/Workspace inbox via the Gmail API, with `+`-aliasing for a fresh per-site
 *      address off one real (non-blocklisted) mailbox;
 *   3. a throwaway public inbox (mail.tm) — the zero-setup fallback.
 *
 * This module is the SOURCE-AGNOSTIC core: a small provider registry plus the two pure pieces every
 * provider shares — `aliasAddress` (the `+`-tag a per-site identity is minted from) and `extractToken`
 * (pull the OTP code or magic-link URL out of a message body). Both are pure + unit-tested without a
 * network, an inbox, or any credential; each concrete provider (./providers/*.mjs) is a thin wrapper
 * that fetches messages and hands their bodies to `extractToken`. The Playwright capture orchestrator
 * ({@link ./captureAuthed.mjs}) consumes a `MailSource` without knowing which tier backs it.
 *
 * No credential ever lives in this tree: a provider reads its secrets from a gitignored env file
 * (see `.env.example`), and the alias is always a dedicated `screenshots+<site>` identity, never real mail.
 *
 * @typedef {object} MailMessage   A normalized inbound message.
 * @property {string} id           Provider-local message id.
 * @property {string} [from]       Sender address.
 * @property {string} [subject]    Subject line.
 * @property {string} body         The text (or text-extracted) body `extractToken` scans.
 * @property {string} [receivedAt] ISO timestamp, when available.
 *
 * @typedef {object} MailSource    A source the orchestrator polls for the latest auth mail.
 * @property {string} name         Provider id (e.g. 'mailtm').
 * @property {(site: string) => string} address   The inbox address to give the target for `site`.
 * @property {(opts?: {since?: string, matching?: RegExp}) => Promise<MailMessage[]>} list
 *           Fetch recent messages (newest first), optionally filtered.
 */

/** The token shapes a signup/login flow sends. `otp` = a numeric/alphanumeric code; `link` = a URL to open. */
export const TOKEN_KINDS = Object.freeze({ otp: 'otp', link: 'link' });

/**
 * Mint a `+`-aliased address for one `site` off a single real mailbox — `user@host` → `user+<site>@host`
 * (#709's per-site identity off a reputable, non-disposable mailbox). The site tag is slugified so it is
 * a safe local-part: lowercased, non-alphanumerics → `-`, collapsed, trimmed. A base with no `@` (a bare
 * local-part, e.g. a Mailpit sink user) still gets the `+tag` appended.
 *
 * @param {string} base  The mailbox, e.g. `screenshots@gmail.com` or `screenshots`.
 * @param {string} site  The target site/key the alias is for, e.g. `Acme App`.
 * @returns {string} The aliased address, e.g. `screenshots+acme-app@gmail.com`.
 */
export function aliasAddress(base, site) {
  const tag = String(site).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'site';
  const at = base.indexOf('@');
  if (at === -1) return `${base}+${tag}`;
  return `${base.slice(0, at)}+${tag}${base.slice(at)}`;
}

// A magic-link / verification URL: http(s) up to the first whitespace, quote, or angle bracket. Trailing
// sentence punctuation is trimmed so "click https://x/verify?t=abc." doesn't swallow the period.
const URL_RE = /https?:\/\/[^\s"'<>)]+/g;
const TRAILING_PUNCT_RE = /[.,;:!?)]+$/;

// An OTP code: a run of 4–8 digits (optionally split by a single space/hyphen, e.g. "123 456"), or a
// 6–8 char upper-alphanumeric code. Anchored on a word boundary so it doesn't grab a substring of a URL.
const OTP_NUMERIC_RE = /\b(\d{4,8}|\d{3}[ -]\d{3})\b/;
const OTP_ALNUM_RE = /\b([A-Z0-9]{6,8})\b/;

/**
 * Extract the auth token from a message body. Returns the first match per the requested `kind`:
 *   - `link` → the first magic-link URL (optionally narrowed by `urlMatch`, e.g. /verify|confirm/);
 *   - `otp`  → the first code (numeric runs preferred; `alnum: true` also accepts an upper-alnum code).
 * Pure: no I/O. Returns `null` when nothing matches, so the caller can keep polling.
 *
 * @param {string} body   The message body.
 * @param {object} [opts]
 * @param {'otp'|'link'} [opts.kind='link']  Which token to extract.
 * @param {RegExp} [opts.urlMatch]  For `link`: only return a URL whose string matches this.
 * @param {boolean} [opts.alnum=false]  For `otp`: also accept a 6–8 char upper-alphanumeric code.
 * @returns {string|null} The token (URL or code), or null.
 */
export function extractToken(body, { kind = TOKEN_KINDS.link, urlMatch, alnum = false } = {}) {
  if (typeof body !== 'string' || body.length === 0) return null;
  if (kind === TOKEN_KINDS.link) {
    const urls = (body.match(URL_RE) || []).map((u) => u.replace(TRAILING_PUNCT_RE, ''));
    const hit = urlMatch ? urls.find((u) => urlMatch.test(u)) : urls[0];
    return hit ?? null;
  }
  // OTP: prefer a numeric code (normalize a "123 456" / "123-456" split to "123456").
  const numeric = body.match(OTP_NUMERIC_RE);
  if (numeric) return numeric[1].replace(/[ -]/g, '');
  if (alnum) {
    const a = body.match(OTP_ALNUM_RE);
    if (a) return a[1];
  }
  return null;
}

// ── Provider registry ────────────────────────────────────────────────────────
// Providers register a factory (so a concrete MailSource is built with per-run config — base address,
// env-sourced creds). Mirrors the design-refs vision-provider pattern: the core stays vendor-free and a
// provider module is loaded on demand. Factory signature: (config) => MailSource.
const PROVIDERS = new Map();

/** Register a mail-source provider factory under `name`. */
export function registerMailProvider(name, factory) {
  if (typeof factory !== 'function') throw new Error(`mail provider "${name}" must be a factory function`);
  PROVIDERS.set(name, factory);
}

/** True if `name` is a registered provider. */
export function hasMailProvider(name) {
  return PROVIDERS.has(name);
}

/** The registered provider names (sorted, deterministic). */
export function mailProviderNames() {
  return [...PROVIDERS.keys()].sort();
}

/**
 * Build a {@link MailSource} from a registered provider. Throws a listing error for an unknown name so a
 * typo names the available providers rather than failing opaquely.
 *
 * @param {string} name     A registered provider id.
 * @param {object} [config] Provider config (base address, creds, endpoint…).
 * @returns {MailSource}
 */
export function createMailSource(name, config = {}) {
  const factory = PROVIDERS.get(name);
  if (!factory) {
    throw new Error(`unknown mail provider "${name}" — registered: ${mailProviderNames().join(', ') || '(none)'}`);
  }
  return factory(config);
}
