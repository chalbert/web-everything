---
kind: decision
size: 2
parent: "746"
status: resolved
relatedProject: webdocs
relatedReport: reports/2026-06-18-930-creator-manifest-wb-token-bridge.md
preparedDate: "2026-06-18"
dateOpened: "2026-06-18"
dateStarted: "2026-06-18"
dateResolved: "2026-06-18"
graduatedTo: none
codifiedIn: "one-off"
tags: [block-explorer, plateau-embed, theme-creator, design-system, design-tokens, dtcg]
---

# Decide the Plateau-creator manifest → FUI workbench-stage token bridge (live-apply fidelity)

Surfaced by #751. #887-A ratified the postMessage *transport* and that the resolved/inline #747 manifest
crosses the wire — but explicitly left the `apply-design-system` message's **field list / fidelity** a
build detail. That detail is a genuine **semantic-alignment fork** (rhymes with #910's WE↔FUI
tag-alignment): the Plateau creator authors an **open DTCG token set**; the FUI workbench stage renders
through **5 fixed `--wb-*` props**. How does the receiver bridge the two? Blocks #751.

## Grounding digest

Verified against the real trees (2026-06-18); full survey in
[`we:reports/2026-06-18-930-creator-manifest-wb-token-bridge.md`](../reports/2026-06-18-930-creator-manifest-wb-token-bridge.md),
research topic [`creator-manifest-wb-token-bridge`](/research/creator-manifest-wb-token-bridge/).

- **Producer — the Plateau creator authors an *open* DTCG set.** The #747 manifest
  [`plateau:plateau-app/src/design-system-creator/manifest.ts:18`](../../plateau-app/src/design-system-creator/manifest.ts)
  carries a flat `themeTokens` map (*"In WE this is a DTCG ref; the creator authors the values inline"*),
  and the #889 import adapter [`plateau:importAdapter.ts`](../../plateau-app/src/design-system-creator/importAdapter.ts)
  (`parseDtcg`) ingests **arbitrary** DTCG trees + Figma variable exports — so `themeTokens` is unbounded.
  Plus `intentDefaults` (keyed by `surface/density/motion/typography/theme-color`, `plateau:manifest.ts:26`) and a
  free-form `traitDefaults` slot.
- **Consumer — the FUI stage reads exactly 5 fixed props.** [`fui:frontierui/workbench/designSystems.ts`](../../frontierui/workbench/designSystems.ts)
  `DesignSystemTokens` = `--wb-accent/--wb-radius/--wb-pad/--wb-font/--wb-shadow`, applied by
  `applyDesignSystem(preset)` at [`fui:frontierui/workbench/mount.ts:277`](../../frontierui/workbench/mount.ts)
  (sets `themeTokens` as custom props, sets `data-intent-*`/`data-trait-*`, re-renders).
- **The gap is not a 1:1 rename.** Open→finite forbids a pass-through, and the **intent/trait enums don't
  even match** (creator `surface: flat|raised|sunken` vs FUI `surface: lift|solid`; creator radius trait
  `sharp|soft|round` vs FUI `lg|sm|none`), so a pure rename is impossible too. **Some mapping/selection
  layer is structurally required** — only *where* it lives and *which vocabulary the block reads* are open.
