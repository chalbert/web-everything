# Annotated Visual-Diff Surface — shaping the contract (prep for #2538)

**Point:** The before/after annotated visual-diff surface is an established, recurring pattern (Percy, Chromatic, reg-suit, Playwright/Storybook snapshot review, GitHub/GitLab PR diff, Figma version-compare). It cleared the corrected minting bar as a **candidate** in [#2533](/backlog/2533-console-board-derived-ui-standards/) Fork 5; what was missing was the **contract shape**, not the justification. This report shapes the three open contract questions — the **delta-type taxonomy**, the **anchor payload**, and the **accept / typed-region model** — and recommends **MINT a `visual-diff` intent**, measured against the nearest existing standard, `we:src/_data/intents/audit-timeline.json`.

Graduated from #2533 Fork 5 (RATIFIED: commission the shaping research first; the mint is decided on this result — do NOT mint blind). Prepares decision #2538.

---

## 1. The pattern, and why audit-timeline does not cover it

The surface: **two renders of the same subject** (a baseline vs a new capture; a design vs a built screen) shown side-by-side (or overlaid), with the regions that differ **called out as numbered, clickable, typed regions**, and a **per-region review verdict** (accept the change / reject it as a regression / mark it expected-but-not-reached-yet).

The nearest existing WE standard is **`audit-timeline`** — but it is a *chronological text/event feed* of `AuditEvent`s for one entity ("who did what, when, before→after"), and it "owns the display, not the record." It is **temporal and linear**; the visual-diff surface is **spatial and two-pane**, and its unit is a *region of divergence between two renders*, not an event in a stream. audit-timeline cannot express "these two rendered states differ **here**, and the difference is **this kind**." The gap is real and audit-timeline is confirmed as the nearest-but-non-covering neighbor.

**One adjacent data model to distinguish (not to conflate):** Web States' `ChangeRecord` (the before→after pairs that audit-timeline itself renders in `expanded` detail) is the closest *data-model* neighbor — but it is a scalar/field-level change pair, not a *spatial region on a rendered surface*. The visual-diff surface's unit is a **located region of visual divergence between two renders**, with an anchor (pixel or structural) and a per-region disposition — a review surface, not a change-log entry. So `ChangeRecord` models "field X went A→B"; visual-diff models "this region of the render drifted, here is where and what kind." The mint does not subsume `ChangeRecord`; it sits beside it.

## 2. Prior-art survey — the shipped models

| Tool | Diff unit | Anchor | Review verdict per unit | Baseline effect of "accept" |
|---|---|---|---|---|
| **Percy** (BrowserStack) | Per-snapshot visual change | Pixel overlay on the rendered image | Approve / request-changes at the build/snapshot level | Approving promotes the new render to baseline |
| **Chromatic** (Storybook) | Per-story change; highlighted diff regions | Pixel regions on the captured story | **Accept / Deny** per snapshot (and per-region highlight) | Accepting updates the story's baseline |
| **reg-suit / reg-cli** | Per-item, categorized **new / passed / changed(failed) / deleted** | Pixel; UI offers 2-up / swipe / blend / diff-mask | No in-tool accept — you commit updated expected images | Committing the new expected image is the "accept" |
| **Playwright** `toHaveScreenshot` | Per-screenshot pixel delta | Pixel diff-mask image (highlighted changed pixels); `maxDiffPixelRatio` tolerance | `--update-snapshots` accepts | Re-writing the committed baseline snapshot |
| **GitHub / GitLab PR diff** | Per-hunk (text) | **Structural**: file + line range | Comment / approve at the review level; per-**file** "viewed" | N/A (merge, not baseline-promote) |
| **Abstract** (Sketch version control) | Per-layer visual change | **Structural**: layer id | Review + comment per change | N/A (branch merge) |
| **Figma** branch-merge review / inspect | Per-frame change (branch review) | **Structural**: frame / node id | Review side-by-side of changed frames | N/A |

**Two structural findings fall straight out of the table:**

1. **Delta *type* and delta *disposition* are orthogonal.** reg-suit's `new / changed / deleted` is a **structural type** (what changed about the item's existence); Chromatic/Percy's `accept / deny` is a **review disposition** (the verdict on the change). No single incumbent first-classes *both* — reg-suit has the type but no in-tool disposition, Chromatic/Percy have the disposition but no added/removed/changed typing, GitHub has the type per-hunk but approval only at the PR level. So the two-axis model is a **synthesis across** the tools, not a per-tool observation — but it is the shape that lets the surface express what each tool expresses separately, and folding the two into one flat enum reproduces the exact orthogonality break WE already ruled against for `action.level` (#1318/#1324) and `progress` (#2533 Fork 2 — provenance kept off completion). This is the load-bearing shape decision.

2. **Anchoring splits pixel vs structural, along the "are the two panes pixel-aligned?" line.** Visual-regression tools (baseline vs new capture of the *same* view) are pixel-aligned, so a **pixel bounding box** locates a region. Design-vs-built and Figma/PR-diff panes are **not** pixel-aligned (different renderers, layouts, sizes), so they anchor **structurally** (a DOM selector / layer node-id / line range). The board's "design → built" case is the structural kind. A contract that serves the whole pattern must carry **both**, tagged by anchor type — a pixel box degrades to noise under a layout shift, and a structural anchor needs a correspondence the two renders may not share.

