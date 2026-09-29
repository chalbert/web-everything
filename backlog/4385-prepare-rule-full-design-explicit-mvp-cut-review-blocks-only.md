---
bornAs: xtw16qn
kind: story
size: 5
priority: high
status: open
scope: ["we:agent-memory-src/story-preparation-checklist.md", "we:skills-src/conveyor/prepare-decision-agent-brief.md", "we:scripts/conveyor/run-rating.mjs", "we:scripts/conveyor/__tests__/run-rating.test.mjs", "we:docs/agent/backlog-workflow.md"]
dateOpened: "2026-09-28"
tags: []
---

# Prepare rule: full design, explicit MVP cut, review blocks only on MVP Musts

Prepare writes the FULL design, then names an explicit MVP cut (smallest slice meeting the card's Must criteria, safe standalone); Done-when splits Must vs Could; a plan-review finding is classified BLOCKER (breaks a Must, or real harm: data loss/security/gate break) / SCOPE-GROWTH (valid, beyond MVP Musts — auto-filed as an already-designed follow-up) / NOT-AN-ISSUE; size budget applies to the MVP (~1.5x card size, else split again); max 2 review rounds, then stamp if no MVP-Must blocker and file the rest as follow-ups; run rating records rounds+scope-growth per card. Evidence: we:backlog/4309 (4 Codex rounds, hand-rescoped), we:backlog/4365 and we:backlog/4366 (3 and 4 blockers after the cap, hand-rescoped) — not sustainable.

## Design

**The rule, as ratified (operator, 2026-09-28), applied to how THIS card itself is prepared:**

1. Prepare writes the complete design — reviewers may surface every edge case; they refine the design, they do
   not gate it.
2. Prepare then names an explicit MVP cut — the smallest slice that meets the card's own `## Done when` Musts
   and is safe to ship standalone.
3. `## Done when` splits into **Must** (the MVP) and **Could** (real, already-designed, deferred).
4. A plan-review finding is classified, never left as a bare "blocker": **BLOCKER** (breaks an MVP Must, or
   names real harm — data loss/security/a gate break) blocks the stamp; **SCOPE-GROWTH** (valid, but beyond the
   MVP Musts) becomes an auto-filed, already-designed follow-up slice (never silently dropped, never silently
   "resolved" by widening the MVP); **NOT-AN-ISSUE** is dismissed with a one-line reason, same discipline
   `we:skills-src/conveyor/prepare-scope-agent-brief.md`'s own review step already applies ("a finding you judge
   not-real is dismissed with a one-line reason — never dropped in silence").
5. The size budget applies to the MVP, not the full design — an MVP exceeding ~1.5× the card's own declared
   `size` gets split again (mirrors `we:.claude/skills/split-backlog-item/SKILL.md`'s existing size>8 split
   rubric, applied at the MVP boundary instead of the card boundary).
6. Max 2 review rounds. After that, if no MVP-Must blocker remains, stamp `preparedDate` and file the rest as
   follow-ups — never hold a card open indefinitely chasing scope-growth findings past the cap.
7. Run rating records review rounds and scope growth per card, so "prepared vs. unprepared" and "how many
   rounds did the cap actually cost" become measurable, not anecdotal — the same measurement discipline
   `we:agent-memory-src/fixes-need-prepared-card.md` already asks for ("collect prepared-vs-unprepared stats...
   rather than assuming the win; see the `run-rating` comparison work this motivated").

**Why this card exists now, not as a one-off correction.** Three real cards hit this exact cost the same
session: `we:backlog/4309` took 4 Codex rounds and was rescoped by hand; `we:backlog/4365` and `we:backlog/4366`
each still had real blockers (3 and 4 respectively) after this repo's existing 1-re-review cap, and BOTH had to
be rescoped by an orchestrating session's own judgment call rather than by a named rule — the exact
"judgment stays in context, footguns first" gap rule 51 (Hookable vs Judgment) exists to close: a
script-decidable classification (does this finding break a stated Must? is it in the MVP's own declared scope?)
was being redone from scratch, by hand, every time, instead of being a named step every prepare pass follows.

**Where the rule is APPLIED vs. WHERE it is DOCUMENTED (this card changes documentation/checklists/data fields,
never a new enforcement script — matching this repo's own existing "manual discipline until it becomes an
operation" precedent for prepare, `we:agent-memory-src/story-preparation-checklist.md`'s own closing line).**
There is no single "prepare-story" operation or skill in this repo today — `we:backlog/4364`/`4365`/`4366`'s own
prepare passes ran as an ad-hoc session driving `node we:scripts/codex-direct-task.mjs --review` directly, never
through a named skill. This card's own scope is therefore the artifacts an agent driving a prepare pass
actually reads before/during that work, not a new script:
- `we:agent-memory-src/story-preparation-checklist.md` — the checklist every prepare pass is expected to
  satisfy (items 1–10 today). Gains items 11–13 below (MVP cut, finding classification, round cap).
- `we:skills-src/conveyor/prepare-decision-agent-brief.md` — the one EXISTING prepare brief this repo has (for
  decision items); gains a cross-reference to the story checklist's new items so a decision-shaped prepare pass
  inherits the same MVP-cut/round-cap discipline, not a forked copy of it.
- `we:scripts/conveyor/run-rating.mjs` — gains the two new recorded fields named in point 7 above.
- `we:docs/agent/backlog-workflow.md` — gains a short cross-reference to the checklist's new items at its own
  existing prepare-workflow section, so the Tier-0 router surfaces the rule rather than leaving it findable only
  by opening the memory file directly.

## MVP cut

**Must (MVP):** items 1–4 and 6 above, written into `we:agent-memory-src/story-preparation-checklist.md` as new
numbered items (11–13, following its own existing 1–10 numbering and voice) — this alone lets any prepare pass,
human or agent, apply the rule by hand starting immediately, the same "manual discipline until mechanized" shape
the checklist's own item 8 already documents for de-risking. The `we:docs/agent/backlog-workflow.md`
cross-reference (one paragraph, pointing at the checklist) rides along in the same Must, since an un-findable
rule is not yet "applied."

**Could (follow-up, already designed above — not built now):**
- `we:scripts/conveyor/run-rating.mjs`'s two new recorded fields (point 7) — genuinely useful once several
  prepared cards exist under the new rule to compare, but not needed for the rule to be FOLLOWED starting now
  (a rule can be applied and later measured; it cannot be measured before it exists). `toScorecardRow`
  (`we:scripts/conveyor/run-rating.mjs:1073`) already documents that "every other field this module actually
  cares about rides through as an EXTRA field... extra fields pass through unvalidated" against
  `we:scripts/conveyor/run-scorecard-store.mjs`'s schema — so `reviewRounds`/`scopeGrowthCount` need no schema
  migration, only a caller populating them, a small, low-risk follow-up.
- `we:skills-src/conveyor/prepare-decision-agent-brief.md`'s cross-reference — decision-shaped prepares are a
  smaller, separately-cadenced population than story prepares; wiring it in is real but not required for THIS
  card's own Must (the story checklist, where every recent example — 4309/4365/4366 — actually lives).

**Size:** the MVP is one file's worth of new checklist items + one cross-reference paragraph — well under this
card's own `size: 5`, no split needed.

## Interfaces

- `we:agent-memory-src/story-preparation-checklist.md` — three new numbered items (11–13), in the file's own
  established voice (each states the rule, a "why," and a "how to apply," mirroring items 1–10's own shape):
  11 (MVP cut: full design first, then name the smallest Must-meeting, safe-standalone slice); 12 (finding
  classification: BLOCKER / SCOPE-GROWTH / NOT-AN-ISSUE, with BLOCKER's bar stated explicitly — breaks an MVP
  Must, or real harm); 13 (the 2-round cap: stamp on no remaining MVP-Must blocker, file the rest as follow-ups).
- `we:skills-src/conveyor/prepare-decision-agent-brief.md` — one new paragraph (Could, above) pointing at the
  checklist's items 11–13, in its own existing step-5 review section (`we:skills-src/conveyor/prepare-decision-agent-brief.md:141`,
  "Review your prepared forks — spawn an adversarial review subagent").
- `we:scripts/conveyor/run-rating.mjs` (Could, above) — `toScorecardRow(rating, {provider})`'s `rating` input
  gains two optional fields for a `kind: 'prepare'|'prepare-decision'` row (both already in
  `we:scripts/conveyor/run-rating.mjs`'s `BUILD_KINDS`/`SIZE_SCALED_KINDS`, `:203`/`:206`): `reviewRounds:
  number` (how many plan-review rounds this prepare pass actually ran, 1 or 2) and `scopeGrowthCount: number`
  (how many findings were classified SCOPE-GROWTH and auto-filed as follow-ups) — both pass through as extra,
  unvalidated fields per the module's own documented contract (`:47-50`), no schema change.

## Tasks

1. Author checklist items 11–13 in `we:agent-memory-src/story-preparation-checklist.md` (Must).
2. Add the one cross-reference paragraph in `we:docs/agent/backlog-workflow.md`'s existing prepare-workflow
   section, linking to the checklist (Must).
3. Add the cross-reference paragraph in `we:skills-src/conveyor/prepare-decision-agent-brief.md`'s step-5 review
   section (Could).
4. Add `reviewRounds`/`scopeGrowthCount` to `we:scripts/conveyor/run-rating.mjs#toScorecardRow`'s accepted
   `rating` shape + a unit test asserting both ride through as extra fields (Could).

## Delivery shape

One PR, the Must items first (checklist + backlog-workflow cross-reference are both pure doc edits, no code, no
migration, safe standalone); the two Could items ride along in the same PR if time allows, or land as a
follow-up — neither blocks the other.

## Done when

1. **Must** — `we:agent-memory-src/story-preparation-checklist.md` states items 11–13 (MVP cut, finding
   classification, round cap) in the file's own established voice; `we:docs/agent/backlog-workflow.md` links to
   it from its prepare-workflow section. Applying the rule to `we:backlog/4365`/`we:backlog/4366` in THIS SAME
   PR (see those cards' own new "MVP cut" + "MVP-blocking classification" sections) is itself the first live
   proof the rule works, per the "prove on the live case, never a private workaround" discipline — not a
   separate fixture.
2. **Could** — `we:scripts/conveyor/run-rating.mjs#toScorecardRow` accepts and passes through
   `reviewRounds`/`scopeGrowthCount`, unit-tested.
