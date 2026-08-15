---
bornAs: xbr0f4a
kind: story
size: 3
parent: "2676"
status: open
dateOpened: "2026-07-27"
scope:
  - we:docs/agent/build-ui.md
  - we:skills-src/build-ui/SKILL.md
  - we:skills-src/design-committee/SKILL.md
scopeRationale: "Doc/skill-only fold of a proven-by-hand technique into the existing build-ui method, the same shape as the sibling we:backlog/2708 (identical parent, identical file pair, size 3, resolved). we:.claude/skills is a symlink to we:skills-src (verified: readlink .claude/skills -> ../skills-src), so editing we:skills-src is the only skills-side edit — no separate we:.claude/skills edit, and no code/tooling: there is no existing generic mock-screenshot script this would extend (plateau-app:tests/visual/capture.mjs and plateau-app:tests/visual/render-baselines.mjs capture already-built app ROUTES, not self-contained pre-build mock HTML files, and have no state-driving hook)."
tags: []
---

# Full-scale interactive rendering + state-driving for sighted review

The tool should render mockups at REALISTIC data volume (not a 4-row sample) as interactive HTML driven into named states (a window.__setState-style hook) so a reviewer can screenshot each state in both themes — density and interaction problems only show at full scale.

This session density problems (a heavy collapsed row, an injected velocity panel per row) only appeared once rendered at ~31 features. Full-scale interactive rendering with deterministic state-driving is how those got caught.

