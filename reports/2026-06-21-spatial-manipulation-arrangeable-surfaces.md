# Spatial manipulation / arrangeable surfaces — prep survey

> Prepares decision [#1384](/backlog/1384-spatial-manipulation-arrangeable-surfaces-resizable-splitter/)
> (under epic [#099](/backlog/099-evergreen-app-vision/)). Prior-art survey of the incumbent
> JS libraries + a native-substrate Baseline check, so the eventual `/decision` turn ratifies rather
> than researches. Published as the `/research/spatial-manipulation-arrangeable-surfaces/` topic.

## The gap (2026-06-21 sweep)

WE has **no standard for user-driven spatial manipulation** — grabbing an edge to resize a pane,
snapping elements to a grid / alignment points, or dragging widgets around a 2-D dashboard. The adjacent
pieces exist (`reorder` intent + `Reorderable List` block do 1-D list reorder; `layout` names a `pane` as
a "resizable subdivision" but ships no divider; `Carousel` uses `scroll-snap` for paging) but none covers
"grab an edge and resize" or "drag widgets around a grid."

## Method

Two parallel surveys: (1) the leading JS libraries for each capability area, verified against npm + raw
READMEs/docs; (2) the native web-platform substrate with current Baseline status, verified against
MDN / caniuse / WHATWG / W3C WAI-ARIA APG.

## Finding 1 — there is no single "spatial manipulation"; there are **three irreducible layout models**

Every incumbent is some subset of three structurally distinct models, each with its own state shape and
mechanics. They are **not interchangeable** and do not unify into one contract:

| Model | What it is | State shape | Mechanics | Lead libraries |
|---|---|---|---|---|
| **Linear split** | 1-D draggable divider between two panes, recursable | a divider position (% / px), or a small split-tree | resize only; resizing one pane reflows its sibling; no collision | Split.js, **react-resizable-panels**, allotment, react-split-pane |
| **Flat 2-D grid** | independent widgets on one shared N-column plane | **flat list** `Array<{i,x,y,w,h}>` (clean JSON) | drag **+** resize **+** collision/compaction (`vertical`/`horizontal`/`none`/`allow-overlap`) | **react-grid-layout**, **gridstack**, Muuri (no resize, dead) |
| **Recursive partition tree** | nested rows/cols/tab-stacks, space fully partitioned | a **recursive tree** (`row → column → stack-of-tabs`) | re-tile + shared splitters; popout to OS window; never overlaps/gaps | golden-layout, **dockview**, FlexLayout, rc-dock |

A split-tree cannot leave a gap or hold free-floating tiles; a flat grid cannot express a tab-stack nested
two splits deep that resizes its sibling. **Inside each model, drag + resize + collision + serialization
cluster tightly** — they are facets of one layout engine, not independent features.

## Finding 2 — "snap" is **two different things**, and only one of them stands alone

The single most load-bearing finding for the decomposition:

- **Grid-snap is emergent, not a feature.** In gridstack and react-grid-layout there is *no snap knob* —
  positions are expressed in cell/column units, so landing on a boundary is just a consequence of the
  coordinate system. It is a **property of the grid**, with zero awareness of peer-element edges and no
  guide lines.
- **Magnetic alignment (Figma smart guides) is a standalone capability.** Peer-element reference frame,
  rendered guide lines, a snap threshold — attaches to *any* free drag, **needs no grid** (moveable's
  `Snappable`, interactjs `snap` modifier). "Having grid cells gives you no Figma guides; having Figma
  guides needs no grid."

So snap does not fold into one intent: grid-snap belongs to the 2-D-grid model as a dimension; magnetic
alignment is its own standalone concern. `scroll-snap` (Carousel's substrate) is a **third, unrelated**
thing — it snaps *scrolling/paging*, not free placement, and is a distractor here.

## Finding 3 — keyboard / ARIA is the web's most conspicuous unmet need; almost no incumbent has it

Across **all four** capability areas, keyboard + ARIA support is "afterthought-to-absent." The lone
exceptions are react-resizable-panels (a verified `role="separator"` + arrow/Home/End) and react-split-pane
v3 (claims parity). react-grid-layout (#936: handles not focusable), gridstack, Muuri, golden-layout,
dockview, FlexLayout, rc-dock all ship **zero** keyboard/ARIA for the manipulation. The web platform's
missing primitive is felt most as a **missing accessibility contract** — exactly where a standards-led
design has the highest leverage, and exactly the parity `reorder` already mandates.

## Finding 4 — native-substrate Baseline check: gesture layer is native, interaction semantics are not

| Primitive | Role | Baseline status |
|---|---|---|
| **Pointer Events** + `setPointerCapture` | the drag substrate for *all* three models | **Baseline widely available** — the correct foundation (never HTML DnD) |
| **`ResizeObserver`** | size read-back (observes, does not resize) | **Baseline widely available** |
| **CSS Grid** (+ subgrid) | the snap **target** / coordinate model a dashboard quantizes to | **Baseline widely available** |
| **CSS `resize`** | single-box corner self-resize | **Limited / not Baseline** — overflow-gated, corner-only, no sibling reflow, no events → *not* a splitter |
| **CSS `scroll-snap`** | snaps *scrolling/paging*, not free placement | Baseline, but **wrong tool** (distractor) |
| **`Element.moveBefore()`** | state-preserving widget move (keeps focus/anim/iframe) | **Limited (no Safari late-2025)** → progressive enhancement, `insertBefore` fallback |
| **CSS Anchor Positioning** | tether/align floating handle/menu | Limited → just reaching newly-available; behind `@supports` |
| **HTML Drag and Drop API** | — | Baseline but an **a11y/control dead-end** (no keyboard, weak touch, breaks selection) — **disqualified** |
| **ARIA APG Window Splitter** | `role="separator"` + `aria-valuenow/min/max` + arrows/Home/End | spec contract (not a feature) — the a11y contract a resize intent mandates |
| **ARIA APG Grid pattern** | `role="grid"`/`gridcell` 2-D arrow-key traversal | spec contract — the a11y contract a 2-D arrange intent mandates |
| **Native splitter / dashboard element** | — | **Does not exist; no Open UI / CSSWG proposal in flight** (confirmed gap) |

**Bottom line:** the *gesture / observation / layout / alignment* layers are native and mostly Baseline
(Pointer Events, ResizeObserver, Grid, scroll-snap). The *interaction semantics* — splitter resize,
snap-to-cell dragging, dashboard arrangement, and their accessible keyboard equivalents — have **no native
primitive and no proposal in flight**. That interaction layer is exactly where WE standardizes an
intent/behavior, mandating conformance to the ARIA APG Window-Splitter and Grid patterns on the Baseline
Pointer Events substrate.

## How the survey reshaped the forks

The five sketched concerns in the item collapse, after the standing test, to **two forced ratifies** +
**four genuine forks**:

- **Forced ratify — placement layer.** Intent(s) + composing block(s); **no project, no protocol**. Codified
  rule `we:docs/agent/platform-decisions.md` (#project-protocol-bar) ("not every gap is a Project/Protocol"; mint a protocol
  only for a provider seam / interchange schema — spatial manipulation has neither) + precedents #409
  (master-detail → intent, not project) and #467 (responsive-layout → extend intents, not project). Not a
  live fork.
- **Forced ratify — keyboard/a11y + substrate (fixed mechanic).** Pointer Events (never HTML DnD); ARIA APG
  Window-Splitter for resize, ARIA Grid pattern for 2-D arrange; live-region announce; `Element.moveBefore()`
  progressive for state-preserving moves. Pointer-only is the *broken* branch (non-conforming, violates the
  `reorder` keyboard-parity contract) — a fixed mechanic, not a dimension.
- **Fork 1 — Resize home:** standalone `resizable` intent vs. extend `layout` (its `pane` gains the divider).
- **Fork 2 — 2-D arrangement & the `reorder` relationship:** a new `arrangeable` intent composing reorder's
  substrate vs. extend `reorder` with a 2-D placement dimension.
- **Fork 3 — Snap decomposition:** one `snap` intent vs. split (grid-snap = an `arrangeable` dimension +
  standalone `alignment-guides` intent), per Finding 2.
- **Fork 4 — Docking/tiling scope:** fold the recursive-tree model in now (a `dockable` intent) vs. carve it
  to its own future decision (Finding 1 shows it is a genuinely distinct third model).

Per-fork options, defaults, and confidence live in the prepared item #1384 and in the published research
topic. Like #022 (one decision → `reorder` intent + `reorderable-list` block + traits), the expectation is
a **fan-out** of intents/blocks, not a pre-minted set.

## Classification (per-fork pass)

- **Layer** — Intent(s) (declarative UX "what") + composing Block(s). Not a Protocol (no engine-swap/vendor
  interop, no interchange schema); not a Project (no cross-cutting orchestration domain).
- **Snap** — *two* concerns: grid-snap is a dimension of the 2-D grid model; magnetic alignment is a
  standalone intent (bias-toward-separation: it recurs without a grid).
- **Resolution / default** — most-permissive: manipulation is opt-in per surface; absent → static.
- **Fixed mechanics** — keyboard parity + ARIA conformance + live-region announce + Pointer-Events substrate
  hold under *any* value of the dimensions, so they are baked, not exposed.
- **Native-first** — gesture (Pointer Events), layout (CSS Grid), observation (ResizeObserver) are native;
  the standard adds the interaction semantics + a11y contract the platform lacks.

## References

- Incumbent libraries: Split.js, react-resizable-panels, allotment, react-split-pane (splitters);
  react-grid-layout, gridstack, Muuri (2-D grid); golden-layout, dockview, FlexLayout, rc-dock (docking);
  moveable / interactjs (magnetic alignment).
- Native substrate: MDN (`resize`, `ResizeObserver`, Pointer Events, `moveBefore`, CSS Grid/subgrid,
  `scroll-snap`, Anchor Positioning, HTML DnD); W3C WAI-ARIA APG (Window Splitter, Grid patterns);
  Open UI / WHATWG (confirmed: no native splitter/dashboard proposal in flight).
- WE tree: `we:src/_data/intents/reorder.json`, `we:src/_data/intents/layout.json`,
  `we:src/_data/intents/breakpoint.json`, `we:src/_data/blocks/reorderable-list.json`,
  `we:src/_data/blocks/carousel.json`; precedents #022, #409, #467; codified rule
  `we:docs/agent/platform-decisions.md` (#project-protocol-bar).
