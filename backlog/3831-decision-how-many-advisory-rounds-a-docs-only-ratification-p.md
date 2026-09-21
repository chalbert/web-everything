---
bornAs: x4l7guc
kind: decision
parent: "3383"
status: open
relatedTo: ["3735", "3712", "3796", "3774", "2563", "2639"]
scope: ["we:scripts/lib/advisory-labels.mjs", "we:scripts/operations/operator-queue.mjs", "we:scripts/operations/review-pr.mjs", "we:scripts/conveyor/advisory-round-count.mjs", "we:scripts/conveyor/reconcile-core.mjs", "we:docs/agent/delivery-loop.md"]
dateOpened: "2026-09-21"
preparedDate: "2026-09-21"
preparedAgainstSha: "15895623afcdee3d7badbf8f3acb0ee1fe136027"
tags: []
---

# Decision: how many advisory rounds a docs-only ratification PR gets before the operator reviews it

Rule how many independent-advisory rounds a docs-only ratification PR gets before it reaches the operator. On 2026-09-21 the ratification of #3735 went through three superseding PRs (2388, 2401, 2407); each advisory returned human review required with three new findings, about 30 minutes of worker time and a new PR number per round, while the operator's own rule is to open a human PR only after advisory:accepted. Forks: a round cap that hands the PR over with its open findings listed, a split that lets findings about a not-yet-built card's Done-when text become follow-up items, keeping every round blocking, or relying on the operator to clear early.

*Prepared 2026-09-21 (session file-recurring-friction). No `/research/` topic: this rules a threshold in shipped internal machinery, so the grounding is the three PRs' own comment threads and the code, all re-read on 2026-09-21. The skeptic passes below are the preparer's own adversarial reads, not a separate skeptic agent.*

## FOUND (verified 2026-09-21, `gh pr view` on the three PRs and a read of the code)

