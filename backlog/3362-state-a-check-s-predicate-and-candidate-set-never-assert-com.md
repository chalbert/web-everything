---
bornAs: x9bq900
kind: story
size: 2
parent: "3318"
status: open
dateOpened: "2026-08-27"
scope:
  - we:scripts/review-corpus/gates.mjs
tags: []
---

# State a check's predicate and candidate set; never assert completeness

Five consecutive review rounds on one PR each shipped a sentence claiming a check covered every case, while the code checked a subset. The guard improved each round and the claim was false each round — so the durable fix is to stop asserting coverage and state what is actually scanned.

## The evidence: five rounds, five false sentences, one PR

PR #1609 (#3321) went five rounds. Each round found a real caller the previous sweep had missed, **and each
round shipped a completeness claim larger than what its code checked**:

| round | what was missed | the sentence that shipped |
| --- | --- | --- |
| 1 | `buildPrLandArgs` in `we:scripts/lane-drain.mjs` | — |
| 2 | four invocations in `we:skills-src/batch-backlog-items/parallel-execute.workflow.js` | *"every committed landing invocation declares its verification posture"* |
| 3 | three doc emitters | *"no emitter ships a landing invocation that says nothing about verification"* |
| 4 | an invocation written with a `we:` locus prefix | criterion 6; and `we:scripts/lib/lane-verify.mjs`'s *"the sweep, not this comment, is now authoritative"* |

**The guard improved every round. The claim was false every round.** That is not a sweep problem; it is a
writing problem, and it is independent of how good the check gets.

Round 4 is the sharpest illustration. The harvest had been widened to a `git grep` over the tracked set — 213
candidates, genuinely complete as a *candidate set*. But the predicate matched the lander's path spelled
**without** a repo prefix, and this repo's own locus convention writes it **with** one. Widening the candidate
set while the predicate stayed narrow just moved where the blindness sat. Mutation-proven both ways: the
flag-free invocation **with** the prefix left 56/56 green; the identical shape without it reddened two named
cases.

## The rule

**A check may state what it scans and what it matches. It may not claim to have found everything.**

- **Falsifiable, and stays true:** *"the check scans 213 candidates from a `git grep` over the tracked set, and
  matches `<predicate>`."* A reader can see the scope, spot that their spelling is not in the predicate, and act.
- **Not falsifiable, and was false five times:** *"every committed invocation declares its posture."*

