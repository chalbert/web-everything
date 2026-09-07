---
bornAs: xnn9wtv
kind: story
size: 5
status: open
parent: "2472"
scope: ["we:scripts/check-standards-rules.mjs", "we:src/_data/backlog.js"]
dateOpened: "2026-09-06"
tags: [backlog, locus, cross-repo, ids, data-model]
crossRef: { url: /backlog/3129-per-repo-backlog-data-model-distributed-backlog-md-tooling-p/, label: "the ruling this implements" }
---

# A backlog id always carries its locus — bare `#NNN` keeps meaning `we:`

#3129 ruled (2026-09-06, operator) that the locus-filtered view is the **current** position and that **fully
distributed per-repo backlogs are the destination** — and that the id scheme should move first: *an item number
should always include its locus*. This is that first move, and it is deliberately the additive half.

## Why this is worth doing before distribution lands, not with it

The ambiguity is **already here**. A bare `#NNN` means `we:#NNN` today — true by *convention*, never by
construction, and nothing in the corpus says so. The prep for #3129 counted repo-qualified ids as a **cost** of
going distributed ("a bare `#NNN` becomes ambiguous the moment two repos both have a `#NNN`"); the ruling
inverted that. Making the locus explicit removes an ambiguity we already carry, and it removes the
all-at-once migration that would otherwise have to happen on the day distribution lands.

## The additive half only — and what that buys

Every place that accepts a bare `#NNN` today also accepts an explicit `we:#NNN` / `fui:#NNN` /
`plateau:#NNN` and resolves it to the same item. **A bare `#NNN` keeps meaning `we:` — unchanged, forever, for
this slice.** Nothing is rewritten, nothing is required to carry a prefix yet, and no existing reference breaks.

That ordering matters: it means the corpus can be migrated *incrementally and reversibly* afterwards, one
reference at a time, rather than in a single sweep that has to be right on the first attempt.

## Explicitly NOT in this slice

- **Minting new ids with a locus by default.** That is the next slice, and it should not start until this one
  has been live long enough to prove the reading side is complete.
- **A corpus migration** of existing bare references. Largest slice, last, and only once both above hold.
- **Any second numbering authority.** #3129 ruled (b) is the current position: one record of truth, one drain,
  one number space. This slice changes how an id is *written and read*, never who assigns it.

## Watch for the same defect this repo keeps finding

The locus vocabulary already exists in more than one place — `LOCI` in
[`we:scripts/check-standards-rules.mjs`](../scripts/check-standards-rules.mjs) and the `we:`/`fui:`/`plateau:`
prefixes the locus-prefix gate enforces on code paths. **Do not mint a second list.** Reuse the registry that
exists; a parallel vocabulary is the drift class that left the exec gate on dead `idea|issue` kinds until #1473
rewired it.

The id grammar and the **code-path** locus prefix are different things that share a spelling. `we:scripts/x.mjs`
is a path; `we:#3423` is an id. Whatever parses one must not silently accept the other.

## Done when

1. **Executable** — an explicit `we:` / `fui:` / `plateau:` prefix on a `#NNN` resolves to the same item a bare
   `#NNN` resolves to, everywhere a bare one is accepted today: the `blockedBy` / `parent` frontmatter walk,
   the `D2` dangling-ref check, and the rendered cross-reference links. Named tests pin each.
2. **A bare `#NNN` still resolves exactly as it does now**, with a test that fails if the default locus is
   dropped or changed. This is the property that makes the slice reversible.
3. An **unknown** locus prefix is refused with a message naming the known set, rather than silently falling
   back to `we:` — a typo must not resolve to the wrong repo's item.
4. No new numbering authority, and no second locus vocabulary: the `LOCI` registry stays the single source.

## Ordering

Ruled **not deferred and not parked** — an ordinary ready item to take when there is capacity. It is not urgent
and it is not conditional on anything, including #2456's evidence gate, whose ground #3129 narrowed.
