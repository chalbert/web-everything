---
bornAs: xdbi20n
kind: task
status: open
dateOpened: "2026-08-25"
tags: []
---

# A carried correction paragraph must name the revision it describes, not the previous one

A correction written as *"the previous body said X"* is true only for the revision right after the one it
describes. Carried unchanged into the next revision, the antecedent retargets and the paragraph becomes a
false accusation against the round that just fixed the thing. On PR #1561 three such paragraphs rotted, and
the costliest reported a missing CI run id against a body that already carried one — the violation that PR
filed `3294` to prevent. The rule: a correction surviving a revision must name its subject
non-deictically — a round, a revision timestamp, or a sha.

## Done when

1. **Executable** — a check that reddens on a PR body whose correction paragraphs use a bare backward-deictic
   antecedent, and passes when each names its subject. Provisional shape: extend
   `we:scripts/check-backlog-workflow.mjs` (or the PR-body linter it fronts) to find paragraphs marked as
   corrections — leading `**A correction`, `**… is a correction`, `**A correction, carried` — and refuse the
   definite deictic forms (`the previous body`, `the previous round`, `the last body`, `the prior round`)
   where the paragraph **asserts** them, accepting a named round (`round 4's body`), a revision timestamp, or
   a sha. Two forms must NOT be refused: existentially quantified ones (`an earlier body said …`), which do
   not retarget, and ones inside a quotation of the sentence being retracted — this repo retracts by quoting
   the wrong version, so a check that scanned quoted spans would refuse every correct retraction. Verify
   against #1561's body revisions, fetched with
   `gh api graphql -f query='query { repository(owner:"chalbert", name:"web-everything") { pullRequest(number:1561) { userContentEdits(first:50) { nodes { editedAt diff } } } } }'`:
   - **must flag** the `2026-08-26T02:32:02Z` revision — three correction paragraphs there open with *"The
     previous body …"*, and at that revision all three are false of the body that phrase names (the
     `2026-08-26T01:35:50Z` one): its Gate section cites run `32919116662` on head `11a7d778`, its mutation
     table already has the spawn-seam and listing-seam rows split (lines 118–119), and its line 147 already
     quotes `expected [ …(19) ] to include …`.
   - **must flag** the `2026-08-26T00:56:10Z` revision as well, where the *"Rows 4 and 5 are a correction"*
     paragraph carried the same bare deictic while it was still **true** — of the `2026-08-25T23:55:37Z` body,
     whose table does carry the single undifferentiated row. The check flags the construction, not the
     falsehood; that is the point, since the sentence rotted one revision later without being touched.
   - **must not flag** the body #1561 merges with, where every carried correction names its round and
     revision timestamp, and the one existential form (*"an earlier body said …"*, on the `1435` warning
     count) is left as-is.

Owed as prevention by the round-6 correctness review of #1561, which found the three rotted paragraphs. It is
the fourth rule this PR files and the only one about a claim's *antecedent* rather than its measurement: the
other three — `3295`, `3294` and `3292` — ask where a number came from, this one asks what a sentence
is still about after the document moves under it.
