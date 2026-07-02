# Public deploy — phase-1 gate (#1137, #1104 phase 1)

The committed, credential-free half of the public WE-site deploy. Per the **#1135** ratification
(Cloudflare Pages + an edge-function gate), this directory holds the phase-1 shared-code gate that
Cloudflare Pages runs in front of the static `_site/` Eleventy build.

## What's here

- `_middleware.js` — the Pages Function gate. A valid signed `we_gate` cookie passes through to the site;
  `POST /__gate` with the correct shared code sets that cookie and 302s in; everything else is served the
  splash form. **Not a security boundary** — one shared code that keeps anonymous/casual traffic out
  (#1135 scope clarification). Per-person codes are phase 3 (Workers KV), real login is phase 5
  (Cloudflare Access); both extend *this* function's `code === SECRET` seam without a re-platform.
- `../wrangler.toml` — Pages project config (`pages_build_output_dir = "_site"`).

## Deploy — production path: Cloudflare Pages ↔ GitHub git integration (chosen 2026-07-02)

The production mechanism is **native Git integration**, not repeated manual `wrangler` pushes: Cloudflare
watches the GitHub repo and auto-builds + deploys every push to `main`, with a preview deployment per PR
and dashboard rollbacks. This is the lowest-maintenance production shape for a solo founder — no CI YAML to
own and no API token copied into GitHub.

**One-time setup (Cloudflare dashboard "Connect to Git" wizard — a GitHub OAuth step):**

| Setting | Value |
|---|---|
| Repository | `chalbert/web-everything` |
| Production branch | `main` |
| Build command | `npm run build:docs` |
| Build output directory | `_site` |
| Node version | pinned by `.nvmrc` (`22`) — Cloudflare reads it automatically |

**Why `build:docs`, not `npm run build`:** the demo build (`build:demo` → `vite build`) resolves an alias
graph into the *sibling FUI repo* (`@frontierui/plugs`, `fuiPlugsRoot`, …). Cloudflare's git integration
checks out **only this repo**, so `npm run build` would fail there. The public gated site is the Eleventy
docs build alone — `build:docs` is self-contained and verified to build on a single-repo checkout.

**Secrets** are set once on the Pages project (dashboard or the CLI below) and persist across every
auto-deploy — they do not need re-entering per push:

```sh
wrangler pages secret put GATE_CODE              # the shared entry code
wrangler pages secret put GATE_COOKIE_SECRET     # a long random HMAC key
```

Connecting the repo stands the gated site up on `*.pages.dev` — the keystone state #1137 delivers. Later
phases (#1104 phases 2–5) escalate from this same project. **Go-live gate:** pointing the real domain /
lifting the splash stays blocked by the #2127 claims-truth audit; the gated `*.pages.dev` deploy is safe
ahead of it.

### Manual fallback (credentialed, one-off)

If you ever need a manual push (e.g. before the git integration is connected), from a `wrangler`-authenticated
session:

```sh
npm run build:docs                                    # produce _site/
wrangler pages deploy _site --project-name web-everything
```

## Local check

The gate logic is pure (Web Crypto + cookie parsing) and unit-tested at
`functions/__tests__/gate.test.ts` — it verifies the signed-cookie round-trip, the shared-code accept/reject,
and that an ungated request gets the splash. Run with `npx vitest run functions`.
