---
bornAs: x8a6jbo
kind: story
size: 5
status: open
dateOpened: "2026-08-05"
preparedDate: "2026-08-15"
tags: [drain, review, converge-loop, gate]
---

# The converge loop requires diffBasis but no juror ever reads it

PR #1039 (item #2901) made `diffBasis` a required field of FETCH_SCHEMA in we:scripts/workflows/review-parked-prs.mjs and taught the fetch prompt to copy it through verbatim — but nothing reads it. The loop destructures only fetched.diff / fetched.title / fetched.escalationReason, never fetched.diffBasis, and no other module mentions the field. So a fetch that silently degrades from the net two-tree diff to three-dot `gh pr diff` still puts an inflated diff in front of a juror with no signal, and the phantom scope-creep finding #2901 set out to kill stays reachable — now intermittent instead of constant.

## The evidence (re-verified live, 2026-08-15 — line numbers below are current, not the filing-date ones)

- `we:scripts/workflows/review-parked-prs.mjs:377` — `FETCH_SCHEMA.required` includes `diffBasis`.
- `we:scripts/workflows/review-parked-prs.mjs:638` — the fetch prompt instructs "Copy its `diffBasis` through
  VERBATIM — do not infer it, do not default it."
- `we:scripts/workflows/review-parked-prs.mjs:1146` — the loop reads `fetched.diff`; `:1147` `fetched.title`;
  `:1148` `fetched.escalationReason`. The two round-refresh sites (`:1254`, `:1299`) re-read `fetched.diff`
  only. **`fetched.diffBasis` is never read**, here or anywhere else — `grep -rn "\.diffBasis\b"` across every
  `*.mjs` outside `__tests__` returns only the schema declaration and the fetch-prompt instruction above, both
  in this same file. Confirmed still true today; only the line numbers moved (repo grew ~240 lines in this file
  since filing).

So the field is produced, validated as required, and propagated through an agent echo — and then dropped. A
schema `required` on a value nobody consumes buys nothing: it fails the fetch step when the field is missing,
and changes nothing when it is present and says `three-dot`.

Worth recording for whoever picks this up: the commit that introduced it (`58cf8456`) has the message
"Address the #1039 review — bind the diff to the OID, and give diffBasis a consumer". The first half is real
and verified; the second half did not happen. Do not take the commit message as evidence the work is done.

## Why it matters

`#2901` exists because a juror on **PR #1018** flagged an "unrelated #2457 re-scope" that the PR did not
contain — it was reading `gh pr diff`'s three-dot output, which lists sibling-lane files that already landed
on `main` as though this PR added them. #1039 fixed the *fetch* so the loop gets the net diff.

But five conditions still silently degrade net → three-dot (a foreign clone without the head ref, a failed or
incomplete fetch, a missing/stale `headRefOid`, a diff failure, a gh/git file-list disagreement). Before
#1039 the loop always got the three-dot diff — degraded, but **constant and known**. Now it usually gets the
net diff and sometimes does not, with nothing downstream able to tell the difference. Round 1 net, round 2
three-dot after a transient hiccup, and the round-2 juror files a phantom finding. That is strictly harder to
diagnose than the constant failure it replaced.

## Correction to the original filing — the review-class claim is stale

The original card split the fix into "two halves, different review classes" and said the mandate half
(`buildPanelMandate`, we:scripts/lib/review-core.mjs) "requires the human review path — an agent may not
self-clear it," because `isGateSelfPath` returns true for that file.

