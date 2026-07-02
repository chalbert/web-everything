# Public deploy — phase-1 gate (#1137, #1104 phase 1)

The committed, credential-free half of the public WE-site deploy. Per the **#1135** ratification the
substrate is Cloudflare and the phase-1 shared-code gate is an edge function.

**Platform note (2026-07-02):** Cloudflare retired the standalone Pages "Connect to Git" flow for new
sites and steers them to **Workers Static Assets** (the go-forward unified platform). So the gate is now a
**Worker** (`we:worker.js`) fronting the Eleventy `_site/` build served through the `ASSETS` binding —
not a Pages Function. Same behaviour, same #1135 intent (one Cloudflare substrate carrying every later
phase: KV for phase-3 per-person codes, Access for phase-5 login). This directory keeps the gate's unit
tests + this runbook; the Worker itself lives at the repo root so `wrangler.toml`'s `main` points at it.

## What's here / relevant files

- `we:worker.js` — the gate Worker. `run_worker_first = true` makes it intercept **every** request
  (asset paths included) so nothing is served un-gated. A valid signed `we_gate` cookie → `env.ASSETS.fetch`
  serves the static file; `POST /__gate` with the correct code sets the cookie and 302s in; everything else
  gets the splash. **Not a security boundary** — one shared code keeping anonymous/casual traffic out
  (#1135 scope). Per-person codes are phase 3 (Workers KV), login is phase 5 (Access); both extend this
  Worker's `code === SECRET` seam without a re-platform.
- `we:wrangler.toml` — Worker + Static-Assets config (`main = "worker.js"`, `[assets] directory = "./_site"`,
  `binding = "ASSETS"`, `run_worker_first = true`).
- `functions/__tests__/gate.test.ts` — the gate's unit tests (`npx vitest run functions`).

## Deploy — production path: Workers Builds ↔ GitHub git integration (2026-07-02)

Auto-build + deploy on every push to `main`, with a preview per non-production branch. One-time setup in
the Cloudflare dashboard **Create application → import `chalbert/web-everything`** (a GitHub OAuth step):

| Field | Value |
|---|---|
| Repository | `chalbert/web-everything` |
| Build command | `npm run build:docs` |
| Deploy command | `npx wrangler deploy` *(the default — now correct: `wrangler.toml` is a Worker config)* |
| Non-production branch deploy command | `npx wrangler versions upload` *(default)* |
| Path | `/` |
| Node version | pinned by `we:.nvmrc` (`22`) |

**Why `build:docs`, not `npm run build`:** the demo build (`build:demo` → `vite build`) resolves an alias
graph into the *sibling FUI repo*, absent on Cloudflare's single-repo checkout. The public gated site is
the self-contained Eleventy docs build.

**Secrets** are set once on the Worker and persist across deploys:

```sh
wrangler secret put GATE_CODE               # the shared entry code
wrangler secret put GATE_COOKIE_SECRET      # a long random HMAC key (e.g. openssl rand -hex 32)
```

Until the secrets are set the gate **fails closed** (splash for everyone — a lockout, never a content
leak). **Go-live gate:** pointing the real domain / lifting the splash stays blocked by the #2127
claims-truth audit; the gated `*.workers.dev` (or `web-everything.<subdomain>`) deploy is safe ahead of it.

### Manual fallback (credentialed, one-off)

From a `wrangler`-authenticated session (`CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` in env):

```sh
npm run build:docs                          # produce _site/
wrangler deploy                             # upload the Worker + _site assets
```

## Local check

The gate logic is pure (Web Crypto + cookie parsing) and unit-tested — it verifies the signed-cookie
round-trip, the shared-code accept/reject, the asset passthrough, and that a missing secret fails closed
(never a leak). Run with `npx vitest run functions`. Validate the deploy config without deploying with
`wrangler deploy --dry-run`.
