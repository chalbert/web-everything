---
kind: story
size: 5
status: open
parent: "2256"
blockedBy: ["2249", "2250"]
locus: webeverything
dateOpened: "2026-07-04"
tags: [branding, web-everything, favicon, logo]
---

# Finalize the Web Everything mark

Ship a final WE mark via the `brand-mark-loop` skill, replacing `we:src/assets/logo.svg` +
`we:src/assets/favicon.svg` (and any small-size variant the ratified size-gating rule turns out to
require). **Not build-ready: the concrete construction depends on #2249 (flat vs rich-dimensional visual
language) and #2250 (WE color system), both prepared but not yet ratified** — see below for why this
card can no longer just say "build the Venn," and what is prepared regardless of how they rule.

## Status: blocked, not build-ready (prep finding, 2026-08-15)

This card was filed 2026-07-04 with the brief "take the user-favored constellation Venn
(`plateau:branding-proposals/loop/weB-venn-constellation-v2.svg`) to a shippable mark ... hand-composite
the overlapping lens-regions ... for a luminous additive Venn." That reflected the loop's live finding at
the time — the constellation Venn was logged as "the breakthrough lead"
(`plateau:branding-proposals/loop/LOOP-LOG.md:68-76`).

The same day, the more rigorous decision-prep pass on #2250 reached the opposite conclusion **on the Venn
specifically**. Its "Supported by default" section rules the overlapping-color-region Venn **out**, not
in: *"The overlapping-color-region union / translucent Venn is banned regardless of branch"*
(`we:backlog/2250-we-mark-system-multi-color-umbrella-vs-monochrome.md:124-129`) — it breaks the
one-gradient-per-project construction rule, fails #2209's own ownability test ("could this be another
brand's logo?"), renders muddy under `mix-blend-mode:screen` (the exact execution gap this card names),
and collides with #2209 Fork 2's mono-W-≤32px favicon slot. #2250's own bold default (Fork 1(a), ~70%
confidence, **not yet ratified**) is a **constellation-spanning multi-stop gradient** (indigo→cyan→violet,
one gradient, rule-compatible) — same "unified" meaning, no overlapping regions. #2249 is upstream of
that: it rules whether the mark family stays flat-minimal or goes rich-dimensional, which shapes how
*any* WE mark (gradient or otherwise) gets drawn.

So the brief this card originally named — build the Venn — is the excluded branch of the decision that
gates it. Two ways to "fix" this card are both wrong, and both are exactly what
`we:agent-memory-src/story-preparation-checklist.md` warns against:

- **Build the Venn anyway** — building against a superseded premise (the checklist's #2803 failure mode:
  "the premise was built on a fact the repo had moved past").
- **Rewrite this card to build the gradient instead** — silently resolving #2250's still-open fork on the
  item's behalf, which the checklist forbids outright (item 4: *"a real fork must be NAMED as an open
  decision, never picked silently"*).

Both #2249 and #2250 carry `preparedDate: "2026-07-04"` (ready to ratify, per memory rule #39 — never
rule without one), but neither has `resolvedDate` and both still read `status: open` (confirmed live
2026-08-15, not just carried from the frontmatter above). This item stays genuinely **Tier C — blocked,
not agent-ready** — until a human ratifies #2249 and #2250 (`we:docs/agent/backlog-workflow.md` §"Selecting
the next item to work on": *"An item that says ... 'after X' is Tier A only if that prerequisite is
resolved; otherwise it's blocked."*). Filing a fresh blocker item is not needed — #2249/#2250 already
carry the edge in `blockedBy` above.

## What IS prepared now (holds regardless of how #2249/#2250 rule)

