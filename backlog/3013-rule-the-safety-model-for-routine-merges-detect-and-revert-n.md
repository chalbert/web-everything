---
bornAs: xzrs9xf
kind: decision
size: 3
status: open
dateOpened: "2026-08-08"
preparedDate: "2026-08-09"
relatedTo: ["2948", "2830", "2820", "2979", "3007", "2563", "2838", "2840", "3021", "3024", "3039"]
relatedReport: reports/2026-07-18-blast-radius-advisory-review-gating.md
tags: [governance, review-integrity, drain, throughput, statute-candidate]
---

# Rule the safety model for routine merges: detect-and-revert, not prevent-everything

> **RULED 2026-08-09 (operator, in session), Fork 2 → (c): the irreversibility criterion becomes DATA in the
> review-policy contract, computed from the DIFF, fail-closed.** Ruled in the words *"3013 Fork 2 ratified"*,
> on the prepared default. #2563 point 3's always-review blacklist is ratified and **unpopulated**; this
> populates it. It is data, not a new rubric term — **no new anchor, no new hold tier, and no path gating in
> `we:scripts/lib/review-escalation.mjs`**, which #2840 cleaned of exactly that on 2026-08-02.
>
> **What is ratified is the four classes plus the fail-closed default — never the regexes.** The regexes are
> illustrative and must be replaceable without a re-ruling. The four classes, each grounded in a verified case:
> 1. **Unattended execution** — PR #1113: the converge daemon self-updates by `reset --hard origin/main` every
>    15 minutes, so anything landing on `main` that touches it executes unattended within 15 minutes.
> 2. **Writes outside version control** — PR #1101 (board state), PR #1068 (pool + agent memory): a revert
>    restores the code and none of the data.
> 3. **Publishes or pushes externally** — undoing needs a history rewrite.
> 4. **Adds a destructive git operation** (`reset --hard`, `clean -fd`, `push --force`, branch delete) — PR
>    #1120 records a real 2026-08-08 incident of exactly this at the primary checkout.
>
> **FAIL CLOSED is part of the ruling, not an implementation note.** `diffHunks` is genuinely `null` when the
> drain has no local clone (documented fallback in `we:scripts/merge-ai-prs.mjs`). **Absent diff ⇒ not
> routine.** Prep's own first draft returned "routine" for anything unmatched — the identical fail-open this
> fork rejects branch (b) for — and the polarity was corrected before ruling.
>
> **This predicate is a fail-closed FLOOR, never a complete taxonomy.** The skeptic named a real fifth class
> it misses — **weakening a schema validator** (the PR #1096 shape: an ordinary logic defect silently
> corrupting version-controlled content, where everything corrupted while the guard was weak stays corrupt
> after the revert). That class is already governed by
> [#agent-convergence-independent-validation](docs/agent/platform-decisions.md#agent-convergence-independent-validation)'s
> coverage-drop and test-tampering clauses, so any statute text must **cite and compose with #2398 rather than
> silently narrow it**.
>
> **Both forks are now ruled.** The item remains `open` for one reason only: `codifiedIn` is blocked on the
> four statute collisions below. It is not awaiting further judgment.
>
> **RULED 2026-08-09 (operator, in session), Fork 1 → (a): prevention stands. No routine tier.**
> No PR merges with its review hold unsatisfied. The operator ruled on the presented preparation, in the
> words *"3013 keep prevention"*, after being shown that prep's own recommendation had **reversed** during
> preparation and why.
>
> **The warrant for this ruling is the collapse of the cost premise, not a claim that reverts fail.**
> Reverts mostly work — 73% of recent merges revert cleanly on code, and the "23 of 30 fail" figure prep
> first produced was a 3× artifact of #2288 rename collisions in `backlog/*.md`, corrected before ruling.
> What went away is the *reason to accept the risk*: all-time p90 open→merged is **4.0 hours**, not the 77
> hours the filed premise asserted, and there was **one open PR** when measured. The 77-hour figure was the
> open→merged time of a single PR (#1034) occupying the p90 rank slot of a trailing-100 window that lands on
> the 2026-08-08 backlog flush; it appears nowhere in the repo except the premise asserting it. A routine
> tier buys throughput. There is no throughput problem to buy. Taking on a new failure mode to unblock a
> queue that is not backed up is a bad trade at any revert cost.
>
> **The second leg: tests do not make these catches.** PR #1113 shipped a daemon that, with
> `CONVERGE_DAEMON_CLONE` pointed at a pooled lane clone, would have run `git reset --hard` + `git clean -fdq`
> over a live session's working tree every 15 minutes — and whose documented uninstall reported success
> without checking `launchctl bootout`'s exit status, so the kill switch lied. Suite **30/30 green**,
> `check:standards` exit 0, on the defective head. No revert restores destroyed uncommitted work. PR #1124
> was **540/540 green with its delivery path gutted**. PR #1096 landed a 0-byte blob on `main` at exit 0 and
> took ~30 days to root-cause. The pattern the audit branch cannot answer: **detect-and-revert has no
> detector for a non-event.**
>
> **What this ruling does NOT say.** It does not endorse the current gate's defects, which are real and are
> separately filed: the merge-path fail-open (`#3047`), the false-stale re-park on an unchanged
> contribution (`#3046`), and the #2288 rename artifact that makes reverts look worse than they are.
> It does not rule Fork 2 — see below. It is **revisitable on a measurable trigger**, not on a vibe: if the
> queue backs up the way it did 2026-08-04→08, re-run the measurement appendix and reopen this.
>
> **Honest cost, accepted knowingly:** the operator stays first reader on every hold until #3007 lands.
> The ratified throughput path is #3007 → #2838's triple gate — **build it rather than routing around it.**
>
> **No `codifiedIn` yet.** Prep found four statute collisions that must be resolved before any statute text
> is written — see *Statute collisions* below, in particular #2840, which ratified path gating **out of**
> `we:scripts/lib/review-escalation.mjs` on 2026-08-02, and `enforceFlipReady`, which the statute names but
> which **does not exist in the tree**. Fork 2 is also still open and the statute text depends on both.

Rule what `main` is allowed to cost. The filed premise was that a bad routine merge costs one revert while a
stalled queue costs the week. Prep re-derived both halves. The **cost** half collapsed: all-time p90 open→merged
is 4.0 hours, not 77, with one open PR when measured. The **revert** half held up better than prep's own first
probe said — 73% of recent merges still revert cleanly on code. The fork stays open, but its warrant moved: a
routine tier can no longer be justified by throughput, nor refused because "reverts don't work here."

## Corrections — including one to prep's own first measurement

Every figure was re-derived. Where a claim did not survive, the correction stands and the original is withdrawn.
**Corrections 9–11 correct prep's own earlier numbers**, caught by the skeptic pass and re-verified independently.

1. **"90th-percentile open→merged is 77 hours" is withdrawn — it does not reproduce.** The string `77 hour`
   appears nowhere in this repo except this card; no report, script, or measurement stands behind it. Over the
   full census of 1,078 merged PRs: **all-time p90 = 3.99 h**, p50 = 0.13 h, max = 425 h. 77.09 h is not a
   percentile boundary — it is the exact open→merged time of **one PR, #1034** (created `2026-08-04T21:52:32Z`,
   merged `2026-08-08T02:57:44Z`; confirmed by direct API read), sitting at the p90 rank slot of a *trailing-100*
   window that lands on a one-time backlog flush (35 PRs merged 2026-08-08 between 02:19Z and 19:59Z, ~11 of
   them after 109–148 h waits). Move the window and the number moves 10×: last 24 h → 13.6 h; last 7 d → 30.3 h;
   **last 7 d excluding the flush → 7.8 h**; all-time → 4.0 h.
2. **The honest cost figures.** PRs carrying any `review:*` label: all-time **p90 = 10.2 h** (n=443); last 7 days
   **p90 = 109.5 h** (n=76). Worst real wait **148.4 h** (PR #984, confirmed). Cite these with their window.
3. **The queue was empty when measured** — exactly one open PR (#1125). "A stalled queue costs the whole week"
   described the 2026-08-04→08 backlog, not a standing condition.
4. **The review label goes on at PR open**, so open→merged *is* review wait by construction (median 100%,
   timeline sample n=18). The card's "all of it review wait" clause holds — and proves less than it sounds,
   since there is no separate hand-off phase to remove.
5. **"Revoked the operator's decisions twice" — verified, but not "silently" both times.** #1106 fully verified.
   #1100's 12:20 re-park was **not silent**: the #1124 notice fix merged 30 minutes earlier
   (`2026-08-09T11:50:31Z`) and posted a full revocation notice 2 s after the re-label. #1100 *does* carry an
   earlier genuinely-silent pair — cleared `2026-08-08T14:38:35Z`, re-parked `14:41:42Z`, no comment for 20 h 28 m.
6. **"Only because of the drain's own rebase" — right in cause, wrong in mechanism.** The moving commits are
   **merge commits**, not rebases; the reviewed tip stays an ancestor, and GitHub logged no
   `head_ref_force_pushed` on #1106 at all. "Rebase" is the drain's own commit-message wording.
7. **Nobody can prove the operator cleared anything.** Every event on both PRs carries `actor.login = "chalbert"`,
   `actor.type = "User"`, `performed_via_github_app = null` — **the API cannot distinguish the operator from the
   drain**; both run under one token, and the clearance comments say so. Load-bearing: a ledger-recorded verdict
   (#3007) inherits the same gap.
8. **"Three individually stuck items" is overstated on all three** — see *Why this is (partly) one ruling*.
9. **CORRECTION TO PREP — the "23 of 30 merges don't revert cleanly" figure was true but 3× misleading.** Prep's
   first probe omitted `git clean -qfd` between attempts and did not classify the conflicts. Re-run properly, the
   30 most recent merge commits split **3 clean / 19 conflicting *only* in `backlog/*.md` / 8 conflicting in real
   code**. The 19 are `rename/delete` collisions caused by the drain's own JIT-renumbering of backlog cards at
   land (#2288) — **a fixable tooling artifact, not a property of the codebase**. The honest code-revert failure
   rate is **8/30 (27%)**, so **73% of merges do revert cleanly**. Every default below was re-derived against
   the corrected figure.
10. **CORRECTION TO PREP — there is no clean-revert "window", and the ~11-hour bound is withdrawn.** Cleanliness
    is not monotone in age: the **newest** merge on `main` (`7140bc41`) conflicts, while positions 2, 4 and 10
    are clean. It is a function of whether a later land renamed the same files, not of elapsed time. The
    derivation was also unit-wrong — it divided a *merge-commit* count by an *all-commit* velocity. The correct
    merge rate is **2.05 merges/hour** (30 merges spanning 14.61 h).
11. **CORRECTION TO PREP — "one revert commit since 2026-06-01" is wrong; there are three.** `46d10883`
    (2026-06-21, a tooling gate), **`1f87ecff`** (2026-07-02, `revert(#1137): drop single-repo auto-deploy` — a
    revert of a *landed defect*), and **`aa30afec`** (2026-06-19, `revert: reopen #1103 — premature ratification`
    — a revert of a *landed statute ratification*). So **"the detect-and-revert muscle has never been trained" is
    refuted**: it has been used, including on the irreversible-class content Fork 2 would hold back.

## What prep verified, and how

| claim | verdict | how |
|---|---|---|
| #1106 cleared `00:34:00Z`, re-parked `00:41:28Z`, drain-only head move, byte-identical contribution | **VERIFIED** | `gh api …/issues/1106/timeline --paginate`; both patches 1,823 lines; all 1,483 `+`/`-`/`diff --git` lines byte-identical (`cmp` clean); only 7 lines differ, all `index` headers and `@@` numbers (+15 / +4) |
| #1100 cleared `12:20:05Z`, re-parked `12:20:57Z` (52 s), same cause | **VERIFIED (2026-08-09)** | same method; drain merge commit `e6511618`; 1,485 `+`/`-` lines byte-identical despite two auto-resolved files |
| …and it was silent | **REFUTED for #1100** | explicit revocation notice at `12:20:59Z` |
| Digest embeds inter-hunk gaps, invariant only under uniform displacement | **VERIFIED in code** | [we:scripts/lib/review-escalation.mjs](scripts/lib/review-escalation.mjs) `normalizeContributionFingerprint`, docblock lines 891–893 |
| Merge-path fail-open in the same module | **REPRODUCED** | driving the real module, an *empty* comment list and an unreadable head **both** yield `{action:'merge'}` on a `review:accepted` PR. Note it is a **documented #2409 design choice**, not a hidden bug — the docblock says "fails OPEN"; filed as `#3047` |
| Eight code paths change a review label with no comment | **PARTIALLY — "eight" not reproduced; five raw sites confirmed** | raw `gh pr edit --add-label <review:*>` sites bypassing the commenting ceremony: [we:scripts/merge-ai-prs.mjs](scripts/merge-ai-prs.mjs) 3118, 3149, 3272 and [we:scripts/pr-land.mjs](scripts/pr-land.mjs) 873, 933, ~~plus a `--remove-label review:accepted` at ~3314~~ — **that site does not exist** (verified 2026-08-12 during the #1160 review): the text at that line is a *comment*, and no `--remove-label review:accepted` exists anywhere in the drain. It was additive to the count, so "at least five raw sites" and the ruling resting on it are unaffected. The two land seams route through `decideSetLabel`, which *does* comment. **Cite "at least five raw sites", not "eight".** |
| `enforceFlipReady` (the #2838 predicate) exists | **REFUTED — it does not exist** | grep of the tree: only `computeAgreementMetric` / `resolveLandMode` in [we:scripts/lib/decision-routing.mjs](scripts/lib/decision-routing.mjs). The composed predicate and its two CI probes are unbuilt, as #2838's own "separate impl follow-on" clause says |
| 137,799-byte / two-line #1106 measurement | **unreplicated, carried as such** | recorded on `#3046` (PR #1125) as review-sourced, not script-produced. Prep's independent diff agrees in *shape* only |

## Statute collisions prep found — resolve these before any `codifiedIn`

The skeptic pass found this decision sits on turf **already governed by four ratified anchors**. Two of them
break a branch outright. This section is the most important thing prep produced.

1. **`#human-is-principle-surface-not-path` (#2840, ratified 2026-08-02) forbids the obvious Fork 2
   implementation.** Its title is literally *"`review:human` fires on a principle surface, **not on a
   trust-chain file path**,"* and its lineage names what it removed: *"Current mechanism it replaces:
   `we:scripts/lib/review-escalation.mjs#isGateSelfPath`, `we:scripts/lib/gate-config.mjs#isPolicyCorePath`."*
   Adding a new **path-glob** gating term to that same module — the first shape prep drafted — reinstates the
   mechanism #2840 ratified out, seven days later. Fork 2 is rewritten around this.
2. **`#enforce-flip-triple-gated` (#2838, ratified 2026-08-02 — six days before this card opened) already rules
   the "mechanize the clearer" branch.** It states the scheduled runner may clear `review:pending`
   **mechanically** once `landMode` flips, gated on three named conditions. A #3013 anchor restating that would
   be a duplicate. Note also its **scope**: #2838 governs `review:pending` only. `review:human` stays human by
   #2840/#2771, so no branch here can "mechanize the hold universally."
3. **`#human-required-is-judgment-only` (#2851) is a pincer on any new script-decidable hold.** Its test:
   *"does clearing this require a **new** call a person alone can make?"* A script-decidable irreversibility
   term is mechanical by definition — so routing it to `review:human` violates #2851 and #2771, and routing it
   to the committee makes it `review:pending`, which already happens. A new hold tier is therefore not available
   cheaply.
4. **`#blast-radius-advisory-care-not-a-gate` (#2563) is narrower than this card first cited it.** Prep's first
   draft leaned on its "post-land audit sample" clause as authority. Reading the anchor's own scope: (i) the
   clause sits inside **point 3, whose subject is *high-blast* auto-lands**, not the routine tier; (ii) the audit
   is offered as a way to satisfy a *"non-zero decorrelated **human** axis"*, so an unattended script does not
   discharge it; (iii) its trigger is *"enabled when throughput outgrows manual watch"* — **which correction 1–3
   show is not met**; and (iv) "sample" names a *coverage* fraction, not a latency bound. **Downgraded from
   authority to supporting context**, and the card no longer claims the audit is pre-authorized for this tier.
   What #2563 *does* already provide and this card should reuse: point 1 (scored signals are advisory, not
   gates) and point 3's **always-review file blacklist**.

## Supported by default — not forks; do not spend judgment here

- **Hard prevention stays on the operations the card names** — backlog numbering, branch deletion, pushes to a
  constellation `main`. No branch touches them.
- **Statute and the declarative leash stay human-gated** (#2771, #2840). Both branches agree.
- **The audit's latency bound is a config dimension, not a fork** *(a `## Fork 3` was drafted and dissolved
  here — both skeptics and the screen independently rejected it)*. What is **forced**, and needs no weighing: an
  audit without a bound whose breach escalates is a report, not a control. What is **config**, by direct analogy
  to [#build-lane-self-review-non-zero-floor](docs/agent/platform-decisions.md#build-lane-self-review-non-zero-floor)
  point 4 ("depth above the floor is a config dimension, not a fork"): the bound's value, which belongs in
  [we:scripts/lib/review-policy.contract.json](scripts/lib/review-policy.contract.json) beside the existing
  `careJury.disposition.landMode`. And correction 10 shows a *commit-count* bound is the wrong shape anyway —
  the only sound predicate is **attempt the revert; if it does not apply cleanly, escalate point-level** per
  #2563 point 3's delivery form (never a blanket whole-PR escalation).
- **The merge-path fail-open is a build, not a fork.** Reproduced, filed as `#3047`; its option set is
  already written there. Fixing it is orthogonal to which branch is ruled.

## Why this is (partly) one ruling — the card's claim, corrected

The card says #2830, #2948 and #2979 are each stuck on this question. **Two are not:**

- **#2830** (`active`) shipped its SHADOW half; its enforce flip is governed by the already-ratified
  [#enforce-flip-triple-gated](docs/agent/platform-decisions.md#enforce-flip-triple-gated), whose third condition
  is a durable ledger — that is **#3007** (`open`), unbuilt. #2830 is blocked on a **build**, not on this question.
- **#2948** (epic, open) explicitly scopes *around* it: *"Routing and clearance. Care level stays advisory …
  this epic changes how hard the jury looks, never who clears the merge."* Its slices (#2947, #2950, #2949,
  #2951) stay buildable either way.
- **#2979** (`active`) has a genuine connection and is not stuck — largely **landed** (PR #1086; PR #1119 merged
  `2026-08-08T23:09:39Z`). Live residuals: #3021, #3024, `#3046`.

The honest leverage claim: **this ruling settles the shared premise that #3024, `#3046` and `#3047` will
each otherwise re-argue** — how much staleness-detection error is tolerable and in which direction it should
fail. Real leverage; not the leverage the card advertised.

---

## Fork 1 — May a routine tier exist: does any PR merge with its review hold unsatisfied?

**Fork-existence justification:** a genuine either/or that no ratified anchor settles. For one PR the drain
either refuses the merge until a verdict satisfies the hold or it does not; the two cannot both govern, and the
composability probe fails (the care dial varies *how hard* review looks — `deriveCareLevel` /
`panelRigorForCareLevel` — but rigor and clearance are different axes). #2838 ruled *who may clear a hold*; it
never ruled *whether a hold may be skipped*. That residue is this fork.

**A third branch was drafted and withdrawn.** Prep initially offered "(c) keep the hold, mechanize who satisfies
it." Both skeptics refuted it as a rebrand: #2838's own arming condition requires *N consecutive shadow-vs-human
agreements*, so (c) **requires running (a) for N PRs before it can differ from (a)** — and its preconditions are
#3007 (`open`), `enforceFlipReady` (**does not exist**) and #2946 (`status: open`, **`tier: someday`**,
`blockedBy: ["2945"]`). It also duplicates a six-day-old anchor. It is recorded below as a **sequencing note**,
not a branch.

**Crux.** [we:scripts/lib/review-escalation.mjs](scripts/lib/review-escalation.mjs) `decideReviewGate` (line 1367):
any unsatisfied `review:*` hold returns `action:'park'`.

- **(a) Prevention stands — no routine tier** *(the card's Option 2)*. **Strongest case:**
  - **The cost premise is gone.** p90 = 4.0 h all-time, 10.2 h for review-labelled PRs, one open PR. The 77-hour
    figure that justified the trade was a window artifact of a single PR.
  - **Tests do not make these catches.** PR #1113: `CONVERGE_DAEMON_CLONE` pointed at a pooled lane clone would
    have run `git reset --hard` + `git clean -fdq` on a live session's tree every 15 minutes, and the documented
    uninstall reported success without checking `launchctl bootout`'s exit status — the kill switch lied. Suite
    **30/30 green**, `check:standards` exit 0 on the defective head. No revert restores destroyed uncommitted work.
  - **27% of merges still do not revert cleanly on code** (correction 9), and the 8 that fail cluster in exactly
    the hot review-machinery files — [we:scripts/merge-ai-prs.mjs](scripts/merge-ai-prs.mjs),
    [we:scripts/lib/review-escalation.mjs](scripts/lib/review-escalation.mjs),
    [we:scripts/review-set-label.mjs](scripts/review-set-label.mjs) and
    [we:docs/agent/platform-decisions.md](docs/agent/platform-decisions.md). The files most likely to be called
    routine are the ones least likely to revert.
  - **Silence has no detector.** PR #1124 shipped its whole operator-visible delivery path untested — reverting
    [we:scripts/merge-ai-prs.mjs](scripts/merge-ai-prs.mjs) to `main` left **540/540 green**. PR #1096's
    `rebaseDropContent` wrote a **0-byte blob** for the #2309 card on `main` (`adf2d758`, 2026-07-09) at exit 0;
    root cause was not found until **2026-08-08, ~30 days later**, and two further instances were caught only
    because the emptied file happened to have a schema validator. A detect-and-revert model detects failures,
    not absences.
  - **#2563's audit clause cannot currently backfill the oversight it would remove** — collision 4: its trigger
    ("throughput outgrows manual watch") is unmet by this card's own numbers.

- **(b) A routine tier with post-merge audit** *(the card's Option 1)*. Routine PRs merge on required `test`
  green + one review pass + a ledger verdict (#3007); no re-review after content-identical rebases (#2979); an
  audit files or reverts. **Strongest case, argued to win:**
  - **Reverts work here more often than prep first said, and have actually been used.** 73% clean on code
    (correction 9), and three real reverts since 2026-06-01 — including `aa30afec`, a revert of a **landed
    premature statute ratification**, i.e. the exact irreversible class (a) says must be held (correction 11).
  - **19 of the 23 conflicts are a drain artifact** (#2288 JIT-renumbering), fixable by resolving `backlog/**`
    renames in the revert. The permanent-looking obstacle is largely self-inflicted.
  - **Content landing under (b) has been reviewed.** The window (b) opens is over the *post-rebase delta*, and
    #1106/#1100 establish those deltas were byte-identical. The safety gap is narrower than "unreviewed on main."
  - **The prevention machinery already fails open on the merge path** and produces false re-parks that cost real
    operator turns.
  - Every strong catch above was made by **an independent agent reading the diff** — not a human, not CI. That
    reviewer runs equally well after the merge.

**Default: (a) — prevention stands; no routine tier is created by this ruling.** Not because reverting is
impossible (correction 9 withdraws that), but because **(b)'s warrant was throughput and the throughput crisis
does not exist**, while the oversight #2563 requires cannot yet be discharged by anything but the operator's
direct reading. **Sequencing note, not a branch:** the throughput path is already ratified — build #3007, arm
#2838's triple gate, and revisit (b) if a re-run of the appendix shows the audit's own trigger condition
actually met. Ruling (a) should therefore set `codifiedIn:` **to the existing
[#enforce-flip-triple-gated](docs/agent/platform-decisions.md#enforce-flip-triple-gated) anchor rather than
authoring a new one** — collision 2.

```js
// (a) — decideReviewGate is UNCHANGED. This is the point of the default.
if (hasReviewLabel(labels, REVIEW_LABELS.pending)) return { action: 'park', … };

// (b) would add the second merge path this fork is about:
if (hasReviewLabel(labels, REVIEW_LABELS.pending) && isRoutineTier(score, files, diff))
  return { action: 'merge', reason: 'routine tier — post-land audit owed', auditOwed: true };
```

**Skeptic: REFUTED → default flipped from (c) to (a).** Two independent skeptic runs converged. The decisive
finding was against prep's own evidence, not the framing: re-running the appendix probe **with `git clean -qfd`
and classifying conflicts by path** turned "23 of 30 unrevertable" into **3 clean / 19 backlog-rename-only /
8 real code**, refuting the "revert is not the cheap half" argument that carried the first default. Re-verified
independently in prep before acceptance. Also refuted: the "~11-hour clean-revert window" (no window exists —
the newest merge conflicts while positions 2, 4, 10 are clean, and the derivation mixed merge-commit counts with
all-commit velocity), and "the revert muscle has never been trained" (three reverts, one of statute). The
**withdrawn (c)** was refuted on three grounds — it requires running (a) first to generate #2838's agreement
ledger; its preconditions are unbuilt and `tier: someday`; and it duplicates a six-day-old anchor. What
**survives** and now carries (a): the throughput warrant for (b) is gone, and #2563's audit trigger is unmet.

**Screen: flagged(prio) → fixed by restructure.** The fresh-context screen found the earlier (a)-vs-(c) contrast
was argued purely on throughput and build order — *"all of that is schedule"* — and that under zero cost (a) is
simply (c) with a stronger reader. Rather than re-argue (c) on a merit axis, prep **removed it as a branch** (the
skeptic showed it was not one) and left the fork as the genuine merit split the screen affirmed: *"merge-then-audit
admits a state where unreviewed content is authoritative on `main`; hold-then-merge never does — causal ordering,
not latency,"* which survives an infinite budget. Q1 (standard-vs-impl) ruled **not applicable**: the subject is
this repo's own merge machinery, not a published web standard.

---

## Fork 2 — Where does the irreversibility criterion live, and in what form?

**Fork-existence justification:** a **forced invariant** (ratify, not weigh) — one branch is *broken* by a
ratified anchor. This fork is live **under either branch of Fork 1**: #2563 point 3's always-review blacklist is
ratified and **unpopulated**, so the criterion is owed regardless of whether a routine tier ever exists.

**Crux — sensitivity is not recoverability, and today's predicate only measures sensitivity.** Run against the
real `scoreEscalation`:

```
humanRequired  escalate  care        changed files
false          true      elevated    scripts/converge-daemon-pass.mjs, scripts/converge-daemon-install.mjs   (PR #1113)
false          true      elevated    scripts/progress-board.mjs                                             (PR #1101)
false          true      elevated    scripts/conveyor/learnings-harvest.mjs                                 (PR #1068)
false          true      elevated    scripts/merge-ai-prs.mjs, scripts/lib/review-escalation.mjs            (PR #1124)
true           true      high        docs/agent/platform-decisions.md
```

All four `false` rows produced findings a `git revert` would not have undone. But note what the skeptic proved
next: a **path-list** fix does not close this either.

- **(a) A new path-glob term (`IRREVERSIBLE_PATHS`) in the escalation rubric.** ***Rejected — broken by
  statute and by measurement.*** (i) It reinstates path gating in
  [we:scripts/lib/review-escalation.mjs](scripts/lib/review-escalation.mjs), the exact mechanism
  [#human-is-principle-surface-not-path](docs/agent/platform-decisions.md#human-is-principle-surface-not-path)
  ratified out of that module on 2026-08-02 (collision 1). (ii) Measured: prep's own draft globs matched **0 of
  the 8** empirically unrevertable merges and **missed PR #1124**, one of the four cases used to reject the
  status quo. (iii) 28 scripts under `we:scripts/` reference an outside-repo path; the draft globs covered three.
  (iv) A new script-decidable hold has no legal clearance route (collision 3).
- **(b) Leave it to `humanRequired` as today.** *Rejected*: the table above is the counter-example — it admits
  every irreversible case as unremarkable.
- **(c) Populate #2563's already-ratified always-review blacklist, from the DIFF, fail-closed.** The criterion
  becomes **data in the review-policy contract**, not a new term in the rubric — so no new anchor, no path
  gating in the module #2840 cleaned, and no new hold tier. Four classes, each grounded in a case prep verified:
  1. **Unattended execution** (PR #1113 — the converge daemon self-updates by `reset --hard origin/main` every
     15 minutes, so anything landing on `main` that touches it executes unattended within 15 min).
  2. **Writes outside version control** (PR #1101 board state, PR #1068 pool + agent memory) — a revert restores
     the code and no data.
  3. **Publishes or pushes externally** — undo needs a history rewrite.
  4. **Adds a destructive git operation** (`reset --hard`, `clean -fd`, `push --force`, branch delete) — PR #1120
     records a real 2026-08-08 incident of exactly this at the primary checkout.

**Default: (c), with two clauses the skeptic forced in.** **First, it must FAIL CLOSED**: prep's draft returned
"routine" for anything unmatched — the same fail-open the fork rejects (b) for — and `diffHunks` is genuinely
`null` when the drain has no local clone ([we:scripts/merge-ai-prs.mjs](scripts/merge-ai-prs.mjs) documents this
fallback), so **absent diff ⇒ not routine**. **Second, what gets ratified is the four classes plus the
fail-closed default — never the regexes**, which are illustrative and must be replaceable without a re-ruling.

```js
// Blacklist membership computed from the DIFF, not a path list — #2840 forbids a new path gate here.
// The diff is already at this gate: computeNetDiffSignals sets `diffHunks` (we:scripts/merge-ai-prs.mjs:2013).
export function isIrreversible(addedDiffText) {
  if (addedDiffText == null) return true;            // FAIL CLOSED — no diff, no routine verdict
  const added = addedDiffText.split('\n').filter((l) => l.startsWith('+')).join('\n');
  return [
    /(launchd|launchctl|LaunchAgents|crontab|KeepAlive)/,          // 1. unattended execution
    /(homedir\(\)|tmpdir\(\)|['"`]\/(?:private\/tmp|var|etc|Users)\/)/, // 2. writes outside VCS
    /(git\s+push|gh\s+(pr|release)\s+create)/,                     // 3. external publish/push
    /git\s+(reset\s+--hard|clean\s+-[a-z]*f|push\s+--force|branch\s+-D)/, // 4. destructive git
  ].some((re) => re.test(added));
}
```

**Skeptic: REFUTED → default rewritten three times.** *(i)* The first draft used path globs; refuted by collision
1 (#2840 removed path gating from that module seven days earlier) and by measurement (0 of 8, missed #1124,
covered 3 of 28 outside-repo scripts). *(ii)* The second draft's `isRoutineTier` **returned `true` for anything
unmatched** while its own prose said it must fail closed — the exact allow-list failure it rejected (b) for; the
polarity is fixed above and `diffHunks === null` is now explicitly not-routine. *(iii)* Class 3 had **no term at
all** in the draft code despite being named the most irreversible class; it is added. **Conceded residual:** an
enumerated content-regex set is still a set. The skeptic named a real fifth class it misses — **weakening a
schema validator** (the PR #1096 shape: an ordinary logic defect silently corrupting VCS-tracked content, where
every file corrupted while the guard was weak stays corrupt after the revert). That class is **already governed
by a different test** —
[#agent-convergence-independent-validation](docs/agent/platform-decisions.md#agent-convergence-independent-validation)'s
coverage-drop / test-tampering clauses — so the ruling must **cite and compose with #2398 rather than silently
narrow it**, and this predicate must be stated as a fail-closed floor, never a complete taxonomy.
*Citation scope:* [#review-human-declarative-leash-only](docs/agent/platform-decisions.md#review-human-declarative-leash-only)
already names "a novel/**irreversible** change" as a trigger, but scopes it to the *declarative leash*. This fork
**widens** that criterion; it does not inherit authority from it. Supporting precedent, not authorization.

**Screen: clear.** The screen ruled the fork is not an impl detail — the criterion is the boundary the statute
must state, observable to anyone whose PR is or is not held — and called it the strongest merit fork, since the
branches classify the same PR differently. Its one caution (the concrete regexes are implementation and must stay
illustrative) is applied in the default above. Q1 not applicable, as for Fork 1.

---

## What could go wrong under Option 1, and what the revert actually costs

Priced honestly, after correcting prep's own first numbers.

1. **27% of merges do not revert cleanly on code** (8/30) — and the failures concentrate in the hot review-gate
   files a routine tier would most often contain. *Cost:* hand conflict-resolution, not a mechanical undo.
2. **A further 63% (19/30) conflict only on `backlog/**` renames** from the drain's JIT-renumbering (#2288).
   Cheap to fix, but **unfixed today**, so a revert run right now hits them.
3. **No revert tooling exists.** No revert script under `we:scripts/`, and the drain has no revert path — grep
   of [we:scripts/merge-ai-prs.mjs](scripts/merge-ai-prs.mjs) finds no post-merge verification pass at all.
   Every revert is hand-run.
4. **Silent defects have no trigger** — #1124 (540/540 green, feature gutted) and #1096 (0-byte blob, ~30 days
   to root cause).
5. **The unattended-execution window is 15 minutes**, not hours. For that class no human-paced audit is a control.
6. **The gate that detects staleness would itself be routine** under the naive predicate (#1124 row). A
   regression there removes the detector the audit depends on.
7. **The actor signal does not exist** (correction 7; #2946 is `tier: someday`), so a ledger verdict cannot yet
   prove who recorded it.
8. **Counter-weight, stated fairly:** reverts *have* worked here three times, including on statute (correction
   11), and the mechanical attempt costs ~0.07 s. The cost is entirely in whether it applies, not in running it.

## Recommendation (mine, not a ruling — the operator may reject it)

**Rule Fork 1 as (a) and Fork 2 as (c).** I recommended the opposite of (a) before running the skeptic, and the
evidence moved me — I record that so the operator can weigh it. The card asked whether a wrong routine merge is
tolerable because it is cheap to see and cheap to undo. *Undoing* turns out to be cheaper than prep first
measured (73% clean, three real reverts, one of statute), so that is no longer the argument against a routine
tier. What is left is simpler: **the reason to accept the risk has evaporated.** A routine tier buys throughput,
and there is no throughput problem — four hours at p90 all-time, one open PR, and a 77-hour figure that turns out
to be one PR during a one-time flush. Taking on a new failure mode to fix a queue that is not backed up is a bad
trade at any revert cost. Meanwhile #2563 will not let the audit stand in for the operator's oversight until
throughput actually outgrows manual watch, which the same measurements disprove. So: keep prevention, fix the
cheap real defects it has (`#3047`'s fail-open, `#3046`'s false stale, the #2288 rename artifact that
makes reverts look worse than they are), populate #2563's blacklist from the diff, and **build the ratified
throughput path (#3007 → #2838's triple gate) rather than routing around it**. If the queue backs up again the
way it did 2026-08-04→08, re-run the appendix and this recommendation should be revisited — that is a measurable
trigger, not a vibe. The honest cost of my recommendation is that the operator stays first reader on every hold
until #3007 lands.

## Measurement appendix — re-runnable

```bash
# 1. open→merged latency census (N=1078 merged) → p50/p90/max, overall and per window
gh api --paginate 'repos/chalbert/web-everything/pulls?state=all&per_page=100&sort=created&direction=asc' \
  --jq '.[] | {number, createdAt:.created_at, mergedAt:.merged_at, state, labels:[.labels[].name]}' > all_prs.jsonl

# 2. revert cleanliness — MUST clean between attempts and MUST classify conflicts, or the number is 3x wrong
git clone --no-hardlinks <repo> /tmp/revertprobe
for c in $(git -C /tmp/revertprobe log --merges --format=%H -30 origin/main); do
  git -C /tmp/revertprobe revert -m 1 --no-commit $c >/dev/null 2>&1 \
    && echo "CLEAN $c" \
    || { u=$(git -C /tmp/revertprobe diff --name-only --diff-filter=U; \
             git -C /tmp/revertprobe status --porcelain | grep -aE '^(DU|UD|UU|AA|AU|UA)' | awk '{print $2}'); \
         echo "$(echo "$u" | grep -av '^backlog/' >/dev/null && echo CONF-CODE || echo CONF-BACKLOG) $c"; }
  git -C /tmp/revertprobe revert --quit 2>/dev/null
  git -C /tmp/revertprobe reset -q --hard HEAD; git -C /tmp/revertprobe clean -qfd      # <-- omitting this skews it
done
# 2026-08-09 result: 3 CLEAN / 19 CONF-BACKLOG / 8 CONF-CODE

# 3. velocity — use MERGE commits for a merge-commit probe (the unit error prep made)
a=$(git log --merges --format=%ct -1 origin/main); b=$(git log --merges --format=%ct -30 origin/main | tail -1)
python3 -c "print(30/(($a-$b)/3600),'merges/hour')"     # 2.05/h; all-commit rate is 6-8/h — not interchangeable

# 4. revert base rate (grep -i 'revert', not '^Revert ' — the narrow pattern finds 1 of 3)
git log --since=2026-06-01 --format='%h %ad %s' --date=short -i --grep=revert

# 5. the tier-boundary misclassification table
node -e "import('./scripts/lib/review-escalation.mjs').then(m=>console.log(
  m.scoreEscalation({changedFiles:['scripts/converge-daemon-pass.mjs'],diffLines:200})))"

# 6. the merge-path fail-open (=> {action:'merge'})
node -e "import('./scripts/lib/review-escalation.mjs').then(({decideReviewGate})=>console.log(
  decideReviewGate({escalate:true,humanRequired:true,labels:['review:accepted'],
                    acceptedSha:null,headSha:'deadbeefcafe'})))"
```

Carried as **unverified**: the "eight label paths" count (five raw sites confirmed instead), and the
137,799-byte #1106 byte measurement (review-sourced, recorded unreplicated on `#3046`).

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

**Predicted touch-set (#2619)** for the work this ruling authorizes:
`we:docs/agent/platform-decisions.md` (a `codifiedIn` cross-reference on the existing #2838 anchor, per collision
2 — not a new anchor) and `we:scripts/lib/review-policy.contract.json` (Fork 2's blacklist data + the audit
bound). Notably **not** `we:scripts/lib/review-escalation.mjs` — collision 1 is why. Each buildable child carved
from this fork takes only its own slice.
