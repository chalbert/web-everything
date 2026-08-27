---
bornAs: xjzkvg4
kind: decision
size: 3
parent: "3318"
status: open
dateOpened: "2026-08-27"
preparedDate: "2026-08-27"
relatedReport: reports/2026-08-27-card-gate-deployment.md
tags: []
---

# The card gates run nowhere — no caller outside the scoring harness

Every gate in the review-corpus gate library is imported only by the replay harness and its tests, so a defect a gate detects still ships. Prepared as a decision. Most of the "which gates, where, at what severity" question is already settled — the call sites compose, corpus scope is settled by #3026's shipped diff-scoped precedent, the deployment set is derived from the registry, and #3314 was researched and does not reach a deterministic gate. One fork remains: what licenses a card gate to ERROR rather than WARN.

## The fact, and a correction to how it was verified

**The fact holds: no production caller.** Nothing in `we:scripts/check-standards.mjs` or
`we:scripts/check-standards-rules.mjs` references the library. The real importer set is **three files, all
inside the experiment**: `we:scripts/review-corpus/replay-gates.mjs:51`, its test
`we:scripts/review-corpus/__tests__/gates.test.mjs:16`, and `we:scripts/review-corpus/stability.mjs:286`
(transitively, via the harness). So the library is candidates, measured against history, invoked by nothing
that guards a write, a card, or a land.

**Retracted — the proof this card was filed with does not run.** The original body printed this, under the
heading *"Verified, not assumed"*:

```
grep -rln "review-corpus/gates.mjs" scripts/
  → scripts/review-corpus/gates.mjs
  → scripts/review-corpus/replay-gates.mjs
```

**That command returns nothing at all — zero hits, exit 1.** Two independent reasons, both knowable at filing.
(1) The gate module does contain the literal, in its own `@file` docblock, but plain `grep` classifies the
file as **binary** and skips it silently, because of the single NUL byte at offset 27761 that this card's own
report documents. (2) The harness **never contains that string** — it imports the module by a *relative
specifier*, so the second hit never existed. `git grep -ln` does list the gate module, so the report's claim
that git grep skips it too is also wrong and is corrected there.

The **conclusion** was right and the **evidence was invented**, which is precisely the defect class #3341's
gate exists to catch. It is recorded here rather than quietly fixed, because this card proposes to deploy that
gate — see *What the library missed*, below.

## Why this matters more now than it did yesterday

Five items target that library, and **all five build detectors into a file nothing calls**:

