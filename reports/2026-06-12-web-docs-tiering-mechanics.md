# Web Docs open-core tiering mechanics — metered-unit / threshold prior-art survey

**Date**: 2026-06-12
**Point**: The Web Docs open-core *mechanics* (#428) reduce to **one real fork — the metered unit** (Chromatic's per-value-action "snapshot" model is the strongest analog: meter the conformance-verified regeneration), a low-confidence **free/paid threshold principle** (numbers deferred to the #427 build with real usage), and a **billing-surface ratify** — #183's Lemon Squeezy MoR already supports usage-based/metered subscriptions, so the metered hosted model fits the chosen rail with no reopen.
**Research page**: `/research/web-docs-open-core-tiering/`
**Decision item**: `/backlog/428-web-docs-open-core-tiering-mechanics-metered-unit-threshold-/`

---

## Question

#091 ratified the open-core *principle* (Web Docs is open-core by usage: free tier → paid beyond a
usage threshold; cancel-and-self-host always holds). #428 must settle the *mechanics* it left open:
**(1) what unit is metered, (2) where the paywall threshold sits, (3) which billing/auth surface
plateau-app uses.** This survey gathers how comparable docs / dev-tool / hosting SaaS meter and tier,
so the forks reuse incumbent vocabulary rather than coining a model cold.

## Recommendation

- **Fork 1 (metered unit): meter the conformance-verified regeneration — the Chromatic-snapshot
  analog.** Web Docs' differentiator (per #091) is that the docs *prove conformance*; the unit that
  delivers that value is the verified re-build/re-publish, not a seat or a raw byte. This reuses #089
  idea-1's continuous-verification machinery *as* the meter (one artifact, three outputs), degrades
  gracefully (Chromatic pauses at the free ceiling rather than cutting off), and Lemon Squeezy's
  metered-billing API bills it directly. Main alternative: per-site/project (GitBook/ReadMe) — simpler,
  but underprices the differentiator and doesn't scale with the value delivered. *Confidence: Medium —
  a genuine business judgment.*
- **Fork 2 (threshold): a *principle*, not a number yet.** Free must clear the self-host floor (the
  generator + standards stay free and self-hostable, unlimited) and be generous enough to onboard a
  real solo/OSS project; paid begins where the customer derives ongoing production value (continuous
  re-verification of a live, hosted site). Specific limits are tuned at the #427 build against real
  usage. *Confidence: Low — derived from Fork 1, numbers deferred.*
- **Billing surface: RATIFY, don't reopen.** Compose #183's ruling (MoR via **Lemon Squeezy**) — LS
  now supports usage-based/metered subscriptions (report-usage API, bill in arrears), so the metered
  hosted model fits the already-chosen rail; no Stripe Billing detour. Auth is a plateau-app build
  detail, not a standards decision.

## Key findings

1. **The market meters on four distinct units, and the choice *is* the product's pricing identity.**
   - **Per-seat / per-editor** — Mintlify ($250/mo for 5 editor seats, +$20/seat), GitBook (+$12/user/mo
     on top of the site fee), Vercel (per-seat Pro). Penalizes teams; **Netlify deliberately moved
     *away* from it** (flat $20/mo Pro, unlimited seats, since 2026) precisely because per-seat punishes
     teams of 5+. Bad fit for docs, whose readers are unbounded.
   - **Per-site / per-project** — GitBook ($65/site Premium → $249/site Ultimate), ReadMe ($79 →
     $349/project). The docs-native unit; simple to reason about. Underprices a usage-scaling value.
   - **Per-value-action ("snapshot")** — Chromatic meters on the **snapshot** (the unit of work that
     produces the value: a visual-regression capture). 5,000 snapshots/mo free, metered overage on paid,
     **graceful pause** (not cutoff) when a free account exhausts them. The closest analog to "prove
     conformance": the Web Docs value-action is the conformance-verified regeneration.
   - **Pure infra (credits / bandwidth / build-minutes)** — Netlify (credit model: deploys 15c,
     bandwidth 20c/GB, compute 10c/GB-hr), Vercel. Commoditized, races to the bottom, captures none of
     the conformance value; this is the floor others compete on, not a differentiator.
2. **Free-tier shape is consistent: "one site / one individual," commercial-use is the dividing line.**
   Mintlify Hobby (1 site, free, no AI), GitBook Free (individuals / OSS). The notable split: **Netlify's
   free tier allows commercial use** (indie-friendly) while **Vercel's Hobby bans it** — for an
   open-premise product, the free tier must permit self-host/commercial use, since "cancel and self-host
   always holds" is the whole pitch.
3. **Graceful degradation beats a hard cutoff at the free ceiling.** Chromatic *pauses* testing until
   the next month rather than breaking the product — the right pattern for a docs site that must stay up.
4. **The billing rail is already chosen and already supports metering.** #183 (resolved) ruled MoR via
   **Lemon Squeezy** (global VAT/tax offload — the solo-founder win — plus a native license-key API). LS
   added **usage-based/metered billing**: report customer usage via API, billed in arrears on renewal.
   So the metered hosted model needs no new rail and no reopen of #183 — it composes the existing one.
5. **The build is deferred regardless.** Per the #089 solo-founder lens ("defer any live-serve solution
   that could break and demand instant support"), the served Web Docs product is tier-2; the tiering
   *build* is a plateau-app slice `blockedBy` #427 (the free-tier product), itself `blockedBy` the #424
   generator + #425 primitives. #428 settles the *decision shape* now so that build is unblocked, not the
   code.

## Files created/modified

| File | Action |
|---|---|
| `we:reports/2026-06-12-web-docs-tiering-mechanics.md` | created (this report) |
| `we:src/_data/researchTopics.json` | added `web-docs-open-core-tiering` entry |
| `we:src/_includes/research-descriptions/web-docs-open-core-tiering.njk` | created (write-up) |
| `we:backlog/428-web-docs-open-core-tiering-mechanics-metered-unit-threshold-.md` | rewritten to prepared-fork shape; `preparedDate` set |
