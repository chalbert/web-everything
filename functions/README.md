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

## Deploy (the credentialed residual)

This part needs Cloudflare account credentials and is therefore **not** automatable in a commit-only
branch (and the repo policy is never-push). Run it from a session with `wrangler` authenticated:

```sh
npm run build:docs                       # produce _site/
wrangler pages secret put GATE_CODE              # the shared entry code
wrangler pages secret put GATE_COOKIE_SECRET     # a long random HMAC key
wrangler pages deploy _site --project-name web-everything
```

The first `wrangler pages deploy` (or connecting the git repo in the Pages dashboard with build command
`npm run build:docs` and output dir `_site`) stands the gated site up on the public internet — the
keystone state #1137 delivers. After that, every push redeploys; later phases (#1104 phases 2–5) escalate
from this same project.

## Local check

The gate logic is pure (Web Crypto + cookie parsing) and unit-tested at
`functions/__tests__/gate.test.ts` — it verifies the signed-cookie round-trip, the shared-code accept/reject,
and that an ungated request gets the splash. Run with `npx vitest run functions`.
