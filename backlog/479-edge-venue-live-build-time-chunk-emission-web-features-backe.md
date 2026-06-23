---
kind: epic
status: resolved
dateOpened: "2026-06-13"
dateStarted: "2026-06-15"
dateResolved: "2026-06-23"
graduatedTo: none
tags: []
---

# Edge venue — live serving (epic)

Umbrella for the infra-dependent remainder of #219 (which delivered the pure I/O + caching shell:
Sec-CH-UA* parsing, Accept-CH/Critical-CH/Vary, immutable chunk cache headers, injectable
`BaselineLookup`). Two pieces need infra absent from the pure-logic `capabilities/` package — and they
cleave along the agent-ready / needs-a-decision line, so this epic carves into one batchable build slice
plus one placement decision. Ties into MaaS distribution #087/#088 (the [constellation-placement](docs/agent/platform-decisions.md#constellation-placement) rule). **Epic DoD** (satisfied when the
children land): a request with real Client-Hints resolves a droplist to a capability-keyed BUILT chunk
served from the edge cache; two UAs in one class share the chunk; a wrong guess degrades.

Sliced 2026-06-15 — see [we:reports/2026-06-15-backlog-split-analysis.md](../reports/2026-06-15-backlog-split-analysis.md).

## Children

- **#698 — web-features-backed `BaselineLookup`** (`story·2`, batchable now). Pure build, **not forked**:
  the doc at [`we:edge-io.ts:20`](../capabilities/edge-io.ts#L20) already names the impl and capability ids
  already borrow `web-features`/Baseline keys (#204), so the direction is settled — the only blocker was
  the verifiably-absent `web-features` npm package. Install it + map Baseline epochs into the injected
  `BaselineLookup` ([`we:edge-io.ts:69`](../capabilities/edge-io.ts#L69)), unit-tested against the injection
  seam.

- **#699 — placement of the live edge serve runtime** (`type:decision`, **resolved 2026-06-22**).
  Ratified **(a)**: live-serve = plateau-app product; WE ships only the contract + a pure, bundler-neutral
  emit-build-plan (no HTTP server, no bundler dep), with a WE-side neutrality vector. Branch B (WE in-repo
  reference esbuild server) was statute-foreclosed by
  [constellation-placement](docs/agent/platform-decisions.md#constellation-placement). Resolution sliced the
  live-serve build into the two children below.

- **#1624 — EdgeChunkCache emits a bundler-neutral build-plan** (`story·3`, agent-doable). WE-side slice:
  add a deterministic emit-build-plan (capability-class, cache-key, declarative `Vary`/`Accept-CH`/immutable
  headers) to [`we:edge.ts`](../capabilities/edge.ts#L160), with a [`we:capabilities/check.ts`](../capabilities/check.ts)
  vector pinning bundler-neutrality. No server, no bundler dep in WE.

- **#1625 — plateau-app consumes the emit-build-plan to bundle + serve** (`story·3`,
  `relatedProject: plateau-app`, `blockedBy: 1624`). The actual live-serve runtime (HTTP server + bundler)
  in plateau-app. Deferred by **defer-live-serve** until a real MaaS-distribution surface forces it.
