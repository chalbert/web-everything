---
type: decision
workItem: story
size: 2
parent: "1104"
status: resolved
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: none
codifiedIn: one-off
preparedDate: "2026-06-19"
relatedReport: reports/2026-06-19-1136-analytics-approach.md
relatedProject: webanalytics
tags: []
---

# Choose analytics approach for the public WE site

How to measure the live, gated WE site (phase 2 of [#1104](/backlog/1104-publish-the-website-publicly-gated-controlled-rollout/)). **Prepared**: a prior-art survey is published at [/research/privacy-respecting-site-analytics/](/research/privacy-respecting-site-analytics/) (session report linked via `relatedReport`). The load-bearing finding reshaped the item: WE's own `webanalytics` standard has a settled contract but **no runnable collector yet**, so the three original "options" collapse to **one ratify** (dogfood is the end-state) **+ one genuine fork** (which interim bridge until the collector ships), with a recommended default in **bold**. Decidable now; the build ([#1138](/backlog/1138-instrument-the-live-we-site-with-the-chosen-analytics/)) waits on the deploy ([#1137](/backlog/1137-public-deploy-we-site-live-behind-a-splash-shared-entry-code/)).

## Ruling — RATIFIED 2026-06-19 (~Med confidence; soft, revisitable)

1. **End-state (ratified):** measure the live WE site by **dogfooding `webanalytics`** — the site as conformance proof, per the #777 dogfood goal. "Third-party permanently, never dogfood" is the only excluded branch. No standard is created or modified (layering already settled, #1012).
2. **Fork 1 — interim bridge until the dogfood collector ships → (A) host-native privacy analytics (Cloudflare Web Analytics).** Cookieless, zero-ops, no extra third party (already on CF), nothing to rip out on swap. **Contingency (load-bearing):** if [#1135](/backlog/1135-choose-static-host-phase-1-gate-mechanism-for-the-public-we-/) does *not* land on a host with native privacy analytics, fall to **(B) a self-hosted open tool** (Plausible CE / Umami / GoatCounter). The *ruling* (host-native-first, self-hosted-open fallback) survives any host; only the concrete product tracks #1135. C (hosted SaaS) and D (no interim) stay rejected.
3. **Red-team:** the B attack (day-one data ownership + export) does not land — for a throwaway gated-beta interim, exportable history is not load-bearing, and A carries no project-facing lock-in; minimize-lock-in is satisfied. Residual = the #1135 host pick, encoded as the contingency above.

The interim bridge swaps out for the dogfood collector behind the same #1138 instrumentation seam (later: #1013 + a WE-site `CustomTracker` adapter). This is operational infra for the project's own site, not a WE standard → `graduatedTo: none`.

## Recommended path at a glance

| The call | Recommended | Main alternative | Confidence |
|---|---|---|---|
| End-state (ratify) | **Dogfood `webanalytics`** (site as conformance proof) | third-party permanently (*excluded*) | High |
| Fork 1 — interim bridge | **Host-native privacy analytics (Cloudflare Web Analytics)** | self-hosted open tool (Plausible CE / Umami / GoatCounter) | Med — divergent on the #1135 host pick |

## Ratify — dogfood `webanalytics` is the end-state (not a fork)

Measuring the live site via WE's own standard is the ratified **dogfood-the-site goal** ([#777](/backlog/777-dogfood-the-we-docs-website-on-fui-components-rework-the-sit/); #1104 phase 2 names webanalytics "a strong dogfooding candidate"). The only excluded branch is **"third-party permanently, never dogfood"** — it contradicts that goal and advances no standard. So this is a one-line **ratify**, not a weigh. The interim bridge (Fork 1) swaps out for the dogfood collector once it ships, behind the same #1138 instrumentation seam.

This decision **creates/modifies no standard** — `webanalytics`' layering is already settled (#1012: contract→WE, vendor adapters→FUI). It is an operational deployment pick for the WE project's *own* live site.

## Fork 1 — which interim analytics bridge

**Why this is a fork (case b — genuine either/or):** `webanalytics` is `status: draft` — the `CustomTracker` contract shipped and is conformance-tested (#1012: [we:analytics/contract.ts](analytics/contract.ts), the `NoopTracker` default at [we:analytics/provider.ts:30-41](analytics/provider.ts#L30-L41) that **silently drops every call**, the [we:plugs/webanalytics/CustomTrackerRegistry.ts](plugs/webanalytics/CustomTrackerRegistry.ts) DI registry), **but there is no runnable collector**. The reference vendor adapters are [#1013](/backlog/1013-webanalytics-reference-vendor-adapters-segment-mixpanel-ga4-/) — open, `locus: frontierui`, *blocked-in-fact* (the contract is not yet replicated into FUI). So a live site instrumented today reports **nothing**; dogfooding live = **building a collector first** — a build, not wiring — while the early-adopter signal window is open *now*. Until that collector exists, exactly one interim approach gets deployed for phase 2; the branches cannot coexist. (The "dogfood now vs third-party now" framing is *not* this fork — it's prioritization: both end at dogfooding and differ only on *when* to pay the collector cost, which is backlog ordering, not a design branch.)

All viable options are **cookieless / no-PII / no-consent-banner** (the epic's privacy bar), so the decisive merit axis is **operational burden + data ownership + throwaway-on-swap** — see the survey table in [/research/privacy-respecting-site-analytics/](/research/privacy-respecting-site-analytics/).

- **A — Host-native privacy analytics (Cloudflare Web Analytics). ← recommended default.** Free with Cloudflare Pages (the ~80% host pick in [#1135](/backlog/1135-choose-static-host-phase-1-gate-mechanism-for-the-public-we-/) / [/research/static-host-phase1-gate/](/research/static-host-phase1-gate/)), cookieless, no client state, delivers the minimum signal (page views, referrers, top pages), **zero ops, no extra third party** (you're already on CF), and **nothing to rip out** when the dogfood collector arrives — you just stop using it. *Contingency:* this presumes #1135 lands on a host with native privacy analytics; if not, fall to B.
- **B — Self-hosted open tool (Plausible CE / Umami / GoatCounter).** Full raw-data ownership and export, still privacy-respecting. *Tradeoff:* an ops surface to run during a throwaway interim. The right default **only** if the chosen host has no native privacy analytics, or if raw-data ownership is wanted before the collector ships.
- **C — Hosted privacy SaaS (Plausible Cloud / Fathom).** *Rejected* — a paid third-party data processor for no merit gain over A/B on a privacy-first, low-traffic gated beta.
- **D — No interim; wait for the dogfood collector.** *Rejected* — forfeits signal during the only early-adopter window for ~zero saving, since A is free + zero-ops. (GA4 is excluded throughout — it is not privacy-respecting and needs a consent banner.)

---

## Context

**The item's three original options, resolved.** "Dogfood the standard" = the end-state ratify above. "Both, sequenced" = the *resolved shape* of this whole item (ratify the dogfood end-state **+** Fork-1 interim bridge), not a third peer. "Third-party" splits into Fork 1's A/B/C by *who hosts the data*.

**Couplings & sequencing.** The concrete interim product tracks the host decision #1135 (A presumes Cloudflare Pages). The *ruling* — host-native-privacy-first, self-hosted-open fallback — survives any host, so this is decidable now without blocking on #1135. The build [#1138](/backlog/1138-instrument-the-live-we-site-with-the-chosen-analytics/) is already `blockedBy` #1137 (deploy) + #1136 (this); the dogfood swap-in is the later #1013 + a WE-site `CustomTracker` adapter, behind the same instrumentation seam.

**Disposition.** Soft, explicitly-revisitable, low-stakes (operational infra for the project's own site, not a WE standard).
