# auth-capture — screenshot apps behind a login (#611)

Internal dev tooling (shape settled by [#709](../../backlog/709-managed-inbox-auth-capture-capability-boundary-plateau-servi/)):
a repo-local helper that lets an automated agent reach the states you only see **after** signing in
(dashboards, account flows, post-signup UI). Playwright already takes the screenshot; the hard part is
**reading the verification/OTP/magic-link mail** the signup sends — so this helper abstracts the mail
source behind one interface and drives the flow.

Not a Plateau service, not owned-domain infra. Secrets live in a **gitignored** `scripts/auth-capture/.env`
(template: [`.env.example`](./.env.example)); always use a dedicated `screenshots+<site>` identity, never
real mail.

## The mail-source ladder (simplest first, per #709)

| Tier | Provider | When | Setup |
|------|----------|------|-------|
| 1 | `mailpit` | **Our own exercise apps** | Point the app at a Mailpit/Inbucket SMTP sink; set `MAILPIT_URL`. No email account. |
| 2 | `gmail` | A reputable third-party signup (won't accept disposable mail) | A dedicated Gmail/Workspace inbox; `+`-aliasing gives a fresh per-site address off one mailbox. Set `GMAIL_ADDRESS` + `GMAIL_ACCESS_TOKEN` (BYO OAuth). |
| 3 | `mailtm` | Throwaway fallback | None — a disposable mailbox is created on demand. Lowest reputation (some signups blocklist it). |

## Architecture

- [`mailSource.mjs`](./mailSource.mjs) — the source-agnostic core: a provider **registry** plus the two
  pure shared pieces, `aliasAddress` (the `screenshots+<site>` identity) and `extractToken` (pull the OTP
  code or magic-link URL out of a message body). Both pure + unit-tested, no network.
- [`providers/`](./providers/) — one module per tier (`mailpit`, `gmail`, `mailtm`). Each exports pure
  request/parse builders (tested without a server, inbox, or credential) and registers a thin wrapper that
  wires them to the live API via an injectable `fetch`.
- [`captureAuthed.mjs`](./captureAuthed.mjs) — `waitForToken` (poll a source until the token arrives;
  source-/clock-agnostic, so it's tested with a fake source and no real waiting) + `runAuthCapture` (the
  Playwright flow: submit the alias → `waitForToken` → open the link / type the OTP → screenshot each state;
  Playwright is imported lazily).

## Usage (programmatic)

```js
import { runAuthCapture } from './scripts/auth-capture/captureAuthed.mjs';

await runAuthCapture({
  provider: 'mailpit',                       // or 'gmail' | 'mailtm'
  flow: {
    site: 'acme-app',
    url: 'https://acme.test/signup',
    emailSelector: 'input[type=email]',
    submitSelector: 'button[type=submit]',
    tokenKind: 'link',                        // or 'otp'
    urlMatch: /verify|confirm/,               // which link to open (link flows)
    // otpSelector: '#code', otpSubmitSelector: '#verify',   // (otp flows)
    captures: [
      { name: 'dashboard', waitFor: '[data-dashboard]' },
      { name: 'settings', goto: 'https://acme.test/settings' },
    ],
  },
});
// → screenshots/auth-capture/acme-app-dashboard.png, …-settings.png
```

## Why

- **Exercise-app conformance loop** (`.claude/skills/exercise-app`) — the flagship apps have
  authenticated surfaces conformance evidence currently can't reach.
- **Competitive capture behind auth** — reference dashboards live behind a free signup the logged-out
  sweep (#610) can't see.
- **Reproducible, agent-owned identity** — a controlled inbox makes signup deterministic and re-runnable
  headless/in CI (where interactive auth is absent).

## Status

The mail-source abstraction, all three providers' request/parse logic, `+`-aliasing, token extraction, and
`waitForToken` are implemented and unit-tested (`__tests__/authCapture.test.mjs`). A live end-to-end run
needs a real target + (for tier 2) a provisioned Gmail OAuth token in `.env`; the owned-domain catch-all
stays a deferred contingency (#709).
