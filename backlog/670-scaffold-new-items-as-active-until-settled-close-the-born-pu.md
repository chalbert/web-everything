---
type: issue
workItem: story
size: 5
status: active
dateOpened: "2026-06-15"
dateStarted: "2026-06-15"
tags: []
---

# Scaffold new items as active-until-settled (close the born-public claim race)

scaffold creates a new item as status:open, so an agent-scaffolded spin-off is born PUBLIC — surfaced + claimable by a concurrent session before its digest / blockedBy / body are authored (verified this session: the other agent's #667 sat status:open mid-authoring). Mirror the claim lifecycle: scaffold -> active (owned by the creating session) and flip to open only when SETTLED (body + edges done), via an explicit settle verb. Agent-scaffold only; hand-created items stay born-open. Needs orphan recovery so a crashed agent can't strand an item active. Closes a real agent-separation hole; complements the unguarded file-level gap (#083).

## The hole (verified)

`scaffold()` ([scripts/backlog.mjs:155](../scripts/backlog.mjs#L155)) renders a new item via `renderItem(...)`
with **`status: open`**, and the CLI's own success message says *"fill the digest (TODO line) and body, then
re-run check:standards"* — i.e. authoring happens **after** the file exists. So there is a window —
scaffold → (write digest, set `blockedBy`/`parent`, write body) — during which the item is already in every
other session's `check:readiness --select` pool (the pool is a pure projection of `status`/`batchable`) and
fully claimable. A concurrent batch can claim a half-authored spin-off with no digest and no blocker edges,
then work it against a false premise.

**Evidence, this session:** a sibling agent's `/slice 646` produced **#667** (and #668/#669/#660); during my
batch's seam top-up, `#667` surfaced as Tier-A `open` while it was still being authored. Nothing but my own
pre-flight reading kept me off it — there was no ownership signal.

## The fix — born `active`, released on settle

Mirror the claim lifecycle so a scaffolded item is **owned by its creating session until it is fully
authored**:

1. **`scaffold` creates `status: active`** (+ stamp the creating session, the same way `reserve` records a
   `--session`), NOT `open`. An `active` item is excluded from every other session's batch pool, exactly
   like a claimed item.
2. **An explicit `settle` verb flips `active -> open`** (`node scripts/backlog.mjs settle <NNN>`) once the
   digest + `blockedBy`/`parent` edges + body are written — *that* is what publishes it. Explicit, not
   auto-on-digest-fill, because only the author knows the edges are final (auto would re-introduce the race
   for a digest-but-no-edges state).
3. **Scope: agent `scaffold` only.** Hand-created / planning items are *meant* to be born `open` for anyone —
   this changes the `scaffold` CLI path, not the convention for human-authored cards.

## Sub-mechanisms to settle when worked (defaults in **bold**, not forks)

- **Orphan recovery (required).** A crashed/abandoned session must not strand an item `active` + invisible
  forever. **Default: a TTL on the scaffold-active hold (mirror `reserve`'s advisory TTL), plus a
  `check:health` flag for an `active` item with no `dateStarted` older than the TTL** — so a stale born-active
  item is legibly recoverable (auto-revert to `open`, or surfaced for a human). (An `active`-from-`scaffold`
  has no `dateStarted` — distinct from an `active`-from-`claim`, which does — so the two states are
  distinguishable for the orphan check.)
- **`check:standards` expectations.** Today `active` implies "being worked" (claim stamps `dateStarted`). A
  born-active-unsettled item is a new sub-state; the validators that assume `active ⇒ dateStarted` must learn
  it (or scaffold stamps a separate `dateScaffolded`/owner field instead of overloading `status`).
- **Readiness projection.** `--select` already excludes `active`; confirm a born-active item is treated as
  in-flight (it should be, since the projection is status-driven) and counted in the "in flight elsewhere"
  legend.

## Scope boundary

This closes the **born-public, half-authored-item** race only. It is **complementary to**, not a replacement
for, the deeper agent-separation gap: a shared working tree + single git index with **no file-level lock**
(two sessions can still edit `blocks.json`/`intents.json`/configs concurrently and clobber). That is
[#083](/backlog/083-agent-file-lock-coordination/) (resolved as a *design* — JIT ownership + queue — but with no
running enforcement in the `claim`/`scaffold` path); the durable fix there is **git-worktree isolation per
session**. Cross-ref #083; consider whether this item should fold into a re-opened #083 or stay its own
narrow, shippable slice (recommended: keep narrow — this is a one-file CLI change, #083 is process
isolation).
