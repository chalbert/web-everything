---
bornAs: x2t6cr5
kind: task
status: resolved
dateOpened: "2026-08-19"
dateResolved: "2026-08-21"
graduatedTo: none
tags: []
---

# check-backlog-item passes an item the standards gate then rejects

A duplicate of #3201, resolved as such rather than because the work happened twice. Both cards carry `bornAs: 3244` and byte-identical bodies; #3201 is the real item and was resolved 2026-08-20. This copy was minted when a stale hash-named file was swept into an unrelated commit and the drain numbered it. `check:standards` now errors on an unresolved `bornAs` twin, which is the structural fix.

> **DUPLICATE OF #3201 — resolved as such, not because the work happened twice.** Both cards carry
> `bornAs: 3244` and byte-identical bodies. #3201 is the real item and was resolved 2026-08-20.
>
> This copy exists because a stale hash-named file sat in a lane's working tree after the original had
> already landed, a `git add -A` swept it into an unrelated commit, and the drain — doing exactly its job —
> minted it a fresh NNN. PR #1506's juror had flagged that very file one commit before it minted, saying it
> "would have minted a duplicate `bornAs`". It then did.
>
> `check:standards` now ERRORS on an unresolved `bornAs` twin (`duplicateBornAs`), which is the structural
> answer: neither `duplicateBacklogNums` (the numbers differ) nor `strandedHashesOnMain` (both filenames are
> numeric) could see this state.
>
> Kept rather than deleted, per the backlog's own rule that a file is an audit trail. Nothing selects it now.
