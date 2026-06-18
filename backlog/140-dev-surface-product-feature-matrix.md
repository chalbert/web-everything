---
type: idea
workItem: epic
status: open
dateOpened: "2026-06-07"
tags: [product-strategy, dev-experience, product-surface, dev-browser, vscode-extension, chrome-extension, saas, feature-matrix, monetization, market-landscape]
relatedReport: reports/2026-06-07-dev-surface-feature-market-landscape.md
crossRef: { url: /backlog/089-monetization-product-ideas/, label: "Monetization product ideas (#089)" }
---

# Dev-experience product surfaces × features — which surface hosts which feature, and the market gap for each

A strategy matrix placing each candidate **developer-experience feature** against the four plausible **product surfaces** — SaaS web app, VS Code extension, Chrome DevTools/extension, and a Chromium-based **dev browser** ([#141](/backlog/141-dev-browser-vision/)) — with a likely fit per cell and the current market offering per feature. This is the *delivery-surface* complement to [#089](/backlog/089-monetization-product-ideas/), which ranks ideas by *operational shape* (self-run tool vs. hosted service vs. enterprise). #089 asks "how do we deliver it cheaply?"; this asks "**which surface is each feature's natural home, and what does the market already offer there?**" Deep market research is in the [related report](reports/2026-06-07-dev-surface-feature-market-landscape.md).

## The four surfaces — and the adoption ↔ monetization tension

| Surface | Install / adoption | Monetization | Note |
|---|---|---|---|
| **VS Code extension** | Easiest (marketplace, one click) | **Hardest to charge for** — extension culture expects free | Great funnel / top-of-funnel; weak as the paid product. Best home for code-adjacent features (unit tests). |
| **Chrome DevTools / extension** | Very easy (web store) | Hard to charge for | Same as VS Code: cheap to prove the "lights up on a compatible app" model (React/Redux DevTools precedent); weak standalone product. |
| **SaaS web app** | Heavier (signup, hosting) | **Product-shaped — easy to market & charge** | But late goal: high ongoing cost + 24/7 support obligation → **defer** (per #089 solo-founder lens). Natural home for management-plane/service features. |
| **Dev browser (Chromium)** | Heavier (download an app) | **Product-shaped — easy to market**, esp. with a **free tier + caveats → paid** | The integrative home for runtime-introspection features. Higher build risk (see #141 — extension-first, fork last). |

**The core tension (user framing):** the easier to install (extensions), the easier initial **adoption** — but the **harder the sell**. SaaS and the dev browser are inherently closer to "a product," so they're easier to *market and monetize*; the browser especially works as a **free version with caveats → paid upgrade**. Practical read: **extensions are the funnel and the cheap proving ground; the dev browser (and selectively SaaS) is the monetizable product.**

**Cost-flat rule (overrides surface choice):** keep server cost flat on *every* product. A product either **runs locally and is free**, or is **paid and may use a remote server** — never a free product carrying server cost (the one exception: free docs). A **local product may also carry a commercial license** where there's value (the dev browser is the example — local, yet product-shaped enough to license; see [#141](/backlog/141-dev-browser-vision/)). Consequence for this matrix: the server-needing features (5 cloud offload, 7 flags, 8 A/B, 12 translation management) live on the **paid SaaS** side or are deferred ([#089](/backlog/089-monetization-product-ideas/)); the local surfaces (extensions, dev browser) stay free-or-licensed with **zero server cost on us**.

## The matrix

Fit per cell: **★** natural home / flagship · **✓** good fit · **~** partial / constrained · **·** poor fit. Full market detail + gap per feature in the [report](reports/2026-06-07-dev-surface-feature-market-landscape.md).

| # | Feature | VS Code ext | Chrome DevTools/ext | SaaS | Dev browser |
|---|---|:--:|:--:|:--:|:--:|
| 1 | Mockup reference & analysis (live page/component design-diff) | ~ | ✓ | ✓ | ★ |
| 2 | Designer → portable conformant PR | · | ✓ | ~ | ★ |
| 3 | E2E/integration test status in context (+ last screenshots) | ✓ | ~ | ✓ | ★ |
| 4 | Unit test status in context / live | ★ | · | ~ | ✓ |
| 5 | Cloud-offloaded test / lint / Playwright runs | ✓ | ~ | ★ | ✓ |
| 6 | State & action explorer (Redux-DevTools-on-steroids) | ~ | ✓ | · | ★ |
| 7 | Feature flags | ~ | ~ | ★ | ✓ |
| 8 | A/B testing / experimentation | · | ~ | ★ | ✓ |
| 9 | Error replay & repro — *dev bug-fixing, not prod analytics* | ✓ | ✓ | ~ | ★ |
| 10 | In-context bug reporting / capture | ~ | ✓ | ✓ | ★ |
| 11 | Business rules in context (+ Cucumber as source of truth) | ~ | ~ | ✓ | ★ |
| 12 | Translations manager (+ delivery-strategy picker) | ✓ | ~ | ★ | ✓ |

**Reading it:** the **dev browser is the integrative home** (★ on 7/12) — the runtime-introspection features that need a live, standard-conformant app in front of them. **SaaS owns the management-plane/service features** (flags, A/B, cloud offload, translations) where there's a backend to host. **VS Code owns unit tests** (Wallaby-style, code-adjacent). **Chrome/extension** is rarely the flagship but is the cheapest place to *prove* any introspection feature lights up on a compatible app.

## Per-feature market edge (one line each — detail in the report)

The recurring white-space: every incumbent **bolts onto an opaque runtime**; a Web Everything app is **self-describing**, so the same feature becomes *semantic, portable, verifiable* instead of heuristic and framework-bound.

1. **Mockup analysis** — generators emit framework-locked code; the one design-vs-build differ (Applitools) returns only pass/fail. Nobody closes generate↔verify against the design. *(deep design: [#086](/backlog/086-mockup-to-standard-code-tool/))*
2. **Designer → PR** — Builder.io does non-coder→PR but framework-specific + human-reviewed; browser Workspaces give portable edits but no PR/verification. **Non-coder authorship + portable output + machine-checkable merge gate is unoccupied.**
3. **E2E status in context** — every tool keys status to a *test*, never to *the page you're viewing*; none links a scenario to a page's declared rules.
4. **Unit status** — Wallaby/vscode-jest anchor to the file/line, never to a rendered component instance in a running app.
5. **Cloud offload** — framed as infra speed only; none feed results back inline anchored to the page you're editing.
6. **State & action explorer** — all adapter-bolted onto opaque stores; Stately is declarative-but-XState-only, OTel traces-but-no-state-model. **Nobody unifies declared state-visibility + front-to-back trace + replayable scenarios that double as E2E fixtures.** *(biggest white-space; maps to webtraces + webcontexts + webevents)*
7. **Feature flags** — opaque string-keyed booleans; flags-as-declared-intents would make surfaces auto-discoverable and targeting vendor-portable.
8. **A/B testing** — assignment bolted per-SDK; declarative variants let an experiment target a *named intent*, not a selector.
9. **Error replay** — incumbents are heavyweight *prod* platforms (Sentry/LogRocket); we want a lightweight **local, semantic** repro (declared state + action trace), not a sampled DOM video. *Not a Sentry competitor.*
10. **In-context bug report** — tools reconstruct context externally (video+logs); first-class traces emit a precise semantic repro, replayable against the model.
11. **Business rules** — chasm between executable-rules-for-non-coders (DMN/ODM, not Gherkin) and human-readable Gherkin (drives tests only, drifts). Declarative rule intents = one declaration is rule + living doc + fixture, with compliance levels. *(deep design: [#093](/backlog/093-business-rule-manager-proof-of-compliance/))*
12. **Translations** — TMS market is mature (low moat for plain localization); the **uncontested gap is the delivery-strategy picker** (bundled / CDN / backend / DB as a swappable provider on webintl). *(see [#089](/backlog/089-monetization-product-ideas/) parked note)*

## Three reusable mechanisms behind 9 of 12 features

These features are not 12 separate builds — they share substrate (this is the sequencing insight):

- **Trace/replay artifact** (declared state + action trace) → state explorer (6), dev error-repro (9), in-context bug report (10). *Build once.*
- **Introspectable app model** (what's on this route, which providers/intents) → test status (3, 4, 5), flags (7), experiments (8), rules (11).
- **Verify-gated conformance check** → mockup→code (1), designer→PR (2).

This is the [#089](/backlog/089-monetization-product-ideas/) "AI proposes, the standard verifies" moat extended from codegen to the whole dev experience.

## Relationship to existing items (dedup map)

- **[#086](/backlog/086-mockup-to-standard-code-tool/)** owns mockup→code (batch codegen); feature 1 here is the *live in-context reference/analysis* angle.
- **[#093](/backlog/093-business-rule-manager-proof-of-compliance/)** owns the business-rule manager + proof-of-compliance; feature 11 is its *in-context, per-page, Cucumber-source-of-truth, non-coder* framing.
- **[#089](/backlog/089-monetization-product-ideas/)** lists flags / A/B / translations as unassessed Plateau-candidate domains — this item assesses their market + surface fit.
- **[#096](/backlog/096-nl-to-technical-configurator/)**, **[#094](/backlog/094-ai-upgrader-tools/)**, **[#095](/backlog/095-conformance-auto-fix-agent/)** are the AI code-tool family (the #097 MVP) — orthogonal to this surface matrix.
- **[#141](/backlog/141-dev-browser-vision/)** is the dev-browser vision (the rightmost column, written up as its own concept).

## Design notes / next steps

- **This is a planning artifact, not a build.** The genuinely-new features with no owning item yet — **state & action explorer (6)**, **designer→PR (2)**, **in-context test status (3/4/5)**, **error replay + in-context bug report (9/10)**, **translation-strategy picker (12)** — each warrants its own backlog item when it's picked up; captured here as rows first to avoid 8 thin siblings.
- **Surface bet:** extensions as funnel/proving-ground, dev browser (+ selective SaaS) as the monetizable product — confirm before investing.
- **Sequencing:** the three shared mechanisms above should be built before the features that ride them; the trace/replay artifact unblocks the most features (6, 9, 10).

## Direction (provisional, 2026-06-18)

Proceeding on the stated bet — **extensions-as-funnel + dev-browser as the monetizable product** — as
*provisional* sequencing, explicitly revisitable per the soft-monetization treatment (never priced on a
shifting category). The 12-feature triage is **not funded yet** — revisit with real funnel data. This card
stays **open** as the durable planning artifact, not resolved.