- **This is a FUI-internal *shape* call, not a contract/transport call.** The #747 manifest contract
  (#871) and the transport (#887) are already ratified; #930 decides only how FUI's receiver consumes a
  manifest it can't fully express in 5 props. Per *impl-is-not-a-standard*, the mapping table is FUI-owned,
  never `@webeverything`; the `--wb-*` names never cross the WE boundary.

## Axis framing — open token source → finite render hooks

The design-token ecosystem converged on a **tiered model** (primitive → semantic → component) with an
explicit **transform/filter** step at every render boundary (Material 3 token tiers + semantic remapping;
Style Dictionary `transforms`/`filters` re-use one format over a filtered token *subset*). The 5 `--wb-*`
props at [`fui:designSystems.ts`](../../frontierui/workbench/designSystems.ts) **are the demo's
component-token tier**; the creator's open `themeTokens` are its primitive/semantic tiers. Bridging the two
is the standard cross-tier alias step — and because the source is open while the stage has a *finite* hook
count, a selecting/mapping layer is **unavoidable regardless of option**; the only real either/or is which
vocabulary the demo block's CSS ultimately reads.

## Recommended path at a glance

| Fork | Question | Options | Recommended default | Confidence |
| --- | --- | --- | --- | --- |
| 1 | The DTCG → `--wb-*` bridge shape | A mapping/transform in the FUI receiver · B stage consumes DTCG directly · C constrain the creator to `--wb-*` | **A — a lossy-by-design DTCG→`--wb-*` mapping in the FUI receiver (the semantic→component alias step), reading the whole manifest + declared fallbacks** | ~80% |

Supported by default (forced invariants, not forks):

- **The mapping lives FUI-side and is FUI-owned.** It maps the ratified #747 contract into FUI's private
  render props — pure impl (*impl-is-not-a-standard*; *generator-is-a-tool-not-a-WE-standard*). The contract
  and transport are settled upstream (#871/#887); only FUI's consumption is in question.
- **The producer stays maximally permissive.** The creator keeps authoring open DTCG + the #889 open
  import; the *receiver* absorbs the narrowing (most-permissive-default). The narrowing is never pushed up
  into the author (that is option C, the excluded branch).
- **A data-driven/declared binding layer is out of scope (YAGNI).** For 5 props on a fixed demo surface a
  static transform function suffices; a generic declared token-binding engine is over-engineering.

## Ruling — RATIFIED 2026-06-18 (Fork 1 → A, ~85%)

**A — a lossy-by-design DTCG→`--wb-*` mapping/transform in the FUI receiver.** On an incoming
`apply-design-system` message the FUI receiver reads the *whole* resolved #747 manifest (`themeTokens` +
`intentDefaults` + `traitDefaults`), aliases the well-known sources into the 5 fixed `--wb-*` slots with
declared fallbacks, builds a `DesignSystemPreset`, and calls the existing
[`applyDesignSystem()`](../../frontierui/workbench/mount.ts) (`fui:mount.ts:278`). The demo block's CSS
keeps reading the `--wb-*` component-token vocabulary. The mapping is **FUI-owned**; `--wb-*` never crosses
the WE boundary (*impl-is-not-a-standard*; *generator-is-a-tool-not-a-WE-standard*). The producer stays
maximally permissive (open DTCG + #889 Figma/DTCG import); the receiver absorbs the narrowing.

**Amendment — declared, not silent (shape-level, surfaced by the red-team).** Because the `surface` enum is
a genuine 3→2 collapse (`flat|raised|sunken` → `lift|solid`) and radius semantics don't line up
(`sharp|soft|round` → `lg|sm|none`), A must not *silently* drop or guess. The receiver MUST surface a
**declared, inspectable coverage** (what mapped / what dropped / which enum collapsed), and the enum-collapse
table is **ratified data, not a hidden impl guess**. This is the bridge's *shape* commitment; the exact table
entries remain #751's build detail.

**Why not B/C.** B ("stage consumes DTCG directly") is the *deferred* end-state, **not** lossless: the
stage's 5-prop / 2-value-surface ceiling is the real loss and lives in FUI's *rendering* regardless of
vocabulary — B merely hides the same collapse inside CSS instead of a declared table. Revisit B only if the
stage ever becomes a production theming engine (file as a separately-prioritized "stage matures" item, not
the now-call). C (constrain the producer to `--wb-*`) is **excluded on merit**: it breaks the #889 open
import and leaks a FUI render detail up into the Plateau authoring tool.

*Red-team (skeptic sub-agent, prompted only to refute): attack on A FAILED. The "B is lossless" premise is
false — the loss is intrinsic to FUI's 5-prop ceiling, so A is the correct home for it (adapter-as-
normalization-hub). The one landing point — silent loss / guessed enums — is addressed by the amendment, not
by switching to B.* Confidence ~85% (up from the prepared ~80%: grounding verified against the real trees;
the red-team strengthened rather than weakened A).

## Fork 1 — the DTCG → `--wb-*` bridge shape (the core call)

*Fork-existence: the demo block's CSS reads exactly **one** custom-property vocabulary, so it cannot
canonically read both `--wb-*` (A) and DTCG-canonical names (B) — a real either/or. C (constrain the
*producer* to `--wb-*`) is the structurally **excluded** branch: it breaks the #889 open-DTCG/Figma import
and leaks a FUI render-detail up into the Plateau authoring tool, collapsing the tiered model the whole
ecosystem keeps. So this is a genuine merit fork, not prioritization.*

- **A (bold default) — a DTCG→`--wb-*` mapping/transform in the FUI receiver.** On an incoming
  `apply-design-system` message the receiver reads the *whole* resolved #747 manifest (`themeTokens` **+**
  `intentDefaults` **+** `traitDefaults`), selects/aliases the well-known sources into the 5 `--wb-*` slots
  with declared fallbacks (`--wb-accent` ← `color.primary`; `--wb-pad` ← `density`; `--wb-shadow` ←
  `surface`; `--wb-radius` ← `radius` trait; `--wb-font` ← a `type.*` family token; missing slots ← the
  `extends` base default), builds a `DesignSystemPreset`, and calls the existing
  [`applyDesignSystem()`](../../frontierui/workbench/mount.ts) (`fui:mount.ts:277`). **Lossy by design**
  (unmapped tokens drop — the standard filter step). *This is the semantic→component alias layer every
  mature token system ships (Material 3, Style Dictionary); keeps the producer open; keeps the curated demo
  legible ("watch these 5 things change"); the `--wb-*` names never cross the WE boundary, so no standard
  lock-in. A **merit** win, not a cost win — a mapping is unavoidable (open→finite) and the 5 curated slots
  are the demo's point, so B buys illusory fidelity for materially more work.* Residual: the exact table
  entries + enum reconciliation (a build detail, see below).
