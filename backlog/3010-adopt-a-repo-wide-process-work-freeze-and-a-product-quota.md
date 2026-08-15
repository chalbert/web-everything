---
bornAs: xh1d1el
kind: decision
size: 3
status: open
dateOpened: "2026-08-08"
preparedDate: "2026-08-15"
relatedTo: ["2907", "2606", "3012", "3013", "3049"]
relatedReport: reports/2026-08-15-3010-freeze-quota-prep.md
tags: [governance, throughput, backlog, statute-candidate]
---

# Adopt a repo-wide process-work freeze and a product quota

**No design survey applies — this decides internal delivery governance, not a browser-standard artifact, so
prep re-derives the item's own factual premise from git/PR history instead of surveying prior art (see
`relatedReport`).** One genuine fork plus one validation gate below, each with a recommended default in
**bold**. A fresh-context screen (run for real, not asserted — see each section's `Screen:`/reasoning) found
the original "Fork B" (the product quota) collapses under the zero-cost merit test to a **timing** question,
not a two-sided policy call, so it is prepared as a validation gate (go/no/**not-yet** + a concrete trigger)
rather than a `## Fork N` — see *Validation gate* below.

## Recommended path at a glance

| Item | Recommended default | Main alternative | Confidence |
| --- | --- | --- | --- |
| Fork 1 — freeze scope | **(a) repo-wide freeze, named exception list** | (b) keep #2907's review-pile-only scope | high |
| Validation gate — numeric product-lane floor | **not yet** — concrete trigger below | adopt a numeric floor now | med-high |

## Context — the premise, corrected

**The item's own founding numbers do not reproduce**, the same failure mode #3012 already found in its own
sibling figures. A repo-wide grep finds `"~70% of the open board (~305 of 430 items)"` in exactly one place —
this card — with no report or script behind it (`relatedReport` appendix, §1). The board has also moved: 476
`open` + 18 `active` = 494 in-flight items as of 2026-08-15, not 430, and no script in this repo classifies
backlog *items* as process vs. product (only committed *lines*, via `we:scripts/lib/output-mix.mjs`, are
classified). **Do not re-quote "70%/305 of 430."** What *does* hold up, re-derived fresh:

- **`we:scripts/lib/output-mix.mjs`'s `computeOutputMix()`**, re-run today at `origin/main` `cedc9524`: the
  week that #3012 could only read as a partial +48,641-machinery/+0-product row is now **complete** —
  **+0 product, +51,165 machinery**. This is the load-bearing number — **cite the completed week, not the
  current partial one**: like every partial row in this repo's output-mix history (#3012's own guidance),
  the current-week figure moves with every commit and did not reproduce identically across two re-runs
  minutes apart during this prep (independently re-verified by the skeptic pass below). Directionally it is
  still deep in the same regime — hundreds-to-low-thousands× machinery over product — just not a number to
  pin precisely. The drift has not self-corrected since the item was filed; the last *completed* week is
  worse than the one #3012 measured (0 product vs. an interpolated ~0 before).
- **The last 100 merged PRs span ~21 hours** (2026-08-14T20:06Z → 2026-08-15T17:26Z). A clear majority
  (60+ of 100) are `prepare #NNN …` titles — backlog-readiness authoring, not shipped product code; roughly a
  third more touch gate/review/drain/jury/statute machinery. This corroborates the line-level number; it
  doesn't replace it.
- The **statute-lint tail** A2 cites as "~25 items" is **11** today (open+active, tag `statute-lint`).
- Fork 1(a)'s named exception list, checked: #3007 (verdict ledger) `open`/unbuilt; #2979 (content-pinned
  accepts) `active`/largely landed; #2948 (proportional review) `open` epic; #3001 (named operations) `open`
  **decision — itself unresolved**, sitting on its own exception list.
- **Board headcounts are inherently point-in-time and moved twice during this prep session alone** (494 →
  508 in-flight items within the same hour) — treat any single-snapshot count, including the ones in this
  item, as directional, never as a stable board size to re-quote.

Full derivation and re-run commands: `relatedReport`.

## Supported by default — not forks

- **Hard prevention on backlog numbering / branch deletion / pushes to a constellation `main` is untouched by
  either fork.** Neither branch of either fork proposes loosening it.
- **Post-mortem *filing* stays allowed under both Fork 1 branches** — building the fix is what's gated, never
  naming the defect. Neither branch of Fork 1 contests this.
- **Enforcement is operator discipline at item-selection time, not new code, regardless of how either fork
  rules.** Neither the freeze nor the quota has (or is proposed to gain, by this decision) a code-level gate —
  confirmed by grep: no script under `we:scripts/` filters item selection by kind/tag/process-vs-product today,
  and the item's own "What resolving this produces" section already scopes a deterministic readiness-ranker
  input as a *possible later hardening*, explicitly not part of this call. Not re-opened as a fork here.
- **If/when the validation gate below flips from "not yet" to "go," the floor's *level* (half vs. above-half —
  the original B1/B3) is a config dimension, not its own fork.** Both are legitimate end-states of one knob
  (Q4 of the per-fork classification pass), so there is nothing to ratify beyond the trigger itself: the
  least-restrictive value that still moves the ratio — half — is the platform-default flavor, and tightening
  it later is a value change, not a re-decision. This dissolves the original B1/B2/B3 trichotomy: B2 collapses
  into the validation gate's "not yet" verdict below; B1/B3 collapse into "once the gate fires, start at half."

---

## Fork 1 — The freeze scope: repo-wide, or #2907's review-pile only?

**Fork-existence justification:** a real either/or, not a forced invariant. At any moment the operating rule
governing "may a new process-work item be opened" is either the wide filter or the narrow one — a PR-admission
policy can't run both at once (the wide one simply subsumes the narrow one when active), so this is a genuine
scope choice, not a support-both axis. **Fork 1 carries none of the validation gate's landmine** (below): its
enforcement mechanism is a *named* exception list, not the output-mix classifier, so it cannot mis-fire against
the conveyor/console work #3049 flags — a conveyor UI feature is `product` under #3010's own framing and isn't
"process work" that Fork 1 would touch in the first place. Q1 (standard-vs-impl) is not applicable — the
subject is this repo's own delivery governance, not a published web standard.

**Crux.** [#2907](/backlog/2907-review-pipeline-unblock-plan-critical-path-and-parked-design.md) already
states the rule at its current scope: *"open no PR that does not unblock an existing PR."* §3 of the report
found no code enforces this anywhere — it is pure operator discretion at item-selection time under either
branch.

- **(a) Repo-wide freeze with a named exception list.** The only admissible new process work is the
  load-bearing set (#3007, #2979, #2948, #3001 — see the status table above) plus anything that unblocks an
  open PR. Post-mortem filing stays allowed.
- **(b) Keep #2907's scope (review pile only).** Less disruption to items outside the review pile, but the
  11-item statute-lint tail (not the ~25 originally cited) and any new prevention items keep entering the queue
  uncontested, competing with product work exactly as they have been.

**Default: (a).** The re-derived data strengthens rather than weakens the original case: the freshest complete
week shipped zero product lines against 51,165 machinery lines, and a clear majority of the last 100 merged
PRs are backlog grooming, not code. (b)'s scope has been in force since #2907 and the ratio has not improved
under it — if anything it has worsened (7.2× → 66.5× → 58.0× → "no product at all" across the four completed
weeks). **But the case for (a) is not "wider scope alone fixes this" — the skeptic pass below found that
argument doesn't hold, and it's corrected here.** #2907's own text ("open no PR that does not unblock an
existing PR") is *already* being routinely disregarded under the current narrow scope — most of the recent
`prepare #NNN` PRs plainly don't unblock an open PR under that plain reading — and both (a) and (b) share the
exact same enforcement mechanism: pure operator discretion, no code, under either branch. So a wider rule isn't
obviously more *followed* than a narrower one that already isn't. **What actually recommends (a) is operational
legibility, not width**: a short, named, closed list (#3007/#2979/#2948/#3001 + "unblocks an open PR") is
something an operator can check at a glance at item-selection time, where #2907's relational test ("does this
unblock an existing PR") requires judgment every time and has visibly eroded. (a)'s cost — known gate holes stay
open longer — is bounded the same way the original item argued: the ledger (#3007) and the other three named
items close the worst class wholesale once built, rather than requiring a hole-by-hole admission fight in the
meantime. **#2907's own exit condition is confirmed still unmet** (PR #1031 closed, unmerged; #2572 still
`open`), so citing it as live authority for the narrower status quo is not a citation-scope problem — it just
hasn't reached its own stated expiry yet. One correction to the exception list itself: **#3001 is on the list
but is an unresolved `decision`, not settled work** — ruling (a) should read #3001's presence on the list as
"the *decision itself* stays open for filing/discussion," not as license to build named-operations
infrastructure before #3001 rules. Recommend the close-out ruling note this explicitly so the exception list
isn't read as pre-authorizing #3001's eventual outcome.

```
# illustrative — the operating rule under (a), evaluated at item-selection time, no code today
admissible(item) :=
     item.kind == 'post-mortem-filing'
  || item.id in { 3007, 2979, 2948, 3001 }         // the named load-bearing set
  || item.unblocksAn(openPR)
```

**Skeptic: SURVIVES-WITH-AMENDMENT.** A throwaway skeptic sub-agent, prompted only to refute and given repo
access to re-run every cited command, was actually run (not asserted) against (a). Classification and
statute-overlap held on independent re-check: a fresh grep of `we:platform-decisions.md` for "freeze" found
only the unrelated #2681 red-main dispatch-freeze and two `Object.freeze()` JS calls — no anchor governs
item-admission scope, so this stays a real binary fork, not disguised config. Citation-scope on #2907 was
verified directly (`gh pr view 1031`: `CLOSED`, `mergedAt: null`; #2572: `status: open`) — its exit condition
has not fired, so citing it as still-live authority is sound. **The skeptic's real find was a merit gap**: the
item's original argument implied wider scope alone would fix the drift, but the PR census shows #2907's
*existing* narrow rule is already being routinely ignored under identical (discretion-only, no code) enforcement
— so "wider" isn't obviously "better-followed." **Amendment, folded into the default above:** ground (a) in
operational legibility (a short named list beats a relational judgment call under discretion-only enforcement),
not in scope-width by itself.

**Screen: clear.** A fresh-context agent (no authoring history, evaluating the item cold) confirmed both
questions independently: (1) not an impl detail — the admissible-set is fully observable to anyone whose PR is
or isn't accepted for opening, the exact kind of governance-surface call this repo's decisions are for. (2) a
merit difference survives even at zero build/adoption cost — the two scopes produce materially different real
outcomes (gate holes exposed longer vs. uncontested queue growth) with no code either way, so it doesn't
collapse to a cost/timing question. The screen flagged one wrinkle, already folded into the default above: the
named exception list itself (especially #3001, an open decision sitting on its own list) behaves more like a
mutable artifact than a stable policy, though the binary wide/narrow toggle underneath survives as the real
fork.

---

## Validation gate — adopt a numeric product-lane floor?

**Digest.** **Verdict: not yet**, confidence medium-high. A numeric floor is directionally right — the drift is
real and, per the re-derived data above, has not self-corrected — but the only candidate enforcement instrument
(`we:scripts/lib/output-mix.mjs`, #3012) misclassifies the operator's own stated top-priority work (the
conveyor, the review/jury engine, the operation-declaration engine) as `machinery` rather than `product`, per
[#3049](/backlog/3049-the-conveyor-as-a-shippable-product-not-machinery-and-what-t/)'s directly-verified
measurement. Gating lane admission on a metric everyone already knows undercounts the stated priority is worse
than no gate. This flips to **go** once #3049's third-class question resolves — see *Recommendation*.

**What you're deciding.** Whether new lane admission is bound, going forward, by an enforced numeric floor of
product-classified lanes per week — the item's original B1 ("half"), B2 ("no floor, metric only"), B3 ("above
half").

**Why this isn't a classic fork (and is still a decision).** This was first drafted as a `## Fork N` (adopt now
vs. hold). A fresh-context screen, run for real against that draft, applied the standard zero-cost merit test:
imagine the output-mix classifier were fixed for free — does the disagreement between "adopt a floor" and
"don't" survive? **It doesn't.** With an accurate classifier, adopting now and adopting once-fixed converge on
the same answer; the only live content is *timing*, gated on a concrete, already-filed, external precondition
(#3049) — not two competing philosophies of how much process work is acceptable. That is the signature of a
one-sided go/no/not-yet call (the standing test's third archetype), not a merit fork, so it is prepared and
presented as a validation gate instead. (Fork 1 does **not** have this problem — its mechanism is a named list,
not the classifier, so its two branches carry a real, surviving merit difference; see Fork 1's own Screen note.)

**Context & prior-art delta.**

| Incumbent pattern in this repo | What it does | Delta from "adopt a numeric floor now" |
| --- | --- | --- |
| #2907 / Fork 1's freeze (above) | A named admission list, operator-enforced, no metric dependency | Doesn't rely on the broken classifier at all — why Fork 1 can rule now and this gate can't |
| #3012's output-mix board section (shipped 2026-08-09) | Metric-only, visible, no enforcement | Tried for six days; the ratio still worsened over that window (the four completed weeks: 7.2× → 66.5× → 58.0× → no product at all) — visibility alone hasn't reversed the trend, which is the real argument *for* eventually adding a floor once the metric is trustworthy, not against it |
| #3049's proposed "would this ship outside this repo?" test | An alternate classification axis, unbuilt | The candidate fix this gate is waiting on; not yet ruled |

**Dependencies & lineage.** Blocked in substance on #3049's open question 1 ("does the output-mix metric get a
third class, or does the product/machinery split stand with the conveyor understood as an accepted exception").
#2606 (delivery throughput & latency program) was considered and **rejected** as the trigger's owner — see
*Recommendation* — because its charter (verified by reading it in full) is scoped to queue→merged latency and
build-method adherence, not output classification; bolting this trigger onto it would be exactly the
citation-scope over-extension the skeptic pass below was run to catch.

**Recommendation.** **Not yet.** Un-gate trigger (concrete, not "someday"): #3049's third-class question
resolves — either the output-mix classifier gains a `product-in-disguise` class or an explicit conveyor +
review-engine exemption list is ratified, **or** the operator explicitly rules the current `machinery`
classification correct (rejecting #3049's thesis outright, not leaving it open). Either resolution removes the
mechanical-penalty objection. **Owner/cadence:** anchor the recheck to #3012's own board section — the next
progress-board review where an output-mix week reads at or worse than the current several-hundred-times-machinery
range — rather than inventing a new watch or mis-scoping an existing one. If/when the trigger fires, the floor's
level defaults to half per *Supported by default* above; that follow-up is a config value, not a fresh decision.

```
# illustrative only — no enforcement code exists or is proposed by this ruling either way
reopen_trigger := thirdClassRuledOnOutputMix(#3049) || operatorAffirms(conveyor_is_machinery)
if not reopen_trigger: quota_enforcement := 'metric-only (#3012 board section)'
else:                  quota_enforcement := 'numeric floor, level = half (config default)'
```

**Skeptic: SURVIVES-WITH-AMENDMENT.** A throwaway skeptic sub-agent, given repo access, actually re-ran the
cited evidence rather than accepting it on faith. Classification and statute-overlap held: re-verified against
`origin/main` `cedc9524` directly via `classifyPath`, `we:scripts/conveyor/status-board.mjs` /
`we:scripts/lib/jury-core.mjs` / `we:scripts/lib/review-core.mjs` / `we:skills-src/conveyor/SKILL.md` still
score `machinery`, `we:conformance-vectors/index.ts` / `we:wrapper-conformance/runner.ts` still score
`product` — #3049's finding is current fact, not stale; and a grep of `we:platform-decisions.md` found no
anchor already governing a product/machinery classification or a quota (the closest,
`#deterministic-core-thin-judgment` #2607, governs *how* machinery is built, not *how much*, a different test).
**Two real findings, both folded in above:** (1) *citation-scope* — the first draft's proposed owner for the
recheck cadence, #2606, does not have this in its authored charter (verified by reading #2606 end to end:
north star is latency + parallelism, Front B re-surveys *latency sources* and build-method adherence, neither
covers output classification) — reassigned to #3012's own board section, no new or borrowed charter needed.
(2) *evidence integrity* — the current-week output-mix figure first quoted in this item did not reproduce
identically on the skeptic's own re-run minutes later; corrected above to cite only the completed week as
load-bearing, with the partial week stated directionally, matching the caveat #3012 already states for its own
partial row.

## What resolving this produces

A short statute entry — Fork 1's ruling, plus the validation gate's verdict (today: "not yet, trigger = X";
later: the level, once the trigger fires) — promoted to
[we:docs/agent/platform-decisions.md](docs/agent/platform-decisions.md) with `codifiedIn:` set. Predicted
touch-set for that promotion (#2619): **`we:docs/agent/platform-decisions.md`** only — no script changes are
proposed by either the fork's or the gate's current recommendation (the output-mix classifier and board
rendering already exist and are unchanged by this ruling; a classifier update is #3049's territory, not this
item's). The board metric (#3012) stays the enforcement instrument for whichever way the gate eventually
resolves. Enforcement is operator discipline at item-selection time first; a deterministic readiness-ranker
input is a possible later hardening, not part of this call.

### Review jury (provisional — pre-registered #2638)

Care level: `high` (statute-surface edit — a `we:platform-decisions.md` change is always principle-surface per
#2840). This jury binds against the item's predicted scope and is re-checked against the real diff at PR open.

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
