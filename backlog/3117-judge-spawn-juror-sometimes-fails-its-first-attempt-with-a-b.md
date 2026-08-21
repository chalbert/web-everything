---
bornAs: xn85i4a
kind: task
status: open
dateOpened: "2026-08-14"
priority: low
tags: [operations, review, reliability, footgun]
scope:
  - we:scripts/lib/judge-spawn.mjs
---

# judge-spawn juror sometimes fails its first attempt with a bare, uninformative error

Across four review-prep live-fire runs tonight, the underlying judge-spawn juror failed its FIRST attempt twice (50%) with 'judge-spawn: the juror failed: <no result text>' — parsed.result was empty, so the thrown error carries no diagnostic content. Both times a bare retry of the identical command succeeded. Distinct from #3105 (the gate-timeout stall): this is a fast, immediate is_error from the spawned claude -p subprocess itself, not a foreground-window timeout. we:scripts/lib/judge-spawn.mjs:438 throws the CLI's own result text verbatim when is_error is set, so when that text is empty the caller has nothing to act on. Worth capturing stderr or the raw parsed object in the thrown message when result is empty, so a future occurrence is diagnosable without blind retry. Not investigated further; retry resolved both instances.

## The asked-for change appears to have already landed — verify before building

Read on this branch, `we:scripts/lib/judge-spawn.mjs` no longer throws a bare placeholder. `parseJudgeOutcome`
splits the `is_error` case in two: when `parsed.result` is non-empty it rethrows the CLI's words verbatim;
when it is **empty** it throws `judge-spawn: the juror failed with no result text.` followed by the
JSON-serialized raw parsed object (first 600 chars — so `stop_reason`, `subtype`, `session_id` all survive)
plus the last 600 chars of stderr, with an explicit `stderr: <empty>` when there is none. The caller supplies
that stderr, falling back to `exit code <N>` on a non-zero exit, so the empty-stderr case still carries the
exit status.

It is covered, and covered **by this card's own id**: `we:scripts/lib/__tests__/judge-spawn.test.mjs` holds
a case titled *"when `result` is empty, throws the raw parsed object and stderr instead of a useless
placeholder (#xn85i4a)"* — `xn85i4a` is this item's `bornAs`. The in-file comment names the same evidence
this card does ("reproduced twice in one night, cause unknown, resolved both times by a blind retry").

So the diagnostic half of this item is delivered and the line reference in the digest (`:438`) is stale —
the throw sites are now the `parsed?.is_error` block further down the same function. The independent review
below traced the message further and confirmed it actually reaches a reader: `we:scripts/lib/judge-panel.mjs`
propagates `err.message` verbatim into the failed seat's `error` field, so the new diagnostic surfaces to
the operation's caller rather than dying at the throw site.

**What is genuinely left is not a build.** The card's second half — *why* the spawn fails immediately about
half the time on a first attempt — was explicitly not investigated, and the fix that landed makes the next
occurrence diagnosable rather than explaining this one. There is no code change to write until such an
occurrence is captured. Treat this item as a **verify-and-close**, and if the intent is to add a retry
(which the card does not ask for), that is a different item with a different design question: retrying a
juror silently is exactly the blind retry this card complains about.

## Done when

- **No tier-1 criterion, and this is the exemption:** the behaviour this card asks for is already on `main`
  with a passing test that cites this card's `bornAs`. No new command can fail before and pass after,
  because nothing is missing. The work left is verification and a status decision, not a build.
- The empty-`result` path is confirmed still covered — the named case is present and green:

  ```
  npx vitest run scripts/lib/__tests__/judge-spawn.test.mjs
  ```

- A thrown message from that path is confirmed to carry, in one string: the `no result text` marker, the
  raw parsed object, and either the stderr tail or an explicit empty-stderr note. Look at the
  `parsed?.is_error` block in `we:scripts/lib/judge-spawn.mjs`.
- Either the item is resolved as already-delivered, or the residual (a retry policy, or a root-cause
  investigation of the ~50% first-attempt `is_error`) is carved into its own card with its own criteria —
  it is not silently folded back into this one.

## Independent review — 2026-08-21

Confidence: **High**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (addressed; strategy: verify by mutation or reversion, ahead of implementation) — The card explicitly re-verified against we:scripts/lib/judge-spawn.mjs and we:scripts/lib/__tests__/judge-spawn.test.mjs before recommending anything, and found the fix (commit 98dca7fe, `xn85i4a`) already landed — correctly declining to re-build already-delivered work.
- **consumer** (NOT addressed; strategy: find consumers TWO ways: ES imports AND subprocess/hook callers) — The card itself does not trace who consumes the thrown message; I did (we:scripts/lib/judge-panel.mjs:406-420, Promise.allSettled seat results, and the CLI adapter / review-prep / review-pr operations as importers) and confirmed the full `err.message` — including the new raw-parsed-object diagnostic — survives to the seat's `error` field, so the improvement actually reaches a human, not just the throw site.
- **decorative-guard** (addressed; strategy: mutate the guarded line; require a NAMED test to redden) — I mutated we:scripts/lib/judge-spawn.mjs's empty-result throw back to the old bare `judge-spawn: the juror failed: <no result text>` placeholder in a scratch copy and re-ran the assertion from the named test (#xn85i4a, we:scripts/lib/__tests__/judge-spawn.test.mjs:339-343) by hand (vitest itself would not start in this lane — missing node_modules/vitest binary): the regex failed against the mutant and passed against the unmutated source, confirming the guard is real, not decorative.
- **legibility** (addressed; strategy: assert the failure SURFACES, not just that it occurs) — Confirmed the failure surfaces end-to-end: parseJudgeOutcome's thrown Error carries the raw parsed object plus stderr/exit-code tail, and we:scripts/lib/judge-panel.mjs propagates `err.message` verbatim into the reported seat result rather than swallowing or truncating it.

**Corrections recommended:**

- none — the preparation held up as written.

_Recorded through the declared `review-prep` operation._
