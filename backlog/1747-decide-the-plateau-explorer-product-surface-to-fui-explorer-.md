---
kind: decision
status: open
dateOpened: "2026-06-24"
dateStarted: "2026-06-24"
preparedDate: "2026-06-24"
relatedProject: webcomponents
relatedReport: reports/2026-06-24-cross-repo-tool-engine-product-boundary.md
tags: [explorer, devtools-placement, constellation, plateau, frontierui, cross-repo]
---

# Decide the Plateau explorer-product-surface ↔ FUI-explorer-engine boundary (the @frontierui public API the moved CLI imports) + the Layer-1 genericInvariants home

## Digest

#1577 (relocate the explorer CLI chrome FUI→Plateau per ratified #1565 Fork 3) needs a cross-repo boundary
that doesn't exist: the 4 product files import 8 FUI engine internals, and `plateau:package.json` has no
`@frontierui` dep. Two coupled forks. **Fork 1** (how Plateau consumes the FUI engine): default **(c) thin
CLI chrome over the narrowest engine API, → (a) a curated public package later** — the move is ratified so
(b) "keep it in FUI" is out, and the engine still churns (#1522) so a full public API now (a) is premature.
**Fork 2** (genericInvariants home): **stays in FUI** — its only consumers are FUI engine internals, so a
Plateau home is a banned backward edge. Confidence med. Two open forks.

## Framing

The decision turns on the WE↔Plateau↔FUI **source-dependency DAG**, not on where the product is operated.
`we:docs/agent/platform-decisions.md` devtools-placement **rule 3** ratifies "autonomous-explorer CLI
chrome → Plateau" (#1565 Fork 3; the live work item is `we:backlog/1577-*.md`), so the CLI *moves* — the
only question is the consumption seam. The 4 product-surface files
(`fui:tools/explorer/cli.ts`, `fui:tools/explorer/cliRouting.ts`, `fui:tools/explorer/routeDiscovery.ts`,
`fui:tools/explorer/reportBundle.ts`, ~640 LOC) import 8 engine internals via `fui:tools/explorer/cli.ts:21-31`
(`workbenchHarness`, `docsSiteHarness`, `gateRunner`, `routeSweep`, `routeDiscovery`, `reportBundle`,
`authRecipe`, + `stateFlowGraph`/`observation`/`gate` types). `plateau:package.json` has no `@frontierui`
dep; `fui:package.json` is `"private": true` with no `exports`/`main`/`bin`. Prior art
(`/research/cross-repo-tool-engine-product-boundary/` — Playwright/WebdriverIO/axe/Chromatic) favours a
separate CLI package beside the engine while it churns, graduating to a curated public-API package once
stable; the constellation has *already* mandated the two-repo split, so the faithful reading is "thin
chrome now, public package later." The explorer engine is **distinct** from the conformance engine
(contract `we:conformance-vectors/binding.ts` #1596, runner/judge `plateau:src/conformance-engine/conformanceVectors.ts`
#1597) — #1576's "unblock" of #1577 was a false edge over a *different* engine.

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| Fork 1 — cross-repo consumption boundary | **(c) thin CLI chrome in Plateau over the narrowest FUI-engine API, structured toward (a)** | (a) full curated `@frontierui` explorer-engine public API now | Med |
| Fork 2 — Layer-1 genericInvariants home | **stays in FUI with the engine** (app-agnostic, but consumed only by FUI engine internals) | a shared platform-UX lib upstream of FUI | Med-high |

## Fork 1 — how the Plateau explorer product surface consumes the FUI explorer engine

**Fork-existence:** a genuine either/or — the CLI moves to Plateau (ratified rule 3), so Plateau must
consume the FUI engine across a repo boundary by exactly one mechanism; (b) "keep the CLI in FUI" is the
*excluded* branch because it contradicts the ratified placement.

Crux refs: `we:docs/agent/platform-decisions.md` rule 3 (CLI chrome → Plateau) + `we:backlog/1577-*.md`
(the relocation work item); `fui:tools/explorer/cli.ts:21-31` (the 8 engine imports); `plateau:package.json`
(no `@frontierui` dep); `fui:package.json` (private, no `exports`). Prior art:
`/research/cross-repo-tool-engine-product-boundary/`.

- **(c) Thin CLI chrome in Plateau over the narrowest engine API — _recommended_.** Move only the
  genuinely product-specific orchestration (`cli`, `cliRouting`, `routeDiscovery`, `reportBundle`) to
  Plateau, behind the smallest FUI-engine surface (`workbenchHarness` / `docsSiteHarness` / `gateRunner` /
  `routeSweep` + `stateFlowGraph`/`observation`/`gate` *types*). Honours the ratified move without freezing
  a large public API while the engine churns (epic #1522/#1167). Explicitly structured toward (a): the
  narrow surface graduates to a versioned `@frontierui` entry when it stabilises. Cost: some chrome may
  briefly straddle repos during the transition.
- **(a) `@frontierui` package dependency + a curated explorer-engine public API.** *Deferred end-state, not
  now.* Cleanest long-term (add `@frontierui` to `plateau:package.json`, export `explore` + the
  oracle/observation/harness/gate-runner surface from a stable entry), but committing a large public API +
  versioning contract while the engine is still churning is premature (API Extractor-grade governance cost
  for a moving surface). Adopt once the surface stabilises.
- **(b) Keep the whole explorer (CLI included) in FUI; expose only a hosted wrapper in Plateau.**
  *Rejected* — it re-reads #1565 Fork 3 as "the hosted product is Plateau" *without moving the CLI source*,
  which contradicts the ratified rule-3 placement ("autonomous-explorer CLI chrome → Plateau") and never
  builds the boundary this decision exists to settle. (A genuine reversal of rule 3 would be allowed, but
  must be argued as one and clear the merit gate — the churn argument licenses (c), not staying put.)

**Skeptic:** SURVIVES-WITH-AMENDMENT → flipped the original (b) default to **(c)**. The skeptic over-reached
claiming "engine→FUI is a factual error" — that codified ruling governs the *conformance* engine (#1566),
not the *explorer* engine, whose FUI home is consistent with the carve-out. But its load-bearing point held:
rule 3 + #1577 ratify CLI-chrome→Plateau, so the original (b) default was a silent reversal. (c) honours the
move while deferring the API-freeze that churn makes premature.

## Fork 2 — the Layer-1 genericInvariants home (the explicit #1565 residual)

**Fork-existence:** a genuine placement either/or left open by #1565 — app-agnostic Layer-1 invariants
could legitimately live with the engine that runs them (FUI) or in a shared platform-UX lib both repos
consume; the branches are mutually exclusive homes.

Crux refs: `fui:tools/explorer/oracles/genericInvariants.ts` (app-agnostic no-crash / no-a11y), consumed
only by `fui:tools/explorer/gate.ts:21`, `fui:tools/explorer/exploreAndAudit.ts:15`,
`fui:tools/explorer/routeSweep.ts:18` — all FUI engine internals; the #1565 residual framing
(`we:docs/agent/platform-decisions.md` devtools-placement).

- **Stays in FUI with the engine — _recommended_.** Its only consumers are the FUI-resident explorer
  engine internals; Plateau's CLI reaches these invariants **transitively** through the engine API (Fork 1),
  never directly. Relocating it to Plateau would force a FUI-engine → Plateau **backward CODE import**,
  which the constellation DAG bans (backward edges are module imports). So it stays upstream, with the
  engine it serves.
- **(a) Plateau product-engine.** *Rejected* — creates the banned backward edge above (FUI engine code
  would import an app-agnostic oracle from downstream Plateau). The #1565 residual framed this as an
  option, but the residual pre-dated reading the consumer graph.
- **(b) A shared platform-UX lib upstream of FUI.** *Rejected for now* — bias-toward-separation favours a
  shared home in principle, but the lib would have to sit upstream of both FUI and Plateau (it can't be WE
  per #1282 — `genericInvariants` is executable), and creating a new package for one file with no *direct*
  second consumer is premature. Revisit when Plateau's product layer needs to run these invariants without
  going through the FUI engine — then extract upstream.

**Skeptic:** SURVIVES (skeptic REFUTED). The skeptic argued genericInvariants → Plateau on
bias-toward-separation. Tested against the consumer graph (its three importers are all FUI engine
internals): a Plateau home is a banned backward edge. The separation pull is real but is satisfied at the
*engine-API* seam (Fork 1), not by relocating an engine-internal oracle. Default stays FUI.

## Lineage

#1577 is `blockedBy` this. Surfaced during batch-2026-06-23-1725-1665 working #1577. Grounds: #1565 Fork 3
(devtools-placement, `we:docs/agent/platform-decisions.md`), #1566 (the conformance-engine split — a
*different* engine), #1576/#1596/#1597 (conformance-engine home), the verified-absent `@frontierui`
dependency in `plateau:package.json`. Research: `/research/cross-repo-tool-engine-product-boundary/`.
Report: `we:reports/2026-06-24-cross-repo-tool-engine-product-boundary.md`.
