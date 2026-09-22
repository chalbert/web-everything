---
bornAs: xq4aezx
kind: decision
parent: "3383"
status: resolved
scope: ["we:scripts/lib/review-core.mjs", "we:scripts/lib/__tests__/review-core.test.mjs"]
dateOpened: "2026-09-21"
dateStarted: "2026-09-21"
dateResolved: "2026-09-21"
codifiedIn: one-off
graduatedTo: none
preparedDate: "2026-09-21"
preparedAgainstSha: "12dd24e0e934a05a442335426480f6ef7e8e880b"
relatedTo: ["3813", "3280", "3814", "3815", "2860", "2967"]
tags: []
---

# Decision: adopt the review-lens rules from the PR #2392 and PR #2400 reviews (#3813)

Rule whether to add three review rules, and in what form. Story #3813 (filed as `3813`) proposes them and says it needs the operator's OK before any build. The operator reviews decisions only in decision cards (operator rule 9, 2026-09-21), so the choice moves here; #3813 stays the build card and is blocked by this one. **The options and the proposed default are copied from #3813; nothing was re-researched and the default was not changed.** One option, Fork 1 (b), was not in #3813's list; it was added when this card was filed and is marked as such.

**The three rules.**

1. **Header claim.** Any "never" or "still refused" claim in a file header needs a named test for that exact line. (From the PR #2392 review: the `assertReady` race guard in `we:scripts/operations/handoff-home.mjs` could be emptied, or its `throw diverged` line deleted, with all 14 and then all 24 tests still green.)
2. **State matrix.** A state-matrix check needs one test per cell. (Same review: the refusal to recreate `ops/handoff` when the branch is gone from origin but the working copy has history could be replaced by `if (false) {` with all 24 tests green; the "never pulled" test covers only the opposite cell.)
3. **Card sentences** (from #3813's "Further evidence", the PR #2400 review). Every "must not", "must use X rather than Y" and "never" sentence in a card's fix section or Done-when needs a Done-when case, named and with its exact fixture, that fails under Y (the wrong choice the sentence rules out). The card should also say that the case fails under Y, so a reviewer can check the claim by reading. Found on #3814 (a stale-tracking-ref check with no failing case) and #3815 (the janitor's "never removes a lane whose lease is live" guard was prose with no test). Both cards were amended afterwards.

## FOUND (from #3813, not re-run)

- The PR #2392 findings were raised by the security lens's juror; the correctness lens raised a neighbouring test-coverage finding on the same guard. The mutation probes are the review's; #3813 did not re-run them.
- The correctness lens already carries the bar "every changed branch is exercised, and no test is missing, weakened, or gamed to pass" (`LENS_EXPECTATIONS`, we:scripts/lib/review-core.mjs:1886). So the rules add no new bar; they give a juror the concrete methods to apply the existing one.
- Where a rule would live: `LENS_HUNT_BRIEF` (we:scripts/lib/review-core.mjs:1904, read by `huntBriefForLens` :1931 and used at :1108) has exactly one entry today, for `claim-accuracy`. A correctness entry would be the second. The existing brief test (we:scripts/lib/__tests__/review-core.test.mjs:1792) asserts every `LENS_HUNT_BRIEF` key is a panel lens and non-empty.
- The PR #2400 review notes that a deterministic gate is not feasible for rule 3, because these sentences are prose with no machine-readable form.
- Related open cards: #3280 (an "X already handles this" claim must line-cite; same file, extends `LENS_EXPECTATIONS`), #2860 (a `check:standards` gate on test titles that claim a refusal; different), #2967 (two `check:standards` rules from a PR #1064 review; same family, different rules).

## Recommended path at a glance

| Fork | Default | Main alternative, and why it is excluded |
| --- | --- | --- |
| 1 — adopt the rules, and in what form | **(a) a `LENS_HUNT_BRIEF` entry carrying all three rules** | (d) do not adopt: the gap was found only because one reviewer ran the probe |
| 2 — which lens carries them | **(a) the correctness lens only** | (b) correctness and security both: two copies of one prompt to keep equal |
| 3 — one edit with #3280, or its own edit | **(a) its own edit** | (b) folded with #3280: ties this rule to another card's timing |

## Fork 1 — Adopt the rules, and in what form

*Fork-existence:* the rules are either given to the reviewer (a prompt), given to the card author (a checklist), turned into a deterministic check, or not adopted. Each puts the rule in a different place, with a different enforcer.

- **(a) A review-lens hunt brief — recommended** (#3813's proposed default, its option (1)). A `LENS_HUNT_BRIEF` entry in `we:scripts/lib/review-core.mjs`, the mechanism `claim-accuracy` already uses. The juror must ground each "never" / "still refused" header claim by naming the test that reddens when that line is removed, by mutation probe; must expect one test per cell of a state matrix; and, per the Further evidence, must check that each card "must not / rather than / never" sentence has a Done-when case that fails under the wrong choice. Cheap; changes a review prompt. #3813's reason: (c) has no grammar to gate on, and (d) leaves the gap the review found open.
- **(b) A card-authoring checklist only** (added at filing; not in #3813's list). The three rules go into the filing guidance (`we:skills-src/file-item/SKILL.md`, `we:docs/agent/backlog-workflow.md`) for the author, and no review prompt changes. Rejected: every finding behind these rules was caught by a reviewer, not by the author, and a checklist binds the author once, at filing, with nothing checking it later; rules 1 and 2 are about source-file headers and tests, which a card checklist does not reach.
- **(c) A deterministic `check:standards` rule** linking a header claim to a named test (#3813's option (2)). Rejected: blocked, because a header "never" claim has no machine-readable form today, so the rule needs a header-claim grammar first; the PR #2400 review says the same for card sentences.
- **(d) Do not adopt** (#3813's option (3)). Rejected: it costs nothing, but the gaps were found only because one reviewer ran the mutation probe, so the next such gap is found only by luck.

**Skeptic:** not run as a separate pass on #3813. The one adversarial input on record is the PR #2400 review's note that a deterministic gate is not feasible for card sentences; it removes (c) and supports (a).

## Fork 2 — Which lens carries the rules

*Fork-existence:* #3813 asks it as a sub-question: its default puts the rules in the correctness brief, but the security lens's juror raised two of the three PR #2392 findings and both PR #2400 findings.

- **(a) The correctness lens only — recommended** (#3813's proposed default). The correctness lens already owns the bar "no test is missing, weakened, or gamed" (`LENS_EXPECTATIONS`, we:scripts/lib/review-core.mjs:1886); the rules are the method for that bar.
- **(b) Correctness and security each carry a copy.** Rejected (reason added at filing; #3813 asks the question but gives no reason): the rules are about test coverage, which is the correctness lens's bar, and two copies of one prompt must be kept equal by hand. The security juror still finds such gaps under its own charter, as it did here.

**Skeptic:** not run as a separate pass on #3813.

## Fork 3 — Built as its own edit, or folded into #3280

*Fork-existence:* #3813's default says "folded with #3280 if the operator prefers one edit". #3280 edits the same file (`LENS_EXPECTATIONS`, not the hunt brief). One edit or two is the operator's preference, so it is asked here.

- **(a) Its own edit — recommended** (the least invasive: #3813 names folding only as an option "if the operator prefers"). This card's build does not wait on #3280, which is a different rule in a different table.
- **(b) Folded with #3280, one edit to the correctness lens.** Rejected as the default, not on merit: one edit is tidier, but it ties this build's timing to #3280's. Pick it if one review of the correctness lens is preferred.

**Skeptic:** not run as a separate pass on #3813.

## Ruling

Ratified as written (operator, 2026-09-21) — all three forks on their recommended default:

- **Fork 1 — (a)** A `LENS_HUNT_BRIEF` entry carrying all three rules.
- **Fork 2 — (a)** The correctness lens only.
- **Fork 3 — (a)** Its own edit (not folded with #3280).

Red-team pass at ratification: checked each fork for a cost/effort-only downside masquerading as merit, and for an impl-detail-dressed-as-standard framing. Fork 2's "two copies to keep in sync" con is not the deciding reason — (a) is chosen because the rules are the correctness lens's existing test-coverage bar, and the security lens keeps finding the same gaps under its own charter regardless. Fork 3 is an explicit operator-preference call (own edit vs. folding into #3280's unrelated table edit), not a merit fork; no principle favors either shape. No fork rested on cost alone; no fork misplaces an implementation concern as a standards call (this is an internal review-tooling mechanism, not a WE/FUI/Plateau standard). Defaults hold unamended.

## Not in this decision

The build, its executable Done-when (written for (a) with the correctness lens) and its scope stay on #3813. The amended Done-when cases on #3814 and #3815 are already landed.

## Done when

1. **Executable** — `grep -l '^## Ruling' we:backlog/*adopt-the-review-lens-rules-from-the-pr-2392*.md` lists this card (it fails until the operator has ruled and a `## Ruling` section names the chosen option for each of the three forks).
2. #3813's `## Done when` is updated to match the ruling (rule 3 added to its case 1 if Fork 1 (a) is ruled), and #3813's `blockedBy` entry on this card is cleared when the ruling lands; if the ruling is (d), #3813 is closed instead.
