---
bornAs: x5wvc7o
kind: story
size: 3
status: open
dateOpened: "2026-08-05"
tags: []
---

# Move the head-currency proof onto resolveNetDiffBasis so the SCORER shares it

PR #1039 review finding 5. we:scripts/fetch-parked.mjs proves the head ref is CURRENT before claiming a net basis, but the proof is homed in that one consumer: we:scripts/merge-ai-prs.mjs's resolveNetDiffBasis still swallows its fetch error and falls through to whatever tracking ref is cached, so the drain's escalation SCORE, its anti-test-gaming scan, and pr-land's scorer all keep the unproven path — one pass can auto-land against a stale tree while refusing to label that same tree 'net' for the reviewer. Fix: an optional expectOid on resolveNetDiffBasis, with fetch-parked re-homed onto it and the drain opting in.

**Why it was carved out.** Deliberately NOT bundled into PR #1039: that PR is the reviewer-facing basis, and
this changes the SCORING path — different blast radius, different reviewers, and #1039 is itself a carve-out
from a PR that bounced four rounds by growing each time it was repaired. It also makes the module's "one shared
basis, no second place to drift" contract true in the direction that matters: today the two halves disagree,
and the half that can land a merge is the unproven one.

## Design

**The seam is one exported function, its four in-module consumers, and THREE external importers.**
[we:scripts/merge-ai-prs.mjs](scripts/merge-ai-prs.mjs)'s `resolveNetDiffBasis` is the ONE place a basis is
resolved; `computeNetDiffChangedFiles`, `computeNetDiffText`, `computeNetDiffPaths` and `computeNetDiffSignals`
all go through it (the last already resolves once and hands the same `basis` to the other two). Today it
force-fetches `+<base>:refs/remotes/<remote>/<base>`, swallows a real fetch failure (`/* a real fetch failure
degrades to whatever is locally cached */`), then probes candidates `origin/<rev>` then `<rev>` — so a broken
git transport plus a working `gh` path yields a plausible OLDER diff labelled scored.

**The full importer inventory, by grep, not by assumption** — a caller left off this list stays on the
unproven path:

| importer | what it imports | what it passes as `rev` | exposure |
| --- | --- | --- | --- |
| [we:scripts/fetch-parked.mjs](scripts/fetch-parked.mjs) | `computeNetDiffText`, `computeNetDiffPaths` | `headRefOid` | already proven; re-homed in step 2 |
| [we:scripts/operations/review-pr-io.mjs](scripts/operations/review-pr-io.mjs) | `resolveNetDiffBasis`, `computeNetDiffText`, `computeNetDiffPaths` | `headRefName` — a `gh`-reported ref NAME | **exposed**, and it is the human-reviewer-facing read path |
| [we:scripts/review-set-label.mjs](scripts/review-set-label.mjs) | `computeNetDiffText` | a `gh`-reported ref name, to stamp the `reviewed-diff` fingerprint | **exposed** |
| [we:scripts/pr-land.mjs](scripts/pr-land.mjs) | `computeNetDiffSignals` | `refSha`, from a local `git rev-parse <SRC>` | **not** in this class — see below |

`we:scripts/operations/review-pr-io.mjs` and `we:scripts/review-set-label.mjs` must be threaded too, in the
same pass — the first because a reviewer signing off a diff is exactly the case the proof exists for, the
second because a fingerprint stamped off a stale tree pins the WRONG content as reviewed, which is strictly
worse than not stamping at all.

**`we:scripts/pr-land.mjs` is a different case, stated precisely.** It resolves its own source commit locally
(`git rev-parse <SRC>` → `refSha`) and passes that sha, so it was never subject to the
swallowed-fetch-degrades-to-a-stale-tracking-ref class this card fixes — unlike the drain, which passes
`rev: v.headRef`, a ref name. Since `expectOid` is opt-in and `we:scripts/pr-land.mjs` is not threaded to pass
it, it inherits **unchanged behaviour**, not a proof. Do not claim otherwise.

