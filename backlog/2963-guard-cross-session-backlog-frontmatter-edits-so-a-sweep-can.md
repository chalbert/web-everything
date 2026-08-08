---
bornAs: x93eptj
kind: story
size: 3
status: open
relatedTo: ["2983"]
scope:
  - we:scripts/backlog-guard.mjs
  - we:docs/agent/backlog-workflow.md
  - we:skills-src/consolidate-backlog-items/SKILL.md
tags: [backlog, concurrency, guard, consolidate, ownership]
dateOpened: "2026-08-06"
---

# Guard cross-session backlog frontmatter edits so a sweep cannot rewire an item another lane owns

`/consolidate` (#2983) defines its candidate set as every item with `status` ≠ `resolved`, then writes
`parent:` and `blockedBy:` into each clustered member. That set includes items another lane currently owns
(`status: active`, plus soft-held and reserved cards), so a board-wide sweep can rewrite frontmatter in files a
concurrent session is editing. Nothing detects it: the failure is a merge conflict at land, or the grouping edit
silently losing to the owning lane's version. Make ownership unbypassable rather than a prose instruction.

## Why it is owed

The rule already exists and this flow contradicts it. `we:docs/agent/backlog-workflow.md:258` states ownership is
`status`, never the working tree — "a racing agent is detected by the item reading `status: active`" — and the
*Keep the blocker DAG honest* section says "edit only the items you're already working; don't sweep the whole
backlog mid-task". A bare `/consolidate` is defined to sweep the whole board.

The skill widens the hole deliberately: `we:skills-src/consolidate-backlog-items/SKILL.md:24-25` notes the
readiness projection (`check:readiness -- --select --json`) is "incomplete" and instructs a one-pass frontmatter
scan of `backlog/*.md` "for the complete board" — which re-admits exactly the `active`/held/reserved items
readiness already drops.

The predicate was inherited from `/split`, where it is harmless: `/split` mutates one operator-named item and
creates new children. `/consolidate` inverts that into a sweep that writes into N pre-existing cards it never
selected deliberately, so the same wording carries a much larger blast radius.

Surfaced by the `/review` panel on PR #1070 — three of four lenses (correctness, security, standards-conformance)
converged on it independently. It was the one finding with no capturing gate; the PR was accepted on the basis
that this would be filed rather than left to the next reader.

## Build

Pick one, and record why:
- **Extend `we:scripts/backlog-guard.mjs --pre`** (already wired as a PreToolUse `Edit|Write` hook) to deny a
  non-claim frontmatter edit to a `backlog/*.md` whose on-disk `status` is `active`/held/reserved unless the
  editing session is the owner. Catches the whole class — consolidate, ad-hoc re-parenting, any cross-session
  frontmatter edit — not just this one skill.
- **Add `node we:scripts/backlog.mjs reparent <member> --parent=<epic>`** alongside the existing frontmatter-only
  writers (`retype`, `prioritize`), refusing a member whose `status` is not `open`. Narrower, but makes the
  documented consolidation step go through a checked path.
- **Filter the candidate set at source** — derive it from the readiness projection, which already knows what is
  owned, and report an owned item as *left apart* with reason "owned by `<session>`". Weakest on its own (prose,
  not a gate), but the right pairing for either option above.

While here, the adjacent silent case: the umbrella step overwrites `parent:` on a member that already has one,
detaching it from its existing epic with no carve-out. `/split` carries the mirror caveat; the inverse was never
derived. A guard that denies REPLACING a non-empty `parent:` with a different id covers both.

## Acceptance

- A frontmatter edit to a `backlog/*.md` reading `status: active` from a session that does not own it is
  **denied**, with a message naming the owner.
- The owning session's own edits to that same file still pass, as does a first-time `parent:` add on an `open`
  item.
- A `/consolidate` run on a board containing an owned item reports it as *left apart* with the ownership reason,
  and never mutates it.
- Tests pin both directions — the denial and the two legitimate paths — so the guard cannot regress into a
  blanket block on backlog edits.
