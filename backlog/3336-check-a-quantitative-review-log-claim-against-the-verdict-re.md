---
bornAs: x8xlz6v
kind: story
size: 2
parent: "3318"
status: open
dateOpened: "2026-08-26"
scope:
  - we:scripts/lib/review-log-claims.mjs
tags: []
---

# Check a quantitative review-log claim against the verdict record before writing it

A `## Review log` entry records this programme's own results under a header promising the next reader need not re-derive them, so a wrong number there is read as settled. Two rounds on PR #1576 bounced on exactly that: a count, a comparison and a lesson, each written from memory, not from the verdict comments they described. Give the author a command that takes a claim's PR numbers and re-derives the counts from `gh pr view <n> --json comments`, so the figure comes from a run, not a recollection.

The three wrong claims, all in one entry: *"cleared in one round each"* (zero of four did — 2 / 2 / 3 / 5); *"found nine wrong figures"* (the record produces four); and *"no test finding at all"* (both pre-split verdicts recorded one, and one of them was the same finding credited to the later round). Each was corrected only where quoted, and the next round found the next one.

Adjacent but not this: #3314 asks whether `claim-accuracy` should be mandatory — a question about who looks. #3307 sweeps an already-corrected claim to its other sites — a question about completeness. This one is about deriving the figure correctly the first time.

## Done when

1. **Executable** — `npx vitest run review-log-claims -t "#3336" | grep -qE "Tests +[0-9]+ passed"` passes on
   this branch and fails on `origin/main`, where neither `we:scripts/lib/review-log-claims.mjs` nor its suite
   exists and vitest finds no test file at all.
2. **The author's command exists** — `node we:scripts/lib/review-log-claims.mjs derive <pr>...` prints, per
   PR, the recorded review rounds with each round's decision, finding count (and per-category breakdown), net
   changed file count and lens, read from `gh pr view <n> --json comments`. Re-stamps and `review:human`
   clearances are listed separately and are **not** counted as rounds.
3. **A written figure can be pinned to the record** — a claim MARKED as
   `<!-- claim: rounds(1572)=5 -->` is verified by `node we:scripts/lib/review-log-claims.mjs check <card>`,
   which exits 1 when the record contradicts the figure *or* when the marker has drifted from the number in
   the sentence it annotates.
4. **It fires on nothing it was not asked to check** — run over every `we:backlog/`, `we:docs/agent/` and
   `we:AGENTS.md` markdown file in the tree (3344 files) it reports `0` markers, `0` errors. Nothing is
   sniffed out of prose.

**Deliberately not checked**, so the boundary is on the record: durations and spend; whether a finding is
right; comparisons, adjectives and universal quantifiers; distributive claims ("one round *each*" — multiple
PR arguments sum, so mark each row separately); and a zero-count under a named category, which is *refused*
rather than answered because a free-text category cannot distinguish "no such finding" from "tagged
differently" — the exact shape of this entry's own *"no test finding at all"*.
