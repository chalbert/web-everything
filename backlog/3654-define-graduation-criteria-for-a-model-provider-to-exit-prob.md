---
bornAs: xeagmug
kind: decision
parent: "3383"
status: resolved
scope: ["we:backlog/"]
dateOpened: "2026-09-13"
dateResolved: "2026-09-13"
codifiedIn: "docs/agent/platform-decisions.md#model-probation-graduation-criteria"
preparedDate: "2026-09-13"
relatedTo: ["3649", "3651", "2182"]
relatedReport: reports/2026-09-12-run-quality-benchmark-for-dispatched-agent-runs.md
tags: [probation, model-routing, review, graduation]
---

# Define graduation criteria for a model/provider to exit probation status

The probation mechanism built under epic we:#3383 (`we:scripts/lib/model-probation.mjs`, branch
`origin/lane/mechanical-dispatcher` — not yet on `main`) has no defined threshold for graduating a
`{provider, model}` identity out of `probation` into `trusted`, per role (`delivery`,
`advisory-review`). `#3649`'s ratified Fork 4 explicitly left "no numeric par band in v1" for its
own (different) mechanism; PR #2182 recorded only that promotion is "an explicit decision based on
accumulated data," without saying what data, how much, or what bar it must clear. **Grounded in a
prior-art survey published as `we:reports/2026-09-12-run-quality-benchmark-for-dispatched-agent-runs.md`**
(the same FOQA/chess/trajectory-evaluation research `#3649` used) plus a direct read of the live
registry code and its two real call sites. Four forks below, each carrying a recommended default in
**bold**: (1) trial volume/mix, (2) what gets measured, (3) per-role vs. one global bar, (4)
per-provider vs. uniform criteria. This decision **rules on the shape of the bar, not a specific
number** — consistent with `#3649` Fork 4, no numeric N is fixed here; a concrete threshold is
proposed later, once a real trial population exists, as an ordinary (not ceremonial) finding.

## Grounding — read before ruling

- **The registry, as it actually works today** (`we:scripts/lib/model-probation.mjs`, branch
  `lane/mechanical-dispatcher`): three statuses (`unvalidated` → `probation` → `trusted`), fail-closed
  default `unvalidated`. Tracked per `{provider, model}` **identity** — a model upgrade never inherits
  the outgoing model's trust; an unlisted pair is `unvalidated` by construction (`we:model-probation.mjs`
  docblock). Tracked per **role** (`PROBATION_ROLES = ['delivery', 'advisory-review']`).
  `NEVER_BLOCKING_ROLES = ['advisory-review']` is a **code-enforced structural fact**: that role can
  never gate a merge, whatever its status (`assertRoleNeverBlocks`).
- **What "trusted" changes today: nothing, mechanically.** `defaultCodexAdvisoryProbationCheck`
  (`we:scripts/operations/review-pr.mjs:366-368`) and `isDispatchEligible` both treat `probation` and
  `trusted` **identically** right now. This decision is what will eventually give `trusted` a distinct,
  real meaning for whatever consumer reads it next (an eventual blocking/gating reviewer role, or an
  "unattended" delivery posture) — it is forward-looking, not urgent-by-current-blast-radius.
  Codex advisory-review's actual behavior is read off the registry at
  `we:scripts/operations/review-pr.mjs:342-368` and `:450-455`.
