---
kind: decision
size: 8
status: resolved
dateOpened: "2026-06-15"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
graduatedTo: none
codifiedIn: "docs/agent/platform-decisions.md#constellation-placement"
preparedDate: "2026-06-15"
relatedProject: webdocs
tags: [frontierui, webdocs, catalog, derived-manifest, cem, mechanism-fork]
---

# Generate FUI's block catalog from a derived manifest and render its local /blocks/ from it

Replace the hand-curated 7-entry fui:frontierui/src/_data/blocks.json (which surfaces only ~30% of the 23 implemented block families and silently drifts) with a single manifest auto-derived from the FUI implementation (CEM / generated), and render FUI's own /blocks/ catalog (fui:frontierui/src/blocks.njk) from it — dogfooding #425's self-hosted Web Docs primitives on real data. Per the #705 ruling: FUI owns impl AND its rendered display; WE never renders these blocks (it embeds FUI-hosted demos via the #701 fuiDemo iframe). Coordinate the derivation mechanism with the WE web-docs pipeline (#623/#627) rather than forking a parallel one.

## Surfaced design fork — the derivation MECHANISM (2026-06-15, claim-time, batch-2026-06-15)

Claimed in a batch; on inspecting the frontierui repo the build is **not mechanical — the derivation
mechanism is a genuine, unsettled fork** the title's "auto-derived from the FUI implementation (CEM /
generated)" and the body's "coordinate … rather than forking a parallel one" pull in **opposite
directions**. Three verified facts ground it:

- **No source-analyzer exists.** `@custom-elements-manifest/analyzer` is **not** installed in frontierui
  and there is **no** `we:custom-elements.json`. A true "derive from implementation" needs a CEM-from-source
  tool added + JSDoc/decorator metadata the raw block classes don't currently carry (the analyzer would
  emit thin tag/member data, **no summaries**).
- **The WE pipeline derives the OTHER direction.** WE's ratified CEM mechanism (#626 protocol
  `custom-elements-manifest`) is **authored `fui:blocks.json` → CEM** (`we:scripts/gen-cem.mjs` projects fields a
  fui:blocks.json entry already carries). So "coordinate with the WE pipeline" means authored-manifest→CEM,
  while "auto-derive from the FUI implementation" means impl→manifest. **These are inverse mechanisms** —
  you cannot do both; that is the fork.
- **Cross-repo coupling + dir≠id.** FUI `check-standards` requires every block's `weSpecPath` to resolve in
  WE's `fui:blocks.json` (69 blocks), and the curated FUI ids (`simple-store`, `handler-expression-parser`,
  `event-behaviors`, `transient-component`) **do not map 1:1** to the `blocks/` family dirs (`stores/`,
  `parsers/`, …, often many blocks per family). So a naive dir-scan can neither produce valid ids nor the
  required WE spec mapping.

**The fork (pick the derivation mechanism):**

- **A — Impl-scan / CEM-from-source (literal "auto-derive from implementation").** Add
  `@custom-elements-manifest/analyzer`, annotate the block classes enough to emit a useful CEM, scan
  `blocks/`, and render from the generated `we:custom-elements.json`. Fixes coverage by construction (every
  exported element appears). Cost: a new analyzer toolchain + a per-class annotation pass + a separate
  id→WE-spec + summary source the analyzer can't produce — and it **forks a parallel mechanism** from WE's
  authored→CEM pipeline (the body warns against exactly this).
- **B — Authored manifest + completeness GATE, reusing WE's #626 CEM direction (recommended).** Keep an
  authored `fui:blocks.json` (the curated metadata: summary/type/protocol/weSpecPath) but add a
  `check-standards` rule that **fails if any implemented `blocks/` family has zero manifest entries** —
  killing the silent 30%-drift the same way WE's `check-demos` forces every demo folder to be registered.
  The manifest→CEM derivation then reuses WE's #626 mechanism unchanged (coordinate, no parallel fork).
  Authored summaries stay; coverage becomes gate-enforced rather than hand-remembered. Cost: it is
  *authored-complete-by-gate*, **not literally "impl-derived"** — a reframing of the title.

**Recommendation: B.** It directly fixes the stated problem (drift / 30% coverage) via a completeness gate,
keeps authored-quality summaries, and **coordinates with the WE pipeline instead of forking a parallel
impl-analyzer** — honoring the body's own "rather than forking a parallel one." A is the literal reading but
contradicts the coordinate-don't-fork constraint and needs a toolchain + annotation + mapping/summary source
that don't exist. The relax: read "auto-derived from the FUI implementation" as "**a manifest whose
completeness is derived from (gated against) the implementation**," not "scraped from source." **Ratify the
mechanism before building** — then the build (≈ the gate rule + filling the ~16 missing authored entries +
rendering) is mechanical. Surfaced and released unworked; not settled with a quiet in-build call.

## RULING (2026-06-16) — not a pick between A/B; the fork dissolves into invariant + dimension

Discussed and ratified. Two challenges reshaped the call: (1) *beyond cost, is there a better solution* —
strip cost (prioritization, not merit) and the A/B fork is seen to **conflate two independent axes**; (2)
*is this FUI-only, or a strategy for any implementer* — #706 is filed under `webdocs`, which is a **standard**
(→ WE) with FUI as one implementer, so "how an implementer derives its catalog manifest" is a standard-level
question where WE mandates nothing if both branches are coherent.

**The two axes the original fork conflated:**

- **Axis 1 — manifest content source:** authored | impl-scan (CEM-from-source) | hybrid.
- **Axis 2 — coverage guarantee:** the completeness gate. The drift (7/24 families) is an Axis-2 failure;
  the gate fixes it *regardless of source*. A scanned manifest is complete by construction; an authored one
  needs the gate. The invariant is the same either way.

**Ruling:**

- **Completeness gate = FIXED INVARIANT** (not a branch). Every implemented `blocks/` family must resolve to
  ≥1 manifest entry, gated in `check-standards` the way WE's `check-demos` forces every demo folder to be
  registered. Always on, for any implementer.
- **Derivation source = SUPPORTED DIMENSION** (not a fork). Both authored and impl-scan are coherent for
  *different* implementers (annotated source → JSDoc summaries make A great; no annotations + curated
  summaries make authored right), so by the fork-existence test it is a dimension to support, not a call to
  decide. WE ships the **authored→CEM path (#626) as the default/reference source**; impl-scan/CEM-from-source
  is an opt-in source emitting the same contract.
- **Standard (WE) owns:** the manifest *contract* (id, summary, type, protocol, weSpecPath…) + the
  completeness invariant + the authored→CEM default. Coordinates with the WE web-docs pipeline (#623/#627,
  #626), no parallel mechanism.
- **FUI's instantiation today = authored + gate** (the former "B"), because FUI has no annotations and needs
  curated summaries — recorded as *FUI's chosen instantiation of the dimension*, **not** the global mandate.

Why this beats picking B-as-mandate: same drift fix, same "coordinate don't fork", **plus** it doesn't bake a
FUI-specific choice into the standard for every future implementer. Honors support-all-coherent /
dimension-vs-fixed-mechanic / most-flexible-default.

**Build is now mechanical** — carved to spin-off **#731** (blocked by this decision, now resolved):
the gate rule + filling the ~17 missing authored entries + rendering FUI's `/blocks/` from the manifest, plus
documenting the source dimension in the Web Docs standard.
