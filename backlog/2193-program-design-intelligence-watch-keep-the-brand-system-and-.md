---
kind: epic
ongoing: true
status: open
locus: plateau-app
relatedReport: reports/2026-07-03-constellation-branding-system.md
relatedTo: ["2191", "2192", "1034", "1552"]
dateOpened: "2026-07-03"
tags: [program, branding, design-review, ai-judge, training, watch]
---

# Design-intelligence watch — keep the brand system and its AI reviewer living

A two-front program (per the [Program Test](/backlog/1249-define-program-strictly-the-four-part-bar-for-a-perpetual-on/))
that folds the 2026-07-03 branding research into a perpetual loop: the constellation's brand system
stays conformant, and the design-AI reviewer stays better-informed than a stock model. Filed at the
user's direction ("the research you are doing can be folded into one of our programs — or a new one
if better"; no existing program owns brand/design intelligence — #1257 owns platform standards,
#1552 owns the explorer's UI-issue judge; this is the *brand & design-judgment* sibling).

## The two fronts

- **Front A — conformance (internal):** the constellation's own brand assets conform to the ratified
  system (#2191: rubric, naming canon, mark rules, icon-template floor). Surfaces: the
  `plateau:branding.html` gallery + journey trees (regenerated on any asset change), the
  `check:branding` gate story, and drift checks (spelling variants, palette drift, template
  violations — all measured first in the #2191 prep). Metric (to build): count of live brand-rule
  violations across the three repos.
- **Front B — currency (external):** the design world moves — rebrands ship, critiques publish,
  methods evolve — and user labels accumulate. Discovery: sweep design press/blogs (Brand
  New/UnderConsideration, Logo Design Love, Design Observer, etc.), file new
  `plateau:branding-refs/` case studies (exemplars AND failures — no size cap, per the user), append
  new in-session user judgments to #2192's learning log, and re-run the reviewer-agreement eval
  against the grown fixture. Each sweep hit is triaged: new library entry · new rubric lesson ·
  reviewer re-eval.

## Corpus & fixtures (the program's assets)

- `plateau:branding-refs/` — the reference library: exemplar + failure case studies + failure
  patterns + brand-system studies + reading list, one JSON per entry, web-grounded with `sources`
  URLs (not model-recall alone — user rule). Rendered as a plateau page (private to the user; NOT
  the public WE site — user scoping 2026-07-03).
- `plateau:branding-proposals/` + `plateau:branding-proposals/journey.json` — the labeled fixture:
  every candidate, every verdict edge, every user pick (#2192's ground truth).
- `we:src/_data/researchTopics/constellation-branding-system.json` — the methodology knowledge base
  (public /research/ page).

## Maturity & status — L0→L1 in progress

The corpus exists and is growing (founding sweep 2026-07-03: ~85 entries — 44 exemplars incl. 12
web-grounded expansion + 10 brand systems, 14 rebrand failures, 10 failure patterns, 15 readings);
the metric, cadence, and eval harness are not built. L0→L1 carve:

1. `check:branding` gate (front-A metric) — child story, filed on #2191 ratify.
2. Library render page in plateau + growth loop runnable by hand (front-B sweep, re-runnable
   idempotently via `/review-program`).
3. #2192 eval harness (agreement metric vs the journey labels) — graduate to scheduled cadence only
   after a manual track record.

## Review log

- **2026-07-03 — founding run (during the #2191 prep session).** Corpus seeded: brand review +
  proposals + journey trees on `plateau:branding.html`; 6-fork decision #2191 prepared (✓ ready to
  ratify); #2192 training card filed with learning log (6 labels/corpus notes, 2 method notes);
  reference library seeded with ~85 web-grounded, cited entries across five wings by 8 parallel
  research agents. Next run: render the library page, build the front-A metric, first
  reviewer-agreement baseline.
