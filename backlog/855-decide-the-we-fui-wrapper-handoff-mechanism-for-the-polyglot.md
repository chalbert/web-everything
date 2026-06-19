---
type: decision
workItem: story
size: 3
parent: "746"
status: resolved
blockedBy: ["821"]
dateOpened: "2026-06-17"
dateStarted: "2026-06-17"
dateResolved: "2026-06-17"
graduatedTo: none
codifiedIn: "docs/agent/platform-decisions.md#compose-dont-handroll"
preparedDate: "2026-06-17"
tags: [webdocs, block-explorer, adapters, polyglot, boundary, decision]
relatedProject: webdocs
relatedReport: reports/2026-06-17-we-fui-wrapper-handoff.md
crossRef: { url: /backlog/753-polyglot-adapter-panel/, label: "Polyglot adapter panel (#753)" }
---

# Decide the WE→FUI wrapper-handoff mechanism for the polyglot adapter panel

How does the **FUI** polyglot panel ([#753](/backlog/753-polyglot-adapter-panel/), `locus: frontierui`) obtain and live-test the React/Vue wrapper source that the **WE**-owned generator (#821, [`we:genWrapper.mjs`](../scripts/gen-wrapper/genWrapper.mjs)) emits — across the repo boundary where WE never renders FUI block code? The item filed three options cold (A build-time artifact · B fuiDemo-iframe bundle · C on-demand sandbox); the prior-art survey ([research topic](/research/we-fui-wrapper-handoff/), [report](../reports/2026-06-17-we-fui-wrapper-handoff.md)) collapses them to **one forced invariant + one genuine fork**. The surviving call: *what crosses the boundary* — WE publishes the derived wrapper artifact, or WE publishes the generator + CEM contract and FUI derives at its build.

## The axis

The seam is a *cross-repo artifact handoff*, not a rendering question. WE owns the generation: [`we:genWrapper.mjs:202`](../scripts/gen-wrapper/genWrapper.mjs) exports a pure `generateWrapper(declaration, target)` whose output ["crosses the layer seam to the FUI Block Explorer panel"](../scripts/gen-wrapper/genWrapper.mjs) ([`we:genWrapper.mjs:6`](../scripts/gen-wrapper/genWrapper.mjs)), with a CLI ([`we:cli.mjs`](../scripts/gen-wrapper/cli.mjs)) that materializes `generated/wrappers/<target>/<Name>.<ext>` from the ratified CEM (`we:custom-elements.json`, #626). FUI owns the render: the panel is `locus: frontierui` and embeds in the WE block page only through the #701 `fuiDemo` iframe ([`we:.eleventy.js:100`](../.eleventy.js#L100)). The prior art (Stencil output targets, Lit Labs `gen-wrapper-*`, `@lit/react`) is **unanimous and one-directional**: framework wrappers are a *build-time artifact of the source library*, published for the consumer to read — **no shipping tool generates wrappers on-demand in the consumer** ([report §Topic 1](../reports/2026-06-17-we-fui-wrapper-handoff.md)). That, plus the fact that consume-mode output is a *pure function of the CEM* (deterministic, no per-user input — [`we:genWrapper.mjs:69-189`](../scripts/gen-wrapper/genWrapper.mjs)), forces the invariants below and leaves exactly one real choice.

### Ruling at a glance

| What crosses the WE→FUI boundary | Ratified | Confidence |
|---|---|---|
| **The CEM contract + behavioral wrapper conformance vectors (B2). The generator (`genWrapper`) is FUI/tool-side, NOT a `@webeverything` standard.** | **B2 (2026-06-17, user-ratified)** | High on "generator ≠ WE standard"; B2-over-B1 ratified |

> The original A1/A2 axis ("does WE publish the derived wrapper code or the generator?") was **withdrawn** — both leaked framework-specific codegen into the contracts-only layer. See *Reframing* below.

## Ruling (2026-06-17) — RATIFIED: B2

**WE publishes only the CEM contract (`we:custom-elements.json`, the `custom-elements-manifest` protocol, #626) + a small corpus of *behavioral* wrapper conformance vectors (CEM-input → runtime-behavior assertions: renders the tag, forwards attributes, assigns reactive properties, bridges events).** The generator `genWrapper` is **FUI/tool-side** (or own-repo per #507) — a zero-lock-in build devtool, never a published standard; its copy in `scripts/` is demoted to a *reference generator / conformance fixture* subordinate to the contract (the #461 `fetchHandler` "reference impl, not the definition" pattern). Only the **contract** crosses the seam; code never does. FUI runs a generator (its own, or WE's reference one vendored as a swappable devDependency) over WE's CEM to produce its wrappers; the vectors certify the output reflects the CEM without WE owning the codegen.

*Red-team (B2 vs B1):* the strongest B1 case is YAGNI-timing (one known consumer, zero published versions → a conformance corpus is maintenance before a second generator exists). It lands on **when**, not **whether** — so B2 is the ratified end-state and the *vector build is sequenced* with the panel (#753), not required before it. The contracts-only principle makes conformance (not codegen) the only way a contracts layer keeps authority over output it doesn't generate → B2.

**Follow-ups filed:** **#891** — author the behavioral conformance vectors + runner WE owns; **#892** — re-home/demote `genWrapper` to FUI-side tooling + correct the #821 "WE-owned generator" framing and #753's "obtain the source WE's generator emits" framing.

## Reframing (2026-06-17, user push) — the A1/A2 axis shares a false premise

> ⚠️ **The first-pass proposed ruling (A2 — "WE publishes `@webeverything/gen-wrapper`") is WITHDRAWN.** User challenge: *WE should only be contracts and protocols* — a framework-specific codegen is not a contract, so WE publishing the generator-as-standard overreaches.

**The challenge holds, and the cited precedent backs it.** Tracing #463's forward-adapter family rather than inheriting the summary:

- **#505** elevates the *neutral contract / IR* to the source of truth, WE-owned.
- **#507** builds the deterministic *generation adapter* that derives native targets **"(own repo)"** — the executable adapter lives in its own repo, **not** under `@webeverything`. WE owns the contract (#505) + the #506 conformance suite; the adapter is a *tool that targets the contract*, outside the standard scope.

So the original Fork-1 axis ("does WE publish the derived wrapper code (A1) or the generator (A2)?") has a **false shared premise** — that WE ships *either*. Both leak something framework-specific into the contracts/protocols layer (`@webeverything`).

### Principle-clean decomposition (what actually crosses the seam)

1. **WE publishes only the CEM contract** (`we:custom-elements.json`, the `custom-elements-manifest` protocol, #626) — a manifest/protocol, exactly WE's job. *This is the only thing that crosses the WE→FUI boundary.* Code never crosses; the contract does.
2. **WE may also publish wrapper conformance vectors** (golden "correct output" any generator must match) — the #506-style conformance artifact, contract-adjacent, legitimately WE's.
3. **The generator (`genWrapper`) is a build-time codegen *tool*, not a standard.** Framework-specific (React/Vue) glue that renders the native element = impl/tooling. Home is **FUI** (the consumer that renders) — or its own repo per #507 — consumed as a **zero-lock-in build devtool**, never the lock. `genWrapper` in `scripts/` today is demoted to a *reference generator / conformance fixture*, subordinate to the CEM contract (the #461 `fetchHandler` "reference impl, not the definition" pattern).

**Net:** FUI runs a generator (its own, or WE's reference one vendored as a swappable devDependency) over WE's published CEM to produce its wrappers. The standard/lock is the **CEM contract (+ conformance vectors)**; the generator stays swappable. `@webeverything` holds only contracts/protocols/conformance — no framework-specific codegen as a shipped standard.

### Reframed Fork 1 — what WE owns at the seam (NOT "what WE publishes of the generator")

- **B1 — WE publishes the CEM contract only.** FUI owns generation wholesale (writes/vendors its own generator). Leanest; conformance is implicit (FUI's output is checked by nothing WE-owned). *Con:* no WE-side guarantee that a FUI wrapper faithfully reflects the CEM.
- **B2 — WE publishes the CEM contract + wrapper conformance vectors** *(leaning recommendation)*. FUI owns the generator but its output is gated against WE's golden vectors. Mirrors the ratified #505+#506 split (contract + conformance, adapter in own repo). *Con:* WE authors/maintains a small conformance corpus.

In both, `genWrapper` is FUI/tool-side, and the boundary carries a **contract**, not code. *Pending the user's call; confidence on "generator is not a `@webeverything` standard" is now high (precedent-backed); B1-vs-B2 is the open sub-call.*

**Withdrawn first-pass red-team (A1-vs-A2 framing — retained for trail, premise now rejected).** The skeptic pass found no refutation *within the A1/A2 framing* (version-skew favors A2, codegen-in-consumer is idiomatic, etc.). It did not catch the framing error — both A1 and A2 assume WE ships the generator/output, which the contracts-only principle rejects. Superseded by the reframing above.

## Fork 1 — what crosses the WE→FUI boundary: published derived artifact vs published generation contract

*Why it is a fork (case b):* both branches are coherent build-time handoffs but they are genuinely mutually exclusive *as the mechanism* — either WE publishes the derived wrapper output and FUI consumes dumb strings (A1), or WE publishes the generator + CEM and FUI runs the derive step at its own build (A2). You ship one source-of-truth contract, not both; they cannot coexist as "the" handoff.

**Crux.** The generated wrappers are a pure function of two already-WE-owned, already-publishable things — the ratified CEM (#626, derived by [`we:gen-cem.mjs`](../scripts/gen-cem.mjs)) and the generator ([`we:genWrapper.mjs`](../scripts/gen-wrapper/genWrapper.mjs)). So the choice is *which* of those WE versions and ships across the seam: the derived output, or the inputs that derive it.

- **A1 — WE publishes the derived wrapper artifact.** WE runs `gen:wrapper` in its build/CI and publishes the wrapper source set ([`we:cli.mjs`](../scripts/gen-wrapper/cli.mjs) → `generated/wrappers/…`) as a versioned `@webeverything/*` package; the FUI panel imports dumb strings. *Pro:* faithful to the Stencil/Lit "publish a wrapper package" precedent; generation executes only in WE; FUI runs no WE codegen. *Con:* a **third** published thing that is only `f(CEM, generator)` — re-published on every CEM change, with a stale-published-artifact window.
- **A2 — WE publishes the generator + CEM contract; FUI derives at its build.** *(recommended)* WE packages `generateWrapper` as `@webeverything/gen-wrapper` (it is already a pure, no-DOM/no-FUI export — [`we:genWrapper.mjs:1-19`](../scripts/gen-wrapper/genWrapper.mjs)) alongside the ratified CEM; the FUI demo build calls it over the CEM to materialize wrappers into its own build. *Pro:* a **single source of truth** (generator + CEM, no third derived artifact), fresh by construction (no stale window), and it matches the existing #821 authoring intent — [`we:cli.mjs:8`](../scripts/gen-wrapper/cli.mjs) already records that "the FUI panel (#753) does NOT need [the CLI] (it imports `generateWrapper` directly)." *Con:* WE codegen runs inside FUI's build (FUI imports + executes a WE tool); less faithful to the Stencil/Lit *generate-at-source* locus.

**Recommended default: A2** (med-high). The generator was authored as a pure importable function the codebase explicitly intends FUI to call; publishing the *contract* (generator + CEM) over a *derived* artifact keeps one source of truth and stays fresh. This is the impl-consumes-standard direction (the npm-scope-mirrors-layer rule, #239: FUI consumes `@webeverything` standard artifacts) — boundary-clean. **The residual is** prior-art fidelity — Stencil/Lit generate at the source library and publish the wrapper (A1) — so if WE later wants a sole generation-execution site or a cacheable pre-built/CDN artifact, A1 is **added then**, demand-gated; it is not excluded, just not the consume-mode-probe default.

*Red-team seed (for the decision turn):* the strongest case for A1 is that every shipping incumbent (Stencil, Lit) generates at the source library and publishes the wrapper — A2 inverts that locus by running WE codegen inside FUI's build. The default survives because (a) those incumbents publish for *arbitrary downstream apps* that can't run the source lib's build, whereas FUI is a *single known consumer* that already imports `@webeverything` contracts; and (b) the wrappers here are a pure `f(CEM, generator)` with no value in a separately-versioned third artifact. If the decider weights ecosystem-precedent or a CDN-cacheable artifact over single-source-of-truth, A1 is the correct override.

---

## Context

### Dissolved by the survey (not forks)

- **Option C (on-demand sandbox generation) — rejected.** No shipping tool generates wrappers on-demand in the consumer ([report §Topic 1](../reports/2026-06-17-we-fui-wrapper-handoff.md)), *and* consume-mode output is deterministic in the CEM ([`we:genWrapper.mjs:69-189`](../scripts/gen-wrapper/genWrapper.mjs)) — so on-demand regeneration produces output that never varies: pure cost, no benefit. (Author-mode #818, with a per-emit IR, is the separate deferred case; revisit only if it introduces per-user-variable generation.)
- **Option B (a bundle the `fuiDemo` iframe loads) — not a distinct mechanism.** "Where the bundle physically sits" is an impl detail of whichever build-time handoff is chosen, not a separate end-state.

### Invariants (ratify, not decide)

1. **The live-test render + panel are FUI-owned, embedded via the #701 `fuiDemo` iframe.** Restated from #746/#753 + the docs-rendering boundary — WE never renders FUI block code; this decision does not reopen it.
2. **The handoff is build-time, not on-demand runtime** (the C rejection above).

### Live-test sandbox tech — FUI guidance, not a WE fork

The sandbox that runs the generated React/Vue is a **FUI impl choice** WE does not mandate (mandate-nothing). Survey guidance for the FUI build ([report §Topic 2](../reports/2026-06-17-we-fui-wrapper-handoff.md)): **esm.sh + import maps** is the lightest credible multi-framework path (React TSX *and* Vue SFC, no COOP/COEP isolation tax inside an embedded iframe); **Sandpack** is the turnkey source-string-in middle ground; **esbuild-wasm** only fits a React-only commitment (no Vue SFC); WebContainers is overkill and pays a cross-origin-isolation embedding tax.

### Sequencing (not a fork)

`fui:blocks.json` carries no `tagName` today, so the CEM emits 0 custom-element declarations and `gen:wrapper` emits nothing ([`we:cli.mjs:35-41`](../scripts/gen-wrapper/cli.mjs)) — block-data enrichment is **#822**. So the panel build (#753) is gated on **both** this handoff decision (#855) *and* #822; #855 settles the mechanism only and can ratify before #822 lands. Once ratified, the consume-mode panel (#753 criteria #1/#2) is buildable against the chosen handoff.
