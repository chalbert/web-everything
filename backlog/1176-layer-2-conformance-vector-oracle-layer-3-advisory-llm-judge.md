---
type: idea
workItem: story
size: 5
crossRef: { url: /backlog/1167-autonomous-exploratory-ui-testing-tool-fui-owned-engine-that/, label: "#1167 autonomous UI tester epic (resolved; this is its post-#899 follow-on)" }
locus: frontierui
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "fui:tools/explorer/oracles/conformanceVectors.ts"
tags: []
---

# Layer-2 conformance-vector oracle + Layer-3 advisory LLM-judge for the autonomous UI tester

The deferred second/third oracle layers for the explorer (epic #1167, locus frontierui), now UNBLOCKED since #899 (behavioral-conformance vectors) resolved. Layer-2: check a driven FUI component against its #899 vectors for semantic correctness (not just the Layer-1 crash/invariant probes in #1169). Layer-3: an advisory LLM-as-judge (WebVoyager pattern) that emits candidate findings for triage — probabilistic, never a hard gate verdict. Both wire into the existing fui:tools/explorer/oracles/ bus built in #1169. Explore mode only; the deterministic close-out gate (#1172) stays Layer-1.

## Resolved (batch-2026-06-20)

Built in `fui:tools/explorer/oracles/`, respecting the #899 split (WE owns the build-agnostic vector schema/corpus; FUI owns the runtime driver — Fork-1 default A):

- **Layer-2** — `fui:tools/explorer/oracles/conformanceVectors.ts`: a `ConformanceBinding` interface (the #899 per-component adapter that interprets action verbs + reads observable surfaces), a verb-agnostic `runConformanceVector` runner that sequences a vector's (possibly timed) steps on a shared `VirtualClock` and records an observed trace, and a fully **pure** `judgeConformanceTrace` that compares the trace to the vector's `expect` — including the `neverObserved` temporal guard, which scans the *whole* trace so a transient stale render is caught at any instant. `ConformanceVectorOracle` runs a whole WE suite (fresh binding per vector). Findings reuse the Layer-1 `Finding` shape (`severity: 'error'`).
- **The clock** — `fui:tools/explorer/oracles/virtualClock.ts`: `VirtualClock` implements the #899 clock-verb contract (`now`/`setTimeout`/`tickAsync`/`runAll`), in-process and hand-advanced, so a temporal vector (stale-async-dropped) runs reproducibly with no real timers.
- **Layer-3** — `fui:tools/explorer/oracles/advisoryJudge.ts`: the WebVoyager advisory judge as an **injected provider** seam (`JudgeModel`, no baked SDK — zero-lock-in), `NullJudgeModel` inert default, and `runAdvisoryJudge` that normalizes candidates into a structurally-distinct `AdvisoryFinding` (`severity: 'advisory'`, clamped `confidence`) that can *never* be aggregated as a gate-eligible error/warn, and swallows model errors. Multi-modal input (screenshot and/or DOM snapshot + goal).

WE-owned vector **types** cross the seam type-only via a new `@webeverything/conformance-vectors/schema` path mapping (`fui:tsconfig.json` + `fui:vitest.config.ts`); no runtime value crosses. Both layers exported from `fui:tools/explorer/oracles/index.ts`. 19 oracle tests green (6 Layer-2 incl. a conformant-vs-broken binding proving the temporal guard, 4 Layer-3, 9 existing Layer-1). `check:standards` in FUI: the 2 catalog errors (`fui:blocks/notification`, `fui:blocks/signature-pad` missing `fui:src/_data/blocks.json` entries) are concurrent block-registration work, not from this changeset (which is confined to `fui:tools/explorer/oracles/` + the two configs).
