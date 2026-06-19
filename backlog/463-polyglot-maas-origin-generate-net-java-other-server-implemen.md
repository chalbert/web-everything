---
type: decision
workItem: story
size: 8
status: resolved
blockedBy: ["461"]
dateOpened: "2026-06-13"
dateStarted: "2026-06-13"
dateResolved: "2026-06-13"
graduatedTo: none
codifiedIn: "docs/agent/platform-decisions.md#forward-generation-adapters"
preparedDate: "2026-06-13"
tags: [module-as-a-service, distribution, polyglot, dotnet, java, generation-adapter, codegen, enterprise, adapters, conformance, source-of-truth]
parent: "081"
relatedProject: webadapters
relatedReport: reports/2026-06-13-polyglot-maas-origin.md
---

# Polyglot MaaS origin — generate .NET / Java / other server implementations from one source of truth via generation adapters

**Grounding.** Enterprises run .NET and Java; a self-hosted MaaS origin that is only a JS Fetch handler
(#461) forces a JS sidecar into those shops. #463 decides whether/how WE projects a **native** origin
outward via a **forward/codegen adapter** — the inverse of WE's *ingest* adapters. The owed prior-art pass is published at
[/research/polyglot-maas-origin](/research/polyglot-maas-origin/) (report:
[we:2026-06-13-polyglot-maas-origin.md](reports/2026-06-13-polyglot-maas-origin.md)), and **it reshaped
fork (a) from three options to four** (adding compile-once-to-Wasm) and turned (b) and (c) into
near-ratifications. **Three forks below, each with a bold recommended default.** This is a project-goal-
level call (browser/JS-first → polyglot enterprise); confidence flags mark where judgment is genuinely
needed.

**Sequencing:** was blocked by **#461** — now **resolved** (the framework-agnostic Fetch origin
`createMaaSFetchHandler` shipped at [we:fetchHandler.ts](blocks/renderers/module-service/fetchHandler.ts),
graduated to `webadapters`), so the reference implementation any generated origin is conformance-tested
against now exists.

## Decision (ratified 2026-06-13)

All three forks talked through and settled. The strategic widening (browser/JS-first → polyglot
enterprise) is **affirmed** — enacted by building a native origin rather than declining to (sidecar-only
rejected). Spin-off builds: **#505** (fork b), **#506** (fork c), **#507** (fork a).

- **Fork (b) — source of truth → ratified as written, with a sharpening.** A language-neutral contract
  (`we:protocols.json#maas-versioning` + a serve-path IR, projectable to OpenAPI) is the authority; #461 is
  the reference implementation, not the definition. **Sharpening:** "authority" means that when the
  contract and #461 disagree, the **contract wins and #461 is fixed** — that is what keeps JS just-
  another-target rather than the privileged source. → **#505**.
