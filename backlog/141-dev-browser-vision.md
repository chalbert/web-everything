---
type: idea
status: open
dateOpened: "2026-06-07"
tags: [product-strategy, dev-browser, chromium, introspection, conformance, dev-experience, vision, monetization, local-first]
relatedReport: reports/2026-06-07-dev-surface-feature-market-landscape.md
crossRef: { url: /backlog/140-dev-surface-product-feature-matrix/, label: "Product surface × feature matrix (#140)" }
---

# The dev browser — a Chromium app whose tooling lights up only on a standard-conformant app

A **Chromium-based developer browser** whose purpose is *not* writing code — it doesn't compete with VS Code — but to be a rich UI to **manage and improve your running app and platform**. Navigating to a random/incompatible website simply reports *"this site isn't Web Everything-compatible"* — you *could* browse it, but there's no value. Loading a **standard-conformant app unlocks a full dev experience**: state & action explorer, in-context test status, business rules, translations, design-diffing, in-context bug capture — *because the app is introspectable*. The depth of tooling **scales with how much of the standard the app implements**. This is the rightmost column of the [surface matrix (#140)](/backlog/140-dev-surface-product-feature-matrix/) and its most novel surface.

## The one idea: gate tooling on a *standard*, not a framework

The market has exactly one precedent for "tooling that lights up when the app is compatible" — **React / Vue / Redux DevTools** detect their framework and only activate when present. But compatibility there means *one specific framework*, the payoff is a single debug tab, and each tool only ever helps that framework's apps. (Storybook/Ladle similarly light up only via authored stories.)

The novel move is gating on a **vendor-neutral standard**. A Web Everything app — built with *any* stack — exposes a **uniform self-description** through its introspectable registries, intents, contexts, and traces. So a single browser can surface the same deep tooling for *any* conformant app, with depth proportional to conformance. That **inverts the framework lock-in** of today's DevTools into a portable contract, and turns *"not compatible → blank slate"* into a **forcing function that rewards adopting the standard**. No product today is a browser whose tooling depth scales with standard-compliance (market scan found none — see the [report](reports/2026-06-07-dev-surface-feature-market-landscape.md)).

## Why it's a *product*, and how it stays cost-flat

Per the user's monetization principle — **keep server cost flat on every product** (see [#089](/backlog/089-monetization-product-ideas/)): a product either **runs locally and is free**, or is **paid and may use a remote server**; a local product *may also* carry a **commercial license** where there's value. The dev browser fits the lowest-burden, most-monetizable shape:

- **Runs locally** — it's a desktop app inspecting the developer's own running app. **No server, no uptime, no 24/7 support** on us — the ideal solo-founder shape.
- **Yet product-shaped** — unlike an extension (easy to install, hard to charge for), a browser is "a product" people will pay for, especially as a **free tier with caveats → paid** upgrade. So it can carry a **commercial license** despite being local — the browser is exactly the "local product with a commercial license if we decide there's value" case.
- The features that *do* need a server (cloud test offload, flags/A/B/translation management planes) stay on the **paid SaaS** side (#140) or are deferred (#089); the browser itself never takes on server cost.

## What unlocks on a compatible app (the surface for #140's features)

The browser is the **integrative home** for the runtime-introspection features (★ in the [matrix](/backlog/140-dev-surface-product-feature-matrix/)) — it renders the live app *and* its self-description side by side:

- **State & action explorer** — declared state, its visibility (private/shared), the actions/triggers that mutate it, front-to-back traces, replay.
- **In-context test status** — E2E + unit status and last screenshots for *the page you're viewing*, tied to its declared rules.
- **Business rules in context** — the page's rule list, Cucumber ↔ behavior, compliance level.
- **Design reference & diff** — the mockup the page should match, drift highlighted live.
- **Error repro & in-context bug capture** — a semantic, replayable repro from the same trace substrate.
- **Translations** — in-context string editing on the live app; delivery-strategy view.

All of these are *only possible* because the loaded app is conformant and introspectable — which is the whole gating premise.

## Beyond dev work: the analyst / QA surface and the AI fix loop

The browser isn't only for the developer authoring the app — the same introspection substrate makes it a powerful surface for a **non-developer analyst, QA, or support user**. Because the conformant app self-describes its state, rules, traces, and test status, the browser can **expose all the testing-specific information** that's normally invisible and turn a casual user into a high-fidelity bug reporter:

- **Bug capture with everything a dev needs, automatically attached** — instead of "it's broken," a captured bug carries the **semantic replayable repro, the front-to-back trace, declared state at the moment of failure, the page's business rules and which one was violated, failing test + last screenshot, environment/build info, and the design-diff** — all harvested from the same self-description, with no developer instrumentation per-bug. The analyst clicks "report"; the dev receives a fully-debuggable ticket.

- **AI-offered fix, tested live, even against a deployed app** — in simple cases the browser's AI can go one step further than reporting: **propose a fix**, then **apply it live in the running session to verify it actually resolves the issue** — including **hot-patching a *deployed* app** (the introspectable runtime makes the failing state and the fix's effect observable without a rebuild). The user sees the fix working before anyone commits to it.

