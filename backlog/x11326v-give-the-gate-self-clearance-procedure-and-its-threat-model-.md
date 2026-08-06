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

Roughly 24 lines of clearance rationale live in the /review skill and close by pointing at a backlog resolution note, but we:AGENTS.md says the backlog chain is an archive, not the reference.

Carved out of the round-1 review of **PR #1056** (#2895's implementation), finding **m7**.

## Why it is misplaced today

#2895 added the `clear-human` procedure and its rationale to
[`we:skills-src/review/SKILL.md`](skills-src/review/SKILL.md). Two repo rules say that is the wrong home for the
"why":

- [`we:docs/agent/skill-authoring.md`](docs/agent/skill-authoring.md) — a "why" paragraph belongs in the doc, and
  the skill carries the procedure that cites it.
- [`we:AGENTS.md`](AGENTS.md) — the backlog chain is "an archive, not the reference", so a skill that ends with
  "see #2895's resolution note" is routing a live reader into the archive for the reasoning.

## What the doc has to hold

- The **procedure**: who may clear a gate-self PR, with what command, and what the durable record must contain
  (label swap + `reviewed-sha` stamp + attributed comment).
- The **threat model**, by CITATION not by copy. The canonical statement of what the terminal check is and is
  not lives at `we:scripts/review-set-label.mjs#decideHumanCeremony` (#1056 finding M1 — the claim was written
  out four times and was wrong in all four). This doc names it and links; it does not paraphrase it.
- The **successor**: the UI-with-auth replacement, so a reader knows the terminal gate is a way-station.

## Done when

- A `we:docs/agent/*.md` section owns the gate-self clearance procedure (extending the existing review-workflow
  doc if that is the natural home rather than minting a new file).
- `we:skills-src/review/SKILL.md` keeps the operator-facing command and steps, and cites the doc for the "why"
  instead of carrying ~24 lines of rationale.
- Nothing in either file restates the threat-model claim; both cite the code anchor.
