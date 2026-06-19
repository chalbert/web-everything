# Analytics approach for the public WE site — decision-prep (#1136)

> Prep artifact for [#1136](/backlog/1136-choose-analytics-approach-for-the-public-we-site/), phase 2 of
> epic [#1104](/backlog/1104-publish-the-website-publicly-gated-controlled-rollout/). Promoted to the
> `/research/` topic `privacy-respecting-site-analytics`. No human judgment recorded here — this brings the
> fork to Definition of Ready.

## The question

How should the live, gated WE site (private beta) be measured? Minimum signal the epic asks for: **page
views, referrers, and which spec/standard pages get read** — privacy-respecting and controlled. The item
named three candidate branches: dogfood WE's own `webanalytics` standard; a privacy-respecting third party
(e.g. Plausible); or both, sequenced.

## Finding 1 — the load-bearing fact: the dogfood collector does not exist yet

`webanalytics` is `status: draft` (`we:src/_data/projects.json:123-130`). The **contract** layer shipped
and is conformance-tested (#1012 resolved, `graduatedTo: we:plugs/webanalytics/CustomTrackerRegistry.ts`):

- `we:analytics/contract.ts` — type-only `CustomTracker` (`identify`/`track`/`page`/`group`, Segment Spec
  vocabulary).
- `we:analytics/provider.ts:30-41` — `NoopTracker`, the native-first default: **fire-and-forget, every
  call silently dropped.**
- `we:plugs/webanalytics/CustomTrackerRegistry.ts` — injector-resolvable registry + routing.
- `we:demos/analytics-conformance-demo.ts` — 6 in-browser invariant checks (green).

But there is **no runnable collector / backend**. The reference vendor adapters (Segment/Mixpanel/GA4) are
#1013 — **open**, `locus: frontierui`, and *blocked-in-fact*: the contract "does not exist in FUI yet"
(no `fui:analytics/`, no `@webeverything/contracts/analytics`), so the adapters cannot be built until the
contract is replicated/published across the #700/#872 distribution seam.

**Consequence:** a live site calling `page()`/`track()` against the default registry today reports
*nothing* — it dogfoods the *contract* but produces *zero signal*. Dogfooding live therefore requires
**building a real `CustomTracker` impl + collector first** (a WE-site adapter pointing at a backend, or the
self-host of an open collector). That is a build, not a wiring task — and the early-adopter signal window
is open *now*, during the private beta.

## Finding 2 — the host coupling: #1135 likely lands on Cloudflare Pages

The sibling host decision #1135 (`/research/static-host-phase1-gate`) recommends **Cloudflare Pages**
(~80%) because it carries the whole #1104 roadmap (Functions + KV + email + Access) on one free platform.
That matters here: **Cloudflare Web Analytics** is bundled free with Pages, is **cookieless**, collects
**no PII / sets no client-side state**, needs no consent banner, and is enabled with one toggle (a single
beacon script, or server-side via the Pages binding). It delivers exactly the minimum signal — page views,
referrers, top pages — with **zero extra third party** (you are already on Cloudflare) and **nothing to
rip out later** (you just stop using it).

So the cheapest privacy-respecting interim is *contingent on* the host: if #1135 → Cloudflare Pages, the
interim is "flip on CF Web Analytics, done." If the host has no native privacy analytics, the interim
falls back to a self-hosted open tool.

## Finding 3 — prior-art survey: privacy-respecting analytics options

All of these are **cookieless / no-PII / no-consent-banner** (the privacy bar the epic sets); they differ
on data-ownership, operational burden, and cost. None ships visitor identity to an ad network (the
GA/GA4 anti-pattern), which is why GA4 is excluded outright for a privacy-respecting beta.

| Tool | Model | Cost | Ops burden | Data ownership | Notes |
|---|---|---|---|---|---|
| **Cloudflare Web Analytics** | host-native | free (with Pages) | ~zero (toggle) | CF holds aggregates | cookieless, no consent; **dominant if on CF Pages** |
| **Plausible CE** | self-host (AGPL) | free + a small server | runs a container + DB | full, raw export | the canonical privacy-analytics reference |
| **Umami** | self-host (MIT) | free + a small server | container + Postgres | full, raw export | lighter than Plausible; SQL access |
| **GoatCounter** | self-host *or* free hosted (non-commercial) | free | single Go binary + SQLite | full | lowest self-host footprint |
| **Server-log (GoAccess)** | parse host access logs | free | a cron/report job | full | no client script at all; coarse (no SPA route events) |
| Plausible Cloud / Fathom | hosted SaaS | **paid** (~$9–14/mo) | zero | vendor holds it | a paid third-party data processor — no merit gain over the free options here |
| GA4 | hosted SaaS | free | low | Google holds it; ad-network coupling | **excluded** — not privacy-respecting; needs a consent banner |

**Takeaway:** on a privacy-first, low-traffic, gated beta the decisive axis (privacy already held by all
viable options) is **operational burden + data ownership + throwaway-on-swap**, not features. Host-native
(CF Web Analytics) wins on burden and throwaway; self-hosted open tools win on raw-data ownership at an
ops cost; hosted SaaS adds a paid third-party processor for nothing the free tiers don't give.

## Finding 4 — the standing test collapses the three "options" to one ratify + one fork

The item's three options are not three peers:

- **"Dogfood the standard" as the *end-state*** is not a contested call — it is the ratified
  dogfood-the-site goal (#777; #1104 phase 2 names webanalytics "a strong dogfooding candidate"). The
  excluded branch is **"third-party permanently, never dogfood,"** which contradicts that goal and advances
  no standard. → a **ratify**, not a weigh.
- **"Dogfood now vs third-party now"** is *not* a merit fork — it is **prioritization wearing a fork's
  clothing** (both agree the end-state is dogfooding; they differ only on *when* to pay the collector-build
  cost, given Finding 1 says it is not built). Per *fork-is-not-a-prioritization*, that is a backlog
  ordering question (the collector build = #1013 + a WE-site adapter), not a design branch.
- **"Both, sequenced"** is therefore not a third option — it *is* the resolved shape: ratify the dogfood
  end-state **+** pick an interim bridge until the collector ships.

What remains as a genuine **case-(b) either/or** (coherent branches that cannot coexist as "the phase-2
approach"): **which interim bridge** — the only thing a human actually decides here.

## Recommendation (to ratify in #1136)

1. **Ratify:** measure the live site via WE's own `webanalytics` standard as the **end-state** (site as
   conformance proof). The interim bridge swaps out once #1013 + a WE-site `CustomTracker` adapter ship,
   behind the same #1138 instrumentation seam.
2. **Interim bridge (the one fork) → host-native privacy analytics (Cloudflare Web Analytics)**, ~med-high
   *contingent on #1135 → Cloudflare Pages*. Free, cookieless, zero-ops, no extra third party, nothing to
   rip out. Fallback if the host has no native privacy analytics: a **self-hosted open tool** (Plausible
   CE / Umami / GoatCounter). **Rejected:** hosted SaaS (paid third-party processor, no gain) and
   "no interim / wait for the collector" (forfeits the early-adopter signal window for ~zero saving).

## Classification (per-fork pass)

This decision **creates/modifies no standard** — it is an operational deployment choice for the WE
*project's own* live site. The `webanalytics` standard's layering is already settled (#1012, contract→WE /
vendor adapters→FUI). The interim tool is the site-owner's operational pick (most-permissive default =
lowest-burden privacy-respecting option). The dogfood path, when built, resolves the tracker through the
existing `CustomTrackerRegistry` injector (DI) — the WE-site adapter is just a registered impl, decoupled
from the interim tool behind the #1138 seam (standing bias: separate/decouple — the interim and the
collector swap without touching the instrumentation call sites).

## Red-team of the default

*Attack:* "Picking CF Web Analytics couples the analytics decision to an unratified host pick (#1135) — if
the host changes, the default is wrong." *Rebuttal:* the **ruling** is host-native-privacy-first with a
self-hosted-open fallback — that survives any host; only the *concrete product* tracks #1135, which is
itself ~80% CF Pages and explicitly soft/revisitable. The default names its contingency rather than hiding
it. *Second attack:* "Self-hosting (Plausible CE) gives raw-data ownership the dogfood loop will want —
start there." *Rebuttal:* true that ownership is nicer, but it buys an ops surface during a throwaway
interim whose only job is signal-until-the-collector; CF Web Analytics delivers the minimum signal at
zero ops and zero rip-out, and the *real* data-ownership story is the dogfood collector, not a second
self-hosted interim. Both attacks fail against the ruling; neither lands on the bold default.

## Cross-references

- [#1104](/backlog/1104-publish-the-website-publicly-gated-controlled-rollout/) — epic (phase 2 = analytics).
- [#1135](/backlog/1135-choose-static-host-phase-1-gate-mechanism-for-the-public-we-/) — host pick this couples to (`/research/static-host-phase1-gate`).
- [#1137](/backlog/1137-public-deploy-we-site-live-behind-a-splash-shared-entry-code/) / [#1138](/backlog/1138-instrument-the-live-we-site-with-the-chosen-analytics/) — deploy, then instrument (the build that consumes this ruling).
- [#1003](/backlog/1003-implement-web-analytics-customtracker-contract-reference-ada/) / #1012 (resolved contract) / #1013 (open vendor adapters) — the webanalytics standard slices.
- [#777](/backlog/777-dogfood-the-we-docs-website-on-fui-components-rework-the-sit/) — dogfood-the-site goal the end-state ratify rests on.