- **Submit a PR for the devs to review** — once validated live, the AI **opens a pull request** against the source repo with the proposed change *and the captured evidence* (repro, trace, before/after test status) as the PR context. Developers stay in control — they review and merge — but the loop from *"analyst notices a bug"* to *"reviewable, evidence-backed fix"* collapses, and much of it happens without a developer in the room.

This reframes the browser from a *developer tool* into a **shared quality surface**: analysts/QA/support generate debuggable, sometimes pre-fixed work items; developers review. It's a distinct user persona and a distinct value story for #140's matrix, and it leans entirely on the conformance gate — none of it is possible on a non-introspectable app.

## Manager mode: platform-level quality & productivity, not app-specific

Beyond the per-app developer and analyst/QA surfaces, the same self-description aggregated **across many conformant apps** unlocks a **"manager" mode** — a higher-altitude view aimed at **technical leads *and* non-technical managers**. Where the dev/analyst surfaces answer *"what's happening on this page of this app,"* manager mode answers *"how healthy and productive is the platform as a whole."* Because every conformant app exposes the same uniform contract (rules, tests, traces, conformance level, intents), these signals **roll up across the portfolio** without per-app reporting work:

- **Platform-level quality** — conformance/compliance levels across apps, aggregate test health (pass rates, coverage of declared rules, flake), open bug volume and severity sourced from the in-context capture loop, design-drift across surfaces.
- **Platform-level productivity** — throughput signals derived from the same substrate: bugs reported→fixed→merged (incl. the AI-fix-loop PRs), rule/feature coverage growth, where conformance is thin (and thus where tooling can't yet help). 
- **Two audiences, one substrate** — a **technical** view (drill into the traces/rules/tests behind any number) and a **non-technical** view (rolled-up scorecards a manager can read without opening an app). Both are *generated* from conformance, not hand-maintained dashboards.

The point is that the standard makes **cross-app, cross-team** rollups possible at all — app-specific tooling can't produce a portfolio view, but a uniform self-description can. This is a distinct persona and altitude for #140's matrix (above the per-page features), and like everything else it degrades gracefully with how much of the standard each app implements.

## Profiles: predefined personas, plus build-your-own

The personas above (developer, analyst/QA, manager — and others) aren't hardwired modes; they're **profiles** over a common feature set. The browser ships **predefined profiles** as sensible starting points, but a user can **build their own profile that activates or deactivates individual features** — mixing the developer's trace/state explorer with the manager's platform rollups, or stripping QA down to just bug-capture, etc. A profile is essentially a **feature toggle map** over the introspection surfaces, so the same browser reshapes itself per role/task without separate products.

This keeps the personas as *defaults, not silos*: the matrix of features (#140) is the menu, predefined profiles are curated selections, and custom profiles let any user compose exactly the surface they need. (Open: are profiles purely local/user-defined, or also **shareable/team-templated** — e.g. an org publishing its "support" or "release-manager" profile — and does profile scope interact with the free/paid tiering?)

## Build risk & the staged path (don't fork Chromium first)

The biggest open question is **"why a whole browser, not an extension?"** React/Vue/Redux DevTools prove a **Chromium extension / DevTools panel** already detects-and-lights-up with near-zero distribution cost, and maintaining a Chromium *fork* is heavy and ongoing (Replay.io's experience). So the recommended sequencing:

1. **Extension / DevTools-panel first** — cheapest way to prove the "lights up on a conformant app" model and validate each introspection feature against the live self-description. This doubles as the **free funnel** (#140: extensions = easy adoption).
2. **Standalone dev browser (stock Chromium + CDP/extension APIs)** — only once a capability demands chrome-level UI an extension can't reach: intercepting navigation to show *"not compatible,"* a full management UI outside the DevTools dock, deeper-than-CDP hooks. This is the **monetizable product** (free tier + caveats → paid / commercial license).
3. **Chromium fork** — last resort, only if a must-have capability is unreachable via CDP/extension APIs. Default to *not* forking.

## Open decisions / next

- **Extension-first vs. browser-first** — strong recommendation: extension/DevTools-panel first (proving ground + free funnel), browser as the paid product once justified. Confirm.
- **The conformance-gate contract** — what minimal self-description must an app expose for the browser to "light up," and how is partial conformance surfaced (graceful degradation, not all-or-nothing)? This is the core technical design and reuses the introspectable registries/intents/contexts already in the standard.
- **Commercial-license decision** — whether the local browser carries a commercial license (and the free-tier caveats), per the cost-flat principle. Deferred to when there's a reason to charge.
- **Analyst/QA fix loop — scope & guardrails** — how far should the AI go autonomously (report-only → propose fix → live-verify → open PR), and what are the guardrails for **live-patching a deployed app** (sandboxing, session-only patches, revert, who can authorize)? The PR-for-review step keeps devs in control; live-patching is the riskiest capability and needs an explicit safety story.
- **Relationship to plateau-app** — is the dev browser a new shell around plateau-app's existing panels (Technical/Intent Configurators, state/trace tooling), or a distinct product? Check the Plateau/plateau-app repos before designing.
