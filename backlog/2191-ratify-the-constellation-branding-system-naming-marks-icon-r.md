---
kind: decision
size: 3
status: open
locus: webeverything
relatedReport: reports/2026-07-03-constellation-branding-system.md
relatedTo: ["1034", "2192", "1283"]
dateOpened: "2026-07-03"
tags: [branding, design, naming, favicon, logo, iconography, brand-philosophy, decision]
---

# Ratify the constellation branding system — philosophy, naming, marks, icon rules

The 2026-07-03 cross-project branding review (rendered gallery: `plateau:branding.html`, generated
by `plateau:scripts/gen-branding.mjs` from the live assets of all three repos) found the brand
*system* already coherent — all three marks share one construction (40×40 squircle, `rx="12"`, 45°
gradient, white glyph; `we:src/assets/logo.svg`, `fui:src/assets/logo.svg`, `plateau:favicon.svg`) with
one hue per project — but six live choices sit unratified, plus a tier of mechanical drift.

**Visual candidates for every mark fork are rendered side by side (64/32/16 px) at
`plateau:branding.html#proposals`** (on the plateau dev server, port 4000; candidate sources:
`plateau:branding-proposals/` SVGs + manifest). Survey, inventory, and the branding-methodology
write-up that grounds Fork 6 (kept durable for the #2192 design-AI reviewer training):
[report](../reports/2026-07-03-constellation-branding-system.md) ·
[/research/](/research/#constellation-branding-system).

### Recommendation at a glance

| Fork | Recommended default | Main alternative (excluded) | Confidence |
|---|---|---|---|
| 1 — canonical prose name of the impl repo | **(a) "Frontier UI"** | (b) "FrontierUI" | Med-high (~75%) |
| 2 — WE mark at favicon sizes | **(b) W-only favicon variant ≤32px** | (a) identical W+ghost-E at all sizes | High (~85%) |
| 3 — FUI mark strategy | **(b) symbol-first, sub-fork (b1) horizon** | (a) keep FUI letterforms | Medium (~65%) |
| 4 — Plateau violet: one value | **(a) favicon adopts token `#6453f4`** | (b) token retints to favicon `#6d5efc` | High (~90%) |
| 5 — Plateau mark geometry | **(a) keep current dual mesa** | (b) grounded / (c) strata restatement | High (~85%) |
| 6 — brand philosophy: how reviews judge | **(a) attribute-driven rubric + landscape narrative** | (b) archetype framework / (c) uncodified taste | Med-high (~75%) |

## Fork 1 — canonical prose spelling: "Frontier UI" vs "FrontierUI"

**Why it's a fork (real either/or):** both spellings are coherent conventions, but a canonical prose
name is definitionally singular — today the ecosystem majority writes "Frontier UI" (179 occurrences
across WE + plateau src) while the product's own repo writes "FrontierUI" (34), so the product disagrees
with its ecosystem about its own name and only a ruling settles it. Code identifiers are out of scope:
`frontierui` (pkg name) / `frontier-ui` stay as-is under both branches.

- **(a) "Frontier UI" — two words. [bold default]** Matches the existing prose majority (179 vs 34, so
  the smaller tree migrates); two-word wordmarks read better in running text and lockups (see the Fork 1
  lockup render on the proposals page); precedent: mainstream libraries style multi-word product names
  with spaces in prose ("Material UI", "Chakra UI", "Radix UI") while keeping compound package ids.
- **(b) "FrontierUI" — compound.** Matches the repo's self-designation and the `frontierui` package id
  1:1; migration burden lands on the larger tree (179 sites), and camel-compound prose names are the
  minority convention in the reference-library cohort.

Skeptic: SURVIVES — attack was "the repo's self-spelling is the authoritative one; ecosystems adapt to
products, not vice-versa." Rejected on evidence: FUI's own `fui:package.json` description is the *only*
identity-bearing string, and the 34 uses are mechanical README/comment echoes, not a styled wordmark;
no shipped artifact renders "FrontierUI" as a brand surface, so there is no recognition cost to (a).
Screen: clear — pure naming call, no impl detail, merit (one canonical name) not prioritization.

## Fork 2 — WE mark at favicon sizes: identical everywhere vs W-only small variant

**Why it's a fork (real either/or):** the shipped `we:src/assets/favicon.svg` is a single artifact; it
either stays the full W+ghost-E mark or becomes a size-specific simplification — both coherent brand
policies (strict mark consistency vs size-tuned legibility) that cannot both hold for the one file.

- **(a) current W + ghost-E at all sizes.** One mark everywhere; zero work. But at 16px the reflected E
  is ~3px tall at 60% opacity — it renders as under-glyph noise (see the 16px cells on the proposals
  page), and the favicon is the mark's highest-frequency surface.
- **(b) W-only favicon variant at small sizes — [bold default].** Keep the full W+E mark at ≥32px
  (header logo, social cards); ship a W-only, heavier-stroke (2.5→3) favicon
  (`plateau:branding-proposals/fork2-b-w-only.svg`). Size-tuned mark simplification is standard
  practice in the reference cohort (mark-only favicons while the full lockup lives at larger surfaces —
  GitHub's invertocat-only favicon vs its wordmark; Firefox's 2019 simplified-mark system; icon-font
  vendors ship per-size optical grades). Cost: two favicon variants to keep in sync — bounded by the
  gate story below.

Skeptic: SURVIVES-WITH-AMENDMENT — attack was "the ghost-E *is* the identity (W+E = Web Everything);
dropping it at the most-seen size erodes the pun to a generic W." Folded in: (b) is scoped to ≤32px
*favicon* surfaces only, and the ruling should mandate the full mark on every surface ≥32px so the W+E
identity stays canonical; the favicon is a legibility-degraded echo, not the identity carrier.
Screen: clear — observable brand surface, not impl; merit (legibility at the highest-frequency size).

## Fork 3 — FUI mark: keep letterforms vs symbol-first redesign

**Why it's a fork (real either/or):** one mark ships; "FUI" letterforms and a symbol are mutually
exclusive as the primary mark. Both are coherent: letterforms maximize name-recognition, a symbol
maximizes distinctiveness and small-size quality (the review's mesa bar).

- **(a) keep FUI letterforms.** Legible, zero work, name-first. But it's the weakest mark in the
  review: three crammed strokes, no idea, and the 85%-opacity U/I reads as accidental fading; it fails
  the symbol-first quality bar the user validated on the Plateau mesa.
- **(b) symbol-first redesign — [bold default].** Three candidates rendered on the proposals page, all
  in the existing teal→cyan hue and squircle construction:
  - **(b1) horizon — sun over the frontier line. [recommended sub-fork pick]** Literal "frontier";
    simplest geometry, cleanest at 16px; and under the Fork 6 landscape narrative it completes a
    *motif family* with Plateau's mesa — the implementation is the horizon where the standard meets
    ground, the product is the plateau built on it. One motif family across the constellation is a
    brand asset no letterform can give.
  - **(b2) boundary-marker flag** — planted-flag metaphor; slightly busier at 16px.
  - **(b3) past-the-edge arrow** — exploration metaphor; generic arrow risk (reads "share"/"export").
- Rollout note if (b): WE's category icon `we:src/assets/icons/frontierui.svg` (currently "FU") follows
  the ratified mark (Supported-by-default alignment below).

Skeptic: SURVIVES-WITH-AMENDMENT — attack was "recognition continuity: FUI is referenced across three
repos and a rebrand invalidates learned association for a pre-1.0 audience of one team; also (b1)'s
semicircle-on-line risks reading as a generic 'sunrise/weather' glyph out of context." Folded in: the
audience-of-one-team fact *cuts the other way* (rebrand cost ≈ zero now, maximal later — if (b) ever
wins, it wins cheapest today); the weather-glyph risk is real but mitigated by the hue + squircle
system carrying the identity, and the horizon's second line (the echo line below) keeps it landscape,
not weather. Confidence stays Medium — this is the fork where taste legitimately dominates.
Screen: clear — mark choice is boundary-observable; merit (distinctiveness/16px quality vs recognition).

## Fork 4 — Plateau violet: favicon `#6d5efc` vs token `#6453f4`

**Why it's a fork (forced alignment, two coherent resolutions):** the mark and the token layer state
two different brand violets — drift, not intent. Exactly one value can be *the* Plateau violet; the
fork is only which side moves.

- **(a) favicon adopts the token `#6453f4` — [bold default].** `plateau:src/styles/theme.css` is
  GENERATED from the DTCG token source `plateau:src/styles/tokens.json` (#1283) — the ratified single
  source of truth for Plateau's theme; the favicon is a hand-authored asset that drifted. Align the
  derived artifact to the source of truth, not vice-versa. The change is one gradient stop:
  ```svg
  <!-- plateau:favicon.svg -->
  <stop stop-color="#6453f4"/>   <!-- was #6d5efc; end stop #16d3e6 already matches --color-accent -->
  ```
  Side-by-side render on the proposals page shows the shift is imperceptible at favicon sizes — this
  alignment is visually free.
- **(b) token retints to `#6d5efc`.** Coherent only if the favicon violet is judged *better*; but that
  retint cascades through every `--color-primary*` consumer (hover, light, gradients) for no observable
  brand gain, and inverts the token-source-of-truth discipline.

Skeptic: SURVIVES — attack was "gradients are perceptual: the favicon author may have brightened the
start stop deliberately to compensate for the cyan blend." Rejected: the favicon predates the DTCG
token layer's ratification; no authored rationale exists in-tree, and the side-by-side render shows no
perceptual loss. Screen: clear — one-knob value alignment with a source-of-truth principle deciding it;
not a config dimension (the *drift* is the flaw, both values persisting is the broken branch).

## Fork 5 — Plateau mark geometry: keep dual mesa vs refinements

**Why it's a fork (real either/or):** one mark ships; the current dual mesa and the two refinement
candidates are mutually exclusive geometries. Filed *because the favorite mark still deserves the
critical pass* — the candidates test its two arguable weaknesses (the mesas float unanchored; the
front/back overlap is heavy at 16px).

- **(a) keep the current dual mesa — [bold default].** It's the review's quality bar and the
  user-validated favorite; both critiques are mild and neither refinement clearly beats it side by side
  (see proposals page, Fork 5 row).
- **(b) grounded dual mesa** — adds a horizon baseline; anchors the composition but adds a third
  element at 16px and (with Fork 3 b1) makes the horizon line do double duty across two marks.
- **(c) stacked strata mesa** — restates the mesa as tiers, echoing WE's `we:src/assets/icons/plateau.svg`
  category icon; strongest small-size silhouette of the three, but reads more "layers/stack" than
  "plateau" and breaks from the silhouette the user already prefers.

Skeptic: SURVIVES — attack was "(c) is objectively stronger at 16px (three solid bands beat overlapping
translucent shapes) and rhymes with the WE category icon; preferring (a) is pure incumbency." Rejected
on merit: (a)'s overlapping-mesa depth *is* the distinctive feature — (c)'s banded pyramid is closer to
generic 'layers' iconography (higher collision risk with stack/layers glyphs), and cross-repo rhyme is
achieved more cheaply by aligning `we:src/assets/icons/plateau.svg` to the ratified mark (alignment
work below). Screen: clear — mark geometry, boundary-observable; merit not prioritization (all three
are built).

## Fork 6 — brand philosophy: what should each brand transmit, and how do reviews judge it?

**Why it's a fork (real either/or):** every brand call so far (including this item's own defaults) was
argued from ad-hoc taste + precedent. A review rubric is singular — the next brand review either scores
against a codified value set, against an archetype narrative, or against nothing; the branches produce
*different verdicts on the same candidate* (e.g. Fork 3 b3's "generic arrow" is a hard fail under an
attribute rubric containing "distinctive", but survives uncodified taste), so they cannot coexist as
the house method. The methodology survey grounding the options is in the
[report](../reports/2026-07-03-constellation-branding-system.md) and published at
[/research/](/research/#constellation-branding-system) — kept durable as the knowledge base for the
#2192 design-AI reviewer.

- **(a) attribute-driven rubric + one shared narrative — [bold default].** The mainstream working
  method of design-system brand guides (voice-and-tone + brand-expression docs): distill each brand to
  3–4 attributes and one target feeling, then every review — human or AI — scores candidates against
  the owning attribute set. Proposed sets (rendered as lockups on the proposals page):
  - **Web Everything** — *universal · principled · inevitable*; target feeling: **calm trust** — it
    should feel like bedrock ("The web is the platform").
  - **Frontier UI** — *pioneering · pragmatic · kinetic*; target feeling: **capable momentum** — the
    working edge where the standard meets real ground.
  - **Plateau** — *elevated · steady · commanding*; target feeling: **assured overview** — high flat
    ground: see everything, stable footing.
  - **Shared narrative (the landscape story):** bedrock → horizon → plateau. One geological metaphor
    spanning the constellation: WE is the ground everything stands on, FUI is the horizon where new
    ground is claimed, Plateau is the high ground you operate from. It retro-explains the mesa (the
    user-validated favorite), motivates Fork 3 (b1), and gives icon/mark work a generative rule
    instead of a style cop.
  Attribute rubrics are checklist-scoreable — exactly the shape an AI judge can be trained and
  regression-tested on (#2192), which archetypes and taste are not.
- **(b) archetype framework.** Assign each project a brand archetype (WE ≈ Sage, FUI ≈ Explorer,
  Plateau ≈ Ruler) and judge candidates by archetype fit. Richer storytelling vocabulary, and the
  archetype labels map suspiciously well — but scoring "is this mark Sage-like?" is fuzzier than an
  attribute checklist, and the framework's brand-marketing framing (audience persuasion) overshoots
  three developer-facing repos.
- **(c) keep philosophy uncodified.** Zero authoring cost and maximal flexibility; but it is exactly
  the state that produced this item's drift tier (three spellings, two violets, one amber Plateau),
  and it leaves nothing for #2192 to train against — an AI reviewer without a codified rubric can only
  reproduce generic-AI design opinions, the precise failure the training card exists to avoid.

Skeptic: SURVIVES-WITH-AMENDMENT — attack was "codifying attributes this early fossilizes a
one-session aesthetic into statute; and the landscape narrative is post-hoc rationalization of marks
that already exist." Folded in: the attribute sets are ratified as **defaults with a review horizon**,
not immutable statute — the research topic carries `reviewHorizon: P6M` so the sets get a standing
re-look; and post-hoc is how most real brand systems are codified (the narrative earns its place by
*predicting* future calls correctly, which the rubric's regression fixture (#2192) will actually
measure). Screen: clear — the rubric is a review-process artifact (observable in every future brand
verdict), not an impl detail; choosing the judging method is merit, not prioritization.

---

## Supported by default (not decisions)

- **"WebEverything" (camel) is banned** — a third spelling variant with zero design rationale (11 uses,
  all in `plateau:src/`), contradicting the prose majority in every repo. Flawed branch, not a fork;
  ratification codifies the ban alongside Fork 1's pick.
- **Cross-repo referring icons must match the referent's own ratified brand** — forced invariant (an
  icon of a *named product* that contradicts that product's mark is wrong, not a style choice):
  `we:src/assets/icons/plateau.svg` (amber) realigns to Plateau's violet/cyan mesa;
  `we:src/assets/icons/frontierui.svg` ("FU") realigns to the Fork 3 outcome.
- **Icon-set template rules are script-decidable → gate, not judgment** — `we:src/assets/icons/_template.svg`
  already mandates the shape (128 viewBox, min-6 stroke, palette gradients, container + floatShadow);
  the live set violates it (1 icon at `viewBox="0 0 24 24"`, stroke-widths 2–12 across 61 icons). Per
  the hookable-vs-judgment rule, enforcement is a `check:branding` validator in `check:standards`, filed
  as a follow-up story. (The Icon *Intent* — `we:src/_data/intents/icon.json` — governs product
  iconography dimensions and is untouched by this item; these are site-asset authoring rules, a
  different layer.)
- **Broken/weak icon rebuilds are stories, not forks** — `we:src/assets/icons/webtraces.svg` (a single
  circle), `we:src/assets/icons/weblayout.svg` (off-template 24×24 outline duplicating `layout.svg` —
  merge them), and the thin red-stroke subfamily (`anchor`, `layout`, `loader`, `message`, `navigation`,
  `temporal`, `range-anchor`) rebuild to the strong-tier shape. Which to rebuild first is
  prioritization, decided at scheduling time.

## Context

- **Classification (per-fork pass):** branding is repo/site meta-asset authoring — no WE standard
  artifact, protocol, or intent changes anywhere in this item; nothing crosses the WE↔FUI impl boundary.
  `locus: webeverything` because the statute (spelling ban + template-gate rule + Fork 6 rubric)
  codifies here; the asset edits fan out per repo as children.
- **On ratify, file the children:** WE favicon small-variant (Fork 2), FUI mark rollout (Fork 3),
  Plateau favicon stop alignment (Fork 4), cross-repo icon realignments, the `check:branding` gate
  story, the icon-rebuild batch, and — if wanted — a Plateau full-logo lockup build (mesa + wordmark;
  Plateau currently has no logo asset at all, favicon only).
- **Testing-ground link:** the ratified picks (all six forks) become the first labeled ground truth for
  the design-AI reviewer training card (#2192) — the branding gallery + proposals page is its
  regression fixture, and the Fork 6 rubric + methodology research topic is its knowledge base.
- **Review surface:** any brand-asset change regenerates `plateau:branding.html`
  (`npm run gen:branding`) — the standing before/after visual-check surface for branding edits.
