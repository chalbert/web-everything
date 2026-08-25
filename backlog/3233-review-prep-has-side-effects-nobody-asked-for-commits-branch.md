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

## The decided design — the seam is push, NOT commit

**Round 2, after an independent panel (2026-08-25) refuted round 1.** Round 1 said `record` should append
and stop, committing nothing. The `no-op` juror showed that is **worse than the bug** for the exact
population this card diagnoses: on a cloud VM, an uncommitted working-tree edit dies when the box is
reclaimed, whereas today's orphan ref at least persists on origin and is recoverable — as this card's own
forensic section proves by diffing one back. Round 1 would have traded a discoverable failure for a silent
one. That finding is why the design below is not the design the title implies.

**The seam is between what is local and durable, and what needs a credential:**

- `record` appends, **verifies**, and **commits locally**. A commit is free, needs no credential, works
  identically on a VM and a laptop, and makes the verdict durable in git the moment it exists.
- `--land` (default OFF) additionally **pushes the ref and shells `we:scripts/pr-land.mjs`**. This is the
  half that requires GitHub and the half that fails on a VM.

This keeps the card's actual complaint — no branch pushes, no delivery work under a review name, no
`lane/review-prep-*` accumulation — while removing the failure mode round 1 would have introduced. It also
keeps #2138's single-transport rule: when `--land` IS passed, landing still goes through
`we:scripts/pr-land.mjs`, so no second route to `main` appears.

The card's original "6 commits on one lane" objection survives this and is answered by it: six reviews in a
lane producing six commits is correct. What was wrong was pushing each accumulated stack as its own ref.

## Interfaces at the seam

`recordPrepVerdict` (`we:scripts/operations/review-prep-io.mjs`) today returns
`{recorded, aborted, path, sha, ref, clean, disposition, actor, land}`.

- **Default (`land: false`)** returns `{recorded: true, aborted: false, path, actor, verified: true, sha, landed: false}`.
  Commit happens; no push, no pr-land shell-out, no `ref`.
- **With `land: true`** it additionally returns `{ref, clean, disposition, land}` — the remaining keys of
  today's shape, so the merged-nine path is preserved intact.
- **`verified`** is the #3230 half. Note the ordering fix that panel finding forced: verification happens
  **against the staged content**, not against an in-memory read taken before the stage. See #3230.
- **CLI**: `we:scripts/operations/run.mjs review-prep … [--land]`. Boolean, absent ⇒ false.

## Migration — three consumer classes, and only the static one was originally checked

**Static callers: four modules, five files.** `we:scripts/operations/run.mjs` (CLI adapter), the generated
HTTP adapter via `REVIEW_PREP_OP`, its own `-io` module, and its two test files
(`we:scripts/operations/__tests__/review-prep.test.mjs` and
`we:scripts/operations/__tests__/review-prep-io.test.mjs`). Stating the unit because round 1 wrote "exactly
four consumers" while itemising five files — the `premise` juror flagged the ambiguity.

**In-flight suspended runs — the gap round 1 missed entirely.** `record` is declared `idempotent: false`,
and the engine suspends at the `judge` step while the juror spawns. A run started under today's
land-always contract and resumed after this ships would silently default to `land: false` and give its
caller neither a land nor an error. Handled explicitly rather than by hoping: the run record gains a
contract version, and resuming a `review-prep` run recorded under the old one **refuses** with a message
naming the change and telling the caller to re-run. Blast radius is nil today (six `review-prep` run
records exist on this machine, all for #3100, all complete) but the refusal is what makes that a fact
rather than a bet.

**HTTP-adapter network callers: unknown, and stated as unknown.** The operation is exposed over the
generated HTTP adapter, whose callers are by nature not in the import graph. No grep can settle this. What
is known: nothing in this repo starts that adapter as a service, and no doc points a client at it. Recorded
as a residual risk rather than claimed clear.

**No skill invokes it** — grepping `we:skills-src/` for the operation name returns nothing, itself a gap
tracked by #3225.

## Tasks

1. Thread a `land` boolean through the `record` effect's payload; default false in the declaration.
2. Split `recordPrepVerdict` into append + verify + commit, then a guarded push/land block.
3. Add the contract-version stamp and the resume refusal for runs recorded under the old contract.
4. **Update the file-header JSDoc of `we:scripts/operations/review-prep-io.mjs`**, which currently states
   "LANDS OR PARKS (never both)" and describes commit+land as automatic — it sits directly above the code it
   would now contradict. (Panel finding; round 1's task list omitted it.)
5. Unit-test every branch.
6. Leave the 21 existing orphan refs alone — recovering them is its own card, not this one.

## Delivery shape

Lands incrementally behind `main` in one PR — no branch needed. The two halves cannot sensibly land apart:
verifying a write that is still bundled with a push would report `verified: true` on a run whose verdict
still strands.

## Done when

1. **Executable** — `npx vitest run we:scripts/operations/__tests__/review-prep-io.test.mjs` passes a case
   asserting that a default `record` (no `--land`) **commits exactly once** and performs **zero** pushes and
   **zero** pr-land invocations: the `runNode` spy is called 0 times, the `exec` spy shows a `commit` and no
   `push`, and the card on disk carries the section. Fails today (the current code always shells pr-land).
2. **Executable** — a second case passes `land: true` and asserts `{sha, ref, disposition}` are returned and
   `we:scripts/pr-land.mjs` was shelled exactly once.
3. **Executable** — a third case resumes a run record stamped with the old contract version and asserts the
   operation **refuses** with a message naming `land`, rather than proceeding with the new default.
4. **Executable** — a case asserting the file-header JSDoc no longer contains the string
   "LANDS OR PARKS", so task 4 cannot be silently skipped.
5. **Mutation** — deleting the `land` guard (making the push unconditional again) reddens case 1 by name;
   deleting the resume-version check reddens case 3 by name.
6. `npm run check:standards` passes with no new warnings against the baseline of 0 errors / 1435 warnings.
