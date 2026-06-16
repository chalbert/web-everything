/**
 * @file scripts/auth-capture/captureAuthed.mjs
 * @description The auth-capture orchestrator (backlog #611, shape per #709) — drives a signup/login flow
 * with Playwright, reads the verification token from a {@link MailSource} (any of the three tiers), and
 * captures the authenticated states a logged-out sweep can't reach (#610's sibling). Internal dev tooling:
 * a repo-local helper, secrets in a gitignored env file, a dedicated `screenshots+<site>` identity.
 *
 * Two layers:
 *   - {@link waitForToken} — the reusable, source-agnostic polling heart: poll a `MailSource` until the
 *     auth token (magic-link URL or OTP) arrives, then return it. Pure of Playwright + of wall-clock
 *     (sleep/attempts are injected), so it is unit-tested with a fake source and no real waiting.
 *   - {@link runAuthCapture} — the thin Playwright wiring: open the signup page, submit the per-site
 *     alias, `waitForToken`, complete the flow (open the link or type the OTP), and screenshot each state.
 *     Playwright is imported lazily so importing this module (e.g. in a test of `waitForToken`) needs no
 *     browser.
 */
import { extractToken, createMailSource, TOKEN_KINDS } from './mailSource.mjs';

const defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Poll `source` until the auth token appears in a message, or the attempts run out. Each attempt fetches
 * `source.list()` and runs {@link extractToken} over every message body (newest first); the first hit wins.
 *
 * @param {MailSource} source  The mail source to poll.
 * @param {object} [opts]
 * @param {'otp'|'link'} [opts.kind='link']  Token kind to extract.
 * @param {RegExp} [opts.urlMatch]  For `link`: narrow to a matching URL (e.g. /verify|confirm/).
 * @param {boolean} [opts.alnum=false]  For `otp`: also accept an upper-alnum code.
 * @param {string} [opts.site]  Site key, forwarded to `source.list` (some providers create per-site inboxes).
 * @param {RegExp} [opts.matching]  Pre-filter messages handed to the source (subject/body), if it supports it.
 * @param {number} [opts.attempts=20]  Max poll attempts.
 * @param {number} [opts.intervalMs=3000]  Delay between attempts.
 * @param {(ms:number)=>Promise<void>} [opts.sleep=setTimeout-based]  Injectable for tests.
 * @returns {Promise<{token: string, message: MailMessage}>}  Resolves with the token + the message it came from.
 * @throws if no token arrives within `attempts`.
 */
export async function waitForToken(source, opts = {}) {
  const {
    kind = TOKEN_KINDS.link, urlMatch, alnum = false, site, matching,
    attempts = 20, intervalMs = 3000, sleep = defaultSleep,
  } = opts;
  for (let i = 0; i < attempts; i++) {
    const messages = await source.list({ since: undefined, matching, site });
    for (const message of messages) {
      const token = extractToken(message.body, { kind, urlMatch, alnum });
      if (token) return { token, message };
    }
    if (i < attempts - 1) await sleep(intervalMs);
  }
  throw new Error(`waitForToken: no ${kind} token after ${attempts} attempt(s) on source "${source.name}"`);
}

/**
 * Run a full signup/login + capture flow. `flow` is the app-specific recipe (selectors + steps); the mail
 * tier is chosen by `provider`. Playwright is imported lazily here.
 *
 * @param {object} args
 * @param {string} args.provider  A registered mail provider ('mailpit' | 'gmail' | 'mailtm').
 * @param {object} [args.providerConfig]  Provider config (base address, endpoint, token…).
 * @param {object} args.flow  The flow recipe (see below).
 * @param {string} args.flow.site  Site key, used for the `+`-alias and capture filenames.
 * @param {string} args.flow.url  The signup/login page URL.
 * @param {string} args.flow.emailSelector  Selector for the email input.
 * @param {string} args.flow.submitSelector  Selector for the submit button.
 * @param {'otp'|'link'} [args.flow.tokenKind='link']  How the target verifies.
 * @param {RegExp} [args.flow.urlMatch]  For a magic link: which URL to open.
 * @param {string} [args.flow.otpSelector]  For OTP: selector to type the code into.
 * @param {string} [args.flow.otpSubmitSelector]  For OTP: selector to submit the code.
 * @param {Array<{name: string, waitFor?: string, goto?: string}>} [args.flow.captures]  States to screenshot.
 * @param {string} [args.outDir='screenshots/auth-capture']  Where PNGs are written.
 * @param {object} [args.browserOverride]  Injected Playwright browser (tests); else launched lazily.
 * @param {Function} [args.launch]  Injectable launcher (tests); defaults to playwright chromium.launch.
 * @returns {Promise<{address: string, captures: string[]}>}
 */
export async function runAuthCapture({ provider, providerConfig = {}, flow, outDir = 'screenshots/auth-capture', browserOverride, launch }) {
  if (!flow?.url || !flow?.site) throw new Error('runAuthCapture: flow.url and flow.site are required');
  const source = createMailSource(provider, providerConfig);

  const doLaunch = launch ?? (async () => {
    const { chromium } = await import('playwright'); // lazy: no browser needed to import this module
    return chromium.launch();
  });
  const browser = browserOverride ?? (await doLaunch());
  const captures = [];
  let address;
  try {
    const page = await browser.newPage();
    await page.goto(flow.url);
    address = source.address(flow.site);
    await page.fill(flow.emailSelector, address);
    await page.click(flow.submitSelector);

    const { token } = await waitForToken(source, {
      kind: flow.tokenKind ?? TOKEN_KINDS.link,
      urlMatch: flow.urlMatch,
      site: flow.site,
    });

    if ((flow.tokenKind ?? TOKEN_KINDS.link) === TOKEN_KINDS.link) {
      await page.goto(token); // open the magic link
    } else {
      await page.fill(flow.otpSelector, token);
      if (flow.otpSubmitSelector) await page.click(flow.otpSubmitSelector);
    }

    for (const cap of flow.captures ?? []) {
      if (cap.goto) await page.goto(cap.goto);
      if (cap.waitFor) await page.waitForSelector(cap.waitFor);
      const path = `${outDir.replace(/\/$/, '')}/${flow.site}-${cap.name}.png`;
      await page.screenshot({ path, fullPage: true });
      captures.push(path);
    }
  } finally {
    if (!browserOverride) await browser.close();
  }
  return { address, captures };
}
