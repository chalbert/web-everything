---
type: idea
workItem: story
size: 5
status: open
parent: "746"
blockedBy: ["747"]
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
