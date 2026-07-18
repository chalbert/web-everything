---
kind: decision
size: 3
status: open
dateOpened: "2026-07-18"
preparedDate: "2026-07-18"
tags:
  - standards
  - visual-diff
  - research
  - console-board
---

# Shape the annotated visual-diff surface contract, then decide mint

Graduated from decision [#2533](/backlog/2533-console-board-derived-ui-standards.md) (Fork 5). Ratified: **commission the shaping research first; the mint (or not) is decided on its result.** **Prepared 2026-07-18** — the shaping research is published (see below) and the forks are ready to ratify; `preparedDate` is now set. This is now a fast ratification, not cold research.

The pattern is a **before/after annotated visual-diff surface**: two panes (e.g. design vs built), with numbered, clickable, **typed** delta regions (real drift vs "expected, not reached yet"). No existing standard owns side-by-side visual comparison — `we:src/_data/intents/audit-timeline.json` is a *text/event feed*, the standard this is measured against.

The pattern is unmistakably real and recurring — which is why it clears the corrected minting bar as a *candidate*: visual-regression tools (**Percy, Chromatic, reg-suit**, Playwright/Storybook snapshot review) **are literally annotated visual-diff surfaces** (baseline vs new, highlighted + accept-per-region); GitHub/GitLab **PR diff** (side-by-side + inline, per-hunk accept); **Figma / Abstract** version-compare. What is missing is the **contract shape**, not the justification.

So the research to commission (a `/research/` topic) must shape:
- **the delta-type taxonomy** — real drift vs expected-not-yet-reached vs intentional change, etc.
- **the anchor payload** — how a delta region is located/anchored across the two panes.
- **the accept / typed-region model** — how a region is reviewed and accepted, per-type.

Mint (or not) is decided **on that result** — do NOT mint blind now (ratifying an unshaped contract bakes in guesses), and do NOT reject/park for "no second consumer" (a struck reason; the pattern is established prior art).

**Acceptance:** a `/research/` topic is commissioned and published shaping the three contract questions above (delta-type taxonomy · anchor payload · accept/typed-region model), measured against `we:src/_data/intents/audit-timeline.json`; the decision is then prepared (`preparedDate` set) with a mint/no-mint recommendation grounded in that research.

## Prepared (2026-07-18) — research published, forks ready to ratify

**Research:** [/research/annotated-visual-diff-surface/](/research/annotated-visual-diff-surface/) (grounding in `we:reports/2026-07-18-annotated-visual-diff-surface.md`). Surveyed the shipped models — Percy (approve / request-changes, promotes baseline), Chromatic (accept/deny per story + region highlights), reg-suit/reg-cli (categorizes items new/passed/changed/deleted; 2-up/swipe/blend/diff-mask UI), Playwright `toHaveScreenshot` (pixel diff-mask + `maxDiffPixelRatio`, rewrites the committed baseline), GitHub/GitLab PR diff (structural file+line hunks; per-**file** "viewed"), Abstract (Sketch version-control, per-layer structural visual diff) and Figma branch-merge review (per-frame side-by-side) — all measured against `we:src/_data/intents/audit-timeline.json`.

**Why audit-timeline does not cover it:** audit-timeline is a *temporal, linear* feed of `AuditEvent`s ("who did what, when") and owns the display, not the record. The visual-diff surface is *spatial, two-pane*, and its unit is a **region of divergence between two renders** — it cannot be expressed as an event in a stream. The gap is real; audit-timeline is the nearest-but-non-covering neighbor.

**Grounding digest (two load-bearing findings):**
- **Delta *type* and delta *disposition* are orthogonal.** reg-suit's `new/changed/deleted` is a *structural type* (what changed about a region's existence); Chromatic/Percy's `accept/deny` is a *review disposition* (the verdict). Every tool with both keeps them on separate axes — folding them into one flat enum reproduces the orthogonality break WE already ruled against for `action.level` (#1318/#1324) and `progress` (#2533 Fork 2).
- **Anchoring splits pixel vs structural** along the "are the two panes pixel-aligned?" line. Visual-regression (same view, re-captured) is pixel-aligned → a bounding box locates a region; design-vs-built / Figma / PR-diff panes are *not* pixel-aligned → structural anchors (dom-selector / node-id / line-range). The board's design→built case is the structural kind; the contract must carry both.
- The board also surfaced a **third disposition no incumbent first-classes** — `expected` ("known drift, not reached yet") — the novel contribution.

