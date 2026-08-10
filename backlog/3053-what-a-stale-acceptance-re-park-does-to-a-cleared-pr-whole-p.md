---
bornAs: xxdslno
kind: decision
status: open
dateOpened: "2026-08-09"
preparedDate: "2026-08-10"
relatedTo: ["3024", "3039", "3046", "3052", "3021", "2884", "3054", "3007", "2990", "3013", "3023", "2840", "2771", "2409", "2390"]
relatedReport: reports/2026-08-09-backlog-consolidation-analysis.md
tags: [gate, review, drain, review-escalation, declarative-leash, ratification]
---

# What a stale-acceptance re-park does to a cleared PR — whole-PR score, uncovered-delta score, or a fourth `review:stale` hold tier

Three approaches to one hole compete with no ruling: keep the whole-PR score (status quo, fail-closed), narrow the
re-park score to the **uncovered delta**
([#3024](/backlog/3024-a-stale-acceptance-re-park-re-asserts-review-human-from-the-/) is its build side), or add a
fourth **`review:stale`** hold tier (deferred by
[#3039](/backlog/3039-drain-re-hold-must-never-silently-revoke-an-operator-review-/) and never filed until this
card). Carved out of #3024 per the fork-flip-or-carve rule in
[we:docs/agent/backlog-workflow.md](docs/agent/backlog-workflow.md).

**Prepared 2026-08-10, and prep changed the card substantially.** One option is **dissolved on a false premise**,
one drafted fork is **withdrawn as a no-op**, nine figures or claims are corrected, and prep's own default was
flipped and then re-grounded when the skeptic broke three of its four supporting legs. Read *Prep's answer to the
gating question* and *Corrections* before the fork.

---

## Prep's answer to the gating question — how much of the hole survives once the false stale stops firing?

The card asked this first and called it gating. It is. The answer has three parts.

### 1 — The volume. Measured, not estimated: the answerable population is **2**, and **both were false**

A repo-wide label-event census (`gh api repos/chalbert/web-everything/issues/events --paginate`; 4,476 label
events, complete back to 2026-07-02, current to `2026-08-10T20:06Z`) finds **479 PRs** that ever carried a
`review:*` label and **35** accept→park transitions all-time:

| bucket | n | note |
| --- | --- | --- |
| Stale re-parks **under the contribution digest** (post-PR #1119, merged `2026-08-08T23:09:39Z`) | **2** | **both provably FALSE** |
| Stale re-parks under the **previous** mechanism (head-SHA identity / absolute offsets), 2026-07-28 → 2026-08-08 | 24 | a different mechanism; not gap/heading false positives by construction |
| Not stale re-parks at all | 2 | #791 (test-gaming park), #870 (reviewer bounce to `review:changes`) |
| Undetermined — silent pre-#1119 re-parks with no park comment | 7 | #374, #375, #620, #984 (×2), #1064, #1119 |

The two answerable cases, re-derived by script and **self-certifying** — for all four SHAs the net diff
(`git diff <merge-base> <head>`, the `computeNetDiffText` basis
[we:scripts/merge-ai-prs.mjs](scripts/merge-ai-prs.mjs) uses) reproduces the *stamped* `reviewed-diff` **and**
`reviewed-contribution` markers exactly, which is what proves the base reconstruction; the real shipped
`acceptanceCoversHead` then returns `covers: false` on both:

| PR | re-parked | head moved by | `+`/`-` lines | projection lines differing | mechanism |
| --- | --- | --- | --- | --- | --- |
| [#1106](https://github.com/chalbert/web-everything/pull/1106) | `2026-08-09T00:41:28Z` | the drain's own rebase commit | 1,435, **byte-identical** | 2 of 1,534 | **gap** only (`#3046`) |
| [#1100](https://github.com/chalbert/web-everything/pull/1100) | `2026-08-09T12:20:57Z` | the drain's own rebase commit | 1,440, **byte-identical** | 2 of 1,542 | **gap AND heading** (`#3046` + `#3052`) |

**Tally: gap-only 1 · heading-only 0 · both 1 · genuinely stale 0 · undeterminable 0.**

**Read this honestly. N = 2 is the whole denominator, not a rate.** The mechanism is two days old, and the
accept→re-park window on #1106 was **seven minutes** — roughly one drain tick — so "zero genuine advances" measures
the drain's rebase cadence at least as much as it measures the author-push rate. It is a real observation and a weak
one. Its weakness is why the ruling below does **not** rest on it.

### 2 — The *question* survives, because the fork's motivating scenario is not a false stale

`#3054`'s slices both fix cases where the contribution is **byte-identical** and the digest diverges anyway
(`#3046` gap, `#3052` heading). The scenario this fork was opened for is the opposite: a PR cleared for a gate-self
edit whose head then advances by **a real new commit touching nothing but a README**. There the contribution
genuinely changed, `acceptanceCoversHead`
([we:scripts/lib/review-escalation.mjs](scripts/lib/review-escalation.mjs) `:1089`) correctly returns
`covers: false`, and **no digest fix touches it.** `#3054` changes how often the re-park fires; it changes nothing
about which label it applies when it does.

### 3 — But the *harm* the options were built to prevent turns out not to exist

This is the finding that decides the fork, and it is not about volume at all. **A stale re-park does not destroy the
operator's clearance record.** Two landed mechanisms preserve it, both verified in the tree:

- **The `review:accepted` label survives the re-park.** The drain no longer deletes it —
  [we:scripts/lib/review-escalation.mjs](scripts/lib/review-escalation.mjs) `:1178`–`:1186`: *"`review:accepted`
  used to short-circuit to `false` unconditionally, which was safe only because the drain DELETED the accept
  whenever it re-parked. **It no longer does** … so a contradictory `accepted + hold` pair can now survive a
  re-park."* `hasUnclearedReviewLabel` was tightened (`#x9xqexm`) to fail closed on that pair. So after a re-park
  the PR visibly carries **both** the clearance and the hold.
- **#3039's revocation notice posts a durable comment on the PR** naming the clearer — `gate.revokesClearance` →
  `buildClearanceRevocationComment` at [we:scripts/merge-ai-prs.mjs](scripts/merge-ai-prs.mjs) `:3283`. Landed in
  PR #1124 and observed firing in production on WE PR #1100 at `12:20:59Z`.

**Option C exists to stop the re-park destroying the record. The record is not destroyed.** See correction 3 for
where that false premise came from — a stale docblock in the very function under discussion.

### What that combination decides

| option | justified by | survives? |
| --- | --- | --- |
| **C** — a fourth `review:stale` tier | the re-park **destroys** the clearance record, so make the revocation impossible | **No — the premise is false** (part 3), and C's only distinct mechanism fires solely in the case `#3054` removes. |
| **B** — score the uncovered delta | correctness on a genuine advance | **On merit yes; in buildable form no.** Prep could not construct a sound delta (correction 6), and B silently kills #3039's notice (correction 7). |
| **A** — whole-PR score | fail-closed posture | **Yes**, and prep found two ratified supports the card never cited (statute-overlap check). |

**So this is not a three-way reconciliation.** It is **one two-way fork whose answer is (a)**, with (c) dissolved on
a false premise and the drafted second fork withdrawn as a no-op. See *Screen result*.

---

## Corrections — nine, three of them to prep's own work

Every figure was re-derived; every code claim was read in the tree, not inferred from a card. **Corrections 6–8
correct prep's own drafts**, caught by the skeptic pass and independently re-verified.

### 1. "~10 consumers" for a fourth hold tier is drastically LOW — ~3× on files, ~10× on behavioural sites

Carried by this card from PR #1124's write-up as **unreplicated**; #3039 says so in as many words. Counted now. Its
origin is the docblock inside `decideReviewGate`
([we:scripts/lib/review-escalation.mjs](scripts/lib/review-escalation.mjs) `:1421`–`:1422`), and it is
approximately the count of files that `import { REVIEW_LABELS }` — **13**. That is the *cheap* tier.

| tier | count | note |
| --- | --- | --- |
| **Definitions inside one module** | 1 file, **4 structures** | `REVIEW_LABELS` (`:24`), `REVIEW_LABEL_META` (`:39`), `REVIEW_HOLD_LABELS` (`:1225`), the hand-written `hasUnclearedReviewLabel` ladder (`:1206`–`:1209`) |
| Import-and-branch consumers | **13 files** | get the name for free — but 5 carry **enumerated ladders** needing a fourth arm |
| **Hard-coded literal sets that bypass `REVIEW_LABELS`** | **7 files / 17 sites** | would **silently ignore** `review:stale`; this is where the safety bugs land |
| Refusal-**prose** string matching | 1 file / 3 sites | [we:scripts/operations/review-pr-io.mjs](scripts/operations/review-pr-io.mjs) `:191`–`:193` matches `decideSetLabel`'s reason text by prefix |
| Data / contract / catalogue | 4 files | incl. [we:scripts/lib/review-policy.contract.json](scripts/lib/review-policy.contract.json) |
| Test files | **36** | incl. two **powerset** invariant suites |
| Sibling repo | 2 files | the `plateau-app` drain keeps its own copy of the hold vocabulary |

**Honest headline: ~30 production files / ~113 behavioural call sites, plus 36 test files.** Three structural
findings inside that count outlive this decision:

- **The hold set is encoded twice, independently.** `REVIEW_HOLD_LABELS` (`:1225`) is a frozen 3-array; the merge
  gate reads the hand-written if-ladder at `:1206`–`:1209`, which does **not** derive from it.
- **One consumer shadows the canonical export name.** `we:scripts/conveyor/status-board.mjs:64` declares
  `const REVIEW_LABELS = ['review:human', 'review:pending', 'review:changes']`, so a reader grepping
  `REVIEW_LABELS` finds a lie. `we:scripts/conveyor/tick-core.mjs` (`:135`, `:138`) and
  `we:scripts/conveyor/pr-watch.mjs:88` hold three further copies of the hold set.
- **INVARIANT 5 is a powerset test** — `we:scripts/lib/__tests__/gate-invariants.test.mjs:342`–`:395` enumerates
  the powerset of the four labels; a fifth doubles it to 32 subsets.

**Disposition, so this is not a residue:** all three are **inert today** — the ladder and the frozen array agree on
the current four-label set, and the shadowed const lists exactly today's holds. They become defects **only if a
fourth hold label is ever added**, i.e. only under (c). **Not filed as items**, deliberately: with (c) dissolved
they have no trigger, and filing three cards against a rejected branch is the deferral-as-accomplishment failure
[we:docs/agent/backlog-workflow.md](docs/agent/backlog-workflow.md) names. If (c) is ever re-opened (falsifier 3),
they are its first three tasks.

### 2. "the leash split is fail-closed and cannot shrink" is NOT #2840 statute text — citation-scope downgrade

This card (line 59, pre-prep) and #3024 both attribute that sentence to #2840 and use it as the reason (b) needs
ratification. Grepped repo-wide, the phrase occurs in exactly two non-backlog places and neither is a ratified
anchor: it is the **title of a test `describe` block** —
`we:scripts/lib/__tests__/gate-invariants.test.mjs:635`, *INVARIANT 12*, whose own header attributes it to
"#2771/#2785, pinned permanent by #2840 trigger 3". Reading its six assertions rather than its title: they pin the
**roster classification** (every ratified leash basename still in `POLICY_SPEC_BASENAMES`; every policy member
declares a valid leash; the halves partition the policy tier; an unclassified leash falls to HUMAN). **Nothing about
which diff is scored.** Downgraded from *authority* to *supporting context* per the #1932 citation-scope rule.

**But the real anti-shrink rule exists, in production code, and neither this card nor #3024 cited it** — see the
statute-overlap check, `#2390-review-fix`. It is a stronger objection to (b) than the phrase that was quoted.

### 3. Option C's premise is false, and its likely source is a stale docblock in the same function

C says a stale re-park "revokes"/"destroys" the operator's clearance. Part 3 of the gating answer shows it does not:
`review:accepted` survives (`:1178`–`:1186`) and #3039 posts a durable notice. The probable origin of the false
premise is a **contradiction inside `decideReviewGate`'s own docblock**:

- `:1404`–`:1405` — *"The drain drops the now-stale `review:accepted` alongside applying this label."*
- `:1180`, same file — *"…the drain DELETED the accept whenever it re-parked. **It no longer does**."*

The second is current; the first is stale and is what a reader of the stale branch sees. **Not filed as an item** —
it is a two-line comment fix belonging to whoever next touches `decideReviewGate`, and `#3046`/`#3052` both have
that function in `scope`. Recorded here so the next reader does not re-derive C from it.

### 4. This card's own definition of option C is self-contradictory — pinned here

Line 15 (pre-prep) said `review:stale` is "neither operator-only nor agent-clearable"; the option-C section said
"no agent may clear it", which *is* operator-only. The first phrasing is copied verbatim from the `decideReviewGate`
docblock (`:1421`). The coherent reading — **the one prep evaluates, and the only one a ruling could adopt** — is:

> `review:stale` blocks merge; **no agent may write `review:accepted` over it**; it is released either by the
> **drain itself** when `acceptanceCoversHead` re-converges, or by the operator's existing `--to=clear-human`
> ceremony. Not a second human tier — a hold with a *mechanical* release path plus the existing human one.

### 5. #2990's call-site count is wrong, and its scope misses the one bare site

Its Acceptance says the rule "passes on the current tree (**both call sites pass options**)". There are **six**
`hasUnclearedReviewLabel(` call sites — four in [we:scripts/merge-ai-prs.mjs](scripts/merge-ai-prs.mjs) (`:562`,
`:921`, `:1502`, `:2948`, all passing options), one internal at
[we:scripts/lib/review-escalation.mjs](scripts/lib/review-escalation.mjs) `:1243`, and
**[we:scripts/pr-land.mjs](scripts/pr-land.mjs) `:399`, which is bare today**. #2990's rule is scoped to
`we:scripts/merge-ai-prs.mjs`, so it would not fire on the one production site that is actually bare — its
Acceptance holds because of the scope gap, not because the tree is clean. **Disposition: corrected on #2990 itself,
in this PR.** Widening its scope is #2990's own build decision, not a new item.

### 6. CORRECTION TO PREP — prep could not construct a sound "uncovered delta", and the card must say so

Prep's first draft asserted that a **path-set delta** catches the leash-move case #3024 names, which made (b) look
small. Both halves are wrong:

- A path-set over `git diff acceptedSha..headSha` is **not** the contribution delta at all. After a rebase that tree
  diff contains every unrelated change `main` made in between, so it over-parks rather than under-parks.
- The sound-looking construction — the set difference of the two *net-diff* changed-file sets — **misses the hard
  case**. `we:scripts/lib/review-policy.contract.json` is a ratified `POLICY_SPEC` leash file
  ([we:docs/agent/platform-decisions.md](docs/agent/platform-decisions.md) `:3392`) and it is indented JSON. Per
  [#3021](/backlog/3021-the-contribution-fingerprint-still-collides-on-an-intra-sect/), no line in an indented file
  starts at column 0, so its `@@` heading is **empty file-wide** and no relocation inside it is ever distinguished.
  A head advance that adds a README commit *and* relocates a line inside the contract yields a delta of `{README}`,
  a `humanRequired` of false, and a `review:pending` park — **agent-clearable, over a live edit to the declarative
  leash.** Under (a) it parks `review:human`.

So amendment 1 as prep first wrote it (`uncovered == null ⇒ whole-PR score`) guards the wrong failure: the live risk
is not an **absent** delta but a **falsely narrow** one. **(b) has no shaped construction, and prep says so rather
than shipping a sketch.** This is now part of (b)'s cost and part of its un-gate precondition.

### 7. CORRECTION TO PREP — "no branch re-opens #3039" was false; (b) silently kills the revocation notice

Prep filed #3039 under *Supported by default* with the line "no branch re-opens it". Wrong, and wrong in the
direction that matters. `revokesClearance` is **conjoined on `toHuman`**
([we:scripts/lib/review-escalation.mjs](scripts/lib/review-escalation.mjs) `:1423`):

```js
const revokesClearance = !!(toHuman && operatorClearance && !hasReviewLabel(labels, REVIEW_LABELS.human));
```

and the drain gates the notice on it ([we:scripts/merge-ai-prs.mjs](scripts/merge-ai-prs.mjs) `:3283`), whose own
comment states *"on this path `revokesClearance` implies `humanRequired`"*. **(b)'s entire purpose is to make
`toHuman` false on a genuine advance whose delta misses the leash — which is exactly when the notice stops firing.**
So (b), as sketched, silently un-lands the #3039 fix in the one case (b) exists for. A ruling for (b) must re-base
`revokesClearance` on the **accept-drop**, not on `toHuman`. Note also that #3039's own body names the
`review:pending` downgrade as its *rejected* alternative; this card cited #3039 four times and never once as an
argument against (b).

### 8. CORRECTION TO PREP — the #3007 ledger does **not** deliver a durable clearance record today

Prep's draft claimed "point 1 is a fact today: the ledger already preserves the clearance record". **Withdrawn.**
Read in the shipped code, Phase 1's ledger is:

- **Machine-local and disposable** — `~/.claude/verdict-ledger/<owner>-<name>.jsonl`
  ([we:scripts/lib/verdict-ledger.mjs](scripts/lib/verdict-ledger.mjs) `defaultVerdictLedgerDir`), whose own header
  says *"Local-only and machine-disposable … **it never lands on `main`**."* Invisible to any other checkout or
  operator.
- **Fail-soft** — [we:scripts/review-set-label.mjs](scripts/review-set-label.mjs) `:583`: *"FAIL-SOFT ON THE
  LEDGER, DELIBERATELY: a ledger write failure does NOT abort the verdict."* A missed write silently loses the row.
- **Unread** — `we:scripts/lib/verdict-ledger.mjs:473`: *"Nothing calls this today."* No drain-side writer exists.

What survives, and it is still relevant: the ledger's **key choice** is the right precedent. It records the three
digests (`coverage.headSha`, `reviewedDiff`, `reviewedContribution`) as **attributes**, never as the join key,
because keying a merge authority on a defective fingerprint would make a legitimate clearance **unreachable** rather
than merely mis-scored — strictly worse than a false re-park a re-clear repairs. That reasoning generalizes to this
fork: **do not build a gate behaviour on top of the digest until the digest is sound.** It forecloses one shape (c)
might have taken (a `review:stale` tier keyed on digest equality) and it is why (b)'s construction problem in
correction 6 is a blocker rather than an implementation detail.

**Consequence for falsifier 4, stated because it is structural:** `phase2Safe` is
`counts.disagree === 0 && counts.unledgered === 0` (`we:scripts/lib/verdict-ledger.mjs:636`), and Phase 1
deliberately leaves every drain-parked PR `unledgered`. So it is **false by construction** until a drain-side writer
exists, and cannot serve as a live trigger yet.

### 9. The two digest slices are inseverable — re-derived counterfactually

Neutralizing the gap signal alone makes #1106's digests equal but **not** #1100's; neutralizing the heading alone
saves neither; only both together save #1100. So **`#3046` alone would have prevented #1106; #1100 needed `#3046`
and `#3052` together.** The `2026-08-10T01:19:57Z` correction comment on WE PR #1100 attributes it to the heading
alone — that is wrong. This is the umbrella's "three residuals, one promise" constraint with a worked case behind
it: shipping one slice and not the other leaves #1100's shape still re-parking.

---

## Statute-overlap check — the rule each option would codify

Drafted, then grepped against [we:docs/agent/platform-decisions.md](docs/agent/platform-decisions.md).

**(a)** codifies nothing new; a ruling for (a) sets no `codifiedIn`.

**(b)** would codify: *"a satisfied clearance is subtracted before re-scoring."* Two overlaps, and the second is the
one this card had missed:

1. **[#human-is-principle-surface-not-path](docs/agent/platform-decisions.md#human-is-principle-surface-not-path)
   (#2840) trigger 3 — an amendment, not a composition.** The ratified text (`:3460`) keeps every `POLICY_SPEC`
   file human-gated *"as a whole file, **permanently pinned**, because those files ARE the encoded principle and
   **have no behaviour-preserving edit**."* (b)'s premise is that there *is* a behaviour-preserving re-score of a
   POLICY_SPEC file. That amends a permanently-pinned floor; it cannot be discharged by a composition note. If (b)
   is ever ruled, the clause it needs is:
   > *A `POLICY_SPEC` floor already satisfied by a recorded clearance for a given contribution is not re-fired over
   > that same contribution. The floor fires on the first score and on any content the clearance did not cover.
   > Where the covered set cannot be established **soundly**, the whole-PR score stands.*

   The last sentence is a **fail-closed posture**, not an algorithm — the construction stays out of statute.
2. **`#2390-review-fix` — a live code-level anti-shrink guard (b) inverts.**
   [we:scripts/lib/review-escalation.mjs](scripts/lib/review-escalation.mjs) `:426`–`:433`: *"the human gate scores
   over the cumulative basis (a self-declared/mis-set stacked `base` **can never shrink it**)"*, restated at
   `we:scripts/readiness/lane-manifest.mjs:184` and wired at `we:scripts/merge-ai-prs.mjs:3083`,
   `we:scripts/pr-land.mjs:533` and `:856`. Its threat model was that the basis rode the **editable PR body**.
   (b)'s basis rides `parseReviewedSha` / `parseReviewedContribution`, which read **PR comments**
   (`we:scripts/lib/review-escalation.mjs:1060`, consumed at `we:scripts/merge-ai-prs.mjs:3186`–`:3189`) — editable
   by the same population. **(b) is the narrowing that guard exists to forbid, with a new carrier.** This is the
   strongest objection to (b) in the tree, and neither this card nor #3024 had found it.

**(c)** — the #2851 citation prep's draft relied on is **downgraded, not upheld.**
[#human-required-is-judgment-only](docs/agent/platform-decisions.md#human-required-is-judgment-only) says of itself
(`:3412`) that it *"adds no trigger and re-draws no split"* and only draws the judgment-vs-convergent-review
distinction inside #2771's boundary. Its test governs **who clears**, not **how many hold labels exist**. "Never to
a new tier" was prep's phrase, not the statute's, and under correction 4's pinned definition (c)'s mechanical
release arguably *satisfies*
[#deterministic-oracle-clears-slice](docs/agent/platform-decisions.md#deterministic-oracle-clears-slice) rather than
colliding with it. **Downgraded to supporting context.** (c) is dissolved on its false premise and its redundancy,
**not** on statute.

---

## Supported by default — not forks, do not spend judgment here

- **Repairing the digest (`#3054`) happens under every branch.** It is a build, not a branch — and it is **not
  blocked by this card**: `#3046` (`size: 3`) and `#3052` (`size: 2`) carry `parent: "3054"` and **no `blockedBy`
  of their own**, and both appear in `check:readiness --select` today. Only the epic rollup is blocked, and epics
  are not built. Correction 9 is what makes the two slices inseverable from each other.
- **On resolve, two `blockedBy` edges get spliced, mechanically.** Clear `#3054`'s `blockedBy: ["3053"]` — an epic
  should not be blocked by a decision it is the *precondition* of — and set `#3024`'s to `["3054"]`. Prep drafted
  this as a second fork and **withdrew it**: both branches clear the `#3054` edge, and Fork 1's default already
  makes #3024 unbuildable either way, so the branches are behaviourally identical. Bookkeeping, not a ruling.
- **The #3039 revocation notice stays.** It is landed and verified in production — and under (b) it would need
  re-basing (correction 7), which is now part of (b)'s cost rather than a silent regression.
- **A genuinely new leash edit still parks `review:human`** under every branch.
- **The merge-path fail-open** (`#3047`) is orthogonal and separately filed.

---

## Fork 1 — What does a stale-acceptance re-park score, on a genuine head advance?

**Fork-existence justification:** a real either/or. For one PR exactly one label is written by `decideReviewGate`'s
stale branch ([we:scripts/lib/review-escalation.mjs](scripts/lib/review-escalation.mjs) `:1401`–`:1436`), so the
whole-PR score and the delta score **cannot both govern**; they disagree on the same input (the README-commit case
is `review:human` under one, `review:pending` under the other, and those two labels carry **different merge
authority**). Option (c) is carried here because it was proposed as a peer and is **rejected with its strongest case
stated**, not dropped silently.

**Crux — the exact lines.** `score` is computed over the whole PR's changed-file set and reaches the stale branch as
`humanRequired`:

```js
// we:scripts/lib/review-escalation.mjs — :1398 / :1406 / :1424
const fresh = acceptanceCoversHead({ acceptedSha, headSha, acceptedDiff, headDiff, acceptedContribution, headContribution });
if (!fresh.covers) {
  const toHuman = humanRequired || hasReviewLabel(labels, REVIEW_LABELS.human);   // ← the WHOLE-PR score
  const revokesClearance = !!(toHuman && operatorClearance && !hasReviewLabel(labels, REVIEW_LABELS.human));
  return { action: 'park', applyLabel: toHuman ? REVIEW_LABELS.human : REVIEW_LABELS.pending, staleAcceptance: true, revokesClearance, … };
}
```

### (a) Keep the whole-PR score — status quo, fail-closed

**Strongest case:**

- **Two ratified supports, neither previously cited.** `#2390-review-fix` forbids a self-declared basis from
  shrinking the human gate, in production code; #2840 trigger 3 pins the `POLICY_SPEC` floor as a whole file
  "permanently … because those files have no behaviour-preserving edit". (a) is the behaviour both already describe.
- **Its error is fail-closed and self-repairing; (b)'s is fail-open.** A wrong `review:human` costs one re-clear. A
  wrong `review:pending` is agent-clearable, and correction 6 gives a concrete construction under which it fires
  over a live edit to the declarative leash.
- **The harm the alternatives were built to prevent does not occur.** The `review:accepted` label survives the
  re-park and #3039 posts a notice naming the clearer — so the operator's recovery is already a re-confirmation with
  full context, not a blind re-read.
- **It preserves the revocation notice.** (b) suppresses it in exactly its own motivating case (correction 7).
- **Zero cost, zero statute risk, zero blast radius**, against a hole whose measured volume goes to zero when
  `#3054` lands.

**Cost, honestly:** on a genuine head advance it re-gates a human over content that human demonstrably already read.
That is a real tax, it is unbounded in principle, and #3039 made it *loud*, not *absent*.

### (b) Score only the uncovered delta

**Strongest case:**

- **It is the only option that addresses the half of the hole `#3054` does not reach.** (a) tolerates the
  genuine-advance case; (c) renames its label; only (b) changes its verdict.
- **The complaint is real and will recur.** Every genuine advance on a cleared gate-self PR spends an operator turn
  re-reading a diff they signed. Nothing else on the board reduces that.
- **The grain is arguably already ratified.** Two of #2840's three principle-surface triggers are computed
  base-vs-head; (b) only changes which base.
- **It composes forward.** #3007 records `coverage.reviewedContribution` as an attribute on the clearance row, so a
  Phase-2 world makes "what did this clearance cover" a stored field rather than a reconstruction — the construction
  problem in correction 6 gets easier, not harder, over time.

**Costs, honestly — four, and prep could not retire any of them:**

1. **No sound construction exists yet** (correction 6). A path-set delta is the wrong object; a net-diff file-set
   delta misses a relocation inside an indented `POLICY_SPEC` JSON file, because `#3021`'s empty-heading collision
   covers that whole file class. **Amendment: falsely-narrow deltas, not just `null` ones, must fall back to the
   whole-PR score — or contribution-digest deltas over `POLICY_SPEC` paths must be forbidden outright.**
2. **It silently kills #3039's revocation notice** in its own motivating case (correction 7). **Amendment:
   `revokesClearance` must be re-based on the accept-drop, not on `toHuman`.**
3. **It inverts `#2390-review-fix`**, with the basis riding editable PR comments — that guard's exact threat model
   with a new carrier (statute-overlap check).
4. **It amends a permanently-pinned floor** (#2840 trigger 3), so it is a statute amendment, not a composition note
   — and therefore not the small module-local change prep first called it.

### (c) A fourth `review:stale` hold tier — **rejected**

**Strongest case, argued to win** (this is the branch prep finds least attractive, so it is argued hardest, and two
of its legs are ones prep's own draft got wrong in (c)'s favour):

- **It is the only option that closes the class rather than an instance.** (a) and (b) both leave the outcome
  reachable; only a hold that cannot be over-written by an agent makes it *impossible*.
- **The #3007 ledger does NOT rescue the record** (correction 8): home-anchored, never lands on `main`, fail-soft,
  unread, no drain-side writer. Any argument of the form "the ledger already preserves the clearance" is
  unavailable — prep tried to use it and had to withdraw it.
- **The digest fix reduces the rate, not the reachability.** Every direction listed on `#3046`/`#3052` *narrows*
  rather than closes, and "attribute the move to its actor" explicitly "does not cover a producer-lane force-push".
  A mechanism with a permanent residual keeps producing wrong outcomes forever at some rate; only a tier that
  cannot be cleared by an agent is safe *under* a residual.
- **#2851 does not forbid it.** Its own text says it "adds no trigger and re-draws no split"; under the pinned
  definition (correction 4), (c)'s mechanical release arguably satisfies `#deterministic-oracle-clears-slice`. The
  statute pincer prep first asserted is **not** available (statute-overlap check).
- **`phase2Safe` is false by construction** (correction 8), so "labels become display-only" is not a near-term
  discount on (c)'s cost.

**Why prep rejects it anyway — two findings, both budget-independent, neither of them price:**

1. **Its premise is false.** (c) exists to stop the re-park destroying the clearance record. The record is not
   destroyed: `review:accepted` survives the re-park (`:1178`–`:1186`) and #3039 posts a durable notice naming the
   clearer. Both landed, both verified in production. The premise appears to trace to a **stale docblock** at
   `:1404`–`:1405` contradicted by `:1180` in the same file (correction 3).
2. **Its only distinct behaviour fires solely in the case `#3054` removes.** What separates `review:stale` from
   `review:human` is the **mechanical release** — the drain lifting it when `acceptanceCoversHead` re-converges. A
   digest can only re-converge when the contribution never changed, which is precisely the false stale `#3054`
   eliminates. On a **genuine** advance — the case that survives — `review:stale` holds the PR pending a human
   exactly as `review:human` does. So after `#3054`, (c) ≡ (a) plus a label name. That collapse is a property of the
   mechanism, not of the budget, and it holds even with (c) free to build and instantly maintained.

**Explicitly NOT load-bearing in this rejection:** the ~113-site price (correction 1) and the measured volume of 2.
Both are cost/rate arguments. They are recorded because they are true and because they price a re-opening, but a
ratification must not rest on them, and this one does not.

### Default: **(a) — the whole-PR score stands. (c) rejected. (b) is correct in direction and unbuildable as posed.**

(a) is not merely the incumbent: it is the behaviour `#2390-review-fix` and #2840 trigger 3 already describe, its
error is fail-closed, and the harm the alternatives were designed around does not occur.

(b) remains the honest answer to the surviving complaint, and prep says so. But it is **not at Definition of Ready
as a build**, and the ruling should not pretend otherwise. **Three named preconditions, all checkable:**

1. **A sound delta construction exists** — one that does not mis-classify a relocation inside an indented
   `POLICY_SPEC` file (correction 6), demonstrated by a test using real `git diff` text.
2. **`revokesClearance` is re-based on the accept-drop** so #3039's notice survives (correction 7).
3. **The #2840 trigger-3 amendment is authored and ratified on its own decisions-only PR**, per
   [#principle-and-impl-two-pr](docs/agent/platform-decisions.md#principle-and-impl-two-pr) — and reconciled with
   `#2390-review-fix`, which forbids exactly this narrowing today.

Plus the evidence that makes it worth paying for: **one observed stale re-park whose contribution genuinely changed
and whose uncovered content touches no leash path.** That is one operator re-read of already-signed content,
detectable from the drain's own park comment and appendix probe 4b. Note the asymmetry deliberately: one observation
makes the question *live*; it does not by itself authorize amending a permanently-pinned floor — precondition 3 is
its own decision.

**Skeptic: SURVIVES-WITH-AMENDMENT on the answer; three of prep's four supporting legs REFUTED and replaced.** The
skeptic broke, and prep verified in the tree and folded in: (i) "no branch re-opens #3039" — **false**, (b)
suppresses `revokesClearance` (correction 7); (ii) "the ledger already delivers a durable clearance record" —
**false**, it is home-anchored, fail-soft and unread (correction 8); (iii) "a path-set delta catches the leash-move
case" — **false**, with a concrete counterexample over indented `POLICY_SPEC` JSON (correction 6); (iv) the #2851
pincer — **overstated**, downgraded to supporting context. It also surfaced `#2390-review-fix`, a production
anti-shrink guard neither this card nor #3024 had cited, which is now (a)'s strongest support. Two earlier prep
arguments were withdrawn under attack and are recorded rather than deleted: prep's claim that (b) inherits `#3021`'s
false-*honour* residual is **wrong** — a false honour makes `acceptanceCoversHead` return `covers: true`, so the
stale branch never runs and the PR **merges**; that is a pre-existing (a) hole, identical under (b). And prep's line
that a false honour "produces revocations forever" was a category error: `#3021` is the *collision* direction, which
produces a wrong **merge**, never a revocation. What survived every attack is the **direction** of the default: (a).

**Screen: flagged(prio) → fixed by re-grounding (c)'s rejection and withdrawing the drafted second fork.** The
fresh-context screen ruled the (a)-vs-(b) split **clear on merit** — it verified against `:1400`–`:1443` that the
two branches write different labels with different merge authority on the same input, and noted the fork gets *more*
live under an infinite budget, not less, since budget gives the drain the clone that would otherwise force (b)'s
fail-closed fallback. It **flagged (c)'s rejection as prioritization in costume**: prep's original three grounds led
with volume (a rate) and price (a cost), and applied the rate argument asymmetrically — (b) also has zero observed
instances and was kept live. Fixed above: (c) is now rejected on its false premise and its budget-independent
collapse into (a), with price and rate explicitly marked non-load-bearing. The screen also **refuted prep's drafted
second fork** as a conditional no-op resting on a false claim (that `#3046`/`#3052` were gated by this card — they
are in the ready pool today); it is withdrawn to *Supported by default* as a mechanical splice, and its real content
— that a downgrade must never be computed from an unsound fingerprint — is now precondition 1 on (b), which is a
permanent rule rather than an edge that evaporates on resolve. Q1 (impl detail vs standard side) **not applicable**:
the subject is this repo's own merge machinery, not a published web standard — the same finding as #3013. The
screen's one Q1 residual is applied: the fail-closed fallback is stated as a **posture** in the draft statute
clause, not as a code contract.

---

## Screen result on the fork as filed — read this before ruling

The card was filed as a three-way reconciliation between three live options. After prep it is neither three-way nor
mostly a decision:

- **(c) is not a branch.** Its premise — that a re-park destroys the clearance record — is false in the tree today,
  and its only distinct mechanism fires only in the case `#3054` removes. Recorded with its strongest case (which
  prep's own errors had *understated*) so the rejection is visible rather than silent.
- **(a) vs (b) is a genuine either/or on merit** and survives the infinite-budget screen. Its answer is (a), and
  (b) is not buildable as posed.
- **The second fork prep drafted was withdrawn** as a conditional no-op.
- **What is genuinely left for the operator is one ratification** — (a) stands, (c) is closed, (b) is directionally
  right behind three named preconditions.

**So the honest summary is: this is mostly not a decision. It is "fix the digest, and stop believing a stale
comment."** The one thing that does need a human is closing (c) — a rejected option that is never ruled comes back,
and this card exists precisely because #3039's deferral of (c) was never filed.

---

## Recommendation — mine, not a ruling, and rejectable

**Fork 1 → (a). (c) rejected and closed. (b) kept open in direction only, behind three named preconditions plus one
observation.**

I record the path, because it moved twice. I recommended **(b)** before running the census, on the reasoning that
`#3054` never reaches the genuine-advance case. The census moved me to (a)-as-a-not-yet on weak evidence (zero
observed instances over a two-day-old mechanism). The **skeptic** then broke three of the four legs that
recommendation stood on and, in the process, made (a) *stronger* than either version — because `#2390-review-fix`
and #2840 trigger 3 already describe (a), because (b) silently kills the #3039 notice, and because the clearance
record was never being destroyed in the first place. So the final recommendation rests on **statute and code**, not
on N = 2.

The card also invited a tentative inversion to **(c)** if a substantial residual survived. A residual does survive,
but it is not (c)'s residual: (c) was aimed at a record-destruction that does not happen. The inversion the card
invited runs to **(b)**, and then stops on buildability.

**The honest cost of my recommendation:** the operator keeps paying a false re-clear until `#3054` lands, and then
keeps paying a *true* re-clear on every genuine advance, indefinitely, because (b) has no shaped construction and I
am not recommending one be improvised.

**What would falsify this** — each concrete and checkable:

1. **The genuine case turns out to be common.** Appendix probe 4b classifies the 24 pre-#1119 re-parks and the 7
   undetermined ones by *cause* (drain rebase vs author push) — a property of the commits, not of the digest, so the
   method works across mechanisms. If author-caused re-parks are routine, (b)'s preconditions become urgent work
   rather than a gate. Prep ran the post-#1119 classification and reports the pre-#1119 classification as an **open
   measurement**, not as a settled zero.
2. **A sound delta construction is found.** Correction 6 is an absence-of-proof, not a proof-of-absence. A
   construction that handles indented `POLICY_SPEC` files retires (b)'s largest cost, and then (a) is holding only
   on precondition 3.
3. **`#3054` proves unfixable without a tolerance threshold** — a direction all three slices list and all three flag
   as an attack surface. Then the residual is permanent, (c)'s "safe under a residual" argument regains force, and
   **(c) should be re-opened at its real price** (correction 1's ~113 sites and three latent defects are its first
   tasks). A rejection with a named re-open trigger is still a rejection, not a park — nothing waits on it.
4. **The stale docblock turns out to be the current behaviour** and `:1180` is the stale one. Then the clearance
   label really is deleted on re-park, (c)'s premise is restored, and this ruling should be re-taken. Checkable in
   one read of [we:scripts/merge-ai-prs.mjs](scripts/merge-ai-prs.mjs)'s label-swap path.

---

## Measurement appendix — re-runnable

```bash
# 1. blast radius of a 4th label — the two tiers, counted separately (correction 1)
grep -rl 'REVIEW_LABELS' scripts/ --include=*.mjs | grep -v __tests__ | wc -l        # 13 — the "~10 consumers" figure
grep -rl "'review:human'" scripts/ src/ --include=*.mjs | grep -v __tests__ | wc -l  # 7  — the hard-coded tier it misses
grep -n 'REVIEW_HOLD_LABELS\|hasUnclearedReviewLabel' scripts/lib/review-escalation.mjs   # the double encoding

# 2. the bare call site #2990's scope cannot see (correction 5)
grep -rn 'hasUnclearedReviewLabel(' scripts/ --include=*.mjs | grep -v __tests__     # 6 sites; pr-land.mjs:399 is bare

# 3. the two provenance checks (corrections 2 and 3)
grep -rn 'cannot shrink' docs/agent/platform-decisions.md scripts/lib/__tests__/gate-invariants.test.mjs
sed -n '1178,1186p;1404,1405p' scripts/lib/review-escalation.mjs   # ":1180 It no longer does" vs ":1404 The drain drops"

# 4. the stale-re-park population, all-time
gh api repos/chalbert/web-everything/issues/events --paginate > events.json   # 4,476 label events, back to 2026-07-02
#   accept→park transition = `labeled review:accepted` then `labeled review:human|pending|changes` before re-accept
#   a STALE re-park additionally carries a drain-park-reason comment reading "review:accepted is STALE"
#   2026-08-10 result: 35 transitions · 2 post-#1119 (both FALSE) · 24 pre-#1119 · 2 not stale · 7 undetermined

# 4b. FALSIFIER 1 — classify every event by CAUSE, which is mechanism-independent (NOT yet run for pre-#1119)
#   for each transition, read the `committed` events between the two labels and classify the messages:
#   `drain: …` => DRAIN (mechanical);  anything else => AUTHOR (the case option (b) exists to fix)
#   for each AUTHOR event, `gh api repos/chalbert/web-everything/commits/<sha>` and check the file list
#   against the POLICY_SPEC basenames in scripts/lib/gate-config.mjs

# 5. digest divergence + the per-signal counterfactual (correction 9)
git diff $(git merge-base <mainTip> <head>) <head>        # accept-time and post-rebase, then compare projections
#   neutralize the gap alone, the heading alone, then both — #1106 needs one, #1100 needs both
```

---

## Related

[#3024](/backlog/3024-a-stale-acceptance-re-park-re-asserts-review-human-from-the-/) (the build side of option (b) —
`blockedBy` this item today; on resolve it becomes `blockedBy: ["3054"]`),
[#3054](/backlog/3054-the-acceptance-coverage-digest-re-parks-a-cleared-pr-whose-c/) (the false-stale umbrella,
`blockedBy` this item today; that edge is cleared on resolve) with slices
[#3046](/backlog/3046-a-stale-acceptance-re-park-fires-on-an-unchanged-contributio/),
`#3052`, [#3021](/backlog/3021-the-contribution-fingerprint-still-collides-on-an-intra-sect/) and
[#2884](/backlog/2884-acceptance-coverage-keys-on-head-sha-identity-so-a-no-op-reb/),
[#3007](/backlog/3007-make-the-review-verdict-ledger-the-merge-authority-labels-be/) (the ledger — Phase 1 landed
2026-08-10; correction 8 is what it does and does not deliver),
[#3039](/backlog/3039-drain-re-hold-must-never-silently-revoke-an-operator-review-/) (where option (c) was deferred
and never filed; its notice is load-bearing for this ruling, resolved),
[#2990](/backlog/2990-check-standards-rule-every-hasunclearedreviewlabel-call-site/) (corrected in this PR),
[#3013](/backlog/3013-rule-the-safety-model-for-routine-merges-detect-and-revert-n/) (the sibling ruling whose
statute-collision method is reused here),
[#2390](/backlog/2390-per-item-review-diff-score-review-a-stacked-pr-on-base-head-/) (whose review fix is the
anti-shrink guard (b) inverts),
[#3023](/backlog/3023-a-drain-re-score-revokes-a-human-clearance-a-content-preserv/),
[#2840](/backlog/2840-human-principle-not-implementation-narrow-gate-self-from-pat/),
[#2771](/backlog/2771-narrow-the-review-human-escalation-criteria-implementation-m/),
[#2409](/backlog/2409-gate-check-a-pr-s-reviewed-commit-set-must-match-its-head-be/).

### Review jury (provisional — pre-registered #2638)

Care level: `high`. This jury binds against the item's predicted scope and is re-checked against the real diff at PR open.

| juror | lens | grounding method | pre-registered expectation |
| --- | --- | --- | --- |
| correctness#1 | correctness | static-review | The change does what the spec says with no behaviour regression — every changed branch is exercised, and no test is missing, weakened, or gamed to pass while the behaviour is wrong. |
| correctness#2 | correctness | static-review | The change does what the spec says with no behaviour regression — every changed branch is exercised, and no test is missing, weakened, or gamed to pass while the behaviour is wrong. |
| security#1 | security | static-review | No untrusted input, secret, auth, or file/network path is left unguarded and the trust boundary is not widened — anything touching those earns an explicit security check. |
| security#2 | security | static-review | No untrusted input, secret, auth, or file/network path is left unguarded and the trust boundary is not widened — anything touching those earns an explicit security check. |
| simplicity#1 | simplicity | static-review | The change is the smallest one that solves the problem — it reuses what already exists and adds no dead code or needless abstraction. |
| simplicity#2 | simplicity | static-review | The change is the smallest one that solves the problem — it reuses what already exists and adds no dead code or needless abstraction. |
| standards-conformance#1 | standards-conformance | static-review | The change follows this repo's conventions and platform-native defaults, and does not diverge from a ratified standard or placement rule. |
| standards-conformance#2 | standards-conformance | static-review | The change follows this repo's conventions and platform-native defaults, and does not diverge from a ratified standard or placement rule. |

**Predicted touch-set (#2619)**, sliced per child so the children do not serialize on each other:

- **The edge splice at resolve** — `we:backlog/` frontmatter only (`#3024`, `#3054`). Mechanical.
- **#3024 (option (b)), only if all three preconditions are met** — `we:scripts/lib/review-escalation.mjs`,
  `we:scripts/lib/__tests__/review-escalation.test.mjs`.
- **Precondition 3's statute amendment** — `we:docs/agent/platform-decisions.md` only, on its own decisions-only PR
  per [#principle-and-impl-two-pr](docs/agent/platform-decisions.md#principle-and-impl-two-pr).
</content>