That was true when filed (2026-08-05) and is **no longer true**. `#2785` ("narrow review:human to the
declarative leash — Fork A only", commit `93f9fe7c`, merged PR #1102 on 2026-08-08) split the policy tier in
we:scripts/lib/gate-config.mjs into two leashes: `spec` (still forces `review:human`) and `code` (derivation
code — escalates to the independent committee, agent-clearable). we:scripts/lib/review-core.mjs's roster entry
(we:scripts/lib/gate-config.mjs:110, role `disposition-router`) is `tier: 'policy', leash: 'code'`. Per
we:scripts/lib/review-escalation.mjs:563 ("`#2445` two-tier flip ... `#2771`/`#2785` — the POLICY tier is
SPLIT. Only the DECLARATIVE LEASH ... still forces a human; the DERIVATION CODE ... escalates to the sized
independent committee instead"), `isGateSelfPath` (`= isPolicyCorePath`) answers "is this the policy tier?",
not "does this force a human" — that question is `isPolicySpecPath`/`isDeclarativeLeashPath`, which returns
**false** for we:scripts/lib/review-core.mjs (its leash is `code`, not `spec`).

So both halves of the fix below are agent-reviewable today: we:scripts/lib/review-core.mjs escalates via the
policy *derivation* tier (independent committee, `review:pending`), and
we:scripts/workflows/review-parked-prs.mjs / we:scripts/review-core-cli.mjs escalate the ordinary way, via the
`^scripts/` blast-radius pattern (we:scripts/lib/review-escalation.mjs:246). Neither forces `review:human`.
This changes nothing about *what* to build, only that it does not need a separate human-gated slice — it lands
as one PR through the normal drain/converge path (the exact loop this item is fixing reviews its own fix).

## Decided design

Prefer **both** halves from the original filing, in one PR — not a menu, this is the call:

1. **Verdict acts on it (the load-bearing half).** Extend the loop's existing fail-closed `degrade` boolean
   (already used for an absent mandatory lens or a failed fetch) to also fire when `diffBasis !== 'net'`. This
   reuses the *exact* mechanism already wired end-to-end — `reducePanelRound`'s `degrade` becomes the
   `humanRequired` argument to `deriveVerdict` (via the shelled `review-core-cli reduce --round`), AND an
   independent in-process safety net at we:scripts/workflows/review-parked-prs.mjs:1046-1052 forces
   `verdict='needs-human'`/`outcome=OUTCOME_ESCALATE` regardless of what the reduce agent returns. No change to
   we:scripts/lib/jury-core.mjs is needed — `deriveVerdict`'s `humanRequired` short-circuit is already generic;
   this only adds a new caller-side reason to set it. (The original card pointed at
   we:scripts/lib/jury-core.mjs's reducers as the place to act; grounding shows the correct integration point
   is the existing call-site boolean that already feeds them, which is smaller-blast-radius and needs zero
   changes to the shared verdict-reduction library.)

   Fail-closed direction, same as the field's own producer: treat anything other than the literal string
   `'net'` as degraded (not `=== 'three-dot'`) — an absent, malformed, or unrecognized value must never read as
   the good basis, mirroring we:scripts/fetch-parked.mjs:212's own `diffBasis === 'net' ? 'net' : 'three-dot'`
   default-to-degraded and the fetch prompt's "If the field is absent, return 'three-dot'" instruction
   (we:scripts/workflows/review-parked-prs.mjs:640).

2. **Tell the juror too (defense in depth, not a substitute for #1).** Thread `diffBasis` into the panel
   mandate so a round that *will* be escalated anyway does not also hand the human reviewer a misleading
   "scope creep" finding the panel filed against files that already landed via a sibling lane. Without this,
   #1 alone still guarantees the *outcome* is correct (escalate, never auto-land) but the panel still runs
   over an unlabelled degraded diff and its `commentBody`/findings ride along on the escalation — a human
   reading the notice can still be misled even though the machine already declined to trust it.

Both are now agent-reviewable (see correction above), both are small, mechanical, and precedented by patterns
already in this file (`headSha`'s three-site capture-and-thread, #2864; `absentMandatoryLenses`'s
tested-pure-predicate + inlined-mirror split, since this harness body cannot `import`). Landing only #1 would
satisfy the letter of "Definition of done" bullet 1 below but leave the exact defect #2901 was about — a
misleading finding reaching a human — reachable on every degraded round; landing only #2 was already rejected
by the original filing's own reasoning ("the disclosure half alone is NOT sufficient"). Land both together.

## Scope + consumers

Production files (4):

- we:scripts/lib/review-core.mjs — new pure predicate `isDiffBasisDegraded`; `buildPanelMandate` gains a
  `diffBasis` param.
- we:scripts/review-core-cli.mjs — `runMandate`/`buildMandateText` accept and forward a `--diffBasis` flag to
  `buildPanelMandate` (kind `'lens'` only — the `editor`/`validator` mandate kinds are untouched; this harness
  never invokes the validator/red-team path at all: a grep for "validator" or "redTeam" over
  we:scripts/workflows/review-parked-prs.mjs returns nothing).
- we:scripts/workflows/review-parked-prs.mjs — capture `diffBasis` at all three fetch sites, thread it through
  `runPanelRound` → `lensPrompt` (as a CLI flag) and into `reducePanelRound`'s `degrade` computation.

Consumers checked (subprocess, not just import, per this repo's usual gap): `buildPanelMandate` and
`buildMandateText` have no other in-repo callers besides we:scripts/review-core-cli.mjs's own `mandate`
subcommand and their test files — so widening their signatures with a new optional, default-`null` parameter
is additive and cannot affect `/converge` or any other caller that never passes it.

Explicitly NOT in scope: we:scripts/lib/converge-core.mjs (the newer subject-agnostic engine under the
`#xyihiji` migration). Its `read` observation shape is a bare `{ ok, empty, material: string }`
(we:scripts/lib/converge-core.mjs:210-213) with no diff-provenance concept at all — it also serves the
working-tree `/converge` loop, which has no "net vs three-dot `gh pr diff`" distinction to carry (there is no
PR to `gh pr diff` against). Forcing a PR-specific field into a subject-agnostic core is a design question for
whoever eventually does the #xyihiji migration, not this item's to answer.

## Interfaces

**we:scripts/lib/review-core.mjs** — co-locate near `absentMandatoryLenses` (:1775):

```
/** Fail-closed diffBasis degrade check (#2914). Mirrors the field's own producer
 *  (we:scripts/fetch-parked.mjs assembleParked) and the fetch prompt's own instruction: anything other than
 *  the literal string 'net' -- undefined, '', 'three-dot', or an invented value -- reads as degraded. An
 *  unstated basis must never read as the good one. */
export function isDiffBasisDegraded(diffBasis) {
  return diffBasis !== 'net';
}
```

`buildPanelMandate` (:1046) gains one new optional param, appended after `aim` to keep every existing
positional/named call byte-stable:

```
export function buildPanelMandate({
  lens, contextIsolation = 'diff-only', netChangedFiles = null, goal = '', round = 1, fenced = false,
  aim = '', diffBasis = null,
} = {}) { ... }
```

**MUST-NOT-BREAK constraint**: the clause below may only be appended when `diffBasis` is truthy AND degraded --
guard as `if (diffBasis && isDiffBasisDegraded(diffBasis))`, never a bare `isDiffBasisDegraded(diffBasis)`
(which is `true` for `null`/`undefined` too, since `null !== 'net'`). The golden test at
we:scripts/lib/__tests__/review-core.test.mjs:689 asserts `buildPanelMandate({ lens: MANDATE_LENSES.CORRECTNESS })`
equals a byte-exact fixture string with no `diffBasis` passed -- that test must still pass unmodified. Place the
new block after the existing `netChangedFiles`/`aim` clauses, before the trailing unconditional
`MUTATION_PROBE_RULE` push, e.g.:

```
if (diffBasis && isDiffBasisDegraded(diffBasis)) {
  parts.push(
    'DIFF BASIS: DEGRADED (three-dot). You are holding the three-dot output, not the net',
    'two-tree diff -- it may list files a SIBLING lane already landed on main as though this PR added them.',
    'Before reporting a file as scope creep, an undeclared payload, or an unrelated change, consider that it',
    'may already be on main via another lane. This round will be escalated to a human regardless of your',
    'verdict, so your findings are read as a report, not an acceptance signal.',
  );
}
```

**we:scripts/review-core-cli.mjs** -- `buildMandateText` (:225) gains `diffBasis` in its destructured input
and forwards it only on the `'lens'` branch:

```
export function buildMandateText({ kind, lens, findings, round, roundCap, diffBasis } = {}) {
  switch (kind) {
    case 'lens':
      return buildPanelMandate({ lens, diffBasis });
    ...
```

`runMandate` (:486) reads the flag: `diffBasis: typeof flags.diffBasis === 'string' ? flags.diffBasis : undefined`
passed into its `buildMandateText({...})` call. `parseFlags` (:87) already turns a `--diffBasis=three-dot`
argument into `flags.diffBasis === 'three-dot'` with no new parsing code needed.

**we:scripts/workflows/review-parked-prs.mjs**:

- Alongside the existing `const shaOf = (f) => { ... }` (:1156), add a sibling helper:
  ```
  // Fail-closed, mirrors assembleParked's own default (we:scripts/fetch-parked.mjs:212): anything but the
  // literal string 'net' reads as the degraded basis.
  const basisOf = (f) => (f && f.diffBasis === 'net') ? 'net' : 'three-dot';
  ```
- After `let headSha = shaOf(fetched);` (:1163), add `let diffBasis = basisOf(fetched);`.
- At both re-fetch sites (:1255, :1300, immediately after each `headSha = shaOf(fetched);`), add
  `diffBasis = basisOf(fetched);`.
- `lensPrompt(pr, repo, lens, diff, escalationReason, title, round, juror, jurorsPerLens)` (:660) gains a
  `diffBasis` param; its shelled command line (:668, the string that runs the CLI's `mandate --lens=<lens>`
  subcommand) gets a `--diffBasis=<value>` flag appended. `diffBasis` is a code-normalized two-value enum
  (`'net'`/`'three-dot'`), never PR-controlled free text, so it is safe to inline on the command line directly
  -- it does not need the write-to-tempfile pattern the `citedFinding`/untrusted-PR-text values use.
- `runPanelRound(pr, repo, diff, escalationReason, title, round, activeLenses, jurorsPerLens)` (:949) gains a
  `diffBasis` param, threaded into its `lensPrompt(...)` call (:953). Its one call site (:1193) passes the
  outer-scope `diffBasis`.
- `reducePanelRound(pr, repo, lensResults, escalationReason, fetchOk, round, roundCap)` (:1020) gains a
  `diffBasis` param (insert after `fetchOk`, before `round`); its one call site (~:1183, inside the `while`
  loop) passes the outer-scope `diffBasis`. Replace the current 2-cause ternary with a reasons list so multiple
  simultaneous degrade causes are all reported (today's ternary silently assumes `!fetchOk` and
  `absentMandatory` never co-occur, which happens to hold for 2 causes but not 3):
  ```
  const basisDegraded = diffBasis !== 'net'; // MIRRORS the tested spec isDiffBasisDegraded() in review-core.mjs
  const degrade = absentMandatory.length > 0 || !fetchOk || basisDegraded;
  if (degrade) {
    const reasons = [];
    if (!fetchOk) reasons.push('the diff could not be fetched');
    if (absentMandatory.length > 0) reasons.push(`mandatory reviewer(s) absent (did not run/not scheduled): ${absentMandatory.join(', ')}`);
    // Only meaningful when a diff really was fetched -- an unfetchable diff already explains itself above.
    if (fetchOk && basisDegraded) reasons.push('the diff basis degraded to three-dot -- the net two-tree diff was unavailable, so a sibling lane\'s already-landed files may read as this PR\'s own (#2914)');
    log(`  ${repo}#${pr}: round ${round} DEGRADING to needs-human -- ${reasons.join('; ')} (a reviewer that did not run NEVER reads as accept).`);
  }
  ```
- Optional, cheap, same seam: extend `reducePrompt`'s `humanRequired` prose line (:763, "true means a
  mandatory reviewer did not run, or the diff was unfetchable") to also mention "...or the diff basis degraded
  to three-dot", so the reduce agent's own comment-building step (step 5, `buildComment`) has an accurate
  reason to draw on.

## Tasks (ordered)

1. we:scripts/lib/review-core.mjs: add `isDiffBasisDegraded`; add its unit tests in
   we:scripts/lib/__tests__/review-core.test.mjs (net -> false; undefined/''/'three-dot'/an invented string ->
   true).
2. we:scripts/lib/review-core.mjs: add the `diffBasis` param + guarded disclosure clause to `buildPanelMandate`;
   extend its param doc. Add tests in the same file's `buildPanelMandate` describe block: a
   `diffBasis: 'three-dot'` call contains the DEGRADED/three-dot disclosure text; a `diffBasis: 'net'` call does
   not; a call with `diffBasis` omitted is byte-identical to today's output (guards the MUST-NOT-BREAK
   constraint above, and specifically that the existing golden-fixture assertion still passes unmodified).
3. we:scripts/review-core-cli.mjs: thread `diffBasis` through `buildMandateText`/`runMandate`. Add a test in
   we:scripts/__tests__/review-core-cli.test.mjs exercising the mandate subcommand with `--lens=<x>
   --diffBasis=three-dot` (or the `buildMandateText`/`runMandate` entry point the existing tests use) and
   asserting the disclosure text is present; `--diffBasis=net` or the flag omitted is not.
4. we:scripts/workflows/review-parked-prs.mjs: add `basisOf`; capture `diffBasis` at all three fetch sites;
   thread it through `runPanelRound`/`lensPrompt` into the CLI shell-out; extend `reducePanelRound`'s `degrade`
   to the reasons-list form above; update the one call site of each changed function. Extend the `reducePrompt`
   humanRequired prose line (optional per above, cheap enough to include).
5. Add the source-regression tests for step 4 (the harness body cannot be imported -- mirror the existing
   `#2864` headSha pattern in we:scripts/lib/__tests__/review-core.test.mjs, same source-file fixture already
   declared there): a new describe block asserting (a) `diffBasis = basisOf(fetched)` (or the equivalent
   literal the implementation lands on) appears exactly 3 times, (b) the `degrade` line includes the `diffBasis`
   condition, (c) the mandate shell-out line includes a `--diffBasis` flag.
6. Run `npm run check:standards` (must stay 0 errors) and `npm test` (vitest; every new + existing test green,
   including the untouched golden fixtures in the review-core test file).

## Done when

- `isDiffBasisDegraded('net')` is `false`; every other input (omitted, `''`, `'three-dot'`, an unrecognized
  string) is `true` -- proven by a unit test (task 1).
- `buildPanelMandate({ lens, diffBasis: 'three-dot' })` contains an explicit disclosure telling the juror the
  diff is degraded and not to report sibling-lane files as scope creep; `buildPanelMandate({ lens })` with no
  `diffBasis` is byte-identical to its current output -- proven by unit tests (task 2), including the existing
  golden-fixture assertion passing unmodified.
- A parked-PR round whose captured `diffBasis !== 'net'` forces `reducePanelRound`'s `degrade` (and therefore
  the round's `verdict`/`outcome`) to `needs-human`/`escalate`, exactly like today's absent-mandatory-lens and
  failed-fetch causes -- proven by the source-regression test (task 5), since the harness body cannot be
  imported and exercised directly.
- The mandate CLI invocation carries a `--diffBasis` flag on every panel round, and the CLI forwards it into
  `buildPanelMandate` -- proven by a CLI-level test (task 3).
- `npm run check:standards` -- 0 errors.
- `npm test` -- green, including every new test above and every pre-existing test in the touched files
  (especially the byte-stable `buildPanelMandate` golden fixture).

## Delivery shape

Single PR, not incremental. The four production files are one seam: capturing `diffBasis` without threading it
into `degrade` is a silent no-op (exactly the bug this item exists to close, one hop later); threading a
`degrade` condition that references an uncaptured variable does not compile. Landing tasks 1-2 alone (the pure
predicate + mandate clause) without task 4 (the loop actually consulting it) would repeat the original defect
at one further remove. All four land together behind the normal drain/converge review path -- per the
correction above, neither half forces `review:human`, so this is an ordinary agent-reviewable PR, not a
human-gated one.
