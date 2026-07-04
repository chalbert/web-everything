---
kind: epic
status: open
locus: webeverything
relatedTo: ["2209", "2207", "2208"]
dateOpened: "2026-07-04"
tags: [branding, design, marks, website, epic]
---

# Constellation branding and website design

Finalize and ship the constellation's visual identity — the three brand marks (Web Everything,
Frontier UI, Plateau), the system-wide visual language, and a proper review/redesign of the Web
Everything website (which was never correctly reviewed). This is the *execution* epic that consumes the
prepared rubric decision #2209, is grounded by the reference corpus + design-AI reviewer (#2207), and is
watched going forward by the design-intelligence program (#2208).

## Status honest snapshot (2026-07-04) — heavy prep, zero shipped outcomes

**Done (infrastructure / exploration / prep):** the branding pipeline + two pages
(`plateau:branding.html` gallery+journeys, `plateau:branding-refs.html` — 85 cited case studies), the
`brand-mark-loop` skill + `plateau:scripts/render-mark.mjs` + `plateau:branding-proposals/loop/LOOP-LOG.md`,
the prepared decision #2209 (ready-to-ratify, NOT ratified), the #2207 training card + learning log, the
#2208 program, and ~40 explored candidate marks across 8 WE rounds + 3 FUI rounds + 1 Plateau probe.

**NOT done (the actual outcomes):** no final mark shipped for any project (live favicons/logos unchanged),
#2209 not ratified, visual language undecided, website not reviewed/redesigned, icon-set cleanup +
`check:branding` gate + cross-repo icon realignment + gradient normalization all outstanding.

Full handoff + recommended order: `plateau:branding-proposals/TRANSITION.md`.

## Children (transition order — upstream decisions gate the rest)

- **#2249** decide the system-wide visual language (flat vs rich-dimensional) — gates all marks + site.
- **#2250** WE mark system call (multi-color umbrella vs monochrome) — amendment to #2209.
- **#2251** finalize the WE mark (constellation Venn, executed properly).
- **#2252** finalize the FUI mark (Round-3 shortlist through the loop).
- **#2253** finalize the Plateau mark (flat vs rich).
- **#2254** Web Everything website UI — review & redesign direction (big; will slice).
- **#2255** ratify #2209 + brand-asset rollout (favicons, mark files, cross-repo icons, gate, cleanup).

## Method

Every mark task runs the `brand-mark-loop` skill (sighted render→critique→red-team→edit→converge; read
`plateau:branding-proposals/loop/LOOP-LOG.md` first). The website task dogfoods the design-AI reviewer
(#2207). Nothing here is "done" until an asset actually changes in a product repo and the gate is green.
