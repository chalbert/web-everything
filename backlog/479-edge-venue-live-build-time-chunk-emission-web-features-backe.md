---
type: idea
workItem: epic
status: open
dateOpened: "2026-06-13"
dateStarted: "2026-06-15"
tags: []
---

# Edge venue — live serving (epic)

Umbrella for the infra-dependent remainder of #219 (which delivered the pure I/O + caching shell:
Sec-CH-UA* parsing, Accept-CH/Critical-CH/Vary, immutable chunk cache headers, injectable
`BaselineLookup`). Two pieces need infra absent from the pure-logic `capabilities/` package — and they
cleave along the agent-ready / needs-a-decision line, so this epic carves into one batchable build slice
plus one placement decision. Ties into MaaS distribution #087/#088. **Epic DoD** (satisfied when the
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

- **#699 — placement of the live edge serve runtime** (`type:decision`, **parked**). The live SERVE
  runtime (bundle + serve real module bytes at `componentUrl` over HTTP; `EdgeChunkCache.serve` returns a
  `Resolution`, not bytes — [`we:edge.ts:169`](../capabilities/edge.ts#L169)) is a live-serve product
  surface that collides with the standing **defer-live-serve** + **no-leakage layering** stances. The
  fork (A: plateau-app product + WE pure-logic emit-plan · B: WE in-repo reference esbuild demo) is
  tracked in **#699**, parked until a real MaaS-distribution surface forces the call. **Resolving #699
  unblocks the live-serve build slices** (under A: a WE emit-build-plan slice + a plateau-app
  serve-consumer slice) — re-`/slice` this epic once #699 lands; those seams are unknowable until then.
