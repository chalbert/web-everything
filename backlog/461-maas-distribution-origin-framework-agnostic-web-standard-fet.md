---
type: issue
workItem: story
size: 8
status: resolved
dateOpened: "2026-06-13"
dateStarted: "2026-06-13"
dateResolved: "2026-06-13"
graduatedTo: blocks/renderers/module-service/fetchHandler.ts
tags: [module-as-a-service, distribution, fetch-handler, cache, etag, sri, content-hash, self-hosted, edge]
parent: "081"
relatedProject: webadapters
---

# MaaS distribution origin — framework-agnostic Web-standard Fetch handler emitting content-hash identity + immutable cache/ETag/SRI

Build the MaaS distribution origin ratified in #087: wrap the already-standalone resolver core (`moduleService.ts`) in a Web-standard `(Request)=>Response` Fetch handler so self-hosted is **not** locked to Node.js — the same handler runs on Node, Deno, and Workers/edge, and the Vite middleware becomes one caller via a thin Fetch↔Node-stream adapter. The handler emits the #088/#389 content-hash identity on the serve path and sets `Cache-Control: …immutable` + ETag/SRI on resolved artifacts; floating pins redirect (short-TTL) to the immutable URL. Fold the hash into the existing `ServedArtifactCache` key so caches agree on identity. Unblocks #103, #285.

## Scope

1. **Fetch handler.** A pure `(Request) => Response` (Fetch standard) entry point wrapping `serve()`/`serveCompiled()` from [moduleService.ts](../blocks/renderers/module-service/moduleService.ts) — no Node/Vite/11ty imports in the handler itself.
2. **Identity emission.** Compute the #088/#389 content hash (`hash(definition + transform/compiler version + form/target/strategy params + provenance)`) on the serve path and surface it as the artifact URL component, `ETag`, and SRI `integrity`.
3. **Cache headers.** Resolved (hash-pinned) artifacts → `Cache-Control: public, max-age=31536000, immutable`. Floating pins (`@latest`, ranges) → short-TTL redirect (302) to the immutable URL; never `immutable` on a floating pin.
4. **Cache-key reconciliation.** Fold the content hash into the existing `ServedArtifactCache` key in [definitionRegistry.ts](../blocks/renderers/module-service/definitionRegistry.ts) so the in-process cache and HTTP cache key on the same identity.
5. **Vite middleware becomes a caller.** Rewrite [tools/maas/vite-plugin.ts](../tools/maas/vite-plugin.ts) to delegate to the shared Fetch handler via a thin Fetch↔Node-stream adapter; keep the `X-MaaS-Lossy`/`X-MaaS-Diagnostic` diagnostics.

## Acceptance

- One Fetch handler module, framework-free, unit-tested with `Request`/`Response` fixtures (no Vite needed).
- A resolved artifact response carries `Cache-Control: …immutable`, a stable `ETag`, and an SRI hash that a native `import`/import-map entry can pin.
- A floating-pin request 302s to the immutable URL.
- The Vite dev path still serves through it (regression: existing MaaS demos unchanged).

## Notes

- **Polyglot / enterprise origin (.NET, Java, …) is out of scope here and tracked separately** — this item delivers the canonical JS/TS Fetch-standard origin, which becomes the *single source of truth* a generation-adapter would project into other runtimes. See the follow-on decision item for whether/how to generate non-JS server origins.
- Phase (c) eager hot-set pre-warming is #462 (blocked by this). Phase (d) hosted CDN-like service is #451.

## Progress

**Resolved 2026-06-13.** Built the framework-agnostic Fetch origin realizing the `maas-versioning`
Protocol (#088/#389) on the serve path.

- **New [blocks/renderers/module-service/fetchHandler.ts](../blocks/renderers/module-service/fetchHandler.ts)** —
  `createMaaSFetchHandler(options) → (Request) => Promise<Response>`, importing only Web standards
  (`Request`/`Response`/`URL`/`crypto.subtle`/`btoa`/`TextEncoder`), so the same handler runs on
  Node/Deno/Workers. Owns the HTTP + identity layer: URL+pin parsing, the #088 content-addressed
  identity (`computeArtifactIdentity` — id = hash(definitionHash + compilerVersion + params +
  provenance), folding the provenance so a compiler bump alone mints a new id), the pin ladder
  (floating tag / exact semver `302`-redirect → terminal `sha256-…` pin served `immutable`), cache
  headers (`public, max-age=31536000, immutable` on the terminal pin; short-TTL revalidate on a
  floating pin), a stable `ETag`, an `X-MaaS-Integrity` SRI hash over the served bytes, the
  `X-MaaS-Producer` provenance header, and `If-None-Match` → `304`. The DOM-dependent transform is
  **injected** (`resolve`, default `serveCompiled`), the seam that keeps the handler framework-free.
- **[definitionRegistry.ts](../blocks/renderers/module-service/definitionRegistry.ts)** — folded the
  producing `compilerVersion` into the `ServedArtifactCache` key (item 4), so the in-process cache
  invalidates on the same byte-determining inputs as the HTTP content hash — the two layers never
  disagree on identity. Backward-compatible (defaults to the v1 `esnext` baseline).
- **[tools/maas/vite-plugin.ts](../tools/maas/vite-plugin.ts)** — rewritten as **one caller** of the
  shared handler: it now contributes only the two Node-specific pieces the handler deliberately omits —
  a linkedom-DOM-wrapped `resolve`, and a thin Fetch↔Node-stream adapter (`IncomingMessage` →
  `Request`, run handler, `Response` → `ServerResponse`). The esbuild compiler registration and the
  `X-MaaS-Lossy`/`X-MaaS-Diagnostic` contract are unchanged; existing MaaS demos serve through it.
- **Tests** — new
  [blocks/__tests__/unit/renderers/fetchHandler.test.ts](../blocks/__tests__/unit/renderers/fetchHandler.test.ts)
  (12 cases): the pin ladder (floating/`@latest`/semver `302` → hash served `immutable`), ETag/SRI
  headers, `304` conditional, provenance + lossy/diagnostic over the wire, 400/404 errors, and the
  identity invariant (stable for equal inputs; a compiler-version bump mints a new id; SRI tracks the
  bytes). All `Request`/`Response` fixtures — no Vite/Node server. Gate green.

**Unblocks #103, #285** (their `blockedBy: 087` is satisfied; this delivers the serve path they
reference — note both still want a *hosted/persisted* origin (#451) for a true published CDN URL).

**Graduated to** `blocks/renderers/module-service/fetchHandler.ts` — MaaS distribution origin serve path (webadapters).
