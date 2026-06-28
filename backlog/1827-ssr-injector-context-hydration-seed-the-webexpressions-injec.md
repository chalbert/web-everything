---
kind: story
size: 13
status: resolved
locus: frontierui
relatedProject: webexpressions
relatedReport: reports/2026-06-27-split-analysis-1827.md
dateOpened: "2026-06-27"
dateStarted: "2026-06-28"
dateResolved: "2026-06-28"
graduatedTo: none
tags: [webexpressions, injector-context, ssr, hydration, fui-runtime]
---

# SSR injector-context hydration: seed the webexpressions injector chain from server-rendered state

A general capability surfaced by #1818: when a block's declarative binding (`rows="[[ @ctx ]]"`) resolves against a **non-deterministic** (client-only) context, the server cannot resolve it at build — so on upgrade the client must seed the `webexpressions` injector chain from runtime state before the binding resolves. This card covers that hydration mechanism: how an injector-chain context is populated from client-only state so declarative `[[ ref ]]` bindings have something to resolve against. General to every block's declarative-binding form, not data-table-specific.

**Off the docs critical path.** Per #1818's determinism × interactivity rule, the docs `<table>` family (#1787 / #1600) is wholly **deterministic** — the build resolves its bindings server-side and emits plain `<table>`s, needing no client payload and no hydration. This card is required only by **app / dynamic** consumers whose context is client-only. It does **not** block the docs surface; verify a real non-deterministic consumer before building (per *Prep: Verify Mechanism Has A Consumer*).

## Disposition (corrected 2026-06-28 — buildable now; the "no consumer" park was wrong)

This card is **FUI-homed and buildable now, test-first.** It was previously mis-flagged `priority: low` + "consumer-parked" prose; that park does not survive scrutiny (see *Why the park was wrong* below). Two facts set the real state:

1. **It is a standard *implementation*, not a contract — so it lives in FUI, never WE** (foundational zero-impl rule, `we:docs/agent/platform-decisions.md#constellation-placement`). The hydration mechanism is pure stateful runtime: it seeds the injector-context DI seam (`fui:plugs/webinjectors/InjectorRoot.ts` — the *same* mechanism the runtime route-view path reuses) from client-only state. WE keeps only the **contract**, and that contract is **already codified** by the now-resolved #1818 in `we:docs/agent/platform-decisions.md#block-data-ingestion` (the non-deterministic cell + the precedence + the "carry raw typed values" correctness invariant). There is no residual WE-layer artifact left to add — only the FUI runtime impl. Hence `locus: frontierui`.

2. **The codified contract makes a test fixture the consumer — so build it now.** Because #1818 (resolved) *codifies* the non-deterministic cell, the mechanism's shape is settled: there is a correct contract to build to. A **FUI vitest fixture** that seeds a client-only context, mounts a block with `rows="[[ @ctx ]]"`, and asserts the injector chain is seeded from runtime state so the binding resolves at upgrade **is a valid consumer** — exactly as its deterministic sibling #1902 builds against "keyed JSON in → keyed SSR HTML out." No production app surface is needed to build and prove this.

### Why the park was wrong

"No app `blockedBy: 1827` exists yet" was treated as a defer reason. It is not, once the contract is codified (`we:docs/agent/backlog-workflow.md` → hold model, `maturityGated` bullet; memory *Prep: Verify Mechanism Has A Consumer*): (a) `priority: low` means *settled-but-low-value-now*, not "gated on a consumer" — that misuse is the soft-`deferred` park #1620 retired; (b) `maturityGated`'s bar is "building now yields a *worse* artifact," which a codified contract makes false; (c) `externalConsumers≥N` is met by a consumer's *existence*, never its *absence*. So the only honest states were build-now, a real `blockedBy`, or a typed `maturityGated` — and build-now is correct.

**Dogfooding note.** Eleventy→runtime does **not** auto-create the consumer (determinism = "is the context build-known?", not "who renders") — the docs `<table>` family stays deterministic and ships without this. But a live dogfooded site's **interactive** surfaces (search/filter/live state) are the eventual *production* non-deterministic consumers; the fixture proves the mechanism ahead of them.

**Sizing.** `size: 13` — a *general* runtime hydration mechanism over the whole injector chain (every block's `[[ ref ]]` form), not a 5-point data-table slice. Large but single-item (out of the batch pool by size, not by a park).

**Blocker note:** the former `blockedBy: ["1818"]` edge is cleared — #1818 is resolved and its contract (the non-deterministic cell) is codified; the edge was the contract dependency, now satisfied.

## Progress

- **Status:** resolved — mechanism + fixture delivered (the card's DoD: "a FUI vitest fixture … is a valid consumer … No production app surface is needed"). Production wiring carved to **#1928**.
- **Locus / repo:** frontierui (`fui:plugs/webinjectors/`). Committed `8804320`.
- **Done:**
  - Un-parked (dropped `priority: low` + `awaiting-consumer` tag); rewrote the disposition (no-consumer park was wrong, fixture = consumer); codified the rule in `we:docs/agent/backlog-workflow.md` (hold model) + memory #19.
  - **`seedDeclarativeInjector(injectorRoot, scope, domain, provide, {id?, into?})`** in `fui:plugs/webinjectors/declarativeInjector.ts` — the imperative twin of `applyDeclarativeInjectors` for the non-deterministic / client-only cell of #1818's `#block-data-ingestion`: seeds a runtime value into the injector chain at a scope (`ensureInjector` + `injector.set`), carrying the **raw typed value** (#1818 invariant — no stringify/reparse), so a descendant's `[[ ref ]]` resolves through the same chain at upgrade. Exported from `fui:plugs/webinjectors/index.ts`.
  - Failing-first vitest fixture `fui:plugs/webinjectors/__tests__/unit/seedDeclarativeInjector.test.ts` (8 tests): client-only seed → descendant resolves; **proven on the real platform read path** (`InjectorRoot.getProviderOf('customContexts:…')`, the same key AutoHeading/ResourceLoader/droplist read); raw-typed-value identity; subtree isolation; explicit `injector="id"`; `into` accumulation; falsy-provide honoured; empty-domain throws.
  - Gate green: full `webinjectors` suite 205 passed, `tsc` clean for webinjectors, `check:standards` 0 errors.
- **Notes:** `domain` is the verbatim injector key, so the primitive is general for both `@scope/name` Protocol domains and `customContexts:name` context keys. The `@name → customContexts:name` key-derivation sugar and real-surface wiring land in **#1928** (gated on a real interactive non-deterministic consumer existing — "Prep: Verify Mechanism Has A Consumer").
