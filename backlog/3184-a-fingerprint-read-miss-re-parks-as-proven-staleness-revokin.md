---
bornAs: x6jb3zu
kind: story
size: 3
status: open
dateOpened: "2026-08-18"
preparedDate: "2026-08-18"
scope:
  - we:scripts/merge-ai-prs.mjs
  - we:scripts/lib/review-escalation.mjs
  - we:scripts/lib/__tests__/review-escalation.test.mjs
  - we:scripts/__tests__/merge-ai-prs.test.mjs
tags: [gate, review, drain, review-escalation, fail-closed, merge-safety]
---

# A fingerprint read MISS re-parks as proven staleness, revoking an operator clearance on identical content

The drain computes the live diff fingerprints inside a bare `try { … } catch { }`. On a miss both go
`null`, the gate falls through to the SHA test and re-parks with `review:human`, reasoning *"head
advanced past the reviewed commit"* — which it never verified. After a content-preserving rebase
that reason is FALSE: the content is byte-identical. So the re-hold revokes a recorded operator
clearance on no evidence, and since every rebase changes the SHA, it re-fires forever. The
fail-CLOSED twin of #3047. The merge verdict stays `park` either way — only the false reason and the
revocation change.

## The incident (WE PR #1445)

Cleared through the sanctioned `--to=clear-human` ceremony **seven times** between 22:50 on
2026-08-17 and 01:07 on 2026-08-18, re-held after each. The first re-holds were `scanTestTampering`
(filed as #1458, fixed by #1459). The clearance at 01:07 recorded the diagnosis for the rest:

> confirmed via a direct dry-run that scanTestTampering is NOT re-firing (`parked:[]` in the live
> gate output); this re-park was #2409's separate staleness gate reacting to a rebase changing the
> head SHA

Measured against the live PR on 2026-08-18, with the recorded markers from that seventh clearance:

| marker | recorded | live (head `ed32bba8`) | |
|---|---|---|---|
| `reviewed-sha` | `2d4cc065` | `ed32bba8` | differs |
| `reviewed-diff` | `ba771e33…` | `ba771e33…` | **identical** |
| `reviewed-contribution` | `cdd74ab0…` | `cdd74ab0…` | **identical** |

Both escapes in `acceptanceCoversHead` therefore apply. Feeding the live values to
`decideReviewGate` proves the two outcomes differ only by whether the read succeeded:

```
read SUCCEEDS -> merge | review:accepted — reviewer accepted, merge
read MISSES   -> park  | applyLabel: review:human | review:accepted is STALE — head advanced
                        to ed32bba83fee past the reviewed commit 2d4cc065
```

The content never changed. Only the read did.

## Why the current shape is wrong

`we:scripts/merge-ai-prs.mjs` guards the read with
`(acceptedDiff || acceptedContribution) && liveHeadRef && liveHeadSha && acceptedSha && (isLocalRepo(v.repo) || escCwd) && …`,
then swallows any failure: `catch { /* miss → null → SHA-identity verdict (the stricter path) */ }`.

"Stricter" is doing unearned work in that comment. Strictness is the right instinct for *landing* —
and the park is indeed retained, so nothing unreviewed merges. But the same `null` also drives two
things that are not merge-safety:

1. **The reason string asserts a fact.** *"head advanced past the reviewed commit"* is stated as
   observed. On a read miss it is a guess, and on PR #1445 it was a wrong one.
2. **`applyLabel: review:human` destroys a human decision.** #3039 (`3039`) already ruled that a
   re-hold overriding an operator clearance must SAY SO durably, and shipped the notice — but it
   explicitly left the verdict alone. The notice makes the revocation visible; it does not make it
   *earned*. A revocation on unverified staleness is not earned.

Note the asymmetry with the SHA tier directly above, which "fails OPEN when either SHA is unknown …
so it never … blocks on a transient fetch miss". The design already recognises that an unknown must
not be treated as a finding. The fingerprint tier does not honour that.

## Deliberately NOT in scope: failing open

Making a read miss return `covers: true` would hand a genuinely-advanced head a merge — the exact
hole #3047 is filed to close, in the direction the gate "may never fail in". This item keeps
`action: 'park'` byte-identical. Nothing new lands, and no agent gains a clearance.

## The fork this does not pick

Whether the re-hold should be **suppressed** (leave the cleared state, park without re-labelling) or
**relabelled to a distinct unproven tier**. Suppression is one line and cannot be gamed by an agent
(the merge is still refused). A distinct tier is more legible but is the ~10-consumer label change
#3053 already ruled REJECTED for a different reason, so it should not be re-opened casually here.
Recommend suppression; the decision belongs on this card before build.

## Done when

1. **Executable** — this fails before and passes after, on a case asserting that `decideReviewGate`
   with `acceptedDiff` present, `headDiff: null` and an explicit read-failed signal does **not**
   return `applyLabel: 'review:human'` for a PR whose `review:human` was cleared:

   ```
   npx vitest run scripts/lib/__tests__/review-escalation.test.mjs
   ```
2. The park verdict is unchanged: `action` stays `park` for that case, proven by the same test.
3. The reason string no longer asserts the head advanced when that was not observed — it names the
   failed verification instead.
4. `we:scripts/merge-ai-prs.mjs` distinguishes "no marker recorded" (fail closed, unchanged) from
   "marker recorded but this pass could not read the live side", rather than collapsing both to
   `null`.
5. Re-running the PR #1445 reproduction above yields `merge` on a successful read and a
   non-revoking park on a miss.

## De-risked during prep

- The fingerprints were recomputed live against PR #1445 with the drain's own `computeNetDiffText`
  plus `normalizeDiffFingerprint` / `normalizeContributionFingerprint`; both match the recorded
  markers exactly, so the "identical content" premise is measured, not assumed.
- Both `decideReviewGate` outcomes above were produced by running the real function, not read off
  the source.
- The rebase-survival claim was checked by rebasing the lane onto `origin/main` in a scratch branch
  and recomputing: both fingerprints unchanged. So a content-preserving rebase genuinely is the case
  the escape was built for, and genuinely does reach it when the read works.
