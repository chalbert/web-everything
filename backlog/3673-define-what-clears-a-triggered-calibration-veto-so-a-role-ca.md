---
bornAs: xgurgc1
kind: decision
parent: "3383"
status: open
scope: ["we:docs/agent/platform-decisions.md", "we:backlog/"]
dateOpened: "2026-09-14"
preparedDate: "2026-09-14"
relatedTo: ["3654", "3675"]
relatedReport: reports/2026-09-14-calibration-veto-clearing-grounding.md
tags: [probation, model-routing, review, graduation, calibration-veto]
---

# Define what clears a triggered calibration veto so a role can graduate

#3654's ratified graduation rule makes a confirmed calibration miss an independent veto on promotion out
of probation, but never says how a triggered veto is ever cleared. Not hypothetical: Codex's
`advisory-review` role carries a live, unresolved veto today from PR #2107. **Grounded in a real-tree
investigation** (`we:reports/2026-09-14-calibration-veto-clearing-grounding.md`) tracing the actual
disposition-routing code and the live registry/trial record — see Grounding below. Four forks, each with a
recommended default: root-cause precondition, trial evidence, decay-alone, human override. Rules on the
**shape** of clearing, not a numeric N — the same posture `#3654`/`#3649` already took for their own
thresholds.

## Grounding — read before ruling

- **The gap, precisely.** #3654 Fork 2 (ratified) rules that "a confirmed calibration miss is an
  INDEPENDENT VETO, never diluted into a blended score" — but the ratified text stops at the veto firing.
  Neither it nor the card behind it says what, if anything, ever lifts it. #3654's own "Done when" #3
  explicitly scoped wiring/threshold work as out-of-scope follow-on; this is that follow-on, not a
  re-litigation of the veto rule itself.
- **The live incident, and the mechanism it actually routes through.** PR #2107
  (`WE #3627: replace --bare/--safe-mode with --restricted for the delivery-agent provider`). Both Codex's
  `codex-correctness` advisory seat and Claude's mandatory correctness juror found the SAME bug
  (`commitConvergeRound` in `we:scripts/operations/deliver-item-wrapper.mjs` shells `git commit -F <msgfile>
  -- <paths>` with no preceding `git add`, throwing on any round whose accepted edit adds a brand-new
  untracked file). Disposition is not self-declared by a juror — `we:scripts/lib/jury-core.mjs`'s
  `deriveFindingDisposition` routes three factual booleans (`introduced`, `worseThanBase`,
  `!parallelizable` — all three required for `blocker`; any other combination is `carve-out`) into the
  disposition. So the split is at least one of those three sub-answers coming out differently between the
  two jurors — a root-cause finding that doesn't name *which* one diverged, and why, has not diagnosed the
  miss. See the linked report for the full function and citation.
- **The registry has no calibration-veto field today.** `we:scripts/lib/model-probation.mjs` +
  `we:model-probation.json` (branch `origin/lane/mechanical-dispatcher`, not yet on `main`) track only
  `{provider, model} → {role: status}`. Neither the schema nor the two live entries (`codex`/`gpt-6-astra`,
  `antigravity`/`gemini-3.1-pro`) carry a `calibrationMiss` flag or a trial log. The veto is tracked today
  only in decision text (this item, `#3654`'s Grounding) — this card rules on the shape of clearing;
  wiring a field for it is separately-scoped future build work, matching #3654's own "not built here"
  posture for the graduation bar itself.
- **Coverage vs. calibration — a materially different failure mode, checked against the real record.**
  The epic's own contemporaneous log (`we:backlog/3383-*.md`, 2026-09-12) records Codex's `advisory-review`
  seat's full trial history against 4 real PRs: 3 of 4 came back with **zero findings** (a coverage miss —
  nothing noticed) and only #2107 produced a finding whose severity was then rated differently from
  Claude's juror on the same bug (a calibration disagreement — both sides *did* notice it). That split is
  consistent with this session's broader finding (not independently re-verified against further historical
  PRs in this pass — flagged, not asserted as closed) that the dominant Codex/Claude disagreement pattern is
  coverage, not calibration. `#3675`'s tooling-asymmetry finding (Codex's review seat is read-only; a
  bounded experiment showed write-mode findings were far more often independently verified) explains a
  *coverage* gap — it changes whether a bug is found and confirmed at all, not how a bug **both sides
  already noticed** gets its `introduced`/`worseThanBase`/`parallelizable` triple answered. So #3675, even
  if fully built, does not by itself constitute a root-cause fix for THIS veto's specific failure mode —
  Fork 1 below leans on exactly this distinction.