- **Three rounds, one subject.** PR 2388 (branch `lane/ratify-3735`) was opened 15:23Z, got its advisory at 19:44Z and was closed at 20:18Z with the comment "Superseded by #2401". PR 2401 was opened 20:13Z, got its advisory at 20:21Z and was closed at 20:44Z as superseded by #2407. PR 2407 was opened 20:43Z, got its advisory at 20:47Z and is still open. Each carries `review:human` and no `advisory:*` label. The gap between opening 2401 and opening 2407 is 29 min 50 s: that is the "about 30 minutes" a round costs the workers. The first round took much longer (4 h 50 m) mostly because its advisory only ran 4 h 21 m after the PR opened.
- **Nine findings, by where they point.** Each advisory has three. Six point at a build card that is not built yet (the `3829` and `3828` cards): a Done-when case that is missing or a design line left open. Three point at the ratified text in `we:docs/agent/platform-decisions.md`: rule 4's rename handling (round 1, PLAUSIBLE), rule 8's stamp binding (round 2, CONFIRMED, impact broken), rule 3's "no merge drivers are configured" (round 3, CONFIRMED, impact degraded, reproduced in a scratch repo). Each round has exactly one CONFIRMED and two PLAUSIBLE finding. Round 1's CONFIRMED one is on a card (`3829`, rule 1's second-parent check has no Done-when case), not on the text.
- **What the filing brief said versus what the threads show.** The brief that asked for this card said only one of nine was a real error in the ratified text (rule 3). By where each finding points, three are on the ratified text, and rule 8's is the only one tagged "broken". Whether rules 4 and 8 count as "real errors" or as gaps is a judgment; the docket should not hide that the line between "the text" and "the card" is not clean (see Fork 1 (b)).
- **The panel's own verdicts.** Rounds 1 and 3: both mandatory lenses (correctness, security) accepted. Round 2: correctness returned `prevention-outstanding`, security accepted. The overall line was "human review required" every time. In all three the comment has no `**Advisory outcome:**` line, so `we:scripts/lib/advisory-labels.mjs` (`parseAdvisories`, `labelForOutcome`) maps it to no label. That is #3796 exactly, and it is why the loop ran: `evaluatePr` in `we:scripts/operations/operator-queue.mjs` puts a `review:human` PR with no advisory verdict in NOT READY, "agent work owed", so the orchestrator did the work again.
- **The existing cap cannot bind here.** `planReconcile` in `we:scripts/conveyor/reconcile-core.mjs` refuses at `attempts >= roundCap` (5, `NEGOTIATION_ROUND_CAP` in `we:scripts/lib/jury-core.mjs`), where `attempts` includes `countAdvisoryComments` (`we:scripts/conveyor/advisory-round-count.mjs`). That counts advisory comments on ONE PR's thread. Each of the three PRs has exactly one, so the count was 1 each time and never reached 5. A superseding PR restarts the count by construction.
- **"Superseded by" is free text.** The link between the three PRs exists only as the orchestrator's closing comments (verified on 2388 and 2401). No field or marker ties a PR to the one it replaces.
- **The operator can already clear any human PR.** `we:scripts/review-set-label.mjs` never reads an `advisory:*` label (a text search finds none): its `clear-human` target needs an operator instruction quoted as `--reason` and nothing else. `we:scripts/operations/operator-queue.mjs` is a filter on what deserves the operator's attention, not a gate on clearing.
- **An existing rule points the same way but does something else.** `we:docs/agent/delivery-loop.md` ("When to stand down instead of iterating"): three rounds on one defect class without convergence is the signal to stand down: restore the previous behaviour, record the attempts and close the PR. Six of the nine findings here are one class (a ratified rule's wording against a not-yet-built card's Done-when). That rule tells an implementer when to stop; it does not say what the operator receives.

## Recommended path at a glance

| Fork | Default | Main alternative, and why it is excluded |
| --- | --- | --- |
| 1: how many advisory rounds before the operator gets the PR | **(a) a round cap of 2 per subject: at the cap the PR is handed to the operator with its open findings listed** | (b) findings on a not-yet-built card become follow-ups: in this incident every round still had a finding on the ratified text, so no round is removed |

## Supported by default, not forks

- **The operator may clear any human PR at any time, whatever the advisory says.** Already true (see FOUND). It stays true under every option, and this decision does not touch it.
- **The cap value is a configuration number, not a fork.** The default is 2, the operator's own example. It does not change this incident (2 and 3 both hand PR 2407 over), so it is tuned on later incidents, not ruled here.
- **Code PRs are out of scope.** A finding on code is a real bug; a docs-only ratification's findings are gaps in text and design lines. The existing per-PR cap of 5 and the `review:human` escalation stay as they are for anything that changes code.
- **`advisory:accepted` keeps its meaning:** no blocking findings on the current head. Nothing here lets an advisory set `review:accepted` or clear `review:human`.
- **The build waits on #3796.** The three PRs got no advisory outcome at all, so no cap can convert a round that has no verdict. #3796 settles how a `review:human` advisory records an outcome; the rounds contract below is ruled now and built after it.

## Fork 1: how many advisory rounds a docs-only ratification PR gets before the operator reviews it

*Fork-existence:* the operator opens a human PR only after `advisory:accepted`, and today an advisory that finds anything keeps the PR out of their list. Either there is a bound on how many rounds that can go on, or there is none; a cap and "every round blocks" cannot both be the rule. Not choosing is a choice: it leaves a loop with no end that this incident shows is real, each round finding new things by design.

- **(a) A round cap per subject, then hand over with the findings listed. Recommended.** Count the advisory rounds a subject has had across superseding PRs, not per PR. When the count reaches the cap (default 2) and the round's mandatory lenses all accepted, the advisory records a third outcome, `advisory:accepted-with-open-findings`: the PR goes to the operator's NEEDS YOU with "N open findings" in its row, and the advisory comment lists every finding with its CONFIRMED or PLAUSIBLE tag and its impact. It never sets `review:accepted` and never clears `review:human`. A round in which a mandatory lens said anything but accept (`changes`, `needs-human`, `prevention-outstanding`) does not convert; it stays open as today. If the operator sends the PR back, the count starts again, because that is a human verdict, not an advisory round. In this incident: round 2 (correctness said `prevention-outstanding`) would stay open; round 3 (PR 2407, both lenses accepted) would go to the operator now, with rule 3's false claim listed as CONFIRMED, instead of starting a fourth round. **Cost:** a third label and a queue row change; the round count must follow a supersession link that does not exist yet (today "Superseded by" is a free-text comment), and the operator's rule in `we:docs/agent/delivery-loop.md` is amended to "advisory:accepted or advisory:accepted-with-open-findings". **Accepted cost, named:** a confirmed defect can reach the operator before it is fixed. It arrives listed and tagged, on a PR the operator reads anyway; the alternative is the unbounded loop.
- **(b) Findings that only concern a not-yet-built card's Done-when text become follow-up items and do not block; only findings about the ratified text or the code do.** Rejected on merit. In this incident it removes no round: each of the three rounds had a finding on the ratified text (rules 4, 8, 3), so each round would still have blocked. It also needs a classifier that tells "about the card" from "about the text", and the anchor is not the concern: round 1's only CONFIRMED finding is anchored on a card but is about rule 1 (the ratified rule has a clause no test defends), and round 2's rule 8 finding is anchored on the text but rests on a card's design line. A reviewer that finds one new ratified-text defect per round is still unbounded under (b). It is not excluded as a later refinement layered on (a), to shorten the list handed over.
- **(c) Keep the current rule: every round blocks.** Rejected on merit. Nothing bounds it across superseding PRs: the only cap counts one PR's thread and each PR here had one advisory. The loop ends only when a round happens to return no findings, and none of the three did. Its one advantage, that everything is fixed before the operator looks, is the property the operator is giving up time for.
- **(d) Rely on the operator clearing a PR early, with no new rule.** Rejected on merit. It is already available and stays available (see above), but as the policy it asks the operator to notice a PR that their own queue hides: NEEDS YOU lists a `review:human` PR only with `advisory:accepted`, so a PR in the loop is invisible until the operator goes looking. That is manual watching, which the queue exists to remove.

**Default: (a).**

**Skeptic:** SURVIVES-WITH-AMENDMENT → applied. Attack 1, the evidence is one incident (n=3 rounds): accepted, so the cap value is a config number to tune and the default is the operator's own example. Attack 2, a cap can launder a confirmed-broken finding to the operator: applied, in two ways, a round with a non-accepting mandatory lens never converts (round 2 here would not have), and the findings ride the PR with their CONFIRMED tag and impact. Attack 3, a superseding PR resets the count, so an orchestrator that omits the link defeats the cap: accepted as a build requirement; the count needs a machine-readable link, and a PR without one must fail visible in the queue row, not read as round 1. Attack 4, the operator's "one of nine" reading would make (b) look stronger than it is: answered in FOUND, the count by where findings point is three of nine, one per round.
**Screen:** clear. The fork is policy the operator sees: how many rounds, and what they receive at the end. The label name, the supersession link and the cap's configuration key are build notes, not ruled. The prevention that the advisory names for these findings (a review rule that maps each numbered rule of a ratification to a test on its build card) is a separate lens proposal and is NOT part of this decision.

## Not in this decision

- Whether the reviewer should stop reporting Done-when gaps of not-yet-built cards at all, or a review-lens rule for ratification PRs. That is a separate proposal, and it needs its own decision card.
- How a `review:human` advisory records an outcome in the first place: #3796.
- The rule-3 fix itself (`info/attributes` can select a merge driver): that is the open PR 2407's job, not this card's.

## Done when

1. **Executable** — `grep -l '^## Ruling' we:backlog/*advisory-rounds-a-docs-only-ratification*.md` lists this card (it fails until the operator has ruled and a `## Ruling` section names the chosen option for Fork 1).
2. The ruling's build work is filed as a story under #3383, `blockedBy` #3796 when option (a) is chosen, with its own Done-when (a test that a docs-only PR at the cap with all mandatory lenses accepting gets `advisory:accepted-with-open-findings`, and one that a non-accepting lens or a code diff does not).
