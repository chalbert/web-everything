---
kind: story
size: 2
parent: "2572"
status: open
dateOpened: "2026-08-08"
tags: [review, converge-daemon, shadow-mode, decision-routing, enforce-flip]
---

# converge daemon pass discards per-PR shadow records — the persisted log cannot feed the ratified enforce-flip agreement metric either

Found during the independent technical review of PR #1113 (the converge-daemon launchd substrate,
2026-08-08), alongside the sibling finding #x7snbvd. Two distinct problems in the same function,
`buildPassRecord` in `we:scripts/converge-daemon-pass.mjs` (PR #1113, **not yet merged** — see "Where
this lives" below).

## Not yet on `main` — read this against the PR diff, not the tree

`we:scripts/converge-daemon-pass.mjs` does not exist on `main` as of filing (2026-08-08); it is
introduced by PR #1113, open with `review:human` + `ready-to-merge`. The code-path loci below are cited
against that PR's diff (`gh pr diff 1113`), not against a resolvable line in the current tree. This item
cannot be *worked* until PR #1113 lands and the file exists — filed now so the finding is not lost, and
so it is on record before the daemon's first real soak. No `blockedBy` edge is set: there is no backlog
item tracking "PR #1113 merges" as a discrete, resolvable prerequisite (the parent epic #2572 is itself
what PR #1113 delivers), so the dependency is stated here in prose instead.

## Problem 1 — per-PR detail never reaches the persisted log

`buildPassRecord` folds `we:scripts/review-runner.mjs`'s `--json` output into one record appended to
`~/.converge-daemon/shadow.jsonl`:

```js
export function buildPassRecord({ startedAt, cfg, exitCode, summary, error }) {
  return {
    at: startedAt, clone: cfg.clone, juryDir: cfg.juryDir, exitCode,
    ranPass: !!(summary && summary.ranPass),
    reason: summary && !summary.ranPass ? summary.reason || null : null,
    discovered: summary ? summary.discovered ?? null : null,
    clearable: summary ? summary.clearable ?? null : null,
    wouldClear: summary ? summary.wouldClear ?? null : null,
    wouldKeepParked: summary ? summary.wouldKeepParked ?? null : null,
    mutations: summary ? summary.mutations ?? null : null,
    error: error || (summary && summary.error) || null,
  };
}
```

`summary.records` (the per-PR array `we:scripts/review-runner.mjs`'s `main()` already includes in its
JSON output — verified: `records` is a key of the `summary` object written to stdout) is never read
here. Only the pass-level aggregate counts (`wouldClear`/`wouldKeepParked`) survive into the persisted
log; each PR's own `reason` (e.g. `self-clear-refused: …`, once #x7snbvd lands) and `subject`
(`repo#pr`) are silently dropped. So even after #x7snbvd fixes the aggregate counts to move correctly,
**the specific PR and the specific refusal reason are still invisible in `shadow.jsonl`** — an operator
reading the log sees a lower `wouldClear` number with no way to tell which PR(s) account for the drop or
why, and no way to correlate later against a human's actual decision on that PR.

## Problem 2 — the persisted shape cannot feed the ratified `computeAgreementMetric` gate either

Independent of Problem 1's fix. Backlog #2838 (ratified 2026-08-02, `codifiedIn:
we:docs/agent/platform-decisions.md#enforce-flip-triple-gated`) names the durable review-seam ledger as
an explicit **precondition**, not yet built: `enforceFlipReady({ ciStatus, reviewShadowLedger })`'s
condition (c) is `computeAgreementMetric(reviewShadowLedger).flipReady === true`, where
`reviewShadowLedger` must be a durable `ShadowOutcomeRecord[]`. `computeAgreementMetric`'s
`recordIsMatch` (`we:scripts/lib/decision-routing.mjs:345`):

```js
function recordIsMatch(r) {
  if (!r || typeof r !== 'object') return false;
  if (r.outcome === SHADOW_OUTCOMES.DIVERGENCE) return false;
  return r.match === true || r.outcome === SHADOW_OUTCOMES.MATCH;
}
```

requires a `match` boolean or `outcome` enum per record. `buildPassRecord`'s records carry neither —
no `match`, no `outcome`, no PR number, no human decision to compare against (they are per-PASS
aggregates, not per-PR-decision rows). Fed into `computeAgreementMetric` as-is, every record fails
`recordIsMatch` and reads as a divergence, so `flipReady` would never become `true` — fail-safe, but the
soak would buy nothing toward the flip it exists to earn.

**This does not mean the current shape is wrong on its own terms** — `we:backlog/2572-…md`'s ruling R7
explicitly scopes PR #1113 to scheduling substrate only, and #2893 (`blockedBy: 2892`, per #2838's
"Preconditions") is the follow-on that is supposed to build the actual durable `ShadowOutcomeRecord`
ledger. The defect is narrower and more specific than "the shape should already match": **the PR body
and the code comment both assert, in the present tense, that this log is what the readiness predicate
already reads**, which is not accurate today. `we:backlog/2572-…md`'s Ruling R7 text: *"a pass that
could not run (lease held, `gh` down) is recorded, not dropped, because a gap the enforce-flip readiness
predicate cannot see is a gap it cannot account for."* The `buildPassRecord` code comment echoes it
near-verbatim: *"the enforce-flip readiness predicate reads this log."* No `enforceFlipReady` function
exists anywhere in the tree yet (confirmed by a repo-wide search for the identifier on `main` as of
filing — zero hits), so nothing reads this log today, and even once it exists, this log's shape cannot
be handed to it directly per Problem 2 above. The claim overstates what PR #1113 delivers toward #2838's
gate.

## Acceptance criteria

- `buildPassRecord` (or a sibling function) carries forward enough per-PR detail — at minimum
  `subject`/`pr`/`repo`, `wouldClear`, and `reason` per record from `summary.records` — so a reader of
  `shadow.jsonl` can tell which PR(s) changed the pass's aggregate counts and why. Exact persisted shape
  is an implementation call for whoever picks this up; the criterion is that per-PR `reason` is
  recoverable from the persisted log, not just the pass-level count.
- The PR body text and the `buildPassRecord` code comment in `we:backlog/2572-…md` / PR #1113 (once
  landed) are corrected to state plainly that this log is **not** yet `reviewShadowLedger` — it does not
  feed `computeAgreementMetric` in its current shape, and #2893 owns building the shape that does. (If
  PR #1113 has already landed with the overstated comment by the time this is picked up, fix the comment
  in place rather than leaving it uncorrected.)
