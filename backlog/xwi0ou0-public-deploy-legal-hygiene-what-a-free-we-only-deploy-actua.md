---
kind: story
size: 2
parent: "1104"
status: open
dateOpened: "2026-07-09"
tags: [legal, privacy, gdpr, license, trademark, deployment, solo-founder]
crossRef: { url: /backlog/186-legal-business-protection-review/, label: "Pre-sale professional review — the paid-sale half (#186)" }
---

# Public-deploy legal hygiene — what a free WE-only deploy actually needs (privacy notice, LICENSE, name clearance)

Split out of [#186](/backlog/186-legal-business-protection-review/): the subset of
legal hygiene gated by **any public deploy** — including a free WE-only site — rather
than by charging money. Distinct trigger, distinct readiness: this is **agent-draftable
and near-term**, whereas #186's remainder is the deferred human professional-services
review. Homed here under the public-rollout epic ([#1104](/backlog/1104-publish-the-website-publicly-gated-controlled-rollout/)),
**not** under commercialization (#181) — none of this is about taking payment.

Grounded in the actual deploy (`we:wrangler.toml`, `we:worker.js`):
**no analytics, no third-party tracking, exactly one strictly-necessary functional cookie**
(`we_gate`, a signed HMAC access-gate cookie, 30d) → **consent-exempt, no cookie banner.**
So the burden is genuinely small.

Checklist:

- **Privacy notice** — a short published notice: served via Cloudflare (a data
  *processor*) which processes IP/request metadata for security and performance;
  one strictly-necessary `we_gate` functional cookie (30d); no analytics or
  third-party cookies → no consent banner. GDPR-aligned because IP is personal data
  even absent a cookie. **Re-scope the moment any analytics/Zaraz/cookie is added** —
  that crosses into consent-banner territory and this line grows.
- **Repo LICENSE present + honest labeling** — a `we:LICENSE` file exists and the public
  surface labels what's open vs. reserved truthfully. The OSS/commercial *split policy*
  itself stays a decision in [#098](/backlog/098-licensing-strategy/); this line is
  only "a license is present and the labeling isn't misleading."
- **Name / trademark clearance (non-infringement only)** — a cheap knock-out search that
  "Web Everything" / "Plateau" / "Frontier UI" don't collide with an existing mark
  before public branding spend. **Registration** (filing our own marks) is the paid-sale
  concern and stays in #186.

Explicitly **out of scope** (all in #186, gated by first paid sale): legal entity,
trademark registration, commercial-license counsel, product EULA, E&O insurance, DPA.
