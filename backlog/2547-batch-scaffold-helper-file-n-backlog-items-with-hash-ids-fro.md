---
bornAs: xgl2ptq
kind: story
size: 2
status: open
scope:
  - we:scripts/backlog/batch-scaffold.mjs
  - we:scripts/backlog/__tests__/batch-scaffold.test.mjs
  - we:scripts/backlog.mjs
dateOpened: "2026-07-18"
tags: []
---

# Batch-scaffold helper — file N backlog items with hash ids from one spec

scaffold is one-item-at-a-time, so filing a large red-teamed set (14 items, #558) tempted a hand-authored batch with hand-numbered ids — the sanctioned-path bypass that caused the collision and corruption. Add a batch mode that mints hash ids for N items at once from a single spec input, wires their cross-refs by hash, and writes standards-shaped files — so filing a whole program set uses hash ids with no per-item friction and no incentive to hand-number.

## Design

**Everything this needs already exists as pure functions; the batch mode is composition, not new machinery.**

- `renderItem(spec)` — `we:scripts/backlog/scaffold.mjs:79`. Emits the whole file body: frontmatter
  (`kind`/`size`/`parent`/`status`/`blockedBy`/`scope`/`dateOpened`/`tags`), the H1, the digest paragraph, and
  — since #2949 — the `## Done when` skeleton. Pure, takes a plain spec object. **Reuse it verbatim**; a
  second renderer is exactly how a batch path comes to emit files the single path would not.
- `nextHash(existingIds)` — `we:scripts/backlog/id.mjs:71`. Mints one collision-free `x` + 6-base36 id.
- `normalizeId` / `isHash` — `we:scripts/backlog/id.mjs:40-55`. Normalizes a cross-ref that may be a landed
  `NNN` or an in-flight hash, without zero-padding a hash into corruption.
- `swapHashes(text, entries)` — `we:scripts/backlog/id.mjs:107`. A blind whole-token `\bhash\b` replace,
  documented as provably safe because a hash never recurs in prose. This is the mechanism for the
  "wires their cross-refs by hash" half.
- `normalizeScope` — `we:scripts/backlog/scaffold.mjs:53`.
- `writeBacklogMd` — the guarded write funnel `scaffold()` already goes through (`we:scripts/backlog.mjs:671`).
  Every item in the batch must go through it too, or the batch path becomes a second bypass of the very
  guards this item exists to make unnecessary.

**The one genuinely new problem: minting N ids without self-collision.** `nextHash` takes the existing id
list, so a naive loop that re-globs `backlog/` between items would be O(N) globs *and* would still miss an id
minted-but-not-yet-written. Mint the whole set in one pass against an accumulating array:

```js
const taken = files().map(idFromName).filter(Boolean);
const ids = specs.map(() => { const h = nextHash(taken); taken.push(h); return h; });
```

Only then render and write. `scaffold()`'s existing single-item re-glob guard (`we:scripts/backlog.mjs:660-664`)
becomes unnecessary in the batch path because `taken` already carries the in-batch mints.

**Symbolic cross-refs are what make one spec worth having.** A spec entry needs to be able to say
`blockedBy: ["<other entry in this batch>"]` before that entry's hash is known. So the spec addresses siblings
by a **local key** (an author-chosen slug or an index), the mint pass builds `key → hash`, and the render pass
resolves each `blockedBy`/`parent`/body `#ref` through it. This is exactly the shape `applyLedger`
(`we:scripts/backlog/id.mjs:144`) already implements for the drain's hash→NNN rewrite, one level earlier — read
it before designing a second resolver.

**Atomicity: all-or-nothing — and the naive version of this is WRONG.** A batch that writes 9 of 14 files and
then dies leaves a half-filed program set with dangling refs — worse than the hand-authored batch this
replaces. Shape validation (kind in `BACKLOG_KINDS`, a story has a Fibonacci `size`, every symbolic ref
resolves to a key in the batch or to a real on-disk item) before the first write is **necessary but not
sufficient**, because the funnel this design mandates reusing throws on *content* too:

`writeBacklogMd` → `writeBacklogMdUnguarded` → **`assertPublishableContent(rel, content)`**
(`we:scripts/backlog/guarded-write.mjs:84,107`), which runs the **#3015 secret scrub** and the **#883
locus-prefix scan** and **throws** — per file, at write time, inside the loop. So a 14-item batch whose
*third* digest forgets a `we:` prefix passes every shape check, writes items 1 and 2 to disk, and then throws.
That is the exact partial-write this card calls worse than the incident it replaces, and it is the single
most likely input error in practice — a missing locus prefix is the slip #883 exists because people keep
making.

Two ways to close it; either is acceptable, both must be deliberate:

- **Render-all-then-write-all.** Render every item's full content in memory, run `assertPublishableContent`
  over each rendered body in a dry pass, and only then enter the write loop. This reuses the *same exported
  gate* rather than re-implementing it — `assertPublishableContent` was extracted for exactly this reuse
  (#3150, whose first caller is `we:scripts/operations/explore-io.mjs`).
- **Write to a temp dir, then move.** Heavier, and the move is not atomic across N files either.

Prefer the first. The rule: **nothing may throw once the first file has been written.**

**Reuse `--session` semantics.** `scaffold --session=<slug>` stamps `status: active` + `scaffoldedBy` so a
half-authored item is pool-excluded until `settle` (#670). A batch of 14 freshly-minted, digest-less items is
the strongest case for that guard, so the batch mode should carry `--session` through to every item rather
than reinventing a batch-level equivalent.

## Done when

1. **Executable — the batch mints, resolves and renders.** Run, from the WE checkout root:

   ```
   npx vitest run scripts/backlog/__tests__/batch-scaffold.test.mjs
   ```

   It passes with cases asserting, over a synthetic 3-entry spec: three distinct `x`-prefixed hash ids are
   minted in one pass; a symbolic `blockedBy` pointing at a sibling entry resolves to that sibling's **minted
   hash**, not to its symbolic key; and each rendered body is byte-identical to what `renderItem` produces for
   the same resolved spec. The whole file does not exist on `main`, so it fails before.
2. **Executable — no self-collision and no re-glob.** A case feeding a spec large enough to exercise the
   accumulator asserts every minted id is unique **and** that the mint pass reads the on-disk id list once. A
   loop that re-globs per item passes the uniqueness half and fails this one.
3. **Executable — all-or-nothing on a SHAPE-invalid entry.** A case with one invalid entry (an unknown
   `kind`, or a `blockedBy` naming a key that is in neither the batch nor `backlog/`) asserts the command
   exits non-zero, **wrote no files** (the directory listing before and after is identical), **and** that the
   error text names the offending entry by index or key — an operator must not have to bisect a 14-entry
   spec by hand.
4. **Executable — all-or-nothing on a CONTENT-invalid entry, which is the case the shape check misses.** A
   case where every entry is shape-valid but the **third** one's rendered body carries a bare code path with
   no `we:` prefix asserts the same "wrote no files" invariant. This is the criterion that fails against the
   obvious implementation: `writeBacklogMd`'s `assertPublishableContent`
   (`we:scripts/backlog/guarded-write.mjs:84,107`) throws mid-loop, after items 1 and 2 are already on disk.
   Put the bad entry third, not first — first would pass for the wrong reason.
5. **Observable — the sanctioned path is the whole path, and its gate is reused not re-implemented.** Every
   file the batch writes goes through `writeBacklogMd`, the pre-write pass calls the **exported**
   `assertPublishableContent` rather than carrying its own copy of the scrub/prefix rules, and each written
   file passes the per-item lint (`npm run check:item -- <id>`, `we:scripts/check-backlog-item.mjs`).
6. **Observable — no second renderer.** `we:scripts/backlog/batch-scaffold.mjs` imports `renderItem` from
   `we:scripts/backlog/scaffold.mjs` and contains no frontmatter-emitting string template of its own — one
   grep for `'---'` in that file returns nothing outside comments.

## Independent review — 2026-08-21

Confidence: **Medium**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (NOT addressed; strategy: verify by mutation or reversion ahead of the build) — The card's framing ('everything already exists as pure functions; batch mode is composition, not new machinery' / 'validate every spec entry before the first write' guarantees all-or-nothing) does not fully hold: mutating the claim by actually driving we:scripts/backlog/guarded-write.mjs's writeBacklogMd through a two-item loop (first item clean, second item's body carrying a bare `scripts/...` path with no `we:` prefix) shows item 1 lands on disk BEFORE item 2's write throws (locus-prefix #883). The card's design section lists only kind/Fibonacci-size/ref-resolution as the pre-write validation set, never the content gates (`assertPublishableContent`: secret-scrub #3015 + locus-prefix #883) that the very funnel it says to reuse ('every item in the batch must go through it too') itself enforces per file, at write time, not before the loop starts.
- **decorative-guard** (NOT addressed; strategy: mutate the guarded line; require a NAMED test to redden) — Done-when #3's all-or-nothing test only exercises shape-invalid entries (unknown kind, unresolvable blockedBy key) — both caught by the described pre-validation. For the class of failure the shared writeBacklogMd funnel itself gates (a digest/body referencing a bare code path, or something secret-shaped), the described guard does nothing: it was never wired to check that class, so it enforces all-or-nothing only for the inputs the author happened to enumerate, not for the funnel's own failure surface. Root cause: the design treated 'reuse the guarded funnel' and 'validate before first write' as two independent boxes and never traced the funnel's own throw conditions back into what the pre-validation pass needs to cover. Prevention: the cheapest durable guard is a NAMED test in the same we:scripts/backlog/__tests__/batch-scaffold.test.mjs — all spec entries shape-valid, but one rendered body carries a bare code-path reference — asserting the same 'wrote no files' invariant Done-when #3 already asserts for shape errors; this is a deterministic, in-file addition, not a new mechanism. Not currently captured anywhere (no existing gate checks batch-write atomicity against content gates), so it must be added to this card's own Done-when/validation step before build, not filed as a separate future item, since the fix lives entirely inside we:scripts/backlog/batch-scaffold.mjs's own pre-write pass. Impact if unfixed: 'broken' — a realistic input (forgetting the `we:` prefix in one digest of an N-item batch, the exact class of slip this repo's own #883 gate exists because people routinely make) leaves a partially-filed batch with dangling cross-refs among the surviving items, recoverable only by someone noticing the stray files in `git status` and cleaning up by hand — reproducing, in miniature, the 'half-filed program set' failure mode the card explicitly calls worse than the incident it replaces. Disposition: introduced by this card's own preparation (single-item scaffold never had a partial-write mode to begin with), worse than base (a batch tool that ships believing it's atomic when it isn't is worse than no batch tool), and not parallelizable (the fix is inside we:scripts/backlog/batch-scaffold.mjs's own validation pass, which is this card's exact scope) — routes to blocker.
- **consumer** (addressed; strategy: find consumers TWO ways: ES imports AND subprocess/hook callers) — Checked both ways: ES-import graph shows only we:scripts/backlog.mjs imports renderItem from we:scripts/backlog/scaffold.mjs (no other module renders a card body), and the we:scripts/backlog/id.mjs helpers this card reuses (nextHash/normalizeId/isHash/swapHashes) are called unchanged, so their many existing importers (we:scripts/lane-drain.mjs, we:scripts/check-standards.mjs, we:scripts/backlog-guard.mjs, etc.) are unaffected. Subprocess/hook side: we:skills-src/batch-backlog-items/parallel-execute.workflow.js already scaffolds new items one-at-a-time per lane via `we:scripts/backlog.mjs scaffold --session` (#2215) — a different, already-shipped mechanism this card does not touch and need not integrate with for its stated goal.
- **unmeasured-impact** (addressed; strategy: measure the constraint before sizing) — Grounded in a real, verifiable incident rather than a hypothetical: commit 86fd66fe filed we:backlog/2548-gate-new-backlog-items-must-be-hash-keyed-not-hand-numbered.md, whose own body confirms 'the #558 incident (hand-numbered ids collided with a concurrent session; the drain collision-heal blanked 6 files)' — the precedent this card cites is real and correctly described.
- **legibility** (NOT addressed; strategy: assert the failure SURFACES, not just that it occurs) — Nit, not a blocker. Done-when #3 only requires the all-or-nothing failure to 'exit non-zero and write no files' — it never requires the error to name WHICH spec entry/field was invalid. Root cause: the acceptance criterion was written around the atomicity invariant (files) and didn't separately consider the operator's need to locate the bad entry in a 14-item spec. Prevention: extend Done-when #3's assertion to also check the error text names the offending entry (index or key) — a one-line addition to the same test, deterministic and cheap; not currently captured by any gate, so it would need filing only if not folded into this card's own Done-when. Impact if unfixed: 'degraded' — the operator can still find the bad entry by bisecting the spec by hand, so it's friction, not lost work. Disposition: introduced by this card (new file, new error path), but NOT worse than base (a terse non-zero exit is still strictly better than the silent hand-numbered-collision failure mode it replaces), so it does not route to blocker regardless of parallelizability.

**Corrections applied by this review:**

- The Design section's atomicity claim ('validate every spec entry ... before the first write' / Done-when #3's all-or-nothing bar) omits the content gates (secret-scrub #3015, locus-prefix #883) that we:scripts/backlog/guarded-write.mjs's writeBacklogMd already enforces per file — those can throw after earlier batch items are already written, which the card's stated pre-validation set (kind/size/ref-resolution) does not cover.

The composition design is sound and every cited helper/line number checks out against the live repo, but the "all-or-nothing" atomicity claim is incomplete: the shared writeBacklogMd funnel it mandates reusing throws on content gates (secret-scrub, locus-prefix) that the card's own pre-validation step never checks, so a batch can still leave earlier items on disk before failing on a later one — reproduced live against we:scripts/backlog/guarded-write.mjs.

_Recorded through the declared `review-prep` operation._

**Author response (2026-08-21).** The `premise`/`decorative-guard` finding is correct and is the strongest
thing this review produced; it is fully applied. Verified independently: `writeBacklogMd` →
`writeBacklogMdUnguarded` → `assertPublishableContent(rel, content)` at
`we:scripts/backlog/guarded-write.mjs:84,107`, which runs the #3015 scrub and the #883 locus scan and throws
**per file, inside the write loop** — so shape-only pre-validation cannot deliver the atomicity the card
claimed. *Design* now names the content gates explicitly, states the render-all-then-write-all rule
("nothing may throw once the first file has been written"), and points at `assertPublishableContent` as the
gate to **reuse** rather than re-implement. Done-when gained a new criterion 4 pinning exactly the missed
class — a shape-valid batch whose **third** body carries a bare code path must still write nothing.

The `legibility` nit is also applied: criterion 3 now requires the error to name the offending entry by index
or key, so an operator does not bisect a 14-entry spec by hand.
