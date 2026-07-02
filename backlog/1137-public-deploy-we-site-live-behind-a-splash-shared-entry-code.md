---
kind: story
size: 3
parent: "1104"
status: open
blockedBy: ["2127"]
humanGate: { kind: deploy, what: "Run the credentialed `wrangler pages deploy _site` + `wrangler pages secret put GATE_CODE / GATE_COOKIE_SECRET` from a Cloudflare-authenticated session (runbook: we:functions/README.md) — outside the automated commit-only lane (never-push)." }
dateOpened: "2026-06-19"
dateStarted: "2026-06-20"
tags: []
---

# Public deploy: WE site live behind a splash + shared entry code

Deploy the we: Eleventy docs build to the host chosen in #1135, behind a public splash page and a single shared entry code (typed once, remembered — not a login). The keystone slice of #1104: it stands the site up on the public internet under a controlled gate and leaves a valid demoable state (a live, gated site). Every later phase escalates from here.

## Deployable artifacts built (2026-06-19, batch-parallel serial lane) — deploy push is the residual

The committed, **credential-free half** is built per the #1135 ratification (Cloudflare Pages + an edge-function gate):

- `we:functions/_middleware.js` — the phase-1 Pages Function gate (shared code → signed HttpOnly cookie → 302; splash form otherwise). The `code === SECRET` seam phase 3 extends to a KV lookup. Unit-tested at `we:functions/__tests__/gate.test.ts` (splash, accept, reject, signed-cookie passthrough, forged-cookie rejection — 5 tests).
- `we:wrangler.toml` — Pages config (`pages_build_output_dir = "_site"`).
- `we:functions/README.md` — the deploy runbook.

**Residual (carried, NOT done in this lane):** the credentialed `wrangler pages deploy _site` + `wrangler pages secret put GATE_CODE / GATE_COOKIE_SECRET`. This needs a Cloudflare-authenticated session and is outside a commit-only automated branch (repo policy is never-push). Run the runbook in `we:functions/README.md` from a credentialed session to stand the gated site up live (the keystone state). Item stays **open** until that push lands.

**Pre-deploy gate (ratified #2089 Fork 1(b), 2026-07-02):** `blockedBy: ["2127"]` — the claims-truth audit
(every externally visible dogfood/maturity claim true of the deployed artifact, adopter deck included) must
pass before the deploy goes live. The staged evidence ladder's bar is claim-indexed, not inventory-indexed.