The proof already exists, homed in the wrong place: `resolveNetDiff` in
[we:scripts/fetch-parked.mjs](scripts/fetch-parked.mjs) fetches an EXPLICIT destination refspec, then
`git rev-parse --verify --end-of-options refs/remotes/origin/<headRef>` and compares to the `gh`-reported
`headRefOid` before it will claim `basis: 'net'`. Move that shape onto the shared resolver.

**Interface — additive, default-off, so no existing caller changes behaviour.**

```js
// we:scripts/merge-ai-prs.mjs
/**
 * @param {{exec:Function, remote?:string, base?:string, rev:string, fetchExtraRefs?:string[],
 *          expectOid?:string|null}} o
 *   `expectOid` — when set, the RESOLVED candidate must peel to exactly this object id, or the basis is
 *   refused (`{ ok:false, reason:'oid-stale' }`). Absent ⇒ today's behaviour, unchanged.
 */
export function resolveNetDiffBasis({ exec, remote, base, rev, fetchExtraRefs, expectOid = null } = {}) { … }
```

- The check goes **after** the candidate's `git diff --numstat` probe succeeds and **before** the `{ ok:true }`
  return: `git rev-parse --verify --end-of-options <candidate>^{commit}`, compared with the same
  `sameCommit`-style prefix-tolerant equality `we:scripts/fetch-parked.mjs` already uses. `--verify` is
  load-bearing (plain `rev-parse` echoes `--end-of-options` as an output line — the bug fetch-parked's docblock
  records against git 2.50.1).
- A NEW refusal reason `'oid-stale'` joins the existing `'exec-contract'` / `'ref-unresolved'` /
  `'basis-mismatch'` vocabulary, so a consumer reading only `scored` is untouched while a consumer reading
  `reason` can distinguish "the ref is gone" from "the ref is behind".
- Fail CLOSED: an unprovable candidate is refused, never silently downgraded to a scored-but-stale basis. That
  is the same direction `resolveNetDiff` already takes (it returns `degraded` with `basis: 'three-dot'`).

**Threading it through, in order:**

1. Add `expectOid` to `resolveNetDiffBasis` (+ `'oid-stale'`), and pass it through the `expectOid` option of
   `computeNetDiffChangedFiles` / `computeNetDiffText` / `computeNetDiffPaths` / `computeNetDiffSignals` so a
   caller that does NOT pre-resolve a basis still gets the proof. `basisAnswersRequest` must fold `expectOid`
   into the `requestedFor` identity, or a basis resolved WITHOUT the proof could be handed to a call that asked
   for it.
2. **Give `computeNetDiffPaths` a `basis:` parameter first.** It does not have one today — only
   `computeNetDiffChangedFiles` and `computeNetDiffText` accept a shared basis — so step 3 is not achievable
   until it does. Add it with the same `basisAnswersRequest` refusal (`reason: 'basis-mismatch'`) its two
   siblings already use, so the three stay symmetric.
3. Re-home `we:scripts/fetch-parked.mjs`'s `resolveNetDiff` onto it: resolve ONE basis with
   `expectOid: headRefOid` and hand it to both `computeNetDiffText` and `computeNetDiffPaths`, deleting the
   local `rev-parse` proof (single source, and it drops one redundant fetch). Behaviour is unchanged — with no
   `headRefOid` the basis is resolved without `expectOid` and the caller still returns `three-dot`.
4. Opt the drain in: `v.headSha = p.headRefOid` alongside the existing `v.headRef = p.headRefName` in the
   verdict-building loop (`gh pr list`/`pr view --json` already request `headRefOid`), then pass
   `expectOid: v.headSha` into the `computeNetDiffSignals` call in the escalation pass. Both the SCORE and the
   anti-test-gaming scan read that one `netDiffText`, so they inherit the proof together.
5. Thread the two external importers: `we:scripts/operations/review-pr-io.mjs`'s `readPr()` and
   `we:scripts/review-set-label.mjs`'s fingerprint stamp both have a `gh`-reported head oid in hand at the
   call site, so both pass `expectOid` and both fail closed (no proof ⇒ no `net` claim, no fingerprint stamp)
   rather than scoring off a cached ref.
