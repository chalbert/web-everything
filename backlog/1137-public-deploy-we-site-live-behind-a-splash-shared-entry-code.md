---
kind: story
size: 3
parent: "1104"
status: open
blockedBy: ["xe1hwtk"]
humanGate: { kind: deploy, what: "DONE 2026-07-02/07-03 for the gated preview: `wrangler deploy` (Workers Static Assets) + secrets set + full cross-repo GitHub Actions auto-deploy; live at web-everything.nicgilbert.workers.dev. Remaining human step for PUBLIC go-live (now UNBLOCKED — #2127 resolved, but gated on #xe1hwtk's DNS/email check first): point the Squarespace domain's nameservers to Cloudflare + set `workers_dev=false`. NOT agent-executable — see 'Go-live runbook' below." }
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

**Residual (still open) — corrected 2026-08-15, was stale:** the Workers Builds git-wizard dashboard
attempt (auto-deploy via Cloudflare's own git integration) was tried and abandoned — a single-repo
Cloudflare checkout can't reach the sibling `../frontierui` repo `build:docs` needs. **Auto-deploy IS
wired**, just via a different mechanism: a cross-repo GitHub Action
(`we:.github/workflows/deploy.yml`, landed 2026-07-02/07-03) that checks out both repos, builds FUI's
tools, builds the WE site, and runs `wrangler deploy` on every push to `main`. The only genuinely open
item is **public go-live** — pointing the Squarespace domain at the Worker + `workers_dev=false` in
`we:wrangler.toml`. Item stays **open** until that lands.

**Go-live gate (ratified #2089 Fork 1(b)) — CLEARED 2026-07-02:** the claims-truth audit **#2127 is now
resolved** (verified: `backlog/2127-*.md` `status: resolved`, `dateResolved: 2026-07-02`), so public
go-live is unblocked on that front. (#2127's own note that a re-run is required "before the
ungated-public stage" does not apply here — #1137 stays gated behind the splash/shared-code even after
the domain points at it; the ungated stage is a later, unscoped phase.)

## Not an agent-buildable story — this is a human-execution runbook

Everything code-shaped in this item already shipped (the Worker, the gate, the CI auto-deploy). What's
left has no design fork, no interfaces, and no code an agent can write ahead of time: it is a human
performing DNS + Cloudflare-dashboard actions this session has no credentials for, in an order where step
2 cannot be verified without knowing the outcome of step 1. Preparing this "to build-ready" in the
story-preparation-checklist sense would mean forcing a design where none exists. Per that checklist, this
records why rather than forcing one.

**Go-live runbook (for whoever executes it — human, not agent):**

1. **Add the domain to the Cloudflare account first** (dashboard → Add a site), *before* touching
   nameservers at the registrar. This triggers Cloudflare's automatic scan/import of the domain's
   existing DNS records.
2. **Verify the import caught everything, especially email** — [#xe1hwtk](/backlog/xe1hwtk-verify-existing-squarespace-dns-records-especially-email-mx-/)
   (filed 2026-08-15, new during this preparation pass): Squarespace commonly also hosts a domain's email
   (MX/SPF/DKIM/TXT), and Cloudflare's auto-import is not guaranteed complete. Diff the imported zone
   against the live Squarespace DNS records before proceeding — otherwise the nameserver switch can
   silently break existing email with no code-level signal that anything went wrong. This item now
   `blockedBy` #xe1hwtk for that reason.
3. **Point the Squarespace domain's nameservers at the two Cloudflare nameservers** the dashboard
   assigns. Propagation can take up to 24-48h; Cloudflare emails/dashboards confirm when the zone is
   active.
4. **Once the zone is active**, add the production route: either a Cloudflare "Custom Domain" bound to
   the `web-everything` Worker in the dashboard, or a `[[routes]]`/`custom_domain = true` entry in
   `we:wrangler.toml` naming the real domain (not committed yet — the domain name itself isn't in this
   repo, only known to the human operator).
5. **Flip `workers_dev = true` → `false`** in `we:wrangler.toml` (currently line 20) once the custom
   domain route is confirmed working, so the interim `*.workers.dev` preview stops being the front door.
6. **Deploy and verify end-to-end on the real domain** the same way the 2026-07-02 verification did on
   the `workers.dev` preview: no code → splash; wrong code → 401; correct code → signed cookie → real
   content; asset/deep paths all gated.

Steps 4-5 are the only code-shaped part (a `we:wrangler.toml` diff), and they're a one-line-plus-domain-name
change that can't be written correctly ahead of knowing the domain is actually live in Cloudflare — so
there's nothing to stage now beyond this runbook.
