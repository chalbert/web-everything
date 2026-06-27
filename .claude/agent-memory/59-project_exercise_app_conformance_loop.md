---
name: project-exercise-app-conformance-loop
description: "Exercise apps (#314) run a platform-first conformance loop; WE is the deliverable, the app is a forcing function; check:app-conformance is the benchmark"
metadata: 
  node_type: memory
  type: project
  originSessionId: 3095a24d-fd26-43f4-a67f-bd6d880eb8e9
---

The flagship exercise apps ([[project_exercise_app_style_registers]], backlog #314) are governed by a
**platform-first conformance loop**, not normal product work.

**North star:** the apps exist to **drive and prioritize Web Everything**. The app is a forcing function
and WE's first consumer — *never the deliverable*. Success = **WE surfaces implemented/codified**, not app
features. **When app progress and platform progress conflict, platform wins.** Don't polish the app or
broaden domain logic; a slice is done only when a WE surface is activated/codified (with its conformance
demo + tests) or a gap is tracked.

**The benchmark:** `npm run check:app-conformance` (`scripts/check-app-conformance.mjs`, peer of
check:standards). NOT a native-API lint — you can only validate against an actual standard. One
concept-extraction core feeds **two layers**: **Layer 1 conformance** (per WE standard the app touches:
conformant / **reimplemented** [active std, bespoke parallel = FAIL — the only true non-conformance] /
**gap** [std not yet active = the WE work; tag `// PLATFORM-GAP:#NNN`] / claimed-unused); **Layer 2
discovery** (capabilities with NO standard → candidate standards, feeds `/new-standard`; heuristic). Our
apps declare a `conformance.json` manifest; manifest-less inference mode lets it run on real external apps.
**Conformance** = the measure (reports); **compliance** = a criterion promoted to a hard gate (`--strict`;
future Web Compliance project #351). Reports → Web Reporting project #350. `--json` feeds the loop.
S0 of #317 reads **0% conformance** (built off-platform) + **5 candidate standards** filed #353–#357.

**The loop:** scan → fill the top gap **in WE** (activate draft block/intent design-first, refactor onto a
bypassed active block, or `/new-standard`) → app consumes it → rescan. Driven by the **`/exercise-app`**
skill; `/loop /exercise-app` self-paces.

**Standard→runtime two-step (per candidate): conventions + gotchas (proven on lifecycle #353→#391, audit #357→#399):**
codify turn ships Project+Protocol+Intent and wires the benchmark concept (`standardId` + `evidence`) → the
app's hand-roll becomes a tracked Layer-1 GAP (score dips — the honest "bar grew" signal). Runtime turn
ships an active block + intent render, app consumes, score returns to 100%. **Gotcha 1: a runtime block's
`id` MUST equal the standard/protocol id it satisfies** — `check-app-conformance.mjs` `resolveStandard`
checks blocks by id FIRST, so block id `lifecycle`/`audit-trail` shadows the same-named protocol and flips
the app conformant (named the audit block `audit`→had to rename `audit-trail`). **Gotcha 2: the benchmark
walks only the APP dir** — `evidence` regexes must match tokens in `demos/<id>/**`, not the block source,
and must be a CODE signature not a prose token (a PLATFORM-GAP comment naming `CustomFooProvider` falsely
trips evidence → mislabels gap-reimplemented as gap-consuming). Cross-standard composition is the payoff:
audit's `auditLifecycle(lifecycleProvider, auditProvider)` subscribes lifecycle events → auto-appends audit
events → timeline renders (first live multi-standard compose).

**Epic scaffolding (the #317 shape — codified in exercise-app-workflow.md §Epic scaffolding + skill Step 0):**
a committed app stays a child `story` of #314 until build starts; the **first build turn promotes it to a
storied `epic`** (`status:active`, no `size`, add `dateStarted`+`relatedReport`). Then: derive a
requirements-report PRD; two child-card tracks — **WE-surface consumption slices** (one per block consumed
= the conformance %) + **functional-phase stories** (one per PRD module, each naming the WE surface it
drives); a "Program tooling" link to #377; a "WE surfaces this app drives" tracker in the body; register in
`demos.json` with an `epic` field (drives the detail-page epic link + `demoBlockers` view). Only #317 is
promoted; #318/#319/#345 (committed B/G/E) are still stories — promote-on-build, not preemptively.

**How to apply:** before hand-writing any UI/behavior in an exercise app, resolve it against the registry
(active→use / draft→implement / uncodified→propose). Full method:
`docs/agent/exercise-app-workflow.md` (+ objective section in `demo-workflow.md`). Gaps found = the WE
roadmap. (S0 of loan-origination #317 baselined at **23%** — built off-platform; that gap list is its real
output.)
