---
bornAs: xw2amiv
kind: story
size: 3
parent: "2676"
status: resolved
dateOpened: "2026-07-27"
dateStarted: "2026-08-15"
dateResolved: "2026-08-15"
scope:
  - we:docs/agent/build-ui.md
  - we:skills-src/build-ui/SKILL.md
  - we:skills-src/design-committee/SKILL.md
scopeRationale: "Doc/skill-only fold of a proven-by-hand technique into the existing build-ui method — the same
  shape as the already-resolved sibling we:backlog/2708-*.md (identical parent #2676, same we:docs/agent/build-ui.md
  + we:skills-src/build-ui/SKILL.md file pair, size 3) and the sibling we:backlog/2694-*.md (prepared 2026-08-15,
  lane/prepare-2694, same doc-fold shape). we:.claude/skills is a symlink to we:skills-src (verified: `readlink
  .claude/skills` -> `../skills-src`), so editing we:skills-src is the only skills-side edit needed — no separate
  we:.claude/skills edit. we:skills-src/design-committee/SKILL.md is a third consumer: its step 6 explicitly routes
  every candidate, including fork candidates, through PNGs before judging (`grep -n 'explainer channel'
  we:skills-src/design-committee/SKILL.md`), so it needs the same interaction-model carve-out as we:docs/agent/build-ui.md phase 4
  or it silently contradicts the new rule. No jury/automation code changes: we:scripts/lib/design-pixels-adapter.mjs
  (read in full) grounds its `visual` lens via `screenshot-vs-target` (we:scripts/lib/visual-comparator.mjs) —
  a STATIC screenshot-vs-baseline diff with no interaction/operability model — so an interaction-model fork's
  'does it actually work when I click it' judgment is inherently a human call routed through the existing
  human-facing decision-explainer channel (we:docs/agent/build-ui.md phase 4/6), not something to bolt onto the automated
  design-pixels lens."
tags: []
---

# Interaction-model exploration: render competing frames as operable screens

When the interaction model is unsettled (expand-in-place vs master-detail vs breadcrumb-zoom), the tool should render the top candidates as real, interactive, operable screens over the SAME data so the operator picks the frame from pixels rather than prose.

This session the model was chosen by rendering candidates and comparing. The tool should make "compare interaction models as operable screens" a first-class step, not an ad-hoc one.

