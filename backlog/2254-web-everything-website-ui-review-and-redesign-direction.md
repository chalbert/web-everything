---
kind: story
size: 13
status: open
parent: "2256"
blockedBy: ["2249", "2209"]
locus: webeverything
relatedTo: ["2207", "1034"]
scope:
  - we:reports/
  - we:src/_layouts/base.njk
  - we:src/_data/chrome.js
dateOpened: "2026-07-04"
tags: [website, design-review, ui, dogfood]
---

# Web Everything website UI — review & redesign direction

The Web Everything site's UI "was never permanent and never correctly reviewed" (user, 2026-07-04). Do a
proper page-by-page design review of the running site and propose a redesign direction grounded in the
ratified brand (marks/colors/visual-language from #2249–#2253) and the #2209 rubric + `plateau:branding-refs.html`
corpus. **This is also the dogfood of the design-AI reviewer (#2207):** run it on each page, render, score
against the rubric citing named corpus lessons, and record where its verdicts are weak (feeds #2207). Large
and exploratory — expect to slice into per-area redesign stories once the direction is set. Out of scope
here: shipping the redesign (that's the slices); this establishes the reviewed baseline + direction.

## Status: blocked, not build-ready (prep finding, 2026-08-15)

**Not viable to prepare to a single build-ready card as scoped.** Two independent gaps, both verified live
2026-08-15, not carried over stale from 2026-07-04:

1. **The blocker is real, and one edge was missing.** `blockedBy: ["2249"]` was accurate but incomplete —
   this card's own body names **"the #2209 rubric"** as a required grounding input, and #2209 (`Ratify the
   constellation branding system`) was not declared as a blocker. Both #2249 and #2209 read `status: open`
   right now (`we:backlog/2249-*.md:5`, `we:backlog/2209-*.md:4`) — prepared (`preparedDate` set on each) but
   **not ratified** (no `resolvedDate`, no `## Ratified` section in either file). Added `"2209"` to
   `blockedBy` above; per `we:docs/agent/backlog-workflow.md`'s Tier-A/blocked rule, a `blockedBy` edge to an
   unresolved item makes the whole card Tier C, mechanically, not a judgment call.
2. **There is currently ZERO ratified or shipped brand to ground a "redesign direction" in.** This card
   wants the direction grounded in "the ratified brand (marks/colors/visual-language from #2249–#2253)."
   Checked all four: #2249 open, #2251 open (`we:backlog/2251-*.md`), #2252 open
   (`we:backlog/2252-*.md`), #2253 open (`we:backlog/2253-*.md`) — every one of them still unshipped, and
   three of the four (#2251/#2252/#2253) are themselves blocked on #2249. No mark has changed, no favicon
   has changed, no color has been re-tinted. Proposing a "direction" now would be building against a brand
   the repo has not reached yet — the exact #2803 failure mode the story-preparation checklist names
   ("the premise was built on a fact the repo had moved past").

Per the checklist's item 4 (a decided design must be named, never picked or started early against an open
fork) and item 2 (`size > 8` is an instruction to slice, not a number to force), this card cannot be
carried to build-ready as one unit right now. What follows is what a preparer CAN ground today, so the
card is genuinely ready to resume the moment the blockers clear — not a restatement of "come back later."

## The seam this card splits along, once it can proceed

This story actually bundles two pieces with different readiness, independent of the size-13 "slice into
per-area redesign stories" the card already anticipates downstream:

- **Phase A — page/template critique against the ALREADY-RATIFIED #1034 rubric.** The `/review-design`
  skill (`we:skills-src/review-design/SKILL.md`, shipped, #1035) scores hierarchy / spacing / contrast /
  typography / consistency / alignment — generic page-critique axes, ratified 2026-06-19, with zero
  dependency on #2249/#2209: those two decisions govern *brand-asset* judging (marks, lockups, palettes,
  names), a different artifact class by #2209 Fork 6's own reconciliation text
  (`we:backlog/2209-*.md`: "no collision under (a): different artifact class (brand assets vs rendered
  pages)"). **Phase A is buildable today, blocked by nothing.**
- **Phase B — the redesign direction**, grounded in the ratified brand + #2209's brand rubric + the
  `plateau:branding-refs.html` corpus. This is the part actually named by the card's title, and it is
  exactly what #2249/#2209/#2251–2253 gate — it cannot be decided before a brand exists to ground it in.

**Recommendation for whoever resumes this card:** run `/split 2254` into a Phase-A "site page critique"
story (dev-ready now, no blockers, roughly the size of a normal review pass) and a Phase-B "redesign
direction" story (keeps the `blockedBy` edges above, parks until #2249 + #2209 both carry `resolvedDate`
and at least #2251/#2252/#2253 have shipped something to ground against). Preparing this card as one
13-point unit forces a false choice: either hold Phase A hostage to an unrelated brand decision, or let
Phase B start against a brand that does not exist yet.

## What IS grounded now (regardless of how #2249/#2209 rule) — usable for Phase A immediately, and Phase B once unblocked

- **Site page-type inventory**, verified 2026-08-15 by reading `we:src/_data/chrome.js` (the nav data) and
  `we:src/_layouts/base.njk` (the shared layout every page renders through): the site's primary navigable
  surface is **16 page types** — home `/`, plus 15 nav-linked pages across three sections: *Standards*
  (`/intents/`, `/blocks/`, `/capabilities/`, `/protocols/`, `/design-systems/`, `/presets/`,
  `/semantics/`), *Explore* (`/demos/`, `/conformance/`, `/validation-rules/`, `/research/`, `/backlog/`),
  *About* (`/mission/`, `/governance/`, `/author/`). Beyond these, Eleventy generates large families of
  near-identical detail pages from a handful of shared per-type templates (e.g. `backlog/{id}/` via
  `we:src/backlog-pages.njk`, `adapters/{id}/` via `we:src/adapter-pages.njk`,
  `specs/{category}/{id}/` via `we:src/spec-pages.njk`) — review scope is **one representative instance
  per template**, not every generated page (hundreds+ once backlog/spec/adapter/block entries are
  counted). Enumerate the template set with `find src -maxdepth 1 -iname "*-pages.njk"`.
- **Review tool, already built and shipped.** `/review-design` (`we:skills-src/review-design/SKILL.md`):
  screenshot the running dev server with Playwright (webeverything serves Eleventy on **:8080** per the
  skill's own port note), read the PNG natively (no API key / vision provider needed), score the #1034
  8-axis rubric + open localized findings.
- **Corpus for Phase B, located (cross-repo, read-only reference).** `plateau:branding-refs.html` (85
  cited case studies) and `plateau:branding.html` (gallery + `#proposals` + journeys) — both confirmed
  present, generated by `plateau:scripts/gen-branding.mjs` (`plateau:package.json` `gen:branding` script).
- **Deliverable shape, confirmed from the card's own last sentence.** This story's output is a **report +
  direction document**, not shipped site changes — "out of scope here: shipping the redesign (that's the
  slices); this establishes the reviewed baseline + direction." Its `scope:` above is therefore docs
  (`we:reports/`), not `src/` — the two layout/data files are listed read-only, for citation, not edit.

## Tasks — Phase A (buildable now; do first if split off)

1. Confirm the dev server is live on :8080 (probe the port; don't restart a running one) — never critique
   from source HTML, only a rendered screenshot.
2. Enumerate one representative page per template: the 16 nav pages + one instance per `*-pages.njk`
   family found above.
3. Run `/review-design` per page: screenshot desktop (1280×800) + mobile (390×844); score the #1034 8 axes
   + localized findings for each.
4. Write the results up as a report under `we:reports/2026-MM-DD-website-ui-review.md`, one section per
   page/template, citing axis scores + findings.
5. Roll up cross-page patterns (repeated axis weaknesses) — this is the actionable signal a later Phase-B
   direction, and the eventual per-area slices, both consume.

## Tasks — Phase B (blocked until #2249 AND #2209 both carry `resolvedDate`)

1. Re-read the ratified visual-language + brand-rubric text once folded into #2209's construction section
   (both decisions' "On ratify" notes name that landing spot).
2. Check whether #2251/#2252/#2253 have shipped; if not yet, a direction can still be proposed ahead of
   full asset rollout as long as the *rules* (not just the current assets) are ratified — note explicitly
   which marks are still pending.
3. Score each page's brand alignment against #2209 Fork 6's ratified attribute sets, citing
   `plateau:branding-refs.html` exemplars/failures by name for every claim (never an unsourced "this feels
   off-brand").
4. Synthesize a redesign-direction document: cross-page patterns, a priority order, and the seams for the
   per-area slice stories #2256 anticipates filing next.
5. Record every verdict + rationale in the form #2207's learning log already uses (label + principle) so
   it becomes a usable training row, not a one-off opinion.

## Done when (testable)

- **Phase A:** a report exists under `we:reports/` scoring every one of the 16 nav-linked pages + one
  instance per generated-page template against the #1034 rubric (8 axes + localized findings each), and
  `npm run check:standards` is 0 errors on the report/doc change.
- **Phase B (once unblocked):** a redesign-direction document exists, citing #2209's ratified rubric text
  and `plateau:branding-refs.html` exemplars by name for every claim, and naming the per-area slice
  stories to file next.

## Delivery shape

Doc-only, both phases — no `src/` changes ship from this card itself (the redesign-implementation slices
that consume the direction are separate stories, per the card's own out-of-scope note). Phase A can land
incrementally (one page/report section at a time — additive prose, no partial-state risk). Phase B should
land as one piece once started — a direction document needs to read as one coherent recommendation, not a
partial one.