The second form is worse than silence. It tells a reader the question is settled, so nobody looks — the same
failure as a check that fails open with a reassuring message (`we:scripts/lint-locus-prefix.mjs`'s *"CI still
backstops it"*, #3342) and as a reviewer volunteering what it did not examine (#3308's *"accidentally honest"*).

## This card's author wrote one of those sentences

[#3357](/backlog/3357/) — filed by this session, arguing that a hand sweep wrong twice will be wrong a third
time — itself claimed to govern *"every committed landing invocation"*, and its first implementation read two
hard-coded paths. The card was amended to demand the harvest come from the tracked file set, which fixes round 3
and **would not have caught round 4 at all**.

So the amendment repeated the error in a narrower form: it widened the candidate set and left the completeness
sentence standing. Recorded because a rule about overclaiming that cannot cite its author overclaiming is itself
an overclaim.

## Distinct from #3341

[#3341](/backlog/3341/) governs **mechanism** claims — *"component X does Y by mechanism Z"* — and requires a
citation for Z. This governs **completeness** claims — *"every X does Y"* — where a citation is not the remedy,
because the sentence can cite a real predicate and still overstate its reach. Different species, different fix:
#3341 asks *where is your evidence*, this asks *what did you actually scan*.

## Worth pinning: the invisible invocation was documentation

The single invocation round 4 found invisible sits in a `type: feedback` agent memory describing the canonical
cross-repo delivery arc for Frontier UI and plateau-app. That is the worst possible location: an agent following
documented guidance lands on exit 3 / `unverified`, with nothing telling it to record a marker.

**Documentation that instructs an agent into a wedge is worse than an undocumented path**, because the agent has
no reason to doubt it and no signal that it has gone wrong.

## The count, recorded (Done-when 2)

`unqualified-completeness-claim` in `we:scripts/review-corpus/gates.mjs`, run over **all 3339 files in
`backlog/`: 12 findings (0.36%)**. Over the 576 `.mjs`/`.cjs` files under `we:scripts/` — the docblock half of
the scope — **10**. For scale, the sibling #3341 gate fires 17 on the same board and #3340 fires 0.

A first draft fired **25** on `backlog/`. Every cut is a named predicate defect, written into the gate's header
rather than a threshold: `branch` dropped from the candidate nouns (it means a decision fork or a code path here,
never a scan candidate — three false rows in one word); `finding` dropped for the same kind of reason (it is an
element of a review verdict, and *"every finding is resolved"* accounted for six of the script hits in one
phrase); `name` dropped from the verb slot (*"no function name"* is a noun-noun compound, and reading `name` as
a verb flagged #3341's own card); a capitalised word in the verb slot treated as a proper noun; the
"authoritative" shape requiring a checker noun in its own subject rather than anywhere in the sentence; quoted
spans allowed to wrap across a line; and a negator allowed to sit a few words in front of the quantifier, so an
honest *"they do not prove that every caller passes the flag"* is not punished for saying so.

**Adjudicated by hand, all twelve.** 6 true, 1 arguable, 5 false.

| card | the sentence, in brief | verdict |
| --- | --- | --- |
| #1574 :30 | *"No git pre-commit hook runs it"* | **true** — a universal about which checks exist, reached by looking, with no scan named |
| #1574 :54 | *"… is refused and no file is created"* | false — the result of ONE scenario, not a coverage claim |
| #1671 :32 | *"every referenced file exists"* | false — names what one test asserts; the candidate set is the manifest's own reference list |
| #194 :24 | *"No real network path is ever exercised."* | **true** — a coverage claim over a whole suite with nothing said about how it was checked |
| #2215 :22 | *"every item is gated before a lane claims it"* | arguable — a property of a proposed design, but stated as fact about all items |
| #2806 :307 | *"no registry entries exist anywhere today (verified above)"* | **true** — *anywhere* with no predicate; *verified above* points at a scan it never describes |
| #2895 :71 | *"every commit is the same account, on one PAT"* | false — a state claim about git history; fired because *identity check* sits in the same sentence |
| #2923 :105 | *"No zero-byte file is on `main` today"* | **true** — the archetype, minus the harvest that would make it checkable |
| #2949 :21 | *"Every item states how it will be proven done"* | false — the card's goal statement, a prescription in indicative clothing |
| #2985 :287 | *"No child item is carved"* | false — a slicing decision; *test* is incidental to it |
| #3118 :552 | *"The substance of every cited claim checks out at the new lines"* | **true** — a reviewer asserting every citation verified, with no count and no list |
| #3364 :52 | *"no caller passes it a card outside the harness"* | **true** — the species exactly, on a sibling card filed the same week |

**Does it flag this card?** No. That is a fact about the predicate, not a clean bill of health, and it is worth
being precise about why: the three overclaims reproduced above all sit inside quotation marks or table cells,
and the gate exempts both by design — reproducing a wrong sentence in order to correct it is the practice the
rule exists to reinforce, so punishing it would invert the rule. The rest of the body was re-read line by line
against the shapes the gate matches. Nothing turned up. That is one file read by hand, not a scan, and it is
recorded as such.

**What the predicate deliberately does not reach**, so a reader can see their own spelling is not covered: a
universal whose noun is outside the candidate list (*"every round shipped a claim"*); one whose verb is outside
the verb list, or separated from its noun by a relative clause (*"no caller that lands ships a bare
invocation"*); a coverage claim carrying no verification vocabulary at all (*"every caller now declares the
flag"*), admitted knowingly because without that word the sentence is indistinguishable from the thousands of
ordinary universals on a 3300-card board; and anything in the past or future tense.

## Done when

1. **Executable** — a gate over `backlog/*.md` and script docblocks flags an unqualified universal about a
   check's coverage (*"every"*, *"all"*, *"no … ships"*, *"authoritative"*) that names no candidate set, and
   **passes** a claim stating its scan and predicate. Both directions; the negative half is what stops the rule
   being satisfied by deleting the sentence rather than qualifying it.
2. The count flagged across the tree at landing is recorded here — if it flags hundreds, the predicate is wrong
   and this becomes noise, which is the failure #3308 measured.
3. `npm run check:standards` — 0 errors.
