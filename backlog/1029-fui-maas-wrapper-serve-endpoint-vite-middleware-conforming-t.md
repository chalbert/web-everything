---
kind: story
size: 8
parent: "912"
status: resolved
blockedBy: ["1085"]
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "fui:tools/maas/wrapperServeHandler.mjs"
locus: frontierui
relatedProject: webdocs
tags: [webdocs, block-explorer, maas, polyglot]
---

# FUI /_maas/ wrapper-serve endpoint — Vite middleware conforming to servePathIR

The HTTP/identity origin: a FUI Vite `configureServer` middleware + Fetch↔Node adapter + handler serving
generated React/Vue wrappers conforming to the **type-only** `we:blocks/renderers/module-service/servePathIR.ts`
+ `maas-versioning` contract — URL/pin parse, content-hash identity folding the genWrapper producer
version, 302 floating→pin ladder, `ETag`, `If-None-Match`→304, `X-MaaS-Integrity`/`-Producer`/`-Lossy`,
`CACHE_POLICY` immutable/floating, and the 400/404/500 error set. It calls the **producer slice**
([#1085](1085-fui-wrapper-bytes-producer-genwrapper-esbuild-resolve-seam.md), `blockedBy`) for the wrapper
bytes and is verified by the **conformance slice**
([#1086](1086-6-response-servepathir-conformance-test-for-the-fui-wrapper-.md)). Shape mirrors
`we:tools/maas/vite-plugin.ts`, but FUI implements its **own** handler — it must **NOT** import WE's runtime
`fetchHandler` (only the type-only contract crosses the seam, #855/#817).

**Demo:** `curl` / native `import('/_maas/<block>.js?form=react-wrapper')` serves bytes via the 302 ladder.

**Design point — settled by precedent (mirror the reference).** The 302 floating→pin ladder's current-hash
*resolution* mechanism is **not an open fork**: the WE reference handler commits to **regenerate-and-hash on
every floating hit, with no historical artifact store in v1** (`we:blocks/renderers/module-service/fetchHandler.ts:242-255`), and FUI
conforms to the *same* contract the #506 vectors assert against — so this handler **mirrors that** rather than
re-deciding. "Cache the current id" is a non-contract perf optimization, explicitly out of v1 scope. Do not
re-litigate it.

## Re-scoped via /split (2026-06-19) — was size 13, now the endpoint core slice

Originally claimed in batch-2026-06-18 and re-sized 5 → 13 (the one-line body under-estimated the full
servePathIR surface). `/split 1029` cut the size-13 into three slices on a linear incremental-delivery chain:
the **producer** (#1085, genWrapper + esbuild resolve seam — the FUI analog of WE's injected `serveCompiled`),
this **HTTP/identity origin** (re-sized 13 → 8, `blockedBy` #1085), and the **6-response conformance test**
(#1086, `blockedBy` this). #1029 is itself slice A of epic #912, so it stays a `story` (not converted to an
epic) and the new slices are siblings under #912. See the
[split analysis report](../reports/2026-06-19-backlog-split-analysis.md) → *#1029*.

## Progress

Shipped the FUI MaaS wrapper-serve origin (the HTTP/identity slice). FUI's **own** Fetch handler —
never imports WE's reference `fetchHandler` (#855/#974); the byte-determining wire constants are
byte-replicated from the type-only `we:blocks/renderers/module-service/servePathIR.ts` (#700/#872
interim, like `fui:tools/gen-wrapper/wrapperFormCatalog.mjs`):

- `fui:tools/maas/wrapperServeHandler.mjs` — `createWrapperServeHandler({ manifest | resolveDeclaration,
  produce, producer, basePath })`: URL/pin parse, the #088 content-hash identity (folds the #1085
  `PRODUCER_VERSION`), the floating→pin **302 ladder**, `ETag`/`If-None-Match`→304, `X-MaaS-Producer`/
  `-Integrity`/`-Lossy`/`-Diagnostic`, immutable/floating `CACHE_POLICY`, and the 400/404/500 set. The
  transform is **injected** — defaults to the #1085 `produceWrapperBytes` producer; the `form` param is
  catalog-gated through `wrapperFormCatalog` (`react-wrapper`/`vue-wrapper`, retired `functional` alias
  folds to react + flags lossy).
- `fui:tools/maas/vite-plugin.mjs` — `maasWrapperServe()`: `configureServer` middleware at `/_maas/` +
  the Fetch↔Node-stream adapter (the one Node-specific bridge). Wired into `fui:vite.config.mts` with a
  lazy fs-backed CEM resolver (live the moment a manifest is generated; 404s cleanly when absent).
- `fui:tools/maas/__tests__/wrapperServeHandler.test.mjs` — 10 green: the 302→200 ladder, ETag+SRI,
  304, vue path, the lossy alias, and the full 400/404/500 error set (demo = `curl` the ladder).

FUI `check:standards` 0 errors. The 6-vector contract conformance against `servePathIR.responses` is the
sibling slice **#1086** (`blockedBy` this — now unblocked). Mirrors `we:tools/maas/vite-plugin.ts` shape.
