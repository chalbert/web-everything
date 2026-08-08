---
bornAs: xdxlevu
kind: story
size: 3
status: resolved
dateOpened: "2026-08-03"
dateStarted: "2026-08-03"
dateResolved: "2026-08-03"
tags: [drain, jit-numbering, backlog-state, conveyor]
relatedTo: ["2288", "2748", "2319"]
scope:
  - we:scripts/lane-drain.mjs
  - we:scripts/merge-ai-prs.mjs
  - we:scripts/backlog-stranded-sweep.mjs
  - we:scripts/__tests__/lane-drain-numbering.test.mjs
  - we:scripts/__tests__/lane-drain.test.mjs
  - we:scripts/__tests__/merge-ai-prs.test.mjs
  - we:scripts/__tests__/backlog-stranded-sweep.test.mjs
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

**CORRECTED 2026-08-03 — the original diagnosis below was wrong, and the title still reflects it.**
A red-team of a follow-on proposal re-traced this and found the cause is not JIT numbering at all.
Recording both, because the wrong version already landed and a future reader needs to know which
to trust.

### The actual cause: the solo land routes never call the flip

`we:scripts/merge-ai-prs.mjs` imports exactly `DERIVED_REGEN`, `DERIVED_OUTPUT_PATHS`,
`numberPendingHashes`, `isPostLandTreeDirty`, `landedNumberFor` from `we:scripts/lane-drain.mjs`.
It does **not** import `resolveLandedItem` — #2748's `active`/`open` → `resolved` flip — and never
calls it.

`resolveLandedItem` is wired only into `we:scripts/lane-drain.mjs`'s own couple-drain path. So an
item landing via the solo `/pr` or `/merge` route gets its number and its derived-artifact regen,
but **never** the status flip. #2880 landed via exactly that route (PR #999), which is why it sat
`open` with its code live on main.

This is a coverage gap in #2748, entirely independent of when the NNN is assigned. It reproduces
identically under any numbering scheme, and the fix is to make every land route share one flip —
not to change numbering.

### The original (incorrect) diagnosis, kept for the record

It claimed `readResolveReachable` (`we:scripts/lane-drain.mjs`) returns `null` for a brand-new
JIT-numbered item because it resolves the card with `git ls-files` against the local index, and
that the caller's `if (resolveReachable === false)` guard then skips the flip since `null` is not
`false`.

That `null`-vs-`false` conflation is **real and still worth fixing** (see A2) — it is a genuine
sharp edge in the same function. But it is not what stranded #2880 and #2450, because on the solo
route neither `readResolveReachable` nor the guard is ever reached: the module that lands those
PRs does not import the flip at all.

### Second, larger cause — there are TWO landers, and only one of them resolves

Found while reviewing PR #1012 (2026-08-03). The analysis above is correct **for
[`we:scripts/lane-drain.mjs`](scripts/lane-drain.mjs)** — but that is not the lander that landed either
observed case. `resolveLandedItem` and `readResolveReachable` are defined **and called only inside**
[`we:scripts/lane-drain.mjs`](scripts/lane-drain.mjs) (`:404-416`, `:804`, `:821`), the couple-queue drain
the `/drain` skill itself describes as *"retired to a legacy no-op fallback"*.

The lander that actually runs is the **label** lander,
[`we:scripts/merge-ai-prs.mjs`](scripts/merge-ai-prs.mjs). It imports from
[`we:scripts/lane-drain.mjs`](scripts/lane-drain.mjs) — but only `DERIVED_REGEN`, `DERIVED_OUTPUT_PATHS`,
`numberPendingHashes`, `isPostLandTreeDirty`, `landedNumberFor` (`:112`). **Not the resolve flip.** It
contains no [`we:scripts/backlog.mjs`](scripts/backlog.mjs) invocation and writes no item frontmatter at all.

