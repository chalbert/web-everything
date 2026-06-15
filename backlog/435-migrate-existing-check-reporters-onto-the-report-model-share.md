---
type: idea
workItem: story
size: 13
parent: "350"
status: open
blockedBy: ["431", "432"]
dateOpened: "2026-06-12"
tags: []
---

# Migrate existing check:* reporters onto the report model + shared renderers

Point the existing reporters — check:standards, check:app-conformance, check:readiness, the burndown, the capability-manifest — at the report model as producers and replace their bespoke output with the shared renderers, incrementally (one reporter at a time). The burndown/readiness logic stays; only its output shape migrates. Phase 5 of #350; needs the model (#431) and the v1 renderers (#432).

## Pickup analysis (2026-06-13, batch) — re-sized 3 → 8, recommend slicing

Examined in a batch and **released unworked** because it is an **umbrella over five heterogeneous reporters**, not a size-3:
each reporter emits a different shape — `check:standards` (findings, already has a bespoke `--json` descriptor shape, #089/#196), `check:readiness` (a ranked *selection* + batch pack), `check:app-conformance` (a coverage matrix + a burndown **series**, writes `reports/app-conformance-burndown.json`), plus the standalone burndown and capability-manifest. Mapping each onto the `Report` model (`sources`/`sections`/`findings`/`scores`/`series`) is one increment apiece.

**Fork scare dissolved (de-risks the work):** the apparent question "how does a `.mjs` CLI reporter consume the TS report model / renderers in `blocks/`?" is **not a fork**. The `Report` model ([blocks/renderers/report/renderReport.ts](../blocks/renderers/report/renderReport.ts)) is a **plain-object contract** — a `.mjs` reporter constructs a matching plain object and emits it as JSON with **no TS import**; the TS HTML renderers (#432) and the SARIF/JUnit export adapters (#434, `toSarif`/`toJUnit`) are ready *downstream* consumers of that JSON. So the producer side is a pure-JS emit per reporter. There is **no shared terminal/ANSI renderer** and the model doesn't need one — terminal output stays bespoke; only the *structured* output shape migrates to the model.

**Sized 8 → 13 (2026-06-15, batch pre-flight):** confirmed an umbrella over 5 heterogeneous reporters, not a single batchable slice — dropped from the batch pool until `/split`.

**Recommended next step:** `/split` into per-reporter increments (suggested order: check:standards → readiness → app-conformance/burndown → capability-manifest), each a size-2/3 producer-emit slice reusing a shared `buildReport()` helper authored in the first slice. blockedBy #431/#432 are both resolved; the slices are ready once carved.
