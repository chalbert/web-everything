---
kind: decision
size: 5
status: open
dateOpened: "2026-07-18"
preparedDate: "2026-07-18"
tags:
  - design-decision
  - standards
  - ui-primitives
  - plateau-console-board
  - gap-analysis
---

# Decide which console-board-derived primitives become WE standards

Building the plateau console board (#2505 lane board) surfaced seven candidate low-level UI primitives. This decision ratifies, per candidate, whether to **mint** a standard, **extend** an existing one, **park** it, or **keep it app-custom**. The forks are grounded in a prior-art survey published as [/research/console-board-derived-ui-primitives/](/research/console-board-derived-ui-primitives/) (d3-scale, Vega-Lite encodings, native `<progress>`/`<meter>`, Pad++/DeepZoom, Gantt datum lines), each carrying a **bold** default — now **re-ruled under the corrected bar below**, so the defaults you see are the merit re-review, not the superseded prep.

**Grounding digest.** The board's card cell, badge, verb, and progress bar already dogfood ratified FUI blocks (`we-section-card`/`we-badge`/`we-button`/`we-progress`); the curved dependency connectors are already the ratified **Web Graph** standard (`@webeverything/contracts/graph` = `we:contracts/graph.ts`, #1289/#1352 — only the DOM-anchored board overlay #1289 remains, and that is *integration*, not a new standard). Each fork below is measured against the **exact** existing standard that already owns its turf, cited as a `we:` locus ref.

**Corrected bar (supersedes the prep's through-line).** The prep concluded ~~mint nothing on one board's evidence~~ → **corrected**: **prior-art research establishing a fundamental, recurring, web-platform-aligned pattern is sufficient to justify a standard.** The prep's ~~"WE's bar for minting is a second consumer beyond this board"~~ → **corrected**: **"no second in-house consumer yet" is NOT a valid rejection reason.** A standard exists to be reused across independent parties, and that reuse case is established by *prior art* — native primitives, d3/Vega grammar, coined-and-studied algorithms — not by waiting for a second in-house board to appear. Every fork default below is re-ruled on this bar; the old second-consumer defaults are struck and replaced. Two forks (4, 6) still resolve to "not a standard," but on **merit** (clean decomposition / no fundamental contract), never on the struck second-consumer reason.

### Triage context

- **Kind**: Intent(s) and/or a small visual-encoding primitive · **Native grounding**: `<progress>`/`<meter>`, CSS Grid, SVG, `backdrop-filter`, scroll-driven-animations
- **Native-first**: ▽ mostly thin extensions of native primitives · **Gap**: ◆ real residues confirmed by prior art (not "collapsed to zero") · **Effort**: ◆ low–medium · **Source**: board mock v68 + attention-card taxonomy + prior-art survey

### Axis-framing — each fork's standard-of-record

Each candidate is classified against the one existing standard that already owns its turf, pinned to a `we:` locus ref (verified to exist):

- **Fork 1 · scale-ruler** — measured against `we:src/_data/projects/webcharts.json` (Web Charts, #105 — Vega-Lite L1 `size`/positional encodings) and native `<progress>`/`aspect-ratio`. Under the corrected bar the scale is the *foundational layer Web Charts composes*, so it extracts as its own primitive.
- **Fork 2 · progress multi-track** — measured against `we:src/_data/intents/progress.json` (thin, #1469; names `loader.progress`/`flow-progress` as *consumers that compose it*), `we:src/_data/intents/flow-progress.json` (already has a `board` register value), `we:src/_data/intents/meter.json`, and `we:docs/agent/platform-decisions.md#readout-placement-by-value-type` (presentation is a dimension, not a home; re-typing forbidden).
- **Fork 3 · semantic-zoom / LOD** — measured against `we:src/_data/intents/viewport-transform.json` (geometric pan/zoom, disclaims representation), `we:src/_data/intents/hierarchy.json` (tree traversal), and `we:src/_data/intents/density.json`.
- **Fork 4 · threshold-region overlay** — measured against Fork 1's axis and `we:src/_data/intents/meter.json` (a single scalar-bar tick).
- **Fork 5 · annotated visual-diff surface** — measured against `we:src/_data/intents/audit-timeline.json` (a text/event feed).
- **Fork 6 · simulation / dry-run mode** — measured against `we:src/_data/intents/experiment.json` (declarative variant *assignment*, not write-suppression).
- **Fork 7 · swimlane / span-layout** — measured against `we:contracts/graph.ts` (Web Graph) + CSS Grid.

### Recommended path at a glance

Ratify the column, or override just the forks you'd change. **Confidence** shows where judgment is actually needed. The final column is the **corrected bar**: *is this a fundamental, recurring, web-platform-aligned pattern?* — answered from prior art, NOT from "is there a second in-house consumer?" (that question is struck). Five candidates clear the bar (mint/extend); two are still "not a standard," but on merit.

| Fork | Corrected default | Main alternative (override) | Recurring web-platform pattern? (the corrected bar) | Confidence |
|---|---|---|---|---|
| **Fork 1 · scale-ruler** | ✓ **owner call: MINT** a `scale-ruler` primitive — the foundational scalar→position/length axis (+ aggregate) that Web Charts composes above | keep app-custom / fold into Web Charts | **yes** — `d3-scale` + design-tool rulers/guides (Photoshop/Figma) | **High** |
| **Fork 2 · progress multi-track** | ✓ **RATIFIED: EXTEND `progress`** with an optional secondary/comparison track (provenance kept OUT of the contract) | compose two readouts + FUI overlay | **yes** — native `<video>` `buffered` vs `currentTime` (media players render dual-track) | **Med-high** |
| **Fork 3 · semantic-zoom / LOD** | ✓ **RATIFIED: MINT** a representational-zoom intent (distinct from geometric `viewport-transform`) | keep app-custom (compose nav + `hierarchy` + `density`) | **yes** — shipped as a named control (MS `SemanticZoom`); Maps LOD; Figma/Miro; Photos Years→Days; Calendar views; Shneiderman's mantra | **Med-high** |
| **Fork 4 · threshold-region overlay** | **NOT a separate standard — fold into Fork 1** (reference-line/tick on the scale + a CSS/FUI mask) | mint a standalone overlay primitive | n/a — a *feature* of Fork 1's scale, not a distinct pattern (merit decomposition) | **High** |
| **Fork 5 · annotated visual-diff surface** | **CANDIDATE — commission the shaping research, then mint** (contract is unshaped, not the pattern) | mint blind now | **yes (pattern)** — Percy/Chromatic/reg-suit *are* this surface; GitHub PR diff; Figma compare — only the contract shape is missing | **Med** |
| **Fork 6 · simulation / dry-run mode** | **HOLD — app/runtime behavior, not a UI primitive** (composition of state + guard + diff) | mint a `sandbox-mode` intent | **no** — a *mode*, no fundamental UI contract even with research (merit hold, survives the correction) | **Med-high** |
| **Fork 7 · swimlane / span-layout** | **MINT as a Web Graph LAYOUT MODE** ("swimlane layout" — a lane-constrained variant on the ratified graph standard) | keep app-custom over CSS Grid + Web Graph | **yes** — BPMN pools/lanes, git-graph lane assignment, subway-map layout (studied algorithm) | **High** |

## Fork 1 — scale-ruler (the shared quantitative axis)

> **Owner call (2026-07-18) — MINT.** Nicolas affirmed the default; grounding strengthened with design-tool rulers/guides (Photoshop · Illustrator · Figma · Sketch · CAD). Held pending the whole-item resolve.

<figure>
<figcaption class="text-sm">A scalar maps to position + length on one shared labeled axis; the stack aggregates to an ETA.</figcaption>
<svg role="img" viewBox="0 0 520 150" width="520" height="150" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;height:auto">
<title>Fork 1 scale-ruler: a vertical labeled time axis with ticks at 0, 30m, 60m and 90m; two cards sit at heights encoding a value, and an aggregate lane ETA of about two hours reads at the bottom.</title>
<line x1="70" y1="15" x2="70" y2="115" stroke="var(--color-border, #cbd0d6)" stroke-width="1.5"/>
<g font-size="10" fill="var(--color-text-muted, #6b7280)" text-anchor="end">
<line x1="66" y1="15" x2="74" y2="15" stroke="var(--color-border, #cbd0d6)"/><text x="60" y="18">90m</text>
<line x1="66" y1="48" x2="74" y2="48" stroke="var(--color-border, #cbd0d6)"/><text x="60" y="51">60m</text>
<line x1="66" y1="82" x2="74" y2="82" stroke="var(--color-border, #cbd0d6)"/><text x="60" y="85">30m</text>
<line x1="66" y1="115" x2="74" y2="115" stroke="var(--color-border, #cbd0d6)"/><text x="60" y="118">0</text>
</g>
<rect x="120" y="48" width="70" height="67" rx="4" fill="var(--color-surface-card, #f6f7f9)" stroke="var(--color-primary, #3b6cff)" stroke-width="1.5"/>
<text x="155" y="86" font-size="10" fill="var(--color-text, #1a1d21)" text-anchor="middle">card A</text>
<rect x="230" y="82" width="70" height="33" rx="4" fill="var(--color-surface-card, #f6f7f9)" stroke="var(--color-primary, #3b6cff)" stroke-width="1.5"/>
<text x="265" y="102" font-size="10" fill="var(--color-text, #1a1d21)" text-anchor="middle">card B</text>
<line x1="120" y1="126" x2="300" y2="126" stroke="var(--color-border, #cbd0d6)" stroke-dasharray="3 3"/>
<text x="120" y="141" font-size="11" fill="var(--color-text, #1a1d21)">&#931; lane ETA &#8776; 2h</text>
<text x="370" y="58" font-size="10" fill="var(--color-text-muted, #6b7280)">height = scalar</text>
<text x="370" y="74" font-size="10" fill="var(--color-text-muted, #6b7280)">position = on axis</text>
<text x="370" y="90" font-size="10" fill="var(--color-text-muted, #6b7280)">stack = aggregate</text>
</svg>
</figure>

**Fork-existence:** genuine either/or — *mint a WE primitive* and *keep it app-custom* cannot coexist (you either add the contract to WE or you don't); under the corrected bar the excluded branch is **"keep app-custom,"** because prior art (d3-scale as a standalone, foundational package) establishes the scale as a recurring web-platform pattern that warrants extraction now.

The board renders two things against one time ruler (`1pt ≈ 9min ≈ 17px`): a card's **height** encodes its size, and its **horizon-crossing** encodes its proven fraction; a lane's stacked heights read as its **ETA**. "Extent/position = a scalar on a shared labeled axis, with an aggregate" is the residue once Web Charts (`we:src/_data/projects/webcharts.json`, #105, Vega-Lite `size` encoding) is subtracted — and that residue is exactly the *scale*, the foundational layer charts sit on top of.

- **(a — recommended) MINT a `scale-ruler` primitive** — `{ scalar, unit, pxPer, cap?, axisRef } → length|position + aggregate`. A foundational scale primitive: map a scalar to a position/length on a labeled axis, and aggregate the stack. Grounding: `d3-scale` is a standalone, foundational package precisely because scales sit BELOW charts (the same scale is reused in layout, animation, and color); Vega-Lite treats encodings as the base grammar. The pattern is **ubiquitous beyond data-viz**: every design/CAD tool — Photoshop, Illustrator, Figma, Sketch, AutoCAD — ships a **ruler** (a persistent labeled axis mapping a scalar document position to screen position in units) with **guides** as reference marks snapped onto it. That the same ruler primitive recurs across charting *and* design tooling is exactly the recurring-web-platform-pattern evidence the corrected bar asks for. "It's Web Charts minus the marks" argues *for* extracting the scale as the foundational layer Web Charts composes — not against a mint. Cite `we:src/_data/projects/webcharts.json`.
- **(b) Keep app-custom now; defer to a Web Charts extension.** ~~*Recommended default (prep)*~~ → **superseded**. The prep leaned on "the three claimed consumers are all features of the same board — one consumer wearing three hats, not the second the mint bar requires." That bar is rejected. Retained only as the override for a decider who wants the scale to live *inside* Web Charts rather than as a standalone primitive.

**Classification (per-fork pass):** Q1 layer = an Intent/encoding primitive (a scale). Q2/reuse = established by prior art (d3-scale is a standalone foundational package; scales sit below charts and are reused across layout/animation/color). Q6 most-permissive default = extract the foundational scale Web Charts composes. No protocol (no swappable-vendor story).
**Skeptic:** REVERSED (platform-owner correction) → app-custom → **MINT**. The "three board features aren't a second consumer" argument is rejected: a scale is a foundational, recurring, web-platform-aligned pattern, and d3-scale being standalone *because scales sit below charts* is the reuse case. "No second in-house consumer yet" is not a rejection reason.
**Screen:** clear — the merit the mint-case always saw (a bare labeled axis + aggregate is Web Charts' `size`/positional encoding minus the marks) is now the reason to mint the scale as the foundational layer, not to defer it.

## Fork 2 — progress multi-track (plan-claimed vs proven)

> **RATIFIED (2026-07-18) — EXTEND `progress`** with an optional generic secondary/comparison track; the app's claimed-vs-verified *provenance* stays out of the contract. Nicolas's call.

<figure>
<figcaption class="text-sm">One track, two overlaid fills: a wider "plan" fill under a narrower "proven" fill (the native buffered-vs-played pattern).</figcaption>
<svg role="img" viewBox="0 0 520 92" width="520" height="92" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;height:auto">
<title>Fork 2 progress multi-track: a single progress track carrying two overlaid fills, a lighter wider planned fill and a darker narrower proven fill.</title>
<rect x="20" y="34" width="420" height="24" rx="12" fill="var(--color-surface-card, #f6f7f9)" stroke="var(--color-border, #cbd0d6)"/>
<rect x="20" y="34" width="300" height="24" rx="12" fill="var(--color-primary, #3b6cff)" opacity="0.32"/>
<rect x="20" y="34" width="175" height="24" rx="12" fill="var(--color-primary, #3b6cff)"/>
<line x1="195" y1="26" x2="195" y2="34" stroke="var(--color-text-muted, #6b7280)"/>
<text x="195" y="22" font-size="10" fill="var(--color-text, #1a1d21)" text-anchor="middle">proven</text>
<line x1="320" y1="58" x2="320" y2="70" stroke="var(--color-text-muted, #6b7280)"/>
<text x="320" y="82" font-size="10" fill="var(--color-text-muted, #6b7280)" text-anchor="middle">plan</text>
<text x="452" y="49" font-size="10" fill="var(--color-text-muted, #6b7280)">one track</text>
</svg>
</figure>

**Fork-existence:** genuine either/or — *extend the `progress` contract* vs *don't* cannot coexist; the excluded branch is **"don't extend,"** flawed because a generic secondary/comparison track is a NATIVE pattern the intent can own — provided the app's provenance semantic is kept out of the contract.

Board cards show **two** fractions: the agent's plan claim and the spec-proven amount. Everything else in the first "progress family" sketch maps to ratified homes — bar = `we:src/_data/intents/progress.json`, gauge = `we:src/_data/intents/meter.json`, checklist ≈ `we:src/_data/intents/flow-progress.json` (which already has a `board` register — a config dimension, "never a fork"), position = Fork 1's ruler. Unifying bar+gauge under one "render dimension" is **illegal** — it re-opens the ratified `progress ≠ meter ≠ status` decision (`we:docs/agent/platform-decisions.md#readout-placement-by-value-type`, #1469/#1410).

- **(a — recommended) EXTEND `progress` with an optional secondary/comparison track.** Dual-track progress is a NATIVE pattern — `<video>`'s `buffered` vs `currentTime`, which every media player renders as a lighter buffered fill under the played fill. **Known occurrences:** the **YouTube / Netflix scrubber** (light-grey buffered under the played bar) is the everyday form; download managers (downloaded vs verified); torrent clients (have vs available); CI dashboards (estimated vs actual). So a generic secondary/comparison track is a *presentation dimension the intent can legitimately own*, and prior art establishes it as recurring and web-aligned. **CAVEAT (state in the contract):** the board's specific "claimed vs verified" is a **data-provenance / trust** distinction — a separate axis. Extend the *generic* secondary track; do **not** bake the app's provenance semantic onto a completion intent. Cite `we:src/_data/intents/progress.json`.
- **(b) Compose two `progress` readouts + FUI overlay presentation.** ~~*Recommended default (prep)*~~ → **superseded**. Defensible (presentation is a dimension), but it pushes a native, recurring dual-track pattern out of the contract that already owns progress presentation; retained as the override.
- **(c) Mint a new "progress-family" intent.** *Rejected* — re-litigates a ratified typing decision; the family already exists as separate intents.

**Classification (per-fork pass):** Q1 = Intent dimension; Q2 no protocol; Q3/Q4 the "second track" is a *presentation* value native to progress (buffered-vs-played), so it is a dimension the intent owns — extend, don't re-type. Provenance is a *seam to another concern* (Q7), kept OUT of the contract.
**Skeptic:** REVERSED → compose → **EXTEND** (generic secondary track). Dual-track progress is native (`buffered` vs `currentTime`); pushing it out to "compose + FUI" under-serves a recurring web pattern. The prep's real catch survives as the caveat: keep "claimed vs verified" (provenance) out of the contract.
**Screen:** clear — the two-track notion stays generic (claimed-vs-proven is the app's *binding*, not a backlog term baked into WE); the surviving judgment (how much presentation belongs in the intent vs FUI) is preserved as the (b) override.

## Fork 3 — semantic-zoom / level-of-detail navigation

> **RATIFIED (2026-07-18) — MINT** a representational-zoom / LOD intent, distinct from geometric `viewport-transform`. Nicolas's call, on the shipped-and-studied prior art below (Microsoft's named `SemanticZoom` control, Maps LOD, Photos Years→Days, Shneiderman's mantra).

<figure>
<figcaption class="text-sm">Three representations of the same item across zoom levels: chip &#8594; card-with-bar &#8594; expanded-with-checklist.</figcaption>
<svg role="img" viewBox="0 0 520 150" width="520" height="150" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;height:auto">
<title>Fork 3 semantic zoom: the same item shown at three levels of detail, a one-line chip, then a card with a progress bar, then an expanded panel with a mini checklist, with zoom cues between them.</title>
<text x="70" y="30" font-size="9" fill="var(--color-text-muted, #6b7280)" text-anchor="middle">L1</text>
<rect x="10" y="62" width="120" height="26" rx="13" fill="var(--color-surface-card, #f6f7f9)" stroke="var(--color-border, #cbd0d6)"/>
<text x="70" y="79" font-size="10" fill="var(--color-text, #1a1d21)" text-anchor="middle">&#9656; pay-off 45%</text>
<text x="150" y="79" font-size="17" fill="var(--color-text-muted, #6b7280)" text-anchor="middle">&#8594;</text>
<text x="245" y="30" font-size="9" fill="var(--color-text-muted, #6b7280)" text-anchor="middle">L2</text>
<rect x="170" y="46" width="150" height="60" rx="6" fill="var(--color-surface-card, #f6f7f9)" stroke="var(--color-border, #cbd0d6)"/>
<text x="182" y="66" font-size="10" fill="var(--color-text, #1a1d21)">Pay-off</text>
<rect x="182" y="78" width="126" height="10" rx="5" fill="var(--color-border, #cbd0d6)"/>
<rect x="182" y="78" width="57" height="10" rx="5" fill="var(--color-primary, #3b6cff)"/>
<text x="342" y="79" font-size="17" fill="var(--color-text-muted, #6b7280)" text-anchor="middle">&#8594;</text>
<text x="435" y="30" font-size="9" fill="var(--color-text-muted, #6b7280)" text-anchor="middle">L3</text>
<rect x="360" y="40" width="150" height="100" rx="6" fill="var(--color-surface-card, #f6f7f9)" stroke="var(--color-border, #cbd0d6)"/>
<text x="372" y="58" font-size="10" fill="var(--color-text, #1a1d21)">Pay-off</text>
<g font-size="9" fill="var(--color-text-muted, #6b7280)">
<rect x="372" y="68" width="9" height="9" rx="2" fill="var(--color-primary, #3b6cff)"/><text x="388" y="76">spec drafted</text>
<rect x="372" y="86" width="9" height="9" rx="2" fill="var(--color-primary, #3b6cff)"/><text x="388" y="94">tests green</text>
<rect x="372" y="104" width="9" height="9" rx="2" fill="none" stroke="var(--color-border, #cbd0d6)"/><text x="388" y="112">deployed</text>
</g>
</svg>
</figure>

**Fork-existence:** genuine either/or — *mint a representational-zoom intent* vs *keep app-custom* cannot coexist; the excluded branch is **"keep app-custom,"** flawed because semantic zoom (each level a different *representation*, not a scaled view) is a coined, studied pattern distinct from geometric zoom, which prior art shows is fundamental and recurring.

The board's L0→L3 (constellation tiles → lane board → gate checklist → build inspector) is a zoom where **each level is a different representation**. `we:src/_data/intents/viewport-transform.json` owns geometric pan/zoom (and explicitly disclaims representation); `we:src/_data/intents/hierarchy.json` owns tree traversal; `we:src/_data/intents/density.json` owns detail-tier.

- **(a — recommended) MINT a representational-zoom (semantic-zoom / LOD) intent**, distinct from geometric `viewport-transform`. Representational LOD is a fundamental, recurring, *studied and shipped* pattern — its home is a new intent, not a geometric-zoom extension (that conflates the two) and not app navigation policy. Cite `we:src/_data/intents/viewport-transform.json`, `we:src/_data/intents/density.json`.

  **Prior art across shipping apps** (the corrected-bar evidence — many independent parties, not one board):
  - **A platform vendor already shipped it as a *named UI primitive*:** Microsoft's **`SemanticZoom`** control (Windows 8.1 / UWP) — pinch-out shows *grouped* headers, pinch-in shows individual items; two DIFFERENT views of one data source, swapped by a zoom gesture. This alone is dispositive: the pattern was named and standardized as a control.
  - **Maps** (Google/Apple Maps, Google Earth): zoom *changes representation* — country labels → cities → street names → building footprints → indoor floor plans — not just scale (LOD tiles).
  - **Infinite-canvas apps** (Figma, Miro, FigJam, Prezi): objects render by zoom level — text is "greeked"/placeholdered when far, full detail when near; components collapse to thumbnails.
  - **Photo libraries** (Apple Photos, Google Photos): the same library as **Years → Months → Days → All** — four distinct representations picked by a zoom level, not four scalings.
  - **Calendar** (Day / Week / Month / Year): different representations of the same time data along a zoom axis.
  - **Code editors**: the VS Code **minimap** + code folding — a zoomed-out symbolic view beside the detail view.
  - **The HCI principle it instantiates:** Shneiderman's *Visual Information-Seeking Mantra* — "**overview first, zoom and filter, then details-on-demand**" (1996) — and Bederson & Hollan's **Pad++** semantic zooming (UIST '94, which coined the term). A named, studied pattern, genuinely distinct from geometric zoom.
- **(b) Keep app-custom — compose navigation + `hierarchy` + `density`.** ~~*Recommended default (prep)*~~ → **superseded**. The prep held the mint only for want of a second, non-board consumer — a struck reason. Retained as the override for a decider who reads representational LOD as fully covered by drill-down routing + density rendering.
- **(c) Extend `viewport-transform`.** *Rejected* — conflates geometric zoom with representational swap.

**Classification (per-fork pass):** Q1 = a candidate Intent; representational LOD is genuinely distinct from geometric zoom (prior art: Pad++/DeepZoom/map LOD/minimaps) → mint. Not a `viewport-transform` extension (that is geometric). The level axis is the intent's own dimension.
**Skeptic:** REVERSED → app-custom → **MINT**. "Each level a different page = routing + density" understated a coined, studied pattern; the absence of an in-house second consumer was the only thing holding the mint, and that reason is struck.
**Screen:** clear — representational LOD *is* genuinely distinct from geometric zoom (the prep already conceded this as the real taxonomy call); the correction promotes that concession from "override" to the default.

## Fork 4 — threshold-region overlay (the horizon mask)

<figure>
<figcaption class="text-sm">A datum line on the shared scale, with the region above it desaturated as "past" &#8212; a tick (Fork 1) plus a CSS mask, not a standard.</figcaption>
<svg role="img" viewBox="0 0 520 140" width="520" height="140" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;height:auto">
<title>Fork 4 threshold region: a single column with a dashed horizontal datum line labelled delivery horizon; the region above the line is greyed out as the past.</title>
<rect x="50" y="15" width="130" height="110" rx="4" fill="var(--color-surface-card, #f6f7f9)" stroke="var(--color-border, #cbd0d6)"/>
<rect x="50" y="15" width="130" height="40" rx="4" fill="var(--color-text-muted, #6b7280)" opacity="0.22"/>
<text x="115" y="40" font-size="9" fill="var(--color-text-muted, #6b7280)" text-anchor="middle">past (desaturated)</text>
<line x1="40" y1="55" x2="480" y2="55" stroke="var(--color-text, #1a1d21)" stroke-width="1.3" stroke-dasharray="5 4"/>
<text x="200" y="51" font-size="10" fill="var(--color-text, #1a1d21)">delivery horizon</text>
<rect x="70" y="70" width="90" height="16" rx="3" fill="var(--color-primary, #3b6cff)" opacity="0.8"/>
<rect x="70" y="94" width="60" height="16" rx="3" fill="var(--color-primary, #3b6cff)" opacity="0.8"/>
<text x="200" y="86" font-size="10" fill="var(--color-text-muted, #6b7280)">= a tick on the scale (Fork 1)</text>
<text x="200" y="102" font-size="10" fill="var(--color-text-muted, #6b7280)">+ a CSS mask (FUI presentation)</text>
</svg>
</figure>

**Fork-existence:** genuine either/or — *a separate threshold-region standard* vs *a feature of Fork 1's scale* cannot coexist; the excluded branch is **"separate standard,"** flawed on **merit** (not demand): it decomposes cleanly into a Fork-1 tick + a CSS mask, so nothing separable remains to mint.

The board draws **one dashed datum line across all columns** and a `backdrop-filter: grayscale` mask that renders the "past" side as history. `we:src/_data/intents/meter.json` only owns a single scalar-bar tick.

- **(a — recommended) NOT a separate standard — fold into Fork 1.** The datum line **is a reference-line/tick on Fork 1's scale** (a reference value on the shared axis — exactly what `d3-axis` reference rules and Vega's `rule` mark draw). The "past" desaturation is a **CSS/FUI presentation** mask (`backdrop-filter`), not a WE contract. This is an honest decomposition: every separable part already belongs to Fork 1's scale or to FUI. Fold the "mark this region as past/crossed-threshold" semantic into Fork 1 as a reference-line feature. (This mirrors design tools exactly: a **guide** in Photoshop/Figma is a draggable reference line that belongs to the **ruler**, not a separate tool — so the datum/horizon line is Fork 1's guide, which is *why* it folds in rather than minting on its own.)

  **Known occurrences** (all reference lines on an axis — none a standalone primitive): the Gantt **"today" line**, a burndown **target line**, a kanban **WIP-limit line**, stock-chart **support/resistance lines**, a video-editor **playhead**, spreadsheet **freeze-pane** dividers. Every one is a marked value on an existing scale + a region treatment — exactly what folds into Fork 1's ruler.
- **(b) Mint a standalone `threshold-region` primitive.** *Rejected on merit* — bundles a Fork-1 axis tick with a CSS treatment (FUI's turf); nothing separable remains. Note: this rejection stands **independent of the corrected bar** — it is not "no second consumer," it is "decomposes into things that already have owners."

**Classification (per-fork pass):** Q1 = the datum is encoding (Fork 1's scale), the mask is presentation (FUI). Not a distinct layer of its own. Q7 seam: the "past/crossed" semantic sits on the axis, gated to a threshold value.
**Skeptic:** HOLD-as-not-separate (merit; survives the correction) → **NOT a standalone standard**. The datum line is a reference tick on Fork 1's scale and the grayscale-past is pure CSS. This never depended on the second-consumer bar — it is a clean decomposition, so the corrected principle doesn't move it.
**Screen:** flagged(impl) → fixed. The desaturation *mask* was an impl (visual-treatment) leak onto the WE side — ceded to FUI; only the semantic "past/crossed-threshold" marking is WE-shaped, and it rides Fork 1's scale as a reference-line feature rather than minting a primitive.

## Fork 5 — annotated visual-diff surface

<figure>
<figcaption class="text-sm">Two panes, design vs built, with one region outlined as a numbered typed delta &#8212; a real pattern whose contract is still unshaped.</figcaption>
<svg role="img" viewBox="0 0 520 140" width="520" height="140" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;height:auto">
<title>Fork 5 annotated visual diff: two side-by-side panes labelled design and built, with one region in the built pane outlined as a delta and tagged with a numbered marker.</title>
<text x="125" y="22" font-size="10" fill="var(--color-text-muted, #6b7280)" text-anchor="middle">design</text>
<rect x="30" y="28" width="190" height="95" rx="6" fill="var(--color-surface-card, #f6f7f9)" stroke="var(--color-border, #cbd0d6)"/>
<rect x="46" y="44" width="120" height="12" rx="3" fill="var(--color-border, #cbd0d6)"/>
<rect x="46" y="64" width="158" height="40" rx="4" fill="var(--color-border, #cbd0d6)" opacity="0.5"/>
<text x="365" y="22" font-size="10" fill="var(--color-text-muted, #6b7280)" text-anchor="middle">built</text>
<rect x="270" y="28" width="190" height="95" rx="6" fill="var(--color-surface-card, #f6f7f9)" stroke="var(--color-border, #cbd0d6)"/>
<rect x="286" y="44" width="120" height="12" rx="3" fill="var(--color-border, #cbd0d6)"/>
<rect x="286" y="64" width="158" height="40" rx="4" fill="var(--color-primary, #3b6cff)" stroke="var(--color-primary, #3b6cff)" stroke-dasharray="4 3" stroke-width="1.5" opacity="0.35"/>
<rect x="286" y="64" width="158" height="40" rx="4" fill="none" stroke="var(--color-primary, #3b6cff)" stroke-dasharray="4 3" stroke-width="1.5"/>
<circle cx="286" cy="64" r="9" fill="var(--color-primary, #3b6cff)"/>
<text x="286" y="68" font-size="10" fill="var(--color-surface-card, #ffffff)" text-anchor="middle">1</text>
</svg>
</figure>

**Fork-existence:** genuine either/or — *mint now* vs *shape-then-mint* cannot coexist; the excluded branch is **"mint now (blind),"** flawed because the pattern warrants a standard but the *contract* (delta-type taxonomy, anchor payload, accept model) is genuinely unshaped, so the honest path is to commission shaping research first.

The L3 inspector's "design → built" two-pane compare with numbered, clickable, **typed** delta regions (real drift vs "expected, not reached yet"). No standard owns side-by-side visual comparison (`we:src/_data/intents/audit-timeline.json` is a text feed).

- **(a — recommended) CANDIDATE — commission the shaping research, then mint.** Before/after annotated diff is a real, recurring pattern. The pattern *justifies* a standard under the corrected bar; what is missing is the **contract shape** — the delta-type taxonomy, the anchor payload, the accept/typed-region model. So the corrected action is to commission the shaping research (a `/research/` topic) and **then mint** — NOT reject, and NOT "wait for a second in-house diff surface." Cite `we:src/_data/intents/audit-timeline.json`.

  **Known occurrences** (the pattern is everywhere — which is why it's a candidate, not a park): **visual-regression tools — Percy, Chromatic, reg-suit, Playwright/Storybook snapshot review — are *literally* annotated visual-diff surfaces** (baseline vs new, highlighted/accept-per-region — the exact "design vs built, typed deltas" shape); GitHub/GitLab **PR diff** (side-by-side + inline, per-hunk accept); **Figma / Abstract** version-compare & inspect; image-diff tools (Kaleidoscope, Beyond Compare); PDF compare (Acrobat). The *shape* recurs across all of them — only a single ratified contract (delta types + anchors + accept model) is missing, and that's the research to commission.
- **(b) Mint an intent now (blind).** *Rejected as premature* — the pattern is real but the contract is unshaped; ratifying a shape nobody has designed bakes in guesses. Shape first.
- **(c) Reject / park for cost.** *Rejected* — the pattern is established prior art; cost/demand are forbidden fork reasons and the corrected bar removes the "no second consumer" excuse.

**Classification (per-fork pass):** Q1 = a candidate Intent whose contract is under-specified (Contract-first: don't narrow it to force a verdict) → shape via research, then mint. No protocol.
**Skeptic:** CORRECTED → not "reject/park", but **CANDIDATE → commission shaping research → mint**. The prep already saw "no second consumer" was prioritization in a fork's clothes; the correction goes further — the pattern is real prior art, so the only open work is shaping the contract, not justifying the standard.
**Screen:** flagged(prio) → fixed. "No second consumer yet" was prioritization; re-ruled — the merit-honest verdict is that the pattern is established and the *contract* is what's unshaped, so the action is research-then-mint, not a park.

## Fork 6 — simulation / dry-run surface mode

<figure>
<figcaption class="text-sm">A whole-surface "no writes" mode &#8212; composed from state + guard + diff, not a UI primitive.</figcaption>
<svg role="img" viewBox="0 0 520 122" width="520" height="122" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;height:auto">
<title>Fork 6 dry-run mode: a surface with a simulation, no-writes banner across the top and two greyed-out inert buttons below it.</title>
<rect x="70" y="15" width="380" height="95" rx="6" fill="var(--color-surface-card, #f6f7f9)" stroke="var(--color-border, #cbd0d6)"/>
<rect x="70" y="15" width="380" height="26" rx="6" fill="var(--warn-text, #b47a00)" opacity="0.2"/>
<rect x="70" y="30" width="380" height="11" fill="var(--warn-text, #b47a00)" opacity="0.2"/>
<text x="260" y="32" font-size="11" fill="var(--warn-text, #b47a00)" text-anchor="middle" font-weight="bold">SIMULATION &#183; no writes</text>
<rect x="94" y="62" width="90" height="28" rx="5" fill="var(--color-text-muted, #6b7280)" opacity="0.25" stroke="var(--color-border, #cbd0d6)"/>
<text x="139" y="80" font-size="10" fill="var(--color-text-muted, #6b7280)" text-anchor="middle">Save</text>
<rect x="200" y="62" width="90" height="28" rx="5" fill="var(--color-text-muted, #6b7280)" opacity="0.25" stroke="var(--color-border, #cbd0d6)"/>
<text x="245" y="80" font-size="10" fill="var(--color-text-muted, #6b7280)" text-anchor="middle">Apply</text>
<text x="316" y="80" font-size="10" fill="var(--color-text-muted, #6b7280)">(inert)</text>
</svg>
</figure>

**Fork-existence:** genuine either/or — *mint a `sandbox-mode` intent* vs *hold (keep app-custom)* cannot coexist; the excluded branch is **"mint,"** flawed because a whole-surface no-writes *mode* is composition (state + guard + diff), with no fundamental UI *contract* even under the corrected bar.

A whole-surface mode that freezes live data, disables writes, and diffs on exit ("no writes" banner, inert verbs). `we:src/_data/intents/experiment.json` owns declarative variant *assignment* (who sees what) — a different thing from write-suppression.

- **(a — recommended) HOLD — app/runtime behavior, not a UI primitive.** A whole-surface "safe preview / no-writes" *mode* is composed from pieces that already exist: a provisional/uncommitted **state** flag + a write **guard** + a **diff** on exit. Even *with* prior-art research there is no fundamental UI *contract* to ratify here — only composition of standards. This hold **survives the corrected principle**: it is a **merit** hold (nothing to mint), not a struck second-consumer/demand hold. The only WE-shaped residue is the provisional-state data-semantic, which rides Fork 2's provenance seam, not a mode. Cite `we:src/_data/intents/experiment.json`.

  **Known occurrences — and why they *confirm* the hold:** dry-run is genuinely ubiquitous — `terraform plan`, `kubectl --dry-run`, `git commit --dry-run`, `rsync -n`, `apt -s`, DB `BEGIN … ROLLBACK`, spreadsheet what-if / scenario manager. But look at the list: they are **CLI verbs and runtime behaviors**, not UI *primitives*. The recurrence proves dry-run is a real *behavior pattern* — not that there's a low-level UI contract to mint. So the references sharpen, rather than flip, the hold: it's composition (state + guard + diff), best captured as an app pattern, not a WE UI standard.
- **(b) Mint a `sandbox-mode` intent.** *Rejected* — a mode is runtime behavior, not a declarative UX contract; WE holds zero impl, so there is no definitions-layer artifact to hold.

**Classification (per-fork pass):** Q1 = neither Block/Intent/Protocol/Capability on the WE side — it is impl (a runtime mode composed from state + guard + diff). The `experiment` seam is adjacent but distinct (assignment ≠ write-suppression).
**Skeptic:** HOLD (survives the corrected principle) → **keep app-custom**. A whole-surface freeze-writes mode is a running behavior = impl-not-a-standard; it does not become a primitive under the corrected bar, because the bar mints *fundamental contracts*, and here there is only composition. Distinct from Forks 1/3/7, which are genuine contracts.
**Screen:** flagged(impl) → fixed. The dry-run *mode* is runtime behavior (impl/FUI); the verdict holds as keep-app-custom, and the only WE-worthy residue is named as a provisional-state data-semantic (Fork 2's provenance axis), not a mode.

## Fork 7 — swimlane / span-layout

<figure>
<figcaption class="text-sm">Lanes as columns; the middle lane forks into two sub-columns that re-join at a fan-in node &#8212; lane assignment + fork/fan-in.</figcaption>
<svg role="img" viewBox="0 0 520 150" width="520" height="150" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;height:auto">
<title>Fork 7 swimlane layout: three lane columns, where the middle lane forks into two sub-columns that re-join at a fan-in node below via dashed connectors.</title>
<rect x="15" y="15" width="145" height="125" rx="5" fill="var(--color-surface-card, #f6f7f9)" stroke="var(--color-border, #cbd0d6)"/>
<rect x="177" y="15" width="166" height="125" rx="5" fill="var(--color-surface-card, #f6f7f9)" stroke="var(--color-primary, #3b6cff)" stroke-dasharray="3 3"/>
<rect x="360" y="15" width="145" height="125" rx="5" fill="var(--color-surface-card, #f6f7f9)" stroke="var(--color-border, #cbd0d6)"/>
<g font-size="9" fill="var(--color-text-muted, #6b7280)" text-anchor="middle">
<text x="87" y="30">lane A</text><text x="260" y="30">lane B (fork)</text><text x="432" y="30">lane C</text>
</g>
<circle cx="87" cy="70" r="9" fill="var(--color-primary, #3b6cff)"/>
<circle cx="432" cy="70" r="9" fill="var(--color-primary, #3b6cff)"/>
<circle cx="260" cy="52" r="8" fill="var(--color-primary, #3b6cff)"/>
<line x1="253" y1="58" x2="222" y2="80" stroke="var(--color-text-muted, #6b7280)"/>
<line x1="267" y1="58" x2="298" y2="80" stroke="var(--color-text-muted, #6b7280)"/>
<circle cx="217" cy="86" r="8" fill="var(--color-primary, #3b6cff)" opacity="0.8"/>
<circle cx="303" cy="86" r="8" fill="var(--color-primary, #3b6cff)" opacity="0.8"/>
<line x1="217" y1="94" x2="255" y2="116" stroke="var(--color-text-muted, #6b7280)" stroke-dasharray="4 3"/>
<line x1="303" y1="94" x2="265" y2="116" stroke="var(--color-text-muted, #6b7280)" stroke-dasharray="4 3"/>
<circle cx="260" cy="122" r="9" fill="none" stroke="var(--color-primary, #3b6cff)" stroke-width="1.5"/>
<text x="260" y="125" font-size="8" fill="var(--color-text, #1a1d21)" text-anchor="middle">&#8916;</text>
<text x="330" y="122" font-size="9" fill="var(--color-text-muted, #6b7280)">fan-in</text>
</svg>
</figure>

**Fork-existence:** genuine either/or — *mint a swimlane layout mode on Web Graph* vs *keep app-custom* cannot coexist; the excluded branch is **"keep app-custom,"** flawed because lane-assignment + fork/rejoin is a studied algorithm (BPMN pools/lanes, git-graph lane assignment, subway-map layout) — a genuine residue beyond CSS Grid AND beyond general layered-DAG layout.

Lanes-as-columns, forkable sub-columns re-joining at a fan-in, multi-lane span docking. Subtract what exists — contiguous lanes+spans = CSS Grid `grid-column`, fork/fan-in/cross-lane wires = **Web Graph** (`we:contracts/graph.ts`, already standard) — and what remains is a **lane-constrained layout**: the assignment of nodes to lanes and the fork/rejoin routing that honors them.

- **(a — recommended) MINT as a Web Graph LAYOUT MODE ("swimlane layout").** Lane-assignment + fork/rejoin is a studied, recurring layout algorithm: BPMN pools/lanes, git-graph lane assignment, subway-map (metro) layout. That is a genuine residue **beyond CSS Grid** (which can't route fork/fan-in wires) **and beyond general layered-DAG layout** (which has no lane constraint). It belongs as a **layout variant on the ratified Web Graph standard** (`we:contracts/graph.ts`, which already owns nodes/edges/fork/fan-in) — a `swimlane` layout mode with a `lane`/`track` constraint — not app-custom choreography and not a new sibling intent. Cite `we:contracts/graph.ts`.

  **Known occurrences** (lane-constrained layout is named and everywhere): **BPMN literally names them "swimlanes"** (pools/lanes); git commit graphs (GitKraken, `git log --graph`, GitHub network) assign branches to lanes; kanban swimlanes (Jira, Trello, Azure Boards); subway/metro-map line layout; DAW track lanes (Ableton, Logic); UML sequence-diagram lifelines. A studied lane-assignment algorithm, not app choreography — which is why it's a Web Graph *layout mode*.
- **(b) Keep app-custom over CSS Grid + Web Graph.** ~~*Recommended default (prep)*~~ → **superseded**. The prep named the lane-docking residue as a *future* Web Graph extension "when a second consumer appears" — a struck deferral. Retained as the override for a decider who reads the lane-assignment residue as too thin to standardize yet.
- **(c) Mint a standalone swimlane intent.** *Rejected* — it belongs *on* Web Graph (which already owns the fork/fan-in topology), not as a sibling that re-derives graph layout.

**Classification (per-fork pass):** Q1 = a layout mode on Web Graph (nodes/edges + a lane constraint), not a new sibling intent. The lane-assignment/docking residue is a *layout constraint* on the existing graph standard (separate-and-decouple: extend the owner). Mint as a graph layout variant.
**Skeptic:** REVERSED-to-MINT (as a layout mode) → **MINT a "swimlane layout" on Web Graph**. The prep's "name it as a future extension" deferred on the struck second-consumer bar; lane assignment + fork/fan-in is a studied algorithm (BPMN/git-graph/subway), a real residue beyond Grid and general DAG layout, so it graduates now — onto the standard that already owns the topology.
**Screen:** clear — this is a composability *residue* (lanes decompose into Grid + Web Graph, but the lane-assignment/fork-routing is neither's), so the mint lands *on* Web Graph as a layout mode rather than as a fresh sibling standard.

## Context

### Out of scope — capture, don't mint (partial gaps; an adjacent standard exists)

Flagged from the mock-mining, each is a capability a nearby standard *almost* owns; note them, don't decide here (this decision's scope is the seven forks, not a fresh mint pass over these): **data-liveness/freshness** indicator (beyond `reliability`/`query` stale semantics) · **receding-history / fade-scrollback** region (beyond `audit-timeline`'s flat feed) · **overflow-collapse-to-rail** (priority-plus columns → strips, beyond `sidebar`/`reel`) · **adaptive-detail-tier per item** (LOD orthogonal to status, beyond `density`+`disclosure`) · **collaborative claim / presence-lock** (beyond single-writer `mutation`) · **roving focus over a computed attention set** (beyond ARIA roving-tabindex). Any of these can open its own prepared decision under the corrected bar.

### Named residues (re-ruled under the corrected bar)

~~The three things worth *not* losing, each parked against its owning standard with a concrete trigger (mint when a 2nd consumer appears).~~ → **superseded**: the corrected bar re-rules them now, not "on a second consumer":
- (1) the **bare labeled-axis-without-marks** (Fork 1) → **minted** as the `scale-ruler` primitive Web Charts composes.
- (2) the **lane-assignment / docking** residue (Fork 7) → **minted** as a Web Graph `swimlane` layout mode.
- (3) the **provenance / uncommitted-state data-semantic** (claimed-vs-verified, Fork 2; provisional-state, Fork 6) → held as a *seam*: kept OUT of `progress`'s contract (Fork 2 caveat) and named as the only WE-shaped residue of Fork 6's held mode — a candidate provenance/audit intent, not a second track on completion.

## Progress

Prepared 2026-07-18 from the board build (#2505). Prep pass: a prior-art survey published as [/research/console-board-derived-ui-primitives/](/research/console-board-derived-ui-primitives/), a per-fork classification grounded on `we:` locus refs, a skeptic sub-agent, and a fresh-context screen.

**Merit re-review — 2026-07-18.** The prep's through-line — *mint nothing on one board's evidence*, gated on a *second-consumer-beyond-this-board* bar — was **rejected by the platform owner**. Corrected bar recorded across the whole item: **prior-art research establishing a fundamental, recurring, web-platform-aligned pattern is sufficient to justify a standard; "no second in-house consumer yet" is not a valid rejection reason.** Per-fork re-rulings under the corrected bar: **F1 → MINT** a `scale-ruler` primitive (the foundational scale Web Charts composes; d3-scale is standalone for exactly this reason); **F2 → EXTEND `progress`** with a generic optional secondary/comparison track (native buffered-vs-played), keeping the app's provenance semantic OUT of the contract; **F3 → MINT** a representational-zoom/LOD intent, distinct from geometric `viewport-transform` (Pad++/DeepZoom/map LOD/minimaps); **F4 → NOT a separate standard**, folded into F1 as a reference-line/tick + a CSS/FUI mask (merit decomposition, survives the correction); **F5 → CANDIDATE**, commission the shaping research then mint (the pattern is real; only the contract is unshaped — not a reject/park); **F6 → HOLD** (app/runtime mode composed from state+guard+diff — a merit hold that survives the correction, no fundamental contract); **F7 → MINT** as a Web Graph `swimlane` layout mode (lane assignment + fork/fan-in is a studied algorithm — BPMN/git-graph/subway). Added an inline, theme-aware SVG illustration under each of the seven forks (site CSS custom props, `role="img"` + `<title>`, well-formed/closed). `status` stays **open** and `preparedDate` unchanged — this is a merit re-ruling of an open prepared decision, still awaiting ratification. Override any fork.
