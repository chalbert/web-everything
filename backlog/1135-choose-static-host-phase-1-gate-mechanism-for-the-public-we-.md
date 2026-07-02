---
kind: decision
size: 2
parent: "1104"
status: resolved
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: none
codifiedIn: one-off
preparedDate: "2026-06-19"
relatedReport: reports/2026-06-19-static-host-phase1-gate.md
tags: [deployment, hosting, gated-access, solo-founder, webdocs]
---

# Choose static host + phase-1 gate mechanism for the public WE site

Pick the static-site host for the `we:` Eleventy build and where the phase-1 shared-code gate lives. **No deploy infra exists yet** — the site builds only to localhost. The two forks below are grounded in a prior-art survey of the leading static hosts + gate mechanisms, published as the [/research/ topic](/research/static-host-phase1-gate/) (session report linked via `relatedReport`); each carries a recommended default in **bold**. Soft, revisitable, low-stakes operational infra — *not* a WE standard. First slice of [#1104](/backlog/1104-publish-the-website-publicly-gated-controlled-rollout/); unblocks the public deploy ([#1137](/backlog/1137-public-deploy-we-site-live-behind-a-splash-shared-entry-code/)).

The concern decomposes into two coupled axes the survey surfaced: **(1) substrate** — which host serves a static `_site/` build (the `we:` Eleventy build is `build:docs` → `eleventy` at [we:package.json:11](package.json#L11), output `_site` at [we:.eleventy.js:277](.eleventy.js#L277)); and **(2) gate locus** — where the single shared-code check runs. They are coupled because #1104 is a *graduated* roadmap (phase 1 shared code → 2 analytics → 3 **per-person codes** → 4 **emailed codes** → 5 **maybe login**), and three of the five phases need server-side state/compute — so the pick optimises **roadmap** burden, not phase-1 burden. A host whose platform serves every later phase (functions + KV + email + identity) on one free substrate avoids a re-platform at phase 3; a "cheapest for phase 1" pick re-opens this exact decision then.

### Recommended path at a glance

| Fork | Recommended default | Main alternative (excluded) | Confidence |
|---|---|---|---|
| 1 — host | **Cloudflare Pages** | Netlify (paid password; per-person dead-end) | Med-high (~80%) |
| 2 — gate locus | **Edge function (Pages Function)** | Host-native Access (email identity, not a shared code) | Med-high (~80%) |

## ✅ Ratified ruling (2026-06-19) — A + A

**Fork 1 → A. Cloudflare Pages. Fork 2 → A. Edge function (Pages Function).** Confidence **~80%**.

> **Platform update (2026-07-02) — Pages ⇒ Workers Static Assets (ruling intent intact).** When the deploy
> was actually stood up (#1137), Cloudflare had **retired the standalone Pages "Connect to Git" flow** for
> new accounts and steers everything to **Workers Static Assets** (its go-forward unified platform). So the
> concrete substrate is now a **Worker** serving the `_site/` build via the `ASSETS` binding, with the gate
> as a Worker `fetch` handler (`we:worker.js`, `run_worker_first=true`) instead of a Pages Function. **This
> does not reverse the ruling** — both forks' *principle* holds unchanged: Fork 1's "one free Cloudflare
> substrate carrying every later phase (functions → KV → Access) with no re-platform" is *better* served by
> Workers (the platform Pages is folding into); Fork 2's "edge function that owns the `code === SECRET`
> seam" is exactly the Worker. Only Cloudflare's product label changed under us. Live+gated at
> `web-everything.nicgilbert.workers.dev`. (`codifiedIn: one-off`, so no `we:docs/agent/platform-decisions.md` edit needed.)

**Scope of the phase-1 gate (clarified at ratification):** Fork 2 ships a **single shared code**,
not per-person access control. It keeps anonymous/casual traffic out — it cannot identify *who* is
using the app, and blocking one person means rotating the one code (which boots everyone).
**Controlling/blocking individuals arrives at phase 3** (per-person codes via Workers KV) and
phase 5 (Cloudflare Access login). Fork 2-A was chosen *because* its locus extends to that
phase-3 per-person check in the same function (`code === SECRET` → KV lookup), with no
re-platform — the rejected alternatives can't reach it cleanly. (Per-person control being a real
goal also confirms the #1104 roadmap is real, dissolving the YAGNI residual on this call.)

The whole #1104 roadmap runs on one free Cloudflare substrate with no re-platform at any phase:
Pages (static `_site/`) → Pages Functions (phase-1/3 gate) → Workers KV (phase-3 per-person
codes) → Workers email (phase-4) → Cloudflare Access (phase-5 login). The phase-1 gate is a
~20-line Pages Function comparing the posted code to a server-side secret and setting a signed
HttpOnly cookie — the exact seam phase 3 extends to a KV per-person lookup.

**Red-team (attack failed).** Strongest attack is YAGNI — "phases 3–5 are speculative, take the
cheapest phase-1 host." It fails because Cloudflare Pages carries *zero* phase-1 premium over
the cheapest option (free, git-push deploy, trivial gate), so optionality is preserved at no
cost. The password-collapse attack (Netlify Pro) is rebutted in Context: it re-opens this
decision at phase 3. **Residual (~20%):** whether the #1104 roadmap stays real — which does not
change the pick, since the floor cost equals the cheapest host. Secondary residual: Cloudflare
Functions/KV vendor lock-in, judged **low and escapable** — the `_site/` build is portable
Eleventy output and the gate is reimplementable; only phase-3 KV is Cloudflare-shaped (a future
call). Consistent with the monetization "soft, revisitable ops infra" stance and the #181/#182
minimal-always-on constraint (serverless, no per-call cost).

**On resolution:** graduates to the [#1137](/backlog/1137-public-deploy-we-site-live-behind-a-splash-shared-entry-code/)
build (deploy `_site/` to Cloudflare Pages + add the Pages-Function gate); re-`/slice` #1104 so
phases 3–5 are scoped against the now-known Cloudflare platform.

## Fork 1 — host

*Fork-existence (case b):* the canonical public site has **one origin** — the candidate hosts are coherent but mutually exclusive as that origin, so exactly one is picked. Crux: solo-founder operational burden across the *whole* #1104 roadmap, not just phase 1.

- **A. Cloudflare Pages** *(recommended)* — free tier (unlimited bandwidth/requests, 500 builds/mo), git-push deploy of `_site/`, and decisively the *entire later roadmap on one free platform*: Pages Functions (gate, 100k req/day), Workers KV (phase-3 per-person codes, 100k reads/day · 1k writes/day · 1GB), Workers email (phase-4), Cloudflare Access (phase-5 login, free ≤50 users). No re-platform at any notch; serverless, so no always-on surface (matches the [#181](/backlog/181-commercialization-infrastructure/)/#182 "minimal always-on" constraint).
- **B. Netlify** — git-push deploy; *Rejected as default*: site-wide password is **Pro-plan only** (~$19/mo; free fallback is a `_headers` Basic Auth file) and is a per-person **dead-end** — it re-opens the platform decision at phase 3.
- **C. Vercel** — git-push deploy; *Rejected*: password protection is paid, and the posture is app-server-oriented, heavier than a static site needs.
- **D. GitHub Pages** — simplest static host; *Rejected*: **no** native gate, so phase 1 already needs an added edge layer, and nothing carries phases 3–5.

**Recommended default: A (Cloudflare Pages).** Pays a near-zero phase-1 cost to never re-platform across the roadmap.

## Fork 2 — phase-1 gate mechanism

*Fork-existence (case b):* the shared-code check runs in exactly **one** locus — host-native vs. edge vs. client are mutually-exclusive implementations of the same gate (and the client branch is *flawed* beyond phase 1 — case a). **Not a security boundary**: phase 1 only keeps anonymous/casual traffic out, it protects nothing secret. Crux: which locus also serves the phase-3 per-person check.

- **A. Edge function (Pages Function / Worker)** *(recommended)* — a ~20-line function compares the posted code to a server-side secret, sets a signed HttpOnly cookie, 302s in. Free, serverless, and *the exact seam* phase 3 extends from `code === SECRET` to a KV per-person lookup.
- **B. Host-native access control** — *Rejected as default*: on Cloudflare, Access is **email-identity** auth (OTP/SSO) — the phase-5 tool, **not** a single shared code; on Netlify the site password *is* a shared code but is paid and collapses both forks onto the rejected Fork-1 B. So "collapse both forks into the host" only exists on the rejected host.
- **C. Client-side JS gate** — *Rejected*: cheapest and fine for "keep the public out," but the content still ships to the client and there is no server-side check — acceptable phase-1-only, a dead-end for phase-3 per-person codes.

**Recommended default: A (edge function).** It is the locus the roadmap extends; B's "least code" advantage exists only on the rejected host.

---

## Context

**Why not just collapse both forks onto a host with a password.** That is the local optimum the red-team attacks ("most infra for the least requirement"). The rebuttal is that the requirement is the roadmap: Netlify's one-setting password re-opens the platform decision at phase 3, whereas a Cloudflare Pages Function pays a trivial phase-1 cost to keep every later phase on one free substrate. Full grounding, free-tier ceilings, and the red-team in the [/research/ topic](/research/static-host-phase1-gate/).

**Supported by default (not decisions).** Git-push deploy, a free tier, and zero always-on surface are satisfied by *every* candidate — they are filters, not forks. The splash-page UI and cookie/redirect detail are build concerns of [#1137](/backlog/1137-public-deploy-we-site-live-behind-a-splash-shared-entry-code/), not this decision.

**On resolution:** graduates to the #1137 build (deploy `_site/` to the chosen host + add the gate), and re-`/slice` #1104 so phases 3–5 can be scoped against the now-known platform.
