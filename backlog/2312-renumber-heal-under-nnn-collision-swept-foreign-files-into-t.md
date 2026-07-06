---
kind: story
size: 3
relatedTo: ["2289", "2288", "2181", "2213", "2222", "2276", "2248"]
status: open
dateOpened: "2026-07-06"
tags: [drain, self-heal, nnn-collision, data-integrity]
---

# Renumber-heal under NNN collision swept foreign files into the healed PR (leaky self-heal)

**Observed live (2026-07-06, PR #168).** A clean single-file backlog lane (`lane/2301-file`, one new
`backlog/2301-*.md`) hit a live NNN collision — a concurrent session had already taken `#2301`. The drain's
new-item id-collision self-heal renumbered it `#2301→#2283` and rebased the ref — but the **healed head
(`49f45657c`) carried 9 files, +650/-15**, not the one backlog file: it swept in the primary/reconstruction
checkout's **foreign uncommitted work** — `we:agent-memory-src/index-meta.md` + an untracked memory file,
*another* session's `#2301-force-agent-memory` backlog item, `we:scripts/merge-ai-prs.mjs` /
`we:scripts/lane-drain.mjs` + its test, and the `we:skills-src/closing-session` skill. Landing it would have
committed all that foreign work to `main`. Caught only by an eyeball of the PR file list before merge; the PR
was closed unlanded (origin untouched).

## Why this matters

The self-heal tower (#2181/#2213/#2222/#2276/#2248) exists to make id-collisions safe. This is the opposite: a
collision made the heal **produce a corrupt, foreign-content commit** that a less careful pass would have
landed. It is the same class as the regen foreign-file-sweep just fixed (#2290 follow-up) — a heal/regen step
building its commit from a broad tree state instead of an explicit, scoped pathspec.

## Root-cause hypothesis (confirm first)

The renumber-heal reconstructs the lane commit via git plumbing (merge-tree / commit-tree / read-tree) against
a base tree; under collision it appears to have composed the new tree from a **dirty working/index state**
(the checkout it ran in carried foreign uncommitted files) rather than from *only* the incoming lane's own
changed paths. So the heal must scope to the lane commit's own file set (an explicit pathspec / a tree derived
strictly from the source commit), never a broad snapshot of the checkout it happens to run in.

## What to build

- Reproduce: a clean single-file backlog lane + a colliding `#NNN` already on `main` + a **dirty** heal
  checkout (foreign tracked+untracked files present) → assert the healed head's tree equals the source lane's
  tree with only the filename/ref renumbered, i.e. its changed-file set is exactly `{the renamed backlog file}`
  — never the foreign files.
- Fix the heal to build the renumbered commit from the **source lane commit's tree**, renaming only the
  colliding path + rewriting `blockedBy`/`parent`/short-refs, and to `git add` an **explicit pathspec** of just
  those paths (the `finalizeLand` / #2290-regen discipline) — never the ambient working tree.
- Guard: if the heal's resulting diff touches any path outside the source lane's own file set, **abort the
  heal** (fail loud, leave the PR unlanded) rather than land foreign content.

## Relation to the structural fix

#2288 (JIT numbering) + #2290 (drain = sole writer) aim to make NNN collisions **unrepresentable**, which would
remove this heal's trigger entirely — but until JIT lands, the reactive heal is still live (the #2289 "dormant
backstop") and MUST NOT corrupt. This item hardens the backstop; it does not replace #2288.
