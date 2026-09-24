---
bornAs: xjldlfi
kind: decision
parent: "3690"
relatedTo: ["3867", "3949", "3673"]
blockedBy: ["3949"]
status: open
scope: ["we:scripts/lib/provider-routing.mjs"]
dateOpened: "2026-09-24"
preparedDate: "2026-09-24"
preparedAgainstSha: "b97e0026bb8964f8726bd1dc3ea3d0faa248b0d5"
relatedReport: reports/2026-09-24-delegation-post-miss-root-cause-classification.md
tags: [delegation, supervision, graduation, root-cause, decision-prep]
---

# A tooling-caused delegation miss re-graduates on the normal bar once the fix is proven

No design exists yet for splitting rule 5's post-miss bar by root-cause kind. Six forks below are grounded
in the prior-art survey published as
[/research/delegation-post-miss-root-cause-classification/](/research/delegation-post-miss-root-cause-classification/)
(session report: `we:reports/2026-09-24-delegation-post-miss-root-cause-classification.md`), which extends
the #3690 survey and does not repeat it. Each fork carries a recommended default in **bold**. Operator
direction (2026-09-24): demotion should not be the first avenue — most misses are fixed by improving
tooling/instructions, not by distrusting the vendor — while the automatic step-back stays as a cheap safety
net.

