---
kind: story
size: 3
status: open
relatedTo: ["2267", "2882", "2452"]
scope:
  - we:docs/agent/backlog-workflow.md
  - we:skills-src/build-ui/SKILL.md
  - we:skills-src/new-demo/SKILL.md
  - we:skills-src/new-standard/SKILL.md
  - we:skills-src/exercise-app/SKILL.md
  - we:skills-src/next-backlog-item/SKILL.md
  - we:skills-src/prepare-decision-item/SKILL.md
  - we:scripts/lib/review-skill-guard.mjs
  - we:scripts/check-standards.mjs
dateOpened: "2026-08-06"
tags: [lane, lane-pool, lease, gate, skill, footgun]
---

# Lane-instructing docs tell agents to pick a lane without leasing it — check:standards must forbid the status→pick form

[we:docs/agent/backlog-workflow.md](../../docs/agent/backlog-workflow.md) (the *Working an item* callout) and six `we:skills-src/*/SKILL.md` files instruct `node we:scripts/lane-pool.mjs status --json` → "pick a clean lane", which takes **no lease**. A concurrent `acquire --lane=N` — the form every conveyor brief uses — then runs `git checkout -B … --force` + `git clean -fd` on that clone with no cleanliness gate, by design ([we:scripts/lane-pool.mjs](../../scripts/lane-pool.mjs):963-968). Uncommitted work in the lane is destroyed. Fix the canonical doc plus the six skills to `acquire --purpose= --session=`, and add a `check:standards` rule forbidding the unsafe form.

## The two harm arms

