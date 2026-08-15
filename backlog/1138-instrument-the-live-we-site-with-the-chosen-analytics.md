---
kind: story
size: 3
parent: "1104"
status: open
blockedBy: ["1137", "1136"]
scope: ["we:src/_layouts/base.njk", "we:src/privacy.njk", "we:src/_data/site.js", "we:.github/workflows/deploy.yml", "we:functions/README.md"]
dateOpened: "2026-06-19"
tags: []
---

# Instrument the live WE site with the chosen analytics

Wire the analytics approach chosen in #1136 into the live gated site from #1137. Minimum signal: page views, referrers, and which spec/standard pages get read. Privacy-respecting and controlled. Leaves a valid demoable state: a live gated site that reports who visits and what they read. Slice of #1104.

## Readiness note (prepared 2026-08-15) — blockedBy is live-verified, not stale

`#1136` is `resolved` (ratified interim: Cloudflare Web Analytics). **`#1137` is still `status: open`**,
so by the letter of `blockedBy` this item remains blocked — verified against the live card, not assumed.
But `#1137`'s *own* body says its only residual is a **human DNS step** (point the Squarespace domain at
the Worker, `workers_dev=false`); the artifact this story actually needs — a live, reachable, gated site to
instrument — already exists and was re-verified live during this preparation:

```
$ curl -s -o /dev/null -w "%{http_code}\n" https://web-everything.nicgilbert.workers.dev/
200
```

Cloudflare Web Analytics is a client-side beacon keyed by a site token; it does not require the target to
be a Cloudflare *zone* (custom domain) — the "manual/JS-only" setup Cloudflare documents for exactly this
case works unchanged on a `*.workers.dev` URL, and keeps working after the domain switch with no code
change. So this story's design and build do not technically depend on `#1137`'s remaining domain step.

**This is a finding, not a decision I'm making unilaterally.** `#1104` frames the `#1138`-blockedBy-`#1137`
edge as a deliberate **"Owner requirement (2026-06-19)"** ("the site URL is not shared with anyone until
phase 2 is live") — that may be about not exposing the URL more broadly until analytics is live, not a
technical gate, but it was human-authored intent and I'm not overriding it as part of preparation.
**`blockedBy` is left unchanged.** Flagging for the operator: either (a) build this now against the live
`workers.dev` deploy — analytics coverage starts before the domain switch, arguably the safer order given
`#1104`'s own "measure before real traffic arrives" concern (word-of-mouth traffic could already be
hitting `workers.dev`); or (b) hold until `#1137` resolves. The design below is unaffected by which is
picked.

## Consumer check

No other backlog item or script references `we:src/_data/site.js`'s exported fields, `we:src/privacy.njk`,
or the footer copy in `we:src/_layouts/base.njk` (`grep`-verified: no ES importers of `we:src/_data/site.js`
outside `we:.eleventy.js`'s data-cascade require; no test asserts the current "No analytics" copy —
`we:functions/__tests__/gate.test.ts` only exercises `we:worker.js`'s gate logic, a separate template). The
one load-bearing consumer found is the **privacy notice's own prior commitment** (see below) — not a code
consumer, a textual promise already live on the site.

## Decided design

**Interim bridge only — the `#1136`-ratified Cloudflare Web Analytics, added at Eleventy build time, not at
the Worker.** No fork remains open; `#1136` already ruled it. Three concrete calls this preparation makes
that the decision didn't spell out at file level:

1. **Where the beacon loads from: the Eleventy layout, not `we:worker.js` / `HTMLRewriter`.** The static
   `_site/` build already renders every page through one shared layout
   ([we:src/_layouts/base.njk](../src/_layouts/base.njk)); adding the CF beacon `<script>` there is free
   (zero runtime cost, no Worker-side HTML rewriting) and reaches every page for free — including every
   spec/standard page, which is what gives the "which spec/standard pages get read" signal without any
   route-specific code.
2. **The token is build-time-injected, not committed.** Cloudflare Web Analytics tokens aren't secret (they
   are meant to sit in public page source), but hard-coding one now means a future token rotation is a code
   change instead of a config change, and — more importantly — it means every local dev-server run or
   pre-deploy build check on a laptop would also ship the beacon to the *same* production dashboard,
   polluting the real numbers with dev traffic. Mirror the existing `we:src/_data/site.js` pattern
   (`process.env.SITE_URL`, `process.env.COMPONENT_NAMESPACE`, both already env-driven with an empty/default
   fallback): add `analyticsBeaconToken: process.env.WE_ANALYTICS_BEACON_TOKEN || ""`. The layout renders the
   beacon **only when the value is non-empty** — unset locally (no env var) → no script tag, so dev/local
   builds are silently excluded by construction, not by a manual toggle someone can forget.