Captured from the **feature-tracking-screen** design session — a capability the design-studio tool (#2676) should productize, drawn from methodology we ran by hand. Decision-view artifact: https://claude.ai/code/artifact/ba98baf4-3430-47bd-b90b-386be86d529d

## Why this lands now, ahead of the #2676 product surface

Epic #2676 (the Plateau design-studio product epic this card is filed under) is deliberately left **unsliced** —
a future user-facing product surface, not buildable today (we:backlog/3124-*.md, the decision filed while
preparing sibling we:backlog/2696-*.md, verified we:backlog/2676-*.md has **zero product-surface code** in
either repo: `git log --all --grep="2676"` in both `webeverything` and `plateau-app` turns up only backlog `.md`
filings and two doc skill-fold commits, #2708 and #2706, never application code). Naively preparing this card as
"a feature of the design-studio tool" would mean inventing an interface for a surface nobody has written — exactly
what the story-preparation checklist's grounding rule forbids.

But this card's actual, literal content is **not** product-surface work — it is a **method/tooling fold**, the
same shape as the already-resolved sibling **#2708** ("build-ui skill: fold in the proven method steps," same
parent #2676, same file pair, size 3, ratified from the same design session) and the sibling **#2694**
("full-scale interactive rendering + state-driving," prepared 2026-08-15, same file-pair pattern). Both apply a
session-proven technique directly to we:docs/agent/build-ui.md + we:skills-src/, independent of whether
#2676's product UI ever gets built — the METHOD is what every `/build-ui` and `/design-committee` invocation
reads today, in this repo, right now. This card does the same: fold "an interaction-model fork must be ruled on
operable candidates over the same data, as a first-class step" into the EXISTING phase-4 (decision-explainer) and
phase-6 (integrate/frame-fork) machinery. No new phase, no new mechanism, no new code.

**Distinguishing this from the parked sibling #2696.** #2696 ("integration phase: compose parts into one operable
page") asked for the design-studio **tool itself** to automatically compose+review parts as a product feature —
a capability with no existing seam, correctly parked on #3124. This card instead refines the **already-documented,
already-used-by-hand method** (we:docs/agent/build-ui.md phases 4/6) that governs how a human/agent rules a frame fork today —
the same distinction #2696's own prep note draws against #2708. This card's "operable candidates over the same
data" rule attaches directly to that existing phase-4/6 text, not to any unbuilt tool.

## Grounded findings (dupe-check + verification, 2026-08-15)

1. **Not a duplicate of #2708 (resolved).** Read #2708's diff (`git show 5c1c1ab8`) and the current
   we:docs/agent/build-ui.md phase 4 (lines ~101-127, "Decision-explainer artifacts") and phase 6 (lines
   ~142-153, "Integrate"). #2708 folded in the GENERAL rule — decide any fork on built, rendered candidates — and
   named the frame fork (master-detail vs stacked vs split) as decided at integration time. It never states the
   candidate must be OPERABLE (clickable/navigable) as opposed to a static screenshot/pane, and never requires the
   SAME underlying data across candidates. That is this card's specific, additive gap.
2. **Not a duplicate of #2706 (open).** Read we:backlog/2706-*.md in full — its eight invariants (a)-(h) are
   general ("decide on built visuals," "integration is its own phase at full scale") and never single out
   interaction-model forks or the operable-vs-static distinction. This card is a narrower, more specific technique
   that composes with #2706's invariants rather than restating them.
3. **Confirmed the current gap by reading the actual pipeline.** we:skills-src/design-committee/SKILL.md step
   5-6 (as of this writing) routes EVERY candidate through a screenshot BEFORE judging — "Screenshot every
   candidate, both themes ... The candidates are the PNGs, never the HTML" — even for the explainer-channel path.
   we:scripts/lib/design-pixels-adapter.mjs (read in full) confirms the automated `visual` lens is a static
   `screenshot-vs-target` diff (we:scripts/lib/visual-comparator.mjs), with no operability/interaction model at
   all. So today, even a fork explicitly about *interaction behavior* gets judged from a still frame — the literal
   gap this card names.
4. **Verified no existing script/tool builds decision-explainer artifacts** that this card would need to extend:
   grepped we:scripts/ and we:skills-src/ for `decision-explainer` — the only hits are the three doc/skill
   files already in scope. Decision-explainer artifacts are built via the interactive-artifact publishing
   mechanism referenced by the `claude.ai/code/artifact/...` URLs cited across this design session's cards (e.g.
   this very card's own decision-view link) — a self-contained interactive HTML page is already the natural
   output shape, so "operable" requires no new tooling, only a stated requirement that the explainer's panes
   actually BE that (interactive, live) rather than a picture of it.
5. **No sibling lane already touches these three files for this purpose.** Checked `git ls-remote --heads origin`
   for in-flight lanes: `lane/prepare-2693`, `lane/prepare-2694`, `lane/prepare-2695` exist (siblings, different
   scope — 2694 touches the same two build-ui files but for the DIFFERENT full-scale/state-driving technique, not
   interaction-model forks; no textual overlap with this card's additions). No `lane/prepare-2698` or
   `lane/prepare-2696`/`2697`/`2706` collision. #2696 is `status: parked` (not editing these files). #2697's PR
   scope is the jury red-team prompt (we:skills-src/jury/*), a disjoint file set.

## Decided design

Fold **one additive rule** — "an interaction-model fork is ruled on operable candidates over the same data, not
static panes" — into the three files already carrying the fork-ruling method, at the exact points that already
discuss forks:

- **we:docs/agent/build-ui.md phase 4 (Decision-explainer artifacts)** — add a paragraph (after the existing
  "Decide the fork on built, rendered candidates" paragraph, before "How you rule a high-leverage fork — the jury
  method") stating: for an INTERACTION-MODEL fork specifically (expand-in-place vs master-detail vs
  breadcrumb-zoom, or any fork about behavior across clicks/navigation rather than a single visual state), render
  each candidate as a real OPERABLE embed — self-contained interactive HTML the operator can click through, not a
  screenshot — driven by the SAME underlying data across every candidate, so the comparison is apples-to-apples
  and the ruling comes from having operated each candidate, not from a description or a still frame.
- **we:docs/agent/build-ui.md phase 6 (Integrate)** — tighten the existing "Rule each such fork the phase-4 way"
  sentence to explicitly say "built, OPERABLE candidates over the same data ... phase 4's interaction-model rule,"
  since phase 6 is where the frame fork (master-detail vs stacked vs split) is actually decided.
- **we:docs/agent/build-ui.md Honesty clauses** — add one clause, matching the existing "A frame fork may be
  zoom levels, not rivals" clause's style and placement: an interaction-model fork is ruled by clicking through an
  operable candidate, never from a static pane.
- **we:skills-src/build-ui/SKILL.md step 4** — one condensed cross-reference sentence (matching the file's own
  style: restate briefly, point at the canonical doc, never duplicate the reasoning).
- **we:skills-src/design-committee/SKILL.md step 6** — one cross-reference sentence noting that for an
  interaction-model fork, the explainer channel needs the operable candidates themselves, not just their PNGs —
  because step 5-6 today routes every candidate to a PNG before any judging happens, which is exactly the gap this
  card closes for the interaction-model case.

**Rejected alternative — a new automated interaction-model jury lens.** Considered proposing a fifth
`design-pixels` lens (alongside usability/visual/a11y/design-systems) that judges interaction behavior
automatically. Rejected: judging "does this interaction model feel right" requires actually operating a live
page — an automated grounding method would need a browser-automation script scripted per candidate's specific
interaction (clicking to expand, drilling into detail, walking a breadcrumb), which is not a generic, reusable
grounding the way `screenshot-vs-target` is. This is a human-judgment call by design (the operator "picks the
frame from pixels" per this card's own text) — it belongs in the human-facing decision-explainer channel
(phase 4/6), not the automated jury lens. If a generic interaction-grounding method emerges later, that is new
scope for a different card, not this one.

## Interfaces & protocol

- **Edit point 1:** we:docs/agent/build-ui.md, phase 4 section (currently lines 101-127) — insert the new
  paragraph immediately after the existing "Decide the fork on built, rendered candidates..." paragraph (ends
  "...plateau-app:docs/backlog-console-design.md).") and before "**How you rule a high-leverage fork — the jury
  method.**". Re-verify the exact line range at build time; it may have shifted since this card was prepared.
- **Edit point 2:** we:docs/agent/build-ui.md, phase 6 section (currently lines 142-153) — edit the existing
  sentence "Rule each such fork the phase-4 way (built candidates, honest counter-argument, one recommendation)"
  in place to add "OPERABLE ... over the same data ... phase 4's interaction-model rule" — do not restate the
  whole paragraph.
- **Edit point 3:** we:docs/agent/build-ui.md, "Honesty clauses" list (currently lines ~186-227) — add one new
  bullet immediately after the existing "A frame fork may be zoom levels, not rivals" bullet.
- **Edit point 4:** we:skills-src/build-ui/SKILL.md, step 4 "Decision-explainer artifacts" (currently lines
  34-38) — append one sentence to the existing step text.
- **Edit point 5:** we:skills-src/design-committee/SKILL.md, step 6 "Judge on the rendered pixels" (currently
  lines 45-46) — append one sentence to the existing step text.
- **No schema, no code, no migration.** This is prose-only guidance inside existing sections; no function
  signature, no data shape, no existing consumer to migrate. Cross-checked against we:docs/agent/jury-refinement-method.md
  (which cites the build-ui method's phase 4 by number) and we:agent-memory-src/right-size-the-panel-count-not-model-tier.md
  (which cites "§ 2. Mock before build" by section title): neither is disturbed by adding body text inside
  phases 4/6 — phase numbering and section titles are unchanged.

## Tasks

1. Read we:docs/agent/build-ui.md phases 4 and 6 in full, the Honesty clauses list, we:skills-src/build-ui/SKILL.md
   steps 4 and 6, and we:skills-src/design-committee/SKILL.md step 6, to match existing voice/structure and
   re-confirm line ranges have not shifted.
2. Edit we:docs/agent/build-ui.md phase 4: add the interaction-model-operable-candidate paragraph per **Decided
   design** above.
3. Edit we:docs/agent/build-ui.md phase 6: tighten the "Rule each such fork the phase-4 way" sentence to cite
   the interaction-model rule.
4. Add the one Honesty-clauses bullet.
5. Edit we:skills-src/build-ui/SKILL.md step 4 with the condensed cross-reference sentence.
6. Edit we:skills-src/design-committee/SKILL.md step 6 with the condensed cross-reference sentence.
7. Run `npm run check:standards`; fix any lint findings (locus-prefix, markdown structure).
8. Stage only the three touched files (plus this card), commit, `resolve` the card, open the PR (no
  `ready-to-merge` label — lands for independent review per the story-preparation checklist item 9).

## Delivery shape

Lands as **one incremental doc-only PR**, no branch/flag needed — prose additions inside existing phase sections
and existing skill steps, no renumbering, no code, no test suite to add or update. Gate is `npm run check:standards`
(0 errors) only.

## Done when

- [x] we:docs/agent/build-ui.md phase 4 states that an interaction-model fork (expand-in-place vs master-detail
      vs breadcrumb-zoom, or any behavior-across-clicks fork) must be ruled on OPERABLE candidates over the SAME
      data, not static panes — and cites the feature-tracking-screen master-detail precedent (#2708).
- [x] we:docs/agent/build-ui.md phase 6's frame-fork sentence explicitly cross-references phase 4's
      interaction-model rule.
- [x] we:docs/agent/build-ui.md's Honesty clauses list carries the new "ruled by clicking through it, not by
      looking at it" clause.
- [x] we:skills-src/build-ui/SKILL.md step 4 cross-references the interaction-model rule (grep for
      "interaction-model" confirms it lands in step 4, not elsewhere).
- [x] we:skills-src/design-committee/SKILL.md step 6 states that an interaction-model fork's explainer channel
      needs the operable candidates, not just their PNGs.
- [x] `npm run check:standards` — 0 errors.