That is the whole shape of the bug in one line: **the two landers share the NUMBERING but not the
RESOLVING.** `numberPendingHashes` was deliberately single-sourced ("shares lane-drain's
`numberPendingHashes` — single source, never a fork", `we:scripts/merge-ai-prs.mjs:2555`); the resolve was
not. So the live path assigns the NNN and never touches `status:` — exactly the observed `b4894dd8`
signature, *"the number was assigned; the status was not."*

Consequence for the fix as originally scoped: repairing `readResolveReachable` alone would close the
lane-drain path and leave the operative one fully intact. Both must be closed, and the resolve must be
single-sourced the way the numbering already is — one home, both callers — or this recurs the next time a
third land path appears.

## Definition of done

- **A1 — every land route flips the status.** The solo `/pr` and `/merge` route
  (`we:scripts/merge-ai-prs.mjs`) calls the SAME resolve-on-land flip the couple-drain path uses,
  rather than importing only the numbering half of `we:scripts/lane-drain.mjs`. One flip, shared —
  not a second copy that can drift from the first.
- **A2 — `null` is not silently "do nothing".** In `readResolveReachable`, a couldn't-tell verdict
  is distinguished at the call site from a definite `false`: it retries against the fetched tree or
  is surfaced, never dropped. Independent of A1 — a real sharp edge in the same function, just not
  the one that stranded these items.
- **A3 — covered end-to-end on BOTH routes.** A test lands an item via the solo route and asserts
  the card ends `resolved` on main. Route coverage is the point: the original bug was invisible
  precisely because only the couple path was exercised.
- **A4 — heal the existing strandings.** A one-time sweep flags every `open`/`active` item whose
  `bornAs` hash corresponds to a merged PR, so the ones already stranded (beyond #2880/#2450) are
  found rather than waiting to be re-packed. Report them; do not bulk-flip unreviewed, since a
  genuinely broader-scoped item may legitimately outlive its first PR.
- **A5 — retitle.** The title still says "JIT-numbering at land leaves a delivered item open", which
  the corrected diagnosis disproves. Rename to name the real cause (a land route that skips the
  resolve-on-land flip) as part of the fix, so the card stops teaching the wrong lesson.
- **A6 — the LABEL lander resolves too, from ONE home.** `resolveLandedItem` is exported from
  [`we:scripts/lane-drain.mjs`](scripts/lane-drain.mjs) and called by
  [`we:scripts/merge-ai-prs.mjs`](scripts/merge-ai-prs.mjs) off its terminal land event, for every item it
  landed this pass — single-sourced exactly as `numberPendingHashes` already is, never a fork. It runs
  INSIDE the numbering critical section and AFTER numbering, so a freshly-minted NNN is the id it flips, and
  the flip commit rides the same `HEAD:main` push. A6 is the operative half: without it A1/A2 repair a path
  that no longer runs.
- **A7 — the flip is TOTAL and never silent.** Every item the pass landed ends in exactly one observable
  bucket — `resolved` / `alreadyResolved` / `deferred` / `failed` — reported on stderr AND in `--json`.
  `flipped` means the flip is a COMMIT, so a failed commit is never logged as a resolve. A couple whose
  sibling half is still open is DEFERRED rather than resolved (the whole couple must have landed), and that
  deferral is announced, because it is terminal for the run and A4's sweep is its only recovery path. A
  silent skip inside a fix for silent skips is the one outcome this item cannot ship.

## Boundary

Not a change to JIT-numbering (#2288, resolved) — the corrected diagnosis removes it from the causal
chain entirely. This is a **coverage** fix to #2748's resolve-on-land ownership: the mechanism is
right, one land route just never calls it. #2748's rule that the DRAIN owns the flip off its terminal
land event is unchanged; A6 only makes the *live* drain one of the drains that obeys it.

## Scope widened by #2989 R8 (2026-08-03)

The couple-join review (R8) found the deeper half of this class: `resolveLandedItem` (#2748) lived
ONLY in the retired `we:scripts/lane-drain.mjs`, so the LIVE **label** lander
(`we:scripts/merge-ai-prs.mjs`, plus `we:scripts/pr-land.mjs`) never flipped a landed item at all —
a reciprocal `blockedBy` therefore became a permanent block. #2989 cut a first version of
resolve-on-land on the label lander, then SPLIT IT BACK OUT (PR #1012 round-3 review, B5): it resolved
off the WE carrier ALONE and ungated, so an impl half whose merge threw would still leave the card
flipped with its PR open. This item carries resolve-on-land instead, and its scope includes
`we:scripts/merge-ai-prs.mjs` so A1's every-land-route flip and A2's `null`-verdict handling are
applied to the label-lander path too — through the shared `resolveLandedItem` (A6: one home, both
callers), behind the couple-completeness gate, with A7's totality buckets. #2989 keeps only the
couple-join decoupling.
