---
bornAs: xq9t0tc
kind: story
size: 2
status: open
dateOpened: "2026-08-05"
scope: ["we:scripts/lib/workflow-meta.mjs", "we:scripts/__tests__/workflow-meta-launchable.test.mjs", "we:scripts/check-standards.mjs"]
tags: []
---

# Gate Workflow harness launchability in check:standards (the meta pure-literal rule)

The Workflow runtime requires `export const meta` to be a pure literal and rejects the script before a single
agent spawns, so an impure `meta` makes a harness **unlaunchable** — silently, because it never runs and so
never produces a wrong answer. A working guard already exists in `main`'s history. This item **restores and
narrows it**: a recovery, not a build.

## Why it is owed

`we:scripts/workflows/review-parked-prs.mjs` was unlaunchable from the day it was written. Three layers
inherited that silence: the jury ledger had no entries to hold, the scheduled runner read the empty ledger and
fail-closed every parked PR to a human, and reviews were hand-queued for weeks on the belief that the
automation was simply unbuilt.

The driver is **edit churn, not new harnesses**. The three harness `meta` blocks have taken roughly 16 commits
since the first landed on 2026-07-04 — about four weeks — and **two of those edits shipped this exact bug**:
#2664 on 2026-07-25 (`we:skills-src/jury/subject-jury.workflow.js`) and PR #1037 on 2026-08-05
(`we:scripts/workflows/review-parked-prs.mjs`). Both were an agent re-wrapping a ~1600-character `description`
across lines, which is exactly what produces `'…' + '…'`. There is no prettier/eslint config in this repo to
blame or to fix instead, so the pressure is structural and will recur.

> Do **not** justify this item by a "capture rule" holding that one recurrence mandates a gate. No such rule
> exists in this repo — checked `we:docs/agent/`, `we:AGENTS.md`, and the memory store. An earlier draft of this
> item cited one. The churn figures above are the real, and stronger, justification.

## Recover — the exact commands

The implementation is at commit **`0433216c`**, an **ancestor of `main`** (PR #1037 merged as a real merge
commit, `75a43975`). Two traps:

- **Use the bare SHA, never the branch name.** The lane tip (`2c654b05`) **deletes** these files — commit
  `137ac983` stripped them so the fix could ship alone. `git show <branch>:<path>` returns nothing and reads as
  "the work is lost". It is not lost.
- **`git log` over `we:scripts/lib/workflow-meta.mjs` on `main` returns nothing**, for the same reason. Only
  `git show 0433216c:<path>` works.

Three files come over — the core and its tests verbatim:

```
git show 0433216c:scripts/lib/workflow-meta.mjs                        > scripts/lib/workflow-meta.mjs
git show 0433216c:scripts/__tests__/workflow-meta-launchable.test.mjs  > scripts/__tests__/workflow-meta-launchable.test.mjs
```

…and from `we:scripts/check-standards.mjs` at that commit, hand-apply **only** two hunks: the line-32 import of
`{ checkWorkflowMeta, WORKFLOW_HARNESS_ROOTS }`, and the 62-line `── 16. Workflow harness scripts must be
LAUNCHABLE` block.

> **NEVER restore `we:scripts/check-standards.mjs` wholesale from that commit.** It is a shared ~1800-line file
> and a wholesale restore silently deletes every rule added since. **`check:standards` will still print
> `0 error(s)`, because deleting rules makes the gate quieter.** This near-miss already happened once during
> #1037: an index-based slice dropped 630 lines including rule 6g, and the only thing that caught it was diffing
> the *warning set* against `main`. Cherry-pick the hunks by hand.

`we:scripts/lib/citation-check.mjs` also appears in that commit. It is a **revert to `main`** and is **out of
scope** — do not carry it. See *Loose thread* below.

Rule **16** is a positional slot, not a stable address — `main`'s last rule is 15 today. Append at the next
free number and update the zero-sweep error string, which hardcodes the literal text `check:standards rule 16`.

## Scope — what the gate sweeps

```js
WORKFLOW_HARNESS_ROOTS = ['scripts/workflows', 'skills-src']
```

with an extension filter of `/\.(mjs|js)$/` — **because the `skills-src` harnesses are named `*.workflow.js`,
not `.mjs`.** The three live harnesses:

- `we:scripts/workflows/review-parked-prs.mjs`
- `we:skills-src/jury/subject-jury.workflow.js`
- `we:skills-src/batch-backlog-items/parallel-execute.workflow.js`

**All three are pure today, so a green gate is not evidence the gate works.** Guessing the `scripts/workflows`
root alone gates 1 of 3 while finding (6)'s non-empty assertion still passes — the hole is invisible.

**Consider narrowing selection** to the two harness roots by path convention (`scripts/workflows/**` plus
`**/*.workflow.js`). That hits 3/3 where the current roots walk **9 files** to reach 3, including
`we:skills-src/conveyor/__tests__/runner.test.mjs`. Finding (5) forbids selecting by a *text match on the export
line*; it says nothing against selecting by path. Narrowing also shrinks what findings (6) and (7) exist to make
safe.

## Gate arms — there are FOUR, not three

An earlier draft said three. `err()` fires on: **unreadable** (a `meta` export spelling the gate cannot
resolve), **impure**, **missingKeys** (`REQUIRED_META_KEYS = ['name', 'description']`), and **zero-sweep**.

The `missingKeys` arm is covered by **none** of the seven findings below. Rebuilding from those findings alone
loses it — and a pure-literal `meta` missing `name` would then pass the gate and still fail at launch, which is
the very silent failure this item exists to end.