Captured from the **feature-tracking-screen** design session — a capability the design-studio tool (#2676) should productize, drawn from methodology we ran by hand. Decision-view artifact: https://claude.ai/code/artifact/ba98baf4-3430-47bd-b90b-386be86d529d

## Why this lands now, ahead of the #2676 product surface

#2676 (the Plateau design-studio product epic this card is filed under) is deliberately left **unsliced** — a
future user-facing product surface, not buildable today. But this card's actual content is a **method/tooling
fold**, not product-surface work: it is the same shape as the already-resolved sibling **#2708** ("build-ui
skill: fold in the proven method steps," same parent #2676, same file pair, size 3) and the still-open sibling
**#2706** ("Codify the proven design-studio METHOD invariants + skill folds"). Both of those apply session-proven
technique directly to we:docs/agent/build-ui.md + we:skills-src/, independent of whether #2676's product UI ever
gets built — the METHOD is used by every `/build-ui` and `/design-committee` invocation today, in this repo,
regardless of the Plateau product surface. This card does the same: fold two proven techniques (full-scale data
volume; the `window.__setState` state-driving hook) into the existing phases 2 and 3, no new phase, no new code.

**Verified not a duplicate:** grepped the repo for `__setState` and "full scale" / "realistic" data-volume
language before writing this card. The only other `__setState` mentions are we:backlog/2720-*.md and
we:backlog/2735-*.md (both open, both under epic #2705 — the feature-tracker SCREEN build) — those apply the
convention to one specific already-ratified screen's build-time baseline harness (plateau-app:src/feature-tracker/),
not to the generic METHOD doc every UI build reads first. we:docs/agent/build-ui.md phase 2 today says "real data
shapes... not lorem" (field SHAPE) but never states a volume/scale requirement, and phase 3's "screenshot every
cell of the matrix" has no mechanism for driving a single mock through N named states — confirmed by reading both
phases in full (we:docs/agent/build-ui.md lines 48-99) and the sibling #2708's diff (`git show 5c1c1ab8`, which
added phase 6 "Integrate ... at full scale" for INTEGRATED-page composition, a different concern from a single
mock's row-count realism). No existing check:standards rule or script references either convention, so nothing
else in the repo would need to change in lockstep.

## Design (decided)

Fold two techniques into the EXISTING phases 2 and 3 of we:docs/agent/build-ui.md (no new phase — phases 4-7 are
cross-referenced by number elsewhere, e.g. we:docs/agent/jury-refinement-method.md lines 6/129 cite "phase 4";
we:agent-memory-src/right-size-the-panel-count-not-model-tier.md cites "§ 2. Mock before build" by section title —
neither is disturbed by adding body text inside phases 2/3):

**Phase 2 ("Mock before build") — realistic data volume.** Add a paragraph, alongside the existing "real data
shapes, not lorem" guidance, stating the mock must be populated at a REALISTIC volume for its dominant
collection — not a 3-5 row toy sample — because density and interaction defects are invisible below real scale.
Cite the concrete precedent already on this card: the feature-tracking-screen mock's density bugs (a heavy
collapsed row, an injected velocity panel per row) only surfaced once rendered at ~31 features. Name a rule of
thumb: match the count to a realistic production instance of the collection being modeled, not an arbitrary
round number.

**Phase 3 ("Review the pixels") — the `window.__setState` state-driving hook.** Add the convention that a mock
exposes ONE global hook driving it between the named states of phase 1's matrix, so every matrix cell is reached
by calling the hook on ONE rendered DOM rather than authoring N separate static mock files:

- `window.__setState(caseId: string): void | Promise<void>` — mutates the mock's DOM in place to the named case.
  Synchronous by default; may return a `Promise` if a case needs async work (e.g. a chart re-render), which the
  driving script awaits before screenshotting. Throws on an unknown `caseId` — fail loud, never a silent no-op.
- `window.__setState.cases: string[]` — the full list of valid case ids, sourced from phase 1's matrix, so a
  driving script enumerates cases from the mock itself rather than hand-maintaining a second, driftable list.
- The screenshot loop (phase 3) becomes: for each theme × each id in `window.__setState.cases`, call
  `page.evaluate((id) => window.__setState(id), caseId)`, await its return, let the DOM settle
  (`page.waitForTimeout` or an explicit settle signal the case can set), then `page.screenshot()`.
- File-naming convention: `<surface>-<caseId>-<theme>.png`, matching the `<surface>-<width>` variant convention
  already established in plateau-app:tests/visual/baselines/ (e.g. `board-1280.png`).

Add one honesty-clause line to we:docs/agent/build-ui.md's existing "Honesty clauses" list (structural precedent:
every technique #2708 added there got a matching clause): **"A mock reviewed at toy scale is not reviewed —
density and interaction bugs hide below realistic volume."**

Fold condensed, cross-referencing versions into we:skills-src/build-ui/SKILL.md steps 2 and 3 (matching that
file's existing style: a short restatement + a pointer to the canonical doc, never a full restatement — see its
own header: "Don't restate it here; if the method changes, edit that doc"), and add ONE cross-reference line to
we:skills-src/design-committee/SKILL.md step 5 ("Screenshot every candidate, both themes") noting the same
full-scale + state-driving convention applies to committee-authored candidate mocks, pointing at
we:docs/agent/build-ui.md phases 2/3 rather than restating.

**Rejected alternative — a generic capture/driving script.** Considered proposing a new shared script (parallel
to we:scripts/lib/visual-comparator.mjs + plateau-app:tests/visual/capture.mjs) that drives `__setState` and
screenshots automatically. Rejected for THIS card: phase-2/3 mocks are pre-build, self-contained HTML files with
no committed home yet (they live wherever a design session puts them, e.g. plateau-app:docs/mocks/), authored
and screenshotted ad hoc by the agent running the session (there is no existing generic "screenshot a self-
contained mock file" script to extend — confirmed by searching we:scripts/ for `mock`/`screenshot`, zero hits). A
script is worth building once the convention has been used by hand a few times and a concrete shared shape
emerges — exactly the pattern we:agent-memory-src/story-preparation-checklist.md item 8 describes as premature
tooling. If that need surfaces, it is new scope, not this card's.

## Interfaces & protocol

- `window.__setState(caseId: string): void | Promise<void>` — global hook a self-contained mock HTML file
  defines. Throws `Error` (or subclass) on an unrecognized `caseId`. No other required signature; internal DOM
  mutation is the mock author's choice.
- `window.__setState.cases: string[]` — a property on the same function, listing every valid `caseId`.
- Driving loop (documented technique, not a callable API): `await page.evaluate((id) => window.__setState(id), caseId)`
  then a settle wait, then `page.screenshot({ path: \`${surface}-${caseId}-${theme}.png\` })`, run once per
  `(theme, caseId)` pair.
- No migration: this is new guidance for future mocks. No existing mock in this repo currently implements
  `window.__setState` (verified: zero HTML mock files exist under any committed path today), so there is nothing
  to retrofit.

## Tasks

1. Read we:docs/agent/build-ui.md phases 2 and 3 in full (lines ~48-99) and we:skills-src/build-ui/SKILL.md
   steps 2-3, plus we:skills-src/design-committee/SKILL.md step 5, to match existing voice/structure.
2. Edit we:docs/agent/build-ui.md phase 2: add the realistic-data-volume paragraph with the ~31-feature precedent
   citation and the "match a realistic production instance" rule of thumb.
3. Edit we:docs/agent/build-ui.md phase 3: add the `window.__setState` hook contract, the drive-then-screenshot
   loop, and the `<surface>-<caseId>-<theme>.png` naming convention.
4. Add the one honesty-clause line to we:docs/agent/build-ui.md's "Honesty clauses" list.
5. Edit we:skills-src/build-ui/SKILL.md steps 2 and 3 with condensed cross-referencing versions of the same two
   additions (no we:.claude/skills edit needed — it is a symlink to we:skills-src).
6. Edit we:skills-src/design-committee/SKILL.md step 5 with the one cross-reference line.
7. Run `npm run check:standards`; fix any lint findings (locus-prefix, markdown structure).
8. Stage only the four touched files, commit, `resolve` the card, open the PR.

## Delivery shape

Lands as **one incremental doc-only PR**, no branch/flag needed — prose additions inside existing phase
sections, no renumbering, no code, no test suite to add or update. Gate is `npm run check:standards` (0 errors)
only.

## Done when

- we:docs/agent/build-ui.md phase 2 states the realistic-data-volume requirement and cites the feature-tracker
  ~31-feature precedent (grep for the phrase confirms it lands in the phase-2 section, not elsewhere).
- we:docs/agent/build-ui.md phase 3 documents `window.__setState(caseId)` (including the `.cases` list, the
  throw-on-unknown-id rule, and the `<surface>-<caseId>-<theme>.png` naming convention) and the drive-then-
  screenshot loop.
- we:docs/agent/build-ui.md's "Honesty clauses" list carries the new toy-scale clause.
- we:skills-src/build-ui/SKILL.md steps 2 and 3 each carry a condensed cross-reference to the two additions (and
  we:.claude/skills/build-ui/SKILL.md reflects it automatically via the skills-src symlink — no separate edit).
- we:skills-src/design-committee/SKILL.md step 5 carries the one cross-reference line.
- `npm run check:standards` exits 0.
