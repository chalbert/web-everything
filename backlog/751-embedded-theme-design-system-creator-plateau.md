---
type: idea
workItem: story
size: 3
status: open
parent: "746"
locus: frontierui
blockedBy: ["887", "886", "888"]
dateOpened: "2026-06-16"
relatedProject: webdocs
crossRef: { url: /backlog/086-mockup-to-standard-code-tool/, label: "Mockup/screenshot → code (#086)" }
tags: [webdocs, block-explorer, plateau-embed, theme-creator, design-system, lead-gen]
---

# "Your theme" — embed the Plateau design-system creator on the block page and apply it live

The **capstone embed slice** of the creator funnel. Wire a **"Your theme / design system"** button on the
FUI block page that opens the **embedded Plateau creator** (iframe, per the constellation: Plateau owns it,
FUI embeds it) and feeds the author's manifest to the live **#749 switcher** so the created theme applies
to the *real* block immediately — the zero-friction lead-gen seam.

This slice is the integrating capstone: the creator itself (scaffold #886, authoring #888, import #889) is
built Plateau-side; this wires it onto the block page and closes the loop back to the live render.

## Build

- "Your theme" button on the block page → opens the embedded Plateau creator (iframe embed).
- The manifest the author produces in the creator is applied live via the #749 switcher (per the
  transport decided in **#887**).

## Acceptance

- [ ] The button opens the embedded Plateau creator (the #886/#888 surface).
- [ ] A theme authored in the embed applies live to the block via the #749 switcher.
- [ ] The sign-in-to-persist upsell (built in #886) is visible in the embed.

## Notes

Per the managed-offering constellation layering (#091) and the #775 ruling, the creator is a **Plateau**
offering FUI embeds — not built in FUI. This card owns **only the block-page embed + the live-apply
handoff**; the creator build lives in its Plateau siblings.

## Sliced (2026-06-17, `/split 751`)

Was a size-13 catch-all ("not batchable, needs slicing"). Split under the existing parent #746 (kept a
story, not nested as an epic, since #746 is already the epic). The creator build and the open fork were
carved out into siblings; this card was re-scoped to the embed capstone (size 13 → 3) and re-pointed:

- **#886** — Plateau creator domain scaffold (route + mount + seedProvider + upsell CTA).
- **#888** — manual #747 manifest authoring + localStorage (blocked by #886).
- **#889** — DTCG / Figma-file import adapter (free local parse; blocked by #888).
- **#890** — screenshot→theme (paid vision) — **parked**: no vision token-extraction capability exists
  (#086/#382 yield ComponentIR, not tokens).
- **#887** — `type:decision`: the **cross-boundary feed** (how a cross-origin Plateau-authored manifest
  reaches the FUI-resident #749 switcher, and whether the switcher should consume a user manifest vs its
  fixed gallery). Previously buried in this body; now its own card. **This slice blocks on it.**

`blockedBy: [887, 886, 888]` — needs the transport decided, a creator to embed, and a manifest to feed.
Full analysis: `reports/2026-06-17-backlog-split-analysis.md`.
