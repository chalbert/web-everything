---
bornAs: xz22ycy
kind: story
size: 2
status: open
dateOpened: "2026-08-03"
tags: [review, drain, mandate, mechanized-panel]
relatedTo: ["2450", "2439"]
scope:
  - we:scripts/review-core-cli.mjs
  - we:scripts/__tests__/review-core-cli.test.mjs
  - we:scripts/workflows/review-parked-prs.mjs
  - we:scripts/lib/review-core.mjs
---

# netChangedFiles never reaches the mechanized review panel — the CLI seam drops it

The mechanized parked-PR panel seeds every lens reviewer by shelling `review-core-cli mandate`, whose
`buildMandateText` calls `buildPanelMandate` with the lens alone — no `netChangedFiles`. So #2450's
ground-truth block, which stops a reviewer flagging a landed sibling-lane file as scope creep, reaches
only the hand-run drain prose and never the autonomous path. Worse, the value is not even reachable
there: `fetch-parked` reads `gh pr view` plus the diff, never the drain's parked array, so threading
the parameter alone would add an argument with nothing to pass.

## Why this is not just a missing argument

Surfaced by the `/review` of PR #1011 (now closed). Deferring the CLI composer read as reasonable in
isolation, and it is not — the CLI is **not** a secondary convenience seam. It is the **sole mandate
source for the autonomous workflow**: `we:scripts/workflows/review-parked-prs.mjs` shells
`review-core-cli` for the lens mandate, the reduction, the editor mandate, and the roster invite. So
the path that runs unattended is exactly the path missing the ground truth, while the hand-run path
has it.

That inverts the usual risk gradient. A human running the drain by hand can notice a phantom
scope-creep finding and dismiss it; the mechanized panel cannot, and burns a negotiation round.

## The two-part gap

1. **The composer drops it.** `buildMandateText` (`we:scripts/review-core-cli.mjs`) calls
   `buildPanelMandate({ lens })`. The library builder has taken an optional `netChangedFiles` since
   #2450 and is purely additive, so this is a signature/flag change plus tests.
2. **The value is not reachable.** Even with the parameter threaded, the workflow has nothing to pass:
   `fetch-parked` reads `gh pr view` and the diff, never the drain's `--json parked` array where the
   net changed-file set lives. Closing (1) without (2) yields a parameter that is always empty — the
   inert-flag defect the same review flagged three times on PR #1011.

Both halves are required for this item to mean anything.

## Design

