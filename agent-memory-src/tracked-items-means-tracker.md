---
name: tracked-items-means-tracker
description: "tracked items" / "the tracker" = items in the epic #3383 tracker card; planned work lives ONLY in the tracker and filed backlog items, never only in the handoff
metadata:
  type: feedback
---

When the operator says "tracked items" / "the track items" / "the tracker", they mean the items in the tracker (epic #3383 card on `lane/mechanical-dispatcher`, kept current with /prototype-tracker). They do NOT mean the handoff queue or the todo list.

Planned work has exactly two sources of truth: the tracker and filed backlog items (`backlog/*.md`, one file per item, filed via /file-item). If a plan or root cause exists only in the handoff file, in chat, or in a worker result's "owed" list, it is off the books: file it or add it to the tracker. The handoff may point at items by id but never holds the only copy.

**Why:** on 2026-09-20 I read "add some of the tracked items to the next queue" as "add the root causes to the handoff's queue" and wrote six unfiled items into the handoff only. The operator meant the tracker items, and expects the tracker plus filed items to be the only planned-work sources.

**How to apply:** when the operator names "tracked items" or "the queue", read the tracker card's owed lists and filed items first. When new planned work appears, file it (search first with capability-search; file uncleared unless an operator or orchestrator decision clears it) or add it to the tracker. If the wording is ambiguous, say which store I am reading before acting. See [[backlog-is-the-tracker]].
