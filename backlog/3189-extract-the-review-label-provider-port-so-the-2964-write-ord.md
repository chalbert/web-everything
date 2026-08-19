---
bornAs: x8xf5rl
kind: story
size: 5
status: open
dateOpened: "2026-08-19"
preparedDate: "2026-08-19"
scope:
  - we:scripts/review-set-label.mjs
  - we:scripts/lib/review-label-provider.mjs
  - we:scripts/__tests__/review-set-label.test.mjs
  - we:scripts/lib/__tests__/review-label-provider.test.mjs
tags: [review, gate, merge-safety, testability, port, provider]
---

# Extract the review-label provider port so the #2964 write ordering is testable at all

`we:scripts/review-set-label.mjs` reaches GitHub through five hardcoded `execFileSync('gh', …)` calls,
two of which write. Its 1787-line test file covers only PURE functions — `decideSetLabel`,
`presentRemoveLabels`, `buildVerdictComment` — because there is no seam to inject through. So the
**write arc has no test at all**, including the conditional comment-first / swap-first ordering the
file itself calls "the safety property" (#2964). This extracts a provider port and injects it, so the
ordering can finally be asserted.

## The gap, measured

Every `describe` block in `we:scripts/__tests__/review-set-label.test.mjs` names a pure function. The
one `runReviewLabelCli` block covers the `clear-human` PRECONDITIONS — refusals that fire *before* any
`gh` call. Nothing exercises `applySwap`, `postComment`, or the branch that chooses between them.

That branch is not incidental. Its own comment says the order "IS the safety property", and gets it
wrong in a specific direction: an orphan `review:accepted` with no marker makes `acceptanceCoversHead`
fail OPEN, so the drain merges with the #2409 staleness gate disarmed. That is the most consequential
untested line in the review path.

## Why a port, and not "add a test with a fake gh on PATH"

A PATH shim would test the argv, not the sequence, and would leave the ordering decision reachable only
through a subprocess. The repo already has the right idiom one file over:
`we:scripts/operations/review-pr-io.mjs` is a pure-core / io-shell split whose header states the goal
plainly — "unit-tested with a stub reader and stub sinks — no `gh`, no `git`, no network". This story
brings the label writer to that same shape.

## The port

Four operations, named for what the file already does:

| operation | today |
|---|---|
| `readPrState(repo, pr)` | `gh pr view --json labels,headRefOid,headRefName,state,body` |
| `readLabels(repo, pr)` | `gh pr view --json labels` (the post-swap re-read) |
| `setLabels(repo, pr, {add, remove})` | `gh pr edit --add-label/--remove-label` |
| `postComment(repo, pr, body)` | `gh pr comment --body-file` |

`gh repo view` (the fifth site) is NOT in the port: it fires only when `--repo` is omitted and is
avoidable by always passing it. Confirmed by reading the call site.

Everything above the port — independence (#2844), the markers, `decideSetLabel`, the #2964 ordering,
the verdict-ledger append — does not move. That is the point: they stop being entangled with GitHub
mechanics and become testable against a stub.

## Scoped for THIS code, not declared provider-agnostic

The operator's reason for the port is separation, not a second provider, and this card follows that:
the shape is chosen to fit what `we:scripts/review-set-label.mjs` needs. **No second adapter is written
and none is promised.** One implementation never validates an abstraction; if a second provider ever
arrives, this port is a far better starting point than five scattered `execFileSync` calls, and it
should be expected to CHANGE shape then rather than be treated as already correct.

## The fork this does not pick: what `setLabels` promises

The `gh` adapter performs the write and can report applied / not-applied / indeterminate — the
three-state mapping the effect executor depends on. A future DEFERRED transport (push a request, let
CI run the adapter) can only ever report "requested".

**(a)** Keep the port strictly synchronous — deferral wraps a provider call rather than implementing
the port. **(b)** Widen the return to include `requested`, and make every caller handle it.

Recommend **(a)**: a deferred implementation of a synchronous contract has to lie about whether the
write landed, and both lies are already-known failures — reporting success on a lost write wedges the
run, reporting failure on a landed one double-posts a durable comment. The decision belongs on this
card before build, because it determines whether the deferral slice plugs in or reshapes the port.

## Done when

1. **Executable** — this fails before and passes after, on a case asserting BOTH orderings through the
   real code with a stub provider: a PR already carrying `review:accepted` calls `setLabels` before
   `postComment`; one not carrying it calls `postComment` first.

   ```
   npx vitest run scripts/__tests__/review-set-label.test.mjs
   ```
2. A test asserts the swap is never handed a label the PR does not carry (`presentRemoveLabels`
   intersection, now observable at the port instead of only as a pure function).
3. The default provider is `gh` and its argv is byte-identical to today's — proven by asserting the
   argv the adapter builds, so this refactor cannot silently change what is executed.
4. Every existing refusal still fires at the same point, and a refused run calls NO port operation —
   proven by a stub that records zero calls.
5. `check:standards` 0 errors; the existing 1787-line suite passes unmodified except for additions.

## De-risked during prep

- The five `gh` sites were read directly (lines 416, 439, 651, 664, 723) and classified: three reads,
  two writes, one avoidable.
- The test gap was measured, not assumed: every `describe` in the suite was listed, and the only
  `runReviewLabelCli` block covers preconditions that precede any `gh` call.
- The #2964 ordering and its fail-OPEN consequence were read from the file's own block rather than
  inferred.
- The io-shell precedent (`we:scripts/operations/review-pr-io.mjs`) was read to confirm this is the
  repo's existing idiom rather than a new pattern being introduced here.
