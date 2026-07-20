---
kind: story
size: 2
parent: "1104"
status: resolved
dateOpened: "2026-07-09"
dateStarted: "2026-07-09"
dateResolved: "2026-07-09"
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

## Resolution (2026-07-09)

All three checklist lines closed:

- **Privacy notice** — published at `/privacy/` (`we:src/privacy.njk`): names Cloudflare
  as the request-metadata processor, describes the single `we_gate` strictly-necessary
  cookie (30d, no identity/tracking payload), states plainly that no analytics/ads/
  third-party cookies run, and commits to rewriting the notice + adding a consent
  banner *before* any analytics/Zaraz/cookie ships (matching the item's re-scope
  trigger). Linked from the site footer (`we:src/_layouts/base.njk`,
  `we:src/_data/chrome.js` — the FUI mode-C chrome sidecar has its own footer copy).
  In the process, fixed a **false claim already live in both footers** — "No cookies
  were used" — which was wrong the moment `we_gate` shipped; both now read "No
  analytics, no tracking" and link `/privacy/` instead of asserting zero cookies.
  Also added `/privacy` to `we:vite.config.mts`'s dev-proxy allowlist so the page
  resolves on the Vite dev server (:3000), not just the 11ty build (:8080).
- **Repo LICENSE present + honest labeling** — added `we:LICENSE` (Apache-2.0, full
  text) and `we:LICENSE-DOCS` (CC-BY-4.0, prose) at the repo root, split exactly as
  ratified in [#098](/backlog/098-licensing-strategy/)'s resolution ("Ships as a
  LICENSE + LICENSE-DOCS pair"). `we:package.json`'s `license` field was still `MIT`
  (stale/never matched any ratified decision) — corrected to `Apache-2.0` to match
  the code license and stop the two files disagreeing.
- **Name / trademark clearance (non-infringement only)** — cheap knock-out web search,
  no live USPTO database query (out of tool reach; a full clearance search stays a
  paid-sale action under #186 if ever needed). Findings:
  - **"Web Everything"** — no colliding software/web-standards trademark or product
    found.
  - **"Frontier UI"** — an abandoned `frontier-ui` npm package exists (tiny React
    component library, v0.0.1, last published years ago, no adoption signal). A soft
    naming overlap, not an active registered mark — not a blocker, worth knowing.
  - **"Plateau"** — the closest collision: "Plateau Studio," a low-code
    frontend/process-development platform, and "Plateau Systems" (talent-management
    LMS, holds registered marks in an unrelated class). Same generic-word space as
    our internal `plateau-app`, no exact-name-plus-adjacent-market registered mark
    surfaced. Worth a fuller check before any *registration* filing (#186's scope),
    but nothing here blocks continued free-tier use of the name.
  No hard collision surfaced for any of the three names at the "don't infringe before
  spending on branding" bar this line asks for.
