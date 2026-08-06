---
kind: task
status: open
blockedBy: ["2895"]
dateOpened: "2026-08-06"
scope:
  - we:docs/agent/review-workflow.md
  - we:skills-src/review/SKILL.md
tags: [review, gate-self, docs, skill-authoring]
---

# Give the gate-self clearance procedure and its threat model a docs/agent home

The clearance rationale and its threat model live in the /review skill and in a backlog resolution note, but we:AGENTS.md says the backlog chain is an archive, not the reference, and skill-authoring says the "why" belongs in a doc.

Carved out of the round-1 review of **PR #1056** (#2895's implementation), finding **m7**.

## Why it is misplaced today

#2895 added the `clear-human` procedure and its rationale to
[`we:skills-src/review/SKILL.md`](skills-src/review/SKILL.md). Two repo rules say that is the wrong home for the
"why":

- [`we:docs/agent/skill-authoring.md`](docs/agent/skill-authoring.md) — a "why" paragraph belongs in the doc, and
  the skill carries the procedure that cites it.
- [`we:AGENTS.md`](AGENTS.md) — the backlog chain is "an archive, not the reference", so a reader who wants the
  reasoning for the gate-self clearance is currently routed into #2895's resolution note.

## What the doc has to hold

- The **procedure**: who may clear a gate-self PR, with what command, and what the durable record must contain
  (label swap + `reviewed-sha` stamp + attributed comment + the stated reason).
- The **threat model, stated as it actually is**: #2895 ruled the unforgeable actor signal DEFERRED, so nothing
  verifies that a human ran `clear-human`. What holds the tier is the explicit-instruction rule plus the
  honesty tax (`--actor` and `--reason` mandatory, both quoted in the durable record). Write it once, here, and
  have the skill and the code header cite this doc — #1056 finding M1 was that the same claim was paraphrased
  in four places and was wrong in all four, and the round-2/3 finding was that a mechanism can be removed while
  its guarantee sentence stays behind.
- **No unforgeability claim of any kind.** Not "an agent cannot", not "structurally", not "confirmed at a
  terminal". If a future mechanism changes what is true, this doc changes with it.
- The **successor**: [#2946], the hardware human-presence gesture, so a reader knows today's state is a
  way-station and not the design.

## Done when

- A `we:docs/agent/*.md` section owns the gate-self clearance procedure (extending the existing review-workflow
  doc if that is the natural home rather than minting a new file).
- [`we:skills-src/review/SKILL.md`](skills-src/review/SKILL.md) keeps the operator-facing command and the
  explicit-instruction rule, and cites the doc for the "why".
- The threat model is stated in exactly one place, and every other surface cites it.
