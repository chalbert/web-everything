---
bornAs: xgcpi2v
kind: decision
tier: pinned
status: open
dateOpened: "2026-08-16"
preparedDate: "2026-08-17"
relatedReport: reports/2026-08-17-constitutional-amendment-gate-quantification.md
tags: [constitution, spec, governance, reconciliation]
---

# Reconcile #2564's constitution-tier artifact with #2561 F4's rejection of a standalone constitution doc, then quantify the amendment-entrenchment gate

#2564 Fork 5 ratified a **substantively entrenched** constitutional-amendment gate as three qualitative
clauses — exempt from #911's supersede-with-lineage, a cooling period "in days, not sessions", a committed
external artifact — and none carries a number, a format, or a mechanism. The **reconciliation** half of this
item is **closed** by #2568's prep, not open work. Three forks remain: **what class of surface may confer**
the entrenchment, **what timestamp** the cooling clock may read, and **what surface** a subordinate project
constitution joins the tier through. The record's shape turned out to be settled by precedent, not a fork.

## The reconciliation half — closed by #2568's prep, not a fork

Filed 2026-08-16 when a build pass hit a direct conflict between two same-day ratifications that never
cross-referenced each other: #2564 Fork 5 gates *amending the constitution* with a ceremony that reads as if
it presumes a distinct artifact, while #2561 F4 names "author a standalone constitution artifact" as the
**broken** branch. Filed with it was the observation that #2568 — which F4 delegates form and membership to —
was unprepared.

**That is no longer true, and the conflict is resolved.** #2568 was prepared 2026-08-16 and now carries #2564
Fork 5 as an explicit hard constraint on its form call
(`we:backlog/2568-constitution-curation-form-which-core-principles-vs-specs-an.md:45-62`). Its Fork 1 default
answers the conflict structurally: Fork 5's three clauses are **process properties, not storage properties**,
so entrenchment attaches to *editing a tagged anchor* rather than to a document boundary, and no standalone
body is forced. Its skeptic folded two amendments this item inherits and does **not** re-decide —
**self-referential closure** (an edit to the tag index is itself constitution-tier, else membership can be
laundered) and **stacking, not replacing** (the entrenched path escalates *past* the existing `review:human`
floor, never in place of it),
`we:backlog/2568-constitution-curation-form-which-core-principles-vs-specs-an.md:101-111`.

So nothing about *form* is live here. **Recommended ratification order: #2568 first, then this item.** No
`blockedBy` edge is asserted, and that is deliberate rather than an omission: no fork below names a specific
index file, so each is rulable whichever form #2568 picks.

## The correction that reshaped this item — the gate is not what the first draft assumed

This item's first prep draft, and #2568's Fork 1 before it, both describe the review gate as *"the whole
statute file routes to one `review:human` floor, and derivation code enforces it."* **That is the pre-2026-07-28
gate.** A four-decision governance cluster re-ratified it and neither item cites any of them. The prep
skeptic found this, and it inverted two of the four first-draft defaults:

- **#2771 (`we:docs/agent/platform-decisions.md#review-human-declarative-leash-only`, :3408).** The policy
  tier is **split**. The **declarative leash** — the machine-diffable contract
  (`we:scripts/lib/review-policy.contract.json`), the roster (`we:scripts/lib/gate-config.mjs`), and the
  invariant/conformance suites — stays `review:human`. The **derivation code**, explicitly including
  `we:scripts/lib/review-escalation.mjs`, is **ratified agent-clearable** by an independent committee.
- **#2840 (`#human-is-principle-surface-not-path`, :3478).** `review:human` fires on a **principle surface**,
  and this anchor is "the canonical definition of that term for the whole governance cluster". Trigger 1 is
  already **per-anchor**: "a statute-anchor edit that adds, removes, or alters a `### … {#anchor}` rule
  heading or its ruling body." Trigger 3 pins every `POLICY_SPEC` file human-gated **as a whole file,
  permanently**, "because those files *are* the encoded principle and have no behaviour-preserving edit."
- **#2839 (`#principle-and-impl-two-pr`, :3470).** A principle change and its implementation may **never**
  travel in one diff: the statute clause lands first in a decisions-only `review:human` PR, the enforcement
  second in a committee-cleared impl PR citing a `codifiedIn` anchor already resolved on `main`.
- **#2851 (`#human-required-is-judgment-only`, :3430).** The human step is *authoring or weakening* a
  principle, never mechanically enforcing one — so a gate must not be widened past genuine judgment.

Read together these answer #2564 Fork 5(i)'s hardest question — *what higher-order instrument can confer an
exemption?* — and the answer is a **class of surface**, not a file: the `POLICY_SPEC` declarative leash, the
one surface in this repo that is human-only, whole-file pinned, and has no behaviour-preserving edit by
ratified construction.

## Recommended path at a glance

