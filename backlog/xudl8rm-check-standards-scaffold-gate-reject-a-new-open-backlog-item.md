---
kind: task
status: open
dateOpened: "2026-08-02"
tags: [backlog-hygiene, check-standards, review-integrity]
---

# check:standards + scaffold gate — reject a new open backlog item that duplicates an existing item's locus + title tokens

Add a deterministic gate that catches a new open backlog item re-filing a class
that is **already open** — same cited locus, high title-token overlap — instead
of only catching duplicate item *numbers*. Today the repo detects duplicate NNN
(`duplicateBacklogNums`, `we:scripts/check-standards-rules.mjs:2082`) but nothing
for duplicate *subject matter*, so two open items can own the same deliverable
and either collide at merge or leave a twin open forever.

## Motivating instance

During the human `/review` of PR #985 (the `we:scripts/lib/jury-ledger.mjs`
NUL-byte fix), a new item `xb3f7kq` was filed for a `check:standards`
control-byte gate that was **already open as #2836** (`bornAs: xjdkuu0`, parent
2527). Both cite `we:scripts/lib/jury-ledger.mjs` and share the title tokens
control / NUL / byte / check-standards. The duplicate was removed on that PR;
this item captures the prevention so the recurrence is script-caught, not
review-caught.

**Why recall failed (blameless):** the sibling was minted as hash `xjdkuu0` and
JIT-renamed to `2836-…` at land, so an author who remembers "I filed xjdkuu0"
finds no such file and concludes nothing was filed. JIT numbering defeats the
hash-recall lookup that would otherwise surface the twin.

## The gate (what this item adds)

1. **Locus + title-token index.** Index every open `backlog/*.md` by the
   `we:` / repo-relative loci cited in its body plus its title tokens.
2. **scaffold error.** `we:scripts/backlog.mjs scaffold` errors when the new item
   cites the same locus as an existing **open** item with high title-token
   overlap — naming the twin item and requiring an explicit `--dup-ok` to
   proceed (the intentional-sibling escape hatch).
3. **check:standards rule.** A rule over `backlog/*.md` that reports the same
   duplicate-subject-matter collision, so a dup that lands by another route
   (hand-authored file, not via scaffold) is still caught at gate time.
4. **`bornAs:` back-index in scaffold.** scaffold also searches the `bornAs:`
   hash back-index (#2836 carries `bornAs: xjdkuu0`), so a hash-recall lookup for
   a JIT-renamed item resolves to its landed `NNNN-…` file instead of coming up
   empty.

## Acceptance

- `we:scripts/backlog.mjs scaffold` errors (not warns) when a new open item cites
  a locus already cited by an existing open item with high title-token overlap,
  names the twin, and is overridable only with `--dup-ok`.
- A `check:standards` rule reports the same class over `backlog/*.md` and is
  green on the current tree.
- `scaffold` (and/or the recall path) resolves a `bornAs:` hash to its landed
  `NNNN-…` file, so a hash lookup for a JIT-renamed item is not a false "nothing
  filed".
- Unit tests: a dup-locus + overlapping-title fixture is flagged; a distinct
  fixture and a `--dup-ok` override both pass; a `bornAs:` hash resolves.
