---
kind: epic
parent: "089"
status: open
dateOpened: "2026-06-07"
tags: [product-strategy, dev-experience, dev-browser, ai-generated, candidate-features, full-context-debug, ownership-routing, introspection]
relatedReport: reports/2026-06-07-dev-surface-feature-market-landscape.md
crossRef: { url: /backlog/140-dev-surface-product-feature-matrix/, label: "Product surface × feature matrix (#140)" }
---

# AI-DX dev-experience feature family — full-context debugging & "the best person does the work"

**Epic (sliced 2026-06-22).** The umbrella for the AI-generated dev-experience candidate features that
extend the [dev browser (#141)](/backlog/141-dev-browser-vision/) along two threads the user raised —
*having the full context to debug* and *getting the best person on the team to do the work*. This was a
living candidate **pool**; per the user directive it is now an **epic whose children are granular
`decision` cards** — one per net-new candidate, each asking *"do we ever need this, and on what trigger
to build it?"* Nothing here is a committed build yet: each fork ratifies "yes, build (→ spawns a story)"
or "no / not yet". Promote a `yes` to its own build item at ratification.

All candidates ride the same moat: a Web Everything app is **self-describing** (introspectable registries /
intents / contexts / traces / declared rules + ownership), so tooling can be *semantic, portable,
verifiable* instead of heuristic and framework-bound — and can know not just **what** every piece is but
**who owns it**. Most are natural-home features of the dev browser and are **local-first / zero-server**
(consistent with the cost-flat rule — the [monetization](docs/agent/platform-decisions.md#monetization) rule).

> ⚠️ **AI-generated origin.** These candidates were produced by Claude in a brainstorm extending the
> [feature matrix (#140)](/backlog/140-dev-surface-product-feature-matrix/) — a raw idea inventory, now
> carved into granular decisions to vet one at a time, not vetted/prioritised specs.

## Granular decision children (one fork each)

### A — Full context to debug
- [#1631](/backlog/1631-shareable-full-context-repro-bundle-for-the-dev-browser/) — **Shareable full-context repro** (state+trace+rules+owner replay link). The handoff unit.
- [#1632](/backlog/1632-live-contract-and-data-inspector-at-provider-context-seams/) — **Live contract/data inspector** (actual vs declared schema at each seam).
- [#1633](/backlog/1633-render-cause-and-perf-inspector-grounded-in-the-standard/) — **Render-cause / perf inspector**, standard-grounded.
- [#1634](/backlog/1634-semantic-explain-this-element-inspector/) — **Semantic "explain this element"** → intent/component/provider/rule/owner.

### B — The best person does the work
- [#1635](/backlog/1635-ownership-aware-routing-in-context/) — **Ownership-aware routing in context** → auto-route to the right person.
- [#1636](/backlog/1636-role-scoped-lenses-over-one-dev-browser/) — **Role-scoped lenses** (designer / rule-owner / translator / dev).
- [#1637](/backlog/1637-capability-matched-task-queue/) — **Capability-matched task queue** (extends routing into a queue).
- [#1638](/backlog/1638-in-context-annotation-and-discussion-threads-on-semantic-no/) — **In-context threads on semantic nodes** (Figma comments on the running app).
- [#1639](/backlog/1639-semantic-handoff-packets-between-roles/) — **Semantic handoff packets** (designer→dev→reviewer).

### C — Verify & review (the "AI proposes, the standard verifies" moat, live)
- [#1640](/backlog/1640-standard-aware-review-assistant/) — **Standard-aware review assistant** (diff vs declared contracts/intents/rules).
- [#1641](/backlog/1641-declared-rule-to-test-coverage-gap-surfacer/) — **Declared-rule ↔ test-coverage gap surfacer**.
- [#1642](/backlog/1642-intent-and-a11y-conformance-inspector/) — **Intent / a11y-conformance inspector** (declared intents vs reality).

### D — Simulate any condition (local, no server)
- [#1643](/backlog/1643-variant-simulator-for-locale-flag-role-viewport-motion/) — **Variant simulator** (locale / flag / role / viewport / motion at once).
- [#1644](/backlog/1644-failure-and-network-injector-over-declared-reliability-paths/) — **Failure / network injector** over declared reliability paths.
- [#1645](/backlog/1645-permission-and-identity-simulator/) — **Permission / identity simulator** (preview as any role).

### E — State, data & scenarios
- [#1646](/backlog/1646-scenario-and-fixture-library-that-doubles-as-e2e-fixtures/) — **Scenario / fixture library** (doubles as E2E/Cucumber fixtures).
- [#1647](/backlog/1647-named-seed-and-scenario-loader/) — **Named seed / scenario loader** (one-click app states).
- [#1648](/backlog/1648-pii-and-sensitive-data-flow-map/) — **PII / sensitive-data flow map**.

### F — Change safety
- [#1649](/backlog/1649-branch-and-run-diff-in-the-dev-browser/) — **Branch / run diff** (A vs B: state + render + rules).
- [#1650](/backlog/1650-safe-edit-sandbox-emitting-a-pr/) — **Safe-edit sandbox** (tweak live → discard or emit a PR).

### G — Navigation / search
- [#1651](/backlog/1651-semantic-search-over-the-running-app/) — **Semantic search over the running app** (grep over meaning).
- [#1652](/backlog/1652-jump-to-source-from-any-live-element/) — **Jump-to-source from any live element**.

## Already-homed candidates (cross-ref, not spawned)

These six folded into existing items at triage rather than becoming their own decisions:

- **Living architecture diagram of the running app** & **Impact preview before a change** → [#092 provider-consumer graph](/backlog/092-provider-consumer-graph-platform-manager/).
- **AI fix grounded in full context, gated by the standard** & **Live conformance badge/regression gate** → [#095 conformance auto-fix](/backlog/095-conformance-auto-fix-agent/) / [#089](/backlog/089-monetization-product-ideas/).
- **Mock data generator from declared schemas** → [#107 mock/proxy dev service](/backlog/107-mock-proxy-dev-service/).
- **Self-describing onboarding / guided tour** → webdocs [#091](/backlog/091-gap-2-webdocs-project/).

## Reference

The original brainstorm landscape lives in [the dev-surface feature-market report](reports/2026-06-07-dev-surface-feature-market-landscape.md);
the [#140 matrix](/backlog/140-dev-surface-product-feature-matrix/) (resolved) remains the reference map.
Shared mechanisms most of these ride: the trace/replay artifact, the introspectable model, and the
verify-gated check — so once those exist, most are cheaper than they look.
