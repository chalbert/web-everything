---
bornAs: xuyij7f
kind: task
status: resolved
dateOpened: "2026-08-26"
dateResolved: "2026-08-26"
graduatedTo: "3327"
tags: []
---

# The tmpdir body-file test inverts on every macOS host

**Duplicate of [#3327](/backlog/3327/) — resolved as such, not as work done.** Both cards describe the same
defect in the same test; #3327 was filed first, carries the fix record, and is the one to read. This file stays
as the audit trail rather than being deleted, because `we:scripts/guard-bash.mjs` refuses `rm`/`git rm` of any
backlog card: *"done items resolve (status:resolved); the file stays."*

> **Retraction.** This paragraph previously gave a different reason — that the file stays *"following the same
> treatment as the other double-minted items the standards check reports."* **That was wrong.** The rule it
> appealed to, `duplicateBornAs` (`we:scripts/check-standards-rules.mjs:2180`), groups cards by **identical
> `bornAs`**. #3327 is `bornAs: 3327` and this card is `bornAs: 3328` — different hashes, so the rule
> never fires on this pair and never would have. Run in this lane, `check:standards` reports exactly two such
> pairs — `3244` (#3201/#3244) and `3112` (#3111/#3112) — and says nothing about #3327/#3328.
>
> The disposition is unchanged, because the load-bearing reason is the `rm` guard and that one is real. Only
> the precedent cited for it was invented. And the mistake is itself the record: `duplicateBornAs` catches
> **one card minted twice**; this was **one defect filed twice, under two hashes**. No check sees that — the
> same gap #3327 names, hit a second time in the write-up of the first.

## How one defect got two cards

`3327` (→ #3327) was filed and sat unnumbered, waiting for the drain. While it was in flight, the session
fixing the defect grepped its working checkout for `3327`, found nothing — the land had not reached it —
and concluded the id was a phantom it had invented. Believing it had cited a nonexistent card in a commit
message and a PR title, it "corrected" the record by filing this card and rewriting the references to point
here. The drain then landed both.

**The reasoning was sound and the conclusion was still wrong**, which is what makes it worth recording. A hash
id is unresolvable **by design** between filing and land. `grep` finding nothing is the *expected* state for a
real card, and it is indistinguishable from the state for an invented one. So the search that felt like
verification could not have distinguished the two cases.

Two corrections follow from it:

1. Treat *"I cannot find this id"* as **unknown**, never as **absent**. The remedy for an id you cannot resolve
   is to leave the citation alone, not to replace it.
2. Check **`origin/main`**, not the working checkout, before concluding a citation dangles — and even then,
   expect a lag.

The machine-checkable half is noted on #3327: `check:standards` errors on a stranded hash-named *file*, but
nothing warns when a hash cited **in prose** matches no card in the tree or on `origin/main`. That check would
have caught this at write time instead of after two lands.
