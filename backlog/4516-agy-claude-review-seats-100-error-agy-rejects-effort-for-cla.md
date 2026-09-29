---
bornAs: xcm15dy
kind: story
size: 2
status: resolved
scope: ["we:scripts/gemini-direct-task.mjs", "we:scripts/__tests__/gemini-direct-task.test.mjs"]
dateOpened: "2026-09-29"
dateStarted: "2026-09-29"
dateResolved: "2026-09-29"
preparedDate: "2026-09-29"
preparedAgainstSha: "a7843be302c9fabeaecf8db883149ad478317788"
tags: []
---

# agy-claude review seats 100% error: agy rejects --effort for claude-sonnet-4-6

Every agy-claude review-seat call today (83/83) errors: we:scripts/gemini-direct-task.mjs's buildAgyDirectTaskArgv always forwards --effort alongside --model, but agy's Claude-family backends (claude-sonnet-4-6, claude-opus-4-6-thinking) reject that combination outright (confirmed live error in the shared run-quality scorecard store). Fix: omit --effort for agy's Claude-backend model ids in the one argv-building function.

## Done when

1. **Executable** — `npx vitest run we:scripts/__tests__/gemini-direct-task.test.mjs` fails against the pre-fix
   `buildAgyDirectTaskArgv` (a new test asserting `--effort` is omitted for `claude-sonnet-4-6` and
   `claude-opus-4-6-thinking`) and passes once the fix lands, with every pre-existing test in that file
   (including the non-Claude-model effort-forwarding cases) still green.

## Design

**Root cause (confirmed live).** `we:scripts/operations/review-extra-seats.mjs#seatCallArgv` routes the
`agy-claude` review seat through `we:scripts/gemini-direct-task.mjs` with
`--model=claude-sonnet-4-6 --effort=<medium|high>` (the models/efforts come from
`we:scripts/operations/review-dispatch.mjs#REVIEW_SEAT_MODELS`/`we:scripts/operations/review-extra-seats.mjs#RED_TEAM_MODELS`).
`we:scripts/gemini-direct-task.mjs#buildAgyDirectTaskArgv` forwards `--effort` unconditionally whenever it is
given, on the documented assumption "vocabulary only; agy validates model/effort combinations" (i.e. agy would
refuse a bad *value*, not the whole *combination*). That assumption is false for agy's Claude-family backends:
the shared run-quality scorecard store's real rows for `provider=agy-claude, dispatchKind=review-seat` show
83/83 calls today failing fast (pre-API, exit before any model call) with the CLI's own error:
`invalid model selection (--model "claude-sonnet-4-6" --effort "medium"): --effort is not supported for model
"claude-sonnet-4-6"` (and the same for `--effort "high"`). This is not a quota/auth issue — it is a plain argv
bug: this repo's own code is asking `agy` for a flag combination the CLI hard-rejects, every single time.

**Fix location.** `buildAgyDirectTaskArgv` in `we:scripts/gemini-direct-task.mjs` is the one function that
builds the real argv handed to the `agy` binary — every caller (the review-seat dispatch above, and the file's
own documented direct-CLI usage `node we:scripts/gemini-direct-task.mjs --model=claude-sonnet-4-6
--effort=...`) goes through it. Fixing here fixes every caller at the one true boundary to the external CLI,
without touching `we:scripts/operations/review-extra-seats.mjs` (two other in-flight lanes are already editing
that file for unrelated review-seat concerns — a different quota-hold re-probe and the Codex-quota
judgeAdvisory crash — so this stays out of their way) or `we:scripts/operations/review-dispatch.mjs`.

