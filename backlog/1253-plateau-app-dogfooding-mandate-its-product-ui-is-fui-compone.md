---
kind: decision
status: resolved
locus: plateau-app
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "docs/agent/platform-decisions.md#first-party-dogfood"
codifiedIn: "docs/agent/platform-decisions.md#first-party-dogfood"
preparedDate: "2026-06-20"
tags: [dogfood, fui, plateau-app, theme, intents, charter]
---

# plateau-app dogfooding mandate — its product UI is FUI components, themed + intent-driven, nothing hand-rolled (preserve once landed)

plateau-app today dogfoods almost no FUI: a 2026-06-20 audit found its UI ~95% hand-rolled vanilla TypeScript over a proprietary theme (`plateau:src/styles/theme.css`), with FUI present only as the plugs bootstrap and two SSR components in one feature area. This decision **sets the standing goal**: plateau-app's product UI is composed *only* of FUI components driven by WE intents, differentiated from any other first-party surface **solely by a custom theme** — hand-rolled chrome is a dogfooding defect, not a style choice. The migration is epic [#1254](/backlog/1254-rebuild-plateau-app-s-ui-on-fui-components-custom-theme-inte/); this item is the charter and the preserve-once-landed rule.

## Ruling — RATIFIED 2026-06-20 (the standing goal)

> Ratified and codified to the statute layer as [first-party-dogfood](../docs/agent/platform-decisions.md#first-party-dogfood). Cite the statute rule; do not re-litigate. The rule below is the standing goal.


- **plateau-app is a dogfood, not a one-off product.** Every rendered surface (Intent Configurator, Technical Configurator, Component Assembler, Platform Map, Control Plane dashboard, nav/sidebar/auth chrome) renders from FUI components driven by WE intents. The only thing that distinguishes plateau-app's look from WE-docs or any other first-party surface is its **theme (DTCG tokens) + intent set** — nothing structural or behavioral is hand-authored.
- **Hand-rolled UI is a conformance defect.** Reaching for `document.createElement` / bespoke CSS to build an interaction a FUI component already provides is the plateau-app analogue of exercise-app *active-bypass = FAIL* and [compose-don't-hand-roll](../docs/agent/platform-decisions.md). The residue — anything plateau-app *can't* build from `theme + intents` — is a **standards/FUI gap to file, never a hack to keep**.
- **Preserve once it lands (the load-bearing clause).** Once a surface migrates onto FUI, regressing it back to hand-rolled UI is a gated defect, not a tradeoff. The goal is durable: this is *why* it is codified to the statute layer rather than living only as epic scope — the epic delivers the state, the rule keeps it.

## Why a decision and not just an epic

This is the **plateau-app instance of an already-ratified thesis**, promoted to a standing rule so it is cited, not re-litigated:
- [reproduction-conformance](../docs/agent/platform-decisions.md#reproduction-conformance) (#1225): "the difference between any two top design systems is `theme tokens + intents` and nothing else." That program proves the thesis against **incumbents**; this mandate is its **internal twin** — proving it on **our own product**.
- [#777](/backlog/777-dogfood-the-we-docs-website-on-fui-components-rework-the-sit/): the parallel dogfood mandate for the **WE-docs site**. plateau-app needs the same, and unlike WE-docs it is **unblocked by the WE↔FUI boundary** — plateau-app is the product layer and already consumes FUI directly via workspace aliases ([constellation-placement](../docs/agent/platform-decisions.md#constellation-placement): served product → Plateau, free to render FUI). No mode-C relaxation gate applies.
- Kin to the exercise-app conformance loop (#314): the product is a **forcing function** for FUI + intents; a rendered regression on plateau-app's own front door *is* a component-conformance failure.

## Scope & non-scope

- **In scope:** plateau-app's own chrome and feature surfaces re-rendered from FUI components + intents under a plateau theme.
- **Not the boundary:** this does not touch the WE↔FUI source-dependency boundary — plateau-app already imports FUI; that is the intended direction (product consumes impl).
- **Gated on FUI shipping the parts:** the migration (epic #1254) proceeds as FUI ships the components plateau-app hand-rolls (NavMenu, form controls, tabs, cards, status badges, tables); #658 (promote `@frontierui/blocks` canonical) is resolved, so the floor exists.

**Confidence:** ~85% this is the right standing goal (it is the user-set direction and a direct instance of #1225/#777). The residual is *sequencing/scope of the migration*, which is prioritization carried by epic #1254 — not a fork in this charter.

**Codified to:** `we:docs/agent/platform-decisions.md#first-party-dogfood` (statute rule — the internal-dogfood twin of [reproduction-conformance](../docs/agent/platform-decisions.md#reproduction-conformance)). Lands the work via epic [#1254](/backlog/1254-rebuild-plateau-app-s-ui-on-fui-components-custom-theme-inte/). Enforcement (the "preserve once landed" gate) filed as follow-up [#1280](/backlog/1280-plateau-app-render-conformance-gate-give-preserve-once-lande/).
</content>
</invoke>