- **Method.** Run the `brand-mark-loop` skill (`we:skills-src/brand-mark-loop/SKILL.md`) — sighted
  render→critique→red-team→edit→converge, never blind generation. Read
  `plateau:branding-proposals/loop/LOOP-LOG.md` first (standing findings + WE's per-round history) so a
  new round starts ahead, not cold.
- **Render tool.** `node plateau:scripts/render-mark.mjs <mark.svg> <out.png> [reference.svg]` — no
  return value, writes a PNG showing the mark at 220/64/32/16px light + 64/16px dark. This is the only way
  to validate legibility; judging from SVG source is explicitly against the skill's rule.
- **Target files (this repo).** `we:src/assets/logo.svg` (40×40, `rx="12"` squircle, 2-stop linear
  gradient `#4f46e5`→`#9333ea`, white `stroke-width="2.5"` W path + a `stroke-opacity="0.6"` echo-E path
  underneath) and `we:src/assets/favicon.svg` (same construction, `viewBox="0 0 40 40"` at a 32×32
  intrinsic size) — read in full 2026-08-15, both still the flat baseline #2249's grounding digest cites.
- **Consumers (both already point at these exact paths — no consumer-side change needed, only content
  swaps).** `we:src/_layouts/base.njk:8` (`<link rel="icon" ... href="/assets/favicon.svg">`) and `:39`
  (`<img src="/assets/logo.svg">`, rendered site-wide via the base layout); `we:src/_data/chrome.js:16`
  (`logoSrc: '/assets/logo.svg'`, the site-chrome data every page consumes).
- **Regen.** `npm run gen:branding` (plateau-app) after any asset change, so `plateau:branding.html` /
  `plateau:branding-refs.html` reflect the shipped mark — `plateau:package.json:22`.
- **Size-gating is already decided independent of #2249's outcome.** #2249's own "Supported by default"
  section (branch-independent, both bold-default and alternative honor it) bans depth effects at ≤64px
  and permits them only ≥128px. WE's shipped assets are 40×32px — always inside the flat band — so
  **this card never needs a rich-depth treatment regardless of how #2249 rules**; that fork only matters
  for hero/marketing-scale WE art, out of this card's scope.
- **Honest-ceiling clause carries forward unchanged.** If the sighted loop stalls below pro-grade after
  3–4 iterations, stop and escalate: hand the corpus + rubric + the *ratified* brief (not this card's
  original Venn brief) to a human designer.

## Tasks — do not start before #2249 and #2250 both carry `resolvedDate`

1. Re-read the ratified statute text folded into #2209's construction section (both decisions' "On
   ratify" notes land it there) — build against that wording, not this card's original Venn brief and not
   either decision's currently-unratified bold default.
2. Run the brand-mark-loop on whatever construction ratification actually names. (If it lands on #2250's
   named default, that means extending `we:src/assets/logo.svg`'s `<linearGradient>` to the 3-stop
   indigo→cyan→violet span shown in #2250 Fork 1(a)'s worked example, glyph unchanged. If ratification
   instead keeps the Venn as a deliberate exception to its own prepared recommendation, no clean template
   exists yet — every current Venn probe is "not clean at 16px" per #2250's own grounding digest — so that
   outcome re-enters the loop from the execution-gap this card originally flagged, mix-blend mud and all.)
3. Render-and-look every iteration (`plateau:scripts/render-mark.mjs`); critique against the #2209 rubric
   + the `plateau:branding-refs/*.json` corpus; red-team; converge.
4. Validate explicitly at 16px on a brand-gradient background AND on dark — the two hardest real
   placements (favicon tab, dark-mode header).
5. Replace `we:src/assets/logo.svg` and `we:src/assets/favicon.svg`. Add an additional small-size variant
   only if the ratified rule turns out to require one for this size (unlikely, per the size-gating point
   above).
6. Regenerate `plateau:branding.html` (`npm run gen:branding`).
7. Append the round's outcome to `plateau:branding-proposals/loop/LOOP-LOG.md`'s WE section.
8. If the loop stalls below pro-grade: stop, escalate per the honest-ceiling clause — do not ship
   mediocre.

## Done when (testable, once unblocked)

- `we:src/assets/logo.svg` and `we:src/assets/favicon.svg` render legibly (form distinguishable, no muddy
  blend) at 16px on both a light/gradient background and a dark background — verified from
  `plateau:scripts/render-mark.mjs`'s actual PNG output, never asserted from SVG source alone.
- The shipped construction matches the text ratified into #2209's construction section — not this card's
  original Venn brief, not either decision's pre-ratification bold default.
- `plateau:branding.html` has been regenerated and shows the new mark.
- `we:npm run check:standards` is 0 errors on the changed repo.
- `plateau:branding-proposals/loop/LOOP-LOG.md` carries a dated WE entry recording the round's outcome.

## Delivery shape

One piece, not incremental — a logo/favicon either ships or it doesn't, there is no partial-behind-a-flag
form. The loop iterations happen in-session; only the final SVGs (and the regen) land.

## Scope

- `we:src/assets/logo.svg`, `we:src/assets/favicon.svg` — the files this item edits.
- Consumers (read-only, no change needed): `we:src/_layouts/base.njk`, `we:src/_data/chrome.js`.
- Cross-repo (plateau-app, out of this repo's PR but touched by the same work): the loop tooling and log
  already cited above.
