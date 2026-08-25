---
bornAs: xh9pwf3
kind: story
size: 3
parent: "3029"
status: open
dateOpened: "2026-08-21"
preparedDate: "2026-08-25"
tags: [operations, epic-3029, review-prep, preparation]
scope:
  - we:scripts/operations/review-prep.mjs
  - we:scripts/operations/review-prep-io.mjs
  - we:scripts/operations/__tests__/review-prep.test.mjs
  - we:scripts/operations/__tests__/review-prep-io.test.mjs
  - we:scripts/operations/run.mjs
---

# review-prep has side effects nobody asked for: commits, branch pushes, pr-land

Reviewing a card should append a note. Observed on 2026-08-21 across two lanes, we:scripts/operations/review-prep.mjs also made unrequested commits on the caller branch (6 on one lane), pushed lane/review-prep-* refs to origin, and ran its pr-land step. 16 such refs are on origin and climbing. Every caller then has to detect and squash commits it did not make. The operation should append and stop; landing is the caller job, and a review that pushes a branch is doing delivery work under a review name.

## Measured on 2026-08-25 — the count is now 21, and the cause is not tidiness

The refs did not merely accumulate; **the verdicts they carry were lost.** Twenty-one
`lane/review-prep-*` refs sit on origin with **no PR of any state** behind them (a `gh pr list --state all`
search on that head prefix returns nine, all MERGED, all from the 2026-08-14 laptop cluster). Their content
is real: diffing `origin/main...origin/lane/review-prep-2456-…` carries finished verdicts for #2456, #2459,
#2852, #2888, #2907 and #561 — "confidence High, corrections recorded" — and **none of that text is on
`main`** (checked: `git show` of the #2456 card at `origin/main` has no review section).

**The provenance names the cause.** Every orphan commit is authored by the generic `Claude` identity at a
UTC timestamp on 2026-08-21; every merged one carries the operator's own git identity at a local offset. The
orphans are **cloud-VM runs**. Per `we:agent-memory-src/workflow-cloud-vm-github-api-boundary.md`, a VM's git
transport is credentialed and its GitHub API is not — so `we:scripts/pr-land.mjs` pushed the ref and then
could not open the PR. The bundled `record` effect therefore fails *after* it has already mutated the
caller's branch, and the verdict is stranded on a ref nobody reads.

That is the argument for the split, and it is stronger than "callers must squash commits they did not
make": **an operation that bundles recording with landing cannot record on a host that cannot land.**

## The decided design — two effects, not one, and the transport is unchanged

`record` becomes append-and-verify **only**. Landing moves behind an opt-in `--land` flag, default OFF.

This deliberately keeps #2138's single-transport rule: when `--land` IS passed, the land still shells
`we:scripts/pr-land.mjs` exactly as today, so no second route to `main` is introduced. What changes is that
landing stops being something the caller gets without asking. The alternative — deleting the land leg
outright — was rejected: the 2026-08-14 laptop cluster shows the bundled form working end-to-end nine times,
so the capability is worth keeping as a flag rather than discarding.

## Interfaces at the seam

`recordPrepVerdict` (`we:scripts/operations/review-prep-io.mjs`) today returns
`{recorded, aborted, path, sha, ref, clean, disposition, actor, land}`.

- **Default (`land: false`)** returns `{recorded: true, aborted: false, path, actor, verified: true, landed: false}`.
  No `git commit`, no pr-land shell-out, no `ref`. The card is written and left in the working tree for the
  caller to commit.
- **With `land: true`** it additionally returns `{sha, ref, clean, disposition, land}` — byte-identical to
  today's shape, so the merged-nine path is preserved.
- **`verified`** is the #3230 half and is why these two land together: the effect re-reads the file after the
  write and asserts the rendered section is present. A read-back that does not find it returns
  `{recorded: false, verified: false}` — a third outcome, never a bare success.
- **CLI**: `we:scripts/operations/run.mjs review-prep … [--land]`. Boolean, absent ⇒ false.

**Migration: none is owed, and this was checked rather than assumed.** `review-prep` has exactly four
consumers — `we:scripts/operations/run.mjs` (the CLI adapter), the generated HTTP adapter via
`REVIEW_PREP_OP`, its own `-io` module, and its two test files. **No skill invokes it** (grepping
`we:skills-src/` for the operation name is empty — itself a gap, tracked by #3225), and no doc prescribes
calling it with a land. So nothing outside this scope observes the default flip.

## Tasks

1. Thread a `land` boolean through the `record` effect's payload; default false in the declaration.
2. Split `recordPrepVerdict` into append+verify, then a guarded land block.
3. Add the post-write read-back assertion and the `verified: false` return.
4. Unit-test both branches, plus the read-back failure via a stubbed writer.
5. Leave the 21 existing orphan refs alone — recovering them is its own card, not this one.

## Delivery shape

Lands incrementally behind `main` in one PR — no branch needed. The default flip is behaviour-visible but
unobserved (see Migration), and the two halves cannot sensibly land apart: verifying a write that is still
bundled with a land would report `verified: true` on a run whose verdict still strands.

## Done when

1. **Executable** — `npx vitest run we:scripts/operations/__tests__/review-prep-io.test.mjs` passes with a new
   case asserting that a default `record` (no `--land`) performs **zero** git and **zero** pr-land
   invocations: the injected `exec`/`runNode` spies are called 0 times, and the card on disk carries the
   section. The test fails before this lands (today's code always commits).
2. **Executable** — a second case passes `land: true` and asserts the returned object still carries
   `{sha, ref, disposition}` and that `we:scripts/pr-land.mjs` was shelled exactly once.
3. **Executable** — a third case stubs the post-write read-back to return the pre-write text and asserts the
   result is `{recorded: false, verified: false}` — not a throw, and not a bare success.
4. **Mutation** — deleting the `land` guard (making the land unconditional again) reddens case 1 by name.
5. `npm run check:standards` passes.