- **The already-ratified principle this decision does NOT reopen** (PR #2182, `we:backlog/3383-*.md`):
  every new model/provider goes through the *same* probation state before blocking/gating authority;
  promotion is *always* an explicit human decision grounded in accumulated data, never automatic. An
  unlisted pair starts `unvalidated`; a model upgrade never inherits trust. Fork 4 below is scoped
  narrower than this — only whether the *bar's shape* may vary per provider, not whether promotion is
  automatic or whether identity resets on upgrade (both settled already).
- **Real trial record, as verified against GitHub, not assumed:** 3 real `build`-kind Codex delivery
  trials (`#3564`→PR #2169, `#3565`→PR #2172, `#3506`→PR #2176), commit-author confirmed `codex`
  (`noreply@openai.com`), all `review:accepted`, zero findings. 4 real `advisory-review`-seat trials
  (PR #2182: "4/4 real live-fire trials with zero findings, including one confirmed missed blocker").
  A known, unresolved calibration gap: in the one case tested in depth, Codex correctly identified a
  real bug but rated its severity as non-blocking/carve-out where Claude rated the same bug a blocker.
  The one `fix`-kind attempt referenced in this card's filing is **not counted** as a trial (a pure
  infrastructure issue, not a quality signal) — consistent with the filing's own framing.
- **Two neighbouring mechanisms this decision does not duplicate or re-decide** (cite, don't
  re-derive): `#3651` (parked, `maturityGated`) is the trigger to arm `#3649`'s run-quality
  **auto-apply router** once one full `rubricVersion` population exists — a data threshold on a
  *different* mechanism (whether a low-risk fix auto-applies), not on provider/model trust.
  [`#agent-convergence-independent-validation`](docs/agent/platform-decisions.md#agent-convergence-independent-validation)
  (#2398)'s "staged autonomy" clause graduates **unattended auto-fix, scoped per-repo**, on a clean
  track record — a sibling axis (auto-fix behavior, keyed by repo) governing a different question than
  this card's (provider/model identity, keyed by trial evidence). The two compose: a provider clearing
  *this* card's bar is a separate fact from whichever repo's auto-fix capability has separately
  earned #2398's staged autonomy.

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| 1 — Volume/mix | Minimum trial count **+** at least one informative (failure/edge-case) trial; exact N deferred | Pure trial count, no diversity requirement | High |
| 2 — What's measured | Success rate as a floor, **calibration miss as an independent veto** | Pure success/acceptance rate alone | High |
| 3 — Per-role vs. global | Bar scales with the role's eventual authority (advisory-review lightest, delivery moderate, a future gating role strictest) | One uniform bar for every role | Med-high |
| 4 — Per-provider vs. uniform | One uniform *floor* for every `{provider, model}` identity (a project may optionally tighten, never loosen, per identity) | Bar loosened by an assessed provider "risk class"/reputation | High |

## Fork 1 — What volume/mix of trials is required before a promotion decision?

**Why this is a real fork.** A pure trial *count* is satisfiable by selection bias alone: a provider
dispatched only to routine, low-difficulty work can clear any fixed N while never once being tested
against a hard or adversarial case. Today's own data would already clear such a bar in the
`advisory-review` role specifically: 4/4 trials "empty" (zero findings), yet PR #2182 records one of
those four as a confirmed missed blocker (`#2107`), and this card's own filing separately notes a
severity-miscalibration case in the same role. A pure-count bar over that same 4/4 record would read
as a clean pass — a criteria decision that the evidence motivating it would already satisfy is
self-defeating. So (a) is the flawed branch, named per the fork-existence test. (The `delivery` role's
3/3 clean build trials are a *different* role's record with no known miss yet — cited separately
below as delivery's own current trial count, not as proof of (a)'s flaw.)

- **(a)** A fixed minimum trial count N, all successful — count alone clears the bar. **Rejected**:
  provably gameable by selection bias, and already satisfied by the `advisory-review` role's own 4/4
  record despite a confirmed miss inside it.
- **(b)** **A minimum count N *and* at least one genuinely informative trial** — operationally, a
  trial that surfaced a real failure (caught and correctly handled) or exposed cross-reviewer
  disagreement (e.g. a severity call a human or a second reviewer overturned) — not N clean easy
  passes ← **RECOMMENDED**. Volume becomes evidence of *range*, not evidence of *repetition*, and
  "informative" is anchored to a checkable event (a confirmed miss, a documented disagreement),
  not a vibe call that could quietly readmit (c).
- **(c)** No numeric threshold at all — a qualitative human call each time. **Rejected**: reintroduces
  exactly the "no defined threshold" gap this card exists to close.

**The exact N is deliberately not fixed here** — the same posture `#3649` Fork 4 already ratified for
its own (different) accrual threshold: an ungrounded number is a guess dressed as a bar. Once a real
trial-count distribution exists per role, a specific N is proposed as an ordinary (batched) finding,
never a separate ceremony.

**Skeptic:** SURVIVES-WITH-AMENDMENT (real skeptic sub-agent, verified against the live tree and PR
#2182's actual landed text via `git show 47a4da632`). The attack caught a mixed-role citation error:
the original draft cited the `delivery` role's clean 3/3 as proof (a) is self-defeating, but the
confirmed miss lives in the separate `advisory-review` role's 4/4 — the registry tracks status per
role, so citing one role's data to indict a bar in a different role's data doesn't hold. Fixed above
(the justification now cites `advisory-review`'s own 4/4 record). The attack also flagged
"informative trial" as under-specified enough to risk smuggling in (c) — fixed by anchoring the term
to a checkable event (a confirmed miss or a documented cross-reviewer disagreement) rather than an
undefined judgment call. With both fixes folded in, the underlying forced-invariant logic holds.
**Screen:** clear — not an implementation detail (the observable promotion-evidence contract, not
plumbing); a genuine merit difference survives free-and-instant-maintenance (selection-bias-proof vs.
not), confirmed by a fresh-context screen.

**Operator ruling (2026-09-13): APPROVED as recommended.** Fork 1 (b) — a minimum trial count N *and*
at least one genuinely informative trial (a confirmed miss or a documented cross-reviewer
disagreement), never count alone; the exact N is not fixed here, deferred to a follow-on ordinary
finding once real trial-count data exists per role. All four forks approved together, no amendments.

## Fork 2 — What specifically gets measured?

**Why this is a real fork.** Probation's own stated purpose (PR #2182) is proving a role fit to be
trusted with *blocking/gating authority* later. The one demonstrated failure mode found so far is
exactly a severity-calibration miss — invisible to a pure accept/reject count (a PR can be
`review:accepted` end-to-end while the agent inside it would, unsupervised, have waved through
something dangerous). A bar blind to the one failure mode already observed is not a criteria bar. So
(a) is the flawed branch.

- **(a)** Raw success/acceptance rate alone (review-accepted vs. changes-requested ratio).
  **Rejected**: blind to calibration by construction; passable while carrying a known,
  unresolved severity-miscalibration record.
- **(b)** **Success rate as a floor, plus a mandatory, independent calibration check: a confirmed
  severity-calibration miss (missed or under-rated a real blocker) vetoes promotion regardless of
  accept rate** ← **RECOMMENDED**. Cost/efficiency is recorded (`#3649`'s run-scorecard already
  carries this) but is not part of the promotion bar in v1.
- **(c)** A single composite score blending success rate, calibration, and cost/efficiency with
  weights, used **as the gate itself** (in place of the veto). **Rejected as a gate**: lets a high
  volume of easy clean passes mathematically dilute a real calibration miss — hiding exactly the
  signal (b) exists to surface — and requires guessing weights with no population to justify them
  (same objection as Fork 1(a)).

**Scope of this fork, narrowed after attack:** this rules only on what *gates* promotion — the
veto — not on whether a composite/aggregate number is ever computed at all. Publishing an aggregate
trend score alongside the veto, purely as an informational signal that never substitutes for it, is
not foreclosed by (b) and is not a rival branch of this fork; it is the same vector-is-the-record,
scalar-only-in-aggregate shape `#3649` Fork 2 already ratified for run-quality scoring, reused here by
analogy rather than re-decided.

Illustrative shape only (no scorer is built by this decision — a follow-on, scoped separately):

```js
// Sketch — the real graduation-check function is future build work, not this card.
function meetsGraduationBar({ trials, role }) {
  const accepted = trials.filter(t => t.verdict === 'accepted');
  if (accepted.length < MIN_TRIALS[role]) return { ready: false, reason: 'insufficient volume' };
  if (!trials.some(t => t.wasInformative)) return { ready: false, reason: 'no informative trial' };
  if (trials.some(t => t.calibrationMiss)) return { ready: false, reason: 'calibration miss on record' };
  return { ready: true };
}
```

**Skeptic:** SURVIVES-WITH-AMENDMENT (real skeptic sub-agent). The attack showed the original framing
of (b) vs. (c) as mutually exclusive was too broad: nothing stops computing a composite as an
informational trend metric while the veto stays the actual gate, so the real ratifiable question is
narrower than first drafted — "does a confirmed calibration miss hard-veto, yes/no" — with whether an
aggregate trend number is *also* published left as a separate, non-forked, non-conflicting choice.
Narrowed above. The core merit argument — a pure accept-rate metric is blind to calibration by
construction, and that blindness is the one failure mode already observed — held up against the
attack unchanged. Also attacked as possibly duplicating `#3651`'s rubric-population trigger —
refuted: `#3651` gates a *different* mechanism (auto-apply arming for run-quality findings); this
fork gates provider/model trust, and the card's own Grounding section states the distinction
explicitly so a future reader doesn't conflate them.
**Screen:** clear — not an implementation detail (the promotion contract's measured criteria, the
illustrative snippet marked non-binding); a genuine merit difference (dilution blind-spot vs. not)
survives free-and-instant-maintenance, confirmed by a fresh-context screen.

**Operator ruling (2026-09-13): APPROVED as recommended.** Fork 2 (b) — success rate is a floor, and a
confirmed calibration miss is an independent veto on promotion regardless of accept rate; a blended
composite score is not used as the gate itself, though an informational trend metric alongside the
veto is not foreclosed. All four forks approved together, no amendments.

## Fork 3 — Per-role or one global bar?

**Why this is a real fork.** `NEVER_BLOCKING_ROLES` is a structural fact about *blocking authority*
(`advisory-review` can never gate a merge, whatever its status) — it does not itself dictate how much
*evidence* graduation should require; that inference is this fork's own policy judgment, built on top
of the structural fact, not something the registry already decides. Taking that judgment on its
merits: a single bar sized for the highest-stakes role is needlessly strict for `advisory-review`
relative to its actual (zero) blocking risk; the same bar sized for the lowest-stakes role would let a
higher-stakes future role graduate on evidence disproportionate to the authority it would gain. A
uniform number is wrong in at least one direction for at least one role — so (a) is the flawed branch.

- **(a)** One uniform bar (same N, same calibration requirement) for whichever role is being
  evaluated. **Rejected**: proportionality between required evidence and authority granted is a
  reasonable policy default; a single number can't honor it for two roles of different stakes.
- **(b)** **The bar scales with the role's eventual authority**: `advisory-review` (structurally
  non-gating) earns the lightest bar; `delivery` (unattended code lands) a moderate bar; a **future**
  blocking/gating reviewer role — named nowhere else in this epic today, flagged here explicitly as
  forward-looking rather than an already-planned role, consistent with PR #2182's own practice of
  naming not-yet-integrated providers (Antigravity, Grok) in advance — would earn the strictest bar,
  once that role exists ← **RECOMMENDED**.

**Skeptic:** SURVIVES-WITH-AMENDMENT (real skeptic sub-agent, verified against the actual
`NEVER_BLOCKING_ROLES` docblock). The attack showed the original justification over-cited
`NEVER_BLOCKING_ROLES` as if the registry itself already mandated role-scaled evidentiary rigor — it
doesn't; that docblock only asserts the blocking-authority fact. Restated above as this fork's own
policy inference resting on that fact, not a fact the registry states directly. The attack also noted
Fork 4 rejects (b) partly for inventing an ungrounded category (a "risk class") while this fork's own
strictest tier rests on an equally not-yet-existing role — held to a different standard. Addressed by
flagging the future-role tier explicitly as forward-looking (not implied as already contemplated
elsewhere in the epic), matching how PR #2182 itself names not-yet-integrated providers in advance;
the *shape* (scale by authority) is ratified now, the *number* for that tier is prepared only once the
role is built — the same deferred-N discipline as Forks 1 and 2. Separately, the attack confirmed the
statute-overlap distinction from `#agent-convergence-independent-validation` (#2398) holds: that
anchor's "staged autonomy" keys on **repo** scope for **unattended auto-fix**, a different axis from
this fork's **role-scoped evidentiary bar** for provider/model trust — they compose, neither subsumes
the other.
**Screen:** clear — not an implementation detail (an observable proportionality principle, bar vs.
authority granted); with both branches free to build, the risk-proportionality argument is a genuine
correctness/safety merit difference, confirmed by a fresh-context screen.

**Operator ruling (2026-09-13): APPROVED as recommended.** Fork 3 (b) — the bar scales with the role's
eventual authority (`advisory-review` lightest, `delivery` moderate, a future gating role strictest,
its own N deferred until that role is built), never one uniform number for every role. All four forks
approved together, no amendments.

## Fork 4 — Per-provider/risk-class or uniform criteria?

**Why this is a real fork.** PR #2182's landed text is direct, on-point authority here, more precise
than a paraphrase: promotion "does not inherit blocking/gating authority by default, **by vendor
reputation, or by benchmark claims made outside this system**." A bar that gives an established
vendor an *easier* path on reputation alone is exactly what that clause forecloses. So (b), read as
"reputable providers get a lighter bar," is the flawed branch.

- **(a)** **One uniform *floor* applies to every `{provider, model}` identity — no identity may clear
  an *easier* bar because of who makes it** ← **RECOMMENDED**. A project MAY still configure a
  *stricter* bar for a provider class it independently distrusts (consistent with
  [`#blast-radius-advisory-care-not-a-gate`](docs/agent/platform-decisions.md#blast-radius-advisory-care-not-a-gate)'s
  already-ratified "a repo may tighten a scored signal to a gate as config" precedent) — that is a
  separate, optional config choice, not this fork's rival branch.
- **(b)** The bar is *loosened* for an assessed provider "risk class" (e.g. an established frontier
  lab needs less evidence than a novel/experimental provider). **Rejected**: PR #2182 directly rules
  out exactly this — no identity inherits authority "by vendor reputation" — and no risk-class
  taxonomy exists or is proposed anywhere in this epic to grade the loosening by.

(Already settled, not reopened here: an unlisted `{provider, model}` pair starts `unvalidated`, and a
model upgrade never inherits the outgoing model's trust — both already ratified in
`we:model-probation.mjs`'s design and PR #2182. Differentiation across identities happens through the
*data* each identity accumulates against the one shared floor, never through a differently defined
bar.)

**Skeptic:** SURVIVES-WITH-AMENDMENT (real skeptic sub-agent, verified against PR #2182's actual
landed text). The attack found the original framing — a flat "uniform, period" vs. "risk-class-varying"
binary — was narrower than what PR #2182 actually rules: that text forecloses only *loosening* the
bar by reputation, and says nothing against a project *tightening* it further for a class it
distrusts, which is exactly the shape `#blast-radius-advisory-care-not-a-gate` (#2563) already
ratifies elsewhere (tightening a scored signal to a gate is a sanctioned config choice). Restated
above: the ratified invariant is a uniform *floor*, never loosened by reputation, with optional
per-project tightening left open as an unforked config choice — not a flat ban on any variation.
Also attacked as possibly conflating "risk class" with legitimate per-role scaling (Fork 3) — that
distinction holds: Fork 3 scales by the *authority a role would gain* (a property of the mechanism
itself); a *loosening* risk-class discount would scale by a subjective judgment about the provider,
which PR #2182 directly forecloses and which has no equivalent structural grounding.
**Screen:** clear — not an implementation detail (an observable policy: one floor or a
reputation-discounted one); with both branches free to build, "no identity buys an easier bar on
reputation" is a genuine correctness/fairness merit difference, confirmed by a fresh-context screen.

**Operator ruling (2026-09-13): APPROVED as recommended.** Fork 4 (a) — one uniform floor for every
`{provider, model}` identity; no identity clears an easier bar on reputation. A project may still
configure a stricter bar per identity as an optional config choice, never a looser one. All four forks
approved together, no amendments.

**All four forks are now ratified (2026-09-13).** See `## Ruling` below for the consolidated statement
and `codifiedIn`.

## Ruling (ratified 2026-09-13)

All four forks approved by the operator (Nicolas Gilbert) as prepared, in one pass, no amendments
requested — see the `Operator ruling` line closing each `## Fork N` section above; consolidated
statement below. **`codifiedIn:
we:docs/agent/platform-decisions.md#model-probation-graduation-criteria`** — this card's ruling is the
statute itself (the shape of the graduation bar), so, unlike `#3649`, the full ruling earns statute,
not a narrow rider.

1. **Fork 1 (b)** — minimum trial count **N** *and* at least one informative trial (a confirmed miss or
   a documented cross-reviewer disagreement); count alone never suffices. Exact N deferred.
2. **Fork 2 (b)** — success rate is a floor; a confirmed calibration miss is an independent veto,
   regardless of accept rate. A composite/aggregate number, if published, is informational only, never
   the gate.
3. **Fork 3 (b)** — the bar scales with the role's eventual authority: `advisory-review` lightest,
   `delivery` moderate, a future gating role strictest (not yet built). One uniform bar for every role
   is rejected.
4. **Fork 4 (a)** — one uniform floor for every `{provider, model}` identity; no identity buys an
   easier bar on reputation. A project may tighten, never loosen, per identity as an optional config
   choice.

**No concrete numeric N is fixed by this ruling** (per Forks 1–3) — consistent with `#3649` Fork 4's
own deferred-N posture: an ungrounded number is a guess dressed as a bar. A specific N per role is
proposed later as an ordinary (batched) finding, once a real trial-count distribution exists, never a
separate ceremony. No graduation-check function is written and no threshold is wired into
`we:model-probation.mjs` by this ruling — this card rules on the shape of the bar only; wiring it is
separately-scoped future work.

## Done when

1. **Executable** — `node we:scripts/backlog.mjs show 3654` reports `status: resolved` with
   `codifiedIn:` set, and the ruling states, for each of the four forks above, the option taken.
2. **Ruled** — the ruling states explicitly whether any concrete numeric N is fixed now (per Forks 1–2,
   expected answer: no — deferred to a follow-on finding once trial data exists) and names the
   follow-on item(s), if any, that will propose it.
3. **Not built here, by design** — no graduation-check function is written, no threshold is wired into
   `we:model-probation.mjs`. This card rules on the *shape* of the bar; wiring it is separately-scoped
   future work.