## MUST FIX on recovery — the `export default` false positive

`declaresMetaExport()` returns `true` for **any** `ExportAssignment`:

```js
if (ts.isExportAssignment(stmt)) return true; // `export default { … }` — a meta we cannot name
```

No name check. Rule 16 then emits a **hard error** — "exports a Workflow `meta` in a spelling this gate cannot
resolve" — so the first ordinary helper placed under either root with a default export turns the **whole health
gate red** with a nonsense message, mid-drain.

Latent today (0 of the 9 swept files use `export default`), and over-broad by construction: a real harness can
never use `export default` anyway, because the runtime needs a **named** `meta`.

Whoever hits this will be tempted to loosen the check. That is the one direction the caveat below calls
dangerous. Fix the branch instead.

## The seven findings this must keep — each cost a review round

1. **Reject by AST node KIND, never by regex.** The regex draft passed `'a ' + SUFFIX`, `buildPhases()` and
   mixed-quote concatenation, while false-flagging a prose ellipsis.
2. **A computed key is a name syntactically and an arbitrary expression semantically**, so exempting names
   wholesale let `[f()]: 'x'` read as pure. Permit only `Identifier | StringLiteral | NumericLiteral`.
3. **Resolve the aliased export through `propertyName`, not the exported name.** Looking up by name found an
   unrelated pure local and returned `ok: true` on an unlaunchable harness — worse than a skip.
4. **An export spelling that cannot be resolved** (`export default`, `export let` + late assign, re-export) is a
   harness **failed to read**, not a non-harness. It must ERROR, never `continue`.
5. **Select files by parse, not by a text match on the export line** — a `src.includes('export const meta')`
   selector skipped the declare-then-export spelling entirely.
6. **Assert the sweep is non-empty**, or renaming a root leaves the gate green forever over zero files.
   Necessary but not sufficient — see *Scope*.
7. **The walk must gate on `isFile()` and wrap its fs calls.** A symlinked directory named like a script reports
   neither `isFile` nor `isDirectory`, and `readFileSync` on it throws EISDIR, aborting the whole health gate
   before its other rules run.

## PURE_KINDS policy — the recovered set is FROZEN

`PURE_KINDS` **models** an external validator this repo cannot import. Only **two** rejections are actually
observed, both `BinaryExpression` — #2664's recorded error and PR #1037's. Every other kind is inference from
the error wording.

The failure directions are asymmetric: too strict is a loud false alarm, too loose means the check passes and
the harness still cannot start. So:

- Ship the **11 recovered kinds unchanged.** "When in doubt, leave a kind out" governs **future additions
  only**, and each addition needs a recorded real launch observation.
- Do **not** read that rule as licence to audit the recovered set down to the two observed kinds. It is an
  allowlist — default-reject — which is already the safe direction.
- A kind **not** in the set is rejected. By design, not a gap.

## Acceptance

- [ ] All tests in `we:scripts/__tests__/workflow-meta-launchable.test.mjs` pass — **31** at `0433216c`, but
      note 4 are data-driven from the live sweep, so the number moves with repo state.
- [ ] `check:standards` reports **0 errors**, and its **warning set** is diffed against `main`'s baseline and
      unchanged. Do not trust the count line alone.
- [ ] The sweep reports **3** harnesses seen.
- [ ] **All four** `err()` arms demonstrated firing, on throwaway probe files placed under **each** root, then
      deleted: impure / unreadable / missingKeys / zero-sweep.
- [ ] Mutation checks: reverting the `propertyName` alias resolution fails 2 tests; removing the
      `declaresMetaExport` unreadable detection fails 1.
- [ ] The `export default` false positive above is fixed, with a test.

"The only real integration proof is a launch" — but a launch spawns real subagents and costs real tokens. The
probe-file procedure above is the offline substitute. A green vitest run alone proves the pure core only: not
the fs walk, not the roots, not the `err()` wiring.

## Non-goals

- **No PreToolUse hook.** There is none for this today (verified against `we:.claude/settings.json`:
  `guard-lane`, `lint-locus-prefix`, `check-memory`, `backlog-guard`, `guard-backward-edge` — none reaches it).
  A write-time hook reusing the same I/O-free core is a reasonable follow-up, but do **not** claim author-time
  enforcement here.
- **No citation-gate widening.** That was reverted at `0433216c` and belongs to its own item.

## Loose thread

PR #1037 round 2 raised two findings (C, D) about widening the code-citation gate —
`HASH_SLUG_OUT_OF_SCOPE_DIRS` for the `scripts` and `skills-src` trees. Both were reverted at `0433216c` with
the note that they belong "in its own item with the corpus cleanup it needs". **No such item exists.** File it
or drop it deliberately.

## Provenance

Carved out of PR #1037 by operator ruling. The accurate version: **no review finding ever faulted the `meta`
collapse itself** — round 3 re-verified it byte-identical, covering both `description` (1642 chars) **and
`whenToUse`** (360 chars), which an earlier draft omitted. The fix was correct in #1031 round 1 and rode along
while the guard took the rounds.

Do not repeat the earlier draft's numbers. It claimed "five review rounds in which ALL TEN findings landed in
this guard and ZERO landed in the one-line fix". Actual: **three** rounds on #1037 (two `changes`, one
`accepted`) and **four** on #1031. Of the ten findings, about **five** landed in the guard; two landed in
`we:scripts/workflows/review-parked-prs.mjs` — the fix's own file — one was about the PR description, and two
were in `we:scripts/lib/citation-check.mjs`.
