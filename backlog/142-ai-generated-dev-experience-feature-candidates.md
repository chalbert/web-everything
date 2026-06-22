---
kind: decision
parent: "089"
status: open
dateOpened: "2026-06-07"
tags: [product-strategy, dev-experience, dev-browser, ai-generated, brainstorm, candidate-features, full-context-debug, ownership-routing, introspection]
relatedReport: reports/2026-06-07-dev-surface-feature-market-landscape.md
crossRef: { url: /backlog/140-dev-surface-product-feature-matrix/, label: "Product surface × feature matrix (#140)" }
---

# AI-generated candidate dev-experience features — full-context debugging & "the best person does the work"

**Decision (un-parked 2026-06-22 — parking is not a prioritisation escape):** Which AI-DX candidate features (this living pool) to promote into real backlog work, and on what trigger.

> **Parked `deferred` (2026-06-22, batch-2026-06-22-1575-1030).** This is a living candidate-feature **pool**,
> not a unit of agent-mechanical work — "resolving" it = the product-judgment call of which candidates
> graduate to their own items. Parked so it stays an available reference inventory without surfacing as a
> batchable task (it kept getting packed). Was briefly mis-set `kind: idea` (not a valid kind) during this
> cleanup; reverted to `task` + `status: parked`.
>
> **Re-homed `parent: 140 → 089` (2026-06-22).** Its original triage home, the [#140 feature matrix](/backlog/140-dev-surface-product-feature-matrix/),
> was resolved as a delivered planning artifact (its surface-bet decision carved to [#1590](/backlog/1590-dev-surface-monetization-bet-extensions-as-funnel-vs-dev-bro/)),
> so this pool now rolls under the live [#089](/backlog/089-monetization-product-ideas/) product-ideas epic. The #140 matrix
> remains the reference map (linked below); promote a candidate to its own item when picked up.

> **Reclassified `decision` → `idea` (2026-06-11).** This is an AI-generated brainstorm **inventory**, not an open fork — there's no single call to ratify here. Its real action is *triaging which of these candidates graduate to #140 rows (or their own items)*, and that triage is owned by the [#140 feature matrix](/backlog/140-dev-surface-product-feature-matrix/) (this card is `parent: 140`). Kept as a `task`-level idea rolling under #140; `status: open` so it stays available as the candidate pool.

> ⚠️ **AI-generated.** This card was produced by Claude in a brainstorm extending the [feature matrix (#140)](/backlog/140-dev-surface-product-feature-matrix/) along two threads the user raised — *having the full context to debug* and *getting the best person on the team to do the work*. It is a **raw idea inventory to triage**, not vetted, deduped, or prioritised specs. Promote the good ones to #140 rows or their own items; discard the rest.

All candidates ride the same moat as the matrix: a Web Everything app is **self-describing** (introspectable registries / intents / contexts / traces / declared rules + ownership), so tooling can be *semantic, portable, verifiable* instead of heuristic and framework-bound — and can know not just **what** every piece is but **who owns it**. Most are natural-home features of the [dev browser (#141)](/backlog/141-dev-browser-vision/) and are **local-first / zero-server** (consistent with the cost-flat rule in #140 — the [monetization](docs/agent/platform-decisions.md#monetization) rule).

## A — Full context to debug

1. **Shareable full-context repro** — bundle declared state + action trace + the page's rules + ownership into one **replayable link** a teammate opens in the dev browser. The *handoff unit* (capture is #9/#10; this transfers). Market: Replay/Jam share a recording, not a semantic state+rules+owner bundle.
2. **Live contract/data inspector** — actual vs **declared** schema at each provider/context seam, validated live. Market: Apollo/network tab show data, never against a declared contract.
3. **Render-cause / perf inspector** — which action/state triggered this re-render, standard-grounded (extends #6; MobX-style but portable).
4. **Semantic "explain this element"** — click any rendered thing → the intent / component / provider / rule / owner behind it. Market: inspect-element shows DOM, not meaning.
5. **Living architecture diagram of the running app** — the [#092 graph](/backlog/092-provider-consumer-graph-platform-manager/) auto-rendered from the *live* app, not a repo scan. *(dedup: extends #092)*

## B — The best person does the work

6. **Ownership-aware routing in context** — for the component/rule/state in front of you, *who owns it* (CODEOWNERS + declared provider authorship) → a bug/PR/review auto-routes to the right person, not a triage queue. Market: GitHub CODEOWNERS / Sentry suspect-commits — none tie to *semantic* component ownership.
7. **Role-scoped lenses** — the same browser shows a **designer** the design-diff/visual-edit surface, a **rule-owner** the Cucumber/rules surface, a **translator** the i18n surface, a **dev** state/tests. Present the right slice to the right contributor — the unifying "lower the barrier so the best person contributes" feature. Market: nothing does role-scoped *app* introspection.
8. **Capability-matched task queue** — open work routed by ownership + expertise + current context (extends #6 into a queue).
9. **In-context annotation / discussion threads** — comment on a *semantic node* (component/state/rule), not a pixel; threads persist to the model. Figma comments, but on the running app.
10. **Handoff packets** — designer→dev, dev→reviewer, with full semantic context attached (generalises #1).
11. **Self-describing onboarding / guided tour** — a new contributor opens a conformant app and the browser explains it (providers, intents, rules) — full context for the *newest* person. *(dedup: relates to webdocs #091)*

## C — Verify & review (the "AI proposes, the standard verifies" moat, live)

12. **AI fix grounded in full context, gated by the standard** — when no human is needed, the AI *is* the worker: given declared state+trace+rules it proposes a conformant fix the standard verifies. *(dedup: [#095](/backlog/095-conformance-auto-fix-agent/) surfaced live)*
13. **Standard-aware review assistant** — checks a diff against declared contracts/intents/rules and flags conformance drift *before* a human reviews.
14. **Declared-rule ↔ test-coverage gap surfacer** — "this page has a declared rule with **no covering test**." A semantic bridge generic coverage tools can't make.
15. **Live conformance badge / regression gate as you browse** — "this page is conformant at tier X; this change would drop it." *(dedup: [#089](/backlog/089-monetization-product-ideas/) verification, live)*
16. **Intent/a11y-conformance inspector** — the page's declared intents (density, motion, a11y) vs reality; WCAG against *your* declarations. Market: axe/Lighthouse are generic, not declaration-aware.

## D — Simulate any condition (local, no server)

17. **Variant simulator** — flip the live app into any locale / flag combo / role / viewport / reduced-motion *at once*: "what does this look like for a French admin on slow network with reduced motion?" Highly demo-able. *(ties #7 flags, #12 i18n, intents)*
18. **Failure / network injector** — exercise the app's **declared reliability/error paths** (webreliability) live, to test error states on purpose.
19. **Permission / identity simulator** — preview the app as any role/permission set. *(ties webpermissions [#009](/backlog/009-gap-13-webpermissions-project/), webidentity [#012](/backlog/012-gap-5-webidentity-project/))*

## E — State, data & scenarios

20. **Scenario / fixture library** — record live state+action scenarios from the running app; they **double as E2E/Cucumber fixtures**. (The user's "scenario to load, shared with cucumber/playwright.")
21. **Seed / scenario loader** — load named app states ("logged-in admin, 3 orders") for dev/demo/test in one click.
22. **Mock data generator from declared schemas** — realistic mock data conforming to the declared contracts. *(dedup: ties [#107 mock/proxy](/backlog/107-mock-proxy-dev-service/))*
23. **PII / sensitive-data flow map** — which state is private/shared/persisted/sent where — the #6 visibility model applied to privacy/compliance. *(ties #093)*

## F — Change safety

24. **Impact preview before a change** — live blast-radius: "edit this provider/intent → here's every consumer that changes." *(extends #092)*
25. **Branch / run diff** — load branch A vs B in the browser, diff state + render + rules. *(extends #1 design-diff to branch-diff)*
26. **Safe-edit sandbox** — tweak the live app, see the effect, discard or emit a PR; never touches prod. *(extends designer→PR #2)*

## G — Navigation / search

27. **Semantic search over the running app** — "find every place that uses the sort intent / consumes the user context / declares a required field." Grep over *meaning*, not text.
28. **Jump-to-source from any live element** — click a rendered thing → open its declaration in the editor, any stack (Onlook does this for React; ours is standard-based, stack-agnostic).

## Triage guidance (AI's own read — verify)

- **Highest-leverage / most net-new:** #1 shareable full-context repro, #6 ownership-aware routing, #7 role-scoped lenses, #14 declared-rule↔test-gap, #17 variant simulator. These are the ones with the clearest white-space and that most directly serve "full context" + "best person."
- **Reuses the three shared mechanisms from #140** (trace/replay artifact · introspectable model · verify-gated check) — so most are cheaper than they look once those exist; #1/#3/#20/#21 ride the trace artifact, #2/#4/#5/#24/#27 ride the introspectable model, #12/#13/#15 ride the verify gate.
- **Likely-fold-into-existing (cross-ref, don't spawn):** #5/#24 → #092 · #12/#15 → #089/#095 · #22 → #107 · #11 → #091.
- **Next:** pick which graduate to #140 rows or their own items; the rest stay parked here as inventory.
