# Dev-surface feature market landscape — what exists, where the gaps are

Research backing the **product-surface × feature matrix** ([backlog #140](/backlog/140-dev-surface-product-feature-matrix/)) and the **dev-browser vision** ([backlog #141](/backlog/141-dev-browser-vision/)). For each candidate feature of a Plateau developer experience, this catalogues the current market offering and isolates the **white-space** — the part no incumbent does, which is almost always *"nobody grounds this in an introspectable, standard-conformant app model."*

The recurring thesis across every feature: today's tools **bolt onto an opaque runtime** and reverse-engineer what the app is doing (DOM video, network breadcrumbs, selector-based assertions, per-framework adapters). A Web Everything app is **self-describing** — its registries, intents, contexts, traces, and declared business rules are introspectable — so the same tooling can be *semantic, portable, and verifiable* instead of heuristic and framework-bound. That is the integration edge.

> Market facts below were gathered 2026-06-07 from vendor pages and current comparison sources. Fast-moving items are flagged; treat exact feature/pricing claims as directional.

---

## 1. Mockup reference & analysis (design ↔ running app)

Two halves the market keeps separate: **generate code from a mockup**, and **diff a design against the running build**.

**Generate (mockup → code).** Figma Dev Mode (generic CSS/handoff snippets; production-grade only with Code Connect), Figma MCP server (feeds AI agents), **Builder.io Visual Copilot** (Mitosis → multi-framework: React/Vue/Svelte/Angular/Qwik/RN/Flutter), **Anima** (HTML/CSS, React, Vue, Tailwind, shadcn — IBM-invested Feb 2026), **Locofy.ai** (cleanest component structure; React/Vue/Angular/RN/Flutter, maps to MUI/Chakra/Ant), **Vercel v0** (Claude-powered; React+Tailwind only, ~70–85% recreation), **Penpot** (open-source; design *is* code, 1:1 HTML/CSS/SVG — the most portable, but plain handoff not a checked contract).

**Diff (design ↔ build).** Chromatic and Percy do pixel-diff *regression* against approved baselines (not against the design file). **Applitools Eyes** shipped a Figma plugin (Jan 2026) that compares a build against the Figma design — the only genuine design-vs-implementation drift detector — but returns visual pass/fail, not code.

**Gap / our edge.** Generators emit framework-bound code (v0 = React only; others let you pick *a* framework but still lock to one); none emit **verified standard-conformant, framework-portable** output as the primary artifact. And the two halves are disconnected: tools that *generate* don't *verify* against the design, and the one tool that *diffs* (Applitools) only returns pass/fail. Nobody closes the loop — generate standard entities **and** diff the rendered result back against the mockup, gated by `check:standards`. This is already partly owned by [#086 (mockup-to-standard-code)](/backlog/086-mockup-to-standard-code-tool/); the new angle here is the **live-view / per-page / per-component** *reference & analysis surface* (point at a running page, see the design it should match and the drift), not just batch codegen.

## 2. Designer empowerment → portable PR

Let a designer or non-coder fix a live component and propose a real code change without writing the exact code.

**Market.** **Builder.io Projects/Fusion** is the strongest incumbent — clones your repo, lets non-coders edit live, opens a real GitHub/GitLab PR with a bot for follow-ups — but writes framework-specific code with no objective gate (review = human eyeballing). Figma Dev Mode + Code Connect improves handoff accuracy but emits no PR. **Chrome DevTools Workspaces** and **Edge DevTools "Changes → Workspace"** save live edits back to source files (any framework, portable) but stop at "saved to a file" — no PR, no review, no verification, and break on compiled/JSX. **VisBug** (Google) does point-click restyle of any page but edits are ephemeral. Richer paths — **Onlook** ("Cursor for designers"), **Utopia**, **Tempo**, **Webstudio** (clean Remix/React export) — are mostly React-bound.

**Gap / our edge.** The intersection of **non-coder authorship + framework-portable output + automated standards verification as the merge gate** is genuinely unoccupied. Builder gives non-coder→PR but framework-specific and human-reviewed; browser Workspaces give portable edits but no PR/verification. A strong, machine-checkable standard is exactly what lets natural-language / direct-manipulation edits become a *mergeable, conformant PR* — the designer spots the problem (their strength), the standard guarantees the diff is valid (removes the procedural blocker of not being on the coding team).

## 3. Integration / E2E test status in context (+ last screenshots)

**Market.** Playwright VS Code extension (run/debug from sidebar, auto-opens Trace Viewer; 2026 "Copy prompt" emits an LLM fix prompt), Playwright UI Mode (watch-mode filmstrip + time-travel DOM), Trace Viewer (post-run `.zip` artifacts), `test-results/` screenshots/video — all **keyed by test, not by app route/component**. Cypress (in-app time-travel runner; Cloud "Test Replay" for CI runs), Currents.dev (CI orchestration + replayable traces), **Replay.io** (deterministic recording — *status uncertain, pivoted toward CI-agent failure analysis*), Chromatic / Storybook interaction tests (anchored to the *isolated component*, not the assembled page), Applitools, Testim, Reflect.run.

**Gap / our edge.** Every tool keys status to a *test* (spec file, recording, story), **never to the page/route/component you're currently viewing** via an introspectable model. There's no "this route has 3 passing + 1 flaky E2E scenarios" badge sourced from a queryable app model, and **nothing links an E2E scenario to a page's declared business rules**. Closest neighbours (Chromatic/Storybook) anchor to isolated components, not the page in context.

## 4. Unit test status in context / live

**Market.** **Wallaby.js** (fastest; re-runs affected tests every keystroke, live gutter pass/fail + branch coverage; Vitest/Jest/Mocha), Vitest UI (browser dashboard panel), Vitest Browser Mode (real-browser component tests, still maturing), **vscode-jest** (Orta — inline gutter + coverage on save/watch), Jest Runner (CodeLens on-demand), Stryker (mutation — batch), NCrunch (.NET live coverage).

**Gap / our edge.** Inline status is anchored to the **test file or source line**, never to a rendered page/component in a running app. None tie a unit test to an introspectable model ("this widget instance on this route is backed by these unit tests"), and none bridge a unit test to a per-component declared behavior/rule.

## 5. Cloud-offloaded test / lint / Playwright runs

For dev VMs / instant results without taxing the dev machine.

**Market.** GitHub Actions, CircleCI (test splitting + flaky detection), BrowserStack Automate / Sauce Labs / LambdaTest (real-device grids, parallel sessions), Currents.dev, **Nx Cloud / Nx Agents** (distributed task execution, 30–70% faster CI), Turborepo + Nx remote cache, **Depot / Namespace / Blacksmith / WarpBuild** (faster drop-in runners + remote Docker cache), Gitpod / Codespaces (remote test runs, headed browser still finicky).

**Gap / our edge.** Offload is framed purely as **infra speed** (faster runners, remote cache, parallel grids) or CI orchestration — **none expose results back into the editor anchored to the page/component you're editing**. There's no "cloud-ran the E2E + unit tests covering THIS route, here's fresh status + last screenshots, inline" loop. The cloud knows which *tasks/specs* ran; nothing maps that to an introspectable app model, so the dev still context-switches to a dashboard.

## 6. State & action explorer (Redux DevTools on steroids)

**Market.** Redux DevTools (action log + state diff + time-travel; **store-level/shared state only, no scope/visibility model**), Zustand/Jotai/Recoil/MobX devtools (Jotai has an atom dependency graph; MobX shows which observable triggered a re-render; Recoil largely sunset), **XState / Stately Inspector** (`@statelyai/inspect` — live statechart, actions & state first-class *because the model is declarative*, but **XState-only**), Reactotron, RxJS-Insights, Cerebral (historically the strongest replayable action-tree, now dormant), TanStack Query/Router devtools (server-cache / route-scoped), Replay.io (records *everything*, not a declared model), **OpenTelemetry Browser SIG** (W3C tracecontext → strongest *single-action front-to-back* trace, but **no state/session data model yet**).

**Gap / our edge.** Every tool is **adapter-bolted onto an opaque runtime** — it observes whatever the store happens to expose. None is grounded in a declarative model where **state visibility/scope (private vs shared) is declared** and actions + triggers are first-class entities you can query, schema-validate, and diff. Stately owns "declarative" (but XState-only); OTel owns "front-to-back trace" (but no state model). **Nobody unifies a declared state-visibility model + a front-to-back action trace + shareable, replayable scenarios that double as E2E fixtures.** This is the single biggest white-space and maps onto `webtraces` (OTel-aligned) + `webcontexts` (scoped data) + `webevents` already in the standard.

## 7. Feature flags

**Market.** LaunchDarkly (enterprise leader; AI Configs, guarded releases), **Statsig** (flags+experiments+analytics; **acquired by OpenAI ~$1.1B, Sep 2025** — roadmap uncertain), Flagsmith / Unleash (open-source, self-host), PostHog (flags coupled to its analytics), **Vercel Flags SDK + Edge Config** (open-source SDK; adapters *sync from* LaunchDarkly/Statsig rather than being a full backend), ConfigCat (lightweight, cheap), Split.io (now Harness FME).

**Gap / our edge.** Flags are opaque booleans keyed by string names — the app has no machine-readable contract of which flags gate which capabilities. Flags declared as **first-class intents/contexts** would let tooling auto-discover flag surfaces, verify every flag has a live code path, and make targeting portable across vendors instead of re-encoded per SDK.

## 8. A/B testing / experimentation

**Market.** Optimizely (post-Google-Optimize default), VWO (visual A/B + heatmaps), **GrowthBook** (open-source, warehouse-native stats), PostHog experiments, Statsig (sequential testing/CUPED), AB Tasty. **Google Optimize is discontinued (sunset Sep 30 2023)** with no direct replacement.

**Gap / our edge.** Assignment + exposure logging are bolted on per-SDK and rarely tied to the semantic component being varied. A model exposing **declarative variants + traces** lets an experiment target a *named UI intent* (not a CSS selector or hand-placed flag check), emit exposure events automatically, and survive a vendor swap — experiments as portable metadata, not embedded snippets.

## 9. Error replay & tracking — *scoped to dev bug-fixing, NOT prod analytics*

**Explicit scope note:** the goal is **finding and fixing bugs on the developer's own machine**, *not* replacing heavyweight production analytics/observability. We are not building a Sentry/LogRocket competitor.

**Market (all heavyweight prod platforms).** Sentry (+ Session Replay), LogRocket (replay + Redux capture, product analytics), FullStory (autocapture analytics), **Highlight.io** (open-source full-stack — **acquired by LaunchDarkly Apr 2025**, now "LaunchDarkly Observability"), OpenReplay (self-hostable), Datadog RUM, Bugsnag, Microsoft Clarity (free but UX-analytics), PostHog Session Replay.

**Gap / our edge.** All assume an ingestion backend, sampling, PII scrubbing, dashboards, per-session billing — pure overhead when the goal is *reproduce-and-fix locally*. They capture **DOM video + network breadcrumbs**, not *semantic* state, so you watch a pixel replay and reverse-engineer the app. A lightweight dev-only tool skips the cloud and ties an error directly to the **exact declared state + the action/trigger trace that produced it + the page's business rules** — a deterministic, local, replayable *fixture*, not a sampled prod recording. (This is largely the same artifact as #6's "replayable scenario" — one mechanism, two uses.)

## 10. In-context bug reporting / capture

**Market.** **Jam.dev** (one-click capture: console + network + repro + AI debugger), Marker.io (annotated capture → Jira/GitHub issue), BugHerd (element-pinned visual feedback), Bird Eats Bug ("dashcam" — records last ~2 min + console/network), Replay.io (records runtime for time-travel), Disbug, Userback, Jira browser capture.

**Gap / our edge.** These reconstruct context (console, network, DOM video) **externally** because the app exposes nothing structured. An introspectable app with **first-class traces/intents** emits a precise, *semantic* repro — which intent fired, which context/state, which declared component — instead of a heuristic video+log bundle. Bug reports become portable, replayable against the model, and far smaller than session recordings. (Reuses the same trace/replay substrate as #6 and #9.)

## 11. Business rules in context (+ Cucumber as source of truth)

Per-page rule list, in context; integrate Cucumber ↔ code ↔ rules; optionally make Gherkin the *source of truth* that drives rule behavior; levels of compliance (track-only → fully-enforced); aimed at **non-coder rule owners**.

**Market — two disconnected camps.** *Executable rules for non-coders:* Drools, **Camunda DMN** (decision tables), Decisions.com, IBM ODM (Decision Center), Pega — business users edit live rules safely, but author in DMN/decision-tables, **not Gherkin**. *Human-readable Gherkin:* Cucumber Studio (ex-HipTest), Behave, Serenity BDD, **Reqnroll** (the live fork after **SpecFlow EOL Dec 31 2024**) — Gherkin drives *tests*, and living docs are a reporting *byproduct*. **Generally none drive production rule behavior from Gherkin.**

**Gap / our edge.** There's a real chasm between "executable rules a non-coder can edit" (DMN/ODM — not Gherkin) and "human-readable Gherkin" (only drives tests, drifts from real behavior). Declarative **rule intents + traces** could make a single Gherkin/DMN-style declaration *both* the executable rule **and** the living doc **and** the test fixture — closing the drift gap. Compliance levels (track-only → enforced) become a property of the declaration. This is the in-context, per-page, non-coder framing of [#093 (business-rule manager + proof of compliance)](/backlog/093-business-rule-manager-proof-of-compliance/) — the deep design lives there.

## 12. Translation management (+ delivery-strategy picker)

For non-devs to manage; plus a **tech picker** for the translation *delivery strategy*.

**Market.** Lokalise / Phrase / Crowdin / Transifex (mature commercial TMS; Figma + CI integrations; Phrase/Crowdin/Transifex offer runtime CDN delivery), **Tolgee** (open-source, standout in-context Alt-click editing; CDN delivery is Enterprise-only), i18next + **i18n-ally** (VS Code inline previews/extraction), Weblate (Git-native), locize (i18next authors, CDN runtime).

**Delivery strategies — conflated, never chooseable.** Bundled-in-build (redeploy to change copy) · fetched from service/CDN at runtime (over-the-air) · hardcoded in frontend · served from backend per request · stored in DB (editable content). **No tool helps you choose or switch strategy** — each vendor hardwires one (mostly bundled-vs-their-CDN); moving between them is a manual re-plumb.

**Gap / our edge.** The sharpest pure-strategy white-space: treat **translation delivery as a swappable provider/trace** on the `webintl` Localization protocol — the same declared string intents resolved at build-time, from a CDN, from backend, or from DB behind one contract, switchable by config. (Standalone localization AI is low-moat vs Lokalise/Phrase — see [#089](/backlog/089-monetization-product-ideas/) parked note; the *strategy-picker* is the differentiated part.)

---

## Dev-browser landscape (for #141)

**Dev-focused browsers.** Polypane (Chromium; synced viewports + 80+ a11y/debug tools — but generic, runs the same on *any* site, doesn't light up more for a compatible app), Sizzy / Responsively (responsive preview only), Blisk (preview/QA, still maintained), Arc (workspace browser — **effectively sunset**, The Browser Company pivoted to an AI browser Jan 2025), Brave (Chrome DevTools, no differentiation), Edge DevTools/Workspaces (in-browser file editing, not runtime management), SigmaOS / Wavebox (productivity, opaque SaaS apps).

**Browser-as-platform.** Electron dev tools (proves "ship-your-own-Chromium-as-a-shell"), Tauri + CrabNebula DevTools (app-aware — but only because Tauri instruments the app; desktop-only), **Replay.io** (forked deterministic Chromium for time-travel — strongest precedent for a custom fork unlocking richer tooling, but gates on a *recording*, not conformance), Chrome DevTools Protocol (the plumbing any dev browser builds on).

**The key precedent — compatibility-gated overlays.** React / Vue / Redux DevTools **detect their framework and only light up when present** (React tab on React apps, Redux requires store wiring). This is *exactly* "tooling unlocks when the app is compatible" — but compatibility means **a specific framework/library**, and the surface is a DevTools tab, not a full management UI. Storybook / Ladle similarly light up only via authored stories (an instrumentation contract), but they're build-time harnesses, not a browser over a running app.

**Synthesis — novelty.** No product is *a browser whose tooling depth scales with how standard-compliant the loaded app is*. The landscape splits cleanly: generic dev browsers (app-agnostic tooling on any page) vs. framework DevTools/harnesses (gate on compatibility, but compatibility = one framework, payoff = a debug tab/sandbox). The novel move is gating on a **vendor-neutral standard**: React DevTools only ever helps React apps, but a standard-conformant app exposes a *uniform self-description* that **any** compliant app — any stack — surfaces through the same browser (state explorer, test status, rules, translations, design diff), with depth scaling to how much of the standard it implements. That inverts framework lock-in into a portable contract, and "not compatible → blank page" becomes a forcing function rewarding conformance.

**Synthesis — risk.** (1) *Why a whole browser, not an extension?* React/Vue/Redux DevTools prove a **Chromium extension** already detects-and-lights-up with near-zero distribution cost. The burden of proof is what a forked browser unlocks that an extension/DevTools-panel cannot — chrome-level management UI, intercepting navigation to show "not compatible," deeper-than-CDP hooks. **Likely sequencing: extension/DevTools-panel first (cheap, proves the lit-up-on-conformance model), browser only when a capability demands it.** (2) *Chromium maintenance burden* — Replay shows a fork is heavy/ongoing; build on stock Chromium + CDP/extension APIs; a fork is a last resort. (3) *Adoption chicken-and-egg* — tooling only shines on apps that adopt the standard (same bootstrapping as Storybook/Redux DevTools); value must be high enough that authors instrument voluntarily.

---

## Cross-feature synthesis — the one moat

Nine of twelve features share a single substrate: an **introspectable, declarative app model** (registries + intents + contexts + traces + declared rules). That is why the same edge recurs — *semantic instead of heuristic, portable instead of framework-bound, verifiable instead of plausible.* Three reusable mechanisms underpin most features:

- **The trace/replay artifact** (declared state + action trace) powers the state explorer (#6), dev error-repro (#9), and in-context bug reports (#10) — author it once.
- **The introspectable app model** (what's on this page/route, which providers, which intents) powers in-context test status (#3, #4, #5), flags (#7), experiments (#8), and rules (#11).
- **The verify-gated conformance check** powers mockup→code (#1) and designer→PR (#2).

This matches the [#089](/backlog/089-monetization-product-ideas/) "AI proposes, the standard verifies" moat, extended from codegen to the whole developer experience: **the standard is the ground truth that turns generic tooling into reliable, portable tooling.**

## Uncertainty flags

- **Replay.io** — clearly pivoted toward CI-agent failure analysis; standalone manual time-travel product's current status unconfirmed.
- **Statsig** OpenAI-acquired (Sep 2025); independent roadmap uncertain. **Highlight.io** → LaunchDarkly (Apr 2025). **SpecFlow** EOL (Dec 2024); **Reqnroll** living-docs still incomplete.
- **Applitools** Figma plugin (Jan 2026) and **Percy** Visual Review Agent from comparison sources, not primary vendor pages — verify if load-bearing.
- Dev-browser novelty claim is absence-of-evidence (no standard-conformance-gated management browser found), not proof none exists in stealth.
