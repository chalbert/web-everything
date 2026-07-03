---
kind: story
size: 8
status: open
locus: webeverything
parent: "2193"
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

## Learning log — labels & method notes accumulated so far (append here as they land)

Every user brand judgment in-session is a training label; log them with the principle they encode:

- **2026-07-03 · label:** Plateau dual-mesa mark = user favorite of all constellation marks →
  principle: concept-bearing symbol beats idea-less letterforms; 16px legibility is load-bearing.
- **2026-07-03 · label:** W-only favicon candidate rejected-in-discussion — "could be a logo of
  anything" → principle: **ownable/distinctive is a mandatory baseline attribute** for every mark;
  operational test the reviewer must run: *"could this be another brand's logo?"* (W is crowded
  territory: Wikipedia/WordPress/Wix). Color/container carry recognition at 16px but do not excuse a
  generic glyph. This also exposed a rubric gap (no distinctiveness attribute in any set) — fixed in
  #2191 Fork 6 as the shared baseline attribute.
- **2026-07-03 · label:** FUI horizon candidate (static sunrise) challenged — "not very kinetic" →
  principle: candidates must serve the *full* owning attribute set, not most of it; a static
  composition fails a `kinetic` attribute regardless of other virtues. The reviewer should score
  every attribute explicitly and treat any ✗ on the owning set as a flag, exactly as the user did.
- **2026-07-03 · method:** parallel multi-lens exploration (kinetic-first / landscape-family /
  concept-bearing-letterform / distinctiveness-maximalist agents) → render side-by-side at 64/32/16 →
  score against the rubric → user picks. Each round yields (candidate, self-score, reviewer-score,
  user-pick) tuples — the training-data generator for this card. Keep the round artifacts in
  `plateau:branding-proposals/` so the fixture grows.
- **2026-07-03 · label (user):** WE brief redirected to "all-encompassing — the Theory of Everything,
  but for the web" → principle: the mark should transmit *unification/containment of everything*, not
  just letterforms; W = E (Web equals Everything) is available brand language. Round-3 candidates
  WE-06..WE-11 explore it (unification + containment lenses).
- **2026-07-03 · corpus (user):** reference library commissioned at `plateau:branding-refs/` — "a big
  library of very good logos, their meaning and the branding they represent", grounded in published
  design writing ("not just your take" — entries carry `sources` URLs), INCLUDING failures ("a list
  of bad logos would also be very valuable") with **no size cap** ("there is no number too large").
  Wings: exemplars, failures, failure patterns, brand systems, reading list. Rendered as a plateau
  page (private to the user — NOT the public WE site); growth owned by program #2193.
- **2026-07-03 · method (user):** "getting to a design is following branching decisions into a maze,
  each time getting closer to the goal" → represent each mark's exploration as a **design-journey
  tree** (`plateau:branding-proposals/journey.json`, rendered on the branding page): nodes =
  candidates, edges = labeled verdicts (`picked` / `rejected: <attribute>` / `refine →`), columns =
  rounds; multiple candidates may carry `refine` edges forward (tournament, not single-elimination).
  The tree is simultaneously the review UI and the training corpus — an AI reviewer can be evaluated
  on whether it predicts each edge's verdict before seeing the next round.
- **2026-07-03 · label (user):** FUI-11 (sheared strata) REJECTED — "very busy [and] has no meaning" →
  principle: **a distinctive silhouette is not an owned meaning** (the Vercel-triangle trap in the
  library). The reviewer (and I) over-weighted ownable-silhouette and under-weighted concept-bearing;
  when the two conflict, meaning wins. My own earlier "strongest on the board" call was wrong on its
  own rubric — a self-miss worth training against.
- **2026-07-03 · label (user):** FUI-07 (ridge surge) — "not bad" but reads as a **sailboat** →
  principle: run the adversarial second-read on EVERY finalist, not just the ones that look risky
  (London 2012 / OGC). A peak-over-line silhouette is a latent sail; the reviewer should surface
  plausible second readings unprompted.
- **2026-07-03 · label (user):** WE-11 (negative-space inner set) FRONT-RUNNER, WE-10 (W-arms embrace)
  runner-up — "I like WE-10 and WE-11, maybe WE-11 more" → principle: the winning WE direction is
  concept-in-form that *means* "encompasses everything," not a bare letter. Confirms the ownable +
  concept-bearing pair over pure-letterform W marks. WE-11 still owes a 16px-on-gradient validation.
- **2026-07-03 · label (user):** FUI-05 (sun with lift echo) — "underlying principle has something, execution is clunky" → principle: **separate the mechanic from its rendering.** A good device (motion-by-positional-echo / afterimage) can be buried under a clunky skin; the reviewer should EXTRACT and name the reusable principle even while rejecting the artifact, and carry it forward. Rejecting a candidate ≠ rejecting its idea.
- **2026-07-03 · label (user) — META:** after all rounds, the **Plateau mesa favicon is STILL the best mark, and the WE/FUI candidates "don't feel in the same family."** → principle: **family coherence is a first-class axis, scored ACROSS marks, not per-mark.** The mesa is the family ANCHOR (a solid geometric landform in a solid + reduced-opacity echo grammar); a candidate must visually rhyme with it, not merely score well alone. This surfaces a real tension the reviewer must weigh: the per-mark winners (WE-11/WE-10 are letterforms — a different visual system) vs the landscape-lens marks (bedrock-strata / ridge / terrace) that share the mesa's grammar but scored lower individually. A pile of individually-good marks that don't cohere is a failed system — the Lufthansa/IBM lesson (family = shared geometric discipline).

## Scope notes

- Applies to branding assets (marks, icons, palettes, lockups) *and* UI design review guidance — the
  same grounding pattern (cite the owning rule) extends #1034's page critiques.
- Out of scope: building new review UI; this is judge quality (context, rubric grounding, eval fixture).