## 3. The three contract questions, shaped

### 3a. Delta-type taxonomy — two orthogonal axes, not one enum
- **Structural `type`** (what changed about the region's existence): `added` (in built, not baseline) · `removed` (in baseline, not built) · `changed` (in both, differs). This is reg-suit's `new/deleted/changed`, and GitHub's add/remove/modify.
- **Review `disposition`** (the verdict, orthogonal to type): `unreviewed` (default) · `accepted` (intended — promote to baseline) · `rejected` (a real regression) · `expected` (known drift, **not reached yet** — the board's third state, the one no incumbent has first-classed). Keeping `expected` as a first-class disposition — distinct from accept and reject — is the novel contribution the board surfaced.

Modeling these as **two axes** is the recommendation. A single flat enum (`added | removed | changed | accepted | rejected | expected`) is rejected on the #1318/#1324 precedent: it makes "an accepted `added` region" vs "a rejected `added` region" inexpressible.

> **Open shaping question the ratifier must carry in (⚠).** `expected` may itself belong on a *third* axis, not as a fourth `disposition` value. `unreviewed | accepted | rejected` are **review-workflow verdicts** (has a human signed off?); `expected` classifies the **nature of the divergence** (planned/known drift vs unplanned) — and a region can be `expected` *and* `unreviewed`, or `expected` then later `accepted`. Folding `expected` beside accept/reject is a *milder instance of the very fold* this section argues against (#1318/#1324). The honest options for the mint: (i) a third `nature` axis (`unplanned | expected`) orthogonal to `disposition`, or (ii) keep `expected` on `disposition` and accept that a known-pending region is simply not-yet-in-the-review-workflow. **Recommend (i)**; either way the `disposition` axis needs one more shaping pass before the contract is frozen. This does not block the mint — it scopes the remaining design.

### 3b. Anchor payload — a tagged union over pixel and structural
- `anchorType: 'pixel-region' | 'dom-selector' | 'node-id' | 'line-range'`, carrying `box?: {x,y,w,h}` for the pixel case and `ref?: string` for the structural cases, plus the two pane references being compared.
- **Recommendation: support both**, tagged. Pixel-only under-fits design-vs-built (not pixel-aligned); structural-only under-fits classic visual-regression (a re-render has no stable selector correspondence). The tag lets one contract serve both venues; a conformance floor can require pixel-region and treat structural anchors as an additive tier.

### 3c. Accept / typed-region model — per-region disposition promotes built→baseline
- Accept is a **per-region disposition** (§3a's axis), NOT only a whole-surface approve. Accepting a region **promotes its built state into the baseline** (Percy/Chromatic semantics); rejecting fails the check; `expected` parks it as known-pending without failing or promoting.
- Acceptance may be **scoped by type** (e.g. auto-accept `added`, require review for `changed`) — the "typed-region" part of the question.
- The whole-surface verdict (Percy/GitHub "approve the build/PR") composes *above* the per-region dispositions; it is not a substitute for them.

## 4. Structure — intent, with a differ-engine seam noted (not minted here)

The visual-regression tools have a clean **producer/consumer split**: a **differ** turns two renders into typed delta regions (pixelmatch, odiff, reg-cli, `pixelmatch`-backed Playwright), and a **review surface** renders and dispositions them. That mirrors **Web Graph**'s two-seam split (`CustomGraphLayout` invents positions; `CustomGraphRenderer` draws them). So the end-state is likely a **`visual-diff` intent** (the review-surface UX contract: two panes, typed regions, per-region disposition) **plus** a swappable **differ protocol** (pixel-diff / structural-diff / DOM-diff engines behind one seam, native-first over `pixelmatch`/`odiff`).

**This decision should mint the intent and only *name* the differ seam as a follow-on** — shaping the review-surface contract is what #2533 Fork 5 asked for; designing the differ protocol is a separable second standard, not a blocker for the intent.

## 5. Recommendation

**MINT a `visual-diff` intent** on the shaped contract above (two orthogonal delta axes; a tagged pixel/structural anchor; a per-region accept model with a first-class `expected` state), measured against and distinct from `audit-timeline` (temporal feed) and composing Web Graph's two-seam precedent for the eventual differ protocol. The pattern is dispositive prior art; the contract is now shaped; the honest verdict is mint (not park, not mint-blind). The remaining judgment for the ratification turn is scoped to the five forks in #2538.

## Open Points Register
- 🔶 **DECIDE (#2538 Fork A):** mint the intent now vs defer — recommend **mint**.
- 🔶 **DECIDE (#2538 Fork B):** two orthogonal delta axes vs one flat enum — recommend **two axes**.
- ⚠ **RECONCILE (#2538 Fork B, sub-question):** does `expected` belong on `disposition`, or on its own `nature` axis (planned/known vs unplanned)? — recommend a **third axis**; needs one shaping pass before the contract freezes (does not block the mint).
- 🔶 **DECIDE (#2538 Fork C):** anchor payload = both pixel + structural (tagged) vs pixel-only — recommend **both, tagged**.
- 🔶 **DECIDE (#2538 Fork D):** accept = per-region disposition (with a first-class known-pending state) vs surface-level only — recommend **per-region**.
- 🔶 **DECIDE (#2538 Fork E):** scope = intent now + differ-protocol as follow-on vs bundle both — recommend **intent now, name the seam**.