- No claim added or left standing anywhere in this file's scope that `shadow.jsonl` in its current shape
  is, or will automatically become, the durable ledger #2838 gates the enforce flip on.
- Cross-reference #2893 explicitly (in the code comment or nearby doc) so the next reader who lands
  #2893 knows this log's shape was already flagged as insufficient, rather than re-discovering it.

## Verification (re-derived from source, not taken on trust)

- Read `we:scripts/converge-daemon-pass.mjs`'s `buildPassRecord` directly off PR #1113's diff — the
  object literal above is the literal returned shape, not paraphrased.
- Confirmed `we:scripts/review-runner.mjs`'s `main()` includes `records` as a top-level key of the JSON
  object written to stdout (`summary = { …, records }`), so the data Problem 1 needs is already present
  in `buildPassRecord`'s `summary` input — it is dropped by omission, not because it is unavailable.
- Read `we:scripts/lib/decision-routing.mjs`'s `recordIsMatch`/`computeAgreementMetric` directly —
  confirmed the required fields (`match`/`outcome`) and confirmed `buildPassRecord`'s record shape has
  neither.
- Read `we:backlog/2838-…md` in full — confirmed condition (c) and confirmed it names the durable ledger
  as **not yet built**, a stated precondition of `#2839`'s follow-on impl, further scoped to `#2893`
  (`blockedBy: 2892`) per its own Preconditions section.
- Searched the tree for the `enforceFlipReady` identifier — zero hits on `main` as of filing, confirming
  no predicate function exists yet to read any shadow log, this one included.
- Confirmed `we:backlog/2572-…md`'s Ruling R7 body (added by PR #1113) contains the "gap the enforce-flip
  readiness predicate cannot see" line quoted above, read directly from the PR's diff to that file.

## Cross-references

- Sibling finding from the same PR #1113 review, same review pass, different file: #x7snbvd (missing
  `authorId`/`clearerId` at the `runShadowPass` → `runnerShadowPlan` call site). That item's fix is a
  prerequisite for this one to matter in practice — Problem 1 here is about carrying a per-PR
  `self-clear-refused` reason through, which only exists once #x7snbvd lands.
- Parent epic: #2572 (schedule the converge-and-label runner) — Ruling R7 there is what PR #1113 ships.
- #2838 — the ratified enforce-flip triple gate; condition (c) is what Problem 2 concerns.
- #2893 (`blockedBy: 2892`) — the follow-on that owns building the actual durable `ShadowOutcomeRecord`
  ledger `computeAgreementMetric` needs; this item's Problem 2 is a note that the interim log this PR
  ships should not be assumed to be that ledger.