| Fork | The call | Recommended default |
|---|---|---|
| 1 | What **class of surface** may carry the entrenchment declaration | **A `POLICY_SPEC` leash member** — human-only and whole-file pinned by #2840 trigger 3. Which leash file is an impl choice, not this ruling |
| 2 | The cooling clock — what timestamp it may read, what cancels it, and its floor | **The server-side merge timestamp** of the PR that landed the record; a substantive change to the proposed text **cancels** the period; the interval must **exceed one continuous working stretch**; the gate **parks** rather than hard-blocks |
| 3 | Project scope — the surface a subordinate constitution joins the tier through | **Listed in the platform-scope declaration**, so joining or leaving is itself a platform-tier act — never a self-declaration in an ungated project file |

## Fork 1 — What class of surface may carry the entrenchment declaration

*Fork exists (forced invariant): the excluded branch — **declare the exemption on a surface outside the
declarative leash** — is **broken**, and the repo's own ratifications say so more sharply than the legal
analogue does. #2771 clause 1 ratified `we:scripts/lib/review-escalation.mjs` **agent-clearable**
(`we:docs/agent/platform-decisions.md:3412`), so an entrenchment declaration living in the rubric can be
emptied by a committee-cleared PR with no human in the loop. A new file outside the roster is worse: it
matches nothing in `we:scripts/lib/gate-config.mjs`'s `POLICY_SPEC_BASENAMES`
(`we:scripts/lib/gate-config.mjs:355-374`) and nothing in `we:scripts/lib/review-escalation.mjs`'s
`STATUTE_PATHS` (`:70-73`) or blast-radius set (`:245-254`), so it is an ordinary agent-clearable file. A
declaration the gated path can rewrite is a **lower**-order instrument than the floor it claims to stack on —
precisely the failure `Thoburn v Sunderland CC` describes, where a rule does not become immune by declaring
itself so. Exactly one class of surface can be authoritative, so the choice is a real either/or.*

**What this fork rules, and what it deliberately does not.** It rules the **class**: the declaration must sit
on a surface whose gating is conferred by the leash roster, not on one whose protection is asserted by its
own contents. It does **not** rule which leash file — putting the block inside the existing
`we:scripts/lib/review-policy.contract.json` versus registering a new file in `POLICY_SPEC_BASENAMES` are
behaviourally identical once either is on the roster, so that is an implementation choice for the follow-on
PR, not a decider's call. (The first draft of this fork put the file names in the option set; the
fresh-context re-screen flagged that as implementation altitude and it was corrected — see `Screen:`.)

- **(a) A `POLICY_SPEC` leash member. The exemption, the tier's anchor list, the interval, and the record
  requirement are declared as DATA on a surface registered in the leash roster;
  `we:scripts/lib/review-escalation.mjs` only *reads* the declaration and never defines it; the conformance
  suite is the backstop.** **DEFAULT.** This is the only class that satisfies the higher-order test on the
  repo's own ratified terms: #2840 trigger 3 pins every `POLICY_SPEC` file human-gated **as a whole file,
  permanently**, "because those files *are* the encoded principle and have no behaviour-preserving edit"
  (`we:docs/agent/platform-decisions.md:3480`), and the contract's own charter is that policy **values** live
  there and nowhere else. **Self-referential closure comes free** rather than needing invention: the surface
  declaring the ceremony is itself inside the pinned leash, so amending the thing that protects the
  constitution is already human-only — #2568's laundering fix
  (`we:backlog/2568-constitution-curation-form-which-core-principles-vs-specs-an.md:102-106`) generalized one
  level up, and Roznai's double-amendment residual answered by an existing mechanism rather than a promise.
  **This inverts this item's first draft**, which rejected the contract as "not entrenched"; that rejection
  was written against the pre-#2840 gate and is wrong.
- (b) **A surface outside the leash** — a new `we:docs/agent/constitution-index.json`, or the anchor list
  inside `we:docs/agent/platform-decisions.md` itself, protected only by what it says about itself.
  *Rejected* on the forced invariant: unregistered files are agent-clearable today, and a self-protecting
  declaration is the decorative self-declaration `Thoburn` rules insufficient. (A pointer index remains the
  right *shape* for which anchors are constitution-tier — that is #2568's call; this fork only rules that
  wherever it lives, that surface must be a leash member.)
- (c) **In the derivation code** (`we:scripts/lib/review-escalation.mjs`), as logic rather than data.
  *Rejected on the ratified split:* #2771 clause 1 routes derivation code to the independent committee, not a
  human; the contract exists precisely so policy values never live in the code that applies them.
- (d) A **priced override** rather than a bar — Finland's §73 shape, where the waiting period may be skipped
  by a higher threshold (5/6 where 2/3 passes). *Rejected as structurally undefined, not deferred:* an
  override priced in headcount has no meaning at N=1 — 5/6 and 2/3 of one ratifier are the same ratifier — so
  it is not a coherent option in the present polity rather than an unaffordable one. It is already tracked
  where it belongs: #2564 Fork 5(b) ratified that a headcount quorum is adopted when the polity grows, so
  this needs no new home here.

