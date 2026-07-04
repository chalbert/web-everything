---
name: project_contract_ts_is_separate_slice
description: viz/contract standard scaffolding via protocol JSON ≠ TS contract authoring — the */contract.ts + @webeverything/contracts/* re-export is always a SEPARATE slice (webcharts
metadata: 
  node_type: memory
  type: project
  originSessionId: 44982e34-ce5f-47d7-b0fd-294720d33b9e
---

Scaffolding a viz-family (or any contract-bearing) standard by minting the **protocol JSON** does
**not** author the **TypeScript contract file**. The pure-contract types (`we:<name>/contract.ts`) +
the `@webeverything/contracts/<name>` re-export (`we:contracts/<name>.ts`) are a **distinct slice**
that the standard's scaffolding epic routinely *misses* — the FUI runtime impl can't `import` the
types until it lands, so it gates every downstream build slice.

**Why:** the protocol JSON (`we:src/_data/protocols/*.json`) is registry/catalog metadata; it carries
no TS types. The conformance HTML cases (`we:src/cases/<name>/`) don't either. So a "scaffold the
standard" epic can resolve looking complete (project node + protocol JSON + cases + semantics all
green) while the actual `CustomXRenderer` / spec interfaces still don't exist anywhere in `*.ts`.

**How to apply:** when scaffolding or splitting a new standard's build, **always carve the contract
TS as its own foundational slice** (`size·3`, locus webeverything, no blocker) and make the FUI
default impl(s) `blockedBy` it. Mirror `we:charts/contract.ts` (135 lines, compile-erased types) +
`we:contracts/charts.ts` (type-only re-export). Verify with `grep` for the interface names across
`*.ts` before assuming the contract exists.

Recurrence: webcharts `#1291` minted the plug JSON, TS contract authored separately by `#1334` →
consumed by the FUI SVG renderer `#1292`. webgraph repeated it identically: `#1351`/`#1352` landed
the two protocol seams (`we:src/_data/protocols/custom-graph-{layout,renderer}.json`) + cases but no
TS — caught during `/split 1289`, filed as slice A `#1443`.

Related: [[project_npm_scope_mirrors_layer]] (contract→WE, runtime→FUI), [[project_contract_distribution_published_package_endstate]] (`@webeverything/contracts` is the FUI→WE seam).

**Codified:** the canonical rule is `docs/agent/platform-decisions.md#constellation-placement` (the statute is source-of-truth; the `#NNN` above is provenance, not the reference).
