---
type: decision
workItem: story
size: 8
status: open
dateOpened: "2026-06-15"
preparedDate: "2026-06-15"
relatedProject: webdocs
tags: [frontierui, webdocs, catalog, derived-manifest, cem, mechanism-fork]
---

# Generate FUI's block catalog from a derived manifest and render its local /blocks/ from it

Replace the hand-curated 7-entry frontierui/src/_data/blocks.json (which surfaces only ~30% of the 23 implemented block families and silently drifts) with a single manifest auto-derived from the FUI implementation (CEM / generated), and render FUI's own /blocks/ catalog (frontierui/src/blocks.njk) from it — dogfooding #425's self-hosted Web Docs primitives on real data. Per the #705 ruling: FUI owns impl AND its rendered display; WE never renders these blocks (it embeds FUI-hosted demos via the #701 fuiDemo iframe). Coordinate the derivation mechanism with the WE web-docs pipeline (#623/#627) rather than forking a parallel one.

## Surfaced design fork — the derivation MECHANISM (2026-06-15, claim-time, batch-2026-06-15)

Claimed in a batch; on inspecting the frontierui repo the build is **not mechanical — the derivation
mechanism is a genuine, unsettled fork** the title's "auto-derived from the FUI implementation (CEM /
generated)" and the body's "coordinate … rather than forking a parallel one" pull in **opposite
directions**. Three verified facts ground it:

- **No source-analyzer exists.** `@custom-elements-manifest/analyzer` is **not** installed in frontierui
  and there is **no** `custom-elements.json`. A true "derive from implementation" needs a CEM-from-source
  tool added + JSDoc/decorator metadata the raw block classes don't currently carry (the analyzer would
  emit thin tag/member data, **no summaries**).
- **The WE pipeline derives the OTHER direction.** WE's ratified CEM mechanism (#626 protocol
  `custom-elements-manifest`) is **authored `blocks.json` → CEM** (`scripts/gen-cem.mjs` projects fields a
  blocks.json entry already carries). So "coordinate with the WE pipeline" means authored-manifest→CEM,
  while "auto-derive from the FUI implementation" means impl→manifest. **These are inverse mechanisms** —
  you cannot do both; that is the fork.
- **Cross-repo coupling + dir≠id.** FUI `check-standards` requires every block's `weSpecPath` to resolve in
  WE's `blocks.json` (69 blocks), and the curated FUI ids (`simple-store`, `handler-expression-parser`,
  `event-behaviors`, `transient-component`) **do not map 1:1** to the `blocks/` family dirs (`stores/`,
  `parsers/`, …, often many blocks per family). So a naive dir-scan can neither produce valid ids nor the
  required WE spec mapping.

**The fork (pick the derivation mechanism):**

- **A — Impl-scan / CEM-from-source (literal "auto-derive from implementation").** Add
  `@custom-elements-manifest/analyzer`, annotate the block classes enough to emit a useful CEM, scan
  `blocks/`, and render from the generated `custom-elements.json`. Fixes coverage by construction (every
  exported element appears). Cost: a new analyzer toolchain + a per-class annotation pass + a separate
  id→WE-spec + summary source the analyzer can't produce — and it **forks a parallel mechanism** from WE's
  authored→CEM pipeline (the body warns against exactly this).
- **B — Authored manifest + completeness GATE, reusing WE's #626 CEM direction (recommended).** Keep an
  authored `blocks.json` (the curated metadata: summary/type/protocol/weSpecPath) but add a
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