6. `we:scripts/pr-land.mjs` needs no edit and gains no proof — see above. Pin that explicitly rather than
   leaving a reader to infer it.

**Coordinate, do not collide.** [#2952](/backlog/2952-net-diff-degrade-returns-a-bare-scored-false-no-reason-and-t/)
(`status: active`, `relatedTo: ["2912"]`) already shipped the `reason` vocabulary this card extends with
`'oid-stale'` — compatible, but check its live state before adding a token.
[#2979](/backlog/2979-an-accept-must-survive-a-mechanical-rebase-prove-content-equ/) (`status: active`) scopes
both `we:scripts/review-set-label.mjs` and `we:scripts/merge-ai-prs.mjs`, so step 5 overlaps its lease —
sequence behind it or split step 5 out.

## Done when

1. **Executable** — `npx vitest run merge-ai-prs` is green with a new case over a fake `exec` proving
   `resolveNetDiffBasis({ …, expectOid })` returns `{ ok:false, reason:'oid-stale' }` when the candidate
   resolves to a DIFFERENT object id, and `{ ok:true }` when it peels to `expectOid`. Fails today — the option
   does not exist, so the fixture asserting refusal gets a scored basis instead.
2. **Executable** — the same suite pins the fail-closed direction end-to-end: with a fake `exec` whose
   `git fetch` THROWS (the swallowed-failure path) and whose cached candidate is an older commit,
   `computeNetDiffSignals({ …, expectOid })` returns `scored: false` and `diffHunks: null` — not a stale
   scored diff. Today the same fixture returns a scored diff off the cache.
3. **Executable** — a regression case pins that omitting `expectOid` leaves every existing return shape
   byte-identical, so no current consumer changes behaviour.
4. **Executable** — `npx vitest run fetch-parked` stays green after `resolveNetDiff` is re-homed onto the
   shared resolver, including its real-git case (the one that caught the `rev-parse --verify` bug a fake
   `exec` cannot catch); and `computeNetDiffPaths` accepts a shared `basis` and refuses a mismatched one with
   `reason: 'basis-mismatch'`, matching its two siblings.
5. **Observable** — every direct importer of these helpers that passes a `gh`-reported ref NAME passes
   `expectOid` too. One `grep` for `resolveNetDiffBasis|computeNetDiffText|computeNetDiffPaths|computeNetDiffSignals`
   across `we:scripts/` shows `we:scripts/fetch-parked.mjs`,
   `we:scripts/operations/review-pr-io.mjs` and `we:scripts/review-set-label.mjs` all threaded, and
   `we:scripts/pr-land.mjs` deliberately not (it passes a locally-resolved sha).
6. **Executable** — `npm run check:standards` reports 0 errors.

## Independent review — 2026-08-21

Confidence: **Medium**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **consumer** (NOT addressed; strategy: find consumers TWO ways: ES imports AND subprocess/hook callers) — we:scripts/operations/review-pr-io.mjs's readPr() directly imports and calls resolveNetDiffBasis/computeNetDiffText/computeNetDiffPaths with rev: headRefName and no oid check (lines 30, 128-134), and we:scripts/review-set-label.mjs imports computeNetDiffText the same way to stamp the reviewed-diff fingerprint (lines 85, 549-553). The card's own text claims resolveNetDiffBasis has 'one exported function and its four in-module consumers' — that enumeration is factually wrong; it only searched within we:scripts/merge-ai-prs.mjs rather than grepping the repo for external ES importers.
- **interface** (NOT addressed; strategy: round-trip test at the seam, written by whoever owns neither half) — we:backlog/2979-an-accept-must-survive-a-mechanical-rebase-prove-content-equ.md (status: active) declares scope over we:scripts/review-set-label.mjs and we:scripts/merge-ai-prs.mjs, and we:backlog/2952-net-diff-degrade-returns-a-bare-scored-false-no-reason-and-t.md (status: active) already lists relatedTo: ['2912'] and scopes we:scripts/merge-ai-prs.mjs. Neither is mentioned or coordinated with in card 2912's design, even though #2952's reason-vocabulary work turns out to already be live and compatible.
- **premise** (addressed; strategy: check by mutation or reversion ahead of the build) — The core claim (resolveNetDiffBasis swallows a real fetch failure and falls through to whatever tracking ref is cached, at we:scripts/merge-ai-prs.mjs:2006-2012) is verified true against the live repo, as is we:scripts/fetch-parked.mjs's existing headRefOid proof (we:scripts/fetch-parked.mjs:300-351) and the existing reason vocabulary the card builds on (we:scripts/merge-ai-prs.mjs:2061-2063 etc., from #2952, already live).
- **decorative-guard** (addressed; strategy: mutate the guarded line; require a NAMED test to redden) — The card's Done-when items 1-2 explicitly require a fixture that is provably red today (asserting refusal returns a scored basis instead) and green after the fix, matching #3103's 'mutate the guarded line; require a NAMED test to redden' strategy.

**Corrections applied by this review:**

- The claim 'the seam is one exported function and its four in-module consumers' is incomplete: we:scripts/operations/review-pr-io.mjs and we:scripts/review-set-label.mjs both import resolveNetDiffBasis/computeNetDiffText directly and are omitted from the threading plan entirely.
- The claim that we:scripts/pr-land.mjs's scorer 'keeps the unproven path' overstates its exposure: pr-land passes rev: refSha, a sha already resolved locally via `git rev-parse SRC` (we:scripts/pr-land.mjs:655), not a gh-reported ref name — it was never subject to the swallowed-fetch-degrades-to-stale-cached-tracking-ref class this card fixes the way the drain's `rev: v.headRef` call is (we:scripts/merge-ai-prs.mjs:3209). Saying pr-land 'inherits the proof with no edit of its own' is also imprecise: expectOid is opt-in and pr-land is never threaded to pass it, so it inherits unchanged behaviour, not a proof.
- Step 2 ('resolve ONE basis with expectOid: headRefOid and hand it to both computeNetDiffText and computeNetDiffPaths') is not achievable as written: computeNetDiffPaths (we:scripts/merge-ai-prs.mjs:2195-2208) currently has no `basis:` sharing parameter — only computeNetDiffChangedFiles and computeNetDiffText do — so re-homing we:scripts/fetch-parked.mjs onto one shared basis also requires adding that capability to computeNetDiffPaths, which the card doesn't call out.

The core expectOid/resolveNetDiffBasis mechanism is sound and well-reasoned (verified consistent with live code: the reason vocabulary, requestedFor, and sameCommit all already exist as the card assumes), but the card's own claim of an exhaustive consumer list is false — two real, direct importers of these exact functions (one of them the human-reviewer-facing read path) are left on the unproven path with no mention.

_Recorded through the declared `review-prep` operation._

**Applied by the lane, 2026-08-21.** All three corrections were checked against the live code and are
correct; all three are now folded into the body. (1) The importer inventory is replaced by a grep-derived
table naming we:scripts/operations/review-pr-io.mjs and we:scripts/review-set-label.mjs — both confirmed to
import these helpers directly (`we:scripts/operations/review-pr-io.mjs:33`,
`we:scripts/review-set-label.mjs:84`) — and both are now threading steps. (2) The we:scripts/pr-land.mjs claim
is corrected: it passes `refSha` from a local `git rev-parse <SRC>`, so it is not in this failure class and
inherits unchanged behaviour, not a proof. (3) A new step 2 adds the missing `basis:` parameter to
`computeNetDiffPaths` before the re-home, which was indeed not achievable as written. The two `interface`
notes (#2952, #2979) are recorded as a coordination note rather than a `blockedBy` edge: #2952's reason
vocabulary is already live and compatible, and #2979's overlap is a lease/sequencing concern on one step, not
a hard prerequisite for the item.

