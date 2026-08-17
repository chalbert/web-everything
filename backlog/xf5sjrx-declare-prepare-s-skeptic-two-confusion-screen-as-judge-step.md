---
kind: story
size: 5
parent: "3029"
status: open
relatedTo: ["3033", "3111", "2821"]
dateOpened: "2026-08-16"
scope:
  - we:scripts/operations/
scopeRationale: "A new declaration + its io shell, plus tests — the exact filenames aren't settled (new operation vs review-prep extension, per the fork below), so the whole directory is the honest write-set until that's picked."
tags: [plateau-loop, delivery, operations, decision, prepare]
---

# Declare prepare's skeptic + two-confusion screen as judge steps

`we:skills-src/prepare-decision-item/SKILL.md` runs two adversarial passes on every prepared fork — a skeptic
attack and a fresh-context "two-confusion screen." Both are pure prose ("spin up a throwaway sub-agent," "spawn
a separate agent"), and an `Agent`-tool subagent inherits its parent's `CLAUDE_CODE_SESSION_ID`, so nothing
distinguishes a real separate spawn from the session arguing with itself. Tonight six invocations (#2938,
#3129, #3118, #3123, #3043, #3048) ran the passes on themselves — a substitution the repo's own rules treat as
invalid, not just weaker. This item declares both passes as `judge` steps, the fix `review-pr` already proved
for the analogous attack, so the substitution becomes structurally impossible.

## Why a subagent isn't independent, and what already fixes it

An `Agent`-tool subagent is the same actor by the repo's own independence test — `we:scripts/lib/judge-spawn.mjs`'s
header documents and fixes exactly this for `review-pr`'s `judge` step: a headless `claude -p` spawn mints its
own session id, so the reviewer is a structurally distinct actor, not a nominally-labelled one.

## The precedent this reuses, not invents

`review-prep` (#3111, resolved 2026-08-16 — landed *today*) is the direct architectural precedent, closer than
`review-pr`: it already mechanizes an "independent review of preparation" pattern for build stories — read the
card → `judge` (spawn a fresh juror on `buildSubjectMandate`, importing the target-neutral rule constants
`MUTATION_PROBE_RULE` / `FENCED_DATA_RULE` verbatim rather than the PR-specific `buildPanelMandate`) → reduce
(pull confidence + named risks straight off the juror's answer) → record (append a review section, commit,
land — with a content-hash guard against a card that changed underneath the run, no `confirm` step because
there is no human to ask). A decision item's skeptic pass and screen pass are the same shape: judge a card
against live code / against the item's own claims, fully autonomously (prep is "pure agent work — no
human judgment" per the skill's own header). The design below is `review-prep`'s pattern applied twice, not a
new invention.

## The design

Two **separate** `judge` steps, not one shared step run twice — the two passes attack different things and the
skill already treats them as distinct (`Skeptic:` line vs `Screen:` line under each `## Fork N`), and each
`judge` step suspends independently, so each gets its own `judgeSpawn` call with its own minted session id:

| step | kind | reuses |
|---|---|---|
| `read` | `compute` | reads the item's frontmatter + body + every `## Fork N` (mirrors `readPrep`, `we:scripts/operations/review-prep-io.mjs`) |
| `skeptic` | `judge` | one juror, mandate built on `buildSubjectMandate` (never `buildPanelMandate` — a decision item has no diff), asserting `MUTATION_PROBE_RULE` verbatim; given ALL forks at once (mirrors `review-prep`'s whole-card judge, not one juror per fork) and the skill's own four attack axes (classification / merit / statute-overlap / citation-scope) as the mandate's instruction; answer shape carries a per-fork verdict (REFUTED / SURVIVES / SURVIVES-WITH-AMENDMENT) + rationale |
| `fold-skeptic` | `compute` | folds the skeptic verdicts into the rewritten body — the `Skeptic:` line under each `## Fork N` |
| `screen` | `judge` | a SECOND, independently-spawned juror (genuinely fresh by construction — a new `claude -p` process, not a subagent of the first) — the two-confusion screen's two questions (impl-detail-not-standard? / merit-vs-prioritization?) per fork; the mandate must NOT include the skeptic's verdicts or rationale, only the fork text itself — this is what makes it structurally "has not seen this session's authoring", not just a different prompt |
| `fold-screen` | `compute` | folds `Screen: clear` / `Screen: flagged(impl\|prio) → <fix>` into the body |
| `record` | `effect` | writes the rewritten body + `preparedDate`, commits, lands via `we:scripts/pr-land.mjs` — the same shape `recordPrepVerdict` already proved, including its content-hash race guard |

No `confirm` step, matching `review-prep`'s decision (prep is autonomous; a human stop over prep output is a
fast-follow if real use ever needs one, not guessed in now).

**Not decided here, and not this item's call to make:** whether this ships as a genuinely new operation
(`prepare-decision`) or as an extension of `review-prep`'s declaration. `review-prep` today is scoped to
build-story preparation (`## Independent review` note, no fork structure); a decision item's shape (`## Fork
N`, two distinct verdict lines, a `preparedDate` stamp instead of a review note) differs enough that the
established fork precedent in this codebase — `review-pr` vs `review-prep` stayed two operations specifically
*because* their `read`/`record` shapes differ, even though they share the judge machinery — points toward a
third sibling operation rather than a branch inside `review-prep`. That is a real fork, flagged for whoever
picks this up to confirm against the shape once actually drafted, not ruled here.

## Real instances this must reproduce

The six items that ran the substitution tonight — #2938, #3129, #3118, #3123, #3043, #3048 — are the fixture
set: each should be re-run (or spot-checked) through the mechanized skeptic + screen steps once built, to
confirm the mechanized verdicts are at least as good as a genuinely independent hand-run pass would have been
(the same "compare against a hand-rolled equivalent" discipline #3111's own Done-when required of itself).

## Coordinate with #3033 (ratify)

This item and [#3033] were prioritized together by the operator as one effort — see #3033's update for the
`prepare`-vs-`ratify` one-operation-or-two fork and the shared UI-driving justification (both feed the same
[#2577] Plateau Ruler decision surface). They are filed as separate stories because their `read`/`record`
shapes differ exactly the way `review-pr`/`review-prep` differ, not because the work is unrelated — land them
in whichever order unblocks the other, and cross-check the fork resolution against both bodies before either
ships.

## Not in scope

The rest of the prepare skill (prior-art research, per-fork classification, the prepared-fork authoring
itself) stays prose — those passes need genuine synthesis a `compute` step cannot express, not a judgment call
that a fresh juror could structurally replace.

## Done when

1. A `prepare-decision` (or equivalent) declaration exists on the engine with two independently-spawned `judge`
   steps for skeptic + screen, each using `buildSubjectMandate` (never `buildPanelMandate`) and asserting
   `MUTATION_PROBE_RULE` / `FENCED_DATA_RULE` verbatim (a `toContain` test on the import, mirroring
   `we:scripts/operations/__tests__/review-prep.test.mjs`).
2. The screen step's mandate is built ONLY from the fork text — a test asserts the skeptic's verdict/rationale
   never appears in the screen `judge` step's `request.input` or `mandate`, which is the structural guarantee
   that replaces the prose "has not seen this session's authoring."
3. One real prepared fork (from the #2938/#3129/#3118/#3123/#3043/#3048 set, or a fresh one) driven through the
   mechanized steps end to end; its `Skeptic:`/`Screen:` output compared against what a hand-run pass produced
   or would produce.
4. `npm run check:standards` — 0 new errors.
