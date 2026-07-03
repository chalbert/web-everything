---
kind: story
size: 8
status: open
locus: webeverything
relatedTo: ["2191", "1034", "1552", "1167"]
dateOpened: "2026-07-03"
tags: [design-review, ai-judge, branding, training, review-design]
---

# Train the design-AI reviewer for branding & UI guidance — grounded, consistent, better than stock AI

Card for later (filed 2026-07-03 during the branding review). Goal: the design-AI reviewer
(`/review-design`, #1034; trainable-judge lineage #1552/#1167) should give **branding and UI design
guidance that is more consistent and better-informed than a stock AI** — verdicts grounded in *our*
ratified system, not generic design opinions.

## Direction

- **Knowledge base = the codified layer, not prompt vibes:** the #2191 brand rubric (Fork 6 attribute
  sets + landscape narrative), the branding-methodology research topic
  ([/research/](/research/#constellation-branding-system)), the design principles behind #1034's
  scoring, and the platform statutes. The reviewer cites the owning attribute set / rule in every
  verdict, the same way decisions cite statutes.
- **First labeled ground truth = this branding review (the testing ground):** the
  `plateau:branding.html` gallery + `#proposals` section, with the user's ratified picks from #2191 as
  labels. Re-running the reviewer over the proposals page and scoring agreement with the ratified picks
  is the regression fixture — a candidate judge that prefers the excluded branches regresses.
- **Eval loop before feature work:** define the agreement metric first (per-fork pick agreement +
  rationale-cites-rubric), baseline stock-AI behaviour, then iterate prompt/context/fine-tuning against
  the fixture. New brand decisions append to the label set over time.
- **Methodology choice is #2191 Fork 6** — if (a) ratifies, the rubric is checklist-scoreable by
  design; this card consumes it, it does not re-decide it.

## Scope notes

- Applies to branding assets (marks, icons, palettes, lockups) *and* UI design review guidance — the
  same grounding pattern (cite the owning rule) extends #1034's page critiques.
- Out of scope: building new review UI; this is judge quality (context, rubric grounding, eval fixture).