```jsonc
// Fork 1 (a) — the declaration is DATA on a leash-registered surface. Shown in the existing contract, which
// is already a POLICY_SPEC member (gate-config.mjs:355-374 → clearance: human, autoLand: false); registering
// a new file in POLICY_SPEC_BASENAMES instead is equivalent and is an impl choice, not this ruling.
{
  "constitution": {
    "description": "The constitution tier and its amendment ceremony. Editing this block IS a constitutional amendment: the block sits inside the POLICY_SPEC leash, so it is human-only and whole-file pinned by construction (#2840 trigger 3) — the self-referential closure #2568's skeptic required, and the higher-order instrument Fork 5(i)'s exemption must be conferred by.",
    "exemptFromSupersede": true,           // clause (i): the ordinary #911 path does not reach these anchors
    "coolingPeriod": "P10D",               // clause (ii) — a platform-default VALUE, not a ratified constant
    "recordRequired": true,                // clause (iii): an amending decision item + its transcript report
    "anchors": ["<from #2568's curation>"]  // WHICH anchors are constitution-tier — #2568's call
  }
}
// (b) excluded — an unregistered file (or a self-protecting statute block) is agent-clearable today.
// (c) excluded — review-escalation.mjs is ratified agent-clearable derivation code (#2771 clause 1).
```

**Known occurrences.** This is how entrenchment is made to bind in practice, and the pattern is "conferred
from outside, enforced by something the protected party cannot edit": the UK's constitutional-statute
category is assigned by the courts, not claimed by the statute (`Thoburn`; Magna Carta, the Bill of Rights
1689, the Acts of Union, the Human Rights Act 1998 are the named members), and `AG for NSW v Trethowan`'s
self-referential referendum lock bound future parliaments **only** because a higher-order instrument
authorised it. Germany's Article 79(3) and Brazil's *cláusulas pétreas* are the textual-eternity variants,
both enforced by a constitutional court — again from outside. **These are analogy, not authority:** the
argument that decides this fork is the repo-native one — #2771 makes the rubric agent-clearable and #2840
makes the leash human-only-and-pinned.

