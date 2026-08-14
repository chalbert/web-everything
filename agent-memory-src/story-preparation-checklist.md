---
name: story-preparation-checklist
description: What a story must carry before anyone builds it — scope+consumers, size, testable acceptance, decided design, interfaces/protocol, tasks, delivery shape
metadata:
  type: feedback
---

**Never hand a story to a builder — human or agent — until the card carries all of this.** Scoping alone is
not preparation. Operator correction, 2026-08-13, after I dispatched scope-only briefs: *"be sure to prepare
items correctly before starting — review size, task, acceptance criteria, design, protocol and interfaces,
anything that a story should have."*

1. **`scope:` including CONSUMERS.** Not only the file being changed. Find them two ways: ES importers, AND
   subprocess callers (`node scripts/x.mjs …`, `execFileSync`, hooks, npm scripts). In this repo the second
   set is usually the bigger one — `we:scripts/lane-pool.mjs` has ten-plus consumers and **not one** is an
   import, so an import-only grep finds zero.
2. **`size`**, Fibonacci, with its basis stated. `> 8` is not a size, it is an instruction to slice — name
   the slices and the seam rather than forcing a number.
3. **Acceptance criteria** — a `## Done when` list of TESTABLE statements. "The guard works" is not one; the
   observable condition that proves it is. If none can be stated testably, that is a finding about the card.
4. **The decided design** — an approach, not a menu. A real fork must be NAMED as an open decision, never
   picked silently and never split away: a buried fork handed to a builder is exactly what the split rubric
   refuses.
5. **Interfaces and protocol at every seam** — real signatures, argument and return shapes, the invocation
   form if it is shelled, what an error looks like, and how existing data migrates. **This is the omission
   that has cost the most review rounds.**
6. **Tasks** — the ordered steps a builder would take.
7. **Delivery shape** — can it land incrementally behind `main`, or must it land as one piece (needing a
   branch)? Say which, and why.

**Why:** items surveyed against what their PRs actually had to touch burned 2–6 review rounds each, and the
gaps were card-level omissions rather than coding mistakes — #3090 (size 1, 2 files declared, touched a
caller that was not in scope) and #3091 (four call sites had to honour one discipline; reviewers found them
one at a time over six rounds). #3071 is the counter-example and belongs in the list: its scope was exactly
right and the work was still pointless, because nothing had measured whether it would unblock anything.
Preparation is where that cost is paid or avoided.

**A correction, kept because it is the same defect this checklist exists to prevent.** The first version of
this entry also cited *"#3084 — 3 files declared, ~20 touched"*. **That is false.** #3084 touched exactly its
three declared files plus its own card (`git diff --name-only 227eef7c^1 227eef7c`). The "~20" was GitHub's
`changedFiles` count against a stale `baseRefOid` after the drain rebased that lane — a number read off a UI,
used as evidence, and propagated into two artifacts without being checked against the diff. **Never cite a
file count from a PR page; derive it from the commit range.** An independent review caught it.

**How to apply:** manual discipline until it becomes the `prepare-story` operation (epic `xl2q1zt`, first
slice = the consumers check). Grounding rule: cite `path:line` actually opened, never invent an interface
you have not read — **an honest open question beats a confident wrong contract.** Governed by #2607
(deterministic core, thin judgment): whatever part a script can decide belongs in `we:scripts/readiness/`,
not in an agent's recall. Note #3071's lesson too — a perfect scope does not make work worth doing; if
nothing has measured that the change unblocks something, that is its own preparation gap.