| item | gate |
| --- | --- |
| [#3340](/backlog/3340/) | vacuous criterion — the empty test selection shape |
| [#3341](/backlog/3341/) | an uncited mechanism claim, 17 findings across 3336 cards |
| [#3346](/backlog/3346/) | `vacuous-executable-criterion` models absence only |
| [#3362](/backlog/3362/) | a check must state its predicate and candidate set |
| [#3319](/backlog/3319/) | (touches the same library) |

Each is individually good work. Together they are a library whose net effect on anything shipping today is
**zero**.

## A precise note on an earlier retraction, because this is adjacent and must not be confused with it

An earlier card claimed *"the gate scores a corpus of past reviews and never runs against a backlog card"* and
concluded *"a detector pointed only backwards catches nobody."* **That was retracted, and the retraction was
correct**: `vacuousExecutableCriterion` opens with `if (!/^backlog\//.test(path || ''))` and is registered
`targets: 'backlog card'`, so backlog cards are exactly and only what it scans.

**This item is a different fact and does not revive that claim.** What a gate *scans* and whether anything
*calls* it are independent. The gate targets cards correctly; no caller passes it a card outside the
experiment.

## Retyped story → decision (prep, 2026-08-27)

Filed as a `story` with `scope: we:scripts/check-standards.mjs`. Retyped to `decision`; `scope:` dropped,
since a decision is ratified rather than dispatched, and each child carries its own slice.

**The retype was attacked twice and survives narrowly, on one ground.** The skeptic's objection was fair
against prep's first draft: every fork was written as a single-branch "ratify", and a decision with no live
branches is a design document. Prep's second draft answered with a statute-reach question (#3314); the
fresh-context re-screen then flagged *that* as research with a determinate answer, and it was right — see
entry 6, where the question is answered rather than asked.

What is left, and what earns the retype, is one thing: **a card gate that ERRORs blocks a land with no
reviewer, and the repo has no rule for when a heuristic earns that.** The library's own declared bar is
self-contradictory, its best-measured gate has a precision interval spanning every threshold anyone has
proposed, and this card's own four-finding self-test ran 2 true, 1 arguable, 1 miss. A builder picking a
severity for their own detector is the failure mode; that is a permission call, and permission calls are
ratified. If the decider prefers, the honest alternative is to override to warn-only for the whole library
and retype back to a story — that override is itself the ruling, and it is branch (a) below.

## The measured ground — one sweep, one revision

Method and caveats: [the session report](/reports/2026-08-27-card-gate-deployment/), linked as
`relatedReport`. Stated in #3362's form so no completeness is implied.

**Scan.** Every git-tracked file matching `^(backlog|agent-memory-src|reports)/.*\.md$` at `6b03a7bd` —
**4046 files** (backlog 3339, agent-memory-src 252, reports 455) — passed to every entry of the frozen
`GATES` registry (`we:scripts/review-corpus/gates.mjs:715`) through a working-tree context.
**Predicate.** One finding = one element of a gate's returned array. **Not adjudicated** for eight of the
nine: a count is a *fire rate on today's tree*, never a false-positive rate. Re-run independently by the
skeptic pass, exact match on all nine counts.

| gate | `targets` | findings today | context it needs | adjudicated FP |
| --- | --- | ---: | --- | --- |
| `resolved-with-todo` | backlog card | **5** | — (pure) | not adjudicated |
| `stale-gate-count` | backlog card | **28** | — (pure) | not adjudicated |
| `dangling-wikilink` | agent memory | **70** | `list` (11 ms) | not adjudicated |
| `dangling-hash-id` | backlog card | **1** | `knownHashIds` (116 ms) | not adjudicated |
| `grep-literal-mismatch` | backlog card | **5** | `read` | not adjudicated |
| `vacuous-executable-criterion` | backlog card | **1** | `read` | not adjudicated |
| `scope-omits-donewhen-file` | backlog card | **72** | — (pure) | not adjudicated |
| `citation-line-content` | any prose | **577** | `read` | not adjudicated |
| `uncited-mechanism-claim` | backlog card | **17** | `read` | **13 true · 1 arguable · 3 false** |
| | | **776** | | |

Baseline for scale: `npm run check:standards` on this clone is **0 errors, 1451 warnings**. All nine as
whole-corpus warnings would be **+776 on 1451 (+53%)**; `citation-line-content` alone is **+40%**.

### The standing count is yield evidence too, and it cuts against the cheap gates

A low standing count reads two ways, and prep's first draft only read one. It is a small **drain**, and it is
also the best available estimate of how often the gate **ever catches anything** — its hits across 3339 cards
of history. Read that way, `dangling-hash-id` (**1**), `vacuous-executable-criterion` (**1**),
`resolved-with-todo` (**5**) and `grep-literal-mismatch` (**5**) are **12 findings between them across the
entire board**. Cheap to deploy is not the same as worth deploying, and any ordering that ranks by drain cost
silently ranks by the inverse of evidence. The bands below are therefore keyed on **impact**, not on cost.

### The number the framing invites you to misread — and its interval

#3341's **17 / 3336 (0.5%)** is a **fire rate on the board**, not a false-positive rate. Its adjudication was
13 true · 1 arguable · 3 false, so the point estimate is **3/17 = 17.6%** (23.5% counting the arguable one
against it). **At n = 17 that is not a band assignment.** The 95% Wilson interval on 3/17 is roughly
**[6.2%, 41.0%]** — it spans "clears 10%", "probation at 10%" and "auto-disable at 25%" together. #3318's own
conformance front demands "four numbers, always together, **always with intervals**"; a single point estimate
placed in a band is the thing that front exists to stop.

**And the contract it would be measured against is not a statute.** #3318 is an **open epic**, not a statute
anchor; its own goal-set row 8 marks the effective-FP contract **"blocked — no ledger"**, so it has no
instrument. Its stated numbers come with the epic's own caveat: 10% is a product decision Google's footnote
calls *"somewhat arbitrary"*, against Coverity's published 20% target and measured developer tolerance near
15%. Its **effective-FP** is a not-useful rate over *surfaced* findings with an action-rate denominator — a
different instrument from a raw adjudicated-incorrect count. Prep's first draft called this "a ratified
contract" and assigned a band from it; that was wrong on three counts and is corrected here.

### A mechanism claim this card owed itself

The filed body said `vacuousExecutableCriterion` "must *run* a command to know it is vacuous, which is not a
write-time operation." **It runs nothing.** Shape 1 (`we:scripts/review-corpus/gates.mjs:317-332`) calls
`read(rel)` and tests `body.includes(needle)`; shape 2 (`we:scripts/review-corpus/gates.mjs:335-345`) is a
regex over the criterion text. No subprocess exists in the module. The gate **is** write-time feasible.

### What the library missed — one true negative, recorded

Both this card and its report were run through all nine gates. **Both come back clean** — including on the
invented proof retracted above, which is a `grep-literal-mismatch`-class defect in the card deploying
`grep-literal-mismatch`. The gate cannot reach it: `grepLiteralMismatch` opens with `doneWhenSection(text)`
(`we:scripts/review-corpus/gates.mjs:228`) and iterates Done-when criteria only, so a falsified command in a
card *body* is structurally out of scope. **Recall on the one factual error in this card is 0/1.**
**Three findings did land during prep**, all `citation-line-content`, all on drafts of this card and its
report. Two were true: one cited a warn-flag's line while naming a *different* flag in the same sentence; the
other cited an enum's line while naming a property declared 140 lines earlier. The third is **arguable and
worth recording as a limitation** — it fired on a `path:211-213` *range* citation whose named levels sit at
either end of the range, because the gate parses only the first number and looks ±4 lines from it. A range
citation is a form it does not model.
**Running tally on this two-file sample: 2 true, 1 arguable, 1 miss.** Recorded because a deployment argument
that reports only the catches is the same defect in a new place — and because this is the only end-to-end
evidence anyone has of these gates on live prose rather than on a replay. It points where the forks below
point: useful enough to run, not precise enough to block.

---

## Supported by default — five concerns that are settled, composed, or scheduling

The card asked *which gates deploy, where, and at what severity*. Most of that is already ruled, and **saying
so is the ruling**. Two entries below were authored as `## Fork N` in this prep and dissolved by the
fresh-context two-confusion screen; one was written as settled and is **retracted**, having been settled by
the wrong anchor. All are recorded rather than deleted, so a reader can see what was considered.

**1. The call site is not a fork — the branches compose over one kernel (#756).**
`we:scripts/lint-locus-prefix.mjs` runs **one pure detector** (`scanRepoLocusPrefixes`) from **five** facades:
`--pre` (a `PreToolUse(Edit|Write)` deny registered in `we:.claude/settings.json`), a single-file `PostToolUse`
backstop in the same file, `--staged`, `--all`, and `--range=<gitrange>` — the producer sweep pr-land runs
before opening a PR (`we:scripts/pr-land.mjs:708`). The library already has the same kernel shape:
`runGates(text, ctx)` at `we:scripts/review-corpus/gates.mjs:728`. The composability probe *succeeds* — the
facades coexist, there is no excluded branch, so there is no fork.

**2. Write-time feasibility is a derivable per-gate property — and the kernel fails open today.**
Measured: `knownHashIds()` costs **116 ms** (one `git grep` over 3339 cards, 939 ids); `git ls-files` costs
**11 ms**; every other gate is `readFileSync` plus regex, and the slowest — `uncited-mechanism-claim` —
averages **0.39 ms per card**. So "several gates need repo context and shelling to git on every write is a
real cost" resolves to **exactly one gate**, `dangling-hash-id`. These timings license the derivation and
nothing else.
**Build obligation the entry must name:** `runGates` (`we:scripts/review-corpus/gates.mjs:728-734`) wraps
every gate in a `try` with an empty `catch`, commented *"a gate that throws scores as finding nothing"*. That
is correct for a *scoring* harness and **fail-open for a gate** — a gate that throws reports clean. Any
deployment must not route through that swallow unchanged, whatever severity is ruled.

**3. Corpus scope: diff-scoped, and the repo already ships it over this material (#3026).**
`we:scripts/check-standards.mjs:1249-1270` runs the provenance gate **diff-scoped against the `origin/main`
merge-base, reporting only tokens on lines a change ADDED** — its header states the reason in numbers:
"corpus-wide this fires 1,808 times on overwhelmingly correct prose". It also **narrowed its own scope to
exclude `backlog/` on measurement** — the filed scope produced "503 findings on 22 merges", the shipped scope
"0 on 0". That is the fourth corner prep's first draft never offered, already built, already measured, over
this exact corpus. It settles scope: **diff-scoped**, per gate, with whole-corpus reserved for a gate whose
standing count is already near zero.
**One residue the re-screen surfaced, resolved here rather than left as prose.** Diff-scoping means the 776
findings already on the board are never shown to the builder who later picks one of those cards up — a real
loss the first draft did not name. But the remedy is a **third surface**, not a different scope: a read-time
report at claim or prepare time, over the one card being picked up. That composes with diff-scoping instead
of excluding it — it is a sixth facade over the same kernel (entry 1) — so it is support-both, and it is
filed as a follow-up rather than made a branch. Recorded so the loss is visible and does not have to be
rediscovered.

**4. RETRACTED — "the severity ladder is settled by #867". It is not, and a later anchor rules the other way.**
> Prep's first draft read: *"[`#gate-rollout-ratchet`](../../docs/agent/platform-decisions.md#gate-rollout-ratchet)
> (#867) already rules how a gate rolls from warn-only to build-blocking … warn-only is a stage you exit, not
> a resting posture,"* and concluded that a drained gate enters at ERROR, citing #867's by-name rejection of a
> "violation-level baseline snapshot" to reject new-code-only scoping.
>
> **Three errors.** (i) #867's scope is a **drainable derived route set** with a `WARN_ROUTES` opt-out —
> re-rendered a11y routes, not an append-only card archive. (ii) Its rejected alternative is a *stored
> snapshot*, and a merge-base diff scope **stores nothing to rot**, so the stated reason does not reach it;
> entry 3 shows the repo shipping exactly that scope. (iii) A later anchor rules the opposite for a
> `check:standards` gate: [`#small-file-preference`](../../docs/agent/platform-decisions.md#small-file-preference)
> (#2678, ratified 19 days after #867) makes **soft-warn permanent** — "never errors, never denies the write"
> — with an inline escape-hatch comment, and rejects hard-deny outright as "a footgun on high-churn files".
> The first draft also reclassified the citation-gate warn flag as #867 non-compliance; the sibling comment at
> `we:scripts/check-standards.mjs:1265` states that posture is *ruled*, for the "don't red the gate on a
> corpus nobody is touching" reason.

**Corrected once more — "never hard-deny" was over-generalized in its turn, and the tree refutes it.**
Prep's second draft read #2678 plus [`#blast-radius-advisory-care-not-a-gate`](../../docs/agent/platform-decisions.md#blast-radius-advisory-care-not-a-gate)
(#2563 clause 1) as establishing that no card gate may ever block. Both citations overreach. #2678's
never-deny is scoped to **the size-plus-collision composite**, and its stated reason — "a footgun on
high-churn files … a blocking gate there would deny the very edits that split them" — has no purchase on card
prose. #2563 clause 1's subject is **scored signals**, and #3314's own retraction is a standing warning
against stretching exactly that clause. Decisively, **card gates already error today**:
`we:scripts/check-standards.mjs:586` walks every backlog item through `validateBacklogItem` and routes its
findings to `err`. So "no card rule may block" is not the repo's posture, and asserting it would have been the
same over-generalized-anchor defect this entry exists to retract.
**What survives from entry 3 and this one:** scope is diff-scoped, and **warn is the default posture**, with
an inline escape hatch. What licenses the exception is Fork 1.

**5. The deployment set is derived from `GATES`, never hand-listed.**
*Authored as a fork; dissolved `flagged(impl)` by the screen — a card author cannot observe which way it was
built, and merit survives the free-build test, so it is an authoring requirement on the build child, not a
ruling.* Settled three ways: `runGates` already iterates the frozen `GATES`; #3357's mutation refutation (a
check reading two hard-coded paths stayed green when a reviewer added a non-compliant third file — "a hand
sweep wearing a guard's clothes … it encodes the two callers someone *remembered*"); and the hookable rule
that a script-decidable set is derived, not typed out.
**`targets` cannot carry it.** `targets` (`we:scripts/review-corpus/gates.mjs:716-724`) names the **corpus** —
`'backlog card'` / `'agent memory'` / `'any prose'` — not the facade and not the severity. Six gates share
`targets: 'backlog card'` and must deploy differently. Two fields are needed that do not exist: `needs` (the
context keys the gate uses — entry 2's derivation) and `impact` (Fork 1's typed class):

```js
export const GATES = Object.freeze([
  { name: 'vacuous-executable-criterion', fn: vacuousExecutableCriterion, targets: 'backlog card',
    needs: ['read'], impact: 'broken' },     // criterion green before the work — real work silently skipped
  { name: 'stale-gate-count',             fn: staleGateCount,             targets: 'backlog card',
    needs: [],       impact: 'cosmetic' },   // a drifting number no criterion depends on
  // …
]);
```

**No measured count goes in the registry.** Prep's first draft proposed a `standing: 72` field;
[`#statute-anchor-states-rule-not-status`](../../docs/agent/platform-decisions.md#statute-anchor-states-rule-not-status)
(#2854) is the shape objection — point-in-time status does not live in the timeless artifact, it lives on the
item and is re-measured by a check. `impact` is timeless; a standing count is not.
*Sharp edge:* the gate module holds a literal NUL byte at offset 27761, so plain `grep` skips it as binary —
which is how this card's own headline proof came to be printed without anyone noticing it returns nothing.
`git grep` is unaffected.

**6. ANSWERED, not asked — #3314 does not reach a deterministic gate. Its typed-field discipline is adopted
anyway.**
*Authored as prep's second-draft Fork 1; dissolved `flagged(impl)` by the fresh-context re-screen, on the
ground that "which statute governs" is research with a determinate answer, not a call to hand a human.* The
screen was right and the research was done:
[`#claim-accuracy-advisory-blocks-on-impact`](../../docs/agent/platform-decisions.md#claim-accuracy-advisory-blocks-on-impact)
(#3314) was ratified 2026-08-26 under this card's own parent, and it governs findings over card bodies,
Done-when criteria, docs and agent-memory notes — so it *looked* dispositive. **Two things in the anchor and
one in the tree settle that it is not:**

- **#3314's subject is a lens's mandate inside the AI jury**, not any check over that population. Its own
  scope note reads: *"The blocking set is an explicit one-member set, not `ADVISORY_LENSES`"*, with
  generalization deferred to `#3338`.
- **It presupposes deterministic gates as a separate thing.** Arguing that its bar may not be built on
  `blocksAcceptance`, it names *"the already-existing `check:standards` locus gate"* as a **prevention** a
  lens finding is measured against. An anchor that treats those gates as the backdrop is not legislating
  them.
- **Card gates already block.** `we:scripts/check-standards.mjs:586` routes `validateBacklogItem`'s findings
  to `err`, so a deterministic error on a backlog card is the status quo #3314 was ratified alongside.

**Adopted regardless:** #3314's forward-facing clause — *"any future rule of this shape must name a typed
field or take plain advisory instead"* — is good design whether or not it binds, and the registry's `impact`
field in entry 5 is that typed field. Declaring it costs nothing and removes reviewer discretion from the
place #3314 says discretion must not sit. So the discipline is inherited by choice, and the reach question is
closed rather than spent.

---

## Fork 1 — What licenses a card gate to ERROR rather than WARN?

**Fork-existence — a genuine either/or, and the composability probe fails.** The two branches are not two
values of one knob and cannot be run together: for a given gate on a given card, the author is either blocked
or not. They also produce different trees today — under (a) four gates block on day one; under (b) none does
until adjudicated, which on present evidence is none. And it is not prioritization: strip cost and timing
entirely, and (b) still demands evidence that (a) does not, so a gate declared `broken` but firing wrongly
would block real work under (a) and not under (b). That difference is permission and correctness, which the
free-and-instant counterfactual does not touch.

**Why this is the residue and not a build choice.** Entry 6 closes the statute-reach question, entries 1–3
and 5 close call site, scope and derivation, and entry 4 establishes that warn is the default posture while
also establishing — against prep's own earlier draft — that card gates *already* error today
(`we:scripts/check-standards.mjs:586`). So the exception exists and has no stated rule. Writing one is a
permission call: an ERROR here blocks a land with **no reviewer**, on a heuristic, over a corpus of 3339
cards.

**Crux.** Two candidate licences, and they disagree on every gate in the library. **Impact** asks *what does
shipping this finding cost* — the typed axis adopted in entry 6, whose property `impactIfUnfixed` is declared
at `we:scripts/lib/jury-core.mjs:57` with its enum at `we:scripts/lib/jury-core.mjs:197`, held total by a
`check:standards` gate. **Precision** asks *how often is this gate right* — for which the library has one
adjudicated sample, `uncited-mechanism-claim` at 3/17, whose 95% interval is roughly [6.2%, 41.0%].

- **(a) Impact alone.** A gate whose finding class is `broken` by construction ERRORs; every other gate
  WARNs. Nothing further is required, because impact is a property of the *class* the gate detects and is
  knowable at authoring time. *Rejected as the sole licence — but it is the branch to pick if the decider
  wants the library to bite now.* Four gates would block on day one on **zero** precision evidence. This
  card's own end-to-end sample is 2 true, 1 arguable, 1 miss on four findings; #3308 measured the sibling
  failure at 59 of 60 merged PRs before the cut to 8. A wrong ERROR here has no reviewer to catch it.
- **(b) Impact AND an adjudicated precision floor.** A gate ERRORs only when (i) its finding class is
  `broken` by construction **and** (ii) its findings have been adjudicated on a sample whose interval's
  **lower bound** clears the bar in force. Until both hold it WARNs, diff-scoped, with an escape hatch.
  ← **default**
  Impact decides *which* gates are ever candidates — that is the discipline entry 6 adopts from #3314, and it
  keeps reviewer discretion out of the classification. Precision decides *when* a candidate crosses, and it is
  the term that stops a confidently-wrong regex from blocking work. Requiring the interval's lower bound
  rather than a point estimate is what makes the rule honest at the sample sizes this repo actually has:
  3/17 supports no threshold claim at all.
- **(c) Precision alone.** *Rejected.* It licenses a gate to block on a `cosmetic` finding purely because the
  gate is accurate — a dangling wikilink is reliably detectable and stopping a land for one is exactly the
  "review permission scaling with a signal" shape #3314 argues against on structural grounds, whether or not
  the anchor binds.
- **Sub-fork, stated rather than left as an aside:** is `impact` declared **per gate** (a class property) or
  **per finding** (computed)? **Per gate** is the default — a gate is a fixed predicate, so its finding class
  has one impact by construction, and a per-finding computation puts reviewer discretion back in the place a
  typed field exists to remove it from. `citation-line-content` is the honest exception: a wrong locus a card
  *directs work to* is `broken`, while the same defect in a resolved 2026-05 card is `cosmetic`. Under
  per-gate declaration it takes the lower class, `degraded`, and never blocks.

**What the branches actually differ on — stated so the durable half is not confused with the schedule half.**
The **durable** difference: (b)'s floor is a test a gate can *fail*, not a queue it waits in. A gate whose
class is `broken` but which is measured at, say, 30% wrong ERRORs forever under (a) and WARNs forever under
(b). That is the fork — may a demonstrably-wrong heuristic block a land with no reviewer? — and no amount of
free, instant adjudication dissolves it.
The **scheduling** difference, recorded but *not* load-bearing: today no gate in the library has an
adjudicated sample at all, so (a) starts four gates blocking and (b) starts none. That gap closes as
adjudication happens; the durable difference does not.

**Proposed `impact` classification.** This is the band table the original Done-when asked for, keyed on
impact rather than on drain cost. It binds under both branches; only the second column changes:

| gate | proposed `impact` | blocks under (a)? | standing findings |
| --- | --- | --- | ---: |
| `resolved-with-todo` | `broken` — resolved with no proof written | yes | 5 |
| `vacuous-executable-criterion` | `broken` — criterion green before the work | yes | 1 |
| `grep-literal-mismatch` | `broken` — work directed at a literal that is not there | yes | 5 |
| `scope-omits-donewhen-file` | `broken` — slice unbuildable inside its declared scope | yes | 72 |
| `uncited-mechanism-claim` | `degraded` — cost a build round; recovered unaided | no | 17 |
| `citation-line-content` | `degraded` — per-finding impact varies; class takes the floor | no | 577 |
| `stale-gate-count` | `cosmetic` | no | 28 |
| `dangling-hash-id` | `cosmetic` | no | 1 |
| `dangling-wikilink` | `cosmetic` | no | 70 |

**What this covers and what it does not (#3362).** It covers the nine gates in the frozen registry at
`6b03a7bd`. The `impact` column is **proposed, not measured** — a reading of the level glosses, and the part
of this fork most worth overriding. It does not adjudicate any of the 759 unadjudicated findings, and says
nothing about gates not yet written, including #3362's own, which has no implementation and so no count.

### What counts as admissible evidence for (b)'s precision floor

Folded in here rather than carried as a second fork, because the re-screen was right that it is the evidence
half of one question — under (a) the clause is inert, so it cannot stand alone.

**The declared bar is broken and must be replaced whichever branch wins.**
`we:scripts/review-corpus/gates.mjs:12-15` declares, before the experiment ran: *"a gate ships only
if it catches >=80% of its own labelled class in the corpus AND fires zero times where no reviewer found
anything."* `we:scripts/review-corpus/replay-gates.mjs:16-19` says the opposite about the second term: an
EXTRA is "NOT a false-positive count … either a false positive or a real defect nobody looked for … a number
to ADJUDICATE, never as a number to divide by."

**Why the declared bar cannot be the floor.** Applied to #3341 it fails the gate twice: on a catch rate of
**0 labels caught out of 0 instances** — none of the 39 confirmed labels is an instance of a class named
*after* every mined case was recorded — and on **6 extras adjudicated one by one, all real**. **0/0 is
undefined, not failed**, and a rule keyed on it rejects exactly the gates written for defects the corpus
predates. Dropping replay entirely is no better: it is the only contamination-free measure the repo has
(`revisionReader` binds every read to the case's own `head` via `git show`,
`we:scripts/review-corpus/replay-gates.mjs:69-79`), so a gate cannot see the review that found the defect.

**The admissibility rule, which binds under (b) and is a plain bug fix under (a):** a replay score counts only
where the class is *representable* in the corpus. A gate whose class has zero instances among the 39 confirmed
labels scores **`not-measurable`** — printed as that verdict, never as a silent zero. Its evidence is instead
the whole-corpus sweep plus per-finding adjudication, and **extras are adjudicated, never divided by**. Under
(b), a promotion to blocking then requires an adjudicated sample whose interval's **lower bound** clears the
bar.

**Why a lower bound and not a point estimate.** Prep's first draft wrote this clause as "adjudicated FP under
#3318's ratified contract — under 10%", and that was wrong three ways: #3318 is an open epic whose meter is
marked blocked, its **effective-FP** is a different instrument from a raw adjudicated count, and 3/17 carries
a 95% interval of roughly **[6.2%, 41.0%]** covering every band the contract names. A lower-bound rule is
honest at the sample sizes this repo actually has, and matches #3318's own "always with intervals" discipline
without borrowing its unbuilt threshold.

**Consequence, plainly.** `uncited-mechanism-claim` — the library's most-cited success, 13 true findings —
ships at **warn** under (b) and not above: `not-measurable` by replay, and 17 adjudications too few to place
it anywhere. It is a **narrow-and-re-adjudicate**, and its 3 false positives are the specification.

**Code example** — so `not-measurable` is a printed verdict rather than a silent zero, which is the current
failure mode:

```js
const instances = labels.filter((l) => l.class === gate.name).length;
const verdict = instances === 0
  ? { score: 'not-measurable', why: `0 of ${labels.length} confirmed labels are instances of this class` }
  : { score: hits / instances, extras };            // extras: adjudicate, never divide by
```

**Skeptic:** SURVIVES-WITH-AMENDMENT, after two full attack rounds that between them rewrote this fork twice.
Round 1 refuted prep's original fork ("drain-then-land at ERROR") outright, on three grounds all verified and
folded in: #867's baseline rejection does not reach a merge-base diff scope, because nothing is snapshotted;
the repo already ships that scope at `we:scripts/check-standards.mjs:1249-1270`, narrowed on measurement to
exclude `backlog/`; and #2678 ruled warn-never-deny for a `check:standards` gate *after* #867. Round 1's
strongest objection — *"ratifying this reverses a ratified statute by re-implementing the lens in regex"* —
drove prep's second fork, the #3314 reach question, which the re-screen then dissolved as answerable research
(entry 6). Amendments folded in from both rounds: the `standing` field dropped from the registry (#2854), the
#3318 threshold struck for an interval-based floor, the yield reading of the standing counts recorded, and
the per-gate ordering re-keyed from drain cost to impact.
**Statute-overlap:** reconciled against #3314 (does not reach — entry 6), #2678 and #2563 clause 1 (both
over-generalized by prep and corrected in entry 4), #2854 (registry shape), #3026 (scope precedent). #867 is
demoted to background and #1937 is **dropped as a citation** — the session report itself concluded it governs
location, not corpus scope, and an earlier draft re-deployed it as support anyway. This fork mints one rule
the repo does not have — the ERROR licence — and it lands in the `check:standards` severity cluster, not
under `#gate-rollout-ratchet`.
**Citation-scope:** #3318 is cited as **an open program metric with a blocked meter**, never as a statute;
the harness docblock is cited as the *contradicting sibling*, not as authority; #3314's typed-field clause is
adopted as design discipline, explicitly not as binding authority.
**Screen:** clear — on the **third** fresh-context screening pass, run against this framing specifically. The
two earlier framings were both flagged and both rewritten: the first `flagged(prio)` (drain ordering is a
schedule, not a ruling), the second `flagged(impl)` (statute reach is research with a determinate answer →
entry 6). On axis 1 the screen found the blocking-versus-warning difference directly observable by a card
author, and the one genuinely tooling-internal question — per-gate versus per-finding `impact` — correctly
demoted to a defaulted sub-fork rather than dressed as the ruling. On axis 2 it found that (b) does **not**
collapse into (a) under free and instant adjudication, because "the precision floor is a test a gate can
*fail*, not a queue it waits in" — a gate measured at 30% wrong errors under (a) and warns under (b)
permanently. It also confirmed (a) and (c) are live branches, not straw men. **One amendment folded in from
the screen:** the "four gates versus none today" line was half a cost statement, so the branches' durable
difference and their scheduling difference are now stated separately, and the fork rests only on the former.

---

## Predicted touch-set (#2619) and the child slices

Coarse, repo-qualified, prefix-shaped. This item carries no `scope:`; each child gets **its own slice**, so
the children do not serialize against each other:

- `we:scripts/review-corpus/gates.mjs` — the `needs` + `impact` registry fields, and the fail-open swallow in
  `runGates`. One child.
- `we:scripts/review-corpus/` — the deployment runner: derives its set from `GATES`, diff-scopes against the
  `origin/main` merge-base the way `we:scripts/check-standards.mjs:1249-1270` already does, and emits the
  `not-measurable` replay verdict. A second child, `blockedBy` the first.
- `we:scripts/check-standards.mjs` — the registration block plus the inline escape hatch #2678's precedent
  carries. A third child.
- A per-gate re-measurement check, so no standing count is ever asserted from source (#2854). Folds into the
  first child.
- **No corpus drain is carved.** Under the corrected default the gates are diff-scoped, so historical findings
  are not a precondition; a drain becomes worthwhile only if a gate is later promoted to whole-corpus.

### Review jury (provisional — pre-registered #2638)

Care level: `high` (gate-self machinery, and a live statute reconciliation). Provisional: binds against the
predicted scope above, re-checked against the real diff at PR open.

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
| claim-accuracy#1 | claim-accuracy | static-review | Every factual claim the change makes about the repo holds against the repo: a cited path:line names what is actually there, a quoted grep literal really matches, a stated count is the real count, a referenced id or link resolves, and anything the description says was changed appears in the diff. |
| claim-accuracy#2 | claim-accuracy | static-review | Every factual claim the change makes about the repo holds against the repo: a cited path:line names what is actually there, a quoted grep literal really matches, a stated count is the real count, a referenced id or link resolves, and anything the description says was changed appears in the diff. |

**Bars registered beyond the generic expectations, so they cannot be invented later:** every count is
**re-measured at landing**, never copied from this card; the deployment set is proven derived by a mutation
test that registers a gate the deployment code never names; and any command printed as evidence is **run**,
because this card shipped one that was not.

## Done when

A decision is done when it is **ratified**. Its builds are carved as children with the slices above.

1. **Fork 1 ratified or overridden** — including whether the precision floor binds, and at what bar. The
   ruling is codified in the `check:standards` severity cluster, **not** under `#gate-rollout-ratchet`, and
   it cites `#claim-accuracy-advisory-blocks-on-impact` for the typed-field discipline it adopts while
   recording that the anchor does not bind (entry 6).
2. **Executable, on the runner child** — one gate runs from a real call site derived from `GATES`,
   diff-scoped; a card carrying the defect it detects is flagged where an author will see it, and a clean card
   passes. Both directions, asserted with a non-zero pass count (`| grep -qE "Tests +[0-9]+ passed"`).
3. **Executable, on the registry child** — a mutation test registers a gate the deployment code never names
   and asserts it fires (#3357's third-file refutation, applied here); and a gate that throws is proven
   **not** to report clean, closing the `runGates` swallow.
4. The replay harness prints **`not-measurable`** for a class with zero instances among the confirmed labels,
   proven by a test that a 0/0 gate is not scored as a failure.
5. Every gate carries its `impact` class and the evidence behind it, **re-measured at landing**.
6. The claim-time read surface is filed as a follow-up (entry 3's residue), or explicitly declined.
7. `npm run check:standards` — 0 errors.
