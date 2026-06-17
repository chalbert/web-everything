---
type: idea
workItem: story
size: 13
status: open
parent: "746"
blockedBy: ["747", "788", "775", "749"]
dateOpened: "2026-06-16"
relatedProject: webdocs
crossRef: { url: /backlog/086-mockup-to-standard-code-tool/, label: "Mockup/screenshot → code (#086)" }
tags: [webdocs, block-explorer, plateau-embed, theme-creator, design-system, lead-gen, dtcg]
---

# Embedded theme / design-system creator (Plateau embed) — "Your theme" → build a custom design system

Wire a **"Your theme / design system"** button on the block page that opens an **embedded Plateau component** for authoring a custom design-system manifest (#747). It saves to **localStorage only**, with a "sign in to Plateau to persist/share" upsell — a zero-friction lead-gen seam that gets Plateau known. The created manifest feeds the live switcher (#749) so the author sees it applied to the real block immediately. Two ingest paths: import DTCG/Figma tokens via an ingest adapter, and extract a theme from a screenshot (the #086/#382 mockup-to-code loop reused as the platform funnel).

## Build

- "Your theme" button → embedded Plateau theme/design-system creator (iframe/component embed, per the constellation: Plateau owns it, FUI embeds it).
- localStorage persistence of the in-progress manifest; "sign in to persist/share" upsell CTA.
- Output is a #747 manifest applied live via the switcher (#749).
- Import: DTCG / Figma tokens through an ingest/normalization adapter (adapter-as-normalization-hub).
- Screenshot→tokens: hook into #086 / #382 to derive a token set from a brand image.

## Acceptance

- [ ] The button opens the embedded Plateau creator; a created theme saves to localStorage and applies live to the block.
- [ ] The sign-in-to-persist upsell is present.
- [ ] At least one import path (DTCG or screenshot) produces a usable manifest.

## Notes

Hard-blocked on **#747** (the manifest format the creator emits). Per the managed-offering constellation layering (#091) the creator is a **Plateau** offering FUI embeds — not built in FUI. Screenshot→tokens should consume the existing #086/#382 pipeline, not re-implement vision (vision is a Plateau service; no-leakage client).

## Blocked-in-fact — the creator + switcher it embeds don't exist yet (2026-06-16, batch-2026-06-16)

Claimed in a batch; verified the prerequisites before building (the #752 sibling was genuinely an
integration slice because the Plateau Technical Configurator already existed — this one is not). The
declared blockers (#747 format-decision, #788 transport) are resolved, but #751's *real* dependencies are
absent:

- **The embeddable Plateau theme/design-system creator does not exist.** No theme/design-system creator
  surface in `plateau-app/src` (only `profiles/` governance-persona schema mentions "design-system"). The
  creator is a **separate, still-open `type: decision` — [#775](/backlog/775-design-system-creator-assembler-open-core-layering-simple-fu/)**
  (the creator/assembler open-core layering, Tier B, ready to ratify but unratified → unbuilt). #751 *embeds*
  that creator; it can't embed what isn't designed/built.
- **The live switcher it feeds is unbuilt** — [#749](/backlog/749-live-theme-design-system-switcher/) is
  `status: open, locus: frontierui`. #751's body ("the created manifest feeds the live switcher #749")
  presumes it exists.
- #747 ratified the manifest *format* but `graduatedTo: none` (no concrete schema artifact yet).

So #751 was mis-flagged batchable: its `[747, 788]` edge was satisfied while the load-bearing deps (#775
creator, #749 switcher) were implicit and open. Fixed the real DAG edge — added `blockedBy: 775, 749`.
Building the creator here would pre-empt the #775 open-core decision by fiat (a quiet design call this
batch must not make). Released unworked; resumes once #775 ratifies + the creator and #749 switcher exist.

## Re-surfaced + resized 5→13 (2026-06-17, batch-2026-06-17)

Two of the prior blockers have since cleared — **#775 ratified** (the open-core layering decision, `graduatedTo: none`) and **#749 shipped** (the switcher, built FUI-resident this batch). But the item is still **not batchable**, for two reasons the cleared edges don't address:

1. **The embeddable Plateau creator surface still does not exist.** #775 was a *decision*, not a build (`graduatedTo: none`) — it authorized the creator but spawned no build item, and `plateau-app/src` has no theme/design-system creator surface (verified). #751 as written is not a thin "embed" slice; its Build list is the whole creator (authoring UI + localStorage + sign-in upsell + DTCG/Figma import adapter + screenshot→tokens via the #086/#382 vision pipeline) **plus** the embed. That is **epic-scale**, not size 5 — resized to 13; it should be sliced (creator-build · embed-on-block-page · ingest adapter · screenshot→tokens).
2. **Cross-boundary feed is an open question.** The body says "the created manifest feeds the live switcher (#749)" — but #749 shipped **FUI-resident** (its presets live in `frontierui/workbench/designSystems.ts`; the workbench is same-origin FUI-owned with **no WE↔FUI channel**, #809). How a *Plateau*-authored manifest reaches that switcher (and whether the switcher should consume a user-supplied manifest at all, vs. its fixed gallery) is undecided — surface it when slicing (it rhymes with the #881 mode-C host-config transport fork).

Stays `open`, blocked in fact on the unbuilt creator; dropped from the batch pool by the resize. Needs a focused session to slice.