- **B — the stage consumes DTCG directly.** Rewire the demo block's CSS + every preset
  ([`fui:designSystems.ts`](../../frontierui/workbench/designSystems.ts)) to read DTCG-canonical
  custom-property names. *"Faithful," but (i) the block still has finite hooks, so a selecting transform is
  **still** required — B mostly renames the slots, it doesn't add coverage; (ii) it discards the curated
  component-token abstraction that makes the reskin legible. Materially larger.* The right end-state **only
  if** the stage ever grows into a production theming engine (it's a curated showcase today) — file as a
  separately-prioritized "stage matures" revisit, not the now-call.
- **C — constrain the creator to the `--wb-*` shape.** Force the Plateau author to emit FUI's 5 private
  render props. *Excluded on merit: breaks the #889 DTCG/Figma import (which ingests open token trees),
  leaks a FUI impl detail up into the authoring tool, and inverts the dependency (impl dictating the
  producer's vocabulary). No mature system pushes the component-token tier up into the authoring tool.*

Recommendation: **A**, confidence **~80%**. The survey reframed the call (it's a token-*shape* decision,
not transport/contract — those are #887/#871), hardened the fork-existence lines (C excluded; A vs B the
genuine either/or), and *reduced* the lossiness worry: reading intent/trait defaults gives every `--wb-*`
slot a source, so the bridge is **less** lossy than #751's claim assumed. *Red-team note for the deciding
turn:* the attack on A is "lossy mapping silently drops the author's tokens — B is the faithful path." The
rebuttal grounded in the tree + survey: the stage block has a finite hook count regardless, so B needs the
same selecting filter (Style Dictionary's model) — its "faithfulness" is renaming, not coverage — while A
keeps the producer open and the demo legible. B isn't rejected outright; it's the deferred mature-stage
end-state.

## Out of scope (follow-on build, this card only decides the bridge shape)

The mapping table's **exact entries** — the `--wb-font`/`--wb-shadow` sources and the enum-value
reconciliation between the creator's and FUI's `surface`/`radius`/`motion` vocabularies — are a build
detail of A, constrained by but not decided here. The cross-repo emit+receive wiring (creator
`window.parent.postMessage` + the FUI origin-validated receiver) is #751's build, over the #887-A bus.

## Context

- **Builds on:** #887 (transport + that the resolved/inline manifest crosses the wire — does not re-open),
  #871/#747 (the manifest contract shape), #889 (the open DTCG/Figma import — option C would break it),
  #749 (the switcher + its `applyDesignSystem` injection point).
- **Rhymes with:** #910 (the WE↔FUI tag-alignment fork — same "two impls drifted in vocabulary, reconcile
  at the seam" shape; #910 chose member-surface-only/defer-rename, the analogue of A's lossy-now bridge).
- **Consumed by:** #751 (the "Your theme" capstone — `blockedBy: [930]`); the build proceeds once #930 rules.
- **Prepared 2026-06-18:** prior-art survey (design-token tiers + Style Dictionary transforms) +
  classification done; `/research/creator-manifest-wb-token-bridge/` published (report
  `we:reports/2026-06-18-930-creator-manifest-wb-token-bridge.md`). One genuine fork at DoR with a bold
  default; three forced invariants recorded — `✓ ready to ratify`. Making the call is `/next decision`'s job.
