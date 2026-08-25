---
kind: story
size: 3
parent: "3029"
status: open
relatedTo: ["3160"]
scope: ["we:scripts/check-standards-rules.mjs", "we:scripts/__tests__/check-standards-rules.test.mjs"]
dateOpened: "2026-08-25"
tags: [prevention, review, gate, pr-body]
---

# A PR description that claims an item was recorded on its card, when the diff never touched it

A PR body can say an item was prepared or recorded on its card while the PR's changed files contain no `backlog/<id>-*.md` for that id. The claim reads as durable when it lives only in prose, and the next preparer skips the item as done. Owed by a CONFIRMED finding on PR #1556, whose body said #3160 now carried the operation's contract on the card after a later round had pulled #3160 out of that PR. Ground truth is mechanical: ids claimed versus ids touched.

## Why a gate rather than a review habit

The finding was caught, but only because a juror re-derived the PR's net changed-file list and opened
`#3160` on `main`. Nothing in the pipeline compares the two. Both halves are already available without
judgment: the claimed ids are `#<digits>` tokens in the body near a claim verb, and the touched ids are the
`backlog/<id>-*.md` paths in the diff. A body that claims an id it never touched is a **fact** about two
lists, not an opinion about wording — which is exactly the shape `#2963`'s hookable-vs-judgment split says
belongs in a script.

## What it must not do

**It must not flag every id a body mentions.** A body legitimately cites related items, blockers, parents and
prior art without touching them, and a check that flagged those would fire on nearly every PR and be turned
off within a week. Only a mention carrying a **claim verb** — *prepared*, *recorded*, *stamped*, *updated on
the card*, *now carries* — is in scope. Getting that predicate narrow enough is the actual work of this item;
the set comparison is trivial.

**It must not read `main`.** Whether the card is *good* is a review question. This asks only whether the PR
that claims to have written it, wrote it.

## Interfaces

A rule in `we:scripts/check-standards-rules.mjs` taking `{ body, changedFiles }` and returning findings, so it
is pure and testable without a network call. Wiring it to a PR context is the caller's job.

## Done when

1. **Executable** — a case where a body says *"#3160 now carries the operation's contract, recorded verbatim
   on the card"* and `changedFiles` contains only `backlog/3233-*.md`, `backlog/3230-*.md`,
   `backlog/3238-*.md` returns exactly one finding naming `3160`. That is PR #1556's real input.
2. **Executable** — a case where the same body's changed files DO include `backlog/3160-*.md` returns none.
3. **Executable** — a body that merely cites ids without a claim verb (`relatedTo`-style prose, *"blocked by
   #3165"*, *"see #2678"*) returns none, so the rule does not fire on ordinary cross-references.
4. **Mutation** — dropping the claim-verb predicate reddens case 3 by name; dropping the set comparison
   reddens case 1.
5. `npm run check:standards` — no new errors and no new warnings against the baseline at build time.