**(a) Explicit-lane arm — the strong one.** `acquire --lane=N` bypasses `chooseFreeLane` / `isLaneAcquirable`
entirely: the explicit-lane branch checks only the **lease** (reserved / live-lease refusals,
[we:scripts/lane-pool.mjs](../../scripts/lane-pool.mjs):~L885-908) and then falls straight through to the reset,
which unconditionally runs `git checkout -B <branch> <baseRef> --quiet --force` followed by `git clean -fd`
([we:scripts/lane-pool.mjs](../../scripts/lane-pool.mjs):967-968). The in-code comment immediately above
(~L963-966) states the behaviour is **intentional**: acquire "has never gated this reset on tree cleanliness
(unlike `refreshLane`'s explicit `laneDirtyOrAhead` guard) — it must unconditionally reclaim a lane regardless
of stray edits left by a prior crashed/interrupted session." So a lease-less worker can be wiped at **any**
point in its session, not merely before its first write. Every conveyor brief takes exactly this form —
`we:skills-src/conveyor/delivery-agent-brief.md`, `we:skills-src/conveyor/fix-agent-brief.md`,
`we:skills-src/conveyor/fix-agent-ci-brief.md`, `we:skills-src/conveyor/prepare-scope-agent-brief.md` and
`we:skills-src/conveyor/prepare-decision-agent-brief.md` all run
`node we:scripts/lane-pool.mjs acquire --lane={{LANE}} --purpose=…` — so the colliding caller is not
hypothetical.

**(b) Auto-pick arm — weaker.** The auto-pick branch goes through `chooseFreeLane` →
`isLaneAcquirable` ([we:scripts/lib/lane-lease.mjs](../../scripts/lib/lane-lease.mjs)), which **does** refuse a
lane whose `dirtyOrAhead` says dirty or ahead ("someone's work lives here — never recycle it", #2267, resolved
2026-07-05). So on this arm the loss window is only the gap between picking the lane and the unleased worker's
**first file write** — real, but narrow.

## The root is the doc, not the skills

The canonical sentence lives in [we:docs/agent/backlog-workflow.md](../../docs/agent/backlog-workflow.md) →
*Working an item — claim it, then keep it live*, inside the `> **Work in a lane, not the primary checkout — set
it up FIRST (#2123).**` blockquote: "provision/enter the lane **before** you start editing
(`node we:scripts/lane-pool.mjs status --json` → pick a clean lane → work there → land via PR)".

The six skills copy it faithfully (verified by grep, 2026-08-06 — one occurrence each):

| Skill | Line |
|---|---|
| `we:skills-src/build-ui/SKILL.md` | 16 |
| `we:skills-src/new-demo/SKILL.md` | 15 |
| `we:skills-src/new-standard/SKILL.md` | 14 |
| `we:skills-src/exercise-app/SKILL.md` | 15 |
| `we:skills-src/next-backlog-item/SKILL.md` | 24 |
| `we:skills-src/prepare-decision-item/SKILL.md` | 23 |

**Fix the doc first, then the six pointers** — otherwise the next skill copied from the doc reintroduces it.

Three skills already model the correct form and are the template to converge on:
`we:skills-src/drain/SKILL.md` (L54) and `we:skills-src/merge/SKILL.md` (L23) both run
`node we:scripts/lane-pool.mjs acquire --purpose=<slug> --session=<slug> --json` and `cd` into the returned
`.path`; `we:skills-src/batch-backlog-items/SKILL.md` (L198) likewise acquires (with `--base=`) rather than
picking. `we:skills-src/design-committee/SKILL.md` (L22) was converted to the same form by the fix below.

## The gate — direct precedent to copy

`checkReviewLabelSingleHome` ([we:scripts/lib/review-skill-guard.mjs](../../scripts/lib/review-skill-guard.mjs),
wired into the `Review-label swap must stay in its single home (#2882)` block of
[we:scripts/check-standards.mjs](../../scripts/check-standards.mjs)) is the **same shape**: a pure rule that
receives `{file, content}` docs and errors when a markdown file under a guarded root *instructs* a forbidden
command form, plus an fs walk in [we:scripts/check-standards.mjs](../../scripts/check-standards.mjs) derived
from the exported `GUARDED_DOC_PREFIXES` (today `we:skills-src/review/` + `we:docs/agent/`) so the roots are
never hardcoded twice.

Implementation model: widen `GUARDED_DOC_PREFIXES` to all of `we:skills-src/` (which subsumes
`we:skills-src/review/`) and add a sibling pure rule that errors on a doc instructing
`node we:scripts/lane-pool.mjs status` as a way to *obtain* a lane — i.e. `status` co-occurring with a
"pick a … lane" / "pick a clean lane" instruction — steering the author to `acquire --purpose= --session=`.
Diagnostic `status` use (a read-only listing, e.g.
[we:docs/agent/testing.md](../../docs/agent/testing.md):143, and the conveyor's state scan) must stay legal;
only the *pick-a-lane-from-it* instruction is forbidden.

## How it surfaced

The `/review` panel on **PR #1062** ([we:skills-src/design-committee/SKILL.md](../../skills-src/design-committee/SKILL.md))
— the first skill to fan **four concurrent writer agents** into one shared, unleased lane, which is what made
the window obvious. That PR fixed its own copy in commit `9ef81566` ("design-committee: lease the panel's lane
instead of picking a clean one") and is otherwise out of scope: the doc and the other six skills are untouched
by it.

## Not the grounding

[we:agent-memory-src/shared-pool-lane-unsafe-for-manual-work.md](../../agent-memory-src/shared-pool-lane-unsafe-for-manual-work.md)
is **not** the citation for this item. That memo blames `provision|refresh` and predates the lease primitive;
the live mechanism here is `acquire`'s deliberate no-cleanliness-gate reset. Cite the code, not the memo.

## Acceptance

- The `> **Work in a lane…**` blockquote in [we:docs/agent/backlog-workflow.md](../../docs/agent/backlog-workflow.md)
  names `acquire --purpose=<slug> --session=<slug> --json` (plus the matching `release`), not `status` + pick.
- All six skills above match that form; a repo-wide grep for the `status --json` → pick phrasing under
  `we:skills-src/` returns nothing (diagnostic `status` uses may remain).
- A new `check:standards` **error** fires on any markdown under `we:skills-src/` or `we:docs/agent/` that
  reintroduces the pick-from-`status` instruction, with unit tests over the pure rule (fixture in / fixture
  out) **and** a test that the fs walk visits every prefix in `GUARDED_DOC_PREFIXES`.
- `npm run check:standards` green.
