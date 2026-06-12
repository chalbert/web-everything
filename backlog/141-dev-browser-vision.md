---
type: decision
workItem: story
size: 5
status: resolved
dateOpened: "2026-06-07"
dateStarted: "2026-06-12"
dateResolved: "2026-06-12"
graduatedTo: none
tags: [product-strategy, dev-browser, chromium, introspection, conformance, dev-experience, vision, monetization, local-first]
relatedReport: reports/2026-06-07-dev-surface-feature-market-landscape.md
preparedDate: "2026-06-11"
crossRef: { url: /backlog/140-dev-surface-product-feature-matrix/, label: "Product surface × feature matrix (#140)" }
---

# The dev browser — a Chromium app whose tooling lights up only on a standard-conformant app

## Digest

Grounded in the [dev-surface market landscape report](reports/2026-06-07-dev-surface-feature-market-landscape.md) (graduated to the [Dev-browser vision](/research/dev-browser-vision/) research topic) and the conformance/autofix machinery already in the repo. The sequencing fork was resolved first (extension-first → browser later); the **four remaining forks are now all resolved (2026-06-12)** — see "Resolution of the four open forks" at the bottom: **Fork 1 → capability-manifest gate, degrade per-feature** (manifest derived from live registries); **Fork 2 → reuse the verify-gated autofix loop, default autonomy = open-PR**, with **deployed-app live-patch carved out to [#410](410-dev-browser-deployed-app-live-patch-gated-capability-safety-.md)** (out of v1); **Fork 3 → yes, a commercial license, tiering deferred to first-sale**; **Fork 4 → a distinct shell that embeds plateau-app's panels, not a fork of it**. Item is **resolved**; successor work is the staged build.

## Axis-framing

The four forks are not free invention — each reuses machinery already in the tree. The conformance gate (Fork 1) is the runtime analogue of the build-time suite `check:standards` ([scripts/check-standards.mjs:1](../scripts/check-standards.mjs)) plus the introspectable [capability matrix](../src/_data/capabilityMatrix.json#L1) — a 3-state tier map (native-ok / polyfill-ok / capability-hard) keyed off `capabilities.json`, the registered adapter table that already declares per-impl capability support. The AI fix loop (Fork 2) is the existing conformance-autofix engine ([scripts/conformance-autofix.mjs:3](../scripts/conformance-autofix.mjs#L3)) generalized to a running app: its **verify gate** — apply → re-run → keep only if the failure cleared and no new error appeared, else revert ([scripts/autofix/engine.mjs:15](../scripts/autofix/engine.mjs#L15)) — is bounded (`maxRounds`, [engine.mjs:242](../scripts/autofix/engine.mjs#L242)), metered (`--max-model-fixes`, [conformance-autofix.mjs:14](../scripts/conformance-autofix.mjs#L14)), and has a human-review `decide` hook that can revert a gate-passing patch before it lands ([engine.mjs:247](../scripts/autofix/engine.mjs#L247)). The license (Fork 3) plugs into the settled open-core gradient ([backlog/098-licensing-strategy.md](098-licensing-strategy.md), [backlog/089-monetization-product-ideas.md:20](089-monetization-product-ideas.md)). The plateau-app relationship (Fork 4) is grounded by what plateau-app already ships: `src/technical-configurator/`, `src/intent-configurator/`, and `src/profiles/` — the very configurators + persona-profile system the vision describes.

### Recommended path at a glance

Ratify all four rows, or override just the one you'd change. The **confidence** column says where judgment is actually needed vs. where to nod. (The sequencing fork is already ruled — see the bottom — and is not listed.)

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **1 · conformance gate** | capability-manifest gate, degrade per-feature | all-or-nothing compatible/not *(rejected)* | **High** — graceful-degradation + reuses capabilityMatrix |
| **2 · fix-loop guardrails** | verify-gated loop; autonomy ladder, default open-PR; live-patch session-only + authorized | full autonomy incl. auto-merge *(rejected)* | **Med-high** — engine exists; live-patch needs the safety story |
| **3 · commercial license** | yes, free-tier → paid; deferred to first-sale | free/no-license forever | **Med** — principle settled; tiering deferred |
| **4 · plateau-app relationship** | distinct shell embedding plateau-app panels | fork plateau-app / absorb it *(rejected)* | **Med** — confirm vs. a clean re-implementation |

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

## Fork 1 — the conformance-gate contract

**Crux:** what minimal self-description must an app expose for the browser to "light up," and is conformance binary or graded? The standard already exposes the substrate — introspectable registries, intents, contexts, traces — and the runtime gate is the analogue of the build-time suite `check:standards` ([scripts/check-standards.mjs:1](../scripts/check-standards.mjs)). The natural contract is the [capability matrix](../src/_data/capabilityMatrix.json#L1): a 3-state tier map (native-ok / polyfill-ok / capability-hard) keyed off `capabilities.json`, where each impl registers one row declaring what it supports. The market parallel is a CI **quality gate** (SonarQube) reported as a status check — pass/fail per condition, with a warn-only mode before enforcement.

- **(A — recommended) Capability-manifest gate, degrade per-feature.** The app exposes a manifest of which capabilities/intents it implements (read from the same self-description); the browser activates **each feature against the capability it needs**, so a thinly-conformant app lights up exactly its supported slice. Partial conformance is first-class. Matches graceful-degradation; reuses the existing matrix vocabulary; nothing new to invent.
- **(B) All-or-nothing — one "compatible" bit.** Simpler to message ("compatible ✓"), but throws away the whole "depth scales with conformance" thesis and the forcing-function gradient, and contradicts the vision's own "degrades gracefully with how much of the standard each app implements." *Rejected.*
- **Sub-decision:** is the manifest a *new* declared artifact the app emits, or purely *derived* by the browser from the live registries it can already introspect? Default: derive where possible, declare only the conformance-level summary.

## Fork 2 — the AI fix-loop guardrails

**Crux:** how far should the AI go autonomously (report-only → propose → live-verify → open-PR), and what guards **live-patching a deployed app**? The loop already exists in the repo as the conformance-autofix engine ([scripts/conformance-autofix.mjs:3](../scripts/conformance-autofix.mjs#L3)): its **verify gate** — apply → re-run → keep only if the failure cleared with no new error, else revert ([scripts/autofix/engine.mjs:15](../scripts/autofix/engine.mjs#L15)) — is bounded (`maxRounds`, [engine.mjs:242](../scripts/autofix/engine.mjs#L242)), metered (`--max-model-fixes` so a runaway loop can't burn a BYO key, [conformance-autofix.mjs:14](../scripts/conformance-autofix.mjs#L14)), and has a `decide` human-review hook that reverts a gate-passing patch before it lands ([engine.mjs:247](../scripts/autofix/engine.mjs#L247)). Market autofix-safety prior art converges identically: passing tests + re-scan *before* any PR is auto-opened, an autonomy ladder with confidence thresholds, and a PR-body safety checklist (tests run, files touched, **revert plan**).

- **(A — recommended) Reuse the verify-gated loop; autonomy is a configured level; default = open-PR-for-review; live-patch is session-only + authorized.** Generalize the engine to a running app — the "suite" becomes the app's own declared rules + tests, the gate is unchanged. Autonomy is a setting: `report-only → propose → live-verify → open-PR`, default **open-PR** (devs review and merge; the loop collapses but humans stay in control). Live-patching a *deployed* app is the riskiest capability: **session-only patches, revertible, authorization-gated** (who may apply), never auto-merged.
- **(B) Full autonomy incl. auto-merge.** Maximizes the "fix without a developer in the room" story but removes the human gate the whole moat depends on, and lets a model land a change on a deployed app unreviewed. Contradicts both the engine's own `decide` hook and the market consensus (logic-touching fixes need codeowner approval). *Rejected.*
- **Sub-decision:** does the autonomy level live per-user (profile), per-app, or per-org policy? Default: per-app policy can *cap* the level a user/profile may select.

## Fork 3 — the commercial-license decision

**Crux:** does the local browser carry a commercial license, and what are the free-tier caveats? The open-core gradient is already settled ([backlog/098-licensing-strategy.md](098-licensing-strategy.md)) and the cost-flat principle is stated ([backlog/089-monetization-product-ideas.md:20](089-monetization-product-ideas.md)): open standard/impl are free; paid products are licensed; a *local* product may carry a commercial license where there's value. The browser is the textbook case — runs locally (no server, no uptime), yet product-shaped enough to charge for. Market confirms the 2026 pattern: free tier as evaluation → per-seat commercial license for teams → open-core/BYO-key variants (Cursor, Windsurf, Cline).

- **(A — recommended) Yes — free tier (the panel = the funnel) → paid browser; commercial license; decision deferred to first-sale.** The sequencing already makes the extension/panel the free funnel; the standalone browser is the paid product. Carry a commercial license in principle, but **defer** the tier-split and caveats until there's a concrete reason to charge — don't pre-commit pricing.
- **(B) Free / no commercial license forever.** Maximizes adoption and avoids any open-washing optics, but discards the most-monetizable local-product shape the cost-flat principle explicitly reserves for exactly this case. *Rejected* (as a permanent stance; "not yet" is the recommended path).
- **Sub-decision (carried from the Profiles section):** do shareable/team-templated profiles sit in the paid tier? Defer with the rest of the tiering.

## Fork 4 — the relationship to plateau-app

**Crux:** is the dev browser a new shell around plateau-app's existing panels, a fork of plateau-app, or a distinct product that re-implements them? plateau-app already ships the relevant surfaces: `src/technical-configurator/`, `src/intent-configurator/`, and `src/profiles/` — the configurators + persona-profile ("feature toggle map") system the vision describes.

- **(A — recommended) A distinct shell that embeds plateau-app's panels.** The browser owns only the chrome-level capabilities a panel can't reach (intercepting navigation to show "not compatible," a full management UI outside the DevTools dock, deeper-than-CDP hooks); the Technical/Intent Configurators and profiles stay owned by plateau-app and are embedded as the management UI. No duplication, clean ownership boundary.
- **(B) Fork plateau-app / absorb it into the browser.** Collapses two products into one and re-homes the configurators inside the browser; heavier to maintain, muddies the product boundary, and re-implements panels that already exist. *Rejected.*
- **Sub-decision:** what's the embed seam — does the browser load plateau-app panels as a package, or via an iframe/web-component boundary against the live app? Resolve during the build.

## Resolution of the sequencing fork only (2026-06-11)
**Extension / DevTools-panel first, browser later** — settled by the staged path + monetization (the panel is the cheapest proof of the "lights up on a conformant app" model *and* the free funnel; the standalone browser is the paid product once a capability demands chrome-level UI; a Chromium fork stays a last resort).

## Resolution of the four open forks (2026-06-12)

All four forks resolved; the item graduates to the build phase.

- **Fork 1 — conformance gate → (A) capability-manifest gate, degrade per-feature.** Ratified. Partial conformance is first-class; reuses the `capabilityMatrix` vocabulary. Sub-decision settled: the manifest is **derived** from the app's live introspectable registries wherever possible — the app declares only the conformance-level summary, not a hand-maintained manifest (native-first).
- **Fork 2 — AI fix-loop guardrails → (A) verify-gated loop, autonomy ladder, default open-PR.** Ratified, **with one carve-out**: live-patching a *deployed* app is **out of scope for v1** and is spun out as its own gated capability item ([#410](410-dev-browser-deployed-app-live-patch-gated-capability-safety-.md)) with its own safety design (sandbox model, authorization, audit trail). v1 ships report-only → propose → **local-session** live-verify → open-PR; patching the developer's own running app carries the demo value with almost none of the deployed-mutation risk. Deployed-app live-patch must earn its way in via the spin-off, not as a day-one ladder rung.
- **Fork 3 — commercial license → (A) yes in principle, tiering deferred to first-sale.** Ratified — the browser is the textbook local-product-with-a-commercial-license case; don't pre-commit pricing.
- **Fork 4 — plateau-app relationship → (A) distinct shell embedding plateau-app's panels.** Ratified — consistent with the constellation layering (plateau-app owns the configurators + profiles as the product layer; the browser owns only chrome-level capabilities). Embed seam (package vs. iframe/web-component) is a build detail, deferred.

With all forks resolved, the successor work is the staged build (extension/panel first). This decision item is **resolved**.
