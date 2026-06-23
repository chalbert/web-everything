---
kind: decision
status: resolved
locus: plateau-app
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
dateResolved: "2026-06-23"
graduatedTo: none
preparedDate: "2026-06-22"
relatedReport: reports/2026-06-07-dev-surface-feature-market-landscape.md
crossRef: { url: /backlog/140-dev-surface-product-feature-matrix/, label: "Dev-surface × feature matrix (#140)" }
tags: [product-strategy, monetization, product-surface, dev-browser, vscode-extension, chrome-extension, saas]
codifiedIn: docs/agent/platform-decisions.md#monetization
---

# Dev-surface monetization bet — extensions-as-funnel vs dev-browser/SaaS as the paid product

The single ratifiable call carved out of the #140 planning matrix: **which product surface carries
the paid product, and which is the free funnel.** #140 stays the durable map (12 features × 4 surfaces
+ market gaps); this card holds the one decision so it isn't buried as prose inside an epic.

## Ratified — 2026-06-22 (amends the prepared default)

**Fork 1 → (a) dev-browser as the flagship / moat — RATIFIED.** Amended on two points:

1. **The paid flagship is the licensed *local* dev-browser (fixed-cost, JetBrains/Sublime model),
   not the SaaS bundle.** The prepared default sequenced SaaS-first as the "meterable now" early
   revenue; that inverts the real solo-dev risk. SaaS carries *recurring* server + 24/7 support cost;
   the local browser carries none. Per the cost-flat rule's local-commercial-license carve-out and the
   on-device-fixed-cost preference ([platform-decisions §monetization](docs/agent/platform-decisions.md#monetization)
   rule 3), the fixed-cost local surface is the *safer* paid product for a solo dev. The SaaS bundle is
   **demoted to an optional, later paid surface** — its recurring cost is a liability, not a reason to
   lead. Extensions stay the free funnel.
2. **Build is decoupled from release / monetization timing.** Public release does not gate what we
   build. Pursue the full product **now**; *when* and *how* to switch on paid release is a separate,
   later call. The `deferred` posture and the "two real-world triggers gate readiness" framing are
   dropped (consistent with the soft-deferred-park retirement, #1392/#764).

**Red-team:** the strongest case for the prepared SaaS-first sequencing is "SaaS bills from day one;
a licensed browser needs the whole browser built first." It fails — the risk being minimized is the
*recurring obligation* (the dominant solo-dev failure mode the platform monetization rule already
encodes), not time-to-first-dollar, and build was explicitly decoupled from revenue timing. The
prepared default contradicted its own statute by leading with the recurring-cost surface for
"meterable now" convenience. No principle violated: local-commercial-license is an explicit cost-flat
carve-out, and dropping `deferred` aligns with the park-retirement rule. Amendment holds.

> The analysis below is the prepared groundwork; the section above is the authoritative ruling.

## Grounding digest

- **Prior art is surveyed** — [`we:reports/2026-06-07-dev-surface-feature-market-landscape.md`](reports/2026-06-07-dev-surface-feature-market-landscape.md)
  benchmarks all 12 dev-experience features and the dev-browser landscape (Polypane, Replay.io, React/Vue/Redux
  DevTools, Storybook). No new `/research/` topic minted — this is a **product-surface placement** call over
  already-researched ground, not a greenfield standard, so the existing report is the prior-art link.
- **The market novelty** is *a browser whose tooling depth scales with how standard-compliant the loaded app is*
  — nobody ships it (report:111). The closest precedent is framework DevTools that light up on compatibility,
  but compatibility = one framework, payoff = a debug tab.
- **The binding invariant is the cost-flat rule** ([`we:docs/agent/platform-decisions.md:293-299`](docs/agent/platform-decisions.md#monetization)):
  a product **runs locally and is free**, OR is **paid and may use a remote server** — never a free product
  carrying server cost. Crucially, a **local product may also carry a commercial license** ([#140](/backlog/140-dev-surface-product-feature-matrix/)),
  so a licensed local binary *is* a permitted paid product (the JetBrains/Sublime model).

## What you have to decide (the human call)

Pick the surface that carries the **paid** product, with the rest as free funnel, under the cost-flat
rule above. Ratifiable in a sentence. Two real-world triggers sharpen the timing (neither blocks the
ruling — the fork is at DoR now): **funnel data exists** (a shipped extension shows whether it converts),
or **a dev-experience feature is funded for build** (the first feature needing a home forces the call).

## Axis framing — paid surface vs free funnel

The axis is *which surface is the monetizable product*, and it is pinned by the **cost-flat rule**: the
meterable, server-backed features — cloud-offload, flags, A/B, translation delivery — sit on the paid
side or are deferred ([#140](/backlog/140-dev-surface-product-feature-matrix/)), while the local
surfaces (extensions, dev browser) carry zero server cost on us. The **dev browser is the integrative
home** — ★ on 7/12 runtime-introspection features in the matrix ([#140](/backlog/140-dev-surface-product-feature-matrix/))
— and is product-shaped enough to license locally. But the report's own risk synthesis
([report:111](reports/2026-06-07-dev-surface-feature-market-landscape.md)) is blunt: a Chromium
*extension* already proves the lit-up-on-conformance model with near-zero distribution cost, a forked
browser is heavy/ongoing maintenance (Replay precedent), and the recommended build order is
**extension/DevTools-panel first, browser only when a capability demands it**. So the live tension is
not "is the browser the moat" (it is) but *which surface carries early, meterable revenue while the
browser is still unbuilt and unproven*.

## Recommended path at a glance

| Fork | Recommended default | Main alternative (excluded) | Confidence |
|---|---|---|---|
| **Fork 1** — which surface is paid | **(a) dev-browser flagship, sequenced** — extensions free funnel → server-backed SaaS bundle is the *first* meterable paid revenue → licensed dev-browser is the integrative *end-state* paid product once a forked-browser capability proves out | (b) SaaS-as-flagship (excluded: high 24/7 ongoing cost, #089 solo-founder lens defers it as the *headline* product); (c) extensions-only paid tier (flawed: extension culture expects free) | **med-high** — divergent on *sequencing*, not on the moat |

## Fork 1 — which product surface is the paid product

**Fork-existence justification:** real either/or — branch (c) is the *flawed* branch (a paid extension
tier fights extension-culture's free expectation → weakest sell, named broken below), and (a) vs (b)
cannot coexist as *the* flagship: the cost-flat rule + #089 solo-founder lens force a single primary
paid surface, and "browser-led" vs "SaaS-led" are mutually-exclusive product bets that route build
effort and marketing differently. Not a prioritization fork — it is *which surface is the product*, an
end-state placement call.

**Crux:** the meterable revenue (server-backed features) and the *moat* (the integrative browser) live
on different surfaces. The cost-flat rule pushes paid → server-side; the moat lives in the local
browser; the report says build the cheap extension first.

**Options:**

- **(a) Dev-browser flagship, sequenced** *(recommended default)* — Paid product = a **licensed local
  dev browser** (permitted as paid under the local-commercial-license carve-out,
  [`we:docs/agent/platform-decisions.md`](docs/agent/platform-decisions.md#monetization) / [#140](/backlog/140-dev-surface-product-feature-matrix/))
  **plus** a **server-backed SaaS bundle** (flags / A·B / cloud-offload / translations) that is the
  *immediately meterable* paid surface. Free funnel = VS Code + Chrome extensions. **Sequencing** (folding
  in the report's build order, [report:111](reports/2026-06-07-dev-surface-feature-market-landscape.md)):
  extensions are the free funnel + cheap proving ground → the SaaS bundle carries the *first* paid revenue
  (meterable today, server-side as the rule prefers) → the dev-browser-as-paid lands as the integrative
  end-state once a forked-browser capability proves out something an extension/DevTools-panel demonstrably
  cannot deliver. Keeps server cost off the local surface, keeps the moat (★ 7/12) as the destination,
  and does **not** bet the day-one paid product on the unbuilt, unproven, highest-maintenance surface.
- **(b) SaaS-as-flagship** — *Rejected as the headline product* (its SaaS bundle is *retained* inside
  (a) as the early paid surface — what's rejected is making hosted SaaS *the* flagship). A hosted web app
  is the most product-shaped and easiest to charge for, but a SaaS *flagship* carries high ongoing
  infra + a 24/7 support obligation that the #089 solo-founder lens defers; and it abandons the
  standard-conformance moat that only the integrative browser surfaces.
- **(c) Extensions-only paid tier** — *Rejected (flawed branch).* Easiest adoption, but extension
  culture expects free, so a paid extension tier is the weakest sell of the three — the named broken
  branch that makes this a genuine fork.

**Recommended default: (a) dev-browser flagship, sequenced.**

**Skeptic:** SURVIVES-WITH-AMENDMENT → the skeptic's strongest hit (don't make the unbuilt, highest-maintenance
browser the *day-one* paid flagship — the report's own "extension-first" order) is **folded into the default
as the sequencing clause**: near-term paid = the server-backed SaaS bundle (meterable now); dev-browser-as-paid
is the licensed *end-state*, gated on an extension-proven capability gap. The skeptic's "a local binary can't
be a paid product under the cost-flat rule" was **refuted** — the rule explicitly carves out local commercial
licensing ([#140](/backlog/140-dev-surface-product-feature-matrix/)), so (a) is coherent under its own rule
and does not collapse into (b). The skeptic's "premature vs the parked state" hit is resolved by the
soft-deferred-park retirement (#1392 / #764): this is a live, ready-to-ratify fork — the two real-world
triggers inform *timing*, not *readiness*.

## Why this is the *only* standards-vs-product decision here

The #140 rows are **not** "what should be standard" calls — they're product-surface placement +
prioritization (and prioritization is not a fork). The genuine standard kernels behind the features
(trace/replay artifact, introspectable app model, declared flags/variants/rule intents) live in their
own items (#086, #093, the webtraces/webcontexts/webevents family), not here. This card isolates the one
remaining *product* decision so #140 can stay a pure map.