### Fork A — mint the intent, or not?
- **(a — recommended) MINT a `visual-diff` intent.** The pattern is dispositive prior art and the contract is now shaped (Forks B–D). The corrected bar's honest verdict is mint.
- (b) Keep researching / park. *Rejected* — the pattern is established (struck "no second consumer"), and the contract is now shaped, so nothing remains to defer on.

### Fork B — delta-type taxonomy: two orthogonal axes, or one enum?
- **(a — recommended) TWO orthogonal axes:** a structural `type` (`added | removed | changed`) × a review `disposition` (`unreviewed | accepted | rejected`). Matches reg-suit's type + Chromatic/Percy's verdict.
- (b) One flat enum folding both. *Rejected* on the #1318/#1324 precedent — makes "an accepted `added` region" vs "a rejected `added` region" inexpressible.
- **⚠ Sub-question the ratifier must resolve before freezing the contract:** where does the board's `expected` ("planned/known drift, not built yet") live? It classifies the **nature** of the divergence, not the review verdict — a region can be `expected` **and** `unreviewed`, or `expected` then later `accepted`. Folding it beside `accepted`/`rejected` is a *milder instance of the very fold* this fork rejects (#1318/#1324). **Recommend a third `nature` axis** (`unplanned | expected`) orthogonal to `disposition`; the alternative is to keep `expected` off the enum and treat a known-pending region as simply not-yet-in-the-review-workflow. This is one shaping pass on the disposition axis — it does **not** block the mint (Fork A), it scopes the remaining design. *(Surfaced by the session's red-team audit.)*

### Fork C — anchor payload: both pixel + structural, or one?
- **(a — recommended) A TAGGED union** — `anchorType: 'pixel-region' | 'dom-selector' | 'node-id' | 'line-range'`, with `box?` for the pixel case and `ref?` for the structural cases, plus the two pane refs. Serves both venues; a conformance floor can require pixel-region and treat structural anchors as an additive tier.
- (b) Pixel-only. *Rejected* — under-fits design-vs-built (not pixel-aligned).
- (c) Structural-only. *Rejected* — under-fits classic visual-regression (a re-render has no stable selector correspondence).

### Fork D — accept model: per-region disposition, or surface-level only?
- **(a — recommended) A PER-REGION disposition** that promotes the built state into the baseline on `accepted` (Percy/Chromatic semantics), carries a **known-pending** state that neither fails nor promotes (the board's `expected` — see Fork B for which axis it lives on), and may be scoped by type. The whole-surface approve composes *above* it, never replaces it.
- (b) Surface-level approve only. *Rejected* — can't accept one region and reject another; the everyday review case.

### Fork E — scope: intent now, or intent + differ-protocol together?
- **(a — recommended) MINT the intent now; NAME the differ seam as a follow-on.** The tools split into a *differ* (two renders → typed regions: pixelmatch/odiff/reg-cli) and a *review surface*, mirroring Web Graph's `CustomGraphLayout`/`CustomGraphRenderer` two-seam split. Shaping the review-surface contract is what Fork 5 asked for; designing the differ protocol is a separable second standard.
- (b) Bundle both now. *Rejected as premature* — the differ protocol is its own design surface and would block the intent.

**Recommendation to the ratification turn:** ratify the column — **MINT a `visual-diff` intent** on the shaped contract (Forks B/C/D defaults), scoped to the intent with the differ protocol named as a follow-on (Fork E). One open sub-question rides into the mint: whether `expected` is a `disposition` value or its own `nature` axis (Fork B ⚠) — recommend the third axis; it shapes the contract but does not gate the decision. Override any fork.
