---
bornAs: xxp0xuu
kind: task
status: open
dateOpened: "2026-08-05"
tags: []
---

# One shared SHA-identity primitive — sameCommit and acceptanceCoversHead decide the same question twice

PR #1039 review finding 12. we:scripts/fetch-parked.mjs's sameCommit and we:scripts/lib/review-escalation.mjs's acceptanceCoversHead both answer 'is the tree I judged the tree that lands', both by prefix identity, with DIVERGENT validation — different hex bounds, different tolerance for whitespace and case, different fail-closed behaviour on a malformed input. Two gates deciding one question is the hand-copied-twin shape that went stale once already in this repo (#2823's VERDICT_STRICTNESS). Extract one primitive and have both call it, with the strictest of the two validations. Small, but it is a correctness seam: the two can disagree about whether an acceptance still covers the head.

## Design

**The divergence, as it stands on `main` (re-verified 2026-08-21).** Both sites lowercase and trim, and
both compare on the common prefix with a floor of 7 — that much already agrees. Everything else does not:

| | `sameCommit` (`we:scripts/fetch-parked.mjs:241`) | `acceptanceCoversHead`'s SHA tier (`we:scripts/lib/review-escalation.mjs:1383-1387`) |
|---|---|---|
| hex validation | `/^[0-9a-f]{7,64}$/` on **both** sides | **none** — any string ≥7 chars that prefix-matches passes |
| non-hex input | `false` (fail-**closed** → "different") | `covers: true` (fail-**open** → "still covered") |
| empty / absent side | `false` | `covers: true`, by documented design (never mass-re-parks pre-#2409 accepts) |
| prefix direction | `x.slice(0,n) === y.slice(0,n)` | `a.startsWith(h) \|\| h.startsWith(a)` (equivalent, spelled differently) |

The two fail-open cases are **not** the same defect. `acceptanceCoversHead`'s *empty-side* fail-open is a
ratified, documented posture (its docblock states it) and **must be preserved** — it is what stops the gate
mass-re-parking every accept made before #2409 shipped. Its *non-hex* fail-open is not documented anywhere
and is the real divergence: a garbage `acceptedSha` of `"--end-of-options\n9cd54a9d"` — the exact shape
`we:scripts/fetch-parked.mjs:319` records as having actually occurred — is rejected by `sameCommit` and
silently honoured here.

**The seam.** Put the primitive in `we:scripts/lib/review-escalation.mjs` (already a leaf that
`we:scripts/fetch-parked.mjs` can import, and which already has hex-bound precedent — though note
`REVIEWED_SHA_RE` at `:816` is bounded `{7,40}` for SHA-1 marker parsing, **not** the `{7,64}` bound being
extracted here, so it is a precedent for the shape, not a constant to reuse). Export it, and have
`sameCommit` become a thin re-export/wrapper so its existing call sites and tests are untouched. Signature:

```js
/** PURE — do two git object names denote the same commit? Strict: both sides must be 7–64 hex.
 *  Returns false for an absent/malformed side; the CALLER decides what absence means. */
export function sameCommitId(a, b) // → boolean
```

`acceptanceCoversHead` then reads: keep its own `!a || !h → { covers: true }` empty-side branch **above**
the call (that is policy, not identity), and replace the inline prefix test with `sameCommitId(a, h)` —
which tightens exactly one behaviour: a malformed non-empty sha now falls through to the content-equivalence
tiers and, absent a matching fingerprint, to the stale verdict. That is the strictest-of-the-two rule the
digest asks for.

Third candidate site, **out of scope**: `we:scripts/readiness/lane-manifest.mjs:143,287` and
`we:scripts/merge-ai-prs.mjs:708,2120` use the same `/^[0-9a-f]{7,64}$/i` bound but for *shape validation of a
manifest base*, not for identity comparison. Folding them in would widen this task past its digest; note them
and leave them.

## Done when

1. **Executable** — run, from the WE checkout root:

   ```
   npx vitest run scripts/__tests__/fetch-parked.test.mjs scripts/lib/__tests__/review-escalation.test.mjs
   ```

   The second path is `lib/` on purpose: `we:scripts/__tests__/review-escalation.test.mjs` exists but covers
   the escalation-reason-block helpers and never imports `acceptanceCoversHead` — the real
   `describe('#2409 — acceptanceCoversHead')` block is at `we:scripts/lib/__tests__/review-escalation.test.mjs:748`,
   and the new case extends it. It passes with a case asserting that
   `acceptanceCoversHead({ acceptedSha: '--end-of-options\n9cd54a9d', headSha: '9cd54a9d' })` returns
   `covers: false`. That case fails on `main` today (it returns `covers: true`).
2. **Executable** — a test pins the preserved posture: `acceptanceCoversHead({})`,
   `acceptanceCoversHead({ acceptedSha: '', headSha: 'abcdef1' })` and `acceptanceCoversHead({ acceptedSha: 'abcdef1', headSha: '' })`
   each still return `{ covers: true }`. The extraction must not convert the documented empty-side fail-open
   into a fail-closed.
3. **Observable** — the identity comparison no longer carries its own copy of the bound. On `main` today the
   grep below matches **3** lines: `:244` (`sameCommit`'s two-sided test), `:311` (the `headRefOid` *input*
   shape check) and `:319` (a prose comment quoting the pattern). After the extraction it matches **2** —
   `:244`'s line is gone; `:311` and `:319` stay, because validating an input and quoting a pattern in a
   comment are not comparing two ids.

   ```
   grep -n '\[0-9a-f\]{7,64}' scripts/fetch-parked.mjs   # 3 lines before, 2 after
   ```
4. **Observable** — `sameCommit` remains exported from `we:scripts/fetch-parked.mjs` (its existing importers and
   tests are unchanged) and its body contains no regex literal of its own.

## Independent review — 2026-08-21

Confidence: **High**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (addressed; strategy: verify by mutation or reversion ahead of the build) — Re-verified we:scripts/fetch-parked.mjs:241-247 and we:scripts/lib/review-escalation.mjs:1379-1429 against live main — the hex-validation, fail-open/closed, and prefix-direction divergences the card's table claims are all present exactly as described, including the real malformed-SHA comment at we:scripts/fetch-parked.mjs:319.
- **consumer** (addressed; strategy: find consumers TWO ways: ES imports AND subprocess/hook callers) — we:scripts/lib/verdict-ledger.mjs's ledgerCoversHead (a Phase-2 affordance with no live caller yet) and callers in we:scripts/merge-ai-prs.mjs / we:scripts/review-set-label.mjs all call acceptanceCoversHead directly rather than reimplementing the comparison, so the card's behavior-preserving-except-one-case fix reaches them for free without needing to be named in scope.
- **interface** (addressed; strategy: round-trip test at the seam, written by whoever owns neither half) — Done-when #1 and #2 are round-trip tests at the seam — one pins the newly-tightened malformed-input behaviour, the other pins the preserved empty-side fail-open posture — so the seam's two edge cases are both asserted, not just the happy path.
- **unmeasured-impact** (addressed; strategy: measure the constraint before sizing) — The card grounds the fix in a real occurrence already recorded in the repo (we:scripts/fetch-parked.mjs:317-320's comment about the actual '--end-of-options\n9cd54a9d…' case), not a hypothetical.
- **legibility** (NOT addressed; strategy: assert the failure SURFACES, not just that it occurs) — Done-when #1's vitest command names we:scripts/__tests__/review-escalation.test.mjs, which exists but tests unrelated escalation-reason-block helpers and never imports acceptanceCoversHead — so a builder who runs the command as literally given gets a green result that silently proves nothing about the fix; the failure of the check to actually check anything does not surface.
- **decorative-guard** (NOT addressed; strategy: mutate the guarded line; require a NAMED test to redden) — Mutation probe: no test in the cited we:scripts/__tests__/review-escalation.test.mjs exercises acceptanceCoversHead at all, so mutating we:scripts/lib/review-escalation.mjs:1379-1429 (e.g. deleting the malformed-input handling) reddens nothing in that file — the guard named in Done-when #1 is decorative for the review-escalation half unless the builder finds the real describe('#2409 — acceptanceCoversHead') block at we:scripts/lib/__tests__/review-escalation.test.mjs:748.

**Corrections applied by this review:**

- Done-when item 1's verification command should target we:scripts/lib/__tests__/review-escalation.test.mjs, not we:scripts/__tests__/review-escalation.test.mjs — the latter file exists but covers a different, unrelated set of helpers (buildEscalationReasonBlock, bodyHasEscalationReason, etc.) and never imports or tests acceptanceCoversHead.
- The card's framing that 'the strict REVIEWED_SHA_RE bound already lives' in we:scripts/lib/review-escalation.mjs is imprecise: REVIEWED_SHA_RE is bounded {7,40} (SHA-1 marker parsing), a different regex from the {7,64} bound the card proposes to extract — the file has hex-bound precedent, but not the same bound.

The design is sound and precisely re-verified against the live repo (every regex, line number, and behavioural claim in the divergence table checks out), but the "Done when #1" verification command cites the wrong test file for acceptanceCoversHead, making that half of the executable check decorative unless a builder notices and self-corrects.

_Recorded through the declared `review-prep` operation._

**Author response (2026-08-21).** Both NOT-addressed risks are the same finding and it was correct: Done-when
#1 named `we:scripts/__tests__/review-escalation.test.mjs`, which does not import `acceptanceCoversHead`. The
criterion now names `we:scripts/lib/__tests__/review-escalation.test.mjs` and points at the existing
`describe('#2409 — acceptanceCoversHead')` block, so the guard reddens under mutation. The `REVIEWED_SHA_RE`
imprecision is corrected in *The seam* above.
