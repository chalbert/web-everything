# Static host + phase-1 gate mechanism for the public WE site

**Date**: 2026-06-19
**Point**: Decision-prep for #1135 — pick the static host + phase-1 shared-code gate for the `we:` Eleventy site. FINDING: the choice is not "cheapest for phase 1" but "lowest operational burden across the whole #1104 roadmap (phases 1→5) on one free substrate." Cloudflare Pages wins because Pages Functions + KV + Access host *every* later phase (per-person codes, emailed codes, real login) on the same platform with no re-platform; the phase-1 gate is best a tiny **edge function** (Pages Function checking the shared code → signed cookie), not host-native Access — Access is email-*identity* auth (the phase-5 tool), which does not match phase 1's single *shared code*. Netlify's site password *is* an exact shared-code match but is paid (Pro) and is a dead-end for phase 3 per-person codes.
**Research page**: /research/static-host-phase1-gate/
---

## Question

Two coupled sub-decisions, the first slice of epic #1104 (publish the WE site publicly, gated):

1. **Host** for the `we:` Eleventy static build (`npm run build:docs` → `eleventy`, output `_site/`), judged on solo-founder operational burden: minimal always-on surface, free/cheap, git-push deploy.
2. **Phase-1 gate mechanism** — where the single *shared entry code* check lives. Explicitly **not a security boundary**; phase 1 only keeps anonymous/casual traffic out (it protects nothing secret). Host-native access control may collapse the gate into the host pick.

The coupling matters because #1104 is a *graduated* roadmap: phase 1 shared code → phase 2 analytics → phase 3 **per-person codes** (needs a tiny code store) → phase 4 **emailed codes** (transactional email + audience list) → phase 5 **maybe real login**. The right phase-1 pick is the one whose substrate carries the later phases without re-platforming.

## Recommendation

- **Host → Cloudflare Pages.** Free tier (unlimited bandwidth/requests, 500 builds/mo), git-push deploy of `_site/`, and — decisively — the *whole later roadmap lives on one platform*: Pages Functions (edge gate, free 100k req/day), Workers KV (phase-3 per-person code store, free 100k reads/day · 1k writes/day — ample for an invite list), Workers email bindings (phase-4), Cloudflare Access (phase-5 identity login, free ≤50 users). No re-platform at any notch.
- **Gate → edge function (Pages Function).** A ~20-line function reads the shared code (POST from the splash form), compares to a server-side secret, sets a signed/HttpOnly cookie, and 302s in. Free, fully controlled, serverless (no always-on surface — fits the #181/#182 "one always-on endpoint" constraint), and it is *the exact seam* phase 3 extends from `code === SECRET` to a KV lookup. Host-native Access is **rejected for phase 1** because it is email-OTP/SSO identity, not a shared code — it is the phase-5 tool, not phase 1's.

Confidence: **~80%.** This is a soft, explicitly-revisitable, low-stakes call (per the item and [[feedback_monetization_soft_accepted_revisitable]] spirit — operational, reversible). The residual is mostly "is single-platform lock-in to Cloudflare worth more than Netlify's zero-code phase-1 password" — the answer is yes *only because* phases 3–5 are on the roadmap; if the project never escalates past phase 1, Netlify's one-setting password (or even a client-side gate) would be simpler.

## Key Findings

### Host comparison

| Host | Free static hosting | Git-push deploy | Native shared-code gate | Carries phases 3–5? | Always-on surface |
|---|---|---|---|---|---|
| **Cloudflare Pages** | ✅ unlimited bw/req, 500 builds/mo | ✅ | ⚠️ Access = email identity, not a shared code (use a Pages Function) | ✅ Functions + KV + email + Access, all free, one platform | none (serverless) |
| Netlify | ✅ (100GB bw) | ✅ | ✅ site password — but **Pro plan only** (~$19/mo); free fallback = `_headers` Basic Auth | ⚠️ Functions + Blobs exist but a second story per phase; password is a dead-end for per-person | none (serverless) |
| Vercel | ✅ | ✅ | ⚠️ password protection = paid (Pro); more app-server oriented than a static site needs | ⚠️ Functions/KV exist; overkill posture | none (serverless) |
| GitHub Pages | ✅ | ✅ | ❌ none | ❌ would need an added edge layer anyway | none |

Sources: Cloudflare Pages free tier (unlimited bandwidth/requests, 500 builds/mo); Workers/Pages Functions free 100k req/day; Workers KV free 100k reads/day, 1k writes/day, 1GB; Cloudflare Access free ≤50 users; Netlify site-wide password requires Pro plan (free `_headers` Basic Auth fallback).

### Gate mechanism comparison

| Mechanism | Phase-1 fit (shared code) | Cost / code | Carries to phase 3 (per-person)? | Notes |
|---|---|---|---|---|
| Host-native access control | ⚠️ Cloudflare Access is *identity* (email OTP/SSO), not a shared code; Netlify password *is* a shared code but paid | least code (if paid) | ❌ Access ≠ codes; Netlify password ≠ per-person | "collapses both forks" only on Netlify (paid) |
| **Edge function (Pages Function / Worker)** | ✅ exact: checks the shared code, sets cookie | ~20 lines, free | ✅ same function swaps `=== SECRET` → KV lookup | server-side secret; the seam the roadmap extends |
| Client-side JS gate | ✅ works for "keep the public out" | cheapest | ❌ content ships to client; per-person needs a real check | acceptable phase 1 only, **not** beyond (item is explicit) |

### Why the recommended default survives a red-team

The skeptic's attack is "you're picking the *most* infrastructure for the *least* requirement — phase 1 only needs one password, and Netlify gives that as a checkbox." The rebuttal: the requirement isn't phase 1, it's the **roadmap**. #1104 is explicitly a graduated escalation, and three of its five phases (3 per-person codes, 4 emailed codes, 5 login) need server-side state/compute. Netlify's password is a *local optimum* that re-opens this exact decision at phase 3 (where does the code store live, on what platform). Cloudflare Pages pays the (near-zero) phase-1 cost of a ~20-line function to never re-platform. The default is "lowest *roadmap* burden," not "lowest phase-1 burden" — and is soft/revisitable if the roadmap stalls at phase 1.

## Files Created/Modified

| File | Action |
|---|---|
| `we:reports/2026-06-19-static-host-phase1-gate.md` | created (this report) |
| `we:src/_data/researchTopics.json` | added `static-host-phase1-gate` entry |
| `we:src/_includes/research-descriptions/static-host-phase1-gate.njk` | created (research write-up) |
| `we:backlog/1135-choose-static-host-phase-1-gate-mechanism-for-the-public-we-.md` | rewritten to prepared-fork shape, `preparedDate` set |
