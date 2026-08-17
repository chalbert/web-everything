---
bornAs: xvdn4un
kind: decision
status: open
dateOpened: "2026-08-05"
preparedDate: "2026-08-17"
relatedReport: reports/2026-08-17-machine-cleared-merge-holds.md
tags: [drain, review, escalation, statute, park]
---

# Amend #2563 — a machine park is the only available spelling of "wait for the panel" once the drain cannot spawn agents

`#blast-radius-advisory-care-not-a-gate` point 1 says scored signals "do **not** block the land on a review
verdict … just not a human park." Every escalating PR does block, and two rulings that tried to reconcile
that by re-reading the anchor's wording were struck. This amends the anchor instead. **No new design is
minted here:** the single fork below is grounded in a fresh prior-art survey published as
[`/research/machine-cleared-merge-holds/`](/research/machine-cleared-merge-holds/) (report
[`we:reports/2026-08-17-machine-cleared-merge-holds.md`](reports/2026-08-17-machine-cleared-merge-holds.md))
plus a 2026-08-17 re-grounding against the live tree, and it carries a **bold** recommended default.
Surfaced by the 2026-08-04 red-team of [#2572].

**Research and the adversarial passes reshaped this item rather than confirming it — it now offers the
decider *less* to weigh, not more.** Three candidate forks were drafted and two dissolved. The item's own
"bounded time" aside became a fork, then dissolved into a ratified *property* of Fork 1 once its remaining
content proved unobservable across the WE/FUI boundary; a fork on whether the anchor narrates the pre-flip
interim dissolved as prioritization in a fork's clothing. Both dissolutions are recorded under *Supported by
default* with the reasoning, so a decider who disagrees can promote either back. Two of the item's own
factual claims are also **withdrawn** — see *Corrections* in the Context section.

## The axis

One question, pinned to the live tree: **does point 1's prohibition bar *any* wait for a review verdict on a
scored PR, or only *parking the whole PR on a standing human clearer*?** Today an escalating PR is stamped
`review:pending` at open (`producerReviewLabel`, `we:scripts/lib/review-escalation.mjs:658-662`) and the
merge is refused until a verdict label arrives (`hasUnclearedReviewLabel`,
`we:scripts/lib/review-escalation.mjs:1394-1427`, operative logic at `:1423-1426`). The two readings
disagree about whether that is legal, and the anchor can only carry one.

It is decided against a backdrop that is **not** a fork, because no branch disputes it: the reviewing panel
cannot run inline in the land path. #2563's own ratified *Settled* section already placed it — "the trigger
is a separate scheduled agent-runner, not the daemon" — because the resident drain daemon is the sole
`main`-writer under its whole-process lease ([#2391]) *and* was deliberately de-scoped to spawn no agents
(`plateau-app:tools/drain-daemon/daemon.mjs:9`). That placement is *evidence* for the fork; it is
deliberately **not** written into the statute text, so the rule does not go stale if the topology changes.

## Recommended path at a glance

| fork | recommended default | main alternative | confidence |
| --- | --- | --- | --- |
| Fork 1 — what point 1 prohibits | **(a) The standing whole-PR human hold** — a wait a *non-human* reviewer clears is not what point 1 bars, provided it is bounded by a live reviewer, fails closed, and surfaces a breach as unsanctioned | (b) hold the strict reading and drop the wait for scored PRs entirely | High — (b) is disproven by measurement of the live corpus |

## Fork 1 — what point 1's prohibition actually reaches

**Fork-existence justification:** case (a), a **forced invariant** — the branches assign opposite legality to
the same shipped behaviour (an escalating PR either may wait for a verdict or may not), so they cannot
coexist in one anchor, and the alternative is *broken* rather than merely worse. Ratify, don't weigh.

- **(a) The bar is the standing whole-PR human hold — recommended default.** Point 1 prohibits a scored
  signal from **parking the whole PR on a standing human clearer**. A wait that a **non-human** reviewer
  clears is not that; it is how an out-of-process review is delivered. **Three standard-side properties are
  ratified with it**, because they are what makes the wait a review rather than a stall — and each is
  observable by anyone implementing or consuming the drain, so a conforming implementation can be told from
  a non-conforming one:
  1. **Bounded by a live reviewer.** The sanction holds only while the reviewer is demonstrably running. An
     unbounded wait is not a machine park; it is the standing hold this same rule prohibits, with nobody in
     the seat.
  2. **Fails closed.** An absent or unreadable verdict never reads as an accept.
  3. **A breach is surfaced as *unsanctioned*, and is never converted into a human hold.** A wait whose
     reviewer has stopped must be distinguishable from a live one, and re-labelling it `review:human` is
     barred — that label is sticky (`decideReviewGate` keeps waiting on it even after de-escalation), so
     the conversion would manufacture exactly the standing whole-PR human hold (a) prohibits. Landing it on
     a clock is likewise barred: that is the merge-anyway timer [#2425] removed ("landing unreviewed code on
     a clock is never the right failure mode", `we:scripts/lib/review-escalation.mjs:2022-2024`).
- **(b) The strict reading — an escalating PR may not wait at all.** Let it merge on the panel's advice
  without waiting for one. **Rejected: disproven by measurement.** The #2572 corpus scored the last 400
  first-parent merges: `none` 273 (68%, already never waits), `low` 8, `elevated` 46, `high` 73. So (b) lets
  ~32% of merges land with **no panel having looked**, because the panel cannot run inline — precisely the
  class point 3 of this same anchor exists to protect ("humans review large changes worse … so high-blast
  auto-lands run a diverse panel"). A milder version of (b) — releasing only the `low` band, 2% of PRs — was
  already ruled on #2572 and then **struck by its own red-team**, partly because the 8 observed `low` PRs ran
  428–863 lines and included `we:skills-src/jury/subject-jury.workflow.js` (+570), the jury that reviews
  everything else.

**Bold default: (a).** Two merits carry it. **(i) It protects the class point 3 exists to protect** — the
high-blast auto-lands the anchor itself says must meet a diverse panel — which (b) exposes. **(ii) The wait
is the only bar the non-scoring path respects**: a bare `we:scripts/merge-ai-prs.mjs` sweep sets
`REVIEW_ESCALATION = false` and never calls `decideReviewGate` at all, so `hasUnclearedReviewLabel`
(`we:scripts/lib/review-escalation.mjs:1394-1427`) is the single thing standing between a stale re-park and a
merge — drop the wait and that path loses its only guard. The prior art then confirms rather than establishes
the shape: nothing in the survey treats "a machine reviewer's verdict is a merge precondition" as the
gated-risk-score side of the advisory/blocking line — that line is drawn on **false-positive rate** (Google's
Tricorder ships advisory findings behind a <10% effective-false-positive bar; the no-false-positive tier is
promoted to compiler errors), not on whether a verdict is awaited.

**Proposed amendment text (the artifact this fork rules on):**

```md
**Amendment — a machine-cleared wait is the sanctioned spelling of "wait for the panel" (#2910, ratified
YYYY-MM-DD).** Point 1's "do not block the land on a review verdict" prohibits a scored signal from
**parking the whole PR on a standing human clearer** — not waiting as such, and not a human being involved
at all. Where the reviewing panel **cannot run inline in the land path**, the land may wait on a verdict an
**automated** reviewer supplies, provided the wait: (i) is **bounded by a live reviewer** — the sanction
holds only while that reviewer is demonstrably running; (ii) **fails closed** — an absent or unreadable
verdict never reads as an accept; (iii) on breach is **surfaced as unsanctioned**, never converted into a
human hold and never landed on a clock (the merge-anyway timer #2425 removed); and (iv) is subject unchanged
to the non-author bar of `#agent-convergence-independent-validation`, whose reviewer-identity enforcement is
itself still owed. **Untouched:** the trust-chain / statute human floor (point 2) and `review:human`;
**point 3's active point-level human check on high-blast auto-lands**; the fixed **non-zero decorrelated
human axis** and its post-land audit-sample option; and the pre-flip state `#enforce-flip-triple-gated`
(#2838) ratified, in which a human clears every `review:pending` until that triple gate arms — this
amendment governs the end-state legality of a machine-cleared wait and puts no pressure on that flip
predicate.
```

**How the wait is *spelled* is an implementation choice, not part of this ruling.** Today it is a
merge-blocking label; the item's original alternative was for the drain to consult the jury ledger directly.
Across the WE/FUI boundary those are the same wait delivered by two stores, so the statute rules on the two
observable properties above and lets the mechanism be judged against them. On the evidence, **the label
wins** and the ledger is rejected — recorded here as the argued rejection the item asked for, not as a
ratifiable branch. A bot-set/bot-cleared blocking label is ordinary (Prow/tide's `needs-rebase` is applied
*and removed* by a plugin with no human in the loop; Kodiak keys auto-merge on a label; Gerrit lets CI
service users cast the `Verified` vote submit requirements evaluate). The ledger shape has exactly one
production instance — GitHub **code-scanning merge protection**, a ruleset rule *explicitly not* a status
check, read from the alert store — and it fails both properties: no bound, with a permanent block on a result
that never posts as its best-documented failure (`github/codeql-action#1537`). Gerrit, usually cited *for* a
ledger, cuts the other way: its strength is that votes and submit evaluation share **one** store, and
Prow/tide, which splits decider from store, warns in its own docs that the two must be kept in sync. Locally
the ledger would also put the land decision on a read that already fails open to `[]` — the exact ambiguity
[`#converge-editor-enabled-at-low-only`](../docs/agent/platform-decisions.md#converge-editor-enabled-at-low-only)
had to make fail **closed**.

**Skeptic:** SURVIVES-WITH-AMENDMENT. An independent skeptic (`judgeSpawn`, own minted session id — not a
subagent) could not break (a) on merit but broke the *drafted amendment text* twice, and both fixes are
folded. **(1) The draft outlawed point 3 of the anchor it amends:** phrasing the bar as "a scored signal
*summoning a human*" makes point 3's own mandated point-level human check on high-blast auto-lands — itself
scored-signal-triggered — unlawful, so the anchor would contradict itself. Narrowed to "parking the whole PR
on a standing human clearer", with point 3 and the non-zero decorrelated human axis named untouched. **(2)
The draft implicitly declared #2838's ratified pre-flip state unlawful**, which a successor could cite as
pressure to rush the one switch that reduces human oversight — the outcome #2838's triple gate exists to
prevent; that state is now named untouched. Also folded: the premise no longer rests on a cross-repo file
header but on #2563's own ratified *Settled* clause, and the non-author bar is restated with its enforcement
gap disclosed. **Citation-scope correction:** #2838 is downgraded from *authority* to *supporting context* —
the screen this item applies to #2851 ("governs who clears, not whether a park exists") applies to #2838 by
the same test, since a rule regulating a wait's clearer *presupposes* the wait without *granting* it. (a) is
re-derived on merits (i) and (ii) above.
**Screen:** flagged(impl) → fixed → **clear on re-screen.** The screener is a second, independently spawned
`judgeSpawn` juror — its own process and minted session id — given the fork text with the verdict blocks
*mechanically* stripped before the spawn (the driver refuses to run if any trace survives the strip), so
"has not seen this session's authoring" is a property of the input rather than a promise in a prompt. **Round
1 flagged this fork impl-layered in two places:** the label-vs-ledger choice is invisible across the WE/FUI
boundary, and the draft amendment wrote an implementation topology fact
(`plateau-app:tools/drain-daemon/daemon.mjs:9`) into the statute, so the rule's meaning would change when
that topology changed. Both re-layered — the anchor now rules on properties a consumer can observe, behind
an abstract predicate ("where the panel cannot run inline"); the daemon evidence moved into this item's body;
and label-vs-ledger was demoted from a ratifiable branch to an implementation choice judged against those
properties, with the ledger's argued rejection preserved in full. **Round 2 returned `clear`** on both
questions, confirming the re-layer landed rather than merely reworded — and its `clear` on merit-vs-
prioritization is independent evidence that (b) is a real branch, not a scheduling question.

## Supported by default — not decisions, do not spend judgment here

- **The live-reviewer condition and its breach action — dissolved from a `## Fork` into Fork 1's ratified
  properties (2026-08-17).** This started as the item's own "*Also settle:* whether 'bounded time' is a
  stated SLO or left unspecified," was promoted to a full fork with two branches, and then dissolved on the
  fresh-context screen's second pass. The reason is worth recording, because it is a real methodological
  catch: **re-layering Fork 1 absorbed its substance.** Once Fork 1(a) ratifies "bounded by a live reviewer"
  as an observable property, the "unconditional" branch is no longer available — it contradicts the ruling
  one section up — so there is nothing left to weigh. What remained was the *breach action*, and with
  landing-on-a-clock and converting-to-a-human-hold both already barred by Fork 1's own properties, the only
  residue ("notify the operator") produces **no behaviour a consumer across the WE/FUI boundary can observe**
  — a WE-internal operational concern, not a standards call. So: the condition is ratified in Fork 1
  property 1, the two prohibitions in property 3, and what is left is a **build item** (below), not a
  decision. *(A decider who thinks the condition should be separately ratifiable can promote it back — the
  branch text and its prior-art case are in `we:reports/2026-08-17-machine-cleared-merge-holds.md`.)*
- **Whether the anchor names the interim — dissolved from a `## Fork` (2026-08-17).** A third fork was
  drafted ("does the amendment state that, pre-flip, a human clears every `review:pending`?") and the
  fresh-context screen dissolved it as **prioritization in a fork's clothing**: both branches state the same
  end-state rule and differ only on narrating a gap that exists solely because the clearer is not built yet
  — with the reviewer running and the flip armed, the added sentence and the silence produce the same anchor.
  It is also already stated in two ratified anchors ([#2838]'s "until the flip … a human still clears every
  `review:pending` PR", and `#fix-review-convergence-independent-root-cause`'s "routing to `review:human`
  remains the interim rail"). So it is not a call: **apply this file's existing convention** — an anchor
  carries a build-pending pointer where the running system does not yet match its letter, exactly as
  `#fix-review-convergence-independent-root-cause` already does — and add the sentence *until the triple gate
  of `#enforce-flip-triple-gated` arms, the hold is cleared by a human — the state #2838 ratified as the safe
  pre-flip default, not a defect of this rule.* Note the framing: **not** a "shortfall" or a violation.
  #2838 ratified pre-flip human clearing as the safe default and triple-gated the flip as "the ONE switch
  that reduces human oversight"; calling it a breach would recast a ratified safety stance as a defect and
  could be read as pressure to rush the flip. *(A repo-wide ruling on when **every** anchor must carry a
  build-pending block would be a real fork — over all anchors, not this one. **File at ratification** as its
  own `kind: decision` if wanted; it is out of scope here either way, since this item applies the existing
  convention rather than changing it.)*
- **The amendment mechanism.** An in-anchor `**Amendment — … (#NNN, ratified DATE).**` paragraph is settled
  precedent, used repeatedly in `we:docs/agent/platform-decisions.md` (e.g. the #2138 Fork-3 and #2149
  amendments against `#merge-risk-optimistic-with-targeted-lock`). Nothing to choose.
- **Handling.** Statute-layer edit → `review:human`, its own PR, never bundled with impl
  ([`#principle-and-impl-two-pr`](../docs/agent/platform-decisions.md#principle-and-impl-two-pr)).
  Preconditions: none — independent of the enforce flip, rulable before or after [#2572]'s scheduling work.
- **The trust-chain / statute human floor is untouched.** Point 2, `gate-self`, `statute` and `review:human`
  keep behaving exactly as they do. Both branches of both forks agree.
- **Two citation-scope downgrades, applied evenly.** Neither
  [`#human-required-is-judgment-only`](../docs/agent/platform-decisions.md#human-required-is-judgment-only)
  (#2851) nor [`#enforce-flip-triple-gated`](../docs/agent/platform-decisions.md#enforce-flip-triple-gated)
  (#2838) is cited here as **authority**. Both govern the *who-clears* axis; #2563 owns the *wait* axis
  (#2572's red-team, point 5). #2838 presupposing a wait while regulating its clearer is strong context, not
  a grant — and exempting it from the screen this item applies to #2851 would be exactly the selective
  citation that screen exists to catch. Not a choice; a consistency requirement.
- **The non-author bar is unchanged and its enforcement gap is disclosed, not papered over.**
  `#agent-convergence-independent-validation` still binds whoever clears; its reviewer-identity check is
  recorded in the statute as still owed. Sanctioning an automated reviewer does not grant a clear to any
  automated writer, and the amendment text says so.
- **Stale refs and a mis-citation, fixed on the spot** — see *Corrections* below. Not a choice.

---

## Context

### Corrections to this item's own premises (2026-08-17)

Two claims in the item's earlier body are **withdrawn**, and a third is narrowed. Recorded rather than
silently rewritten, because a successor citing the old wording needs to know why it changed.

1. **"The #2391 lease means the drain daemon cannot spawn agents" — withdrawn as a mis-attribution.** [#2391]
   (`resolved`) is a two-lock concurrency guard: a 5-minute numbering/merge-write mutex and a 15-minute
   whole-process drain lease (`we:scripts/readiness/drain-lock.mjs:1-38`). It says nothing about agents. The
   no-agent-spawning rule is a **2026-07-11 red-team de-scope** recorded only as a file header in the sibling
   repo — `plateau-app:tools/drain-daemon/daemon.mjs:9`: *"no agent spawning, no steering, no UI, no
   multi-project registry."* [#2563] cited this **correctly**; [#2572] and this item both re-cited it as
   "#2391." The conclusion is unaffected — both facts independently force the converging reviewer out of the
   drain process (the lease makes the daemon the sole `main`-writer; the de-scope makes it agent-free) — but
   the item must cite the right one, and neither belongs in the statute text (the screen's re-layering).
2. **"#2563 … a constraint the anchor did not model" — withdrawn.** #2563's own body models it explicitly,
   under a heading called *Settled (not forks — forced by an existing decision)*: *"The convergence runner
   converges + labels only; the resident daemon lands"* and *"The trigger is a separate scheduled
   agent-runner, not the daemon,"* both citing the daemon file. So the defect is **not** an unmodelled
   constraint — it is a **codification-fidelity gap**: the ratified item settled a wait-for-the-runner
   hand-off, and the anchor text compressed that away into a sentence that reads as inline. This
   *strengthens* the case for amending rather than reinterpreting: the amendment restores what the source
   decision already settled, so Fork 1(a) is closer to a restoration than a new grant.
3. **Line references had drifted** and are corrected throughout: `producerReviewLabel` is
   `we:scripts/lib/review-escalation.mjs:658-662` (item said `:307-311`); `hasUnclearedReviewLabel` is
   `we:scripts/lib/review-escalation.mjs:1394-1427` (item said `:564-569`). The substance of both claims
   still holds.

### The contradiction, stated plainly

[`#blast-radius-advisory-care-not-a-gate`](../docs/agent/platform-decisions.md#blast-radius-advisory-care-not-a-gate)
point 1 ([#2563], ratified 2026-07-18):

> Scored signals are advisory, not a gate. … they do **not** block the land on a review verdict. … the review
> still happens (via the loop), just not a human park.

Today an escalating PR carries `review:pending` from open (`we:scripts/lib/review-escalation.mjs:658-662`),
`decideReviewGate` returns `action: 'park'` and makes the wait **sticky on the label** — a de-escalated
`review:pending` PR still waits — and `hasUnclearedReviewLabel`
(`we:scripts/lib/review-escalation.mjs:1394-1427`) refuses the merge until `review:accepted` arrives. A
`none`-care PR does **not** wait (`producerReviewLabel` returns `null`), which the #2572 corpus measured at
68% of recent merges; so the accurate statement is *every **escalating** PR blocks*, not *every PR blocks*.

Note the anchor's own sentence carries both readings at once: "do not block the land on a review verdict" is
the strict one, "just not a human park" is the routing one. That internal tension is why re-reading the text
keeps producing different answers, and why only an amendment settles it.

### Why re-reading the wording cannot fix it — the record

Two successive rulings on [#2572] tried. The first quoted point 1's config-tightening clause ("`gate` means
route-to-a-human, never hard-block-with-no-reviewer") as if it were the rule; #2572's red-team struck that as
lawyering — the clause defines "gate" for an *opt-in tightening*, and the rule is the sentence before it. The
second leaned on #2851's human/machine axis to answer a wait/no-wait question; struck as off-axis. #2572's
own ruling then recorded the residue it could not fix: *"Dissolving still leaves scored PRs waiting on a
verdict, which contradicts #2563 point 1's letter … #2563 therefore needs an **amendment** stating that, not
a reinterpretation pretending it already allows it."* This item is that amendment.

One further correction to that record: #2572's ruling asserts the residue is *"already delivered by the
converge daemon clearing `review:pending` **mechanically**, which #enforce-flip-triple-gated ratified."* That
is a ratified *permission*, not a shipped fact — see the grounding table below. The permission exists; the
clearer does not run.

### The clearer is built but not running (verified 2026-08-17)

| claim | status | ref |
| --- | --- | --- |
| `runAutoLandSeam` has any production caller | **no** — only its own test | `we:scripts/lib/auto-land-seam.mjs:274` |
| the runner may enforce | **no** — hard-coded `LAND_MODES.SHADOW` | `we:scripts/lib/review-runner-core.mjs:113` |
| `landMode` | `"shadow"` | `we:scripts/lib/review-policy.contract.json:112-115` |
| `enforceFlipReady` (named by `#enforce-flip-triple-gated`) | **does not exist in the tree**; its impl item [#2893] is `open`, blocked on [#2892] (`open`) | — |
| an agreement ledger exists | **no** | `we:scripts/converge-daemon-pass.mjs:127-129` says so in-line |
| the converge daemon is scheduled | **no** — the launchd job was never installed | `we:scripts/converge-daemon-install.mjs:40-43` |

This is the evidence for the "never started" gap behind Fork 1 property 1, and the reason the anchor carries a build-pending
pointer (see *Supported by default*). It is a tree state, not a ruling.

### Implementation constraints the build child inherits (not part of the ruling)

Recorded here because they are real and were nearly ratified into the anchor by mistake — the fresh-context
screen re-layered them out.

- **Observe the reviewer, never the PR's age.** `decideReviewGate` is deliberately blind to how long a PR has
  waited, and `we:scripts/lib/__tests__/gate-invariants.test.mjs:113-130` pins it with `PARK_AGES` tripwires
  asserting a caller passing a park age "must change **nothing**." The condition that matters is observable
  on the reviewer's own side — *did a converge pass run within its interval?* — which the pass log already
  records (`we:scripts/converge-daemon-pass.mjs:124-132`, whose records carry `ranPass` and a refusal
  `reason`). So nothing in `we:scripts/lib/review-escalation.mjs` needs to learn about time.
- **A derived threshold derives at read time and never writes back.**
  `we:scripts/lib/review-policy.contract.json` is part of the declarative leash
  [`#human-is-principle-surface-not-path`](../docs/agent/platform-decisions.md#human-is-principle-surface-not-path)
  pins as a *whole file* — the pin #2838 calls load-bearing, because a contract that could leave the gate
  would make the most oversight-reducing edit agent-clearable. Only a mode selector lives in the contract,
  human-edited like every other key there.
- **Illustrative config shape** (a knob under the ratified invariant, not the ruling):

```jsonc
// review-policy.contract.json — careJury.disposition, ADDITIVE
"reviewerLiveness": {
  "description": "The live-reviewer condition a machine-cleared wait is sanctioned under (#2910 Fork 1 property 1). Observed quantity is the reviewer's own run record, NEVER a PR's wait age — decideReviewGate stays age-blind and its PARK_AGES tripwires stay green. There is no 'off': the condition is ratified, only its threshold is a knob.",
  "mode": "auto",              // 'auto' = derived at READ time from observed reviewer runtime (Mergify's p95+margin shape), never written back into this human-pinned file; 'fixed' = use maxStaleMinutes
  "maxStaleMinutes": null,     // only read when mode === 'fixed'
  "onBreach": "notify"         // the ONLY accepted value. Not 'merge' (that is #2425's removed timer) and not 'relabel' (a sticky review:human would manufacture the standing human hold Fork 1 bars)
}
```

### Statute neighbourhood — how the amendment composes

| anchor | relationship |
| --- | --- |
| [`#enforce-flip-triple-gated`](../docs/agent/platform-decisions.md#enforce-flip-triple-gated) ([#2838]) | **Supporting context, not authority** (citation-scope, applied evenly with the #2851 screen below). It governs *when* the runner may clear `review:pending` mechanically — the who-clears axis — so it **presupposes** the wait without **granting** it. Strong context for Fork 1(a); the controlling rule for the pre-flip state. |
| [`#converge-editor-enabled-at-low-only`](../docs/agent/platform-decisions.md#converge-editor-enabled-at-low-only) ([#2908]) | States point 1 in the routing reading — care signals "do **not** park a PR **for a human**," "diff size still never routes to the operator by label." **It carries the same unpatched fidelity gap:** pre-flip, a size-scored PR *is* labelled `review:pending` and human-cleared. Corroborates the reading, and is itself owed the same fix — see *Companion work*. Not offered as clean corroboration. |
| [`#human-required-is-judgment-only`](../docs/agent/platform-decisions.md#human-required-is-judgment-only) ([#2851]) | **Supporting context, not authority.** Two independent reasons: #2572's red-team ("governs *who clears*, not *whether a park exists*; #2563 owns the park axis"), and #2838's own composition note carving the interim out explicitly ("mechanical convergent review need not stay human *once the flip is safe*"). |
| [`#agent-convergence-independent-validation`](../docs/agent/platform-decisions.md#agent-convergence-independent-validation) | Unchanged and restated in the amendment: whoever clears is not the author. Its reviewer-identity enforcement is still owed, and the amendment discloses that rather than assuming it. |
| [`#event-driven-land-is-wake-only`](../docs/agent/platform-decisions.md#event-driven-land-is-wake-only) / [`#drain-daemon-self-hosting-boundary`](../docs/agent/platform-decisions.md#drain-daemon-self-hosting-boundary) | One polling drain stays the sole `main`-writer. This is *why* the reviewer is out of process, and Fork 1(a) preserves it — the automated reviewer supplies a verdict, the drain lands. |
| [#2425] (`resolved`, `bornAs` `x30jq9n`) | Not an anchor but a binding precedent: the merge-anyway timer was removed and the gate's age-blindness test-pinned. Fork 1 property 3 puts no clock on the land decision and says so. |

### What this decision authorizes (predicted touch-set, #2619)

- `we:docs/agent/platform-decisions.md` — the amendment paragraph on
  `#blast-radius-advisory-care-not-a-gate`. That is the whole of the statute PR.
- Ruling Fork 1(a) additionally carves **two build children** (two-PR rule), each with its own slice of the
  touch-set so they do not serialize against each other: one scoped to
  `we:scripts/lib/review-policy.contract.json` for the liveness knob, and one scoped to
  `we:scripts/converge-daemon-pass.mjs` for reading the reviewer's own run record and emitting the notify.
  **Deliberately excluded: `we:scripts/lib/review-escalation.mjs`.** The first draft scoped a child there;
  that is precisely the file whose age-blindness `we:scripts/lib/__tests__/gate-invariants.test.mjs:113-130`
  pins. Children are carved at ratification with those scopes, not now — a decision carries no build `scope:`
  of its own.
- No `we:docs/agent/jury-refinement-method.md` edit is owed: its three citations of this anchor are all to
  **Fork 2 of #2563** (diversity-selection, the point-level human check), which no branch here touches.

### Companion work this ruling implies (filed at ratification, not decided here)

`#converge-editor-enabled-at-low-only` restates point 1 in the routing reading and therefore carries the
identical fidelity gap against the pre-flip state ("diff size still never routes to the operator by label" —
yet a size-scored PR is `review:pending` and human-cleared today). Ruling Fork 1(a) makes that sentence
readable in the same end-state sense. **File at ratification:** a `kind: task` to add the same one-line
build-pending pointer to that anchor, scoped `we:docs/agent/platform-decisions.md`. Not a fork — the same
file convention applied to a second anchor. Recorded so it is not silently dropped.

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

### Handling

Statute-layer edit → `review:human`, its own PR, never bundled with impl. Preconditions: none — this is
independent of the enforce flip and can be ruled before or after [#2572]'s scheduling fork. On ratification,
set `codifiedIn` to the existing `#blast-radius-advisory-care-not-a-gate` anchor in
`we:docs/agent/platform-decisions.md` (an amendment against it, not a new anchor).
