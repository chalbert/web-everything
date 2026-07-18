---
bornAs: cvg2563r
kind: decision
size: 8
status: resolved
dateOpened: "2026-07-18"
dateStarted: "2026-07-18"
dateResolved: "2026-07-18"
graduatedTo: none
preparedDate: "2026-07-18"
relatedReport: reports/2026-07-18-blast-radius-advisory-review-gating.md
codifiedIn: "docs/agent/platform-decisions.md#blast-radius-advisory-care-not-a-gate"
tags: [drain, review, convergence, escalation, console, config]
---

# Blast-radius is advisory care-level, not a park-gate — converge-by-default, human only on non-convergence, console re-round

## Grounding digest

The drain's review rubric conflates **"this needs a review"** with **"this needs a human."** Every
deterministic signal in `scoreEscalation` — blast-radius, size, dismissed-findings, cross-repo, sampling,
plus gate-self/statute — sets one flag, `escalate` (`we:scripts/lib/review-escalation.mjs:221`), which stamps
a **blocking** `review:pending`/`review:human` label and parks the PR. But the disposition engine already
classes the *scored* signals as agent-clearable: `deriveReviewDisposition` returns `{mode: converge,
autoLand: true}` for blast-radius (`we:scripts/lib/review-core.mjs:456-457`). So a blast-radius PR is, by the
model's own logic, meant to be fixed-and-landed by the convergence loop with **no human** — yet in practice it
bounces to the operator, because (1) the blocking `review:pending` label refuses the land until a verdict
clears it (`we:scripts/merge-ai-prs.mjs:1479-1485` — "an escalated PR PARKS ALIVE … SKIPPED … until a
reviewer applies review:accepted"), and (2) the convergence loop that would clear it is a
`/drain` **skill ceremony**, and the always-on daemon that actually sweeps the queue is de-scoped to *"no
agent spawning"* (`plateau-app:tools/drain-daemon/daemon.mjs:9`). The loop never runs; the park strands; the
human is reached by neglect, not by design.

The reframe (operator, 2026-07-18): **blast-radius is not a gate — it is care-level information** that tells
the reviewer (agent or human) how hard to look. A high care-level still gets a review; it just doesn't route
to a human. **A human is reached only when the convergence loop fails to land.** The operator console gains a
**send-back-for-another-round** action with an optional steering guideline. Much of this should be
**configurable through a plateau-app-driven settings panel built on the same shared review core** — so the
standard question becomes *what is fixed vs what is a knob.*

Prior-art (report `we:reports/2026-07-18-blast-radius-advisory-review-gating.md`): the gate-vs-advisory split
tracks *what the signal measures* — **ownership/path-sensitivity is a hard gate** (CODEOWNERS, SonarQube),
**a computed risk score is advisory** (risk-based IaC review, GCP Change Risk, risk-based testing all
*flag/prioritize*, never hard-stop). Auto-fix triggers sit in a **separate event-triggered bot, not the queue
daemon** (CodeRabbit, GitHub merge queue, Graphite). Independence survives as long as fixer ≠ final approver.
Two hazards the red-team sharpened: **(i)** advisory demotion for scored signals means high-blast changes can
**auto-land with no human ever looking** — but in every "flag-don't-gate" prior-art system the high-risk
bucket still terminates at a *human desk* with more scrutiny, not at *more agents*; so the care-level needs a
**deterministic human spot-check**, not just more agent rounds. **(ii)** a separate convergence runner that
writes `main` directly races the daemon's whole-process merge lease — so the runner must **converge + label
only, never land.**

## The axis

The decision splits into **fixed invariants** (ratifiable core, never a knob), **config dimensions** (the
plateau settings panel, most-permissive default), and **two genuine forks**. The engine is unchanged and
single-sourced: `scoreEscalation` / `deriveReviewDisposition` / the convergence bar in
`we:scripts/lib/review-core.mjs` stay the one core — grounded at `scoreEscalation`
(`we:scripts/lib/review-escalation.mjs:182-222`), `producerReviewLabel` (`:236-240`), `decideReviewGate`
(`:359-380`), and `deriveReviewDisposition` (`we:scripts/lib/review-core.mjs:448-458`). It composes with — and
does not alter — the convergence bar or the non-author invariant codified at
[`#agent-convergence-independent-validation`](../docs/agent/platform-decisions.md#agent-convergence-independent-validation).

## Recommended path at a glance

| # | Fork | Options | Default |
|---|------|---------|---------|
| 1 | Which trust-chain changes force a human — the *spec*, not the whole path | (a) any path touch · (b) gate the *spec* (schema, not prose) | **✅ RATIFIED (b)** — 2026-07-18 |
| 2 | High-blast backstop — who is the independent axis? | (a) diversity-selection AI panel **+** point-level human check · (b) AI panel alone | **✅ RATIFIED (a)** — 2026-07-18; cleared-content sample = option, default off (operator oversight is the axis now) |

*Not forks:* per-signal advisory→gate override, thresholds, human-sample rate, convergence enable/scope are
**config dimensions** (below); the console re-round action and the settings panel are **support-both builds**;
the runner-converges-daemon-lands split and the separate-runner placement are **settled** (below).

## Fixed invariants (ratifiable core — never a config knob)

- **The score→advisory *principle* is the ratified default, not a free knob.** A computed risk score
  (blast-radius / size / dismissed-findings / cross-repo / sampling) **annotates a care-level**; it does not
  block the land on a review verdict. This is the headline rule being codified — a repo may *tighten* it (see
  config), but "advisory" is the platform default, not merely one value of a preference.
- **The trust-chain / statute hard gate stays hard.** `gate-self` (`isGateSelfPath`) and `statute`
  (`isStatutePath`) keep setting `humanRequired` (`we:scripts/lib/review-escalation.mjs:206-210`) — the one
  place ownership-based hard gating is correct. No config demotes these.
- **A non-zero decorrelated human axis on high-blast auto-lands** — but *how* it is provided is a knob.
  Because an advisory high-blast change can otherwise converge and auto-land with **zero** human eyes, and the
  cognitive-science pass showed the AI panel shares blind spots (so it can't self-cover), **some** human
  decorrelated oversight must exist. That axis can be **(i)** the operator's direct oversight of what is built
  (the ratified choice *now* — #2563 Fork 2 touchpoint 4, sample OFF), or **(ii)** the automated post-land
  audit sample (the option, enabled when direct oversight stops scaling). What is fixed is that the axis is
  **not nothing**; the *mechanism* (manual vs sampled) and the sample rate are config. See Fork 2.
- **The conflict-of-interest invariant is absolute.** A landed PR is accepted by an actor that did not author
  the fix (`#agent-convergence-independent-validation`, #2439). No knob relaxes it.
- **Non-convergence hard-escalates to a human.** Round-cap / mandate-conflict → `review:human`, unchanged
  (`DEADLOCK_REASONS`, `we:scripts/lib/review-core.mjs:455`).
- **One shared core.** The settings panel, the drain, the scheduled runner, and `/review` all read the *same*
  rubric + disposition functions; no divergent second implementation.

## Settled (not forks — forced by an existing decision)

- **The convergence runner converges + labels only; the resident daemon lands.** The daemon holds the
  whole-process drain lease (#2391) for its entire residency (`plateau-app:tools/drain-daemon/daemon.mjs:5-6`).
  A runner that wrote `main` directly would deadlock on that lease or split land-authority across two
  processes (double-processing the same PR). So the scheduled runner applies `review:accepted` /
  `ready-to-merge` only; the daemon remains the sole `main`-writer on its normal `--label=ready-to-merge`
  pass. Keeps the non-author invariant crisp (agent converges, deterministic process lands).
- **The trigger is a separate scheduled agent-runner, not the daemon.** The daemon was purpose-built to *not*
  spawn agents (`plateau-app:tools/drain-daemon/daemon.mjs:9`, 2026-07-11 de-scope); the industry norm is a
  separate event-triggered auto-fix bot. So a cron/routine/`/loop`-driven session runs the **un-deferred**
  convergence workflow (`we:scripts/workflows/review-parked-prs.mjs`, finishing #2437/#2410). Placement is
  forced, not a live fork.

## Config dimensions (the plateau-driven settings panel — not ratifiable forks)

Per Q4 (both branches are legitimate end-states → `#config-extends-platform-default`), these are **knobs, not
forks** — staged autonomy (*start advisory, enforce later, graduate per-repo*) is why. Default = the
**most-permissive platform flavor**; a conservative repo tightens.

- **Per-signal advisory→gate override.** A repo may tighten a *scored* signal from advisory to a gate — where
  **`gate` means *route to a human reviewer*, never *hard-block the land with no reviewer*** (a hard-block
  recreates the exact strand this item removes). Platform default: **advisory**.
- **Thresholds.** `diffLines` (400), `sampleNth` (10) already live in `DEFAULT_THRESHOLDS`
  (`we:scripts/lib/review-escalation.mjs:43-46`); the panel exposes them.
- **The high-blast human-sample rate.** The fraction of high-blast auto-lands routed to `review:human` (fixed
  invariant: `> 0`; the value is the knob).
- **Convergence enable / scope / round-cap.** Governed by the **staged-autonomy clause of
  [`#agent-convergence-independent-validation`](../docs/agent/platform-decisions.md#agent-convergence-independent-validation)**
  (`we:docs/agent/platform-decisions.md:2775-2776` — off-by-default, small/non-security first, graduating
  per-repo). Cited to that anchor, **not** re-declared here, so the two rules never drift.

**Placement (fixed by the constellation model — not a fork):** the config **schema + validated defaults live
in Web Everything** (extend `DEFAULT_THRESHOLDS` into a review-config shape in the shared core); the
**settings panel is a plateau-app product surface** rendering them over the same core. WE holds zero UI. Build,
not a decision.

## Fork 1 — Which trust-chain changes force a human: the *spec*, not the whole path

> **✅ RATIFIED 2026-07-18 (Nicolas Gilbert) — option (b).** A human gates a change to the trust-chain **spec**;
> implementation changes under a fixed spec are agent-clearable on conformance-green + independent review. The
> spec is a **schema/executable contract, not prose** (settled sub-fork). Prerequisite build: extract the
> escalation policy into an explicit contract artifact + conformance suite; until it exists, fail safe to the
> status-quo path test. (Fork 2 still open → #2563 not yet resolved.)

*Fork-existence: the human-clear rule is forced (auto-clearing a trust-chain **spec** change lets an agent
ratify a change to its own review leash — the non-author invariant forbids it), but **what counts as a
trust-chain change** is a genuine call: the status quo over-escalates.* Today `gate-self` is a pure **path
test** (`isGateSelfPath`) — *any* edit to `we:scripts/lib/review-escalation.mjs` forces a human, whether it
rewrites the escalation rubric or fixes a comment. That over-escalates on the trust-chain side exactly as
blast-radius over-escalates on the scored side — the human is fatigued on typos and waves through the edit
that matters.

Narrow it via the **spec-vs-implementation** line (spec-based programming — see the broader direction #2564 and
report `we:reports/2026-07-18-spec-based-programming-deep-research.md`, whose "Spec Growth Engine" finding
splits merge authority by blast radius exactly this way): **the spec always needs a human; the implementation
under a fixed spec is agent-clearable when an independent review agrees the spec is preserved.**

- **(a) Status quo — any trust-chain *path* touch forces a human.** Simple, but over-escalates every
  cosmetic/impl edit; fatigues the human on the changes that don't matter (the anti-pattern this whole item
  fights, now on the trust-chain side).
- **(b) A human gates a change to the trust-chain *spec*; impl changes are agent-clearable on
  conformance-green + independent review.** **Chosen.** The human-clear invariant is preserved for the thing
  that matters (the spec); behaviour-preserving impl tweaks stop stranding on a human. Convergence-success
  still ≠ clearance for a *spec* change (that stays `autoLand: false` → human).

**Settled sub-fork — the spec is a SCHEMA, not prose (ratified 2026-07-18).** For the gate to be
*deterministic*, the trust-chain spec must be a typed/executable **contract** (a schema for the thresholds +
reason sets + disposition, plus a conformance suite), so *"did the spec change?"* = a mechanical diff of the
contract file → **human**, and *"did the impl preserve the spec?"* = **run the conformance suite** →
agent-clearable. NOT prose (Kiro/Spec-Kit style), which forces the reviewer to interpret and kills
determinism (no tool auto-detects prose-spec drift). **Size is the wrong metric**: a 1-char threshold flip
(`400`→`40`) is an impl-sized diff but a *spec* change → human; a 200-line behaviour-preserving refactor is a
big diff but pure impl → agent-clearable.

**Prerequisite (a build):** extract the escalation policy into an explicit contract artifact (the
`DEFAULT_THRESHOLDS` + reason sets + `deriveReviewDisposition` branches are already nearly one) + a conformance
suite. Until the spec is explicit, **fail safe to human** (the status-quo path test). This is the first
concrete instance of `2564` (spec-based programming across the constellation).

```js
// deriveReviewDisposition — the carve-out (we:scripts/lib/review-core.mjs:455-457). Fork 1 (b) narrows WHICH
// gate-self diffs hit line 456: a SPEC change (contract-file diff) → human; a conformance-green IMPL change → 457.
if (list.some((r) => DEADLOCK_REASONS.includes(r)))          return { mode: HUMAN,    autoLand: false }; // non-convergence → human
if (list.some((r) => HUMAN_SENSITIVITY_REASONS.includes(r))) return { mode: CONVERGE, autoLand: false }; // trust-chain SPEC change → human CLEARS ← Fork 1 (b)
return { mode: CONVERGE, autoLand: true };                                                               // scored signals + spec-preserving impl → converge + auto-land
```

*Skeptic:* SURVIVES-WITH-AMENDMENT (amendment adopted, 2026-07-18) — original attack ("independence of the
validator could let gate-self auto-clear") still refuted: independence of the *reviewer* is not authority to
*amend the leash*. New attack the refinement invites: *"narrowing to spec-changes lets a real policy change
slip through disguised as impl if the conformance suite is incomplete."* Answer: any diff touching the
**contract file itself** is always human (never conformance-gated), and the suite's completeness is itself
part of the spec (gate-self); ambiguous / can't-prove-impl-only → human. The invariant holds; the gate just
stops firing on cosmetic trust-chain edits.
*Screen:* clear — a standard-level governance contract (which trust-chain changes need a human), not an impl
detail; a stark merit gap survives "both free to build" (over-escalate-everything vs gate-the-spec). The
schema-vs-prose sub-fork is a config/mechanism call, resolved to schema for determinism.

## Fork 2 — The high-blast backstop: care-level scales AI-review *rigor*, plus an *active* human check

> **✅ RATIFIED 2026-07-18 (Nicolas Gilbert) — option (a).** High-blast auto-lands run a diversity-aware AI
> panel (aggregated by diversity-*selection*, not majority vote). The human check is delivered **point-level**
> through the codified ruling console — (1) AI-flagged points, plain-language + example, ratify/fork/challenge;
> (2) always-review file blacklist; (3) full diff on demand. Touchpoint (4), the sampled decorrelated check on
> AI-*cleared* content, ships as a **config option, default OFF** — the operator's direct oversight is the
> decorrelated axis at current scale; enable the post-land audit sample when throughput outgrows manual watch.

*Fork-existence: two coherent branches that cannot coexist — either high-blast agent-only lands get a
deterministic independent backstop, or they don't. Both buildable; they differ on the safety merit, not
sequencing.* Grounded by `we:reports/2026-07-18-human-vs-ai-review-cognitive-science.md` (deep research,
adversarially verified) — which **corrected an earlier lean** in this fork. Care-level (blast/size) scales
**how** the review runs, never the *route* and never a cap on the work (operator, 2026-07-18): high-blast →
more rigorous **AI** review, not a smaller change and not "hand it to a human to re-read."

What the evidence settles:
- **Humans review large changes WORSE** (Cisco/SmartBear: defect density collapses past ~400 LOC / 60 min;
  vigilance decrement). So the human is **not** a line-by-line re-reviewer of big diffs — the AI, at constant
  attention over the whole diff, is better at that. The earlier "human desk catches the wide change" framing
  was wrong.
- **But a diverse AI panel does NOT decorrelate.** LLMs share failure modes (pairs agree ~60% when both
  wrong; correlation *rises* with capability, across vendors; ensembles realize ~0.43 of the independence
  gain; LLM-as-judge inflates same-family models). An AI panel is a **weak backstop against blind spots it
  shares** — the LLM analogue of Knight & Leveson (1986). So the panel scales review but cannot self-certify.
- **A passive human monitor is worse than useless** (automation bias: aided monitors catch *fewer* defects
  than unaided; not trainable away). So a human "approve?" rubber-stamp subtracts value.

- **(a) Diversity-aware AI panel for scale + an *active* human check.** High-blast auto-lands run a diverse
  panel (multiple models/providers, more lenses/rounds — the `MANDATE_LENSES`/`buildPanelMandate` path
  dialed up by care-level) **aggregated by diversity-*selection*, not majority vote** (majority voting hits a
  "popularity trap" that amplifies shared-wrong outputs). *Plus* a **non-zero sampled `review:human`** that is
  an **active** task — an independent intent/spec judgment + a fresh adversarial look, never a passive
  re-read. The human is the **only proven decorrelated axis** against the panel's shared blind spots, and
  carries intent authority + accountability. **Chosen.**
- **(b) Rely on the AI panel alone.** Max throughput, but the evidence says the panel shares blind spots and
  can manufacture false confidence — no independent axis. Rejected: not "humans review better," but "the panel
  is not independent of itself."

The human's role is scoped by the evidence — **intent/spec authority + a decorrelated check + accountability,
never line-by-line re-review** — and the sample is **active and non-trivial** (passive monitoring backfires),
graduated on track record, **never to zero** (the panel can't cover blind spots it shares).

**The human surface — point-level, not blanket (operator, 2026-07-18).** A blanket "escalate the whole PR to a
human" is the passive monitoring the evidence says *subtracts* value. Instead the human check is delivered as
**specific, concrete rulings in a codified decision UI** (the ruling console, #2494/#2555) — four touchpoints:

1. **Point-level escalation (AI-flagged).** The AI review surfaces a specific line or, better, a *semantic
   point*, **summarized in plain language with a concrete example**, and the human acts via **ratify / fork
   (choose an option) / challenge** — an *active* decision, not an approve button. This is where the AI's
   *known* uncertainty and any intent/spec question goes.
2. **Always-review blacklist.** A configured set of files (the spec/constitution/trust-chain tier) is
   **hard-gated** — full human review regardless, independent of the sample.
3. **Full diff on demand.** The human can always open the whole diff if they want it.
4. **A decorrelated check on AI-*cleared* content — a config OPTION, default OFF (ratified 2026-07-18).**
   Point-level escalation only covers what the AI *knows* it's unsure about; the panel's danger is what it is
   **confidently wrong** about and never flags — the only way a *shared* blind spot reaches a human is to look
   at some of what the panel confidently cleared. **Operator ruling: not needed now — the operator keeps close
   direct oversight of what is built, which *is* the non-zero decorrelated axis at current scale.** So the
   automated sample ships as an **available option, default off**, in its low-friction form: a **post-land
   audit** (the AI-cleared change lands; a small, care-weighted sample is surfaced afterward, plain-language;
   a human flag → rollback + fix + learning-loop signal), *not* a blocking random-PR gate. **Re-enable
   trigger:** when parallel throughput exceeds what one operator can directly watch (manual oversight stops
   covering the AI-cleared surface), turn the sample on — otherwise the decorrelated axis silently decays
   toward zero.

The **policy** (1–4) is what Fork 2 ratifies; the UI is a build under the console. This makes the human load
proportional to genuine judgment points, not PR count — and keeps the human *active* (each touch is a concrete
ratify/fork/challenge), which is exactly the automation-bias mitigation the research demands.

```js
// scoreEscalation — a sampled high-blast auto-land escalates to a HUMAN (active check), not review:pending.
// Rate is a config knob; that the sample is > 0 is fixed — the human is the only proven decorrelated axis.
if (signals.blastRadius && sampledForHumanSpotCheck(prNum, cfg.highBlastHumanSampleRate)) {
  humanRequired = true;                        // active independent judgment, NOT a passive re-read
  reasons.push('high-blast human spot-check (deterministic sample — decorrelated axis)');
}
// non-sampled high-blast: a diversity-SELECTION-aggregated panel (care-level dials panel size/lenses/rounds),
// never a naive majority vote (popularity trap amplifies shared-wrong outputs).
```

*Skeptic:* SURVIVES-WITH-AMENDMENT (2026-07-18, evidence-driven) — the original default was right (keep a
human backstop) but for the *wrong reason* ("prior art keeps a human desk / humans review wide changes"). The
cognitive-science pass refuted "humans review big PRs better" **and** the fallback "a diverse AI panel is a
sufficient decorrelated backstop." Corrected default: the human stays because it is the **only proven axis
independent of the AI panel's shared blind spots** — plus intent authority + accountability — and must be an
*active* task, not passive monitoring (which measurably backfires). Residual risk (flagged, not blocking):
human-vs-LLM error overlap is unmeasured, and LLM large-context reliability on big diffs is asserted by
analogy — so keep the human sample non-trivial until those are measured.
*Screen:* clear — a standard-level human-review-coverage policy (who is the independent axis on wide-impact
auto-lands), not orchestration; a real safety merit difference survives "both free to build."

## Supported by default (builds, not forks)

- **Console re-round action** (plateau-app, on the same core): a **send-back-for-another-round** button on a
  parked PR, with an optional free-text guideline that seeds the next `buildEditorMandate()` round; the
  guideline persists in the round history. No excluded branch — a build under #2494's loop console.
- **The settings panel** (plateau-app product surface over the WE review-config schema) — see *Placement*
  above.

## Codified-in reconciliation

Sets `codifiedIn` to a **new sibling anchor** — `#blast-radius-advisory-care-not-a-gate` — that **composes
with**
[`#agent-convergence-independent-validation`](../docs/agent/platform-decisions.md#agent-convergence-independent-validation)
(#2398/#2410): that anchor governs *how* a fix converges (the convergence bar + non-author invariant, both
unchanged); this one governs *which signals route into that loop advisorily vs hard-gate a human*, and the
high-blast human spot-check. No collision (verified: they test different turf). One anti-drift rule: the
**staged-autonomy / off-by-default clause is the sibling anchor's** (`we:docs/agent/platform-decisions.md:2775-2776`) —
this decision **cites** it, never re-declares it. Cite the two together at resolve.

## Related

Successor design over epic #2285 (negotiated agent review) and its open successor #2410 (unified convergence
loop); consumes #2437 (parked-PR workflow, to be un-deferred) and #2494 (loop console). Renders through the
shared review core (`we:scripts/lib/review-core.mjs`, #2325). Gate-self: this edits the review trust chain, so
any implementing diff is `review:human` and a human clears it.