**The fix.** Add a small, named, evidence-scoped exception: when `model` is one of agy's two documented
Claude-family backend ids (`claude-sonnet-4-6`, `claude-opus-4-6-thinking` — both already named together in
this file's own "MODEL FAMILIES" docblock), omit `--effort` from the argv entirely rather than forwarding it.
Only `claude-sonnet-4-6` has a live-confirmed rejection (no `agy-claude` seat call has ever used
`claude-opus-4-6-thinking` — zero trials on record); `claude-opus-4-6-thinking` is included by same-backend-
family inference, stated as inference, not as independently-confirmed live evidence. Every other model id
(known or future) is untouched — `--effort` still forwards exactly as before, preserving the "agy validates
model/effort combinations itself, no invented catalogue" discipline for every model this repo hasn't already
proven the CLI rejects it for.

## MVP (Musts only)

- `buildAgyDirectTaskArgv` omits `--effort` when `model` (trimmed) is `claude-sonnet-4-6` or
  `claude-opus-4-6-thinking`, for every code path that already threads `effort` through it (initial call,
  resume-conversation call, and the pre-clone fail-fast validation call).
- The one existing test that encoded the OLD (buggy) expectation —
  `we:scripts/__tests__/gemini-direct-task.test.mjs`'s `'leaves model/effort compatibility to agy, without a
  hardcoded catalogue'` case, which currently asserts `--effort` IS forwarded for `claude-sonnet-4-6` — is
  rewritten to assert the new, correct behavior for both named Claude models, plus a case proving a non-Claude
  model (e.g. `future-model`) is unaffected.
- No change to `we:scripts/operations/review-extra-seats.mjs`, `we:scripts/operations/review-dispatch.mjs`, or
  any other caller — the fix is confined to the one argv-building function and its own test file, per `scope:`.

**Explicitly NOT in the MVP** (see Follow-ups):
- A circuit-breaker / "sit out after N consecutive errors" guard for a repeatedly-failing seat provider.
- Independently confirming `claude-opus-4-6-thinking` + `--effort` live (no seat has ever tried that pair).

## Test plan

1. **Red before the fix:** a new `it` in the `buildAgyDirectTaskArgv` describe block asserts
   `buildAgyDirectTaskArgv({ model: 'claude-sonnet-4-6', effort: 'medium' })` does NOT contain `'--effort'` —
   this fails against the current code (which pushes `'--effort', 'medium'`), reproducing the live bug as a
   unit test.
2. Same assertion for `claude-opus-4-6-thinking`.
3. A sibling case keeps proving a non-Claude model (the existing `'future-model'` case at line ~296, and a
   fresh one) still gets `--effort` forwarded — the fix must not become a blanket effort-stripper.
4. The resume-conversation path (`resumeConversationId` set) gets the same Claude-model coverage, since it
   threads `effort` through the same builder.
5. Every pre-existing test in the file stays green (the admitted `vitest related` pass, then the real gate).

## Proof plan

**Live, not just unit tests.** Before the fix: run a real scratch `agy` seat call with today's argv shape
(`--model claude-sonnet-4-6 --effort medium`) and show it fails with the same
`--effort is not supported for model "claude-sonnet-4-6"` error already on record. After the fix: run the same
scratch call through `node we:scripts/gemini-direct-task.mjs` with the fixed `buildAgyDirectTaskArgv` (no
`--effort` in the real argv) and show it completes (a real `agy` response, not another argv-validation error).
Both runs go in the PR body as trimmed before/after evidence.

## Follow-ups

- File a follow-up card: should a review-seat provider whose most-recent calls keep erroring "sit out" (skip
  dispatch) for a cooldown instead of burning a call every single review — a small addition to
  `we:scripts/lib/provider-routing.mjs#selectReviewSeatProvider`'s existing recent-failure ranking, or to
  `we:scripts/operations/review-extra-seats.mjs`'s seat-cap accounting. Left for a follow-up, not this MVP,
  because: (a) the root-cause fix here already stops the errors outright, so there is nothing left to sit out
  from for THIS failure; (b) both files are already being edited by two other in-flight lanes today; (c) it is
  a genuine judgment call (how many consecutive errors, what cooldown, per-lens or per-provider) that deserves
  its own PREPARE, not a bolt-on here.
- (Noted, not filed separately — low priority) once a real `agy-claude` seat call with
  `claude-opus-4-6-thinking` exists, confirm live whether it also rejects `--effort`; if it turns out to accept
  it, narrow this fix's exception list back to `claude-sonnet-4-6` alone.
