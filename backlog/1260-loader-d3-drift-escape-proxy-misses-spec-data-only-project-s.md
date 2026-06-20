---
kind: story
size: 3
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: src/_data/backlog.js
tags: []
---

# Loader D3 drift-escape proxy misses spec/data-only AND parent-chained project surfaces

The #617 D3-readiness drift-escape detects a `concept` project's shipped surface ONLY via *resolved backlog items carrying `relatedProject: <proj>` in frontmatter*. That single signal misses **two** real shipped-surface shapes, each leaving a live project mis-demoted out of Tier A under a false `project pending` pill:

1. **Spec/data-only surfaces.** A project whose surface ships as a **spec page + data defs**, not a tagged resolved item. `webplugs` is the live example (51 `active` plug defs + a spec page, zero tagged items — see #1248).
2. **Resolved build work tied via `parent:` chains, not `relatedProject`.** A project whose impl shipped as resolved stories/epics **parented to an implementation epic** (the normal carve shape), none of which carry `relatedProject: <proj>` in frontmatter — so the proxy counts zero. Live examples found 2026-06-20: `webrealtime` (protocol #458 + contract #1067 + FUI provider #1068 + conformance demo #1069, all resolved, all parented to impl epic #1025 — zero tagged) and `webpositioning` (#1018/#508/#1048-1050 resolved, untagged). Both were mis-flagged `project pending` on #1184/#1194/#1186 and only un-stuck by a manual `concept`→`poc` graduation (#1275). `webcharts` is the *counter*-case the broadening must NOT over-correct: its design surface shipped but the runtime genuinely doesn't exist, so it should stay pending (#1004 is a real slice-me epic).

Fix: broaden the proxy to also count these surfaces.

## Where

`deriveProjectReadiness` in `we:src/_data/backlog.js` (`resolvedByProject` built at `:77`; `projectPending` at `:84-87`) currently equates "has shipped surface" with `resolvedByProject.get(proj) > 0`. Broaden that signal: treat a project as non-pending when it has **(a)** a spec page (`we:src/_includes/project-<id>.njk`) or ≥1 `plugs`/`protocols`/`intents`/`blocks` def naming it in `projects`, **or (b)** ≥1 *resolved* item that reaches the project via a `parent:` chain to an item whose `relatedProject` (or `graduatedTo` `project:<id>`) is the project. Keep it a deterministic, structured-field check (no LLM) so it stays a pure loader projection. Caution (the `webcharts` lesson): a resolved *design/spec* surface alone must not clear pending — gate on a resolved **build/impl/runtime/demo** item so a designed-not-built project stays correctly demoted.

## Why it matters

Surfaced by #1248 (the `webplugs` disposition): `webplugs` is a live WE standards project but mis-demoted to a `⊗ project pending` hold on #170 purely because its surface shipped as spec + data, not a tagged resolved item. Generalises beyond webplugs — any standards-only project authored as spec/data is at risk. Closing this makes the readiness pill trustworthy without per-project status babysitting.

Related: #617 (the drift-escape this extends), #1248 (the spec/data case), #170 (the spec/data mis-demoted item), #1275 (the CTA-invariant work that found the parent-chain case via #1184/#1186), #1004 (the designed-not-built counter-case to preserve).

## Progress

Resolved 2026-06-20. Broadened the shipped-surface proxy in `deriveProjectReadiness`
(we:src/_data/backlog.js) — two new BUILT/RUNTIME signals, each gated by the webcharts lesson:

1. **Parent-chain (shape 2).** A resolved item now counts toward a project when its transitive `parent:`
   chain reaches an item carrying `relatedProject: <proj>` — not just its own frontmatter. Handles the
   normal carve shape (build slices parented to an impl epic that names the project). New cycle-guarded
   `projectViaChain` walk over the num→item map.
2. **Built demo/runtime (call-site).** A new `builtSurfaceProjects` set, computed from the demos registry
   (we:src/_data/demos.js — any project named by a conformance/demo via `project`/`projects`), is passed
   into the now-3-arg pure helper. A demo is a runnable artifact, so it clears pending; this covers the
   live shape-2 projects (webrealtime/webpositioning both ship conformance demos).

**The webcharts over-correction was caught and avoided** (the item's explicit caution). Two tempting
signals are DELIBERATELY excluded because they witness DESIGN/SCAFFOLD, not a runtime: (a) a project SPEC
PAGE (`we:src/_includes/project-<id>.njk` — webcharts has one yet isn't built), and (b)
`graduatedTo: project:<id>` — that marks the item that *scaffolded* the project entity (webcharts #570
created the project + its design tasks), so counting it would clear a designed-not-built project. An
intermediate version that counted `graduatedTo: project` regressed webcharts (#1004 dropped out of the D3
hold); dropping that signal restored it. Verified live: #1004 webcharts is still `⊗ project pending` after
the change.

Pure-over-items derivation preserved; the spec/data-only case (a `concept` standards project shipping ONLY
registry artifacts with no demo and no resolved build item) is a documented residual — there is no
structured project→def linkage (plug/block defs carry no `project` field, assembled `projects` has no
member list), so it can't be attributed without a new field; such a project relies on its status (webplugs
is already `poc`). Tests: 9/9 in we:src/_data/__tests__/d3-readiness.test.ts (parent-chain clears, demo
clears, graduatedTo:project does NOT clear, webcharts spec-only stays pending). Gate green.