3. **Not wired through the `CustomTracker` seam.** `#1136`'s "same #1138 instrumentation seam" language
   refers to *this layout injection point* being the seam a later dogfood collector swaps into — not to
   building out the `CustomTracker` DI registry now. `we:analytics/provider.ts`'s `NoopTracker` /
   `we:plugs/webanalytics/CustomTrackerRegistry.ts` are for in-app product telemetry calls (`track()` from
   component code); Cloudflare Web Analytics is an out-of-band host-native beacon nothing in the codebase
   calls into. Routing it through the `CustomTracker` contract would be over-building for an interim that's
   explicitly meant to be thrown away when `#1013`'s dogfood swap lands — confirmed `#1013` is already
   `resolved` in FUI (`fui:plugs/webanalytics/segment.ts`, `fui:plugs/webanalytics/mixpanel.ts`,
   `fui:plugs/webanalytics/ga4.ts`) and none of those three is Cloudflare-native, so there's no existing
   adapter this could reuse anyway.

**Load-bearing finding: the privacy notice must be rewritten as part of this story, not after.**
[we:src/privacy.njk](../src/privacy.njk) currently states in its own words: *"no analytics, no third-party
tracking"* (lead), *"No analytics (no Google Analytics, no Cloudflare Zaraz, no first-party pixel)"* (What
isn't here), and explicitly promises: **"If that ever changes — an analytics tool, a Zaraz integration, any
additional cookie — this notice will be rewritten first and a consent banner added before the change
ships."** Shipping the beacon without rewriting this page ships a false claim on the live site the same day
— this is exactly the class of defect `we:agent-memory-src/story-preparation-checklist.md` names (a
card-level omission, not a coding mistake). The footer on every page
([we:src/_layouts/base.njk:128](../src/_layouts/base.njk#L128)) carries the same claim in miniature: *"No
analytics, no tracking"*. Both must change in the same PR that adds the beacon.

**No consent banner is needed** — Cloudflare Web Analytics is cookieless and stores no client-side state
(this is precisely why `#1136` picked it over GA4), so the ePrivacy "strictly necessary" cookie logic on the
privacy page is unaffected; only the analytics claims need rewriting, not the cookie section.

## Interfaces / protocol at every seam

- **`we:src/_data/site.js`** — add one field to the existing `module.exports` object:
  `analyticsBeaconToken: process.env.WE_ANALYTICS_BEACON_TOKEN || ""` (string, empty default — same shape
  as `url`/`componentNamespace` immediately above it in the file). No new file; extends the existing data
  cascade export other templates already read as `site.*`.
- **`we:src/_layouts/base.njk`** — inside `<head>`, after the existing `<link rel="stylesheet">` tags
  (~line 18), add:
  ```njk
  {% if site.analyticsBeaconToken %}
  <script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "{{ site.analyticsBeaconToken }}"}'></script>
  {% endif %}
  ```
  This is Cloudflare's own documented manual/JS-only snippet shape (`data-cf-beacon` JSON with a `token`
  key) — verify the exact current attribute name against the Cloudflare dashboard's "Add site → I don't
  have a website on Cloudflare" manual-setup panel when the token is provisioned (Cloudflare has changed
  this snippet's exact form before; treat the dashboard's copy-paste block as authoritative over this
  card if they've since diverged).
- **`we:src/_layouts/base.njk`, line 128** — footer copy edit only, e.g. replace *"No analytics, no
  tracking"* with *"Privacy-respecting analytics (no cookies)"*, keeping the existing
  `<a href="/privacy/">Privacy</a>` link right after it. Exact wording is copy, not a design fork.
- **`we:src/privacy.njk`** — rewrite the lead paragraph, the "What this site collects" section, and the
  "What isn't here" list to state accurately: this site now uses Cloudflare Web Analytics (host-native,
  cookieless, no client-side state, no cross-site tracking, interim until WE's own `webanalytics` collector
  ships per `#1136`); keep the `we_gate` cookie section unchanged (still accurate); keep the "this will be
  rewritten first" commitment's *spirit* satisfied by this very edit landing in the same change as the
  beacon.
- **`we:.github/workflows/deploy.yml`** — add `WE_ANALYTICS_BEACON_TOKEN` to the `env:` of the existing
  "Build WE site" step (`working-directory: web-everything`, currently `npm ci && npm run build:docs`),
  sourced from a new repo-level GitHub Actions variable of the same name (`vars.WE_ANALYTICS_BEACON_TOKEN`
  — a plain repo *variable*, not a `secrets.*` entry, because the token is not sensitive; matches the
  existing top-of-file comment block that documents `FUI_READ_TOKEN` / `CLOUDFLARE_API_TOKEN` /
  `CLOUDFLARE_ACCOUNT_ID` as the human-provisioned inputs — add this as a fourth).
- **`we:functions/README.md`** — add one short subsection next to the existing `GATE_CODE` /
  `GATE_COOKIE_SECRET` runbook entry, documenting the human step: Cloudflare dashboard → Web Analytics →
  Add a site → manual/JS-only setup (no zone needed) → copy the token → set it as the
  `WE_ANALYTICS_BEACON_TOKEN` repo variable in GitHub → Settings → Actions → Variables. This mirrors the
  existing `wrangler secret put GATE_CODE` runbook entry's shape and is the **one human/credentialed step**
  this story cannot do itself (same class as the existing Cloudflare secrets — not agent-executable).

## Tasks (ordered)

1. Add `analyticsBeaconToken` to `we:src/_data/site.js`.
2. Add the conditional beacon `<script>` to `we:src/_layouts/base.njk`'s `<head>`.
3. Edit the footer claim at `we:src/_layouts/base.njk`, line 128.
4. Rewrite `we:src/privacy.njk` (lead + "What this site collects" + "What isn't here").
5. Wire `WE_ANALYTICS_BEACON_TOKEN` through `we:.github/workflows/deploy.yml`'s build step.
6. Document the human token-provisioning step in `we:functions/README.md`.
7. Build locally with the token unset (`npm run build:check`) — confirm no beacon tag emitted, build
   succeeds. Build again with a throwaway `WE_ANALYTICS_BEACON_TOKEN` value set — confirm the tag appears
   on the home page **and** on a nested spec/standard page (e.g. a built blocks-family page under
   `_site/blocks/`), proving the layout-level injection reaches every page, not just the home page.
8. Run `npx vitest run functions` — confirm the gate's own tests are unaffected (they exercise
   `we:worker.js`, a separate template from the ones this story touches).
