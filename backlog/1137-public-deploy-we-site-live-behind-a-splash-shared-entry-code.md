---
kind: story
size: 3
parent: "1104"
status: open
blockedBy: ["2127"]
humanGate: { kind: deploy, what: "DONE 2026-07-02 for the gated preview: `wrangler deploy` (Workers Static Assets) + secrets set; live at web-everything.nicgilbert.workers.dev. Remaining human step for PUBLIC go-live: point the Squarespace domain's nameservers to Cloudflare + set `workers_dev=false` — gated behind #2127." }
dateOpened: "2026-06-19"
dateStarted: "2026-06-20"
tags: []
---

# Public deploy: WE site live behind a splash + shared entry code

Deploy the we: Eleventy docs build to the host chosen in #1135, behind a public splash page and a single shared entry code (typed once, remembered — not a login). The keystone slice of #1104: it stands the site up on the public internet under a controlled gate and leaves a valid demoable state (a live, gated site). Every later phase escalates from here.

## ✅ Deployed live + gated (2026-07-02) — public go-live (domain) is the residual

The gated site is **live** at **`web-everything.nicgilbert.workers.dev`**, verified end-to-end in
production (no code → splash; wrong code → 401; correct code → signed cookie → real content; asset/deep
paths all gated). Both secrets set on the Worker (`GATE_COOKIE_SECRET` auto-generated, `GATE_CODE` the
user's). Committed + pushed to `origin/main`.

**Platform note — deviates from #1135's "Cloudflare Pages" (see the rider on #1135).** Cloudflare retired
the standalone Pages "Connect to Git" flow for new accounts and steers everything to **Workers Static
Assets**. So the gate is a **Worker** (`we:worker.js`, `wrangler.toml` `main` + `[assets] run_worker_first=true`
so it fronts every request), not a Pages Function (`we:functions/_middleware.js` removed). Same behaviour,
same #1135 one-Cloudflare-substrate intent (KV for phase-3, Access for phase-5 all still on this Worker).

- `we:worker.js` — the phase-1 gate Worker (shared code → signed HttpOnly cookie → 302; splash otherwise;
  graceful fail-closed if a secret is unset). `code === SECRET` seam phase 3 extends to a KV lookup.
  Unit-tested at `we:functions/__tests__/gate.test.ts` (7 tests incl. fail-closed cases).
- `we:wrangler.toml` — Workers Static-Assets config. `we:functions/README.md` — the deploy runbook.

**Residual (still open):** (1) **auto-deploy is NOT wired** — the Workers Builds git wizard hung on
"Initializing build environment"; deploy is currently manual `wrangler deploy`. (2) **Public go-live** —
pointing the Squarespace domain at the Worker + `workers_dev=false`. Item stays **open** until public
go-live lands.

**Go-live gate (ratified #2089 Fork 1(b), 2026-07-02):** `blockedBy: ["2127"]` — the claims-truth audit
(every externally visible dogfood/maturity claim true of the deployed artifact, adopter deck included) must
pass before the site goes **public** (domain pointed / URL advertised). The current gated `workers.dev`
preview — accessible only to the founder, unadvertised — is safe ahead of it; the claim-indexed bar
governs the public go-live, not this private preview.