**Builds on, does not re-decide, [#3673](/backlog/3673-define-what-clears-a-triggered-calibration-veto-so-a-role-ca/)**
(codified at
[#calibration-veto-clearing](/docs/agent/platform-decisions/#calibration-veto-clearing)), which already
ruled, for the sibling calibration-veto mechanism rule 5 explicitly borrows its principle from
(`we:docs/agent/platform-decisions.md:4964-4966`): a documented root-cause finding is a mandatory
precondition before any post-miss trial counts (its Fork 1), clearing needs a trial specifically targeting
a case similar to the trigger, not just any N clean trials (its Fork 2), decay/time alone never clears a
veto (its Fork 3), and a human override is available only as a narrow factual reclassification of the
trigger, never a trust grant (its Fork 4). Forks 3 and 5 below are this card's direct extension of #3673
Fork 2's "similar-case trial" principle and Fork 4's "no self-serving reclassification" principle to the
delegation-trial record; neither re-opens #3673's own ruling.

**Blocked by [#3949](/backlog/3949-delegation-trial-logging-stops-once-a-triple-graduates-and-n/).**
`we:scripts/review-set-label.mjs:1129-1130` logs a session-delegation trial only while
`!isDelegationTripleGraduated(...)`, so once a triple graduates no further rows are written and no row ever
records a miss — rule 6's computed demotion (`we:docs/agent/platform-decisions.md:4967-4974`) cannot fire at
spot-check today. Until #3949 lands, this card's ruling has no live effect: there is no code path by which a
graduated triple's miss reaches the record this ruling reads.

## Axes

Three orthogonal axes, each pinned to the real tree:

- **The step-back mechanism** — `we:scripts/lib/provider-routing.mjs:816-821`'s hard veto and
  root-cause-precondition branches inside `selectSupervisionLevel`.
- **The post-miss bar** — `we:scripts/lib/provider-routing.mjs:148-158`'s `DEFAULT_BACKDOWN_THRESHOLDS`
  (`minCleanStreak`, `k`) and `:804-810`'s `requiredCleanStreak` computation, gated today only by
  `hasRootCauseNote` (`:339-342`) with no split by what the root cause names.
- **The promotion act** — rule 6 (`we:docs/agent/platform-decisions.md:4967-4974`): demotion computed and
  immediate, promotion an explicit ratified act, never automatic per trial.

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
| --- | --- | --- | --- |
| 1 — Does the automatic step-back still fire unconditionally? | The automatic step-back to `full` on any confirmed miss **stays unconditional** — a cheap safety net; demotion means only that the blocking full review returns, delegation continues | Skip the step-back for a miss suspected tooling-caused | High |
| 2 — Who classifies tooling vs vendor, and is it gameable? | A required `rootCauseClass` field, **human-authored, fails closed to `vendor` when missing, and a `tooling` class must cite a concrete landed fix** — never inferred or self-declared by the automation, provider, or orchestrator | Infer the class from the `rootCause` note's free text, or let any interested party self-declare it | High |
| 3 — What does "proven on the live case" require? | At least one post-fix clean trial **specifically targets the triggering failure mode**, with the targeting claim confirmed by the rule-6 act (tooling path only) | Any N generic clean trials of the triple's ordinary taskType | High |
| 4 — Is the re-entry bar exactly cold-start, or can it be lower? | A named **`toolingReentryStreak` config entry, defaulting to `minCleanStreak`**, tunable only by a future ordinary batched finding — never fixed to a number by this card | Cold-start is a hard, permanent floor with no lower door ever | Med-high |
| 5 — Does a shared tooling fix reset other affected triples? | **No automatic cross-triple reset** — the root-cause finding may be referenced across every affected triple's row, but each triple accumulates its own post-fix trial evidence | A tooling fix proven for one triple auto-clears/lowers the bar for every triple sharing that cause | High |
| 6 — Does post-miss restoration bypass rule 6's ratified-act requirement? | Post-miss restoration **stays a rule-6 promotion**, and that act is **where a human confirms both the `rootCauseClass` and the targeting claim** — never automatic purely on the computed streak | The computed streak alone flips a demoted triple back to `spot-check`, no explicit act | Med-high |

## Fork 1 — Does the automatic step-back to `full` still fire unconditionally on every confirmed miss?

**Why this is a real fork.** The alternative — skip the automatic step-back for a miss suspected
tooling-caused — is the excluded branch: it contradicts rule 3's already-ratified "A confirmed miss resets
the triple at once; it is never averaged into a score" (`we:docs/agent/platform-decisions.md:4950-4956`) and
rule 5's own text that this is "the same principle as
[#calibration-veto-clearing](/docs/agent/platform-decisions/#calibration-veto-clearing), applied to a
delivery trial" — #3673 Fork 3 already forecloses letting anything short of affirmative clean-trial evidence
substitute for the veto's clearing. A pre-emptive "don't even step back, we suspect tooling" would be exactly
that substitution, decided before any evidence exists.

- **(a)** Skip the automatic step-back to `full` when the miss is suspected (not yet proven) tooling-caused,
  so delegation continues uninterrupted while the root cause is investigated. **Rejected**: contradicts rule
  3's "resets at once" hard veto and the anti-dilution principle #3673 Fork 3 already applied to exactly this
  mechanism family; it would also make the veto's firing depend on an unverified guess about cause, the same
  shape #3673 Fork 4 rejects for override ("no identity buys an easier bar" — no *guess* buys skipping the
  bar either).
- **(b)** **The automatic step-back to `full` on any confirmed miss (rule 3's existing hard veto) stays
  exactly as ratified, unconditional on suspected cause** ← **RECOMMENDED**. What changes under this card is
  only how the triple gets *back* to `spot-check` (Forks 2–4), never whether the miss demotes it. Demotion
  here is deliberately cheap and narrow in effect: rule 2 (`we:docs/agent/platform-decisions.md:4945-4949`)
  already establishes that a supervision level moves only *how much checking* a delegated draft gets, never
  *whether* it may be delegated at all — so "the triple steps back to `full`" means the blocking, full
  independent review returns for that triple's work, not that delegation stops. This is the operator's own
  framing ("demotion here only means the full, blocking review returns — delegation continues").

**Skeptic:** SURVIVES (real skeptic sub-agent). Classification axis pressed hardest: branch (a) is already
excluded by ratified rules 3 and 6, so this is a forced-invariant confirmation, not an open merit choice —
accepted, and matches the fork's own justification above (the sanctioned "forced invariant" fork shape, not
a bare ratify demoted out of the fork sections). No merit, statute-overlap, or citation-scope attack landed.
**Screen:** clear — a genuine policy question (does the veto still fire on a mere unverified suspicion of
cause), and the merit (an unverified guess would substitute for evidence) survives stripping timing and
build cost (fresh-context agent, #2091).

## Fork 2 — Who classifies a confirmed miss's root cause as tooling vs vendor, and how is that not gameable?

**Why this is a real fork.** Two coherent-looking mechanisms for populating the classification cannot both be
authoritative: either the field is a fact a human records (reviewable, disputable, narrow), or it is
produced automatically from data already in the row (cheap, but exactly the party under review supplying its
own verdict). They are mutually exclusive designs for the same field, and the choice materially changes
whether rule 5's higher bar can be evaded.

- **(a)** Infer the classification from the free-text `rootCause` note (keyword match), or let the dispatch
  automation, the delegated provider's own session, or the orchestrating session self-declare it. **Rejected**:
  self-certification by any interested party — the same channel #3673 Fork 1 already closed for the
  underlying `rootCause` field itself ("never inferred from a later row's `findings`"); inferring the *class*
  from that same free text reopens the identical hole one field over. Gameable concretely: every miss could
  be worded to read "tooling," always drawing the lighter bar, which would functionally erase rule 5's higher
  post-miss bar for vendor causes — and no party that could write the field is disinterested in the outcome.
- **(b)** **A required `rootCauseClass: 'tooling' | 'vendor'` field, written only by a human, with a
  `'tooling'` classification citing a concrete landed fix (a PR or commit reference) rather than bare prose,
  and a missing/absent field failing closed to `'vendor'` (the higher bar) — never inferred, never
  self-declared, and never defaulting lenient** ← **RECOMMENDED**. Mirrors rule 4's shape ("its own recorded
  field... never inferred"). Writing "only by a human" is not itself enforceable by the logging CLI (nothing
  checks who invoked it) — the actual enforcement point is Fork 6's rule-6 ratified act, which confirms the
  classification before restoration; this field records the claim the act then checks. **Authority, corrected
  by the skeptic pass:** `#model-probation-graduation-criteria`'s "promotion is always an explicit human
  decision grounded in accumulated data, never automatic" and
  [#agent-convergence-independent-validation](/docs/agent/platform-decisions/#agent-convergence-independent-validation)
  clause 1 ("a distinct fresh validator") are the on-point anchors; `#agent-vendor-registry` rule 3 governs a
  vendor descriptor module's own declared fields, a narrower turf that does not reach who classifies a miss,
  so it is supporting context only, not cited as authority.
- **(c)** No classification field at all — every root-cause note gets the lighter, tooling-shaped bar.
  **Rejected**: erases rule 5's post-miss-bar distinction outright; a "the model just made a bad call" note
  would always graduate at cold-start, which the operator's own direction explicitly excludes ("the higher
  bar applies... when the root cause is the vendor itself").

```js
// Illustrative shape only — mirrors hasRootCauseNote (scripts/lib/provider-routing.mjs:339-342, this repo).
// The real field, predicate and CLI flag are future build work under this ruling, not authored here.
function hasToolingRootCause(record) {
  // Fail-closed: an absent/invalid class is never treated as tooling.
  return hasRootCauseNote(record)
    && record.rootCauseClass === 'tooling'
    && typeof record.rootCauseFixRef === 'string' && record.rootCauseFixRef.trim() !== '';
}
// Written only via the human-authored CLI path, mirroring #3889's --root-cause flag:
//   node scripts/conveyor/log-delegation-trial.mjs ... --root-cause="..." \
//     --root-cause-class=tooling --root-cause-fix-ref="PR #1234"
// Never derived from `findings`, never set by the delegated session or the orchestrator itself; the CLI
// cannot enforce "a human ran this", so Fork 6's rule-6 act is the real checkpoint that confirms it.
```

**Skeptic:** SURVIVES-WITH-AMENDMENT (real skeptic sub-agent). The attack found "written only by a human" is
not enforceable by the CLI path alone — nothing in the logging tool checks who invoked it, and the
orchestrating session itself (not only "the automation" or "the delegated provider") is an equally interested,
previously-unnamed party. Citation-scope: `#agent-vendor-registry` rule 3 governs a vendor descriptor's own
declared fields, not who classifies a miss — downgraded to supporting-only as shown above; the on-point
authorities (`#model-probation-graduation-criteria`, `#agent-convergence-independent-validation` clause 1)
are cited instead. Fixed by: a missing/absent `rootCauseClass` fails closed to `vendor`; a `tooling`
classification must cite a concrete landed fix, not bare prose; and enforcement is moved to Fork 6's rule-6
ratified act, which is the only point in the mechanism where a human checkpoint structurally exists.
**Screen:** clear — a genuine externally-observable policy question (who may set the bar-determining field,
and on what evidence), and the merit (self-certification vs. independent confirmation) survives stripping
timing and build cost.

## Fork 3 — What does "proven on the live failing case" require, concretely?

**Why this is a real fork.** A generic clean-trial count and a trigger-targeted trial are mutually exclusive
readings of what counts as proof; option (a) reopens the same selection-bias gaming rule 5 exists to
prevent, on its own merits — independent of any one sibling card's exact mechanics (see the skeptic
correction below on how far the #3673 analogy reaches).

- **(a)** Any N clean trials of the triple's ordinary taskType count as proof the fix worked, with no
  requirement they resemble the failure that triggered the miss. **Rejected**: a fix "proven" only by
  unrelated, easy trials is not evidence the fix addressed the actual failure — the same selection-bias
  shape #3673 Fork 2(a) was rejected for in the sibling calibration-veto mechanism, offered here as a
  supporting analogy, not as rule 5's literal inherited mechanic (rule 5's ratified text borrows #3673's
  root-cause-and-higher-bar principle, not specifically its similarity-trial clause).
- **(b)** **At least one post-fix trial specifically targets the triggering failure mode** — the same task
  re-attempted, or (mirroring #3673 Fork 2(b)'s scarcity allowance, cited as analogy) a deliberately
  constructed case exercising the same tooling/instruction gap when the exact live case cannot literally be
  re-run ← **RECOMMENDED**. The trial's row records what it targeted; because self-tagging a row is exactly
  as gameable as Fork 2's self-declared classification, the claim that a trial actually targeted the trigger
  is confirmed by the same rule-6 ratified act Fork 6 names, not taken on the row's own say-so. **Scope
  note:** the vendor-caused path does not get this same targeted-trial requirement layered on top of its
  already-higher `minCleanStreak + k` bar — that higher streak is that path's own safeguard, and extending
  Fork 3 to it would exceed what the operator's direction and rule 5's existing text ask this card to decide.

```js
// Illustrative shape only — future build work, not authored by this card.
// A post-fix trial counts toward the tooling-proven re-entry bar only when it cites what it targeted,
// AND that citation has been confirmed by the rule-6 ratified act (never taken on the row's own say-so).
function isProvenAgainstTrigger(record, triggerHandle) {
  return isCleanRecord(record) && record.provenAgainst === triggerHandle && record.targetingConfirmed === true;
}
```

**Skeptic:** SURVIVES-WITH-AMENDMENT (real skeptic sub-agent). The attack found `provenAgainst ===
triggerHandle` self-tagged by whoever logs the row is the identical self-declaration hole Fork 2 closes,
reopened here. Citation-scope: rule 5's ratified text borrows #3673's root-cause-and-higher-bar principle,
not literally its Fork 2 similarity-trial mechanic — this card had over-cited that as direct lineage rather
than a supporting analogy; downgraded above, and the fork now stands primarily on its own selection-bias
merit. Fixed by tying the targeting claim's confirmation to the same rule-6 act Fork 6 names, and by
explicitly scoping the requirement to the tooling path only (added above), rather than silently expanding it
to the vendor path.
**Screen:** clear — a genuine correctness/gameability question (what counts as evidence the fix worked), and
the merit survives stripping timing and build cost.

## Fork 4 — Is the tooling-proven re-entry bar exactly the cold-start bar, or can it go lower ("or shorter")?

**Why this is a real fork.** The operator's own phrasing ("the normal cold-start bar or shorter") leaves two
coherent readings open, and rule 3 already establishes the general mechanism for exactly this kind of
question — "The streak length N is a `backdownThresholds` config default... proposed and changed by an
ordinary batched finding against real data, never by a decision ceremony"
(`we:docs/agent/platform-decisions.md:4950-4956`) — so the excluded branch is the one that would carve a
silent, permanent exception to that general mechanism with no stated reason.

- **(a)** **A named `toolingReentryStreak` entry on `DEFAULT_BACKDOWN_THRESHOLDS`, defaulting to
  `minCleanStreak` (so today's behavior is "exactly cold-start" until data says otherwise), tunable only by
  the same future ordinary batched finding that already tunes `minCleanStreak`/`k` — never fixed to a
  specific lower number by this card** ← **RECOMMENDED**. This is the honest, *mechanically real* reading of
  "or shorter": rule 3's existing discipline (no numeric threshold from a decision ceremony) governs walking
  through the door, and the door is a concrete config lever a batched finding can actually turn, not prose
  that names no lever.
- **(b)** Cold-start is a hard, permanent floor — no bar lower than cold-start is ever available, even with
  future data. **Rejected**: this would carve an unexplained, permanent exception to rule 3's general
  amendment mechanism for this one bar and only this one, with no stated reason a tooling-proven case
  couldn't, on real future data, justify going lower than an entirely cold triple's own bar.

**Skeptic:** SURVIVES-WITH-AMENDMENT (real skeptic sub-agent). The attack found the originally-drafted
codified text contradicted this fork's own default: it hard-coded "the ordinary cold-start `minCleanStreak`"
prose with no named lever, so a future batched finding would have had nothing to change without a fresh
statute edit — the "open door" was locked by this card's own wording. Fixed by naming the lever concretely
(`toolingReentryStreak`, defaulting to `minCleanStreak`) above and in the codified text below, so rule 3's
existing batched-finding mechanism has something real to tune. Classification axis: close to a config
dimension, but the fork still rules on something real — whether a tooling-specific lever may ever exist at
all, vs. being permanently barred — so it stays a fork rather than dissolving to "supported by default."
**Screen:** clear, though the thinnest of the six — the content is "don't fix a number now," which risks
reading as deferral, but the real ruling (a permanent bar on ever having a lower tooling lever, vs. leaving
the door concretely open) is a genuine precedent-consistency question, not a convenience call.

## Fork 5 — Does a proven tooling fix reset other triples that shared the same root cause?

**Why this is a real fork.** The already-ratified preamble of this same anchor states "The unit of trust is
the triple `{provider, model, taskType}`, and trust never carries across triples"
(`we:docs/agent/platform-decisions.md:4936-4937`) — a forced invariant that directly forecloses letting one
triple's proof clear another triple's bar, even when the underlying cause is identical.

- **(a)** A tooling fix proven for one triple automatically clears, or lowers the bar for, every other triple
  whose confirmed miss shared the same root cause. **Rejected**: directly contradicts "trust never carries
  across triples" — this would be exactly that cross-triple carry, just gated on cause-identity instead of
  gated on nothing.
- **(b)** **Each affected triple accumulates its own post-fix trial evidence per Fork 3's bar, independently.
  The same root-cause finding may be referenced across every triple's row that shares the cause — the
  diagnosis itself does not need re-investigating per triple — but that reference never substitutes for the
  triple's own evidence** ← **RECOMMENDED**. Keeps the record honest (no duplicated diagnosis work across
  triples affected by one shared bug) while leaving the trust-never-carries invariant untouched.

**Skeptic:** SURVIVES (real skeptic sub-agent). Classification axis: branch (a) is already excluded by the
anchor's own ratified preamble ("trust never carries across triples"), so like Fork 1 this is a
forced-invariant confirmation — accepted, matches the fork's own justification. Merit attack (a shared
tooling bug forcing redundant per-triple retrial cost) does not land: every affected triple had its own
confirmed miss, so each independently owes its own evidence regardless of shared cause; referencing the same
finding across triples shares only the diagnosis-authoring cost, not the evidence cost. No statute-overlap or
citation-scope issue found.
**Screen:** flagged(impl) → fixed. The fresh-context pass found the original "linked, not re-authored"
phrasing described a *storage/data-modeling* detail (how the note is stored) rather than the *policy*
(what's required as evidence); reworded above to state only the externally-observable outcome — the
diagnosis is referenceable, the evidence requirement is not waived.

## Fork 6 — Does post-miss restoration bypass rule 6's "promotion is an explicit ratified act"?

**Why this is a real fork.** Rule 6 states: "Demotion is computed from the record and takes effect
immediately. Promotion to a lighter level takes an explicit ratified act naming the triples promoted, done in
batches against accumulated data, never per dispatch and never per trial"
(`we:docs/agent/platform-decisions.md:4967-4970`). Restoration after a miss is, structurally, a promotion (a
triple moving from `full` back to `spot-check`) — so letting the computed streak alone flip it back, with no
ratified act, would be a silent exception to rule 6 that rule 6's own text does not carve.

- **(a)** Once Fork 2's classification, Fork 3's proof, and Fork 4's bar are all met, the triple returns to
  `spot-check` automatically, purely from the computed record — no separate human act. **Rejected**:
  contradicts rule 6's "never per dispatch and never per trial" as written; nothing in the operator's
  direction asked to change *who* promotes, only *which bar* applies once a human has classified the cause.
- **(b)** **Post-miss restoration is a promotion under rule 6 like any other — it still requires the same
  explicit ratified act naming the triples promoted, done in batches, measured against the
  correctly-selected bar (cold-start once tooling-proven, `minCleanStreak + k` otherwise). That act is also
  the enforcement point for Forks 2 and 3: it is where a human confirms the triple's `rootCauseClass` and
  confirms that its cited proof trial actually targeted the trigger** ← **RECOMMENDED**. Rule 6's text
  already reads "any promotion" broadly enough to cover this without new words; what this card adds is not a
  new restriction but the load-bearing job that act does — it is the only point in the whole mechanism where
  a human checkpoint structurally exists, since the logging CLI enforces neither the classification nor the
  targeting claim on its own.

**Skeptic:** SURVIVES-WITH-AMENDMENT (real skeptic sub-agent). The attack argued the added sentence
originally read as a redundant restatement of rule 6 as already written (a plain reading of "any promotion"
already covers post-miss restoration). Accepted as partly right — reworded above to stop presenting this as
a new restriction and instead state its real job: it is the fix for Forks 2 and 3's enforceability gap, the
one human checkpoint in the mechanism that can actually confirm the classification and the targeting claim,
which the logging CLI cannot enforce on its own.
**Screen:** clear — initially suspected as a non-decision (already foreclosed by rule 6 as written), but this
card's own bar-splitting logic creates a real temptation a builder could otherwise fall into ("the bar is now
precisely computable, so why not auto-restore"), and foreclosing that is a genuine policy point, not
manufactured.

## Proposed codified text (drafted, ready to ratify verbatim; not yet ratified)

If all six forks are ratified as recommended, rule 5 and rule 6 of
[#delegation-trial-record-graduation](/docs/agent/platform-decisions/#delegation-trial-record-graduation)
read (amendments in **bold**, rest unchanged):

> 5. **Re-graduation after a miss — a root-cause note first, then a higher bar, unless the cause is
>    tooling.** After a miss, post-miss trials count toward restoration only once a root-cause note is on
>    record in its own field, not in a later row's `findings`. **The note also carries a `rootCauseClass`
>    (`tooling` or `vendor`), written only by a human. A missing or invalid class fails closed to `vendor`; a
>    `tooling` class must cite a concrete landed fix (a PR or commit reference), never bare prose; neither is
>    ever inferred or self-declared by the dispatch automation, the delegated provider's own session, or the
>    orchestrating session.** The post-miss bar is strictly higher than the cold-start bar (`minCleanStreak +
>    k`, with `k` set by the same batched finding that sets N) **when the root cause is the vendor itself.
>    When the root cause is tooling or instructions, the bar is `toolingReentryStreak` (a new
>    `DEFAULT_BACKDOWN_THRESHOLDS` entry, defaulting to `minCleanStreak` and tunable only by a future ordinary
>    batched finding, the same mechanism that tunes `minCleanStreak`/`k`) once at least one post-fix trial
>    specifically targets the triggering failure mode** (a repeat of the case, or a constructed case
>    exercising the same gap) **— never the vendor path, whose own higher streak is its safeguard. A tooling
>    fix proven for one triple never clears or lowers another triple's bar; the same root-cause finding may be
>    referenced across triples that share the cause, but each accumulates its own post-fix evidence.** This is
>    the same principle as [#calibration-veto-clearing](#calibration-veto-clearing), applied to a delivery
>    trial rather than a reviewer's disposition.
> 6. **Who moves a level — the data demotes, the operator promotes.** Demotion is computed from the record
>    and takes effect immediately. Promotion to a lighter level takes an explicit ratified act naming the
>    triples promoted, done in batches against accumulated data, never per dispatch and never per trial.
>    **This includes post-miss restoration under rule 5: meeting the applicable bar is never itself
>    sufficient — the ratified act also confirms the triple's `rootCauseClass` and that its cited proof trial
>    actually targeted the trigger, the one human checkpoint the record's own fields cannot enforce
>    themselves.** With no such act, a triple stays at `full`. [rest unchanged]

`codifiedIn` on resolve is anchor `#delegation-trial-record-graduation` in
`we:docs/agent/platform-decisions.md`.

## What this card does not decide

It does not reopen rule 3's hard veto (Fork 1 above confirms it stands), rule 4's `informative` field, or
rule 7's verification floor (that is `#3867`, already settled "no"). It does not fix a numeric value for
`minCleanStreak`, `k`, or `toolingReentryStreak` (Fork 4) — those stay ordinary batched findings per rule 3,
exactly as `#3673` left its own N undefined. It does not itself build the `rootCauseClass`, `rootCauseFixRef`,
or `provenAgainst` fields, the `toolingReentryStreak` config entry, or the `selectSupervisionLevel` branch
logic — that is separately-scoped future build work once ratified, matching `#3673`'s own "not built here"
posture; and it has no live effect until `#3949` restores trial logging for graduated triples.

### Review jury (provisional — pre-registered #2638)

Care level: `high` (this card edits statute). This jury binds against the item's predicted scope
(`we:docs/agent/platform-decisions.md`) and is re-checked against the real diff at PR open.

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

## Done when

1. **Executable** — `we:scripts/lib/__tests__/provider-routing.test.mjs` gets a case showing a triple with a
   recorded `rootCause` note, `rootCauseClass: 'tooling'` and a `rootCauseFixRef`, re-graduates at the
   `toolingReentryStreak` bar once a trial recorded against the triggering case is clean, while a triple
   whose `rootCauseClass` is `'vendor'` (or missing/invalid) still needs the higher `minCleanStreak + k` bar
   — both paths read `we:scripts/lib/provider-routing.mjs`'s shared `DEFAULT_BACKDOWN_THRESHOLDS`, never a
   local constant, and `toolingReentryStreak` defaults to `minCleanStreak`.
2. **Assertable** — rules 5 and 6 of
   [#delegation-trial-record-graduation](/docs/agent/platform-decisions/#delegation-trial-record-graduation)
   are amended to state the split (see *Proposed codified text* above); rule 7 is untouched.
3. **Grounded** — the ruling states, for each of the six forks above, the option taken, and confirms
   `#3673`'s calibration-veto-clearing ruling was extended, not re-decided.
