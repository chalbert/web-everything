---
name: red-team-each-decision-update
description: "Red-team a decision on every update (each discussion-born flip/reframe), not once at the end — banking unchecked reframes lets a terminal skeptic reverse the whole session"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 761ec8aa-6a29-46b9-9009-2e23f9edf717
---

When a `decision` item evolves through discussion, **attack each update in the turn it is
written** — do NOT bank a stack of unchecked reframes for one terminal red-team. A refinement
that **flips a default, rewrites a contract, or changes a classification is a new claim, not
transcription**: run the inline attack on it before presenting it as the item's new state, and
escalate to a separate skeptic sub-agent *at that edit* if it's high-leverage (statute-codifying
or contract-dependent). The terminal red-team then becomes a *confirmation* of the per-update
verdicts.

**Why:** this is the #1437 seat-shift one level out. #1437 moved the *first* attack on a prepared
default off the decision-turn into prep; the same logic applies to discussion edits — the first
attack on a discussion-born reframe must not be the terminal resolve. The pain the user named:
"a red-team at the end cancels all our work." It doesn't — running it *late* does. An at-write-time
attack reverses at most one edit; a banked terminal sweep reverses N unattacked edits at once and
feels like the whole session was wasted.

**How to apply:** treat every "write the conclusion into the item" turn as also a "attack the
conclusion" turn. Worked example = #1892: two "update the story" turns rewrote Fork 1 (patch→residue)
and dissolved Fork 2 with no write-time attack; the terminal skeptic refuted the lot, including a
contract-gerrymander an inline pass would have caught for one cheap step. Encoded in
`we:docs/agent/backlog-workflow.md` (*Red-team the default → Red-team each update* + the source-of-truth
update rule). See [[fork-vs-config-classification-gate]] and [[never-take-an-unprepared-decision]].
