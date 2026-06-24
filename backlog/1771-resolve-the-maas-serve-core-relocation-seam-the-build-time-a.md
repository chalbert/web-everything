---
kind: decision
status: resolved
relatedProject: webcomponents
relatedReport: reports/2026-06-24-maas-serve-core-relocation-seam.md
preparedDate: "2026-06-24"
blocks: ["1730"]
dateOpened: "2026-06-24"
dateStarted: "2026-06-24"
dateResolved: "2026-06-24"
graduatedTo: none
codifiedIn: "docs/agent/platform-decisions.md#constellation-placement"
tags: [maas, placement, zero-implementation, renderers, devtools-placement]
---

# Resolve the MaaS serve-core relocation seam — the build-time author-mode projector imports the serve() the card relocates

#1730's "relocate `we:blocks/renderers/module-service/` runtime → FUI, keep the build-time `serve()`
projection" looked like a coupled design fork. Grounding it against the *already-ratified* placement rules
shows there is **no open fork**: every piece's home is forced by a rule already on the books. This card's
job is to **record that forced mapping** (and the #954 reversal it implies) so #1730 executes cleanly.
**Prepared 2026-06-24** ([report](../reports/2026-06-24-maas-serve-core-relocation-seam.md)).

## The forced mapping (no fork — every row determined by a ratified rule)

| Piece | Home | Forced by |
| --- | --- | --- |
| `serve()` + `FORMS` + the `component`/`jsx`/`functional` transform core (`we:blocks/renderers/module-service/moduleService.ts:17-19,33,142`) | **→ FUI** | impl→FUI (#1282 — a renderer is a "block engine", not declarative-artifact tooling); #1294 relocation debt |
| the author-mode emit/generator (`we:blocks/renderers/module-service/authorModeSource.ts`, `we:scripts/gen-author-mode-source.mjs`) + the workbench author-mode panel + its `we:src/_data/authorModeSource.json` data | **→ FUI** | workbench is a FUI-owned product (#809); FUI runs its own transform over WE's fixtures and owns the rendered output |
| delivery siblings — `we:blocks/renderers/module-service/fetchHandler.ts`, `we:blocks/renderers/module-service/productionDelivery.ts`, `we:blocks/renderers/module-service/prewarm.ts`, `we:blocks/renderers/module-service/reactivity.ts`, `we:blocks/renderers/module-service/incrementalUpdate.ts`, `we:blocks/renderers/module-service/definitionRegistry.ts`, the `we:tools/maas/vite-plugin.ts` `/_maas/` origin | **→ FUI** | delivery runtime is FUI-canonical (#1282 rule 1); these are the named "tracked relocation debt" |
| the HTTP reference *subject* (`we:blocks/renderers/module-service/conformance/referenceTarget.ts`) | **→ FUI/Plateau** | verifier-vs-subject (#1467/#1566) — the running subject is not WE's |
| `we:demos/maas-consumer-demo.ts` + `we:demos/maas-consumer-demo.html` website demo (the only live `/_maas/` consumer) | **→ FUI; WE embeds the workbench** | demo-placement #809 + we-fui-embed-boundary rule 6 (WE-docs surfaces FUI via mode-C / `fuiDemo` iframe) |
| ServeForm **IR + contract** (`we:blocks/renderers/module-service/servePathIR.ts` pure types, `we:blocks/renderers/module-service/servePathOpenAPI.ts`) + **conformance vectors** (`we:blocks/renderers/module-service/conformance/golden.json` data) + the `we:blocks/renderers/component/__fixtures__/component-cases` fixtures | **stays WE** | contract + conformance vectors (data) only — the WE-resident half rule 1 keeps |

## Why there is no fork — the two "forks" the prep authored were settled rules

The prep ([report](../reports/2026-06-24-maas-serve-core-relocation-seam.md)) framed two forks; discussion
2026-06-24 dissolved both against the rules, so they are recorded here as **forced invariants, not choices**:

- **"Does `serve()` stay WE as a build-time carve-out, or go to FUI?"** — Forced **FUI**. The #1566 carve-out
  covers "tooling that *checks* WE's **own declarative artifacts** — manifests, golden-corpus
  completeness/schema-validity" (`we:docs/agent/platform-decisions.md:84-89`). `serve()` is a **renderer** —
  it lowers `<component>` → wc-class/jsx/functional, the same transform FUI ships as product. "Runs over WE's
  own fixtures" describes *how it's invoked*, not *what it is*; a renderer is not a declarative-artifact
  checker. Rule 1 names "block engines, parser/proof logic" as FUI-canonical. So the transform core is impl →
  FUI, #1294 debt. The earlier "stays as carve-out" reading was a misread of the carve-out's bound.
- **"Relocate the delivery siblings to FUI, or delete them?"** — Not WE's call to make. The siblings + the
  `/_maas/` demo follow the *demo/delivery* rules (FUI-canonical delivery + FUI-owned demos), so they leave WE
  regardless. Whether FUI keeps the relocated code or rebuilds fresh (`backlog/1760` plans a fresh
  authored-component route off `we:src/_data/authorModeSource.json`, **not** importing WE's `fetchHandler`) is
  a **FUI-side implementation choice under #1730/#1760**, not a WE seam decision — WE deletes its copies either
  way.

**Net:** WE keeps only the **contract + vectors (data) + fixtures**. Everything executable — the transform,
the emit, the workbench, the delivery origin, the demo — is FUI's, by rules already ratified.

## The #954 reversal this records

#954 ratified "WE runs `serve()` at build time and **commits** `we:src/_data/authorModeSource.json`; FUI reads
the data." That premise **inverts** the moment `serve()` leaves WE: FUI now runs its own transform over WE's
`we:blocks/renderers/component/__fixtures__/component-cases` fixtures and owns the author-mode data
end-to-end. WE no longer emits the JSON. This is a deliberate reversal of #954's Fork-1-A under #1282
(ratified decisions are reversible); the #700 type-only-seam direction (WE→FUI) is unchanged — only the
*generator's* home moves.

## What you decide

One nod: **confirm the forced mapping above** (there is no branch to pick — each row is determined by an
existing rule). On confirmation #1730 unblocks and executes: move the transform core + author-mode emit +
delivery siblings + reference subject + the demo → FUI; delete WE's copies; keep IR + contract +
`we:blocks/renderers/module-service/conformance/golden.json` vectors +
`we:blocks/renderers/component/__fixtures__/component-cases` fixtures in WE; record the #954 reversal.
**Execution caveat for #1730:** FUI's emit needs WE's `component-cases` fixtures — those are WE declarative
artifacts (data), so FUI reads them across the seam as data (no new WE→FUI code edge). **Un-park trigger:**
none — ready to ratify now; #1730 is the only dependent and is `blockedBy` this.

## Lineage

Surfaced claiming #1730 in `batch-2026-06-24-1768-1730` (a buried fork the pre-flight skim missed; caught
at claim-time grounding). #1730 `blockedBy` this. **Reverses #954's "WE runs `serve()`"** (the generator
moves to FUI) and **completes #956**: #956 froze the build-time form catalog *in WE*; with the transform now
FUI-canonical, the `REFERENCE_RUNTIME_FORMS` guard + the form catalog move to FUI with `serve()`, and WE keeps
only the conformance vectors that pin the catalog. Discussion 2026-06-24 dissolved the prep's two authored
forks into forced invariants (impl→FUI; demos/delivery→FUI). Grounds: #1282 (zero-impl) · #1294 (relocation
debt) · #1566 (carve-out bound — and its limit) · #1467 (verifier-vs-subject) · #809 (workbench is FUI-owned) ·
we-fui-embed-boundary rule 6 (WE embeds FUI demos) · #1760 (the FUI rebuild) ·
`we:docs/agent/platform-decisions.md` constellation-placement + devtools-placement. Same shape as #1577→#1747
(a relocate card that was actually a coupled design fork) — except here the fork dissolves entirely.
