---
bornAs: x1y4g3j
kind: story
size: 5
parent: "3029"
status: open
relatedTo: ["2821", "2575", "2577", "3146"]
dateOpened: "2026-08-08"
scope:
  - we:scripts/operations/
scopeRationale: "Adds one declaration file to the new operations directory; the exact filename does not exist yet."
tags: [plateau-loop, delivery, operations, decision, ratify]
---

# Declare ratify — the do-effects-generalise test

Ratifying a decision is **human-only by nature**, and its effect is unlike every other operation's: it writes
repository files — the item's frontmatter and body, and usually a statute section — through a branch and a pull
request, rather than calling the forge API on an existing one.

## Why this is now explicitly justified by the UI roadmap, not just internal quality (2026-08-16 update)

The operator has confirmed this work is required for a future UI to drive delivery end-to-end: a skill with no
run record cannot be exposed to a UI the way `suggest-next`'s HTTP adapter already is. This is not a new claim
— [#3029] (this story's parent epic) already recorded the operator's own framing on 2026-08-09: *"the idea is to
mechanise in similar way absolutely all operations, as it's the only way the UI will be able to use it"*, and
names `ratify` as slice 7 of that epic. What's new tonight is a concrete downstream consumer: [#2577]'s
**Plateau Ruler** — an already-filed, still-open epic for "a first-class in-product decision surface" — and its
child [#2575] (resolved 2026-08-15), which just shipped `RulingRecord`, a pure schema for a decision's durable
output (options, fork rulings, juror ratings, `finalPick.ruledBy`/`date`). `RulingRecord`'s own grounding
section documents that `ruledBy` reads the item's `ratifiedBy` frontmatter field when present — the same field
this story's acceptance criteria now name explicitly (see below). A mechanized `ratify` operation is the thing
that would populate a `RulingRecord` at the moment of ratification instead of a UI having to parse prose after
the fact; this story and the Ruler are the same layer, not adjacent ones.

## Two concrete failures traced tonight, and why this story is the fix for one of them

1. A build dispatched via the raw `Agent` tool (no operation) failed silently four times with zero trace; the
   same work dispatched through `dispatch-lane` worked immediately and produced a real, inspectable run record.
   This is the general argument for operations over prose, not specific to ratify — filed separately as the
   conveyor dispatch-lane wiring gap this same audit surfaced.
2. Several `prepare-decision-item` invocations (#2938, #3129, #3118, #3123, #3043, #3048) ran their required
   fresh-context skeptic/screen adversarial pass on themselves instead of a genuinely separate agent, because
   the skill has no structural equivalent of `review-pr`'s `judge` step. **This is prepare's failure, not
   ratify's** — but `next-backlog-item`'s decision red-team step (the ratify-turn skeptic pass) has the
   identical shape ("spin up a throwaway skeptic sub-agent," pure prose, no structural backing), so whatever
   `ratify` ships for its own skeptic/red-team pass should close that site too. See the coordination note below
   and the sibling story "Declare prepare's skeptic + two-confusion screen as judge steps" ([3146]), which
   owns the prepare-side design in full — this story does not restate it.

## What it probes

The `record` step of [#3035] emits comment / label / ledger / event — all forge calls. If the effect executor
has quietly grown up assuming that shape, this is where it shows. **An effect whose application is "open a PR and
wait" must fit the same executor, keyed the same way, or the abstraction is thinner than it looks.**

The idempotency question is the sharp one and is worth stating up front: replaying a forge comment is a
no-op-or-duplicate problem, but replaying a branch-and-PR effect must not open a second PR.

**Grounded, not hypothetical, as of this update:** the executor already has the mechanism this needs.
`we:scripts/operations/effect-executor.mjs`'s `dispatch: true` / `inFlight` marker (#3073) — the state that file
added for `dispatch-lane`'s "starts work that outlives the run" effect — is the SAME shape a "commit, open a PR,
wait for it to land" effect needs: `applied` means the sink ran, not that the work it started finished, and a
sink that starts something long-running returns an in-flight handle instead of a completion. `review-prep`'s
`record` step (`we:scripts/operations/review-prep-io.mjs`, resolved 2026-08-16 — landed *after* this probe was
first written) is closer still: it already commits a file, lands it through `we:scripts/pr-land.mjs` (the SAME
transport every AI-edit path in this repo lands through, #2138), and handles the INDETERMINATE case with a
content-hash race guard rather than a guess. `ratify`'s `record` step is `review-prep`'s `record` step with a
different payload (frontmatter `status`/`dateResolved`/`ratifiedBy`/`codifiedIn` + the `## Ruling` section,
instead of a review note) — not a new mechanism to invent from scratch.

## Also probes the confirm actor field

Per the ruling, `confirm` is **one kind with an actor field** rather than two kinds. Ratification is the strictest
human-only case on the board, so it is the natural place to prove the field carries its weight — and that a guard
in the pure core, not a separate step kind, is what makes the restriction unbypassable.

## The acceptance-criteria fix — name the fields (2026-08-16 update)

An earlier assessment tonight found this story's original acceptance vague on what "the same on-disk result as
one recorded by hand today" actually means. It means, concretely, grounded against real ratified items
(`we:backlog/2828-ui-fidelity-build-self-review-scope-always-on-vs-care-level-.md`,
`we:backlog/2851-stop-the-line-conveyor-governance-the-orchestrator-never-abs.md` — the only two of 487 decision
items that carry it today, per [#2575]'s grounding): a **`ratifiedBy:` frontmatter field** (free text, e.g.
`"Nicolas Gilbert (operator)"`) and a **`## Ruling (<date>) — …` body section** naming the pick and the
rationale. These are not new fields — they are the existing, sparse, precedented convention [#2575] already
documented and chose to reuse (`FinalPick.ruledBy` reads `ratifiedBy` when present). `ratify`'s `record` step
writes both, every time, so a mechanized ratification is never the reason a future item is missing them.

## Reconciliation with #2821 (2026-08-16 update)

[#2821] gate 1b (*"same-day multi-fork resolve — escalate, never hard-block"*) is a **proposed, not yet built**
`check:standards` hook: #2821 is still `status: open`, and neither gate 1b nor the `ratifiedBy` field it would
read exists anywhere in `we:scripts/check-standards-rules.mjs` or elsewhere today (a repo-wide grep for
`ratifiedBy` in `scripts/`/`docs/` returns zero hits). As designed, it would fire when a same-day, live-fork
decision resolves with **no ratify marker present** — reading exactly the `ratifiedBy` frontmatter field /
`## Ruling` body shape this story's acceptance now names. Once both exist, the two are complementary, not
overlapping: #2821 gate 1b would be the **deterministic backstop** for a ratification that still happens by
hand (or through a not-yet-converted path) — it would escalate a hand-resolved decision that forgot the marker.
This story is the **structural producer** — a ratification that runs through the declared operation writes the
marker every time, by construction, so a future gate 1b should never fire on a `ratify`-operation-recorded
resolve. Landing this story does not retire gate 1b's design (hand-resolves may still happen for a long time,
and the gate's own real instances — #2801, #2828's pre-correction form — reproduce on hand-authored history
this operation cannot retroactively fix) but, once gate 1b is built, this story's marker-writing should make it
fire asymptotically less often on new decisions. Neither item should re-derive the marker shape independently —
both cite `ratifiedBy`/`## Ruling` as the one shape, sourced from [#2575]'s grounding.

Note also [#2575]'s own explicit out-of-scope line — *"no new hard-gated frontmatter field or `check:standards`
rule enforcing this shape on decision items… retroactively gating would be an unmeasured, repo-wide blast-radius
risk"* — is about a UNIVERSAL gate on all 487 existing decision items. Neither gate 1b (narrow: same-day +
live-fork + no-marker) nor this story's `record` step (only fires on decisions that go through the operation)
is that universal gate, so there is no conflict to resolve, only two narrow, compatible mechanisms to keep
pointed at the same field names.

## Fork, not ruled: should prepare and ratify be one operation, or two?

The operator asked whether `prepare`+`ratify` should become one coordinated operation using `compute` steps for
research/grounding, a `judge` step reusing `review-pr`'s independent-spawn mechanism for the skeptic/screen
pass, and a `confirm` step for human ratification. This is a real architectural fork and is **left open here,
not ruled** — it is decision-shaped, not build-ready, and this audit's mandate is to surface it prepared, not
to pick.

**The case for one operation.** A decision's lifecycle — research → author forks → skeptic/screen → ratify →
codify — is one continuous object from the operator's and a future Ruler UI's point of view ([#2577]'s own
framing: "the UI for the existing decision layer (prepare -> ratify -> codifiedIn)"). One operation would let a
single run record narrate the whole lifecycle, which is closer to what `RulingRecord` ([#2575]) wants to
persist than two disjoint records ever could be.

**The case for two operations (this story's current default, unchanged).** Every existing sibling pair in this
codebase that shares judge/mandate machinery but differs in `read`/`record` shape has stayed two operations,
not one with a branch: `review-pr` vs `review-prep` — decided explicitly, in writing, as "a SEPARATE declared
operation… not a target-type branch," because *"an operation that appears to need a fifth kind is a signal to
change the model"* generalizes down to *"a `read` that internally forks between two unrelated IO shapes is the
same signal in miniature"* ([#3111]'s own fork rationale). `prepare` and `ratify` differ on exactly that axis:
prepare is **autonomous** (no `confirm` step, runs unattended, mirrors `review-prep`'s no-`confirm` shape) and
writes research + fork authoring across what could be a long-running, resumable, multi-session effort; ratify
is **human-only** (`confirm` is its entire reason to exist) and writes a single, short, one-sitting ruling.
Their `record` effects also differ in kind: prepare's is a research/authoring commit with no statute
implication; ratify's usually also touches the statute doc. By the established precedent, that is the shape
that stays two operations sharing a mandate-building seam (`buildSubjectMandate`), the way `review-pr`/
`review-prep` share the tool-free juror spawn helper (`we:scripts/lib/judge-spawn.mjs`) and the #3094 rule
constants without merging.

**Recommended default, stated for whoever ratifies this fork, not ratified here:** two operations —
`prepare-decision` (owned by [3146]) and `ratify-decision` (this story) — coordinated as one delivery effort
per the operator's direction, sharing the judge-spawn/mandate seam, cross-linking their run records via the
item id, but declared separately. This is a default, not a ruling; a reviewer who disagrees should say so
against the two precedent cases above, not against a bare preference.

## Acceptance

`ratify` runs through the declared operation. A ruling recorded through it produces the same on-disk result as one
recorded by hand today — status, dates, `codifiedIn`, the statute section, **and `ratifiedBy` + a `## Ruling`
section** (see the acceptance-criteria fix above) — and it lands through the normal lane → PR transport, never a
direct write. Replaying the effect does not open a second PR. The confirm step refuses to resolve on an agent
actor.

## Not in scope

The `/prepare` research flow and its skeptic/screen judge-step mechanization are owned by the sibling story
[3146] ("Declare prepare's skeptic + two-confusion screen as judge steps"), coordinated with this one per the
operator's direction, not restated here. This slice moves the **recording** of a ruling onto the engine; how a
ruling is reached is untouched.