`Skeptic:` **REFUTED → default flipped.** A throwaway skeptic sub-agent ran the four-axis prompt against the
first draft, told to default to "this default is wrong." It found the governance cluster above (#2771 /
#2785 / #2839 / #2840 / #2851) — **zero hits on a grep of this item and #2568 together** — and refuted the
original default outright: it had placed the constitution's only real protection in
`we:scripts/lib/review-escalation.mjs`, the file #2771 ratified agent-clearable, so an AI panel could have
emptied the check with no human involved. It also caught the mirror-image incoherence: the draft *rejected*
the contract as insufficiently protected while homing the day-count in an ungated new file — a strictly
higher bar applied to the number than to the gate enforcing it. Every claim was verified against the tree
before folding.

`Screen:` **flagged(impl) → fixed.** The fresh-context re-screen (a separate agent, no visibility into this
session's authoring) independently verified the roster claims in `we:scripts/lib/gate-config.mjs` and
confirmed the premise, then flagged the fork's *shape*: as written it offered three named JSON files as
branches, and since "the gating property is not intrinsic to either file, it is conferred by a roster entry",
what remained inside the fork after the forced invariant was "which already-or-newly-pinned file holds the
block" — implementation altitude — while the principle with teeth sat in the excluded-branch preamble rather
than in the ruling. **Fixed by re-shaping the fork to rule the surface *class*** (leash member vs not), with
the file choice explicitly demoted to the follow-on PR. Q2 was clear on both passes: (c) is refuted on
ratified authority and (b) stays defeatable however cheap maintenance is, so the difference is
authority and correctness, not effort.

## Fork 2 — The cooling clock: which timestamp it may read, what cancels it, and its floor

*Fork exists (forced invariant): the excluded branch — **a clock whose input the gated actor can set** — is
**broken**, and the item's own cited authority is what breaks it. #2978 rules that an emitter-written value
"authenticates nothing" (`we:docs/agent/platform-decisions.md:3496`). A git committer date is emitter-written
(`GIT_COMMITTER_DATE=… git commit` sets it to anything), a start date recorded in the record is self-reported
by definition, and `Date.now()` is wall clock. Support-both is unavailable here in a way worth stating: two
accepted clock inputs means the gated actor picks the weaker one, which *is* the vulnerability. Exactly one
timestamp can define one interval, so the choice among inputs is a real either/or.*

- **(a) The server-side merge timestamp of the PR that landed the amendment's record, read from the forge
  API. A substantive change to the proposed amendment text **cancels** the period — a new record starts a new
  clock, it does not resume. The interval must **exceed one continuous working stretch**. And the gate
  **parks** the PR with its ripe-at date stated, rather than hard-refusing.** **DEFAULT.** The merge timestamp
  is the only date in the flow the amending actor does not write: it is stamped by the forge, after the record
  has already passed the ordinary gate, and it cannot be backdated without rewriting history the drain and CI
  both observe. **Cancel, not restart** is the verified Rust FCP behaviour — a substantive new argument does
  not reset the countdown, "the FCP is canceled, and the RFC goes back into development mode" — and it is
  strictly stronger than a restart against the attack that matters: landing a placeholder record, letting the
  clock run, and swapping in the real text at the end. It also avoids a defect the first draft shipped:
  `git log -1` returns the *latest* commit touching the path, so a git-date clock silently *restarts* on any
  touch, the exact opposite of the rule it was meant to encode. "Substantive" is the test the repo already
  applies to a spec — any diff to the proposed amendment text, prose included
  (`we:docs/agent/platform-decisions.md:2962-2963`). **The floor is ruled, not configured:** the interval must
  exceed one continuous working stretch, because that is the single failure #2564 Fork 5(a)(ii) named ("a
  single actor re-reading a self-proposal minutes later"), and it is the only constraint on the duration that
  survives a zero-cost strip — which is exactly why the *value* above it is configuration (see "Settled, not
  forks") and this bound is not. It is also scope-independent, so a project may only ever tighten the value.
  **Park, not hard-block, is required by a sibling anchor rather than chosen:**
  `#blast-radius-advisory-care-not-a-gate` rules that where a signal is tightened to a gate, "`gate` means
  route-to-a-human, never hard-block-with-no-reviewer" (`we:docs/agent/platform-decisions.md:2883`). So an
  un-ripe amendment PR is *parked with its ripe-at date surfaced*, on the existing `review:human` hold — a
  state a human can see and act on — never a refusal with no path.
- (b) The record file's **git committer date** (`git log -1 --format=%cI`). *Rejected:* settable by one
  environment variable, by the very actor the clause gates — cheaper to forge than the session id this item
  elsewhere honest-costs — and it restarts on any touch, as above.
- (c) A **self-reported start date** recorded in the record itself. *Rejected on #2978 directly* — the emitter
  writing its own start date is the shape that anchor exists to refuse. Dropped from the record template
  accordingly.
- (d) A **non-authoring-session condition** (the ratifying session must not be the authoring one) as an
  additional structural requirement. *Rejected — it cannot fire on this class of PR, and that is ratified
  design, not oversight.* A constitution amendment touches the statute, so it routes `review:human`, and the
  only clear path for a `review:human` PR is `--to=clear-human`, which
  `we:scripts/lib/review-independence.mjs:42-48` **explicitly exempts** from the self-clear refusal — an
  exemption the file documents as load-bearing, because "the operator's own `/review` ceremony shells the CLI
  from inside the very session that opened the PR." The same file records that **a subagent inherits its
  parent's session id** (`we:scripts/lib/review-independence.mjs:301-307`), so no throwaway agent satisfies
  it either. Adding the condition would be inert at best and would deadlock the sanctioned operator path at
  worst. **What replaces it, and is real:** the `clear-human` ceremony already demands an explicit `--actor`
  and a quoted `--reason` posted verbatim as a durable comment, and the entrenched path additionally requires
  `redteam:accepted`, the independent-validator label (`we:scripts/lib/review-escalation.mjs:42`).

```js
// Fork 2 (a) — the clock, as review-escalation.mjs would evaluate it (extension, not built here).
// Every input is forge-side or base-vs-head; none is written by the actor being gated.
import { addIsoDuration } from './research-freshness.cjs';        // the repo's only calendar arithmetic
if (proposedTextChangedSinceRecord(amendment))                    // base-vs-head on the record's diff block
  return park('constitution: cooling period CANCELED — re-record and restart');
const openedAt = prMergedAt(amendment.recordPr);                  // forge API, not GIT_COMMITTER_DATE
const ripeAt   = addIsoDuration(new Date(openedAt), policy.constitution.coolingPeriod);
if (Date.now() < ripeAt)
  return park(`constitution: cooling until ${ripeAt.toISOString().slice(0,10)}`);  // park, never refuse (#2563)
// (b) git committer date and (c) a self-reported start date are both settable by the gated actor.
// (d) a non-authoring-session check cannot fire: `clear-human` is exempt from the self-clear refusal.
```

**Known occurrences.** Mandated pre-decision intervals are standard governance equipment and the attested
band is narrow: Apache's 72-hour voting minimum, Rust's 10-day Final Comment Period, IETF Last Call at two
weeks (four for individual submissions), Debian's bounded two-to-three-week window, W3C's 28-day Advisory
Committee review. Debian's is the most implementable restart design in the survey — new input resets the
clock but never past a hard ceiling, so drip-fed objections cannot filibuster. **The instructive
counter-example is TC39, which has no waiting period at all** (its gate is unanimity among independent
delegations), worth recording because it shows an interval is not self-evidently required; it does not
reopen the clause, since #2564 Fork 5 already ratified that one exists and unanimity is the substitute
unavailable solo.

`Skeptic:` **REFUTED → default flipped, twice over.** The skeptic destroyed the first draft's clock on its
own cited authority: the draft asserted the git commit date was "never a self-reported field, because an
emitter-written date authenticates nothing (#2978)" — but a committer date *is* emitter-written, so the
rationale falsified the mechanism it defended, and `git log -1` restarts rather than cancels. It separately
showed the non-authoring-session condition is unreachable on `review:human` PRs (the `clear-human` exemption,
plus subagent session inheritance), verified in the file before folding. Both were fixed by moving to the
forge-stamped merge timestamp and by replacing the condition with ceremony signals that already exist. The
skeptic also surfaced `#blast-radius-advisory-care-not-a-gate`'s route-to-a-human clause, which the draft's
hard `refuse(...)` violated — folded as park-with-a-ripe-date.

`Screen:` **flagged(prio) → fixed by re-shaping the fork; re-screen clear.** The first screen flagged the
predecessor of this fork: its branches were four *integers* (10 / 28 / 14 / 3), and under the zero-cost
hypothetical the only downside of the longest was waiting longer — pure throughput — while the rejection of
14 was "underived", a provenance preference rather than a merit axis. It observed that the parts genuinely
carrying merit "appear in no rival branch at all, which is the signature of a forced invariant", and
prescribed re-shaping around the clock's *structure* with the day-count demoted to a platform-default value.
That was done. The re-screen then cleared both questions on the rewritten fork — Q1 because "under (b) an
actor sets `GIT_COMMITTER_DATE` and the amendment ripens immediately", a divergence anyone who attempts it
observes; Q2 because "a clock whose input the gated actor writes is defeatable no matter how free maintenance
is." It noted the fork now reads closer to a forced invariant than an either/or, which is accepted: the
fork-existence line above states it as a forced invariant.

## Fork 3 — Project scope: the surface a subordinate constitution joins the tier through

*Fork exists (forced invariant): the excluded branch — **a project declares itself into the tier from its own
file** — is **broken**. `we:src/_data/projects/` matches nothing in the escalation roster (blast-radius
covers only `src/_data/{blocks,plugs,intents,protocols,semantics}.json`,
`we:scripts/lib/review-escalation.mjs:252`), so a project could opt **into or out of** the constitution tier
via an ordinary agent-clearable PR — reproducing verbatim, at project scope, the membership laundering
#2568's skeptic closed at platform scope
(`we:backlog/2568-constitution-curation-form-which-core-principles-vs-specs-an.md:102-106`). A tier you can
join and leave by an unwatched edit is not a tier. Membership by **artifact name or repository location** is
broken for the same family of reason plus one more — it would make membership depend on a filename in repos
WE does not gate, so any repo could unilaterally entrench arbitrary prose, and could evade the ceremony with
a rename.*

#2564 already ratified that subordinate tiers **exist** — "Tiers exist at platform scope (supreme) and
per-project scope (subordinate — a project constitution derives from and may not contradict the platform
one); the amendment gate and consistency check scale with scope"
(`we:docs/agent/platform-decisions.md:2969-2970`). What it left open, and this fork settles, is the surface
membership is asserted on.

**A grounding correction this fork turns on.** #2564's "project" is a **WE standards project** — the
`ownedByProject` owner of intents and protocols, e.g. `webrealtime`
(`we:backlog/2564-adopt-spec-based-programming-across-the-constellation-schema.md:126-131`); 46 of them live
under `we:src/_data/projects/`. It does **not** mean a constellation repo. That matters because a real
document already exists at `plateau-app:constitution.md` — published at a public `/constitution` route by
`plateau-app:packages/saas/src/marketing/constitution.ts`, which bundles the repo-root file so the page
cannot drift from the doc (single-authoring-SoT and a derived projection, already correctly applied). It is a
**product north-star** that explicitly disclaims build decisions ("It does **not** decide how we build
anything"), so it is a different artifact class sharing a word. Under the default below it is outside the
tier by construction — a vocabulary collision worth disambiguating, not a governance breach.

- **(a) A project joins the tier by being listed in the platform-scope declaration — the `constitution` block
  on the leash surface (Fork 1(a)) — so joining or leaving is itself a platform-tier act carrying the full
  ceremony. The project's own file may then hold its stricter anchors, but its membership is not
  self-asserted.** **DEFAULT.** This is the federal/state relation applied rather than re-invented: a state
  constitution is one because a ratifying process at the higher level made it one, not because the document
  says so. It closes the laundering hole at project scope with the same mechanism that closes it at platform
  scope, instead of leaving the lower tier protected by nothing. **The honest current answer to #2564's open
  sub-question** ("whether a project needs an explicit constitution artifact at all, or only gets one when it
  asserts principles beyond the platform's",
  `we:backlog/2564-adopt-spec-based-programming-across-the-constellation-schema.md:138-140`) follows: **no
  project is listed, so project scope is defined-but-unpopulated** — the ceremony is specified so the first
  project to assert a principle beyond the platform's has a gate to walk through, and nothing is built until
  one does.
- (b) **Self-declaration in the project's own `we:src/_data/projects/<id>.json`.** *Rejected* on the forced
  invariant above — an ungated surface today. It could be rescued by adding `we:src/_data/projects/` to the
  `POLICY_SPEC` leash, and that variant is rejected on merit rather than cost: pinning 46 ordinary metadata
  files as human-gated whole files widens the human gate far past genuine judgment, which
  `#human-required-is-judgment-only` (`we:docs/agent/platform-decisions.md:3430`) reserves it for. (a)
  achieves the same protection with one already-pinned block.
- (c) Membership by **name or location** — any repo-root constitution document in a constellation repo.
  *Rejected* on the forced invariant above; it would also pull `plateau-app:constitution.md` into a ceremony
  designed for conduct principles, which is not what that document is.
- (d) **No project scope at all** — one constellation constitution, projects get specs only. *Rejected:*
  #2564 ratified subordinate tiers (`we:docs/agent/platform-decisions.md:2969-2970`); removing them is a
  reversal of a ratified call, which is its own #911 supersede decision with its own lineage — not something
  this item may do in passing.

```jsonc
// Fork 3 (a) — membership is asserted at PLATFORM scope, on the pinned leash surface, so entry and exit are
// themselves constitutional acts. Alongside the `constitution` block of Fork 1(a):
{
  "constitution": {
    "anchors": ["<platform-tier anchors, from #2568>"],
    "projects": {                       // EMPTY today — the tier is defined but unpopulated
      // "webrealtime": { "anchors": ["…"], "coolingPeriod": "P14D" }  // may only TIGHTEN (#2564 federation)
    }
  }
}
// (b) excluded — src/_data/projects/<id>.json is matched by no roster pattern, so a project would both
// entrench and un-entrench itself through an ordinary agent-cleared PR.
```

**Known occurrences.** The federal/state relation #2564 cites is the standard model, and its defining feature
is exactly declared-at-the-higher-level membership plus a supremacy clause. The same shape appears in
software federation: a Kubernetes SIG's charter binds because the org's governance repo lists it, not because
a charter file exists in some repo.

`Skeptic:` **REFUTED → default flipped.** The first draft made a project enter the tier by declaring a
`constitution` block in its own `we:src/_data/projects/<id>.json`. The skeptic showed that path matches
nothing in the escalation roster (verified at `we:scripts/lib/review-escalation.mjs:252`), so a project would
both entrench and un-entrench itself through an ordinary agent-cleared edit — the exact laundering hole
#2568's skeptic had closed one scope up, reproduced and left open. The default flipped to membership asserted
at platform scope on the pinned leash surface. The skeptic separately routed the draft's interval-scaling
sub-fork to `#config-extends-platform-default`, which is correct and removed it from this fork.

`Screen:` **clear on both passes.** Q1: the adversarial read ("a key in one JSON versus a key in another, and
the map is empty today") fails, because "the rule allocates *who may change membership*" — an authority
contract spanning platform and project scope, observable to anyone who opens such a PR. Q2: support-both is
unavailable, because a union rule "means a project self-enters *and* self-exits by the same ungated edit,
which reinstates the laundering hole intact", and (c) actively contradicts (a) on the same artifact. The
re-screen specifically checked whether (b)'s rejection had cost creeping in and confirmed it lands on merit
via `#human-required-is-judgment-only`.

## Settled, not forks — recorded so no live choice sits outside a `## Fork N`

- **The committed record's shape — settled by precedent, dissolved from a fork.** The record is: a
  **mandatory amending `kind: decision` item** carrying the ruling and the proposed diff, plus a
  `we:reports/YYYY-MM-DD-constitution-amendment-<slug>.md` carrying the long-form red-team transcript,
  referenced by `relatedReport` and anchored by a quoted turn plus a harness-written transcript pointer
  (#2978's shape). **This was drafted as a fork and the fresh-context re-screen dissolved it**, correctly:
  the excluded branches (a PR comment, the gitignored `.conveyor/` jury ledger,
  `we:scripts/lib/jury-ledger.mjs:61-73`) are excluded by clause (iii)'s own word *committed*, not by any
  ruling here; and the only argument separating the surviving branches — an amendment *is* a decision, so it
  takes the decision form — is **settled by precedent**, which is not a ratifiable fork. The remaining
  rationale had been drift-and-reuse framed, which does not survive a zero-cost strip. **One deliberate
  divergence from the ADR/MADR/PEP convention** the survey found: the record carries **no** `superseded-by`
  field, because clause (i) is exactly the removal of the supersede path for this tier; the closer analogue
  is the IETF model, where a **published document is never edited in place** — a revision is a new dated
  document, and the old one stays frozen. **Only that immutability half of the analogy transfers, and only
  that half is claimed here:** this repo's research chain already works that way
  (`we:docs/agent/research-workflow.md:51-57`, refresh-as-new-dated-report, never in place). Its *lineage* is
  explicitly **bidirectional**, not one-way — step 3 requires the `supersededBy` back-pointer on the retired
  entry and `we:scripts/check-standards.mjs:273-286` warns when a pointer is one-way
  (`we:docs/agent/research-workflow.md:58-63`) — so the repo is **not** precedent for one-way lineage and is
  not cited as such. What drops the `superseded-by` field from an amendment record is clause (i) alone.
- **What the record may be trusted for — stated plainly, because the gate does not depend on it.**
  `validateReportsNotHidden` (`we:scripts/check-standards-rules.mjs:1406-1417`) checks **reachability only**,
  never content, and is satisfied by *either* a `/research/` topic or a backlog `relatedReport`; `reports/`
  matches no pattern in `we:scripts/lib/review-escalation.mjs`, so the transcript file is editable by an
  ordinary agent-cleared PR; and #2978's verification is **ratified but unbuilt** (no transcript-pointer check
  exists under `we:scripts/`). So the record is **evidence that survives after the fact, not a gate**. The
  gate is Fork 1's declaration plus Fork 2's clock, neither of which reads the record's contents — only the
  merge timestamp of the PR that landed it.
- **The cooling period's day-count is a config value, not a ratifiable pick.** Both the first screen and the
  skeptic classed "10 vs 28 vs 14 vs 3" as **two values of one knob**, which
  `we:docs/agent/backlog-workflow.md:423` treats as dispositive, and routed it to
  `#config-extends-platform-default` (`we:docs/agent/platform-decisions.md:1630-1638`). **The platform-default
  flavor is `P10D`**, declared on the leash surface per Fork 1(a). **It is the best-attested convention the
  survey found that states a rationale at all — it is not derived, and no arithmetic here produces 10.** Rust's
  Final Comment Period is ten calendar days, and the reason its author gives is that this keeps the window
  "open for at least 5 business days" — a **stated minimum with margin**, not a computation. (The shortest
  calendar span *guaranteed* to contain five working days is **7** days, not 10; the extra three days are
  Rust's chosen slack, and nothing in this survey derives that slack either.) So `P10D` rests on precedent
  plus the ruled bound below — which is precisely why it is **configuration** and not a ratifiable pick. The
  **bound** on the value (it must exceed one continuous working stretch) is ruled in Fork 2(a), not
  configured. **Stated honestly, because the value rests on it:** the empirical case for cooling periods is
  weak — Utah's 72-hour waiting period changed ~2% of already-certain decisions, delay does not debias
  anchoring, the unconscious-thought advantage failed a large multi-lab replication, and the one solid
  positive (Buçinca et al., CSCW 2021) used a pause on the order of seconds, attributing the effect to
  interrupting the automatic accept. **Those last three are secondary-source figures carried from the survey
  and not re-verified against the papers here**, so no ruling below leans on their exact numbers. The interval
  buys *a window in which new information can arrive*, not better deliberation.
- **A generated single-file rendering of the constitution-tier anchors** (for a human, or for #2571's review
  UI) is supported and not a fork — #2568 Fork 1 already establishes that a *generated* rendering is a
  projection, not an authoring home.
- **A durable, unforgeable actor signal** is out of scope and already owned:
  `we:scripts/lib/review-independence.mjs` states plainly that its session id is forgeable and names #2946's
  hardware presence gesture as the fix.
- **A `supersede` verb for the ordinary statute layer** is **out of scope here and carries no claim** — Fork
  1(c)'s reasoning bears only on this gate's enforcement point and takes no position on whether such a verb
  should exist.

## Statute composition — how this rule sits with the governance cluster (#1886 reconciliation)

The rule this item would codify touches turf four ratified anchors already govern, so the composition is
stated here rather than discovered at resolve time:

- **`#review-human-declarative-leash-only` (#2771) clause 2** routes *codification of an already-ruled
  decision* to the committee, not `review:human`, detected script-decidably from the resolve+codify diff
  shape (`we:docs/agent/platform-decisions.md:3414`). That would otherwise collide with the entrenched route
  every time a resolved decision extends a constitution-tier anchor. **They compose on the ceremony's
  completion, not on the diff shape:** a constitution-tier anchor's rule text can only have been *authored*
  through this item's ceremony, so once that ceremony completed, mechanically codifying the ruling is exactly
  the case #2771 clause 2 hands to the committee. The entrenched path gates **authoring or weakening** a tier
  anchor; #2771 clause 2 keeps governing the codification that follows — #2851's judgment-only line (`:3430`)
  applied unchanged.
- **`#human-is-principle-surface-not-path` (#2840)** already owns per-anchor recognition inside the statute
  document (trigger 1) and names `isPrincipleSurface(changedFile, diffHunks)` plus its producer-side plumbing
  as an owed follow-on. **This item must not mint a second hunk-to-anchor attributor** — that is the drift
  `we:scripts/lib/converge-core.mjs:419` warns against: "A second unreachable copy of a rule is not defence in
  depth, it is drift waiting to happen." The constitution-tier
  test is a **predicate consumed by** `isPrincipleSurface`, raising its verdict from *human* to *entrenched*
  for a listed anchor; never a parallel function.
- **`#principle-and-impl-two-pr` (#2839)** means this item's ruling cannot land as one change: the statute
  clause conferring the exemption lands **first**, in a decisions-only `review:human` PR; the enforcement
  follows in impl PRs citing the resolved `codifiedIn` anchor. Those impl PRs are **two, not one**: the leash
  declaration is itself human-gated by #2840 trigger 3, while the rubric's read of it is ratified
  agent-clearable by #2771 clause 1, so bundling them would drag committee work behind a human gate. The
  touch-set below is split accordingly.
- **`#blast-radius-advisory-care-not-a-gate`** supplies the park-not-block rule folded into Fork 2(a).

## Predicted touch-set (#2619)

Split by the two-PR rule (#2839), because these cannot travel in one diff — and split **three** ways, not two,
because Fork 1(a)'s own ruling makes the leash touch human-gated. The implementation half cannot be one
committee-cleared PR: `we:scripts/lib/review-policy.contract.json` and `we:scripts/lib/gate-config.mjs` are
`POLICY_SPEC` leash members, and `humanRequired = leashFiles.length > 0 || statuteFiles.length > 0`
(`we:scripts/lib/review-escalation.mjs:574`) forces `review:human` on any diff that touches them. Putting the
derivation-code change in that same PR would drag ratified-agent-clearable work (#2771 clause 1) behind a human
gate for no reason, so it gets its own PR:

- **PR 1 — principle (decisions-only, `review:human`):** `we:docs/agent/platform-decisions.md` (the
  conferring clause in the promotion-discipline preamble plus the quantified clauses on
  `#spec-is-schema-human-gates-spec`) and `we:docs/agent/backlog-workflow.md` (the ceremony as process).
- **PR 2 — the leash declaration (implementation, but `review:human` — forced, not chosen; cites PR 1's
  resolved anchor):** `we:scripts/lib/review-policy.contract.json` and `we:scripts/lib/gate-config.mjs` (the
  `constitution` block and its roster entry), plus the `POLICY_SPEC` conformance/invariant assertions that
  cover them. Human-gated by #2840 trigger 3's whole-file pin — which is the *point* of Fork 1(a), so this is
  the ruling working as intended, not friction. It is still **implementation** at #2839's split-gate grain
  (that gate evaluates the edit-of-a-pre-existing-guarantee, explicitly *not* the `POLICY_SPEC` whole-file
  floor), so it does not trip `assertNotPrincipleAndImpl`.
- **PR 3 — the derivation code (committee-cleared; cites PR 1's resolved anchor):**
  `we:scripts/lib/review-escalation.mjs` only — *reading* the declaration as a predicate consumed by
  `isPrincipleSurface`, never defining it. Agent-clearable on ratified authority (#2771 clause 1), which is
  exactly why it must not ride in PR 2.

No `scope:` is stamped on this item — a decision is ratified, never dispatched to build; each buildable child
carved at resolution takes its own slice, and the three bullets above are the three slices.

### Review jury (provisional — pre-registered #2638)

Care level: `high` — the scope touches the statute layer and the declarative leash, both of which force
`humanRequired`, which `deriveCareLevel` scores `high` unconditionally
(`we:scripts/lib/review-escalation.mjs:384-396`). This jury binds against the predicted touch-set above and
is re-checked against the real diff at PR open.

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

## Acceptance

All three forks are ruled, so #2564 Fork 5's three clauses each become buildable: a conferring surface class
for (i), a forge-stamped clock with a ruled floor and a platform-default interval for (ii), a record shape
with a stated trust level for (iii), and a membership surface for the federated scope #2564 left open. On
resolution `codifiedIn` extends `we:docs/agent/platform-decisions.md#spec-is-schema-human-gates-spec` with the
quantified clauses, adds the carve-out to the promotion-discipline preamble, and adds the cross-references to
#2561 F4 / #2568 and to the #2771 / #2839 / #2840 cluster that the anchor has never carried — lineage
cross-references, which are explicitly *not* an amendment of the ratified call.

## Related

- #2564 (ratified 2026-07-19; codified at
  [`we:platform-decisions.md#spec-is-schema-human-gates-spec`](../docs/agent/platform-decisions.md#spec-is-schema-human-gates-spec))
  — the constitution tier and Fork 5's three entrenchment clauses; the source of every quantity this item fixes.
- #2561 F4 (ratified 2026-07-19, same day) — rejects a standalone constitution artifact as the broken branch;
  delegated form and membership to #2568.
- #2568 ("Constitution curation + form", prepared 2026-08-16) — owns the form call and the anchor list these
  forks attach to. **Ratify #2568 first, then this item.** Its Fork 1 body still describes the pre-#2840 gate;
  that does not change its ruling (a pointer index, no second authoring home), but this item's Fork 1 governs
  what *class of surface* that index may live on. A cross-reference note was added to #2568 in this pass.
- #2771 / #2839 / #2840 / #2851 — the 2026-07-28→08-02 governance cluster defining the leash, the principle
  surface, and the two-PR rule. Load-bearing for every fork here; uncited by #2564, #2561 and #2568.
- #2571 — plateau-app's constitution/spec review UI; the downstream consumer that cannot be built until the
  ceremony has a surface, a clock, and a record.
- #2978 (codified at
  [`we:platform-decisions.md#memory-admission-verified-grounding`](../docs/agent/platform-decisions.md#memory-admission-verified-grounding))
  — the quoted-turn-plus-harness-transcript-pointer shape the record borrows, and the rule that killed the
  first draft's self-reported clock.
- Research: [`/research/constitutional-amendment-gate-quantification/`](/research/constitutional-amendment-gate-quantification/)
  — the prior-art survey behind every number and format above.
