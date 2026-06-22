---
kind: epic
status: open
dateOpened: "2026-06-19"
tags: [deployment, hosting, gated-access, controlled-rollout, analytics, auth, website, webdocs, solo-founder]
crossRef: { url: /backlog/181-commercialization-infrastructure/, label: "Commercialization infra — auth/payments/legal (#181)" }
relatedReport: reports/2026-06-19-1104-split-analysis.md
---

# Publish the website publicly — controlled, gated rollout (splash → codes → login)

Stand the Web Everything website up on the public internet, but **controlled**: it stays
behind a gate the whole way, opening one notch at a time. The site today has **no public
deployment** (Eleventy docs run only on localhost — `we:` Eleventy at :8080, Vite demos at
:3000). This epic owns making it reachable, gated, measured, and progressively more
real — without ever flinging the doors open.

The through-line is **graduated access control**, cheapest-first. Each phase is a real,
shippable notch; we only build the next notch when we want it. Nothing here is "real auth"
until the final phase — the early gates are deliberately lightweight (keep casual/anonymous
traffic out, let invited people in), not a security boundary protecting secrets.

> **Owner requirement (2026-06-19) — phase 2 gates the public share.** Phase 1 (deploy +
> shared-code gate, [#1137](/backlog/1137-public-deploy-we-site-live-behind-a-splash-shared-entry-code/))
> is fine to **validate the deployment**, but the site URL is **not shared with anyone** until
> **phase 2 (analytics, [#1138](/backlog/1138-instrument-the-live-we-site-with-the-chosen-analytics/))**
> is live — measurement must be in place before real traffic arrives. This puts the analytics
> *decision* [#1136](/backlog/1136-choose-analytics-approach-for-the-public-we-site/) on the
> **critical path to the public share**, not a "later" notch. (The DAG already reflects it:
> #1138 `blockedBy` #1137 + #1136.)

## Phased roadmap (each phase = a future `/slice` candidate)

1. **Public deploy, behind a shared gate.** Put the site on a static host with a public
   **splash page** and a single **shared entry code** to get past it. Not a login — one
   code, typed once, remembers you. This is the "we're live but it's invite-word-of-mouth"
   notch.
2. **Analytics.** Know who's visiting and what they look at — privacy-respecting, controlled.
   Strong dogfooding candidate for WE's own **webanalytics** standard (the site as conformance
   proof — see [#777](/backlog/777-dogfood-the-we-docs-website-on-fui-components-rework-the-sit/)). Minimum: page views,
   referrers, which spec/standard pages get read.
3. **Unique code per person.** Replace the one shared code with **per-person codes** so access
   can be granted and revoked individually, and so analytics/usage can be attributed to a
   person. Needs a tiny store of valid codes.
4. **Send a code + associate an email.** Issue a code *to an email address* — i.e. capture an
   email, mint a code, deliver it. Now there's an identity (email) behind each code, a request/
   invite flow, and a (small) audience list. Needs transactional email.
5. **Maybe a real login.** Eventually graduate the email+code into an actual login (session,
   "log back in" without re-entering an emailed code). Overlaps the auth work in **#181**;
   strong dogfooding candidate for WE's **webidentity** standard. "Maybe" — only if the
   controlled-access need actually warrants it.

The phases compose: each is usable on its own, and 3→4→5 is the natural escalation from
"a code" to "a code tied to you" to "an account."

## Open decisions to carve during `/slice` (not pre-settled here)

These are genuine forks; this umbrella does **not** decide them — they become `type:decision`
children (or get folded into a phase story) when sliced:

- **Host.** Static-site host for an Eleventy build (Cloudflare Pages / Netlify / Vercel / GitHub
  Pages / …). Soft, revisitable, low-stakes — pick on operational burden for a solo founder.
- **Gate mechanism (phase 1).** Where the shared-code check lives: edge/host access control
  (e.g. Cloudflare Access, Netlify password) vs. an edge function vs. a client-side gate. Note a
  client-side gate is **not** real security — acceptable for phase 1's "keep the public out,"
  not beyond. Picking a host with built-in access control may collapse this fork.
- **Code store (phase 3).** Where per-person codes live (host KV / a tiny endpoint / a flat list)
  — sized to the solo-founder "minimal always-on surface" constraint (cf. #181's one always-on
  endpoint, #182).
- **Email delivery (phase 4).** Transactional email provider / mechanism for sending codes.
- **Login end-state (phase 5).** Whether/how this becomes real auth, and how it relates to
  **#181** (commercialization auth) so we don't build two auth stacks.

## Boundary — what this is NOT

- **Not the commerce stack.** #181 (auth/payments/legal to *charge money*) and its children
  (#182 license keys, #183 payments) are about selling a product ([monetization](docs/agent/platform-decisions.md#monetization)). This epic is about *controlled
  public exposure of the site itself*. They converge only at phase 5 (login) — cross-ref, don't
  merge. #181 is deprioritized "until the product is in a much better state"; this epic is **not**
  blocked on that — controlled exposure is useful before there's anything to sell.
- **Not the marketing/pricing conversion site.** #184 (parked, blocked on the MVP pick #097) is
  landing-page *copy + pricing*. This epic is the *plumbing* (hosting + gate + analytics) that a
  marketing surface would later sit on top of.
- **Not a standards artifact.** This is operational infrastructure for the project's own site, not
  a new WE standard — though phases 2 and 5 are prime opportunities to **dogfood** existing WE
  standards (webanalytics, webidentity) and make the live site double as conformance proof.

## Child slices (sliced 2026-06-19 — see we:reports/2026-06-19-1104-split-analysis.md)

Phases 1–2 are sliced; phases 3–5 are deferred (each buries a fork shaped by the phase-1 host
choice — re-`/slice` this epic once the host is known). Enumerate live children by the `parent:`
field, not this list (it can go stale).

- **#1135** — *decision*: choose static host + phase-1 gate mechanism. (no blockers)
- **#1136** — *decision*: choose analytics approach (dogfood webanalytics vs third party). (no blockers)
- **#1137** — *story*: public deploy — site live behind splash + shared entry code. (blockedBy #1135)
- **#1138** — *story*: instrument the live site with the chosen analytics. (blockedBy #1137, #1136)

**Deferred (still described above, not yet scaffolded):** phase 3 (per-person codes), phase 4
(send code + associate email), phase 5 (maybe a real login — overlaps #181). Unblocking action:
ship #1135 + #1137, then `/slice` #1104 again.
