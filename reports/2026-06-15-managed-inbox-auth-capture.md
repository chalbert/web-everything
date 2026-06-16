# Managed-inbox / auth-capture capability — build-vs-buy & the Plateau-service boundary

**Date**: 2026-06-15
**Point**: Prep research for decision [#709](/backlog/709-managed-inbox-auth-capture-capability-boundary-plateau-servi/) — where an agent's "screenshot real apps behind a login" capability lives, and how its managed email identity is built. The boundary fork is a near-exact replay of the **#475 vision ruling** (impl capability → Plateau service consumed via a thin no-leakage client seam, never a WE standard); the build-vs-buy fork is governed by Plateau's **linear-cost-with-revenue** rule (owned fixed-cost floor; metered-per-email SaaS is a BYO tier, never the floor).
**Research page**: `/research/managed-inbox-auth-capture/`

---

## Question

[#611](/backlog/611-app-screenshot-access-system-managed-email-inbox-for-logged-/) wants a system that lets an agent screenshot authenticated app interiors (dashboards, post-signup UI) for the exercise-app conformance loop and competitive capture. The hard part is getting past signup/login, which needs a **managed email identity** the agent controls end-to-end: create inboxes, read verification/magic/OTP mail, drive signup via Playwright, vault credentials. Two questions block the build:

1. **Boundary** — does that capability live in **Plateau** (a service WE consumes as a no-leakage client) or as **repo-local devtooling** in WE's capture scripts?
2. **Build vs buy** — programmable-inbox SaaS vs an owned-domain catch-all vs a thin self-hosted IMAP+API; plus the abuse/ToS guardrails and the linear-cost check.

## Recommendation

- **Boundary → Plateau service + thin no-leakage WE client seam** (mirrors #475 exactly). The managed email identity is stateful, credential-bearing infra with an operational lifecycle — an *impl capability*, not a standard. By the #475 ruling it belongs in Plateau; WE's capture devtooling holds only a thin, swappable, vendor-free client seam (the `design-refs/vision.mjs` precedent, env-selected provider), repointed at the Plateau service when it exists. Owning the capability inside the WE standards repo (Fork 1/B) rebuilds in WE what Plateau should own and drags credential-vaulting + signup automation into the standards layer.
- **Build vs buy → owned-domain catch-all, fixed-cost, as the floor; metered SaaS as an opt-in BYO tier.** Plateau's linear-cost-with-revenue rule excludes uncapped per-email SaaS as the *floor* (cost scales with capture volume, not revenue). The cheapest owned realization is a catch-all on an owned domain via **Cloudflare Email Routing + Email Workers (free)**; the fully-owned alternative is a small self-hosted catch-all (**Stalwart** / maddy, IMAP). Both are fixed-cost. The exact realization is a **Plateau implementation sub-choice** (delegated to the Plateau build); WE states the floor + the constraint.

## Key Findings

### The landscape — three categories, only one fits the job

| Category | Examples | Receives real internet mail? | Cost model | Fit |
|---|---|---|---|---|
| **Programmable-inbox SaaS** | MailSlurp (18+ SDKs), Mailosaur ($19–$199/mo, no free tier), Mailsac (free=public), testmail.app | Yes (vendor domain) | **Metered** per inbox/email | Fast to wire, but per-call cost + ToS often bar third-party signups → a *tier*, not the floor |
| **Inbound-parse on owned domain** | Cloudflare Email Routing + Workers (**free**), Postmark inbound (MX→webhook), SendGrid/Mailgun inbound | Yes (your domain) | Free (CF) → metered (Postmark/SG) | **Owned identity**; CF Routing is fixed-cost catch-all → the recommended floor |
| **Dev SMTP sinks** | Mailpit, Inbucket | **No** — capture your *own* outbound SMTP only, no MX | Free (self-host) | **Wrong tool** — cannot receive a third-party site's verification mail (common confusion) |

The decisive distinction: Mailpit/Inbucket are for testing *your own app's outbound* email and have no public MX, so they cannot catch a target product's verification link. The capability here needs **inbound mail on an owned identity**, which means either a metered SaaS inbox or an owned domain with catch-all routing.

### Linear-cost lens (Plateau hard rule)

- Per-inbox/per-email SaaS (MailSlurp/Mailosaur) = metered → cost scales with *capture volume*, not revenue → fails the floor rule.
- Owned domain (~$10/yr) + **Cloudflare Email Routing catch-all + Email Workers (free)** = fixed-cost owned capability → satisfies the rule. A self-hosted Stalwart/maddy catch-all on the Plateau box is the fully-owned alternative (fixed VPS cost). Inbound delivery needs no DKIM/SPF sending reputation — *receiving* is materially easier to self-host than sending.
- BYO-key SaaS = an optional *tier* for a quick start (matches "BYO-key is a tier, not the floor").

### Abuse / ToS guardrails (invariants, not a fork)

Automated third-party signups carry ToS risk on **both** the inbox vendor and the target site; many sites prohibit automated account creation, and disposable-inbox vendors' ToS commonly restrict signing up to services you don't own. Required-by-default constraints: only sign up where the target's terms permit (own products / free tiers that allow automation); never circumvent CAPTCHA or anti-bot; respect rate limits and robots; vault credentials (never commit); a fresh owned inbox per site/run. These are a fixed guardrail set, not a decision branch.

### Classification (per-fork pass)

- **Layer:** Capability (impl/infra), not Block/Intent/Protocol — *no runnable standard code*, it's a service + a tool-time client. Same class as vision (#475/#480).
- **Protocol?** No — no independent-vendor interop/swap story at the standard level. The thin seam is a **devtools provider seam** (a plain injected client consulted by a tool at capture time), not a registry/protocol — exactly the `vision.mjs` shape (env-selected provider module), per the runtime-DI-vs-devtools-provider distinction.
- **DI-injectable / default:** Yes — the identity provider is injected by name (cf. `DESIGN_REFS_VISION_PROVIDER_MODULE`); default = the fixed-cost owned provider, with SaaS opt-in.
- **Separate-and-decouple:** capability (Plateau service) decoupled from the consumption seam (WE devtools client) — satisfied, identical to #475.
- **Fork-existence test:** Fork 1 is close to a *forced invariant* (A is correct by #475; B is the broken branch). Fork 2's floor is forced by the linear-cost rule; the genuine remaining call is the owned realization (CF Routing vs self-host), delegated to the Plateau build.

## Files Created/Modified

| File | Action |
|---|---|
| `reports/2026-06-15-managed-inbox-auth-capture.md` | Created — this report |
| `src/_data/researchTopics.json` | Added `managed-inbox-auth-capture` topic |
| `src/_includes/research-descriptions/managed-inbox-auth-capture.njk` | Created — research write-up |
| `backlog/709-managed-inbox-auth-capture-capability-boundary-plateau-servi.md` | Rewritten to prepared-fork shape; `preparedDate` set; `relatedReport` linked |
