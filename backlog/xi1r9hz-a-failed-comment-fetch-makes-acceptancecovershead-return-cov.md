---
kind: story
size: 3
status: open
dateOpened: "2026-08-09"
scope:
  - we:scripts/merge-ai-prs.mjs
  - we:scripts/lib/review-escalation.mjs
  - we:scripts/__tests__/review-set-label.test.mjs
tags: [gate, review, drain, review-escalation, fail-open, merge-safety]
---

# A failed comment fetch makes acceptanceCoversHead return covered, so an unreviewed head can merge

The drain reads the reviewed-SHA markers out of a PR's comments inside a bare `try { … } catch { }`. If that
`gh` call throws, `acceptedSha` and `liveHeadSha` are both `null`, `acceptanceCoversHead` returns
`{ covers: true }`, and `decideReviewGate` answers `merge`. The staleness gate reports that the acceptance
covers the head at the exact moment it knows nothing about either. On a PR carrying `review:accepted` plus
`ready-to-merge`, that lands a head no reviewer saw.

This is pre-existing — the fail-open is #2409's stated design, written before the drain was also the thing
moving the head — and it sits on the merge path.

## The code

[we:scripts/merge-ai-prs.mjs](scripts/merge-ai-prs.mjs) lines 3168–3190 — the lazy marker fetch, run only for
a PR that already carries `review:accepted`:

```js
let acceptedSha = null;
let liveHeadSha = null;
…
if (hasReviewLabel(v.prLabels, REVIEW_LABELS.accepted)) {
  try {
    const d = JSON.parse(execFileSync('gh', ['pr', 'view', String(v.num), …,
      '--json', 'headRefOid,headRefName,comments'], …).trim() || '{}');
    liveHeadSha = typeof d.headRefOid === 'string' ? d.headRefOid : null;
    …
    acceptedSha = parseReviewedSha(d.comments || []);
    …
  } catch { /* fetch miss → SHAs null → gate fails open */ }
```

[we:scripts/lib/review-escalation.mjs](scripts/lib/review-escalation.mjs) —
`acceptanceCoversHead`'s first test:

```js
const a = typeof acceptedSha === 'string' ? acceptedSha.trim().toLowerCase() : '';
const h = typeof headSha    === 'string' ? headSha.trim().toLowerCase()    : '';
if (!a || !h) return { covers: true, reason: '' };
```

The comment is honest about it — `fetch miss → SHAs null → gate fails open` — so this is a documented
posture, not a bug hidden from the reader. What is unstated is that the posture is the *opposite* of the one
its neighbours take, and that it sits on the merge path.

## Reproduced

Run in the lane against the real module, driving `acceptanceCoversHead` and `decideReviewGate` with the
state a throwing fetch leaves behind:

```
BOTH NULL (fetch threw):              {"covers":true,"reason":""}
acceptedSha null, head known:         {"covers":true,"reason":""}
EMPTY comments array (fetch ok):      {"covers":true,"reason":""}
decideReviewGate w/ throw-simulated nulls:
  {"action":"merge","reason":"review:accepted — reviewer accepted, merge"}
decideReviewGate w/ real SHAs (fetch ok):
  {"action":"park","reason":"review:accepted is STALE — head advanced to bbbbbbbbbbbb past the reviewed
   commit aaaaaaaaaaaa …","applyLabel":"review:human","staleAcceptance":true,"humanRequired":true,…}
```

Same PR, same labels, same `humanRequired: true`. The only difference is whether one `gh` call succeeded.
Note the third line: an *empty* comment list (the call succeeds but returns nothing — a private/rate-limited
read, or a comments page the API truncated) produces the identical verdict, so this is not only about a
thrown exception.

## The asymmetry, which is the real argument

The same module and its siblings fail **closed** everywhere else this question comes up:

- [we:scripts/lib/lane-verify.mjs](scripts/lib/lane-verify.mjs) — a marker that exists but does not parse is
  normalized to `{ corrupt: true }` and refused unconditionally (`verify-corrupt`), with the docblock naming
  the alternative it rejected: "the gate refuses it, never treats it as `absent` and fails OPEN (#2833
  finding 2/5)".
- The clearer-identity refusal being added by PR #1100 (open, backlog
  [#2844](/backlog/2844-land-seam-refuses-a-self-cleared-verdict-and-an-invariant-an/))
  requires `independent === true` on the autonomous path and refuses **both** unknown statuses: "A machine
  that cannot PROVE the clearer is not the author does not land."
- Within `acceptanceCoversHead` itself, the two content escapes are explicitly fail-closed — both
  fingerprints must be present and equal; a missing one falls through to the stale verdict.

So the module's own house style is "cannot prove it ⇒ refuse". The SHA-unknown branch is the one place that
inverts it, and it is the branch a `gh` failure reaches.

## Why it was written this way, and what changed

`acceptanceCoversHead`'s docblock gives two reasons for the fail-open, and only one still holds:

1. **"never mass-re-parks accepts made before it shipped"** — a migration concern from #2409's rollout. Every
   accept written since then carries a `reviewed-sha` marker, so this is now about a shrinking tail.
2. **"never blocks on a fetch miss"** — a *liveness* preference. But a re-park is not a block: it is
   reversible by re-clearing, and the drain is non-blocking by construction (an escalated PR is parked alive
   and re-evaluated next pass). The cost of failing closed here is a re-clear; the cost of failing open is a
   merge.

## Directions worth costing (none picked)

- **Split "no marker recorded" from "could not read"**. Keep the fail-open for a genuinely absent marker
  (reason 1) and fail closed when the fetch *threw* — the `catch` knows which it is and currently discards
  that fact. This is the smallest change that removes the merge exposure without touching the pre-#2409 tail.
- **Retry the fetch once before giving up**, so a transient miss does not reach the gate at all. Reduces the
  frequency; does not change the posture.
- **Fail closed outright** and accept the pre-#2409 tail re-parking once each. Simplest, and the tail is
  finite.

## Acceptance

- A test drives the drain's gate decision with a throwing comment source and with an empty comment list, and
  asserts the chosen posture — whatever it is — rather than leaving it implicit in a bare `catch`.
- `acceptanceCoversHead`'s docblock and the `catch` comment agree with the code after the change; today they
  agree with each other and with a rationale that has since weakened.
- If the split option is taken, the pre-#2409 "no marker recorded" path still fails open and is pinned by its
  own test, so the migration guarantee is not quietly dropped.

Related: [#2409](/backlog/2409-gate-check-a-pr-s-reviewed-commit-set-must-match-its-head-be/)
(the gate, resolved — this is its stated fail-open),
[#2883](/backlog/2883-a-stale-acceptance-must-stay-non-waivable-after-the-accepted/) (open, the other
non-waivability hole in the same gate),
[#2884](/backlog/2884-acceptance-coverage-keys-on-head-sha-identity-so-a-no-op-reb/) (open).