- **What this card does NOT decide.** It does not reopen whether a calibration miss should veto (settled,
  #3654 Fork 2), whether the bar is per-role (settled, Fork 3), or whether any identity gets an easier bar
  (settled, Fork 4 — no vendor-reputation discount, so "just trust Codex more" is not an available answer
  here either). It does not re-litigate whether PR #2107's veto should have fired at all, given the
  coverage/calibration distinction above — that is a live, genuinely open question the Grounding above
  surfaces but this card does not resolve (see Fork 4's reclassification path, which is the one lever this
  card gives a future session to reopen that question on its own facts, not on trust).

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| 1 — Root-cause precondition | A documented root-cause finding, specific to the calibration mechanism (not a coverage fix), **is required** before any post-miss trial counts | Trial volume alone suffices, no explanation required | High |
| 2 — What clears it once eligible | A fixed minimum count of clean trials, **at least one specifically re-testing a similar (severity-ambiguous) case** | Any N clean trials regardless of similarity to the trigger | High |
| 3 — Decay-alone | Time/attempt decay **never** clears it alone; it may narrow which trials count, never substitute for clean-trial evidence | Decay alone (N trials or T time, any kind) clears it automatically | High |
| 4 — Human override | Override is available **only** as a documented factual reclassification of the trigger itself, never a trust/confidence grant | A human may waive the veto on confidence alone | Med-high |

## Fork 1 — Is a root-cause finding a mandatory precondition to any clearing, or does trial volume alone suffice?

**Why this is a real fork.** A pure trial-volume bar is satisfiable without ever understanding why the
miss happened — and the Grounding above shows a plausible-looking "obvious" fix (#3675's tool-parity work)
would not actually address this veto's mechanism, since it targets coverage, not the
`introduced`/`worseThanBase`/`parallelizable` disagreement calibration failures route through. A team could
ship #3675, watch trial counts accumulate, and clear the veto having fixed a different problem than the one
that tripped it. So (a) is the flawed branch — the same self-defeating shape #3654 Fork 1(a) already
rejected for initial graduation, sharpened here by a concrete near-miss (a real candidate "fix" in flight
that doesn't actually address the failure mode).

- **(a)** Trial volume alone (N subsequent clean trials, however defined) clears the veto — no explanation
  required. **Rejected**: gameable by the same underlying principle #3654 Fork 1(a) already established for
  initial graduation (count without diagnosis), applied here to *diagnosis* rather than trial *diversity* —
  and concretely so here — #3675's write-access fix could accumulate clean trials while its relevance to
  the calibration mechanism the #2107 veto actually flagged remains unestablished.
- **(b)** **A documented root-cause finding, specifically naming which of the three `deriveFindingDisposition`
  sub-answers diverged and why (or the equivalent diagnostic for a future non-jury-core review mechanism),
  is required before any post-miss trial counts toward clearing** ← **RECOMMENDED**. Ties the precondition
  to the veto's actual mechanism rather than to a plausible-sounding but different fix. **Caveat, surfaced by
  the skeptic pass:** #3675's write-access fix is not *proven* irrelevant to calibration either — write
  access could plausibly let Codex verify severity via a scratch reproduction, which could change its
  `worseThanBase`/`parallelizable` answers, not just whether it notices a bug at all. The point this fork
  rules on is narrower than "coverage and calibration are unrelated": it is that a fix's *plausible*
  relevance is not itself a root-cause finding — the finding must still name which sub-answer diverged and
  why, whatever fix eventually addresses it.
- **(c)** No fixed requirement — a qualitative human call each time. **Rejected**: reintroduces the "no
  defined threshold" gap `#3673` exists to close, same reasoning as #3654 Fork 1(c).

```js
// Illustrative shape only — the real clearing-check function is future build work, not this card.
// Ties directly to the routing function the Grounding cites (we:scripts/lib/jury-core.mjs).
function meetsClearingBar({ rootCause, trials, triggerCaseSignature }) {
  if (!rootCause || !rootCause.divergedSubAnswer) {
    return { cleared: false, reason: 'no root-cause finding naming the diverged disposition sub-answer' };
  }
  // ... Fork 2's trial-count + similarity check follows here
}
```

**Skeptic:** SURVIVES-WITH-AMENDMENT (real skeptic sub-agent). The attack found the citation to #3654
Fork 1(a) overclaimed — that fork's gaming vector is trial *diversity*, not root-cause *diagnosis*, so
"exactly as" overstated a shared mechanism that is really only analogous; softened to "the same underlying
principle … applied here to diagnosis rather than diversity." The attack also pressed hard on whether
#3675 (tool-parity) is really irrelevant to calibration, arguing write access could plausibly change
severity sub-answers too (not just coverage) via scratch verification — a real point, not fully refuted:
folded in as an explicit caveat narrowing what this fork actually rules on (a fix's plausible relevance is
not itself a root-cause finding; the finding must still name which sub-answer diverged and why). Core
recommendation (root-cause-first, tied to the veto's actual mechanism) survived.
**Screen:** clear — a genuine externally-observable policy call (what evidentiary bar clears a veto), not
internal plumbing (fresh-context agent, #2091 two-confusion screen); a genuine merit difference (diagnosis
vs. ungrounded volume) survives the free-and-instant-maintenance test.

## Fork 2 — Once eligible, what trial evidence clears it: a fixed count, or a fixed count plus at least one similar-case trial?

**Why this is a real fork.** Exactly #3654 Fork 1's own logic, applied to clearing instead of initial
graduation: a fixed count with no similarity requirement is satisfiable by selection bias — a role could
accumulate N easy, dissimilar clean passes without ever being retested against a severity-ambiguous case
resembling the one that tripped the veto in the first place. So (a) is the flawed branch.

- **(a)** Any N clean trials, regardless of case similarity to the trigger. **Rejected**: selection-bias
  gameable, exactly #3654 Fork 1(a)'s objection reapplied to clearing.
- **(b)** **A fixed minimum N, with at least one trial specifically targeting a case similar in kind to the
  trigger** (a severity-ambiguous / borderline-blocker-vs-carve-out case) ← **RECOMMENDED**. Volume as
  evidence of range on the relevant axis, not evidence of repetition on an easy one — the same principle
  #3654 Fork 1 already ratified for initial graduation, reused here by direct analogy.
- The exact N is deliberately not fixed here, same posture as #3654 Forks 1–2 and #3649 Fork 4 — an
  ungrounded number is a guess dressed as a bar; once a real post-clearing trial population exists, a
  specific N is proposed as an ordinary (batched) finding, not a separate ceremony.
- **Caveat, surfaced by the skeptic pass:** naturally-occurring severity-ambiguous PRs may be scarce, so a
  literal reading of "at least one similar-case trial" risks stalling clearing indefinitely for scarcity
  reasons, not unfitness. The similar-case trial may be a deliberately constructed test scenario (a
  synthetic diff engineered to be borderline, the same shape as the control probe already run in this
  session's investigation), not only a naturally-occurring live PR — scarcity of real borderline cases
  cannot indefinitely block clearing.

**Skeptic:** SURVIVES-WITH-AMENDMENT (real skeptic sub-agent). The #3654 Fork 1 analogy is fair here (both
concern trial *informativeness*, not diagnosis vs. diversity as in Fork 1 above) and the merit case
(forcing evidentiary range over easy repetition) held against the attack. The attack did surface a real
practical gap: naturally-occurring severity-ambiguous PRs may be scarce, so a literal reading could stall
clearing indefinitely for scarcity reasons rather than unfitness — folded in above as an explicit caveat
permitting a deliberately constructed test scenario to satisfy the similar-case requirement.
**Screen:** clear — a genuine externally-observable graduation criterion, not plumbing; a genuine
selection-bias/evidentiary-soundness merit difference survives free-and-instant-maintenance (fresh-context
agent, #2091).

## Fork 3 — Can a pure time/attempt-based cooling-off decay clear the veto on its own, with no new evidence?

**Why this is a real fork.** #3654 Fork 2 (ratified) rules a confirmed calibration miss is an "INDEPENDENT
VETO, never diluted into a blended score" — precisely to stop a real miss from being mathematically washed
out by an unrelated volume of clean passes. A pure decay clock (the veto lifts after N trials or T time
elapse, with no requirement those trials be clean, relevant, or evidence of anything) is temporal dilution
of exactly that kind: nothing has actually changed except time passing, yet the veto lifts as if it had.
So (a) is the flawed branch — it contradicts a principle #3654 already ratified, not merely a matter of
taste.

- **(a)** Decay alone (N subsequent trials of any kind, or T elapsed time, with no clean/relevant
  requirement) clears the veto automatically. **Rejected**: functionally identical to the diluted blended
  score #3654 Fork 2 already forecloses, just diluted by time/count instead of by a composite score.
- **(b)** **A cooling-off/decay window may narrow which trials are eligible to count (e.g. only trials since
  a rubric fix landed) but never substitutes for the affirmative clean-trial evidence Fork 2 requires; time
  alone never clears the veto** ← **RECOMMENDED**.

**Skeptic:** SURVIVES (real skeptic sub-agent). Checked the citation-scope claim that decay-alone is
"functionally identical to the diluted blended score #3654 Fork 2 forecloses" against #3654's actual text
— that clause is literally about weighted-score blending, not time decay, so the citation is loosely
worded, but on inspection decay-alone is arguably a *more* severe violation of the same anti-dilution
principle (no quality requirement of any kind, vs. a score that at least incorporates the miss
quantitatively) — so the citation, while imprecise, is not an overreach. No amendment needed.
**Screen:** clear — a genuine externally-observable contract question (does elapsed time alone trigger a
status change), not plumbing; an epistemic merit difference (absence of new negative signal vs. presence
of positive evidence) survives free-and-instant-maintenance (fresh-context agent, #2091).

## Fork 4 — Is a human override an independent clearing path, bypassing Forks 1–2's evidentiary bar?

**Why this is a real fork.** #3654 Fork 4 (ratified) directly forecloses a bar loosened by vendor
reputation or subjective trust — "no identity buys an easier bar" — grounded in PR #2182's own text. A
human override granted purely on operator confidence that "the model has improved" is that same discount
by another name: a subjective trust grant substituting for evidence. But #3654's Grounding also states
promotion is "always an explicit human decision grounded in accumulated data, never automatic" — which
argues for human judgment being present, not for it being able to *substitute for* the data. Reconciling
the two: a human override has a legitimate role only where it corrects a *fact* (the trigger finding was
itself wrong or miscategorized), never where it merely forgives on trust. So (a), read as a blanket
trust-based waiver, is the flawed branch.

- **(a)** A human may waive the veto on confidence/trust alone, without new trial evidence or a factual
  correction. **Rejected**: #3654 Fork 4 already forecloses exactly this shape — a discretionary,
  trust-based waiver is a reputation discount wearing a different name.
- **(b)** **A human override is available only as a documented, reasoned factual reclassification of the
  trigger event, narrowly scoped to identity/evidentiary errors — never a re-answer of the severity
  judgment itself** ← **RECOMMENDED**. Concretely, eligible grounds are limited to: the cited finding fails
  independent verification (would not survive the same evidence-classification check `#3312`'s
  `classifyFindingEvidence`-shaped scrutiny applies elsewhere in this review stack), the "same bug" framing
  does not actually hold (the two seats were not in fact looking at the same finding), or a bookkeeping
  error in how the trigger was recorded. **Explicitly out of scope for any override: re-answering
  `introduced`/`worseThanBase`/`parallelizable` from scratch (or the equivalent severity sub-judgments for a
  future non-jury-core review mechanism) because a human now judges the severity differently** — that is a
  full #3654 Fork 2 re-litigation, which this card does not authorize case-by-case
  (doing so would let every future miss be argued away on the same substantive grounds the veto exists to
  catch, exactly the risk (a) above is rejected for). This is the one lever this card gives a future session
  to reopen the live PR #2107 veto on its own facts (per the Grounding's coverage-vs-calibration
  distinction) — narrower and faster than filing a fresh #3654-Fork-2-reopening decision item, because it
  corrects a record rather than reopening a ratified rule.
- **(c)** No override of any kind, ever — every clearing must run the full Forks 1–2 bar even to correct a
  factual misclassification. **Rejected**: this would force a role to accumulate fresh trials to clear a
  veto that was never actually earned in the first place — punishing a bookkeeping error as if it were a
  real miss, which is not what #3654's veto rule is for. (Note: (c) does not actually prevent someone from
  filing a fresh decision item to correct the record and thereby clear an old veto through ordinary process
  — (b)'s real contribution over (c) is making that a lighter-weight, explicitly-sanctioned path rather than
  requiring a full new ratification each time.)

**Skeptic:** SURVIVES-WITH-AMENDMENT (real skeptic sub-agent). This was the fork's hardest attack: the
three disposition booleans (`introduced`/`worseThanBase`/`parallelizable`) ARE the substantive judgment
that split the two seats, so an unnarrowed "reclassification" override risked functionally re-answering
the severity call case-by-case under a different label — the same risk (a) is rejected for. Fixed above by
explicitly narrowing (b) to identity/evidentiary errors (verification failure, "same bug" framing not
holding, bookkeeping error) and explicitly excluding any re-answer of the three booleans from any override,
ever. The attack also noted (c) doesn't actually block filing a fresh decision item to correct the record
through ordinary process — folded in as a note that (b)'s real contribution is making that path
lighter-weight and explicitly sanctioned, not inventing a capability that didn't already exist.
**Screen:** flagged(impl) → fixed. A fresh-context screen found the exclusion clause's literal boundary was
pinned to today's specific `deriveFindingDisposition` field names with no generalization hedge (unlike
Fork 1's parallel citation, which already read "or the equivalent diagnostic for a future non-jury-core
review mechanism"), risking the ruling reading as scoped to today's implementation rather than the general
principle. Fixed by adding the same hedge to Fork 4(b)'s exclusion clause above. Q2 (merit-vs-
prioritization) cleared on first pass: "trust the model now" vs. "the record was factually wrong" is a
genuine evidentiary/governance distinction, not a convenience call.

## What this means for the live PR #2107 veto, concretely (the "Grounded" criterion below)

This card does not itself clear or re-litigate the #2107 veto. Under the ruling above: Fork 1 requires a
root-cause finding specifically naming which `deriveFindingDisposition` sub-answer diverged before any
clean-trial accumulation counts; #3675's tool-parity fix, even if built, is not *itself* such a finding —
it is a plausible but unestablished candidate (it was diagnosed as a coverage-gap fix; whether it also
bears on this specific calibration disagreement is not shown either way, per Fork 1's caveat above). The
one path that could clear the #2107 veto without first running fresh, similarity-matched trials is Fork
4(b)'s reclassification override — available only on the narrow grounds Fork 4 states (the finding fails
independent verification, or the "same bug" framing doesn't actually hold), never on a re-judgment of
whether the bug was really blocker-vs-carve-out, and not on the strength of the tooling-asymmetry finding
alone.

## Done when

1. **Executable** — `node we:scripts/backlog.mjs show 3673` reports `status: resolved` with `codifiedIn:`
   set, and the ruling states, for each of the four forks above, the option taken.
2. **Grounded** — the ruling explicitly addresses the live PR #2107 veto on Codex's `advisory-review` role:
   whether/how it clears under the new rule, or what remains to be done before it can (see the section
   above for the prepared analysis this ruling inherits).
3. **Not built here, by design** — no `calibrationMiss` field is added to `we:model-probation.json`, no
   clearing-check function is wired. This card rules on the *shape* of clearing; wiring it is
   separately-scoped future work, matching #3654's own posture.