9. Run `npm run check:standards` — 0 errors.
10. **Human step (not agent-executable):** provision the Cloudflare Web Analytics site + token, set the
    `WE_ANALYTICS_BEACON_TOKEN` GitHub Actions variable. Until this lands the build silently ships with no
    beacon (fails closed to "no analytics yet", never to a broken build) — same fail-closed shape as the
    `#1137` gate secrets.

## Done when

- `we:src/_layouts/base.njk` emits the Cloudflare beacon `<script>` in `<head>` when
  `site.analyticsBeaconToken` is non-empty, and emits nothing when it is empty — verified by diffing a
  built page's `<head>` with the env var set vs. unset.
- The beacon tag is present on a built spec/standard page, not only the home page (grep a sample built
  page under `_site/blocks/` or `_site/intents/` for `cloudflareinsights`), demonstrating the
  page-view-by-URL signal (`#1104`'s "which spec/standard pages get read") reaches every page.
- `we:src/privacy.njk` no longer asserts "no analytics" anywhere on the page, and instead accurately
  describes Cloudflare Web Analytics (cookieless, no PII, interim until the WE `webanalytics` dogfood
  collector ships).
- `we:src/_layouts/base.njk`'s footer no longer asserts "No analytics, no tracking".
- `npm run build:check` succeeds with the token unset (no regression to the ungated local/dev build).
- `npx vitest run functions` stays green (no regression to the unrelated gate Worker).
- `npm run check:standards` is 0 errors.
- Cloudflare's Web Analytics dashboard shows page views for the live site once the human token step lands
  (not machine-verifiable pre-merge; the deploy runbook in `we:functions/README.md` names this as the
  human-verification step post-deploy).

## Delivery shape

**Lands incrementally, in one PR, behind `main` — no branch/flag needed.** Every file this touches
(`we:src/_data/site.js`, `we:src/_layouts/base.njk`, `we:src/privacy.njk`,
`we:.github/workflows/deploy.yml`, `we:functions/README.md`) is additive or copy-only; the beacon is inert
(no script tag emitted) until the human sets the GitHub Actions variable, so merging the code change and
provisioning the token are two independent, safely-ordered steps — the code can land first and sit dormant,
or the token can be provisioned first and the code lands active. No data migration, no schema.

## Preparation status

Items 1–8 of `we:agent-memory-src/story-preparation-checklist.md` are done above (scope+consumers,
size+basis, testable Done-when, decided design incl. the two calls the decision didn't resolve at file
level, interfaces at every seam, ordered tasks, delivery shape). **Item 9 (independent review of this
preparation) has not happened** — per the checklist this card is *prepared*, not yet *build-ready*, until
that review runs.
