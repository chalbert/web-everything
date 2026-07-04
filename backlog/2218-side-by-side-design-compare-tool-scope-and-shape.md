---
kind: decision
status: open
locus: plateau-app
dateOpened: "2026-07-03"
relatedTo: ["1649", "1033", "2192", "2193"]
crossRef: { url: /backlog/141-dev-browser-vision/, label: "#141 dev browser — natural home surface" }
tags: [design-tool, compare, brand, dev-browser, decision]
---

# Side-by-side design-compare tool — scope + shape

## Digest

Surfaced 2026-07-03 during the Plateau brand-alignment work: judging a design change *against its
prior/alternative, side by side and sighted* is a recurring manual step — a hand-composited screenshot
board rebuilt each time (logo-vs-site, before-vs-after hero, mark a/b). The app already has three ad-hoc
expressions of the same move: the **Brand Studio a/b proposal cards** (`/brand`), the **Design Review**
single-page critique ([#1033](/backlog/1033-interactive-design-review-loop-analyse-a-page-get-a-critique/)),
and `gen-branding`s static before/after. The idea: a **reusable side-by-side design-compare tool** so
every design change is reviewed against its baseline in one view instead of a throwaway board. This card
is a **go / not-yet / no** validation gate **plus** a genuine shape fork — not a winner-picking fork.

**Recommended lean: go on a thin static compare view; not-yet on live dual-run.** Confidence Medium —
the manual pain is proven (this session), but the heavy end overlaps #1649s dual-run substrate, so ship
the light `iframe`/screenshot compare now and converge later.

## What you are deciding

1. **Earn a slot?** go (build now) / not-yet (gate on a trigger) / no (keep bespoke per-surface boards).
2. **Shape**, along three axes (the real tension):
   - **Dedicated tool vs extracted component** — (a) a first-class "Design Compare" surface in the Tools
     nav that any page embeds; vs (b) just extract the Brand Studio a/b card into a shared component and
     keep comparisons per-surface.
   - **Modality** — side-by-side panes / overlay **slider** (swipe reveal) / **toggle**/onion-skin /
     diff-highlight. (Likely offer more than one; the fork is the *default*.)
   - **Input & liveness** — live routes (two `iframe`s) / captured screenshots (as `gen-branding` does) /
     SVG/mark variants / component states; and **static capture vs live dual-render**.

## Relation to prior art (do not duplicate #1649)

- **#1649 branch-and-run diff** = a *semantic* branch-vs-branch diff (declared **state / render / rules**)
  for **change-safety/regression**, gated on the #142 capture substrate + live dual-run.
- **This card** = a *design/aesthetic* comparison of variations (before/after, a/b, current-vs-proposed)
  for **brand + design judgment**, feeding design critique (#1033) and the design-AI reviewer (#2192) /
  brand program (#2193).
- **Convergence question:** the *live dual-run* end of this tool **is** #1649s substrate. Default:
  keep this one **static/light** (screenshots + `iframe`, no capture backend) so it ships independent of
  #142; converge onto the shared dual-run only when #1649 un-gates. Sibling tools now, one substrate later.

## Home

`locus: plateau-app` — a dev/design tool ([#141](/backlog/141-dev-browser-vision/)), local-first /
zero-server (both sides render locally; no diff backend to host). The reusable split/compare *view* is a
candidate **FUI component** (impl lives in FrontierUI per the constellation) — a placement sub-question to
settle at build, not now.

## Next

Unprepared. Run `/prepare` to survey prior art (Chromatic/Percy side-by-side, Storybook, Figma compare,
Juxtapose-style reveal-sliders), set each axiss **bold default**, and ready it for a fast ratification —
rather than deciding cold.
