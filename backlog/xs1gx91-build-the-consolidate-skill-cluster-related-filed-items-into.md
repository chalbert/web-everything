---
kind: story
size: 3
status: resolved
scope: ["we:docs/agent/backlog-workflow.md", "we:skills-src/consolidate-backlog-items/SKILL.md", "we:.claude/commands/consolidate.md"]
dateOpened: "2026-08-06"
dateStarted: "2026-08-06"
dateResolved: "2026-08-06"
graduatedTo: none
tags: [backlog, skill, agent-workflow]
---

# Build the /consolidate skill — cluster related filed items into logical work sets

A `/consolidate` skill (the inverse of `/split`): sweep the open backlog, cluster items that are really
one job, and propose an **umbrella epic** or a **batch pack** per cluster — report always, mutate only on
approval. **Fold** (retiring a true near-duplicate) is reported-only here, pending the retirement decision
#xm3vnk8.

## Why

`/split` manufactures batchable work by breaking one big item into slices; nothing does the reverse.
Items accrete from independent sources — a gap sweep, a program watch, an ad-hoc filing — so the backlog
grows *adjacent* items that are really one job: three cards on the same subsystem, a story plus the task
that only makes sense with it, two near-duplicates filed weeks apart. The existing defence is authoring-time
only (*[we:docs/agent/backlog-workflow.md](docs/agent/backlog-workflow.md) → Rules → Review before adding
(dedup)*) — it stops a *new* near-duplicate, and does nothing about the ones already on disk.

## The three cluster outcomes

1. **Umbrella** — distinct but coupled items that add up to one deliverable → scaffold (or reuse) a
   `kind: epic` and set `parent:` on the members. Pure existing mechanism.
2. **Pack** — items that stay separate but should be worked in one pass → make the real prerequisites
   `blockedBy` edges and name the pack for `/batch`.
3. **Fold** — one item's scope sits entirely inside another's. **Reported only** until #xm3vnk8 rules on
   how a folded item retires; the report names the survivor and the cross-refs.

Same discipline as `/split`: investigate the real code before claiming two items are one job, apply a
rubric, always write the report, mutate only on one "go". The conservative instinct inverts — a *needless*
consolidation buries independently-deliverable work under an umbrella nobody can batch, so when the
cluster isn't obvious, leave the items alone and record why.

## Done when

- The method lives in *[we:docs/agent/backlog-workflow.md](docs/agent/backlog-workflow.md) → Consolidating
  related items*, with the candidate set, the consolidation-safety rubric, the report shape, and the
  mechanical execution steps.
- [we:skills-src/consolidate-backlog-items/SKILL.md](skills-src/consolidate-backlog-items/SKILL.md)
  is a thin trigger + pointer + quick path per *[we:docs/agent/skill-authoring.md](docs/agent/skill-authoring.md)*
  (`.claude/skills` is a symlink to `skills-src/`).
- [we:.claude/commands/consolidate.md](.claude/commands/consolidate.md) routes `/consolidate` to it.
- `npm run check:standards` green.
