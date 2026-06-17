---
type: decision
workItem: story
size: 3
parent: "746"
status: active
blockedBy: ["821"]
dateOpened: "2026-06-17"
dateStarted: "2026-06-17"
preparedDate: "2026-06-17"
tags: [webdocs, block-explorer, adapters, polyglot, boundary, decision]
relatedProject: webdocs
relatedReport: reports/2026-06-17-we-fui-wrapper-handoff.md
crossRef: { url: /backlog/753-polyglot-adapter-panel/, label: "Polyglot adapter panel (#753)" }
---

# Decide the WE→FUI wrapper-handoff mechanism for the polyglot adapter panel

How does the **FUI** polyglot panel ([#753](/backlog/753-polyglot-adapter-panel/), `locus: frontierui`) obtain and live-test the React/Vue wrapper source that the **WE**-owned generator (#821, [`genWrapper.mjs`](../scripts/gen-wrapper/genWrapper.mjs)) emits — across the repo boundary where WE never renders FUI block code? The item filed three options cold (A build-time artifact · B fuiDemo-iframe bundle · C on-demand sandbox); the prior-art survey ([research topic](/research/we-fui-wrapper-handoff/), [report](../reports/2026-06-17-we-fui-wrapper-handoff.md)) collapses them to **one forced invariant + one genuine fork**. The surviving call: *what crosses the boundary* — WE publishes the derived wrapper artifact, or WE publishes the generator + CEM contract and FUI derives at its build.

## The axis

The seam is a *cross-repo artifact handoff*, not a rendering question. WE owns the generation: [`genWrapper.mjs:202`](../scripts/gen-wrapper/genWrapper.mjs) exports a pure `generateWrapper(declaration, target)` whose output ["crosses the layer seam to the FUI Block Explorer panel"](../scripts/gen-wrapper/genWrapper.mjs) ([`genWrapper.mjs:6`](../scripts/gen-wrapper/genWrapper.mjs)), with a CLI ([`cli.mjs`](../scripts/gen-wrapper/cli.mjs)) that materializes `generated/wrappers/<target>/<Name>.<ext>` from the ratified CEM (`custom-elements.json`, #626). FUI owns the render: the panel is `locus: frontierui` and embeds in the WE block page only through the #701 `fuiDemo` iframe ([`.eleventy.js:100`](../.eleventy.js#L100)). The prior art (Stencil output targets, Lit Labs `gen-wrapper-*`, `@lit/react`) is **unanimous and one-directional**: framework wrappers are a *build-time artifact of the source library*, published for the consumer to read — **no shipping tool generates wrappers on-demand in the consumer** ([report §Topic 1](../reports/2026-06-17-we-fui-wrapper-handoff.md)). That, plus the fact that consume-mode output is a *pure function of the CEM* (deterministic, no per-user input — [`genWrapper.mjs:69-189`](../scripts/gen-wrapper/genWrapper.mjs)), forces the invariants below and leaves exactly one real choice.

### Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **1 — what crosses the WE→FUI boundary** | **A2 — WE publishes the generator + CEM contract; the FUI demo build derives the wrappers itself** | A1 — WE publishes the pre-generated wrapper source as a versioned `@webeverything/*` artifact FUI imports | **Med-high → High** (post red-team) |

## Proposed ruling (2026-06-17) — A2, pending ratification

**WE publishes `@webeverything/gen-wrapper` (the pure `generateWrapper` export) + the ratified CEM; FUI's demo build imports and runs it over the CEM to materialize wrappers into its own build.** No third derived-artifact package. Confidence **high** (raised from med-high — the red-team strengthened rather than dented the default). **The residual is** prior-art fidelity (Stencil/Lit generate-at-source-and-publish); A1's sole legitimate future override remains a CDN-cacheable pre-built artifact, **demand-gated, added then** — not excluded, just not the consume-mode default.

**Red-team outcome (skeptic prompted only to refute A2 — no refutation landed):**

- **Version-skew *favors* A2, not A1.** A1 publishes a *third* versioned thing (`@webeverything/wrappers`) that must stay pinned to both the CEM version and the generator version it derived from — the exact 3-way drift surface #876 exists to police. A2 collapses that to a single `@webeverything/gen-wrapper` + CEM pin derived locally, so there is no published derivative that can silently lag its inputs.
- **Codegen-in-the-consumer's-build is idiomatic, not an anti-pattern** (Prisma `generate`, GraphQL codegen, protobuf/`buf`, OpenAPI generators). The Stencil/Lit *generate-at-source-and-publish* precedent only binds publishing to **arbitrary** downstreams; a single known consumer (FUI, already importing `@webeverything` contracts) is not constrained by it — confirming the item's own rebuttal.
- **The #506 gate already materializes `generated/wrappers/` in WE CI** ([`cli.mjs:9`](../scripts/gen-wrapper/cli.mjs)) — so A1's published artifact is "nearly free." But that artifact is an **internal gate fixture**, not a reason for FUI to consume a CI fixture *as the contract*; it argues A1 is cheap-to-add-later, which is exactly where A2 already files it. (Today `generated/wrappers/` is not even produced — 0 declarations until #822 lands `tagName`.)
- **Supply-chain / reproducibility is non-differential.** FUI already executes `@webeverything` contract code; `generateWrapper` is pure, no-DOM, no-network, no-FUI-import ([`genWrapper.mjs:1-19`](../scripts/gen-wrapper/genWrapper.mjs), [`:202`](../scripts/gen-wrapper/genWrapper.mjs#L202)) — deterministic in its inputs. A1 doesn't remove WE-authored code from FUI's trust boundary; it only changes which WE artifact is trusted.
- **No WE principle is breached by A2**; it is the impl-consumes-standard direction (npm-scope-mirrors-layer, #239). A1 is the side that strains single-source-of-truth by shipping a derivable third package.

**Unblocks:** the consume-mode panel build (#753) — buildable against A2 once #822 enriches `blocks.json` with `tagName` (the CEM is empty until then). Mechanism is settled; #855 resolves ahead of #822.

## Fork 1 — what crosses the WE→FUI boundary: published derived artifact vs published generation contract

*Why it is a fork (case b):* both branches are coherent build-time handoffs but they are genuinely mutually exclusive *as the mechanism* — either WE publishes the derived wrapper output and FUI consumes dumb strings (A1), or WE publishes the generator + CEM and FUI runs the derive step at its own build (A2). You ship one source-of-truth contract, not both; they cannot coexist as "the" handoff.

**Crux.** The generated wrappers are a pure function of two already-WE-owned, already-publishable things — the ratified CEM (#626, derived by [`gen-cem.mjs`](../scripts/gen-cem.mjs)) and the generator ([`genWrapper.mjs`](../scripts/gen-wrapper/genWrapper.mjs)). So the choice is *which* of those WE versions and ships across the seam: the derived output, or the inputs that derive it.

- **A1 — WE publishes the derived wrapper artifact.** WE runs `gen:wrapper` in its build/CI and publishes the wrapper source set ([`cli.mjs`](../scripts/gen-wrapper/cli.mjs) → `generated/wrappers/…`) as a versioned `@webeverything/*` package; the FUI panel imports dumb strings. *Pro:* faithful to the Stencil/Lit "publish a wrapper package" precedent; generation executes only in WE; FUI runs no WE codegen. *Con:* a **third** published thing that is only `f(CEM, generator)` — re-published on every CEM change, with a stale-published-artifact window.
- **A2 — WE publishes the generator + CEM contract; FUI derives at its build.** *(recommended)* WE packages `generateWrapper` as `@webeverything/gen-wrapper` (it is already a pure, no-DOM/no-FUI export — [`genWrapper.mjs:1-19`](../scripts/gen-wrapper/genWrapper.mjs)) alongside the ratified CEM; the FUI demo build calls it over the CEM to materialize wrappers into its own build. *Pro:* a **single source of truth** (generator + CEM, no third derived artifact), fresh by construction (no stale window), and it matches the existing #821 authoring intent — [`cli.mjs:8`](../scripts/gen-wrapper/cli.mjs) already records that "the FUI panel (#753) does NOT need [the CLI] (it imports `generateWrapper` directly)." *Con:* WE codegen runs inside FUI's build (FUI imports + executes a WE tool); less faithful to the Stencil/Lit *generate-at-source* locus.

**Recommended default: A2** (med-high). The generator was authored as a pure importable function the codebase explicitly intends FUI to call; publishing the *contract* (generator + CEM) over a *derived* artifact keeps one source of truth and stays fresh. This is the impl-consumes-standard direction (the npm-scope-mirrors-layer rule, #239: FUI consumes `@webeverything` standard artifacts) — boundary-clean. **The residual is** prior-art fidelity — Stencil/Lit generate at the source library and publish the wrapper (A1) — so if WE later wants a sole generation-execution site or a cacheable pre-built/CDN artifact, A1 is **added then**, demand-gated; it is not excluded, just not the consume-mode-probe default.

*Red-team seed (for the decision turn):* the strongest case for A1 is that every shipping incumbent (Stencil, Lit) generates at the source library and publishes the wrapper — A2 inverts that locus by running WE codegen inside FUI's build. The default survives because (a) those incumbents publish for *arbitrary downstream apps* that can't run the source lib's build, whereas FUI is a *single known consumer* that already imports `@webeverything` contracts; and (b) the wrappers here are a pure `f(CEM, generator)` with no value in a separately-versioned third artifact. If the decider weights ecosystem-precedent or a CDN-cacheable artifact over single-source-of-truth, A1 is the correct override.

---

## Context

### Dissolved by the survey (not forks)

- **Option C (on-demand sandbox generation) — rejected.** No shipping tool generates wrappers on-demand in the consumer ([report §Topic 1](../reports/2026-06-17-we-fui-wrapper-handoff.md)), *and* consume-mode output is deterministic in the CEM ([`genWrapper.mjs:69-189`](../scripts/gen-wrapper/genWrapper.mjs)) — so on-demand regeneration produces output that never varies: pure cost, no benefit. (Author-mode #818, with a per-emit IR, is the separate deferred case; revisit only if it introduces per-user-variable generation.)
- **Option B (a bundle the `fuiDemo` iframe loads) — not a distinct mechanism.** "Where the bundle physically sits" is an impl detail of whichever build-time handoff is chosen, not a separate end-state.

### Invariants (ratify, not decide)

1. **The live-test render + panel are FUI-owned, embedded via the #701 `fuiDemo` iframe.** Restated from #746/#753 + the docs-rendering boundary — WE never renders FUI block code; this decision does not reopen it.
2. **The handoff is build-time, not on-demand runtime** (the C rejection above).

### Live-test sandbox tech — FUI guidance, not a WE fork

The sandbox that runs the generated React/Vue is a **FUI impl choice** WE does not mandate (mandate-nothing). Survey guidance for the FUI build ([report §Topic 2](../reports/2026-06-17-we-fui-wrapper-handoff.md)): **esm.sh + import maps** is the lightest credible multi-framework path (React TSX *and* Vue SFC, no COOP/COEP isolation tax inside an embedded iframe); **Sandpack** is the turnkey source-string-in middle ground; **esbuild-wasm** only fits a React-only commitment (no Vue SFC); WebContainers is overkill and pays a cross-origin-isolation embedding tax.

### Sequencing (not a fork)

`blocks.json` carries no `tagName` today, so the CEM emits 0 custom-element declarations and `gen:wrapper` emits nothing ([`cli.mjs:35-41`](../scripts/gen-wrapper/cli.mjs)) — block-data enrichment is **#822**. So the panel build (#753) is gated on **both** this handoff decision (#855) *and* #822; #855 settles the mechanism only and can ratify before #822 lands. Once ratified, the consume-mode panel (#753 criteria #1/#2) is buildable against the chosen handoff.
