# Polyglot MaaS origin — mechanism, source-of-truth & conformance (prep research for #463)

**Date:** 2026-06-13
**Backlog:** [#463](../backlog/463-polyglot-maas-origin-generate-net-java-other-server-implemen.md)
(decision, size 8) · blockedBy [#461](../backlog/461-maas-distribution-origin-framework-agnostic-web-standard-fet.md)
(the canonical JS Fetch-standard origin = reference implementation) · parent
[#081](../backlog/081-module-as-a-service-provider.md) (MaaS)
**Authority seed:** `we:protocols.json#maas-versioning` (MaaS Served-Artifact Versioning) · serve core
`we:blocks/renderers/module-service/moduleService.ts`

## The question

Today a self-hosted MaaS origin is only a JavaScript Fetch handler (#461). Enterprises overwhelmingly
run **.NET and Java** on the server; a JS-only origin forces a JS sidecar into those shops, capping
adoption where the standard is most valuable. #463 asks whether/how WE reaches the enterprise server
tier by **projecting a native origin outward** — a **forward/codegen adapter** (the inverse of WE's
*ingest* adapters [[adapter_normalization_hub]]): take the internal source of truth and emit
ecosystem-native server code. Three forks: **(a) mechanism · (b) source of truth · (c) conformance.**
The served contract is small and sharp — serve a versioned, content-addressed artifact with
byte-identical output, stable content-hash identity (#088/#389), SRI integrity, and immutable-artifact +
short-TTL-pointer cache semantics (#461 scope).

The owed prior-art pass surveyed how the industry generates conformant multi-language servers from one
source of truth. **It reshaped fork (a) from three options to four** (adding compile-once-to-Wasm) and
turned (b) and (c) into near-ratifications.

## Prior-art survey

### Mechanism — codegen is proven but fidelity-uneven; Wasm is the fourth option

| Approach | Evidence | Fidelity | 2026 maturity for .NET/Java/Go |
|---|---|---|---|
| **Codegen from one IDL** (AWS [Smithy](https://smithy.io/2.0/languages/typescript/ts-ssdk/introduction.html) server generator) | Generates routing + (de)serialization + validation + types; leaves a clean **business-logic seam**; protocol-agnostic | ~80% generated; **not byte-identical without an external check** | **Lumpy** — TS dev-preview, Java GA but client-leaning (2026-04), Rust WIP, **no off-the-shelf .NET/Go server emitter** |
| **Codegen from HTTP spec** ([OpenAPI Generator](https://github.com/OpenAPITools/openapi-generator)) | Server stubs in dozens of languages; HTTP/REST-native (good GET shape-fit) | **Per-generator** — some emit non-compiling code; drift on regen | Broad but inconsistent |
| **Hand-reimplementation per language** | — | Drifts without a gate | Simplest to start; forfeits single-SoT leverage |
| **JS-sidecar-only** (decline polyglot) | — | n/a | Zero new work; **caps enterprise reach** (the thing #463 exists to overcome) |
| **Compile-once-to-Wasm + host bindings** ([Component Model / WIT](https://component-model.bytecodealliance.org/)) | One binary embedded by each host (.NET via `componentize-dotnet`/Wasmtime, JVM via `chicory`, Go via `wazero`) | **Dissolves drift at the root** — one binary = one behavior | **Serious but preview** — Wasm 3.0 ratified (Sept 2025), WASI P2 stable, server-side now majority prod use; host SDKs preview-grade (componentize-dotnet 0.7.x, JVM component-model still landing, Go awaiting WASI 0.3 async) |

### Source of truth — the neutral contract, never the JS source

Every successful precedent (Smithy IDL, OpenAPI doc, `.proto`) authors a **language-neutral contract**
and treats *each* language — including the original — as an output. Generating from the JS source would
privilege JS and make it non-portable. For an HTTP-GET-returning-a-content-addressed-artifact contract,
**OpenAPI is the most shape-matched describable form** (HTTP verbs, response headers — Cache-Control,
ETag/SRI — media types), while a **protocol-agnostic IDL (Smithy-style) is the better *authority*** that
can *project* to OpenAPI. WE already has the seed: `we:protocols.json#maas-versioning` is the serve
contract elevated to a protocol — the natural SoT, with #461's JS origin as its **reference
implementation**, not its definition.

### Conformance — the shared suite is the real fidelity guarantor (and it's orthogonal)

The decisive finding: **a shared spec alone does NOT guarantee interoperability — only a conformance
suite does.** Protobuf ships 2,000+ tests via a stdin/stdout runner; its scoreboard shows the *same
spec* yielding 0 failures (protobuf-es) to 1,847 (we:protobuf.js)
([bufbuild/protobuf-conformance](https://github.com/bufbuild/protobuf-conformance)). The Connect/gRPC
conformance suite found **22+ bugs in Google's own v1.0 gRPC implementations**
([Buf deep dive](https://buf.build/blog/grpc-conformance-deep-dive)). The model: **golden vectors +
reference implementation + runner, gating every language's release.** This is "the single most
load-bearing decision here," and it is **orthogonal to** the codegen-vs-Wasm choice — needed either way.

### Vocabulary worth borrowing

IDL / interface definition language · **server codegen / business-logic seam** · **protocol-agnostic** ·
**conformance suite / golden vectors / reference implementation** · **interface types (WIT) / host
bindings / compile-once-host-many / component** · **forward (codegen) adapter vs ingest adapter** (WE's
own inverse-direction framing maps cleanly onto Smithy's "model → generated targets").

## Recommendation (grounds #463)

1. **(a) Mechanism: a forward/generation adapter that codegens from a neutral SoT, with a
   deterministic-core / HTTP-shell split, gated by a conformance suite — NOT hand-reimplementation, NOT
   sidecar-only.** Codegen preserves the single-SoT leverage that is the entire value proposition; the
   conformance suite (fork c) backstops fidelity. Factor the contract into a small **deterministic core**
   (content-hashing, canonical artifact bytes, SRI) and a thin **idiomatic HTTP/cache shell** per host.
   **Name Wasm-component (compile-once-host-many) as the convergence target for the deterministic core**
   once .NET/Java host SDKs leave preview — it is the one mechanism that dissolves fidelity drift, but
   its 2026 host toolchains are preview-grade, so it is the *future*, not the *first* build.
2. **(b) Source of truth: a language-neutral contract is the authority — JS is just another target.**
   Elevate `we:protocols.json#maas-versioning` (+ a small IR/spec of the serve path) to the authority;
   #461's JS Fetch handler is the **reference implementation**, not the SoT. Project to OpenAPI for the
   HTTP-GET shape.
3. **(c) Conformance: a shared cross-language conformance suite (golden vectors = #088 content-hash
   fixtures + reference impl = the #461 JS origin + a runner), gating every target's release.** Adopt
   the protobuf/gRPC model. This is the gate that makes "byte-identical, identity-stable" true regardless
   of mechanism.

The strategic widening (browser/JS-first → polyglot enterprise) is *enacted* by choosing any of (a)'s
build options over sidecar-only; declining = sidecar-only.

## Per-fork classification (the 7-question pass)

1. **Layer:** the generation adapter + neutral SoT + conformance suite = WE standard/tooling
   (`webadapters` — a forward adapter). Generated .NET/Java/Go origins = ecosystem impl artifacts; the
   served *enterprise product* → plateau-app/product per #091. (Constellation decompose, no single home.)
2. **Protocol or new entity?** Not a new protocol — it **projects the existing `maas-versioning`
   protocol outward**. The forward adapter is an adapter-registry entry (codegen direction), the inverse
   of ingest ([[adapter_normalization_hub]]).
3. **Expose the whole axis?** The target languages are an **open, extensible set** of generation targets
   (a target registry), not a fixed list — most-flexible.
4. **Fixed mechanic vs dimension?** **Conformance-gating is a fixed mechanic** (no target ships without
   passing); the target set is an extensible dimension.
5. **DI-injectable?** Generation targets are plug-in adapters (registry); injectable.
6. **Most-permissive default?** Neutral SoT (privileges no language); open target set.
7. **Seam:** forward (codegen) adapter vs ingest (normalization) adapter are **two directions of one
   adapter concept, kept distinct** (bias toward separation upheld).

## Confidence

- **Fork (a) mechanism: medium** — codegen-as-primary is well-grounded (single-SoT leverage + the
   conformance backstop), but the *timing* of the Wasm convergence and the codegen toolchain gaps (no
   off-the-shelf Smithy .NET/Go server emitter) are real judgment; this is a project-goal-level call.
- **Fork (b) SoT: high** — every precedent authors a neutral contract; WE already has the protocol seed.
- **Fork (c) conformance: high** — the industry is unambiguous that the shared suite, not the spec, is
   what guarantees cross-language fidelity; it's needed under every mechanism.
