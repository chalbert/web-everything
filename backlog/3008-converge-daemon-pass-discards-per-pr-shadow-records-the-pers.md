---
bornAs: x62n6v6
kind: story
size: 2
parent: "2572"
status: open
dateOpened: "2026-08-08"
tags: [review, converge-daemon, shadow-mode, decision-routing, enforce-flip]
---

# converge daemon pass discards per-PR shadow records — the persisted log cannot feed the ratified enforce-flip agreement metric either

Found during the independent technical review of PR #1113 (the converge-daemon launchd substrate,
2026-08-08), alongside the sibling finding #3009. Two distinct problems in the same function,
`buildPassRecord` in `we:scripts/converge-daemon-pass.mjs` (PR #1113, **not yet merged** — see "Where
this lives" below).

## Update (2026-08-13) — PR #1113 has since MERGED; line numbers below are now real

PR #1113 merged; `we:scripts/converge-daemon-pass.mjs` exists on `main` with `buildPassRecord` at
lines 118-135, byte-for-byte the object literal quoted in Problem 1 below (re-read directly off the
tree this session, not the old PR diff). This item is buildable now — no `blockedBy` edge needed. The
"Not yet on `main`" framing that originally gated this item is stale; superseded by this note.

## Size

`size: 2` (unchanged from filing, confirmed by this session's scoping pass). The fix touches exactly
one pure function (`buildPassRecord`) and its existing test `describe` block, plus two prose
corrections (one code comment, one conditional backlog-wording check in `we:backlog/2572-…md`). No new
files, no new consumers, and no schema shared with another system — the #2838/#2893 durable ledger is
explicitly deferred, not built here (see "Design / approach" below). The one real judgment call (trimmed
vs. full per-PR projection) is small enough to resolve in the PR body rather than needing a separate
prepare pass. Well under the `>8` split threshold — not sliced.

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
log; each PR's own `reason` (e.g. `self-clear-refused: …`, once #3009 lands) and `subject`
(`repo#pr`) are silently dropped. So even after #3009 fixes the aggregate counts to move correctly,
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

## Done when

- Given a pass whose `we:scripts/review-runner.mjs --json` output includes
  `records: [{subject:'we#42', pr:42, repo:'we', wouldClear:false, reason:'self-clear-refused: …', …}, …]`,
  the `shadow.jsonl` line `buildPassRecord` produces has a `records` array of the same length, and
  `records[0].subject === 'we#42'`, `.wouldClear === false`, `.reason === 'self-clear-refused: …'` — the
  specific PR and its refusal reason are recoverable from the persisted log, not just the pass-level
  `wouldClear` count.
- Given `summary` is `null` (review-runner produced no parseable JSON, `we:scripts/converge-daemon-pass.mjs:269`)
  or `summary.ranPass === false` with no `records` key at all (the daemon's own pre-flight `refuse()`
  path, `we:scripts/converge-daemon-pass.mjs:226-233`, never calls review-runner), `buildPassRecord`
  returns `records: []` — never `undefined`/`null`, never throws.
- `we:scripts/__tests__/converge-daemon.test.mjs`'s `describe('buildPassRecord', …)` block (currently
  lines 167-204) has a passing assertion for each case above, including the existing lease-held fixture
  at lines 182-192 (its input already sets `records: []`; pin that it survives to the output, not just
  that `ranPass`/`reason` do).
- The code comment at `we:scripts/converge-daemon-pass.mjs:125-126` no longer states, present-tense, that
  "the enforce-flip readiness predicate reads this log"; it states the log is not yet `reviewShadowLedger`
  and does not feed `computeAgreementMetric` in its current shape, and names #2893.
- `we:backlog/2572-…md`'s Ruling R7 wording (lines 124-171, esp. 165-166) has been re-read against the
  same standard and either corrected (if it independently overstated present-tense reading) or left with
  a one-line note on the PR explaining why it was judged accurate as written.
- No claim added or left standing anywhere in scope that `shadow.jsonl`'s current shape is, or will
  automatically become, the durable ledger #2838 gates the enforce flip on.
- `npm run check:standards` exits 0.
- `git diff --stat` against `main` touches only `we:scripts/converge-daemon-pass.mjs`,
  `we:scripts/__tests__/converge-daemon.test.mjs`, and (conditionally) `we:backlog/2572-…md` — no other
  file.

## Design / approach (decided)

The fix is a pure pass-through, not a new ledger. `buildPassRecord` gains one new field, `records`, built
by projecting `summary.records` — already present on the JSON `we:scripts/review-runner.mjs --json`
emits (`we:scripts/review-runner.mjs:259`, sourced from `we:scripts/lib/review-runner-core.mjs:155-186`'s
`buildShadowRecord`) — down to the minimum this item's original acceptance criteria named: `subject`,
`pr`, `repo`, `wouldClear`, `reason`. When `summary` is `null` or carries no `records` array (the
daemon's own `refuse()` pre-flight paths never call review-runner at all — see
`we:scripts/converge-daemon-pass.mjs:226-233`), `records` defaults to `[]` — never `undefined`, never an
error.

**Open sub-decision — trimmed projection vs. full pass-through (flag for the builder/reviewer, not
silently resolved here):** the original AC text explicitly left "exact persisted shape" to whoever
implements it. Two honest options:
- **(a) Trimmed** (`subject`/`pr`/`repo`/`wouldClear`/`reason` only) — smaller log lines, matches the
  AC's literal minimum, but drops `panelVerdict`/`outstandingFindings`/`lensVerdicts`/`rounds`
  (`we:scripts/lib/review-runner-core.mjs:166-185`) that `buildShadowRecord` already computed, which an
  operator debugging a wrong `reason` might want without re-running the pass.
- **(b) Full pass-through** (store each `summary.records[i]` object verbatim) — no information loss, but
  couples `shadow.jsonl`'s shape to `buildShadowRecord`'s full shape, so any field added there later
  silently grows every soak line.

Recommendation: **(a) trimmed** — it is what the AC asked for and keeps the log small across an
unattended multi-week soak. This is a judgment call, not a mechanical one; note the choice made (and why,
if it changes) in the PR body so a reviewer can weigh in before it lands.

**Do NOT build the #2838/#2893 ledger here.** This item stays scoped to "make the existing per-pass log
honest and complete about the PRs it saw." `we:scripts/lib/decision-routing.mjs`'s `recordIsMatch` /
`computeAgreementMetric` (lines 345-348, 374) and the `ShadowOutcomeRecord` shape (a `match`/`outcome`
per record, compared against an actual human decision) are #2893's job, `blockedBy: 2892`. **Reserve
those exact field names** (`match`, `outcome`) — do not add them here, even as placeholders. A per-PR
record that says "the shadow pass would-clear PR 42" is a **different population** than a record that
says "the shadow pass's PR-42 verdict matched the human's actual PR-42 decision" (the latter needs a
human decision to compare against, which does not exist in this log and requires #3009's
`authorId`/`clearerId` plumbing too). Giving the former the latter's field names is exactly the
"aggregate/record computed over one population applied to another's decision" defect class this repo has
been bitten by repeatedly — do not let this fix create a false-cognate shape. `enforceFlipReady` still
does not exist anywhere in the tree (reconfirmed this session, zero hits), so nothing downstream reads
`shadow.jsonl` yet; this fix does not change that — it only makes the log honest for whenever #2893
lands.

## Interface and protocol

- **Shape written** (new field on the existing per-PASS record; one JSON object per line in
  `~/.converge-daemon/shadow.jsonl`, `cfg.logPath` per `we:scripts/converge-daemon-pass.mjs:81`):
  `records: Array<{ subject: string, pr: number, repo: string, wouldClear: boolean, reason: string }>`.
- **Written at**: `buildPassRecord`, `we:scripts/converge-daemon-pass.mjs:118-135`, called from `main()`
  at line 271, after `spawnSync`-ing `we:scripts/review-runner.mjs --json` (`buildRunnerArgv`, lines
  106-110) and `JSON.parse`-ing its stdout into `summary` (lines 267-269).
- **Appended at**: `appendRecord`, `we:scripts/converge-daemon-pass.mjs:279-286` — best-effort
  `appendFileSync` to `cfg.logPath`; unchanged by this fix.
- **Read today**: nothing. Reconfirmed this session — zero hits for the `enforceFlipReady` identifier
  anywhere in the tree, and a repo-wide grep for `shadow.jsonl` / `CONVERGE_DAEMON_STATE_ROOT` finds no
  reader script, only the writer (`we:scripts/converge-daemon-pass.mjs`) and the installer printing the
  path for an operator (`we:scripts/converge-daemon-install.mjs:192,240` — it prints `cfg.logPath`, it
  never parses the file's contents; unaffected by this fix).
- **Read in future, by #2893** (not this item): the real `reviewShadowLedger` builder will need to fold
  this log (or a successor of it) into `ShadowOutcomeRecord[]` — comparing each per-PR `wouldClear` /
  `reason` against the human's actual eventual decision on that PR. That comparison logic does not exist
  yet and is explicitly out of this item's scope.
- **Absent-field contract (this is the migration story — there is no rewrite)**: every `shadow.jsonl`
  line written before this fix lands has NO `records` key at all (not even `[]`). A future reader MUST
  treat a missing `records` key as "no per-PR detail captured for this historical pass" — distinct from
  `records: []`, which means "the pass ran and genuinely found zero clearable PRs." Conflating the two
  would misread history as a wall of empty passes. No rewrite/migration of the existing append-only log
  is proposed — it is soak history, not mutable state; the contract is purely on the READER side.

## Tasks

1. `we:scripts/converge-daemon-pass.mjs`: add the `records` field to `buildPassRecord`'s return (lines
   118-135), projecting `summary.records` per the trimmed shape above; default `[]` when
   absent/not-an-array.
2. Same file, lines 125-126: correct the comment currently claiming "the enforce-flip readiness predicate
   reads this log" — state it does not yet, and name #2893.
3. `we:backlog/2572-…md`: re-read Ruling R7 in full (lines 124-171, particularly 165-166) against the
   same standard; correct it if it independently overstates present-tense reading, otherwise note on the
   PR why it was left as-is.
4. `we:scripts/__tests__/converge-daemon.test.mjs`: extend the `describe('buildPassRecord', …)` block
   (lines 167-204) — add a `records` fixture to the "folds a real pass" case (170-180) and assert the
   projection; add a case asserting `records: []` for a `summary: null` input (mirrors 194-198) and for a
   `refuse()`-shaped summary with no `records` key; pin the existing lease-held fixture's `records: []`
   survives to the output (182-192).
5. `npm run check:standards` — 0 errors. Also run
   `npx vitest run we:scripts/__tests__/converge-daemon.test.mjs` (path, not a locus prefix, when actually
   invoking the command) directly since it is the seam under test.
6. `git diff --stat` against `main` — confirm only the files named above changed; `we:scripts/review-runner.mjs`,
   `we:scripts/lib/review-runner-core.mjs`, and `we:scripts/lib/decision-routing.mjs` stay untouched (they
   are the source and the future reader, not this fix's targets).

## Delivery shape

One piece, not incremental. The whole change is a single pure-function edit plus its tests plus two prose
corrections — there is no meaningful seam to split behind a flag. Shipping the code fix without the
comment fix (or vice versa) would leave the exact stale-claim gap this item exists to close: the log
honest while the comment still overclaims, or the comment honest while the log stays lossy. It does not
touch, gate, or partially build #2893's ledger, so there is no rollout/flag question — it lands whole in
one PR.

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

- Sibling finding from the same PR #1113 review, same review pass, different file: #3009 (missing
  `authorId`/`clearerId` at the `runShadowPass` → `runnerShadowPlan` call site). That item's fix is a
  prerequisite for this one to matter in practice — Problem 1 here is about carrying a per-PR
  `self-clear-refused` reason through, which only exists once #3009 lands.
- Parent epic: #2572 (schedule the converge-and-label runner) — Ruling R7 there is what PR #1113 ships.
- #2838 — the ratified enforce-flip triple gate; condition (c) is what Problem 2 concerns.
- #2893 (`blockedBy: 2892`) — the follow-on that owns building the actual durable `ShadowOutcomeRecord`
  ledger `computeAgreementMetric` needs; this item's Problem 2 is a note that the interim log this PR
  ships should not be assumed to be that ledger.
