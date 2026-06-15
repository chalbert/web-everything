---
type: idea
workItem: story
size: 5
status: open
blockedBy: ["219"]
dateOpened: "2026-06-13"
dateStarted: "2026-06-15"
tags: []
---

# Edge venue — live build-time chunk emission + web-features-backed Baseline lookup

The infra-dependent remainder of #219 (which delivered the pure I/O + caching shell: Sec-CH-UA* parsing, Accept-CH/Critical-CH/Vary, immutable chunk cache headers, injectable BaselineLookup). Two pieces need infra absent from the pure-logic capabilities/ package: (1) a real web-features / Baseline-data-backed BaselineLookup impl (the web-features npm package is not installed; #219 left the lookup injectable rather than invent Baseline data); (2) the live edge runtime that actually BUNDLES and SERVES the resolved component as a real built module at componentUrl over HTTP (EdgeChunkCache today returns a Resolution object, not bytes) — needs an edge server + a bundler/build step. Ties into MaaS distribution #087/#088. DoD: a request with real Client-Hints resolves a droplist to a capability-keyed BUILT chunk served from the edge cache; two UAs in one class share the chunk; a wrong guess degrades.

## Fork surfaced on contact (2026-06-15, batch pre-flight) — two pieces split cleanly: one pure-build, one a placement decision

Claimed in a batch and scoped against the real tree (`capabilities/edge.ts` `EdgeChunkCache.serve` returns a `Resolution`, not bytes; `capabilities/edge-io.ts:69` `BaselineLookup` is an injected `(brand, platform) => number | undefined`). The two pieces are **not** one clean slice — they separate along the agent-ready / needs-a-decision line:

- **Piece (1) — web-features-backed `BaselineLookup`: pure-build, NOT forked.** The doc at `edge-io.ts:20`
  already names the impl ("production backs `BaselineLookup` with `web-features` / Baseline data"), and
  capability ids already borrow `web-features`/Baseline keys (#204), so the impl direction is settled —
  it's the obvious, aligned source. The only blocker is mechanical: the `web-features` npm package is
  **verifiably absent** (`node_modules/web-features` missing, not in `package.json`). Installing it is a
  data-only dep (not a runtime lock-in). **Recommend carving this into its own agent-ready item** (install
  `web-features` + map its Baseline epochs into a `BaselineLookup`, unit-tested against `edge-io.ts`'s
  injection seam) — it needs no decision, just the install.

- **Piece (2) — live edge SERVE runtime (bundle + serve built bytes over HTTP): genuine placement fork.**
  This stands up an HTTP server + a bundler/build step that emits and serves real module bytes at
  `componentUrl`. That is a **live-serve product surface**, and the project has a standing position that
  **collides with putting it in the WE standard repo**:
  - **Monetization stance** (open-core, defer live-serve): the operational ranking favours self-run
    tooling over a hosted service, so a live-serve runtime is explicitly deferred.
  - **Constellation layering + no-leakage**: a *served* product decomposes to **plateau-app**, not the WE
    standard. WE owns the resolution **contract** (delivered by #219); the running server that serves bytes
    is a consumer/product concern.

  **Open decision — where does the live edge serve runtime live, and does the WE repo take the HTTP-server +
  bundler deps?**
  - **A (bold default) — live-serve is a plateau-app product surface; WE ships only the contract + a
    pure-logic "emit plan."** WE's `EdgeChunkCache` gains a deterministic *build-plan* output (what to
    bundle, the cache key, the headers) with **no** HTTP server or bundler dep; plateau-app (or a thin
    demo) consumes that plan to actually bundle+serve. Honours defer-live-serve + layering; keeps WE
    dependency-light. This is the recommended branch.
  - **B — WE hosts a reference edge server + bundler (esbuild) in-repo as a dogfood demo.** Faster to a
    visible end-to-end DoD, but pulls a server + bundler into the standard repo and pre-empts the
    defer-live-serve stance. Defensible only if framed strictly as a throwaway demo, not a product.

  Both branches satisfy the DoD's *behaviour* (built chunk keyed by capability class, shared across a class,
  degrades on a wrong guess); they differ on **where the bytes are built/served**. Pick A unless the demo
  value of B is judged worth the layering cost.

**Released unworked (batch stop rule 4 — fork).** Piece (1) is ready to spin into an agent-ready child the
moment the carve is approved; piece (2) is a ratify-when-worked placement decision. The remaining batch
items are independent of this, so the batch continued past it.
