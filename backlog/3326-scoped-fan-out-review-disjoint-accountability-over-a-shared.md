---
bornAs: xytw33u
kind: story
size: 8
parent: "3318"
status: open
dateOpened: "2026-08-26"
tags: []
---

# Scoped fan-out review — disjoint accountability over a shared full-diff context

A large diff earns more reviewers, never fewer lines (#3320). Every juror gets the whole diff and full repo
context; each is accountable for a disjoint named subset, plus a seam juror scoped to shard boundaries and an
omission juror scoped to the whole diff. Reduction treats an inter-shard contradiction as signal, not noise to
dedup.

## Why

`we:scripts/lib/jury-core.mjs` scales review **rigor** — `panelRigorForCareLevel` dials `rounds`, `lenses`,
`jurorsPerLens` — but every juror still reads the entire diff at one altitude and answers for the entire diff.
So the panel gets *deeper* on a large change and never gets *wider*. Size is the one care signal the rigor dial
cannot answer, which is what made a refuse threshold look necessary in #3320. It isn't: the missing lever is
breadth, not a ceiling.

## The shape

**Scope is disjoint; context never is.** Each juror receives the whole diff and full repository access, and a
`scope` naming the subset it answers for. The attention ceiling being dodged is rigor-per-reviewer, not tokens
— a 900-line diff is small against the context window. Truncating a juror's diff to its shard would
reintroduce exactly the blindness the fan-out exists to remove. Cost scales as shards × diff size for
*reading*, which is cheap next to reasoning.

Three seat kinds:

1. **Scoped jurors** — one per shard, accountable for a named subset of changed files/hunks.
2. **A seam juror** — its scope *is* the boundaries: symbols and signatures crossing shard cuts. Reads edges,
   not bodies. Catches "signature changed here, call site not updated there", the classic loss of disjoint
   slicing.
3. **An omission juror** — whole diff, low rigor, one question: what isn't here? Absence has no shard by
   construction. Grounding: on PR #1569 two rounds of the claim-accuracy lens found nine wrong figures and
   missed both defects that bounced it — a test that could not fail under any mutation, and the main new
   feature having no test at all.

**Reduction flags contradictions.** Two shards asserting incompatible things about the same behaviour is a
seam signal in its own right. Naive dedup discards it.

## Deliberately out of scope

**Dependency-graph shard cutting** — grouping files by call/import edges and cutting where the graph is
weakest. Theoretically the right split, needs symbol-level analysis, and shared context removes most of its
value. Revisit only if scoped jurors measurably miss cross-file defects; file a follow-on then rather than
pre-building it.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after. Candidate: a
   conformance test over the panel assembler asserting (a) scopes partition the changed set with no overlap
   and no gap, (b) every seat's prompt carries the full diff regardless of scope, (c) a seam seat and an
   omission seat are present whenever shard count > 1.

## References

- Ruled by #3320 — `#size-adds-reviewers-never-refuses` in `we:docs/agent/platform-decisions.md`.
- Composes `#blast-radius-advisory-care-not-a-gate` (#2563) and
  `#build-lane-self-review-non-zero-floor` (care scales depth; this extends the same shape to breadth).
- Touches `we:scripts/lib/jury-core.mjs` (`panelRigorForCareLevel` and the juror-prompt assembler).
- #3317 (cumulative escalation basis) is independent but complementary — it makes the size measurement honest
  under stacked lanes, which is what dials shard count.
