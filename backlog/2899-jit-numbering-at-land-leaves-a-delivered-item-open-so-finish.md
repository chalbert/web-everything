---
bornAs: xdxlevu
kind: story
size: 3
status: open
dateOpened: "2026-08-03"
tags: [drain, jit-numbering, backlog-state, conveyor]
relatedTo: ["2288", "2748", "2319"]
scope:
  - we:scripts/lane-drain.mjs
  - we:scripts/__tests__/lane-drain-numbering.test.mjs
  - we:scripts/__tests__/lane-drain.test.mjs
---

# JIT-numbering at land leaves a delivered item open, so finished work is re-selected forever

The drain assigns an NNN to a hash-id item when its PR lands but never flips the item status to
resolved, so delivered work keeps ranking Tier-A agent-ready and is re-packed into batch after
batch. Each re-pack costs a full claim, lane, and investigate cycle before someone discovers the
code is already on main. Two of the three items packed into batch-2026-08-02 were in exactly
this state. Root cause traced: `readResolveReachable` probes the local working index rather than
the `origin/main` tree, so a brand-new hash-id file reads as absent and the flip is skipped.

## Observed (2026-08-03, batch-2026-08-02-2880-2450-2457)

Two of the three packed items were already fully delivered on `main`:

| item | `bornAs` | landed as | state when packed |
| --- | --- | --- | --- |
| #2880 | `2880` | PR #999, merged 2026-08-02 | `status: open` |
| #2450 | `xo75zon` | PR #435 | `status: open` |

- #2880's JIT-number commit is `b4894dd8` — *"drain: JIT-number 2880→#2880, 2881→#2881 at
  land (#2288)"*. The number was assigned; the status was not. Meanwhile
  `we:scripts/merge-ai-prs.mjs` already carried `const orderExtraOpenItems = openPrContext.openItems;`
  and **all three** of the item's ACs had passing oracles.
- #2450 was the same shape: `computeNetDiffText` live and wired, `we:skills-src/drain/SKILL.md`
  step 1 naming the net basis, `buildPanelMandate` taking `netChangedFiles` — the whole fix shape
  including the part the item marked *optional*.
- Both were surfaced as Tier-A agent-ready by `npm run check:readiness -- --select` and packed.
  Closing them took a claim, a lane clone, a full code investigation, a gate run, and a PR **each**
  — to change one frontmatter line.

## Why this compounds

The waste is not one-off. An item in this state is **permanently** eligible: it never resolves on
its own, so every future batch that packs by leverage will keep selecting it. The cost per re-pack
is a full item cycle, paid by whoever draws it next, in a fresh context with no reason to suspect
the work is done. For a session-free conveyor this is worse than wasted time — it is the selector
confidently handing an agent work that does not exist.

## Root cause

#2748 already shipped the general resolve-on-land mechanism, and it *is* wired. The gap is
narrower and specific to freshly-numbered items:

- `readResolveReachable` (`we:scripts/lane-drain.mjs:804-810`) resolves the card's path with
  `git ls-files backlog/<num>-*.md` — a query against the **local working index**, not against the
  `origin/main` tree it is trying to read. For a brand-new JIT-numbered item the `<NNN>`-named file
  has never existed in the local index, so `ls-files` returns nothing and the function returns
  **`null`** ("couldn't tell").
- The caller (`we:scripts/lane-drain.mjs:414`) gates the flip on `if (resolveReachable === false)`.
  `null` is not `false`, so the flip is **silently skipped** — no attempt, no warning.

So the mechanism is correct for an item whose file already existed on main under its NNN, and
misses exactly the class JIT-numbering creates. The two distinct verdicts — `null` (couldn't tell)
and `false` (definitely not resolved) — collapse into "do nothing" at the call site.

## Definition of done

- **A1 — read the tree, not the index.** `readResolveReachable` resolves the card off `origin/main`
  (e.g. `git ls-tree` / `git show origin/main:…`, or a lookup that also tries the item's `bornAs`
  filename), so a brand-new JIT-numbered file is found rather than reported absent.
- **A2 — `null` is not silently "do nothing".** A couldn't-tell verdict at the call site is
  distinguished from a definite `false`: it either retries against the fetched tree or is surfaced,
  never dropped. A land that cannot determine resolve-reachability must not pass quietly.
- **A3 — the JIT path is covered end-to-end.** A test lands a hash-id item, JIT-numbers it, and
  asserts the card ends `resolved` on main — the case that currently escapes.
- **A4 — heal the existing strandings.** A one-time sweep flags every `open`/`active` item whose
  `bornAs` hash corresponds to a merged PR, so the ones already stranded (beyond #2880/#2450) are
  found rather than waiting to be re-packed. Report them; do not bulk-flip unreviewed, since a
  genuinely broader-scoped item may legitimately outlive its first PR.

## Boundary

Not a change to JIT-numbering itself (#2288, resolved) nor to the resolve-on-land mechanism's
ownership model (#2748) — both stay as they are. This closes the one path where the two meet and
the status flip falls through.
