---
bornAs: xh4htpb
shortTitle: "Visual-differ protocol design"
kind: decision
status: open
dateOpened: "2026-07-18"
preparedDate: "2026-07-28"
relatedReport: "reports/2026-07-18-annotated-visual-diff-surface.md"
tags:
  - standards
  - visual-diff
  - protocol
---

# Design the visual-differ protocol — two renders to typed delta regions

Fork E follow-on from **[#2538](/backlog/2538-shape-the-annotated-visual-diff-surface-contract-then-decide-mint/)**
(ratified: mint the `visual-diff` intent now, name the differ seam as a separable follow-on). This decision
designs that seam: the **visual-differ protocol** — the contract that turns *two renders* into the *typed
delta regions* the `visual-diff` review surface ([#2545](/backlog/2545-mint-the-visual-diff-intent-author-the-three-axis-review-sur/))
reviews. It mirrors Web Graph's two-seam split: `CustomGraphLayout` *invents* positions and `CustomGraphRenderer`
*draws* them; here a **differ** *derives* typed regions and the **review surface** *dispositions* them.

**Prepared 2026-07-28** — grounded in the already-published research (below); forks are ready to ratify.
This is a fast ratification, not cold research.

## Research (already published — links, not re-run)

The producer/consumer differ seam was surveyed as part of #2538's shaping research —
[/research/annotated-visual-diff-surface/](/research/annotated-visual-diff-surface/), grounding in
`we:reports/2026-07-18-annotated-visual-diff-surface.md` (`relatedReport`). That survey's **Finding 4** is
this decision's premise verbatim: *"the tools have a clean producer/consumer split — a **differ** turns two
renders into typed regions; a **review surface** renders + dispositions them — mirroring Web Graph's two-seam
split."* Surveyed differs: **pixelmatch** (mapbox; per-pixel, anti-alias-aware; returns a changed-pixel count +
writes a diff-mask image), **odiff** (perceptual, YIQ colour-metric; returns a match-boolean + pixel count),
**reg-cli / reg-suit** (emits a new/passed/changed/deleted *item report*; the differ half is `reg-cli`, the
review half is `reg-publish`/`reg-notify` — a shipped instance of *exactly* this two-seam split),
**Playwright `toHaveScreenshot`** (pixelmatch under the hood + `maxDiffPixelRatio`), **BackstopJS** (a
resemble-based differ engine). No new web survey is owed — the ground is the same as #2538; this decision only
shapes the *contract* over already-surveyed prior art. **Note the incumbents *diverge* on output shape** (a
count + mask, a boolean + count, an item report) — load-bearing for Fork C.

**Known occurrences (make it tangible):** the differ/review split is not a WE invention — it ships in
reg-suit (`reg-cli` differ ⟶ `reg-publish` review UI), in Chromatic (its diffing service ⟶ the per-story
accept/deny UI), and in Percy (render+diff pipeline ⟶ the approve/request-changes board). Every one of them
draws the line this protocol draws: the machine produces *where + what-kind*; the human produces *the verdict*.

## What already exists in-tree (ground the seam against real code)

The differ half **already partly ships** as internal review tooling — this decision *names and shapes* that
seam, it is not greenfield:

- `we:scripts/lib/visual-comparator.mjs` — `diffImages(shot, baseline, opts)` (PURE) returns
  `{ match, delta, findings[] }`; `compareToBaseline({ shotPath, baselinePath })` is the file-facing wrapper.
  It is a coarse structural grid-mean diff **plus** a noise-tolerant pixel-delta threshold — *not* naive
  pixel-equality (`we:scripts/lib/visual-comparator.mjs:1` header). So it is **deterministic *and*
  tolerance-based / perceptual at once** — a fact that reshapes Fork B.
- Its finding shape today is **untyped**: `{ kind: 'region-shift' | 'pixel-delta-exceeded' |
  'dimension-mismatch', severity, detail, region?: {x,y,w,h} }` (`we:scripts/lib/visual-comparator.mjs:155`).
  A `region-shift` is *undifferentiated* — a region whose mean colour moved could be added, removed, or
  changed content; a pixel differ can't tell which. **The gap this seam closes** is turning those raw findings
  into the intent's **typed** regions *where the render pair supports typing* (Fork A).
- `we:scripts/lib/design-pixels-adapter.mjs:214` — `groundVisualLens` already consumes `compareToBaseline`
  for the jury's `screenshot-vs-target` lens (#2671). It is the **first (and today only) consumer** of the
  differ output, so the seam's region shape must not break it — and it is the *one conforming impl* Fork C
  turns on.
- The **review surface** contract is the ratified `visual-diff` intent (#2538): each region carries three
  orthogonal axes — structural `type` (`added | removed | changed`) × `nature` (`unplanned | expected`) ×
  review `disposition` (`unreviewed | accepted | rejected`) — plus a tagged-union `anchor`
  (`pixel-region | dom-selector | node-id | line-range`).

**The crux of this decision:** of the intent's three axes, *which does the differ author, and which belong to
the review surface?* — what capability the differ *declares* about how it compared — and whether the vendor
seam is minted as a formal WE Protocol **now** or shaped as an adapter interface **now** with the Protocol
extraction deferred.

## Supported by default (not forks — no excluded branch)

- **The anchor tagged union is inherited, not re-decided.** `pixel-region | dom-selector | node-id |
  line-range` was ratified in #2538 Fork C; the differ emits whichever anchor kind its render pair supports
  (a pixel differ emits `pixel-region`; a structural/DOM differ emits `dom-selector`/`node-id`). No fork.
- **The aggregate `{ match, delta }` summary rides along.** The shipped comparator already returns a scalar
  verdict + magnitude; the seam keeps them on the envelope beside `regions[]` (a caller may threshold on
  `delta` without walking regions). Additive, no excluded branch.
- **Missing-baseline / single-render = documented skip.** Already the comparator's contract
  (`compareToBaseline` returns `{ skipped: true, match: null }` on a missing baseline,
  `we:scripts/lib/visual-comparator.mjs:200`). The seam carries the same skip semantics; a differ with
  only one render makes no claim. No fork.
- **Constellation placement (#96 / #1282).** The seam *contract* (the `diff()` adapter interface + the
  `VisualDelta` shape) is a WE-owned type; the algorithm impl is FUI-side.
  `we:scripts/lib/visual-comparator.mjs` stays WE's own **internal review harness** under the
  classified-in-place `scripts/lib/*` seam (`we:docs/agent/platform-decisions.md:128`); it *implements* the
  native-first default algorithm but is not a second shippable engine. One algorithm, no double-impl. (How
  many *vendor adapters* FUI ships behind the seam is an FUI concern, not a standard-side count — see Fork C.)

## The typed delta — the wire shape the seam carries

```js
// The visual-differ SEAM — an adapter interface (NOT a formal Plug yet, Fork C):
//     diff(renderA, renderB, opts?) → VisualDelta
// A "render" is an opaque capture: a decoded PNG {width,height,data} for a pixel differ,
// or a DOM/snapshot ref for a structural differ. The differ sees ONLY the two renders —
// never the design intent, never the review verdict.

// VisualDelta — what crosses the differ → review-surface seam:
{
  comparison: {                 // Fork B: the differ DECLARES how it compared (not a determinism boolean)
    model: "structural-grid+pixel-delta",   // the native-first default; a perceptual adapter declares e.g. "ssim"
    tolerance: { pixel: 24, cell: 24, deltaRatio: 0.02 }   // the strictness the caller/gate can read
  },
  match: false,                 // aggregate verdict (inherited from the shipped comparator)
  delta: 0.087,                 // aggregate magnitude in [0,1]
  regions: [                    // the TYPED delta regions the visual-diff intent reviews
    {
      type: "changed",          // Fork A: structural axis, differ-derived WHERE THE ANCHOR SUPPORTS IT
                                //   pixel-region anchor  → "changed" only (a pixel differ has no tree)
                                //   dom-selector/node-id → real added|removed|changed from tree presence/absence
      anchor: {                 // inherited tagged union (#2538 Fork C)
        anchorType: "pixel-region",
        box: { x: 240, y: 96, w: 120, h: 40 },
        refA: null, refB: null
      },
      evidence: {               // raw differ output: magnitude + where — NO verdict, NO spec knowledge
        meanColourDistance: 41.3,
        pixelDelta: 0.12
      }
      // NOTE: no `nature`, no `disposition` — the differ cannot author them (Fork A).
    }
  ]
}

// The review surface, on ingest, lifts each differ region into the intent's 3-axis region:
{
  type: "changed",          // from the differ
  anchor: { /* … */ },      // from the differ
  nature: "unplanned",      // ADDED by the surface — an expectations layer may reclassify to "expected"
  disposition: "unreviewed" // ADDED by the surface — every fresh region starts here
}
```

| Fork | Question | Recommended default |
|------|----------|---------------------|
| **A** | Which of the intent's 3 axes does the differ author? | Differ emits `anchor` + `evidence` + `type` *where the anchor supports it*; `nature`/`disposition` are the surface's |
| **B** | Mandate a diff model, or declare how the differ compared? | **Declare** the comparison `model` + `tolerance`; both strict-pixel + perceptual conform; default = the shipped tolerant model |
| **C** | Mint a formal `VisualDiffer` Protocol now, or shape the seam + defer the mint? | **Defer the mint** — ship the `diff()` adapter interface now; extract the Protocol on a genuine 2nd conforming impl |

### Fork A — which axes cross the differ seam?

*Fork exists because:* the differ holds the **two-render evidence**, so it alone is positioned to classify a
region's structural `type` — but *only when its render pair carries structure*; loading the human/spec axes
onto the differ writes **dead constant fields**. The seam is genuinely either "differ classifies structural
type (where it can)" or "differ emits raw untyped regions" — one excluded branch is *broken* (dead fields),
the other *coherent-but-worse* (loses evidence).

- **(a — recommended) Differ emits `{ anchor, evidence, type? }`; the surface owns `nature` + `disposition`.**
  `type` is **anchor-conditioned** (the amendment the skeptic forced): a *structural* differ
  (dom-selector/node-id/line-range anchors) derives real `added | removed | changed` from tree
  presence/absence; a *pixel* differ (pixel-region anchor) cannot distinguish added-vs-removed-vs-changed from
  a mean-colour shift, so it emits `changed` (the honest floor) — never a fabricated add/remove. `nature`
  (`expected` = "planned, not built yet") needs *spec* knowledge the differ does not have; `disposition` is
  the *human verdict*, `unreviewed` by construction at emit time. The surface initialises every ingested
  region `nature: unplanned, disposition: unreviewed`; a separate expectations layer may later flip `nature`
  to `expected`. This keeps the machine seam mechanical and the human/spec seam where its knowledge lives —
  the CustomGraphLayout/Renderer clean cut.
- **(b) Differ emits raw untyped regions (just anchor + evidence); the surface derives `type` always.**
  *Rejected for the structural case* — the surface only has *one* render at review time, so re-deriving
  add/remove/change throws away the other render the differ already held. (It is, however, exactly what the
  *pixel* case collapses to — folded into (a) as the pixel floor.)
- **(c) Differ emits the full 3-axis region (`nature`/`disposition` defaulted).** *Rejected as broken* — the
  differ has no basis to author `nature`/`disposition`, so they would be constant dead fields on the machine
  contract (a #1892-flavour impl-detail-on-the-standard: the differ can't produce them, so they don't belong
  on its output).

*Classification:* Q1 layer = contract (WE-owned seam output); a **protocol-seam boundary** call, not a config
dimension — the cut between machine-derivable and human/spec-authored axes is real.

Skeptic: SURVIVES-WITH-AMENDMENT — the differ→{structural}, surface→{nature,disposition} split is forced-correct, but "type is uniformly machine-derivable" was false: the shipped pixel differ can only emit `changed`. Amended so `type` is **anchor-conditioned** (pixel-region → `changed` floor; structural anchors → real add/remove/change), folding the rejected alt (b) in as the pixel case.
Screen: clear — rules on the contract's typed axes and correctly places the human/spec-dependent axes (which a differ physically cannot emit) on the review side; a real merit split, not prioritization.

### Fork B — mandate a diff model, or declare how the differ compared?

*Fork exists because:* a contract cannot **both** mandate one comparison model **and** admit differs that
compare differently (strict-pixel vs perceptual/tolerant) — genuinely exclusive contract shapes.
`mandate-one-model` is the excluded branch: it forecloses the design-vs-built perceptual case *and*
contradicts the shipped comparator, which is itself tolerance-based (not strict-pixel).

- **(a — recommended) Declare the comparison as a per-impl capability — `comparison: { model, tolerance }` on
  the `VisualDelta` — and let both strict-pixel and perceptual differs conform.** A caller/gate reads *how*
  the differ compared (which model, how tolerant) and decides whether that grounding is strong enough for its
  use: a *required CI baseline check* can insist on a strict model + tight tolerance; a *design-vs-built
  by-eye review* accepts a looser one. **The comparison-model value is a config dimension**
  (`#config-extends-platform-default`), not a ratifiable pick — both are legitimate end-states; the ratifiable
  call is only *"declare, don't mandate."* Default = the shipped structural-grid + pixel-delta tolerant model.
  *(The skeptic killed the original `deterministic: boolean` framing: every real differ — pixelmatch, odiff,
  SSIM, reg-cli — is pure/reproducible, so the boolean is near-constant-true, and the native differ is itself
  perceptual/tolerant, so "deterministic vs perceptual" was a false dichotomy. The axis that actually varies,
  and that a gate cares about, is the comparison **model + tolerance** — declared here instead.)*
- **(b) Mandate one comparison model; other differs do not conform.** *Rejected* — under-fits design-vs-built
  (needs perceptual/structural tolerance), and a contract its own reference impl can't strictly satisfy is
  mis-shaped.

*Classification:* the comparison-model *value* is a **config dimension** — recorded as such; the fork is only
the contract-shape call *declare vs mandate*, resolved to **declare**.

Skeptic: SURVIVES-WITH-AMENDMENT — config-dimension classification holds; replaced `deterministic: boolean` (near-constant-true across all real differs; the native differ is itself tolerance-based, so the boolean cut a false dichotomy) with a declared `comparison: { model, tolerance }` descriptor — the axis that actually varies.
Screen: clear — declare-vs-mandate is a genuine contract-semantics choice visible to consumers (mandate narrows the conforming set; declare admits perceptual differs and lets a gate query strictness); real merit both ways.

### Fork C — mint a formal `VisualDiffer` Protocol now, or shape the seam and defer the mint?

*Fork exists because:* minting a first-class WE Protocol now and deferring it **cannot coexist** — the
call is whether the `#project-protocol-bar` (`we:docs/agent/platform-decisions.md:423`) is cleared *today*.
It is **not**, so the excluded branch is *mint-now*.

- **(a — recommended, FLIPPED by the red-team) Shape the seam as a `diff()` adapter interface now; DEFER the
  formal `VisualDiffer` Protocol mint.** Home the `diff(renderA, renderB) → VisualDelta` interface at the
  existing tooling seam; the shipped `diffImages` is the sole native conformer. Extract a first-class WE
  Protocol (a Plug + conformance vectors) **only when a genuine second impl conforms** — the temporal rule 3
  of `#project-protocol-bar` ("extract a Protocol only once a *second* independent impl exists and the
  contract has stabilised"). **Why now-defer and not mint:** a DI-injectable differ is a **provider seam**
  (you swap the differ, like `CustomGraphRenderer`), *not* an interchange schema — and the #1437 relaxation
  ("external convergence counts as the second impl", `we:docs/agent/platform-decisions.md:435`) is
  **interchange-schema-only** by its own text. It does not reach a provider seam. Worse, the convergence
  predicate fails anyway: pixelmatch (count + mask), odiff (bool + count), reg-cli (item report) **diverge**
  on output shape — the opposite of a convergent schema. With exactly one conforming impl and no convergent
  external schema, this is the **deck #1175 "no protocol yet"** case the statute holds up as the contrast.
  **Concrete un-defer trigger:** a *second* differ actually conforms to the `VisualDelta` contract — a
  perceptual pixel differ (pixelmatch/odiff wired as a real adapter) **or** a structural/DOM differ for the
  design-vs-built case — at which point extract the `VisualDiffer` Plug (shape mirrors
  `we:src/_data/plugs/customgraphlayout.json`: a base contract satisfied by the native-first default + every
  adapter, the `VisualDelta` the only lock).
- **(b) Mint the formal `VisualDiffer` Protocol (Plug + conformance vectors) now.** *Rejected* — a provider
  seam with **one** conforming impl; `#project-protocol-bar` temporal rule 3 bars it, #1437's
  external-convergence relaxation is interchange-schema-only and does not reach a provider seam, and the
  incumbents diverge on output shape (the deck #1175 contrast). Minting now freezes an unvalidated contract —
  the exact failure the bar exists to prevent.

*Statute reconciliation (no new anchor):* this decision **applies** `#project-protocol-bar`, it does not write
a competing rule — `codifiedIn: one-off`. It records the seam contract (`VisualDelta` + the `diff()`
interface) and the deferral + trigger; the eventual Plug mint is a separate future item gated on the trigger.

Skeptic: REFUTED → default FLIPPED to *defer the mint*. `#project-protocol-bar` temporal rule 3 bars minting a provider-seam Protocol at one conforming impl; #1437's external-convergence relaxation is interchange-schema-only; the incumbents diverge on output shape (deck #1175 case). Ship the adapter-interface seam now, extract the Plug on a real second conforming impl.
Screen: flagged(impl) → fixed — "how many vendors FUI ships behind the seam" was an FUI-side impl count sitting on the standard side; re-layered to FUI. The standard side now carries only "there is a `diff()` adapter seam + the `VisualDelta` contract," never the adapter count.

## Recommendation to the ratification turn

Ratify the column: **(A)** the differ emits `anchor` + `evidence` + `type` *where the anchor supports it*
(structural anchors → real add/remove/change; pixel-region → `changed` floor), and the surface owns
`nature`/`disposition`; **(B)** *declare* the comparison `model` + `tolerance` as a capability (both strict
and perceptual differs conform; default = the shipped tolerant model) — the comparison-model *value* is a
config dimension, not a pick; **(C)** shape the seam as a `diff()` adapter interface now and **defer** the
formal `VisualDiffer` Protocol mint until a genuine second impl conforms (`#project-protocol-bar` temporal
rule 3; un-defer trigger named above). No new statute anchor — the decision *applies* the protocol bar and
records the seam contract (`codifiedIn: one-off`). Override any fork.

### Review jury (provisional — pre-registered #2638)

Care level: `elevated`. This jury binds against the item's predicted scope and is re-checked against the real diff at PR open.

| juror | lens | grounding method | pre-registered expectation |
| --- | --- | --- | --- |
| correctness#1 | correctness | static-review | The change does what the spec says with no behaviour regression — every changed branch is exercised, and no test is missing, weakened, or gamed to pass while the behaviour is wrong. |
| security#1 | security | static-review | No untrusted input, secret, auth, or file/network path is left unguarded and the trust boundary is not widened — anything touching those earns an explicit security check. |
| simplicity#1 | simplicity | static-review | The change is the smallest one that solves the problem — it reuses what already exists and adds no dead code or needless abstraction. |
| standards-conformance#1 | standards-conformance | static-review | The change follows this repo's conventions and platform-native defaults, and does not diverge from a ratified standard or placement rule. |

*Predicted touch-set (#2619) for the buildable child this decision authorizes:* `we:scripts/lib/` — refine
`we:scripts/lib/visual-comparator.mjs` to emit the typed `VisualDelta` (anchor-conditioned `type`, declared
`comparison`) behind a `diff()` adapter interface, consumed by the review surface; no Plug is minted (Fork C).
That scope seeds the child's `scope:` at carve-off.