- **Fork (c) — conformance → ratified as written.** A shared cross-language conformance suite (golden
  vectors from #088 hash fixtures + the #461 reference impl + a runner) gates every target's release.
  Fixed mechanic; orthogonal to the mechanism (needed under any generator). This is the load-bearing
  call — it makes fidelity **mechanism-independent**. → **#506**.
- **Fork (a) — mechanism → refined (not the item's original codegen-vs-handwrite framing).** A
  **deterministic generation-adapter** is *the* mechanism: same neutral source → byte-identical generated
  code, **no AI in the generation path**. It derives an idiomatic, best-practices-native origin per
  language into its **own repo**, behind a **deterministic-core / HTTP-shell split**. **AI sits one level
  up, at adapter-development time only** — it reviews the adapter's output and improves the *deterministic
  adapter* (rules/templates, against a regression corpus) until the generated code is perfect-idiomatic
  for the target; **every adapter change is human-reviewed** (full-AI cycle with railguards is an explicit
  *future*, out of scope for any current plan/story). This loop is what dissolves codegen's idiomaticity
  weakness — so deterministic codegen now wins on all three axes (deterministic + idiomatic + single-SoT)
  and the tiny, near-frozen serve-path surface makes it tractable. Fidelity is gated by the #506 suite,
  **not** by AI (byte-identity is mechanically checkable; AI judges idiomaticity, the suite judges
  identity). **Wasm-component → demoted to exotic/optional packaging, not the convergence target** — the
  adapter delivers palatable pure-native without an embedded Wasm engine's compliance/AOT/debuggability
  friction, and AI-derivation removes the maintenance-burden that was Wasm's only remaining justification.
  Runtime stays **AI-free pure-native**; the AI cost is amortized at adapter-dev time. → **#507**.

  *Rejected:* sidecar-only (declines the widening); hand-reimplementation as the primary path (forfeits
  single-SoT leverage). *Deferred:* Wasm-first (preview-grade host SDKs; and the adapter makes its
  maintenance pitch moot); full-AI generation/validation cycle (revisit with railguards).

## Why it matters (project-goal level)

WE's reach today is browser + JS-runtime origins (Node/Deno/Workers, post-#461). If the self-hosted
origin can *only* be JS, every .NET/Java shop must run a JS sidecar beside their real stack — friction
that caps adoption exactly where the standard is most valuable. Projecting a native origin into the host
ecosystem turns "run our JS server too" into "here is a .NET/Java library that speaks the same protocol"
— a materially different adoption story, and a candidate **widening of the project goal**.

## Axis framing

The served contract is small and sharp — serve a versioned, content-addressed artifact with
**byte-identical** output, **stable content-hash identity** (#088/#389), **SRI** integrity, and
**immutable-artifact + short-TTL-pointer** cache semantics (#461 scope). Three orthogonal axes:

- **Axis (a) — mechanism.** How does a non-JS origin come to exist? Codegen from a single SoT
  (generation adapter), hand-maintained per-language re-implementations, JS-sidecar-only (decline
  polyglot), or **compile-once-to-Wasm + host bindings** (the survey's fourth option). The crux is
  **fidelity** (every language behaves identically) vs **maintenance burden**. The serve core lives at
  [we:moduleService.ts](blocks/renderers/module-service/moduleService.ts) (`serve()`/`serveCompiled()`);
  #461 wraps it as a framework-free `(Request)=>Response`.
- **Axis (b) — source of truth.** Generate *from what*? The #461 JS source, a language-neutral IR/spec
  of the serve path, or the **protocol contract** (`we:protocols.json#maas-versioning`) treated as the
  authority. Picking the protocol/IR keeps JS as just another target, not the privileged one.
- **Axis (c) — conformance.** How does a generated .NET/Java origin *prove* it serves byte-identical,
  identity-stable artifacts (same #088 hash, same SRI, same cache semantics) as the JS origin?

The strategic widening is *enacted* by choosing any build option in (a) over sidecar-only; declining
polyglot = sidecar-only.

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **(a) mechanism** | **Generation-adapter codegen from a neutral SoT, with a deterministic-core / HTTP-shell split, gated by a conformance suite; Wasm-component named as the convergence target for the core** | Hand-reimplementation · JS-sidecar-only · Wasm-first now | Medium — project-goal call; Wasm timing + codegen toolchain gaps are real judgment |
| **(b) source of truth** | **A language-neutral contract is the authority (`maas-versioning` protocol + serve-path IR, projectable to OpenAPI); JS is just another target; #461 is the reference impl, not the SoT** | Generate from the JS source | High — every precedent authors a neutral contract |
| **(c) conformance** | **A shared cross-language conformance suite — golden vectors (#088 hash fixtures) + reference impl (#461 JS origin) + a runner — gating every target's release** | Per-language ad-hoc tests · trust the codegen | High — the spec alone never guarantees interop; only the suite does |

## Fork (a) — mechanism: codegen vs re-implementation vs sidecar vs Wasm

**Crux.** Fidelity vs maintenance. The contract demands *byte-identical* output across languages; the
question is which mechanism makes that achievable without N drifting codebases.

- **Generation-adapter codegen from a neutral SoT (default).** A forward/codegen adapter emits the
  .NET/Java/Go origin (routing + (de)serialization + cache-header logic + types) from the neutral SoT,
  leaving a thin business-logic seam — [AWS Smithy](https://smithy.io/)'s proven server-codegen shape.
  Factor the contract into a small **deterministic core** (content-hashing, canonical artifact bytes,
  SRI) and an idiomatic **HTTP/cache shell** per host. Preserves the single-SoT leverage that is the
  entire value proposition; the conformance suite (fork c) backstops fidelity. **Name Wasm-component
  (compile-once-host-many) as the convergence target for the deterministic core** once .NET/Java host
  SDKs leave preview.
- **Hand-maintained per-language re-implementations.** Simplest to start, but **forfeits single-SoT
  leverage** and drifts (the conformance suite catches drift but you still maintain N codebases).
- **JS-sidecar-only (decline polyglot).** Zero new work, but **caps enterprise reach** — the exact
  friction #463 exists to remove.
- **Wasm-component first, now.** Compile the serve-logic once to a Wasm component (WIT interface);
  hosts embed it (.NET `componentize-dotnet`/Wasmtime, JVM `chicory`, Go `wazero`). Structurally
  **dissolves** cross-language drift, but 2026 host SDKs are **preview-grade** (componentize-dotnet
  0.7.x; JVM component-model still landing; Go awaiting WASI 0.3 async) and ships a Wasm engine inside
  the enterprise host (an idiomatic-native objection).

**Default: generation-adapter codegen (with the deterministic-core/HTTP-shell split + conformance gate),
Wasm as the named convergence target.** Codegen is buildable today and keeps the single SoT; Wasm is the
better long-term fidelity story but its host toolchains aren't production-ready in 2026.

*Rejected — sidecar-only:* it declines the adoption widening that is the item's whole purpose.
*Rejected — hand-reimplementation as the primary path:* forfeits single-SoT leverage and invites drift.
*Deferred — Wasm-first:* preview-grade host SDKs; revisit when componentize-dotnet / JVM component-model
reach GA (it then likely supersedes codegen for the deterministic core).

## Fork (b) — source of truth: neutral contract vs the JS source

**Crux.** Generating from the JS source privileges JS and makes it non-portable; the SoT should be the
contract, with every language (including JS) an output.

- **A language-neutral contract is the authority (default).** Elevate `we:protocols.json#maas-versioning`
  (+ a small IR/spec of the serve path) to the authority; project it to **OpenAPI** for the HTTP-GET
  shape (verbs, response headers — Cache-Control, ETag/SRI). #461's JS Fetch handler is the **reference
  implementation**, not the definition.
- **Generate from the #461 JS source.** Tempting (the source already exists) but makes JS the privileged
  origin and couples the SoT to one runtime — the anti-pattern every precedent (Smithy/OpenAPI/protobuf)
  avoids.

**Default: the neutral contract.** WE already has the seed (the `maas-versioning` protocol); treating it
as authority keeps JS as just another target and matches every successful multi-language precedent.

*Rejected — generate from JS source:* privileges and couples to one runtime; non-portable.

## Fork (c) — conformance: shared suite vs ad-hoc

**Crux.** A shared spec does **not** guarantee interop — the protobuf scoreboard shows the same spec
yielding 0 vs 1,847 failures across libraries, and the Connect/gRPC suite found 22+ bugs in Google's own
gRPC v1.0. Only a conformance suite enforces byte-identical behavior.

- **A shared cross-language conformance suite (default).** Golden vectors = #088 content-hash fixtures
  (input definition → expected artifact bytes + hash + SRI + cache headers); reference implementation =
  the #461 JS origin; a runner drives every target against the vectors and **gates its release**. The
  protobuf/gRPC model.
- **Per-language ad-hoc tests / trust the codegen.** Cheaper up front, but exactly what the protobuf and
  gRPC evidence shows fails — divergence ships silently.

**Default: the shared conformance suite.** It is the single most load-bearing decision and is
**orthogonal** to the mechanism choice (needed under codegen *and* Wasm). The #088 identity work makes
the golden vectors free.

*Rejected — ad-hoc/trust-codegen:* the byte-identical/identity-stable requirement cannot tolerate
per-target divergence; the spec alone never delivers it.

## Per-fork classification (the 7-question pass)

1. **Layer:** generation adapter + neutral SoT + conformance suite = WE standard/tooling (`webadapters`,
   a forward adapter); generated origins = ecosystem impl artifacts; the served *enterprise product* →
   plateau-app (#091). Decomposes, no single home.
2. **Protocol or new entity?** Not a new protocol — it **projects the existing `maas-versioning`
   protocol outward**; the forward adapter is an adapter-registry entry (codegen direction), the inverse
   of ingest.
3. **Expose the whole axis?** Target languages are an **open, extensible target registry**, not a fixed
   list — most-flexible.
4. **Fixed mechanic vs dimension?** **Conformance-gating is a fixed mechanic** (no target ships without
   passing); the target set is an extensible dimension.
5. **DI-injectable?** Generation targets are plug-in adapters (registry); injectable.
6. **Most-permissive default?** Neutral SoT (privileges no language); open target set.
7. **Seam:** forward (codegen) vs ingest (normalization) are **two directions of one adapter concept,
   kept distinct**.

## Concrete refs

- Blocker / reference impl: [we:461-maas-distribution-origin-framework-agnostic-web-standard-fet.md](/backlog/461-maas-distribution-origin-framework-agnostic-web-standard-fet/)
  (the JS Fetch origin + #088/#389 identity; explicitly names this as the "single source of truth a
  generation-adapter would project").
- Serve core: [we:moduleService.ts](blocks/renderers/module-service/moduleService.ts)
  (`serve()`/`serveCompiled()`), cache key
  [we:definitionRegistry.ts](blocks/renderers/module-service/definitionRegistry.ts).
- SoT authority seed: `we:protocols.json#maas-versioning` (MaaS Served-Artifact Versioning).
- Adapter philosophy (inverse direction): the adapter-as-normalization-hub pattern (ingest incumbents into a lossy internal pivot); parent MaaS
  [#081](/backlog/081-module-as-a-service-provider/).
- Prior-art survey: [report](reports/2026-06-13-polyglot-maas-origin.md) ·
  [/research/ topic](/research/polyglot-maas-origin/).

The per-language origin builds spin off now that the mechanism + SoT + conformance gate are ratified;
this item was the decision, not the build. Spin-offs: **#505** (neutral contract + IR, fork b) →
**#506** (conformance suite, fork c, blocked by #505) → **#507** (deterministic generation-adapter +
first native target, fork a, blocked by #505/#506).

**Graduated to** `none` — ratified — spawned polyglot MaaS build program #505 (contract+IR) / #506 (conformance suite) / #507 (generation-adapter).