**Part 1 has an exact precedent to copy: `diffBasis` (#2914).** That parameter went through this same seam
and is already threaded end-to-end, so this half is a shape-match, not a new design:

- `we:scripts/lib/review-core.mjs:1051` — `buildPanelMandate({ lens, …, netChangedFiles, …, diffBasis })`
  already accepts both; the `netChangedFiles` GROUND TRUTH block is emitted at `:1071-1078` and is
  byte-for-byte inert when the list is empty.
- `we:scripts/review-core-cli.mjs:225-231` — `buildMandateText({ kind, lens, findings, round, roundCap, diffBasis })`
  forwards `diffBasis` on the `lens` branch only. Add `netChangedFiles` to the same destructure and the same
  `buildPanelMandate({ lens, diffBasis })` call.
- `we:scripts/review-core-cli.mjs:509-516` — `runMandate` reads `flags.diffBasis`. `parseFlags` (`:87-96`) is
  a generic `--k=v` splitter, so a comma-joined `--netChangedFiles=` value needs no parser change: split on
  `,` and filter empties, one line above the existing `diffBasis` line.
- `we:scripts/workflows/review-parked-prs.mjs:676` — `lensPrompt` already emits the
  `review-core-cli mandate --lens=… --diffBasis=…` command string. Append the new flag here.

**Part 2's premise has changed since this item was filed — read this before building.** The section above
says "`fetch-parked` reads `gh pr view` and the diff, never the drain's `--json parked` array where the net
changed-file set lives." That is **no longer true**. #2901 landed the net-basis resolution *inside*
`we:scripts/fetch-parked.mjs`: `resolveNetDiff` + `scopeFilesToNet` (`:264-274`) narrow `gh pr view --json files`
down to the **net** changed set, and `assembleParked` (`:198-206`) returns it as `files` alongside `diffBasis`.
So the value **is** already reachable — from `fetch-parked` itself, not from the drain's parked array. Do not
build the drain-array plumbing the original text predicted.

What is actually missing is the **carry across the workflow boundary**: `FETCH_SCHEMA`
(`we:scripts/workflows/review-parked-prs.mjs:375-396`) declares no `files`/`netChangedFiles` property, so the
fetch subagent has no slot to return it in and the value is dropped. Add the property to `FETCH_SCHEMA`, tell
the fetch prompt (`:636-652`) to copy `fetch-parked`'s `files[].path` verbatim (the same "copy it VERBATIM,
do not re-derive" framing `escalationReason` already carries), and thread it into `lensPrompt`.

**The basis coupling is load-bearing and must fail closed.** `fetch-parked` returns the *inflated three-dot*
file list whenever `diffBasis === 'three-dot'` (`we:scripts/fetch-parked.mjs:391-402` — the net text and the
scoped list ride one basis or neither does). A three-dot list rendered under "the NET changed-file set of this
PR vs CURRENT main is exactly …" would be a **false** ground truth, and worse than none: it would tell the
juror that already-landed sibling files are this PR's own — the exact #1018 phantom this parameter exists to
kill, inverted. So pass `netChangedFiles` **only** when `diffBasis === 'net'`; when it is degraded, pass
nothing and let the #2914 degraded disclosure (already emitted by `buildPanelMandate`) carry the signal.

## Done when

1. **A1 · Executable — thread it.** Run, from the WE checkout root:

   ```
   npx vitest run scripts/__tests__/review-core-cli.test.mjs
   ```

   It passes with a new `describe` block mirroring the existing `#2914 — diffBasis (kind: lens only)` group
   at line 257: `buildMandateText` called with a `kind: 'lens'` and a one-entry `netChangedFiles` list contains
   `GROUND TRUTH`, and the `editor` / `validator` kinds ignore the parameter. Fails on `main` today —
   `buildMandateText` does not accept the key at all.
2. **A2 · Executable — make the value reachable, fail-closed on basis, at an IMPORTABLE seam.**
   `we:scripts/workflows/review-parked-prs.mjs` is a Workflow-harness body — it has a top-level `return`, so
   `node --check` on it raises `SyntaxError: Illegal return statement` and no vitest file can import
   `lensPrompt`. So the flag composition must **not** stay inline in `lensPrompt`: extract the
   `mandate --lens=… --diffBasis=… [--netChangedFiles=…]` argument assembly into a small pure exported
   helper in `we:scripts/lib/` (or beside `buildMandateText` in `we:scripts/review-core-cli.mjs`, which *is*
   importable — the existing test suite imports it), and have `lensPrompt` interpolate that helper's output.
   The test then calls the helper directly and asserts it emits the net-files flag for
   `diffBasis: 'net'` + a non-empty file list, and **no** such flag for `diffBasis: 'three-dot'`. Fails on
   `main` (no flag is ever composed, on either basis).
3. **A3 · Executable — prove it at the emitting seam, not per-composer.** A2's oracle must run the code the
   workflow *actually emits its command from*, so a source-text regex over
   `we:scripts/workflows/review-parked-prs.mjs` does **not** satisfy this on its own — that is the
   read-the-file pattern `we:scripts/__tests__/parallel-execute-workflow.test.mjs` uses for harness bodies,
   and it proves the text, not the behaviour. Pair the A2 function-call oracle with one source-text assertion
   that `lensPrompt` calls the extracted helper rather than re-composing the flags inline; the two together
   close the gap a composer-only test left open for this bug's whole lifetime, and neither does it alone.
4. **A4 · Executable — additivity preserved.** A test asserts `buildMandateText({ kind: 'lens', lens })` is
   byte-for-byte identical to the same call with the new key present as `undefined` and as `[]` — the
   guarantee `buildPanelMandate`'s docblock already states at `we:scripts/lib/review-core.mjs:1029-1031`.
5. **Assertable — the fourth-composer enumeration is settled.** *Settled by the 2026-08-21 independent
   review below, and recorded here so a builder does not re-derive it:*
   `we:skills-src/jury/resolve-roster.mjs` never imports `buildPanelMandate`; its only mandate path
   (`PR_DIFF_ADAPTER.buildMandate`) resolves to the base `buildMandate` at
   `we:scripts/lib/review-core.mjs:271`, **not** `buildPanelMandate` at `:1051`. It is therefore **out of
   scope** — not a fourth instance of this defect. The same review found two further direct
   `buildPanelMandate` callers, `we:scripts/operations/review-pr.mjs:431-432` and
   `we:scripts/converge-cli.mjs:234-235`, which **already thread `netChangedFiles` correctly** — confirming
   the gap is isolated to the `we:scripts/review-core-cli.mjs` wrapper seam. The criterion: re-confirm those
   three facts with one grep each before closing, and widen scope to none of them.

## Boundary

`crossRepoCouple` is deliberately **not** part of this. That parameter belonged to the approach #2457
was re-scoped away from — the couple's cross-repo symbol check is now mechanical and never touches a
mandate. This item is `netChangedFiles` only.

A fourth composer, `we:skills-src/jury/resolve-roster.mjs`, is un-threaded the same way and is worth
folding in if it proves to be the same one-line shape; it was found by a JS-composer grep that missed
seams reached via shell or prose, so confirm the enumeration before closing.

## Independent review — 2026-08-21

Confidence: **Medium**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (addressed; strategy: verify by mutation or reversion ahead of the build) — Strong handling of the reachability premise: the card explicitly re-verified against the live repo that #2901 (resolveNetDiff/scopeFilesToNet in we:scripts/fetch-parked.mjs:264-274, assembleParked at we:scripts/fetch-parked.mjs:198-206) already made netChangedFiles reachable, correcting the item's own original text rather than building the drain-array plumbing it originally predicted — all citations checked out exactly against the live file. One residual premise gap escaped this verification pass: see the reported finding on A2/A3 testability.
- **consumer** (addressed; strategy: find consumers TWO ways: ES imports AND subprocess/hook callers) — Card explicitly flags a fourth composer (we:skills-src/jury/resolve-roster.mjs) as unresolved and gives a due-diligence checklist item rather than assuming it in or out. Independently verified: we:skills-src/jury/resolve-roster.mjs never imports buildPanelMandate, and its only mandate path (PR_DIFF_ADAPTER.buildMandate, imported from we:scripts/lib/review-core.mjs) resolves to the base `buildMandate` (we:scripts/lib/review-core.mjs:271), not `buildPanelMandate` (we:scripts/lib/review-core.mjs:1051) — so it is correctly out of scope. Also independently found two additional direct JS callers of buildPanelMandate (we:scripts/operations/review-pr.mjs:431-432, we:scripts/converge-cli.mjs:234-235) that already thread netChangedFiles correctly, confirming the defect is isolated to the we:scripts/review-core-cli.mjs CLI-wrapper seam as the card claims, not a broader gap.
- **interface** (NOT addressed; strategy: round-trip test at the seam, written by whoever owns neither half) — The card correctly identifies that a composer-only test (A1) is insufficient and designs A2/A3 to assert on the string the workflow actually emits at the we:scripts/workflows/review-parked-prs.mjs `lensPrompt` seam — exactly the taxonomy's called-for strategy in intent. But the mechanism specified (call `lensPrompt` directly and inspect its return value) is not achievable given that file's own documented non-ES-module status; see the reported finding.
- **decorative-guard** (addressed; strategy: mutate the guarded line; require a NAMED test to redden) — The fail-closed basis-coupling design (pass netChangedFiles only when diffBasis === 'net', silent nothing when degraded, relying on the existing #2914 disclosure) is paired with an explicit named-test requirement in A2 that asserts the flag is ABSENT on a three-dot basis — the guard is testably falsifiable by construction, not a decorative no-op.
- **legibility** (addressed; strategy: assert the failure SURFACES, not just that it occurs) — When netChangedFiles is withheld on a degraded basis, the card relies on the already-shipping #2914 'DIFF BASIS: DEGRADED' disclosure to carry the signal explicitly to the juror rather than failing silently — verified present in we:scripts/lib/review-core.mjs:1100-1104.

**Corrections applied by this review:**

- A2/A3's acceptance criteria assume lensPrompt (defined in we:scripts/workflows/review-parked-prs.mjs) can be unit-tested via direct function call and its return value inspected — but that file's own docblock (we:scripts/workflows/review-parked-prs.mjs:9-20) states it is a Workflow-harness script with a top-level `return`, confirmed via `node --check` to throw 'SyntaxError: Illegal return statement', so it cannot be imported as an ES module in a vitest test.
- The card does not cite or reconcile with the repo's own established precedent for testing such Workflow-harness scripts (we:scripts/__tests__/parallel-execute-workflow.test.mjs), which reads the file's SOURCE TEXT and asserts via regex rather than invoking any function directly — a materially weaker guarantee than the literal 'assert on the string lensPrompt emits' language in A2/A3.

The problem statement, the two-part gap analysis, and the fail-closed design are all independently verified accurate against the live repo (including a well-caught premise correction about #2901 changing reachability) — but the card's own A2/A3 acceptance criteria assume `lensPrompt` inside we:scripts/workflows/review-parked-prs.mjs can be unit-tested by direct function call, and that file is a Workflow-harness script that is not importable as an ES module.

_Recorded through the declared `review-prep` operation._

**Author response (2026-08-21).** The review's finding is correct and confirmed: `node --check` on
`we:scripts/workflows/review-parked-prs.mjs` raises `SyntaxError: Illegal return statement`, so `lensPrompt`
cannot be imported. A2/A3 are rewritten above — rather than accepting the weaker source-text-only oracle the
review anticipated, they now require the flag composition to be **extracted to an importable seam**, so the
function-call oracle A3 asks for is actually buildable. The source-text assertion survives only as the
"`lensPrompt` calls the helper" tie-down, which is what that pattern is good for.
